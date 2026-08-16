import assert from 'node:assert/strict';
import * as THREE from 'three';

const noop=()=>{};global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:0,font:'',textAlign:'',fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fillText:noop})})};
const {MapGenerator}=await import('../src/map/MapGenerator.js');const {TransportShipMap}=await import('../src/map/TransportShipMap.js');
const results=[];
for(const [id,Map,width,length,bx,bz] of [['base',MapGenerator,60,60,30,30],['transportShip',TransportShipMap,42,96,21,48]]){
  const map=new Map(new THREE.Scene());assert.equal(map.boundsX||map.bounds,bx);assert.equal(map.boundsZ||map.bounds,bz);const spawn=new THREE.Vector3(map.playerSpawn.x,map.playerSpawn.y,map.playerSpawn.z);assert.equal(map.collides(spawn,.38),false,`${id} 出生点碰撞`);
  let correct=0,free=0,blocked=0;for(let i=0;i<200;i++){const p=new THREE.Vector3((Math.random()-.5)*width,1.72,(Math.random()-.5)*length),r=.38;const expected=Math.abs(p.x)+r>bx-.5||Math.abs(p.z)+r>bz-.5||map.colliders.some(b=>p.x+r>b.min.x&&p.x-r<b.max.x&&p.z+r>b.min.z&&p.z-r<b.max.z&&p.y>b.min.y-.18&&p.y-1.7<b.max.y-.03);const actual=map.collides(p,r);if(actual===expected)correct++;actual?blocked++:free++;}assert.equal(correct,200);results.push({map:id,size:`${length}x${width}`,bounds:`X±${bx}/Z±${bz}`,spawn:map.playerSpawn,spawnCollides:false,samples:200,collisionAccuracy:`${correct/2}%`,free,blocked,colliders:map.colliders.length});
}
console.log(JSON.stringify(results,null,2));
