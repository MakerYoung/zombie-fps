import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EventBus } from '../src/core/EventBus.js';
import { AudioSystem } from '../src/systems/AudioSystem.js';
import { Weapon } from '../src/player/Weapon.js';

class Param { constructor(){this.value=0;} setValueAtTime(v){this.value=v;} exponentialRampToValueAtTime(v){this.value=v;} }
class Node { constructor(kind){this.kind=kind;this.gain=new Param();this.frequency=new Param();this.pan=new Param();} connect(n){this.next=n;return n;} start(){this.started=true;} stop(){} }
class VirtualAudioContext {
  constructor(){this.currentTime=0;this.sampleRate=48000;this.destination=new Node('destination');this.sources=[];}
  make(kind){const n=new Node(kind);if(kind==='oscillator'||kind==='buffer')this.sources.push(n);return n;}
  createGain(){return this.make('gain');} createStereoPanner(){return this.make('panner');} createOscillator(){return this.make('oscillator');}
  createBufferSource(){return this.make('buffer');} createBiquadFilter(){return this.make('filter');}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};} resume(){}
}

const bus=new EventBus(),ctx=new VirtualAudioContext(),audio=new AudioSystem(bus,{context:ctx});audio.init();
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

const camera=new THREE.PerspectiveCamera(),stats={get:()=>1},weaponBus=new EventBus();
const makeData=id=>({id,name:id,magazine:10,reserve:20,recoil:.05,fireRate:5,reload:1,makeModel(){const group=new THREE.Group();group.position.set(.2,-.3,-.5);const muzzle=new THREE.Object3D(),muzzleLight={};group.add(muzzle);return{group,muzzle,muzzleLight};}});
const oldGun=new Weapon(camera,weaponBus,stats,makeData('old')),newGun=new Weapon(camera,weaponBus,stats,makeData('new'));
oldGun.beginSwitch('out');newGun.beginSwitch('in');const samples=[];
for(let i=0;i<=10;i++){if(i){oldGun.update(.025,false);newGun.update(.025,false);}samples.push({time:+(i*.025).toFixed(3),oldY:+oldGun.group.position.y.toFixed(5),newY:+newGun.group.position.y.toFixed(5),oldRot:+oldGun.group.rotation.x.toFixed(5),newRot:+newGun.group.rotation.x.toFixed(5),newScale:+newGun.group.scale.x.toFixed(5),shoot:newGun.tryShoot()});}
assert(samples.every(s=>s.shoot===false),'动画期间不应开火');
for(let i=1;i<samples.length;i++){assert(samples[i].oldY<=samples[i-1].oldY+1e-8,'旧枪 y 非单调下降');assert(samples[i].newY>=samples[i-1].newY-1e-8,'新枪 y 非单调上升');}
assert(Math.abs(newGun.group.position.y-newGun.restPosition.y)<1e-7);assert(Math.abs(newGun.group.rotation.x-newGun.restRotation.x)<1e-7);assert(Math.abs(newGun.group.scale.x-newGun.restScale.x)<1e-7);

console.log(JSON.stringify({audioEvents:audioTable,weaponSamples:samples},null,2));
