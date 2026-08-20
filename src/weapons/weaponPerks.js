// 武器词条注册表：静态属性与事件钩子均通过组合应用，不依赖具体枪械。
const perk=(id,name,desc,mods={},hooks={})=>({id,name,desc,mods,hooks});
export const WEAPON_PERKS={
  outlaw:perk('outlaw','不法之徒','精准击杀后大幅提升换弹速度',{}, {onKill({weapon,headshot}){if(headshot)weapon.perkState.outlaw=performance.now()+4500;}}),
  rapidHit:perk('rapidHit','快速命中','连续精准命中提高稳定性与换弹速度',{}, {onHit({weapon,headshot}){weapon.perkState.rapidHit=headshot?Math.min(5,(weapon.perkState.rapidHit||0)+1):0;}}),
  feedingFrenzy:perk('feedingFrenzy','喂食狂热','击杀逐层提高换弹速度',{}, {onKill({weapon}){weapon.perkState.feeding=Math.min(5,(weapon.perkState.feeding||0)+1);}}),
  subsistence:perk('subsistence','维持生计','击杀返还少量弹匣弹药',{}, {onKill({weapon}){weapon.ammo=Math.min(weapon.capacity(),weapon.ammo+Math.max(1,Math.ceil(weapon.capacity()*.12)));}}),
  overflow:perk('overflow','嫉妒刺客','拾取弹药时溢装弹匣',{}, {onAmmoPickup({weapon}){weapon.ammo=Math.min(weapon.capacity()*2,weapon.ammo+Math.ceil(weapon.capacity()*.35));}}),
  ambitious:perk('ambitious','野心刺客','快速击杀后换弹可溢装',{}, {onKill({weapon}){weapon.perkState.ambitious=Math.min(.5,(weapon.perkState.ambitious||0)+.1);},onReload({weapon}){if(weapon.perkState.ambitious){weapon.ammo=Math.min(Math.ceil(weapon.capacity()*(1+weapon.perkState.ambitious)),weapon.ammo+Math.ceil(weapon.capacity()*weapon.perkState.ambitious));weapon.perkState.ambitious=0;}}}),
  tripleTap:perk('tripleTap','三连击','连续三次精准命中返还一发',{}, {onHit({weapon,headshot}){weapon.perkState.triple=headshot?(weapon.perkState.triple||0)+1:0;if(weapon.perkState.triple>=3){weapon.ammo++;weapon.perkState.triple=0;}}}),
  fourthCharm:perk('fourthCharm','事不过四','连续四次精准命中返还两发',{}, {onHit({weapon,headshot}){weapon.perkState.fourth=headshot?(weapon.perkState.fourth||0)+1:0;if(weapon.perkState.fourth>=4){weapon.ammo+=2;weapon.perkState.fourth=0;}}}),
  autoLoading:perk('autoLoading','自动装填枪套','收起一段时间后自动装填',{},{}),
  reconstruction:perk('reconstruction','重建','缓慢将弹匣装填至双倍容量',{},{}),
  rampage:perk('rampage','狂暴','击杀后短时间提高伤害，可叠加三层',{}, {onKill({weapon}){weapon.perkState.rampage={stacks:Math.min(3,(weapon.perkState.rampage?.stacks||0)+1),until:performance.now()+4500};},onHit({weapon,damage}){return performance.now()<(weapon.perkState.rampage?.until||0)?damage*(1+weapon.perkState.rampage.stacks*.1):damage;}}),
  killClip:perk('killClip','杀戮弹匣','击杀后换弹获得短时增伤',{}, {onKill({weapon}){weapon.perkState.killClipReady=true;},onReload({weapon}){if(weapon.perkState.killClipReady){weapon.perkState.killClipUntil=performance.now()+5000;weapon.perkState.killClipReady=false;}},onHit({weapon,damage}){return performance.now()<(weapon.perkState.killClipUntil||0)?damage*1.25:damage;}}),
  multikill:perk('multikill','多杀弹匣','快速击杀后换弹获得更高增伤',{}, {onKill({weapon}){weapon.perkState.multikill=Math.min(3,(weapon.perkState.multikill||0)+1);},onReload({weapon}){weapon.perkState.multikillBuff=weapon.perkState.multikill||0;weapon.perkState.multikill=0;weapon.perkState.multikillUntil=performance.now()+5000;},onHit({weapon,damage}){return performance.now()<(weapon.perkState.multikillUntil||0)?damage*(1+(weapon.perkState.multikillBuff||0)*.12):damage;}}),
  frenzy:perk('frenzy','狂乱','连续处于战斗 12 秒后提高伤害，脱战 5 秒失效',{}, {onHit({weapon,damage}){const now=performance.now();if(now>(weapon.perkState.combatUntil||0))weapon.perkState.combatSince=now;weapon.perkState.combatUntil=now+5000;return now-(weapon.perkState.combatSince||now)>=12000?damage*1.15:damage;}}),
  vorpal:perk('vorpal','斩首武器','对首领和精英造成额外伤害',{}, {onHit({enemy,damage}){return enemy.def.boss||enemy.def.elite?damage*1.2:damage;}}),
  explosive:perk('explosive','爆炸弹头','命中产生小范围爆炸',{}, {onHit({game,enemy,point,damage}){game?.radialDamage(point,1.8,damage*.22,enemy,0xffb13b);return damage;}}),
  dragonfly:perk('dragonfly','蜻蜓','精准击杀触发元素爆炸',{}, {onKill({game,enemy,headshot}){if(headshot)game?.radialDamage(enemy.group.position,3,45,enemy,0x69d7ff);}}),
  firefly:perk('firefly','萤火虫','精准击杀触发灼热爆炸',{}, {onKill({game,enemy,headshot}){if(headshot)game?.radialDamage(enemy.group.position,3.5,55,enemy,0xff6a18);}}),
  headseeker:perk('headseeker','寻头者','非精准命中后下一次精准命中增伤',{}, {onHit({weapon,headshot,damage}){if(!headshot){weapon.perkState.headseeker=true;return damage;}const boost=weapon.perkState.headseeker;weapon.perkState.headseeker=false;return boost?damage*1.18:damage;}}),
  openingShot:perk('openingShot','首发射击','每次交战的第一发更加精准且伤害更高',{}, {onHit({weapon,damage}){const ready=performance.now()-(weapon.perkState.lastShot||0)>2500;weapon.perkState.lastShot=performance.now();return ready?damage*1.15:damage;}}),
  surrounded:perk('surrounded','腹背受敌','近距离有多个敌人时提高伤害',{}, {onHit({game,enemy,damage}){const nearby=game?.enemies.active.filter(e=>e.alive&&e.group.position.distanceTo(enemy.group.position)<5).length||0;return nearby>=3?damage*1.25:damage;}}),
  oneTwoPunch:perk('oneTwoPunch','左右连拳','一次霰弹射击的大部分弹丸命中后，短暂强化下一次近战',{}, {onShoot({weapon}){weapon.perkState.oneTwoHits=0;},onHit({weapon,damage}){weapon.perkState.oneTwoHits=(weapon.perkState.oneTwoHits||0)+1;if(weapon.perkState.oneTwoHits>=Math.ceil(weapon.data.pellets*.75))weapon.perkState.oneTwoUntil=performance.now()+1300;return damage;},onMelee({weapon,damage}){const ready=performance.now()<(weapon.perkState.oneTwoUntil||0);weapon.perkState.oneTwoUntil=0;return ready?damage*2:damage;}}),
  trenchBarrel:perk('trenchBarrel','战壕炮管','造成近战命中后，短暂强化接下来的三次霰弹射击',{}, {onMelee({weapon,damage}){weapon.perkState.trenchShots=3;weapon.perkState.trenchUntil=performance.now()+5000;return damage;},onHit({weapon,damage}){return performance.now()<(weapon.perkState.trenchUntil||0)&&weapon.perkState.trenchShots>0?damage*1.2:damage;},onShoot({weapon}){if(weapon.perkState.trenchShots>0)weapon.perkState.trenchShots--;}}),
  chainReaction:perk('chainReaction','连锁反应','击杀引发范围爆炸',{}, {onKill({game,enemy}){game?.radialDamage(enemy.group.position,3.2,50,enemy,0x9d6cff);}}),
  lastingImpression:perk('lastingImpression','持久印象','重型武器命中造成延迟高伤',{}, {onHit({weapon,enemy}){setTimeout(()=>enemy.alive&&enemy.hit(Math.round(weapon.data.damage*.45),false),350);}}),
  fieldPrep:perk('fieldPrep','战地准备','增加备弹并加快换弹',{reserve:1.25,reload:.82}),
  snapshot:perk('snapshot','速瞄','提高操控并降低后坐力',{recoil:.82,spread:.85}),
  rangefinder:perk('rangefinder','测距仪','提高射程与精准度',{spread:.8,range:1.2}),
  demolitionist:perk('demolitionist','爆破专家','击杀有概率返还弹药',{}, {onKill({weapon}){if(Math.random()<.35)weapon.ammo=Math.min(weapon.capacity(),weapon.ammo+2);}}),
  desperado:perk('desperado','亡命之徒','精准击杀后换弹，才会短时间提高射速',{}, {onKill({weapon,headshot}){if(headshot)weapon.perkState.desperadoReady=true;},onReload({weapon}){if(weapon.perkState.desperadoReady){weapon.perkState.desperadoReady=false;weapon.perkState.desperadoUntil=performance.now()+5000;}}}),
};
export const WEAPON_PERK_IDS=Object.keys(WEAPON_PERKS);

export function rollWeaponPerks(data,random=Math.random){
  const pool=[...new Set(data.perkPool||WEAPON_PERK_IDS)],chosen=[];while(chosen.length<2&&pool.length){const i=Math.floor(random()*pool.length);chosen.push(pool.splice(i,1)[0]);}
  return chosen;
}
export function applyWeaponRoll(data,perkIds){
  const rolled={...data,perks:perkIds.map(id=>WEAPON_PERKS[id]).filter(Boolean)},mods={};
  for(const p of rolled.perks)for(const [key,value] of Object.entries(p.mods||{}))mods[key]=(mods[key]||0)+(value-1);
  for(const [key,percent] of Object.entries(mods))if(Number.isFinite(rolled[key]))rolled[key]*=1+percent;
  return rolled;
}
