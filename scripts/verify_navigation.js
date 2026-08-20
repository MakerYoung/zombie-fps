import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NavGrid } from '../src/map/NavGrid.js';
import { EventBus } from '../src/core/EventBus.js';
import { Enemy } from '../src/enemies/Enemy.js';

const rectangles=[{minX:-5,maxX:5,minZ:-1,maxZ:1},{minX:-5,maxX:-3,minZ:1,maxZ:8},{minX:3,maxX:5,minZ:1,maxZ:8}];
const synthetic={boundsX:12,boundsZ:12,collides(p,r){return Math.abs(p.x)+r>11.5||Math.abs(p.z)+r>11.5||rectangles.some(b=>p.x+r>b.minX&&p.x-r<b.maxX&&p.z+r>b.minZ&&p.z-r<b.maxZ);}};
synthetic.navigation=new NavGrid(synthetic);synthetic.findPath=(a,b,r)=>synthetic.navigation.findPath(a,b,r);
const start={x:0,z:6},goal={x:0,z:-6},path=synthetic.findPath(start,goal,.42);
assert(path.length>=2,'U 形障碍未生成绕行路径');assert(path.some(p=>Math.abs(p.x)>5),'路径没有绕出 U 形障碍开口');
let anchor=start;for(const waypoint of path){assert(synthetic.navigation.segmentClear(anchor,waypoint,.42),'简化路径穿过障碍');anchor=waypoint;}

const noop=()=>{},context={fillStyle:'',strokeStyle:'',lineWidth:0,font:'',textAlign:'',globalAlpha:1,fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fillText:noop};
global.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
const [{MapGenerator},{MAP_DEFS}]=await Promise.all([import('../src/map/MapGenerator.js'),import('../src/map/mapDefs.js')]);
const routeReport=[];
for(const [id,def] of Object.entries(MAP_DEFS)){
  const map=new MapGenerator(new THREE.Scene(),def),target=def.playerSpawn;
  for(const region of map.safeSpawnsByRegion){const spawn=region[Math.floor(region.length/2)];assert(spawn,`${id} 出生区没有安全点`);const route=map.findPath(spawn,target,.42);assert(route.length>0,`${id} 出生区到玩家没有路径 ${JSON.stringify(spawn)}`);let from=spawn;for(const point of route){assert(map.navigation.segmentClear(from,point,.42),`${id} 路径穿墙 ${JSON.stringify({from,point,route})}`);from=point;}routeReport.push({map:id,start:{x:spawn.x,z:spawn.z},waypoints:route.length});}
}

const bus=new EventBus(),enemy=new Enemy(new THREE.Scene(),bus),type={name:'测试追猎者',role:'melee',health:100,speed:3.2,damage:10,range:1.2,scale:1,color:0x00ffff,accent:0xff6600};
enemy.spawn('test',type,start,1);const player=new THREE.Object3D();player.position.set(goal.x,1.72,goal.z);let attacks=0,pathEvents=0,collisions=0,maxStuck=0;bus.on('enemy:attack',()=>attacks++);bus.on('enemy:path',()=>pathEvents++);
for(let frame=0;frame<900&&!attacks;frame++){enemy.update(1/30,player,synthetic);if(synthetic.collides(enemy.group.position,.42))collisions++;maxStuck=Math.max(maxStuck,enemy.stuckTime);}
assert(attacks>0,'敌人未绕过 U 形障碍抵达玩家');assert.equal(collisions,0,'敌人寻路过程中进入墙体');assert(pathEvents>0,'敌人未请求全局路径');assert(maxStuck<.8,'敌人在拐角持续卡住');

