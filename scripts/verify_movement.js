import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EventBus } from '../src/core/EventBus.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { Weapon } from '../src/player/Weapon.js';

globalThis.localStorage={getItem(){return null;}};
const dt=1/60,makeRig=()=>{
  const bus=new EventBus(),camera=new THREE.PerspectiveCamera(),state={move:{x:0,y:0},look:{x:0,y:0},jump:false,sprint:false,crouch:false};
  const input={state,consumeLook(){const look={...state.look};state.look={x:0,y:0};return look;},consume(name){const value=state[name];state[name]=false;return value;}};
  const map={collides(){return false;},heightAt(){return 0;},surfaceAt(){return'ground';}};
  const stats={get(key){return {moveSpeed:7,lowHealthSpeed:1,jumpHeight:1}[key]??1;}};
  const player=new PlayerController(camera,input,map,stats,bus);return{bus,camera,state,stats,player};
};

const inertia=makeRig();inertia.state.move.y=1;for(let i=0;i<18;i++)inertia.player.update(dt,true);
const takeoffSpeed=Math.hypot(inertia.player.velocity.x,inertia.player.velocity.z);inertia.state.jump=true;inertia.player.update(dt,true);inertia.state.move.y=0;
const takeoffZ=inertia.camera.position.z;for(let i=0;i<30;i++)inertia.player.update(dt,true);
const airborneDistance=Math.abs(inertia.camera.position.z-takeoffZ);
assert(takeoffSpeed>6.5,'起跳前未达到正常移动速度');assert(airborneDistance>2.5,'松键后空中水平惯性不足');

const steering=makeRig();steering.state.move.y=1;for(let i=0;i<18;i++)steering.player.update(dt,true);steering.state.jump=true;steering.player.update(dt,true);steering.state.move={x:1,y:0};
for(let i=0;i<18;i++)steering.player.update(dt,true);assert(steering.player.velocity.x>2,'空中方向输入没有产生转向');assert(steering.player.velocity.z<0,'空中控制不应立即抹掉原方向惯性');

const posture=makeRig();posture.state.crouch=true;for(let i=0;i<12;i++)posture.player.update(dt,true);const crouchHeight=posture.camera.position.y;
assert(crouchHeight<1.25&&posture.player.crouching,'蹲下高度或状态错误');posture.state.crouch=false;for(let i=0;i<12;i++)posture.player.update(dt,true);assert(posture.camera.position.y>1.65,'起身高度未恢复');

const sprint=makeRig(),states=[];sprint.bus.on('player:movementState',state=>states.push(state));sprint.state.move.y=1;sprint.state.sprint=true;for(let i=0;i<18;i++)sprint.player.update(dt,true);
assert(sprint.player.sprinting&&Math.hypot(sprint.player.velocity.x,sprint.player.velocity.z)>10,'奔跑速度或状态错误');assert(states.some(state=>state.sprinting),'未发布奔跑运动事件');
const data={id:'test',category:'auto',magazine:10,reserve:20,recoil:.02,fireRate:5,reload:1,makeModel(){const group=new THREE.Group(),muzzle=new THREE.Object3D();group.add(muzzle);return{group,muzzle,muzzleLight:{intensity:0}};}};
const weapon=new Weapon(sprint.camera,sprint.bus,sprint.stats,data);sprint.bus.emit('player:movementState',{sprinting:true});weapon.update(.2,true);const ammo=weapon.ammo;
assert.equal(weapon.tryShoot(),false,'奔跑时仍能开枪');assert.equal(weapon.ammo,ammo,'奔跑禁射仍消耗了弹药');assert(weapon.sprintBlend>0&&weapon.group.rotation.x<weapon.restRotation.x,'奔跑持枪姿态未生效');weapon.dispose();

console.log(JSON.stringify({takeoffSpeed,airborneDistance,airSteerX:steering.player.velocity.x,crouchHeight,sprintSpeed:Math.hypot(sprint.player.velocity.x,sprint.player.velocity.z),sprintEvents:states.length,blockedShot:true},null,2));
