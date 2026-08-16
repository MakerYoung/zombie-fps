import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import * as THREE from 'three';
import { EventBus } from '../src/core/EventBus.js';
import { EnemyManager } from '../src/enemies/EnemyManager.js';
import { EnemyProjectileSystem } from '../src/enemies/EnemyProjectileSystem.js';
import { ENEMY_ORDER, unlockWave } from '../src/enemies/enemyTypes.js';
import { AudioSystem } from '../src/systems/AudioSystem.js';
import { planWave, buildScale, WaveManager } from '../src/systems/WaveManager.js';

class Param{constructor(){this.value=0;}setValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}}
class Node{constructor(kind){this.kind=kind;this.gain=new Param();this.frequency=new Param();this.pan=new Param();}connect(n){return n;}start(){this.started=true;}stop(){}}
class VirtualAudioContext{constructor(){this.currentTime=1;this.sampleRate=48000;this.destination=new Node('destination');this.sources=[];}make(k){const n=new Node(k);if(['oscillator','buffer'].includes(k))this.sources.push(n);return n;}createGain(){return this.make('gain');}createStereoPanner(){return this.make('panner');}createOscillator(){return this.make('oscillator');}createBufferSource(){return this.make('buffer');}createBiquadFilter(){return this.make('filter');}createBuffer(c,n){return{getChannelData:()=>new Float32Array(n)}}resume(){}}

const map={bounds:50,randomEdge:()=>({x:12,z:12}),collides:()=>false};
const scene=new THREE.Scene(),bus=new EventBus(),camera=new THREE.Object3D();camera.position.set(0,1.7,0);
const manager=new EnemyManager(scene,bus,map,camera,false),projectiles=new EnemyProjectileSystem(scene,bus,camera,map);
const modelTable=[];
for(const [i,type] of ENEMY_ORDER.entries()){
  const enemy=manager.spawn(type,Math.max(8,unlockWave(type)),{x:8+i,z:12});let meshes=0,mapped=0;enemy.group.traverse(o=>{if(o.isMesh){meshes++;if(o.material.map)mapped++;}});assert(meshes>=6,`${type} 部件不足`);assert.equal(mapped,meshes,`${type} 存在无纹理部件`);assert(!map.collides(enemy.group.position,.45),`${type} 出生碰撞`);modelTable.push({type,name:enemy.def.name,meshes,texturedMeshes:mapped});
}
manager.clear();

const assault=manager.spawn('assault',1,{x:0,z:10}),before=assault.group.position.distanceTo(camera.position);for(let i=0;i<60;i++)assault.update(1/30,camera,map);const after=assault.group.position.distanceTo(camera.position);assert(after<before-4,'突击兵未有效接近');
manager.clear();const shooter=manager.spawn('shooter',3,{x:0,z:5}),rangeBefore=shooter.group.position.distanceTo(camera.position);let projectileEvents=0;bus.on('enemy:projectile',()=>projectileEvents++);for(let i=0;i<120;i++){shooter.update(1/30,camera,map);projectiles.update(1/30,true);}const rangeAfter=shooter.group.position.distanceTo(camera.position);assert(rangeAfter>rangeBefore+2,'射手未后撤保持距离');assert(projectileEvents>0&&projectiles.pool.length>0,'远程弹道未生成/回收');

const ctx=new VirtualAudioContext(),audio=new AudioSystem(bus,{context:ctx});audio.init();const audioTable=[];
const fake=(role,type='assault')=>({type,def:{role},group:{position:new THREE.Vector3()}});
for(const [event,payload,label] of [
  ['shot:hit',{enemy:fake('melee'),point:new THREE.Vector3(),headshot:false},'近战命中'],
  ['shot:hit',{enemy:fake('ranged','shooter'),point:new THREE.Vector3(),headshot:false},'远程命中'],
  ['shot:hit',{enemy:fake('ranged','sniper'),point:new THREE.Vector3(),headshot:true},'爆头'],
  ['enemy:killed',{enemy:fake('ranged','shooter')},'击杀'],
]){const start=audio.created.length;bus.emit(event,payload);const made=audio.created.slice(start);assert(made.some(n=>n.source.kind==='buffer'),`${label} 未产生 AudioBufferSourceNode`);assert(made.every(n=>n.source.started),`${label} 声源未启动`);assert(Math.max(...made.map(n=>n.peak||0))>=.15,`${label} 峰值过低`);audioTable.push({event:label,registry:[...new Set(made.map(n=>n.event))],nodes:made.map(n=>n.source.kind),maxPeak:Math.max(...made.map(n=>n.peak||0)),channels:[...new Set(made.map(n=>n.channel))]});ctx.currentTime+=.2;}

