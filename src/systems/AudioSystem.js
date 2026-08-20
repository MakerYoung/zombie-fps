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
    this.maxVoices = options.maxVoices || 80;
    this.channelLimits = { gun: 40, ambience: 28, ui: 12, ...options.channelLimits };
    this.lastPlayed = new Map();
    this.features = { killStreak: true, ...options.features };
    this.state = 'playing';
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
      this.limiter=this.ctx.createDynamicsCompressor?.()||null;
      if(this.limiter){
        this.limiter.threshold.value=-8;this.limiter.knee.value=12;this.limiter.ratio.value=6;this.limiter.attack.value=.006;this.limiter.release.value=.2;
        this.master.connect(this.limiter).connect(this.ctx.destination);
      }else this.master.connect(this.ctx.destination);
      this.channels = {};
      for (const [name, volume] of Object.entries({ gun: 1, ambience: .7, ui: .72 })) {
        const gain = this.ctx.createGain();gain.gain.value=name==='gun'?.7:volume;gain.connect(this.master);this.channels[name]=gain;
      }
    }
    return true;
  }

  setListener(position, yaw = 0) { this.listener = { x: position.x, z: position.z, yaw }; }
  setVolume(channel, value) {
    const target = channel === 'master' ? this.master : this.channels?.[channel];
    if (target) target.gain.value = Math.max(0, Math.min(1, value));
  }
  setState(state){
    if(state===this.state)return;const wasPlaying=this.state==='playing';this.state=state;
    if(state!=='playing'){clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;for(const voice of [...this.active])if(voice.channel!=='ui')this.retireVoice(voice);}
    else if(!wasPlaying&&this.heartbeatLow)this.startHeartbeat();
  }

  bindEvents() {
    const map = {
      'weapon:shoot': e => {const exact=`gun.${e.data?.id||'pistol'}`,fallback=`gun.${e.data?.sound||e.data?.archetype||'pistol'}`;this.play(this.registry[exact]?exact:this.registry[fallback]?fallback:'gun.pistol',e);},
      'weapon:reloadStage': e => this.play(`reload.${e.stage}`, e),
      'player:footstep': e => this.play(`footstep.${e.material || 'ground'}`, e),
      'player:jump': e => this.play('movement.jump', e),
      'player:land': e => this.play('movement.land', e),
      'shot:hit': e => this.play(e.headshot ? 'impact.headshot' : (['melee','exploder'].includes(e.enemy?.def?.role) ? 'impact.body' : 'impact.metal'), { ...e, position:e.point }),
      'bullet:whiz': e => this.play('bullet.whiz', e),
      'enemy:move': e => this.play(`enemy.${e.enemyType}.move`, e),
      'enemy:attackSound': e => this.play(`enemy.${e.enemyType}.attack`, e),
      'enemy:hit': e => { if (!e.fromShot) this.play(`enemy.${e.enemy?.type || 'assault'}.hit`, { ...e, position:e.enemy?.group?.position }); },
      'enemy:killed': e => { const now=this.ctx?.currentTime??performance.now()/1000;this.killStreak=now-this.lastKillAt<1.2?this.killStreak+1:1;this.lastKillAt=now;if(this.features.killStreak)this.play('combat.kill',{...e,streak:this.killStreak,position:e.enemy?.group?.position});this.play(`enemy.${e.enemy?.type || 'assault'}.death`,{...e,position:e.enemy?.group?.position}); },
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
      'gun.rifle': gun({boom:125,cutoff:1800,punch:.34,tail:.15,metal:2200}),
      'gun.pulse': gun({boom:138,cutoff:1650,punch:.32,tail:.14,metal:2100}),
      'gun.scout': gun({boom:105,cutoff:1450,punch:.4,tail:.18,metal:1900}),
      'gun.handcannon': gun({boom:82,cutoff:1250,punch:.48,tail:.22,metal:1750}),
      'gun.sidearm': gun({boom:160,cutoff:1700,punch:.28,tail:.11,metal:2200}),
      'gun.sniper': gun({boom:64,cutoff:1100,punch:.58,tail:.3,metal:1550}),
      'gun.fusion': gun({boom:210,cutoff:1850,punch:.38,tail:.2,metal:2350}),
      'gun.machinegun': gun({boom:92,cutoff:1350,punch:.44,tail:.2,metal:1800}),
      'gun.launcher': gun({boom:52,cutoff:720,punch:.62,tail:.34,metal:1300}),
      'gun.linear': gun({boom:72,cutoff:980,punch:.56,tail:.27,metal:1500}),
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
      'combat.kill': { channel:'gun', spatial:false, build:e=>{const streak=Math.min(5,e.streak||1),gain=.14-streak*.008;return [this.tone(500+streak*92,.14,'triangle',gain),this.noise(.11,.1,2800,'bandpass')];} },
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
    const profiles={assault:[135,760],heavy:[82,420],exploder:[210,1250],drone:[440,2850],shooter:[330,2100],rocketeer:[68,680],sniper:[520,3400],boss:[54,310]};
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
    if(this.state!=='playing'&&def.channel!=='ui')return [];
    const now=this.ctx.currentTime;
    const interval=def.interval??(name==='ui.hover'?.09:name.endsWith('.move')?.08:0);
    if(now-(this.lastPlayed.get(name)??-Infinity)<interval)return [];
    this.lastPlayed.set(name,now);
    const nodes = (def.build(event) || []).flat().filter(Boolean);
    this.trimVoices(def.channel,nodes.length);
    const spatial = this.spatialOutput(def, event.position || event.enemy?.group?.position);
    const mix=this.ctx.createGain(),peak=nodes.reduce((sum,node)=>sum+(node.peak||0),0),budgets={gun:.34,ambience:.42,ui:.3},peakBudget=def.peakBudget??budgets[def.channel]??.35;
    mix.gain.value=peak>peakBudget?peakBudget/peak:1;mix.connect(spatial.input);
    const output={input:mix,remaining:nodes.length,dispose(){mix.disconnect?.();spatial.dispose?.();}};
    nodes.forEach(node => {
      const start=now+(node.delay||0),voice={event:name,source:node.source,envelope:node.output,channel:def.channel,peak:node.peak,output};
      node.output.connect(output.input);node.source.start(start);node.source.stop?.(start+(node.duration||.2)+.03);
      this.active.add(voice);this.created.push(voice);if(this.created.length>256)this.created.splice(0,this.created.length-256);
      node.source.onended=()=>this.releaseVoice(voice);
    });
    return nodes.map(n => n.source);
  }

  releaseVoice(voice){if(voice.released)return;voice.released=true;this.active.delete(voice);try{voice.source.disconnect?.();voice.envelope.disconnect?.();if(--voice.output.remaining<=0)voice.output.dispose?.();}catch{}}
  retireVoice(voice){
    if(voice.retiring||voice.released)return;voice.retiring=true;this.active.delete(voice);const t=this.ctx.currentTime,param=voice.envelope?.gain;
    try{param?.cancelScheduledValues?.(t);param?.setValueAtTime?.(Math.max(.0001,param.value||.0001),t);param?.linearRampToValueAtTime?.(.0001,t+.008);voice.source.stop?.(t+.01);}catch{this.releaseVoice(voice);}
  }
  trimVoices(channel,incoming=1){
    const channelVoices=[...this.active].filter(v=>v.channel===channel),limit=this.channelLimits[channel]||this.maxVoices;
    const channelOverflow=Math.max(0,channelVoices.length-limit+incoming);
    for(const voice of channelVoices.slice(0,channelOverflow))this.retireVoice(voice);
    const globalOverflow=Math.max(0,this.active.size-this.maxVoices+incoming);
    for(const voice of [...this.active].slice(0,globalOverflow))this.retireVoice(voice);
  }

  spatialOutput(def, position) {
    const channel = this.channels[def.channel] || this.master;
    if (!def.spatial || !position) return { input: channel, dispose(){} };
    const dx = position.x - this.listener.x, dz = position.z - this.listener.z, distance = Math.hypot(dx, dz);
    const gain = this.ctx.createGain(); gain.gain.value = 1 / (1 + Math.max(0, distance - 1) * .075);
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
    if (panner.pan) panner.pan.value = Math.max(-1, Math.min(1, Math.sin(Math.atan2(dx, -dz) - this.listener.yaw)));
    gain.connect(panner).connect(channel); return { input: gain, dispose(){gain.disconnect?.();panner.disconnect?.();} };
  }

  envelope(node, gain, duration, delay = 0, attack=.004) {
    const g = this.ctx.createGain(), t = this.ctx.currentTime + delay,end=t+duration,peak=Math.max(.0001,gain);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(peak,Math.min(end,t+attack));g.gain.exponentialRampToValueAtTime(.0001,end);
    node.connect(g); return { source: node, output: g, delay, duration, peak:gain };
  }
  cleanWave(type){return type==='sine'||type==='triangle'?type:'triangle';}
  tone(freq, duration, type = 'sine', gain = .1, delay = 0) { const o = this.ctx.createOscillator(); o.type = this.cleanWave(type); o.frequency.setValueAtTime(freq, this.ctx.currentTime + delay); return this.envelope(o, gain, duration, delay); }
  sweep(from, to, duration, gain, type = 'sine',delay=0) { const o = this.ctx.createOscillator(),t=this.ctx.currentTime+delay;o.type=this.cleanWave(type);o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+duration);return this.envelope(o,gain,duration,delay); }
  noise(duration, gain, cutoff, type = 'lowpass',delay=0) {
    const key = `${duration}:${cutoff}`, length = Math.ceil(this.ctx.sampleRate * duration); let buffer = this.buffers.get(key);
    if (!buffer) { buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1; this.buffers.set(key, buffer); }
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), output = this.ctx.createGain();
    source.buffer = buffer; filter.type = type; filter.frequency.value = cutoff;
    const t=this.ctx.currentTime+delay,end=t+duration;output.gain.setValueAtTime(.0001,t);output.gain.linearRampToValueAtTime(Math.max(.0001,gain),Math.min(end,t+.003));output.gain.exponentialRampToValueAtTime(.0001,end);
    source.connect(filter).connect(output);
    return { source, output, delay, duration, peak:gain };
  }
  gunshot(p) {
    // 枪声避免方波/锯齿波的高频谐波；在手机和小扬声器上这些谐波很像削波破音。
    const blast = this.noise(.075 + p.tail * .22, p.punch * .68, Math.min(1900,p.cutoff), 'lowpass');
    const body = this.sweep(p.boom * 1.28, p.boom, .1, p.punch * .3, 'triangle');
    const metal = this.tone(Math.min(2400,p.metal), .028, 'sine', .022, .018);
    const tail = this.noise(p.tail, p.punch * .09, Math.max(320, p.cutoff * .48), 'lowpass',.045);
    return [blast, body, metal, tail];
  }
  updateHeartbeat(health, max = 100) {
    const low = health / max < .3 && health > 0;this.heartbeatLow=low;
    if(!low){clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;return;}
    if(this.state==='playing')this.startHeartbeat();
  }
  startHeartbeat(){if(this.heartbeatTimer||!this.heartbeatLow)return;this.play('player.heartbeat');this.heartbeatTimer=setInterval(()=>this.play('player.heartbeat'),820);}
  dispose() { clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;for(const voice of [...this.active]){try{voice.source.stop?.();}catch{}this.releaseVoice(voice);}this.ctx?.close?.(); }
}
