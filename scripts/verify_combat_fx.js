import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {EventBus} from '../src/core/EventBus.js';
import {PlayerProjectileSystem} from '../src/systems/PlayerProjectileSystem.js';
import {ParticleSystem} from '../src/systems/ParticleSystem.js';
import {ShootingSystem} from '../src/systems/ShootingSystem.js';
import {FeedbackSystem} from '../src/systems/FeedbackSystem.js';
import {Stats} from '../src/player/Stats.js';
import {WEAPONS} from '../src/weapons/weaponData.js';

const scene=new THREE.Scene(),bus=new EventBus(),camera=new THREE.PerspectiveCamera(),map={scene,group:new THREE.Group(),collides:()=>false},enemies={active:[],rayTargets:()=>[]},muzzle=new THREE.Object3D(),weapon={muzzle,muzzleLight:{intensity:0},empoweredRounds:0,hook:(name,c)=>c.damage};const wall=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.z=-5;const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.position.y=-.6;map.group.add(wall,floor);scene.add(map.group,muzzle);
const projectiles=new PlayerProjectileSystem(scene,bus,camera,map,enemies),impacts=[];bus.on('player:projectileImpact',e=>impacts.push(e));
projectiles.spawn({weapon,data:WEAPONS.hothead});assert.equal(projectiles.active[0].kind,'rocket');projectiles.update(.05,true);assert(projectiles.active[0].mesh.position.z<0,'火箭没有沿弹道前进');for(let i=0;i<10&&projectiles.active.length;i++)projectiles.update(.05,true);assert.equal(impacts.length,1,'火箭没有在碰撞时爆炸');
projectiles.spawn({weapon,data:WEAPONS.wendigo});const initialY=projectiles.active[0].mesh.position.y;projectiles.update(.2,true);assert(projectiles.active[0]?.mesh.position.y<initialY,'榴弹没有重力弹道');for(let i=0;i<10&&projectiles.active.length;i++)projectiles.update(.05,true);assert.equal(impacts.length,2,'榴弹撞击地板没有爆炸');projectiles.clear();

const shooting=new ShootingSystem(camera,weapon,enemies,map,bus,new Stats());shooting.fire(WEAPONS.cartesian,weapon);assert.equal(shooting.fusionQueue.length,WEAPONS.cartesian.pellets,'融合射线没有进入序列队列');shooting.update(.02);assert.equal(shooting.fusionQueue.length,WEAPONS.cartesian.pellets-1,'融合射线没有逐条发射');
const particles=new ParticleSystem(scene,bus,'high');bus.emit('fx:radial',{position:new THREE.Vector3(),radius:4,color:0xff0000,count:32});assert(particles.pool.active.length>=24,'范围伤害没有足够粒子表达半径');assert(particles.pool.active.some(p=>Math.hypot(p.m.position.x,p.m.position.z)>3.5),'粒子没有到达伤害范围边缘');
const feedbackBus=new EventBus();let areaNumber=null;new FeedbackSystem(feedbackBus,{hitMarker(){},damageNumber:(damage,point)=>areaNumber={damage,point},damageFlash(){}},{slowMotion(){}});feedbackBus.emit('damage:area',{damage:88,point:new THREE.Vector3(1,2,3)});assert.equal(areaNumber?.damage,88,'爆炸伤害没有显示伤害数字');
const ui=fs.readFileSync(new URL('../src/ui/UI.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert(ui.includes('state.health/state.maxHealth<=.3')&&css.includes('@keyframes criticalPulse'),'濒死红光脉冲缺失');
console.log(JSON.stringify({rocket:'ballistic impact',grenade:'gravity arc',fusionRays:WEAPONS.cartesian.pellets,radialParticles:particles.pool.active.length,criticalThreshold:.3},null,2));
