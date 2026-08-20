import assert from 'node:assert/strict';
import * as THREE from 'three';

const noop=()=>{};global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:0,font:'',textAlign:'',globalAlpha:1,fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fillText:noop})})};
const [{MapGenerator},{completeMapExample}]=await Promise.all([import('../src/map/MapGenerator.js'),import('../src/map/examples/CompleteMap.example.js')]);
const required=['id','name','desc','width','length','boundsX','boundsZ','ground','playerSpawn','enemySpawns','objects','decor'];
for(const key of required)assert.notEqual(completeMapExample[key],undefined,`模板缺少 ${key}`);
assert(completeMapExample.enemySpawns.length>=2,'模板敌人出生区不足');assert(completeMapExample.objects.length>0,'模板没有实体物件');
const map=new MapGenerator(new THREE.Scene(),completeMapExample),spawn=new THREE.Vector3(completeMapExample.playerSpawn.x,completeMapExample.playerSpawn.y,completeMapExample.playerSpawn.z);
assert.equal(map.collides(spawn,.38),false,'玩家出生点发生碰撞');assert.equal(map.safeSpawnsByRegion.length,completeMapExample.enemySpawns.length);assert(map.safeSpawnsByRegion.every(points=>points.length>0),'存在没有安全点的敌人出生区');
const routes=map.safeSpawnsByRegion.map((points,index)=>{const start=points[Math.floor(points.length/2)],path=map.findPath(start,completeMapExample.playerSpawn,.42);assert(path.length>0,`出生区 ${index} 到玩家不可达`);let from=start;for(const point of path){assert(map.navigation.segmentClear(from,point,.42),`出生区 ${index} 路径穿墙`);from=point;}return{index,safePoints:points.length,waypoints:path.length};});
console.log(JSON.stringify({id:completeMapExample.id,objects:completeMapExample.objects.length,decor:completeMapExample.decor.length,colliders:map.colliders.length,playerSpawnSafe:true,routes},null,2));

