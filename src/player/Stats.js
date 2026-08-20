const POLICIES={
  damage:{min:.25,max:2.6},fireRate:{min:.35,max:2.1},magazine:{min:.35,max:2.5},reloadSpeed:{min:.4,max:2.2},moveSpeed:{min:3.5,max:10.5},jumpHeight:{min:.55,max:1.85},
  critChance:{min:0,max:.65,soft:.35},doubleShotChance:{min:0,max:.4,soft:.22},dodgeChance:{min:0,max:.45,soft:.25},lifeSteal:{min:0,max:.12,soft:.06},
  critDamage:{min:1,max:2.8},headshotDamage:{min:.5,max:1.8},executeDamage:{min:1,max:1.8},autoFireRate:{min:.6,max:1.75},pistolDamage:{min:.6,max:1.8},heavyDamage:{min:.6,max:2},
};
const clamp=(value,min=-Infinity,max=Infinity)=>Math.max(min,Math.min(max,value));
// 软上限之后每一点只保留 35% 效果，避免概率类能力后期接近必定触发。
const soften=(value,soft)=>soft==null||value<=soft?value:soft+(value-soft)*.35;

export class Stats {
  constructor(){this.base={damage:1,fireRate:1,magazine:1,reloadSpeed:1,moveSpeed:7,jumpHeight:1,maxHealth:100,armor:0,critChance:.05,critDamage:1.6,pellets:0,explosionRadius:0,lifeSteal:0,fireBullets:0,iceBullets:0,headshotDamage:1,executeDamage:1,doubleShotChance:0,penetration:0,heavyAmmo:1,skillCooldown:1,coinGain:1,radarRange:1,dodgeChance:0,lowHealthSpeed:1,pistolDamage:1,autoFireRate:1,shotgunPellets:0,heavyDamage:1};this.mods=new Map();}
  get(key){const base=this.base[key]??0;let flat=0,percent=0;for(const mod of this.mods.values())if(mod.stat===key){if(mod.mode==='add')flat+=mod.value;else percent+=mod.value-1;}const raw=base*(1+percent)+flat,policy=POLICIES[key]||{};return clamp(soften(raw,policy.soft),policy.min,policy.max);}
  // mode=mul 保留现有数据格式，但语义是“相对基础值的百分比加算”：两个 1.2 => 基础值 × 1.4。
  add(id,stat,value,mode='mul'){this.mods.set(id,{stat,value,mode});}
  remove(id){this.mods.delete(id);}
  breakdown(key){const base=this.base[key]??0,mods=[...this.mods.entries()].filter(([,m])=>m.stat===key);return{base,percent:mods.filter(([,m])=>m.mode!=='add').reduce((n,[,m])=>n+m.value-1,0),flat:mods.filter(([,m])=>m.mode==='add').reduce((n,[,m])=>n+m.value,0),value:this.get(key)};}
}
