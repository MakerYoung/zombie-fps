import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';

const noop=()=>{};
global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:0,font:'',globalAlpha:1,fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fillText:noop})})};
const {MapGenerator}=await import('../src/map/MapGenerator.js');
const {TransportShipMap}=await import('../src/map/TransportShipMap.js');
const {Enemy}=await import('../src/enemies/Enemy.js');

const playerY=1.72,radius=.42;
const point=(x,z)=>new THREE.Vector3(x,playerY,z);
function roomSamples(cx,cz,width,depth){const points=[];for(let z=0;z<4;z++)for(let x=0;x<5;x++)points.push(point(cx+(x-2)*(width/5),cz+(z-1.5)*(depth/4)));return points;}
function verifyPath(map,coords,label){for(const [x,z] of coords)assert.equal(map.collides(point(x,z),radius),false,`${label} 在 (${x}, ${z}) 被阻挡`);return coords.length;}
function straightPath(x,z0,z1,step=.25){const out=[];for(let z=z0;z<=z1+1e-6;z+=step)out.push([x,+z.toFixed(3)]);for(let z=z1;z>=z0-1e-6;z-=step)out.push([x,+z.toFixed(3)]);return out;}

const base=new MapGenerator(new THREE.Scene()),ship=new TransportShipMap(new THREE.Scene());
const rooms=[
  {name:'西南维修间',points:roomSamples(-20,18,9,7),door:straightPath(-18.5,11.5,19)},
  {name:'东南双舱',points:roomSamples(19,18,10,7),door:straightPath(20.25,11.5,19)}
];
const roomResults=rooms.map(room=>{const free=room.points.filter(p=>!base.collides(p,radius)).length;assert.equal(free,20,`${room.name} 内部存在错误碰撞`);const pathPoints=verifyPath(base,room.door,room.name);return{name:room.name,samples:20,free,blocked:20-free,doorRoundTripPoints:pathPoints};});

function thinSurfaces(map){const rows=[];map.group.traverse(mesh=>{const p=mesh.geometry?.parameters;if(!p||![p.width,p.height,p.depth].every(Number.isFinite)||p.height>=1||p.width<5||p.depth<5)return;rows.push({map:map.group.name,width:p.width,height:p.height,depth:p.depth,collide:mesh.userData.collide,role:mesh.userData.collisionRole});});return rows;}
const thinAudit=[...thinSurfaces(base),...thinSurfaces(ship)];
assert.equal(thinAudit.filter(v=>v.role==='roof').length,2,'未来基地屋顶数量异常');
assert.ok(thinAudit.filter(v=>v.role==='roof').every(v=>v.collide===false),'仍有屋顶薄片参与碰撞');
assert.ok(thinAudit.filter(v=>v.map===ship.group.name&&v.role==='deck').every(v=>v.collide===false),'运输船甲板薄片碰撞标志错误');
assert.ok(thinAudit.filter(v=>v.map===ship.group.name&&v.role==='platform').every(v=>v.collide===true),'运输船可站立平台碰撞被误关');

function rectMap(rect){return{collides(pos,r){return pos.x+r>rect.minX&&pos.x-r<rect.maxX&&pos.z+r>rect.minZ&&pos.z-r<rect.maxZ;}};}
function headlessEnemy(x,z){const enemy=new Enemy(new THREE.Scene(),{emit:noop});enemy.def={scale:1,range:1.35,role:'melee'};enemy.group.position.set(x,0,z);enemy.lastAvoidDir=0;enemy.avoidHeading=null;return enemy;}
function simulate(enemy,target,map,{dt=.05,speed=3,limit=12,range=1.35}={}){
  const start=enemy.group.position.clone(),track=[start.clone()],turns=[];let stalls=0,elapsed=0,lastSide=0;
  for(;elapsed<limit&&enemy.group.position.distanceTo(target)>range;elapsed+=dt){const before=enemy.group.position.clone(),dir=target.clone().sub(before).setY(0).normalize();enemy.move(dir,speed*dt,map);if(before.distanceTo(enemy.group.position)<1e-7)stalls++;if(enemy.lastAvoidDir&&enemy.lastAvoidDir!==lastSide){turns.push(enemy.group.position.clone());lastSide=enemy.lastAvoidDir;}track.push(enemy.group.position.clone());}
  const distances=track.map(p=>p.distanceTo(target)),decreasing=distances.slice(1).filter((d,i)=>d<=distances[i]+.02).length/(distances.length-1);
  return{start,track,turns,end:enemy.group.position.clone(),elapsed,stalls,decreasing,finalDistance:enemy.group.position.distanceTo(target)};
}
const wall=rectMap({minX:-5,maxX:5,minZ:-.55,maxZ:.55}),target=new THREE.Vector3(0,0,-7),wallRun=simulate(headlessEnemy(0,7),target,wall,{limit:12});
assert.ok(wallRun.finalDistance<1.35,'怪物未绕过长墙到达攻击范围');assert.ok(wallRun.elapsed<10,'绕墙耗时不合理');assert.ok(wallRun.stalls<3,'绕墙过程存在持续原地抖动');assert.ok(wallRun.decreasing>.65,'目标距离缺少总体下降趋势');

const doorEnemy=headlessEnemy(-18.5,11),doorTarget=new THREE.Vector3(-18.5,0,19),doorRun=simulate(doorEnemy,doorTarget,base,{limit:5,range:1.2});
assert.ok(doorRun.finalDistance<1.2,'怪物未能从门口进入房间');assert.equal(doorRun.stalls,0,'怪物在房间门洞被阻挡');
const vec=v=>({x:+v.x.toFixed(2),z:+v.z.toFixed(2)}),result={generatedAt:new Date().toISOString(),rooms:roomResults,thinSurfaceAudit:thinAudit,wallAvoidance:{start:vec(wallRun.start),turns:wallRun.turns.map(vec),end:vec(wallRun.end),elapsedSeconds:+wallRun.elapsed.toFixed(2),finalDistance:+wallRun.finalDistance.toFixed(2),trackPoints:wallRun.track.length,stalledFrames:wallRun.stalls,distanceDecreasingRatio:+wallRun.decreasing.toFixed(3)},doorEntry:{start:vec(doorRun.start),end:vec(doorRun.end),elapsedSeconds:+doorRun.elapsed.toFixed(2),finalDistance:+doorRun.finalDistance.toFixed(2),trackPoints:doorRun.track.length,stalledFrames:doorRun.stalls}};
await mkdir('artifacts/batch5',{recursive:true});await writeFile('artifacts/batch5/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
