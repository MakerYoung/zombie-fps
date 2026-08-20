import {WEAPON_CATALOG} from './weaponCatalog.js';
export const WEAPONS=Object.fromEntries(WEAPON_CATALOG.map(w=>[w.id,w]));
export const WEAPON_IDS=Object.keys(WEAPONS);
export const WEAPON_SLOTS=[
  {id:'1',slot:1,name:'一号位 · 主武器',ammoType:'primary'},
  {id:'2',slot:2,name:'二号位 · 特殊武器',ammoType:'mixed'},
  {id:'3',slot:3,name:'三号位 · 重型武器',ammoType:'heavy'},
];
export const WEAPON_CATEGORIES=WEAPON_SLOTS;
export const weaponsBySlot=slot=>Object.values(WEAPONS).filter(w=>w.slot===Number(slot));
export const weaponsByCategory=weaponsBySlot;