const cornerBox={minX:-1.5,maxX:1.5,minZ:-1.5,maxZ:1.5},cornerMap={boundsX:8,boundsZ:8,collides(p,r){return p.x+r>cornerBox.minX&&p.x-r<cornerBox.maxX&&p.z+r>cornerBox.minZ&&p.z-r<cornerBox.maxZ;}};
cornerMap.navigation=new NavGrid(cornerMap);cornerMap.findPath=(a,b,r)=>cornerMap.navigation.findPath(a,b,r);
const cornerBus=new EventBus(),cornerEnemy=new Enemy(new THREE.Scene(),cornerBus),cornerPlayer=new THREE.Object3D();cornerEnemy.spawn('test',type,{x:-3,z:0},1);cornerPlayer.position.set(3,1.72,0);
let cornerAttacks=0,cornerMaxStuck=0;cornerBus.on('enemy:attack',()=>cornerAttacks++);
for(let frame=0;frame<720&&!cornerAttacks;frame++){cornerEnemy.update(1/60,cornerPlayer,cornerMap);cornerMaxStuck=Math.max(cornerMaxStuck,cornerEnemy.stuckTime);}
assert(cornerAttacks>0,`敌人未绕过单方块直角 ${JSON.stringify({position:cornerEnemy.group.position,cornerMaxStuck})}`);assert(cornerMaxStuck<.8,'敌人在单方块直角停滞过久');

const platformBox={min:{x:-1,y:0,z:-1},max:{x:1,y:.8,z:1},userData:{climbable:true}};
const platformMap={
  collides(p,r){return p.x+r>platformBox.min.x&&p.x-r<platformBox.max.x&&p.z+r>platformBox.min.z&&p.z-r<platformBox.max.z&&p.y>-.2&&p.y-1.7<platformBox.max.y;},
  collidesEnemy(p,r,height){return p.x+r>-1&&p.x-r<1&&p.z+r>-1&&p.z-r<1&&p.y+height>.05&&p.y<.75;},
  blocksSight(p,r){return p.x+r>-1&&p.x-r<1&&p.z+r>-1&&p.z-r<1&&p.y+r>0&&p.y-r<.8;},
  climbHeightAt(p,r,from,max){return p.x+r>-1&&p.x-r<1&&p.z+r>-1&&p.z-r<1&&.8>from+.08&&.8<=from+max?.8:null;},
  supportHeightAt(p,r,current){return p.x+r>-1&&p.x-r<1&&p.z+r>-1&&p.z-r<1&&.8<=current+.18?.8:0;},
  findPath(a,b){return [{x:b.x,z:b.z}];}
};
const jumpBus=new EventBus(),jumper=new Enemy(new THREE.Scene(),jumpBus),elevatedPlayer=new THREE.Object3D();
jumper.spawn('test',type,{x:0,z:2},1);elevatedPlayer.position.set(0,2.52,0);
let jumps=0,landings=0,elevatedAttacks=0;jumpBus.on('enemy:jump',()=>jumps++);jumpBus.on('enemy:land',()=>landings++);jumpBus.on('enemy:attack',()=>elevatedAttacks++);
for(let frame=0;frame<360;frame++)jumper.update(1/60,elevatedPlayer,platformMap);
assert(jumps>0,'近战敌人没有尝试跳上低平台');assert(landings>0&&jumper.groundY===.8,'近战敌人没有真正落到平台顶面');assert(elevatedAttacks>0,`近战敌人贴近高处玩家后没有攻击 ${JSON.stringify({jumps,landings,height:jumper.group.position.y,x:jumper.group.position.x,z:jumper.group.position.z,stuck:jumper.stuckTime,jumping:jumper.jumping})}`);

const areaBus=new EventBus(),areaEnemy=new Enemy(new THREE.Scene(),areaBus),areaPlayer=new THREE.Object3D(),openMap={collides:()=>false,blocksSight:()=>false,findPath:()=>[]};
areaEnemy.spawn('test',type,{x:0,z:0},1);areaEnemy.attackCd=0;areaPlayer.position.set(type.range-.05,1.72,0);let areaAttacks=0;areaBus.on('enemy:attack',()=>areaAttacks++);
areaEnemy.update(1/60,areaPlayer,openMap);assert.equal(areaAttacks,1,'玩家进入近战攻击区后没有立即攻击');assert.equal(areaEnemy.wantedMove,false,'攻击区域内不应继续寻路移动');
console.log(JSON.stringify({synthetic:{waypoints:path,attacks,pathEvents,collisions,maxStuck},corner:{attacks:cornerAttacks,maxStuck:cornerMaxStuck,position:cornerEnemy.group.position},platform:{jumps,landings,elevatedAttacks,height:+jumper.group.position.y.toFixed(2)},routes:routeReport},null,2));
