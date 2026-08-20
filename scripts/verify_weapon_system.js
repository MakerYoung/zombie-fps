import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WEAPONS,WEAPON_SLOTS,weaponsBySlot} from '../src/weapons/weaponData.js';
import {WEAPON_PERKS,WEAPON_PERK_IDS,applyWeaponRoll,rollWeaponPerks} from '../src/weapons/weaponPerks.js';
import {LOOT_TYPES,LOOT_IDS,rollLoot} from '../src/loot/lootTypes.js';
import {LootSystem} from '../src/loot/LootSystem.js';
import {EventBus} from '../src/core/EventBus.js';
import {WEAPON_FRAMES} from '../src/weapons/weaponFrames.js';
import {Progression} from '../src/progression/Progression.js';
import {Weapon} from '../src/player/Weapon.js';
import {Stats} from '../src/player/Stats.js';

assert.equal(Object.keys(WEAPONS).length,30,'武器总数必须为30');
assert.equal(WEAPON_SLOTS.length,3,'必须有三个武器槽位');
const slots=Object.fromEntries(WEAPON_SLOTS.map(({slot})=>[slot,weaponsBySlot(slot)]));
for(const [slot,weapons] of Object.entries(slots)){assert.equal(weapons.length,10,`${slot}号位不是10把武器`);assert(weapons.every(w=>w.slot===Number(slot)));}
assert.equal(WEAPON_PERK_IDS.length,30,'词条总数必须为30');assert.equal(new Set(WEAPON_PERK_IDS).size,30,'词条ID重复');
for(const weapon of Object.values(WEAPONS)){const ids=rollWeaponPerks(weapon,()=>.37),rolled=applyWeaponRoll(weapon,ids);assert.equal(ids.length,2,`${weapon.id} 未抽取两个词条`);assert.equal(new Set(ids).size,2,`${weapon.id} 词条重复`);assert.equal(rolled.perks.length,2);}
for(const weapon of Object.values(WEAPONS)){assert(weapon.frame&&WEAPON_FRAMES[weapon.frame.id],`${weapon.id} 缺少有效框架`);for(const stat of ['damage','fireRate','range','stability','magazine','handling'])assert(Number.isFinite(weapon[stat]),`${weapon.id} 缺少属性 ${stat}`);}
assert.equal(WEAPONS.redjack.fireMode,'burst','脉冲步枪必须三连发');assert.equal(WEAPONS.redjack.frame.burstCount,3,'脉冲框架不是三发');assert.equal(WEAPONS.cartesian.fireMode,'charge','聚合步枪必须蓄力');assert(WEAPONS.gjallarhorn.explosionRadius>=6,'加拉尔范围伤害不足');
assert(slots[1].every(w=>w.ammoType==='primary'),'一号位存在非主弹药武器');
assert(slots[2].filter(w=>['sniper','shotgun'].includes(w.archetype)).every(w=>Number.isFinite(w.reserve)&&w.reserve>0),'二号位狙击/霰弹没有有限备弹');
assert(slots[3].every(w=>w.ammoType==='heavy'&&w.reserve===0),'三号位必须依赖重弹掉落');
assert(rollLoot({def:{boss:true}},()=>1).includes('heavyAmmo'),'Boss没有保底重弹');
assert.deepEqual(new Set(LOOT_IDS),new Set(['primaryAmmo','specialAmmo','heavyAmmo','healthPack']),'基础掉落类型不完整');

const bus=new EventBus(),scene=new THREE.Scene(),player=new THREE.Object3D();player.position.set(0,1.72,0);const loot=new LootSystem(scene,bus,player,{random:()=>.5});let picked=[];bus.on('loot:picked',({type})=>picked.push(type.id));
for(const id of LOOT_IDS)loot.spawn(id,new THREE.Vector3(0,.2,0));loot.update(.016,true);
assert.deepEqual(new Set(picked),new Set(LOOT_IDS),'掉落实体没有全部被拾取');assert.equal(loot.active.length,0,'拾取后掉落实体未回收');
const weaponDrop=loot.spawn({weaponId:'ace'},new THREE.Vector3(3,0,0));assert.equal(weaponDrop.def.kind,'weapon');assert.equal(weaponDrop.baseY,1,'武器掉落未悬浮至一米');assert(weaponDrop.group.children[0].material.emissiveIntensity>=2,'武器掉落发光不足');loot.clear();
const memory=new Map(),storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,value)},progression=new Progression(storage);assert.deepEqual(progression.data.unlockedWeapons,['pistol'],'新玩家应仅拥有制式手枪');assert(progression.discoverWeapon('ace'),'武器发现失败');assert(!progression.discoverWeapon('ace'),'重复武器不应再次发现');

for(const id of ['pistol','redjack','cartesian','gjallarhorn']){
  const fireBus=new EventBus(),camera=new THREE.PerspectiveCamera(),weapon=new Weapon(camera,fireBus,new Stats(),WEAPONS[id]);let shots=0;fireBus.on('weapon:shoot',({weapon:fired})=>{if(fired===weapon)shots++;});
  for(let i=0;i<400;i++){weapon.update(.02,true);weapon.tryShoot();}
  assert(shots>=2,`${id} 按住开火未能连续发射`);weapon.dispose();
}
console.log(JSON.stringify({weapons:Object.fromEntries(Object.entries(slots).map(([slot,items])=>[slot,items.map(w=>({id:w.id,archetype:w.archetype,ammoType:w.ammoType}))])),perks:Object.values(WEAPON_PERKS).map(p=>p.name),loot:Object.values(LOOT_TYPES).map(v=>v.name)},null,2));
