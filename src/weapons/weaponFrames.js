// 框架定义“这类枪如何射击”，目录只负责为具体武器提供数值与外观。
export const WEAPON_FRAMES={
  rapid:{id:'rapid',name:'速射框架',mode:'auto',description:'高射速全自动，稳定性与射程较低'},
  adaptive:{id:'adaptive',name:'适应框架',mode:'auto',description:'伤害、射程与操纵性均衡'},
  precision:{id:'precision',name:'精准框架',mode:'semi',description:'低射速、高精准与高射程'},
  pulse3:{id:'pulse3',name:'三连发脉冲框架',mode:'burst',burstCount:3,burstInterval:.075,description:'每次扣动扳机连续发射三发'},
  aggressive:{id:'aggressive',name:'高冲击框架',mode:'semi',description:'高伤害、高后坐力、较低操纵性'},
  spread:{id:'spread',name:'散射框架',mode:'semi',description:'近距离一次发射多枚弹丸'},
  fusion:{id:'fusion',name:'聚合框架',mode:'charge',chargeTime:.72,description:'按住扳机蓄能，完成后发射一组聚合弹丸'},
  heavyAuto:{id:'heavyAuto',name:'重型速射框架',mode:'auto',description:'消耗重弹的持续全自动火力'},
  linear:{id:'linear',name:'线性聚合框架',mode:'charge',chargeTime:.82,description:'蓄能后发射高伤害精准射线'},
  rocket:{id:'rocket',name:'火箭框架',mode:'semi',description:'低射速弹头，命中后造成范围伤害'},
};
const BY_ARCHETYPE={smg:'rapid',rifle:'adaptive',pulse:'pulse3',scout:'precision',sidearm:'precision',handcannon:'aggressive',shotgun:'spread',sniper:'precision',fusion:'fusion',machinegun:'heavyAuto',linear:'linear',launcher:'rocket'};
export function frameFor(archetype,override){return WEAPON_FRAMES[override||BY_ARCHETYPE[archetype]]||WEAPON_FRAMES.adaptive;}
