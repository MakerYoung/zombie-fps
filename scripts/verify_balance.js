import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Stats} from '../src/player/Stats.js';
import {Enemy,enemyHealthMultiplier} from '../src/enemies/Enemy.js';
import {ENEMY_TYPES} from '../src/enemies/enemyTypes.js';
import {EventBus} from '../src/core/EventBus.js';

const stats=new Stats();
stats.add('damage:a','damage',1.2);stats.add('damage:b','damage',1.2);
assert.equal(stats.get('damage'),1.4,'两个 +20% 必须等于基础值的 140%');
stats.add('health:flat','maxHealth',25,'add');stats.add('health:percent','maxHealth',1.2);
assert.equal(stats.get('maxHealth'),145,'固定生命不应被百分比再次放大');
stats.add('crit:a','critChance',.3,'add');stats.add('crit:b','critChance',.3,'add');
assert(stats.get('critChance')<.65&&stats.get('critChance')>.35,'概率软上限没有产生非线性递减');
assert(enemyHealthMultiplier(10)>enemyHealthMultiplier(5));
assert(enemyHealthMultiplier(10)-enemyHealthMultiplier(9)>enemyHealthMultiplier(3)-enemyHealthMultiplier(2),'波次生命成长必须为非线性');

const scene=new THREE.Scene(),bus=new EventBus(),normal=new Enemy(scene,bus),elite=new Enemy(scene,bus);
normal.spawn('assault',ENEMY_TYPES.assault,{x:0,z:0},1);elite.spawn('heavy',ENEMY_TYPES.heavy,{x:2,z:0},1);
assert.equal(normal.maxHealth,190);assert.equal(elite.maxHealth,620);
assert.equal(normal.healthBar.userData.fill.material.color.getHex(),0xe33434,'普通怪血条不是红色');
assert.equal(elite.healthBar.userData.fill.material.color.getHex(),0xf2c94c,'精英怪血条不是黄色');
normal.hit(95);assert(Math.abs(normal.healthBar.userData.fill.scale.x-.47)<1e-6,'血条没有同步生命比例');
const pistolHeadshot=34*2.35;assert(normal.maxHealth>pistolHeadshot*2,'普通怪仍可能被制式手枪一枪爆头击杀');

console.log(JSON.stringify({additive:{twoDamageBuffs:stats.get('damage'),mixedHealth:stats.get('maxHealth')},nonlinear:{critChance:stats.get('critChance'),wave5:enemyHealthMultiplier(5),wave10:enemyHealthMultiplier(10)},enemies:{assault:normal.maxHealth,heavy:elite.maxHealth,normalBar:'red',eliteBar:'yellow'}},null,2));
