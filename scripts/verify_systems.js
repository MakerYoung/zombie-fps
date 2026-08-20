import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EventBus } from '../src/core/EventBus.js';
import { AudioSystem } from '../src/systems/AudioSystem.js';
import { Weapon } from '../src/player/Weapon.js';

class Param { constructor(){this.value=0;this.events=[];} setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);} linearRampToValueAtTime(v,t){this.value=v;this.events.push(['linear',v,t]);} exponentialRampToValueAtTime(v,t){this.value=v;this.events.push(['exponential',v,t]);} cancelScheduledValues(t){this.events.push(['cancel',t]);} }
class Node { constructor(kind){this.kind=kind;this.gain=new Param();this.frequency=new Param();this.pan=new Param();} connect(n){this.next=n;return n;} disconnect(){this.disconnected=true;} start(){this.started=true;} stop(){this.stopped=true;} }
class VirtualAudioContext {
  constructor(){this.currentTime=0;this.sampleRate=48000;this.destination=new Node('destination');this.sources=[];}
  make(kind){const n=new Node(kind);if(kind==='oscillator'||kind==='buffer')this.sources.push(n);return n;}
  createGain(){return this.make('gain');} createStereoPanner(){return this.make('panner');} createOscillator(){return this.make('oscillator');}
  createDynamicsCompressor(){const node=this.make('compressor');node.threshold=new Param();node.knee=new Param();node.ratio=new Param();node.attack=new Param();node.release=new Param();return node;}
  createBufferSource(){return this.make('buffer');} createBiquadFilter(){return this.make('filter');}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};} resume(){}
}

const bus=new EventBus(),ctx=new VirtualAudioContext(),audio=new AudioSystem(bus,{context:ctx});audio.init();
assert(audio.limiter,'主输出没有动态限幅器');assert.equal(audio.limiter.ratio.value,6,'主输出保护器配置错误');
assert.equal(audio.master.gain.value,.72,'主通道音量错误');assert.equal(audio.channels.gun.gain.value,.7,'枪声通道音量错误');
assert.equal(audio.features.killStreak,true,'连杀音效应保持开启');
const events=[
  ['weapon:shoot',{data:{id:'pistol'}}],['weapon:shoot',{data:{id:'smg'}}],['weapon:shoot',{data:{id:'shotgun'}}],
  ['weapon:reloadStage',{stage:'remove'}],['weapon:reloadStage',{stage:'insert'}],['weapon:reloadStage',{stage:'chamber'}],
  ['player:footstep',{material:'ground'}],['player:footstep',{material:'stone'}],['player:jump',{}],['player:land',{}],
  ['enemy:hit',{headshot:false}],['enemy:hit',{headshot:true}],['bullet:whiz',{}],['enemy:move',{enemyType:'assault'}],['enemy:killed',{}],
  ['player:damaged',{health:60,max:100}],['wave:start',{boss:false}],['wave:cleared',{}],['wave:start',{boss:true}],
  ['economy:spent',{}],['economy:gain',{}],['buff:applied',{}],['ui:hover',{}],['ui:click',{}],['player:damaged',{health:20,max:100}],
];
const audioTable=[];
for(const [event,payload] of events){const before=ctx.sources.length;bus.emit(event,payload);const made=ctx.sources.slice(before);assert(made.length>0,`${event} 未生成声源`);assert(made.every(n=>n.started),`${event} 声源未启动`);audioTable.push({event,variant:payload.stage||payload.data?.id||(payload.headshot?'headshot':payload.material)||'',nodes:made.map(n=>n.kind).join('+'),count:made.length});}
clearInterval(audio.heartbeatTimer);
ctx.currentTime=5;const loudShot=audio.play('gun.conditional',{position:{x:0,z:0}}),shotVoices=[...audio.active].filter(v=>loudShot.includes(v.source));assert(shotVoices.length>0&&shotVoices[0].output.input.gain.value<1,'高峰值枪声没有进行单次事件归一化');
assert(shotVoices.every(v=>v.envelope.gain.events.some(e=>e[0]==='linear')),'枪声没有使用平滑起音包络');
assert(shotVoices.filter(v=>v.source.kind==='oscillator').every(v=>['sine','triangle'].includes(v.source.type)),'枪声仍包含高谐波波形');
ctx.currentTime=10;
for(let i=0;i<100;i++){ctx.currentTime+=.1;audio.play('enemy.assault.move',{position:{x:i%8,z:0}});}
assert(audio.active.size<=audio.maxVoices,'活跃声部超过全局上限');
assert([...audio.active].filter(v=>v.channel==='ambience').length<=audio.channelLimits.ambience,'环境声部超过通道上限');
for(const voice of [...audio.active])voice.source.onended?.();
assert.equal(audio.active.size,0,'声音播放结束后没有释放声源');
assert(audio.created.length<=256,'音频诊断历史无限增长');
audio.updateHeartbeat(20,100);assert(audio.heartbeatTimer,'游戏中低血量没有启动心跳');
audio.setState('paused');assert.equal(audio.heartbeatTimer,null,'暂停时心跳定时器没有停止');assert.equal(audio.play('movement.land').length,0,'暂停时仍播放环境音');assert(audio.play('ui.click').length>0,'暂停时 UI 音被错误关闭');
audio.setState('choice');assert.equal(audio.play('footstep.ground').length,0,'词条界面仍播放脚步声');
audio.setState('playing');assert(audio.heartbeatTimer,'恢复游戏后低血量心跳没有恢复');clearInterval(audio.heartbeatTimer);audio.heartbeatTimer=null;

const camera=new THREE.PerspectiveCamera(),stats={get:()=>1},weaponBus=new EventBus();
const makeData=id=>({id,name:id,magazine:10,reserve:20,recoil:.05,fireRate:5,reload:1,makeModel(){const group=new THREE.Group();group.position.set(.2,-.3,-.5);const muzzle=new THREE.Object3D(),muzzleLight={};group.add(muzzle);return{group,muzzle,muzzleLight};}});
const oldGun=new Weapon(camera,weaponBus,stats,makeData('old')),newGun=new Weapon(camera,weaponBus,stats,makeData('new'));
oldGun.beginSwitch('out');newGun.beginSwitch('in');const samples=[];
for(let i=0;i<=10;i++){if(i){oldGun.update(.025,false);newGun.update(.025,false);}samples.push({time:+(i*.025).toFixed(3),oldY:+oldGun.group.position.y.toFixed(5),newY:+newGun.group.position.y.toFixed(5),oldRot:+oldGun.group.rotation.x.toFixed(5),newRot:+newGun.group.rotation.x.toFixed(5),newScale:+newGun.group.scale.x.toFixed(5),shoot:newGun.tryShoot()});}
assert(samples.every(s=>s.shoot===false),'动画期间不应开火');
for(let i=1;i<samples.length;i++){assert(samples[i].oldY<=samples[i-1].oldY+1e-8,'旧枪 y 非单调下降');assert(samples[i].newY>=samples[i-1].newY-1e-8,'新枪 y 非单调上升');}
assert(Math.abs(newGun.group.position.y-newGun.restPosition.y)<1e-7);assert(Math.abs(newGun.group.rotation.x-newGun.restRotation.x)<1e-7);assert(Math.abs(newGun.group.scale.x-newGun.restScale.x)<1e-7);

console.log(JSON.stringify({audioEvents:audioTable,weaponSamples:samples},null,2));
