export class Stats {
  constructor(){this.base={damage:1,fireRate:1,magazine:1,reloadSpeed:1,moveSpeed:7,jumpHeight:1,maxHealth:100,armor:0,critChance:.05,critDamage:1.6,pellets:0,explosionRadius:0,lifeSteal:0,fireBullets:0,iceBullets:0,headshotDamage:1,executeDamage:1,doubleShotChance:0,penetration:0,heavyAmmo:1,skillCooldown:1,coinGain:1,radarRange:1,dodgeChance:0,lowHealthSpeed:1,pistolDamage:1,autoFireRate:1,shotgunPellets:0,heavyDamage:1};this.mods=new Map();}
  get(key){let add=0,mul=1;for(const m of this.mods.values())if(m.stat===key){if(m.mode==='add')add+=m.value;else mul*=m.value;}return (this.base[key]+add)*mul;}
  add(id,stat,value,mode='mul'){this.mods.set(id,{stat,value,mode});} remove(id){this.mods.delete(id);}
}
