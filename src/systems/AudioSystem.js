// 程序化分层音频：所有声音由注册表驱动，可独立混音并支持距离衰减/左右声像。
export class AudioSystem {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.ctx = options.context || null;
    this.masterVolume = .72;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.buffers = new Map();
    this.active = new Set();
    this.created = [];
    this.heartbeatTimer = null;
    this.killStreak = 0;
    this.lastKillAt = -Infinity;
    this.registry = this.makeRegistry();
    this.bindEvents();
  }

  init(context = this.ctx) {
    const AudioCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!this.ctx && AudioCtor) this.ctx = new AudioCtor();
    if (!this.ctx && context) this.ctx = context;
    if (!this.ctx) return false;
    this.ctx.resume?.();
    if (!this.channels) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.channels = {};
      for (const [name, volume] of Object.entries({ gun: 1, ambience: .7, ui: .72 })) {
        const gain = this.ctx.createGain(); gain.gain.value = volume; gain.connect(this.master); this.channels[name] = gain;
      }
    }
    return true;
  }

  setListener(position, yaw = 0) { this.listener = { x: position.x, z: position.z, yaw }; }
  setVolume(channel, value) {
    const target = channel === 'master' ? this.master : this.channels?.[channel];
    if (target) target.gain.value = Math.max(0, Math.min(1, value));
  }

  bindEvents() {
    const map = {
      'weapon:shoot': e => this.play(`gun.${e.data?.id || 'pistol'}`, e),
      'weapon:reloadStage': e => this.play(`reload.${e.stage}`, e),
      'player:footstep': e => this.play(`footstep.${e.material || 'ground'}`, e),
      'player:jump': e => this.play('movement.jump', e),
      'player:land': e => this.play('movement.land', e),
      'shot:hit': e => this.play(e.headshot ? 'impact.headshot' : (['melee','exploder'].includes(e.enemy?.def?.role) ? 'impact.body' : 'impact.metal'), { ...e, position:e.point }),
      'bullet:whiz': e => this.play('bullet.whiz', e),
      'enemy:move': e => this.play(`enemy.${e.enemyType}.move`, e),
      'enemy:attackSound': e => this.play(`enemy.${e.enemyType}.attack`, e),
      'enemy:hit': e => { if (!e.fromShot) this.play(`enemy.${e.enemy?.type || 'assault'}.hit`, { ...e, position:e.enemy?.group?.position }); },
      'enemy:killed': e => { const now=this.ctx?.currentTime??performance.now()/1000;this.killStreak=now-this.lastKillAt<1.2?this.killStreak+1:1;this.lastKillAt=now;this.play('combat.kill',{...e,streak:this.killStreak,position:e.enemy?.group?.position});this.play(`enemy.${e.enemy?.type || 'assault'}.death`,{...e,position:e.enemy?.group?.position}); },
      'player:damaged': e => { this.play('player.hurt', e); this.updateHeartbeat(e.health, e.max); },
      'player:health': e => this.updateHeartbeat(e.health, e.max),
      'wave:start': e => this.play(e.boss ? 'wave.boss' : 'wave.start', e),
      'wave:cleared': e => this.play('wave.clear', e),
      'economy:spent': e => this.play('ui.purchase', e),
      'economy:gain': e => this.play('ui.coin', e),
      'buff:applied': e => this.play('ui.confirm', e),
      'ui:hover': e => this.play('ui.hover', e),
      'ui:click': e => this.play('ui.click', e),
    };
    Object.entries(map).forEach(([event, fn]) => this.bus.on(event, fn));
    this.eventMap = map;
  }

  makeRegistry() {
    const gun = (profile) => ({ channel: 'gun', spatial: true, build: e => this.gunshot(profile, e) });
    return {
      'gun.pistol': gun({ boom: 145, cutoff: 1550, punch: .38, tail: .17, metal: 2350 }),
      'gun.smg': gun({ boom: 190, cutoff: 2400, punch: .25, tail: .1, metal: 3100 }),
      'gun.shotgun': gun({ boom: 78, cutoff: 920, punch: .62, tail: .28, metal: 1700 }),
      'gun.khvostov': gun({ boom: 112, cutoff: 1900, punch: .34, tail: .16, metal: 2700 }),
      'gun.ace': gun({ boom: 96, cutoff: 1350, punch: .47, tail: .23, metal: 2100 }),
      'gun.conditional': gun({ boom: 62, cutoff: 760, punch: .68, tail: .32, metal: 1450 }),
      'reload.remove': { channel: 'gun', build: () => [this.noise(.085, .13, 1800, 'bandpass'), this.tone(480, .055, 'square', .055)] },
      'reload.insert': { channel: 'gun', build: () => [this.noise(.11, .16, 1050, 'bandpass'), this.tone(270, .075, 'triangle', .07)] },
      'reload.chamber': { channel: 'gun', build: () => [this.tone(1850, .035, 'square', .045), this.noise(.075, .1, 3200, 'highpass')] },
      'footstep.ground': { channel: 'ambience', spatial: true, build: () => [this.noise(.09, .085, 520, 'lowpass'), this.tone(92, .07, 'sine', .025)] },
      'footstep.stone': { channel: 'ambience', spatial: true, build: () => [this.noise(.065, .08, 2200, 'bandpass'), this.tone(310, .045, 'triangle', .025)] },
      'movement.jump': { channel: 'ambience', build: () => [this.noise(.1, .1, 650, 'lowpass')] },
      'movement.land': { channel: 'ambience', build: () => [this.noise(.16, .2, 380, 'lowpass'), this.tone(68, .1, 'sine', .07)] },
      'impact.body': { channel: 'gun', spatial: true, build: () => [this.noise(.09, .18, 620, 'lowpass'), this.tone(118, .07, 'triangle', .07)] },
      'impact.metal': { channel: 'gun', spatial: true, build: () => [this.noise(.075, .22, 2600, 'bandpass'), this.tone(410, .08, 'square', .11)] },
      'impact.headshot': { channel: 'gun', spatial: true, build: () => [this.noise(.065, .15, 4200, 'highpass'), this.tone(1080, .055, 'square', .075)] },
      'bullet.whiz': { channel: 'gun', spatial: true, build: () => [this.sweep(4200, 700, .16, .12)] },
      'combat.kill': { channel:'gun', spatial:false, build:e=>[this.tone(520+Math.min(5,e.streak||1)*105,.15,'square',.22),this.noise(.13,.26,3200,'bandpass')] },
      'player.hurt': { channel: 'ambience', build: () => [this.noise(.22, .25, 240, 'lowpass'), this.sweep(1650, 610, .7, .065, 'sine')] },
      'wave.start': { channel: 'ui', build: () => [this.tone(420, .18, 'square', .08), this.tone(630, .22, 'square', .07, .13)] },
      'wave.clear': { channel: 'ui', build: () => [this.tone(620, .14, 'sine', .08), this.tone(920, .25, 'sine', .08, .11)] },
      'wave.boss': { channel: 'ambience', build: () => [this.sweep(92, 38, 1.1, .22, 'sawtooth'), this.noise(.8, .12, 180, 'lowpass')] },
      'ui.purchase': { channel: 'ui', build: () => [this.tone(520, .08, 'sine', .06), this.tone(820, .12, 'sine', .06, .06)] },
      'ui.coin': { channel: 'ui', build: () => [this.tone(1250, .07, 'sine', .045), this.tone(1700, .08, 'sine', .04, .04)] },
      'ui.confirm': { channel: 'ui', build: () => [this.tone(560, .08, 'triangle', .06), this.tone(1120, .13, 'sine', .055, .05)] },
      'ui.hover': { channel: 'ui', build: () => [this.tone(780, .035, 'sine', .025)] },
      'ui.click': { channel: 'ui', build: () => [this.tone(430, .045, 'triangle', .04)] },
      'player.heartbeat': { channel: 'ambience', build: () => [this.tone(54, .13, 'sine', .16), this.tone(48, .12, 'sine', .11, .18)] },
      ...this.enemyRegistry(),
    };
  }

  enemyRegistry() {
    const profiles={assault:[135,760],heavy:[82,420],exploder:[210,1250],shooter:[330,2100],rocketeer:[68,680],sniper:[520,3400],boss:[54,310]};
    const out={};for(const [type,[low,high]] of Object.entries(profiles)){
      out[`enemy.${type}.move`]={channel:'ambience',spatial:true,build:()=>[this.tone(low,.08,'triangle',.045),this.noise(.07,.04,high,'bandpass')]};
      out[`enemy.${type}.hit`]={channel:'gun',spatial:true,build:()=>[this.noise(.08,.13,high,'bandpass')]};
      out[`enemy.${type}.death`]={channel:'ambience',spatial:true,build:()=>[this.sweep(high,low,.3,.12,'sawtooth'),this.noise(.22,.14,high,'lowpass')]};
      out[`enemy.${type}.attack`]={channel:'gun',spatial:true,build:()=>[this.noise(.12,.2,high,'bandpass'),this.sweep(high,low,.14,.13,'square')]};
    }return out;
  }

  play(name, event = {}) {
    if (!this.ctx && !this.init()) return [];
    const def = this.registry[name]; if (!def) return [];
    const nodes = (def.build(event) || []).flat().filter(Boolean);
    const output = this.spatialOutput(def, event.position || event.enemy?.group?.position);
    nodes.forEach(node => { const start=this.ctx.currentTime+(node.delay||0);node.output.connect(output.input);node.source.start(start);node.source.stop?.(start+(node.duration||.2)+.03);this.created.push({ event: name, source: node.source, channel:def.channel, peak:node.peak }); });
    return nodes.map(n => n.source);
  }

  spatialOutput(def, position) {
    const channel = this.channels[def.channel] || this.master;
    if (!def.spatial || !position) return { input: channel };
    const dx = position.x - this.listener.x, dz = position.z - this.listener.z, distance = Math.hypot(dx, dz);
    const gain = this.ctx.createGain(); gain.gain.value = 1 / (1 + Math.max(0, distance - 1) * .075);
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
    if (panner.pan) panner.pan.value = Math.max(-1, Math.min(1, Math.sin(Math.atan2(dx, -dz) - this.listener.yaw)));
    gain.connect(panner).connect(channel); return { input: gain };
  }

  envelope(node, gain, duration, delay = 0) {
    const g = this.ctx.createGain(), t = this.ctx.currentTime + delay;
    g.gain.setValueAtTime(Math.max(.0001, gain), t); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    node.connect(g); return { source: node, output: g, delay, duration, peak:gain };
  }
  tone(freq, duration, type = 'sine', gain = .1, delay = 0) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime + delay); return this.envelope(o, gain, duration, delay); }
  sweep(from, to, duration, gain, type = 'sine') { const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(from, this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(to, this.ctx.currentTime + duration); return this.envelope(o, gain, duration); }
  noise(duration, gain, cutoff, type = 'lowpass') {
    const key = `${duration}:${cutoff}`, length = Math.ceil(this.ctx.sampleRate * duration); let buffer = this.buffers.get(key);
    if (!buffer) { buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1; this.buffers.set(key, buffer); }
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), output = this.ctx.createGain();
    source.buffer = buffer; filter.type = type; filter.frequency.value = cutoff;
    output.gain.setValueAtTime(Math.max(.0001, gain), this.ctx.currentTime); output.gain.exponentialRampToValueAtTime(.0001, this.ctx.currentTime + duration);
    source.connect(filter).connect(output);
    return { source, output, delay: 0, duration, peak:gain };
  }
  gunshot(p) {
    const blast = this.noise(.09 + p.tail * .25, p.punch, p.cutoff, 'lowpass');
    const body = this.sweep(p.boom * 1.35, p.boom, .11, p.punch * .42, 'sawtooth');
    const metal = this.tone(p.metal, .035, 'square', .045, .018);
    const tail = this.noise(p.tail, p.punch * .16, Math.max(350, p.cutoff * .55), 'lowpass'); tail.delay = .045;
    return [blast, body, metal, tail];
  }
  updateHeartbeat(health, max = 100) {
    const low = health / max < .3 && health > 0;
    if (!low) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; return; }
    if (!this.heartbeatTimer) { this.play('player.heartbeat'); this.heartbeatTimer = setInterval(() => this.play('player.heartbeat'), 820); }
  }
  dispose() { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; this.ctx?.close?.(); }
}
