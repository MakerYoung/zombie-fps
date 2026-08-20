export const LOOT_TYPES={
  primaryAmmo:{id:'primaryAmmo',name:'主武器弹药',kind:'ammo',ammoType:'primary',color:0xffffff,amount:12,life:24},
  specialAmmo:{id:'specialAmmo',name:'特殊弹药',kind:'ammo',ammoType:'special',color:0x6dff9c,amount:6,life:28},
  heavyAmmo:{id:'heavyAmmo',name:'重型弹药',kind:'ammo',ammoType:'heavy',color:0xb783ff,amount:8,life:32},
  healthPack:{id:'healthPack',name:'应急血包',kind:'health',color:0xff4f67,amount:25,life:25},
};
export const LOOT_IDS=Object.keys(LOOT_TYPES);

// 敌人掉落表独立于拾取效果；后续可按敌人类型、波次、难度追加规则。
export const DEFAULT_LOOT_TABLE=[
  {type:'primaryAmmo',chance:.1},
  {type:'specialAmmo',chance:.12},
  {type:'heavyAmmo',chance:.075},
  {type:'healthPack',chance:.08},
];
export function rollLoot(enemy,random=Math.random,table=DEFAULT_LOOT_TABLE){
  const drops=table.filter(entry=>random()<entry.chance).map(entry=>entry.type);
  if(enemy?.def?.boss&&!drops.includes('heavyAmmo'))drops.push('heavyAmmo');
  return drops;
}
