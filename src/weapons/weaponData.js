import { pistol } from './pistol.js';import { smg } from './smg.js';import { shotgun } from './shotgun.js';import { aceOfSpades } from './aceOfSpades.js';import { khvostov } from './khvostov.js';import { conditionalFinality } from './conditionalFinality.js';
// 统一注册表：新增枪械只需独立导出定义并在此登记。
export const WEAPONS=Object.fromEntries([pistol,smg,shotgun,aceOfSpades,khvostov,conditionalFinality].map(w=>[w.id,w]));
export const WEAPON_IDS=Object.keys(WEAPONS);
// 类别顺序同时决定装备槽与数字键顺序；注册新武器时只需声明 category。
export const WEAPON_CATEGORIES=[
  {id:'pistol',name:'手枪手炮类'},
  {id:'auto',name:'全自动类'},
  {id:'shotgun',name:'霰弹类'},
];
export const weaponsByCategory=(category)=>Object.values(WEAPONS).filter(w=>w.category===category);
