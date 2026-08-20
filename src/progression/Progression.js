import { WEAPON_IDS } from '../weapons/weaponData.js';

export const LOCKED_WEAPONS=WEAPON_IDS.filter(id=>id!=='pistol');
export const WEAPON_UNLOCK_PRICE=60;
export const TALENT_PRICES=[20,40,60];
export const TALENTS={
  moveSpeed:{name:'机动协议',desc:'移速 +5% / 级'},
  maxHealth:{name:'生命扩容',desc:'最大生命 +10 / 级'},
  startingCoins:{name:'启动资金',desc:'初始金币 +20 / 级'},
  startingBuffs:{name:'先发优势',desc:'每级获得 1 次开局免费词条三选一'},
};

const defaults=()=>({cores:20,unlockedWeapons:['pistol'],talents:Object.fromEntries(Object.keys(TALENTS).map(id=>[id,0]))});

// 独立持久化模块允许浏览器 localStorage 与 headless 内存存储走同一套逻辑。
export class Progression {
  constructor(storage=globalThis.localStorage){this.storage=storage;this.data=this.load();}
  load(){
    const base=defaults();
    try{
      const rawCores=this.storage?.getItem('progress_cores'),cores=rawCores===null?NaN:Number(rawCores);
      const unlocked=JSON.parse(this.storage?.getItem('progress_weapons')||'null');
      const talents=JSON.parse(this.storage?.getItem('progress_talents')||'null');
      if(Number.isFinite(cores)&&cores>=0)base.cores=Math.floor(cores);
      if(Array.isArray(unlocked))base.unlockedWeapons=[...new Set([...base.unlockedWeapons,...unlocked.filter(id=>WEAPON_IDS.includes(id))])];
      if(talents&&typeof talents==='object')for(const id of Object.keys(TALENTS))base.talents[id]=Math.max(0,Math.min(3,Math.floor(Number(talents[id])||0)));
    }catch{}
    return base;
  }
  save(){this.storage?.setItem('progress_cores',String(this.data.cores));this.storage?.setItem('progress_weapons',JSON.stringify(this.data.unlockedWeapons));this.storage?.setItem('progress_talents',JSON.stringify(this.data.talents));}
  isWeaponUnlocked(id){return this.data.unlockedWeapons.includes(id);}
  discoverWeapon(id){if(!WEAPON_IDS.includes(id)||this.isWeaponUnlocked(id))return false;this.data.unlockedWeapons.push(id);this.save();return true;}
  unlockWeapon(id){if(!LOCKED_WEAPONS.includes(id)||this.isWeaponUnlocked(id))return {ok:false,reason:'invalid'};if(this.data.cores<WEAPON_UNLOCK_PRICE)return {ok:false,reason:'cores'};this.data.cores-=WEAPON_UNLOCK_PRICE;this.data.unlockedWeapons.push(id);this.save();return {ok:true};}
  upgradeTalent(id){const level=this.data.talents[id];if(!TALENTS[id]||level>=3)return {ok:false,reason:'max'};const price=TALENT_PRICES[level];if(this.data.cores<price)return {ok:false,reason:'cores'};this.data.cores-=price;this.data.talents[id]=level+1;this.save();return {ok:true,level:level+1,price};}
  award({kills=0,waves=0,bossKills=0}){const earned=Math.max(0,Math.floor(kills)+Math.floor(waves)*3+Math.floor(bossKills)*20);this.data.cores+=earned;this.save();return earned;}
  applyRun(stats){const t=this.data.talents;stats.add('talent.moveSpeed','moveSpeed',1+t.moveSpeed*.05);stats.add('talent.maxHealth','maxHealth',t.maxHealth*10,'add');return {coins:t.startingCoins*20,freeChoices:t.startingBuffs};}
}
