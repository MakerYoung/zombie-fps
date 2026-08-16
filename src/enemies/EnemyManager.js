import { Enemy } from './Enemy.js';
import { ENEMY_TYPES } from './enemyTypes.js';

export class EnemyManager {
  constructor(scene,bus,map,camera,mobile){this.scene=scene;this.bus=bus;this.map=map;this.camera=camera;this.mobile=Boolean(mobile);this.limit=50;this.pool=[];this.active=[];this.difficulty={health:1,speed:1};for(let i=0;i<(this.mobile?12:25);i++)this.pool.push(new Enemy(scene,bus));bus.on('enemy:despawn',({enemy})=>this.recycle(enemy));}
  setDifficulty(scale){this.difficulty={...this.difficulty,...scale};}
  spawn(type,wave,position=null){if(!ENEMY_TYPES[type])throw new Error(`未知敌人类型: ${type}`);if(this.active.length>=this.limit)return null;const e=this.pool.pop()||new Enemy(this.scene,this.bus),p=position||this.map.randomEdge();e.spawn(type,ENEMY_TYPES[type],p,wave,this.difficulty);this.active.push(e);this.bus.emit('enemy:spawned',{enemy:e,enemyType:type});return e;}
  update(dt,active){if(active)this.active.forEach(e=>e.update(dt,this.camera,this.map));}
  recycle(e){const i=this.active.indexOf(e);if(i<0)return false;this.active.splice(i,1);if(!this.pool.includes(e))this.pool.push(e);return true;}
  clear(){for(const e of [...this.active]){e.alive=false;e.group.visible=false;this.recycle(e);}}
  rayTargets(){const out=[];this.active.forEach(e=>{if(e.alive)e.group.traverse(o=>{if(o.isMesh)out.push(o);});});return out;}
}
