import assert from 'node:assert/strict';
import * as THREE from 'three';

const noop=()=>{};global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:0,font:'',textAlign:'',globalAlpha:1,fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fillText:noop})})};
const [{MapGenerator},{MAP_DEFS}]=await Promise.all([import('../src/map/MapGenerator.js'),import('../src/map/mapDefs.js')]);
const results=[];
for(const [id,def] of Object.entries(MAP_DEFS)){
  const map=new MapGenerator(new THREE.Scene(),def);assert.equal(map.boundsX,def.boundsX);assert.equal(map.boundsZ,def.boundsZ);assert.equal(map.width,def.width);assert.equal(map.length,def.length);
  const spawn=new THREE.Vector3(def.playerSpawn.x,def.playerSpawn.y,def.playerSpawn.z);assert.equal(map.collides(spawn,.38),false,`${id} 出生点碰撞`);
  let correct=0,free=0,blocked=0;for(let i=0;i<200;i++){const p=new THREE.Vector3((Math.random()-.5)*def.width,1.72,(Math.random()-.5)*def.length),r=.38;const expected=Math.abs(p.x)+r>def.boundsX-.5||Math.abs(p.z)+r>def.boundsZ-.5||map.colliders.some(b=>p.x+r>b.min.x&&p.x-r<b.max.x&&p.z+r>b.min.z&&p.z-r<b.max.z&&p.y>b.min.y-.2&&p.y-1.7<b.max.y);const actual=map.collides(p,r);if(actual===expected)correct++;actual?blocked++:free++;}
  assert.equal(correct,200,`${id} 碰撞准确率`);if(id==='transportShip')assert(map.platforms.length>0,'运输船未收集平台');if(id==='testmap'){assert.equal(def.objects.filter(o=>o.t==='wall').length,3);assert(map.collides(new THREE.Vector3(-5,1.72,0),.38));assert(Math.abs(map.heightAt(new THREE.Vector3(0,3,4))-.8)<1e-5);}
  results.push({map:id,size:`${def.length}x${def.width}`,bounds:`X±${def.boundsX}/Z±${def.boundsZ}`,spawn:def.playerSpawn,spawnCollides:false,samples:200,collisionAccuracy:`${correct/2}%`,free,blocked,colliders:map.colliders.length,platforms:map.platforms.length});
}
console.log(JSON.stringify(results,null,2));