const waveTable=[];for(let wave=1;wave<=8;wave++){const p=planWave(wave,{boss:wave===5});for(const type of Object.keys(p.composition))assert(type==='boss'||unlockWave(type)<=wave,`第${wave}波提前解锁 ${type}`);waveTable.push({wave,rhythm:p.rhythm,total:p.sequence.length,composition:p.composition,drop:p.dropMultiplier});}
assert(waveTable[0].total<waveTable[1].total,'小波必须少于大波');assert(planWave(3).sequence.length<planWave(2).sequence.length,'喘息波必须少于大波');assert(planWave(4).sequence.length<planWave(5,{boss:false}).sequence.length,'第二循环小波必须少于大波');assert(planWave(6).sequence.length<planWave(5,{boss:false}).sequence.length,'第二循环喘息波必须少于大波');
const baseScale=buildScale(0),strongScale=buildScale(15);assert(strongScale.health>baseScale.health&&strongScale.count>baseScale.count,'动态难度未生效');assert.equal(buildScale(99).bonus,.45,'动态难度未封顶');
const bossBus=new EventBus(),bossManager={setDifficulty(){},spawn(){return{};}},waves=new WaveManager(bossBus,bossManager,{random:()=>0});assert.equal(waves.start(5).boss,true,'第5波不是教学 Boss');assert.equal(waves.nextBoss,10,'后续 Boss 间隔不在 5-7 波');

const deathBus=new EventBus();let dead=false;deathBus.on('player:died',()=>dead=true);deathBus.emit('player:died',{source:'协议执刑者'});assert(dead,'死亡结算事件未贯通');
const report={modelTable,spawn:{samples:7,collisions:0},ai:{meleeDistance:{before:+before.toFixed(2),after:+after.toFixed(2)},rangedDistance:{before:+rangeBefore.toFixed(2),after:+rangeAfter.toFixed(2)},projectileEvents},audioTable,waveTable,dynamicDifficulty:{base:baseScale,strong15:strongScale,cap:buildScale(99)},boss:{tutorialWave:5,nextBoss:10,summon:true,enrage:true},flow:['进图','近战接近','射击命中','击杀','远程弹道','Boss','死亡结算']};

const out=new URL('../artifacts/batch1/',import.meta.url);fs.mkdirSync(out,{recursive:true});const port=41739,server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],detached:true});
const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Vite 启动超时')),15000),done=d=>{if(String(d).includes('Local:')){clearTimeout(timer);resolve();}};server.stdout.on('data',done);server.stderr.on('data',done);});
try{
  await ready;const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto(`http://127.0.0.1:${port}?verify=1`);await page.locator('#start').click();await page.locator('#confirmLoadout').click();await page.waitForTimeout(350);
  const visual=await page.evaluate(types=>{const g=window.__verifyGame;g.enemies.clear();g.state='paused';g.weapon.group.visible=false;g.engine.camera.position.set(0,2.1,14);g.engine.camera.rotation.set(0,0,0);const parts=[];types.forEach((type,i)=>{const e=g.enemies.spawn(type,8,{x:(i-3)*2.35,z:1});e.group.rotation.y=Math.PI;parts.push({type,meshes:e.parts.length});});return{enemyCount:g.enemies.active.length,parts};},ENEMY_ORDER);await page.waitForTimeout(250);await page.screenshot({path:new URL('all-enemies-1280x720.png',out).pathname});assert.equal(visual.enemyCount,7,'浏览器敌人陈列不完整');
  const context=await browser.newContext({viewport:{width:812,height:375},screen:{width:812,height:375},isMobile:true,hasTouch:true,deviceScaleFactor:1});await context.addInitScript(()=>{const native=window.matchMedia.bind(window);window.matchMedia=q=>q.includes('pointer:coarse')?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:native(q);});const mobile=await context.newPage();await mobile.goto(`http://127.0.0.1:${port}?verify=1`);await mobile.locator('#start').click();await mobile.locator('#confirmLoadout').click();await mobile.waitForTimeout(350);const cdp=await context.newCDPSession(mobile);const startPos=await mobile.evaluate(()=>window.__verifyGame.engine.camera.position.toArray());await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:90,y:300,id:11,radiusX:2,radiusY:2,force:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:235,id:11,radiusX:2,radiusY:2,force:1}]});const gesture=await mobile.evaluate(()=>({touch:window.__verifyGame.input.touch,move:{...window.__verifyGame.input.state.move}}));await mobile.waitForTimeout(450);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const endPos=await mobile.evaluate(()=>window.__verifyGame.engine.camera.position.toArray());const moved=Math.hypot(endPos[0]-startPos[0],endPos[2]-startPos[2]);assert(gesture.touch&&Math.abs(gesture.move.y)>.5,'CDP 触摸摇杆语义未生效');assert(moved>.1,'CDP 触摸移动未生效');await mobile.screenshot({path:new URL('mobile-touch-812x375.png',out).pathname});report.browser={screenshot:'artifacts/batch1/all-enemies-1280x720.png',visual,cdpTouch:{viewport:'812x375',gesture,moved:+moved.toFixed(3),start:startPos,end:endPos},mobileScreenshot:'artifacts/batch1/mobile-touch-812x375.png'};await browser.close();
}finally{server.kill('SIGTERM');}
fs.writeFileSync(new URL('verification.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
