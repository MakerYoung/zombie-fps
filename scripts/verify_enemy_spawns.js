import assert from 'node:assert/strict';
import * as THREE from 'three';

const noop=()=>{};
global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:0,font:'',textAlign:'',fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fillText:noop})})};

const [{MapGenerator},{TransportShipMap},{EnemyManager},{EventBus}]=await Promise.all([
  import('../src/map/MapGenerator.js'),
  import('../src/map/TransportShipMap.js'),
  import('../src/enemies/EnemyManager.js'),
  import('../src/core/EventBus.js')
]);

const reports=[];
for(const [name,Map] of [['FutureBase60',MapGenerator],['TransportShipMap90',TransportShipMap]]){
  const scene=new THREE.Scene();
  const map=new Map(scene);
  assert.ok(map.safeSpawns.length>0,`${name}: safeSpawns 为空`);
  assert.ok(map.safeSpawnsByRegion.filter(points=>points.length).length>1,`${name}: 合法点只覆盖一个出生区`);

  let collisions=0,outOfBounds=0;
  const regions=new Set();
  for(let i=0;i<500;i++){
    const p=map.randomEdge();
    if(map.collides({x:p.x,y:0,z:p.z},.45))collisions++;
    if(Math.abs(p.x)>map.bounds-1.5||Math.abs(p.z)>map.bounds-1.5)outOfBounds++;
    let nearest=0,best=Infinity;
    map.enemySpawns.forEach((origin,index)=>{const distance=(p.x-origin.x)**2+(p.z-origin.z)**2;if(distance<best){best=distance;nearest=index;}});
    regions.add(nearest);
  }
  assert.equal(collisions,0,`${name}: randomEdge 生成了碰撞点`);
  assert.equal(outOfBounds,0,`${name}: randomEdge 生成点越界`);
  assert.ok(regions.size>1,`${name}: 500 次采样未覆盖多个出生区`);

  const bus=new EventBus();
  const manager=new EnemyManager(scene,bus,map,new THREE.Object3D(),false);
  const spawned=[];
  // 敌人重构后基础近战单位名为 assault。
  for(let i=0;i<50;i++)spawned.push(manager.spawn('assault',1));
  assert.equal(manager.active.length,50,`${name}: 未实际生成 50 只僵尸`);
  assert.ok(spawned.every(enemy=>enemy?.alive),`${name}: 存在非 alive 僵尸`);
  assert.ok(spawned.every(enemy=>!map.collides(enemy.group.position,.45)),`${name}: 实际僵尸位置发生碰撞`);

  reports.push({map:name,safeSpawnCount:map.safeSpawns.length,safeRegions:map.safeSpawnsByRegion.map(points=>points.length),randomEdgeSamples:500,collisions,outOfBounds,coveredRegions:[...regions].sort(),spawned:50,alive:spawned.filter(enemy=>enemy?.alive).length,spawnCollisions:spawned.filter(enemy=>map.collides(enemy.group.position,.45)).length});
}

console.log(JSON.stringify(reports,null,2));
