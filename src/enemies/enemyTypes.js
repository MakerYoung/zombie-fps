import { droneModel } from './enemyModels/drone.js';

export const ENEMY_TYPES = {
  assault: { name:'突击兵', role:'melee', health:86, speed:3.05, damage:18, range:1.2, scale:1, armor:0, color:0x19d8ff, accent:0xff784d, score:1, coinValue:5 },
  heavy: { name:'重甲兵', role:'melee', health:260, speed:1.15, damage:30, range:1.35, scale:1.18, armor:.5, color:0x5475a7, accent:0xffb13b, score:3, coinValue:15 },
  striker: { name:'迅捷猎手', role:'melee', health:60, speed:4.5, damage:12, range:1.1, scale:.88, color:0x53ff8f, accent:0x22c55e, score:1, coinValue:6, anim:{walkSwing:{amplitude:.09,frequency:10}} },
  exploder: { name:'自爆体', role:'exploder', health:58, speed:4.15, damage:48, range:2.7, scale:.92, color:0x8f36ff, accent:0xff315f, score:2, coinValue:8 },
  drone: { name:'悬浮哨兵', role:'ranged', health:90, speed:2.4, damage:13, range:20, preferred:14, projectile:'bullet', projectileSpeed:14, burst:2, scale:1, color:0x00e5ff, accent:0xffd65a, score:2, coinValue:9, model:droneModel, anim:{float:{amplitude:.16,frequency:2.2}} },
  shooter: { name:'射手', role:'ranged', health:72, speed:2.15, damage:11, range:18, preferred:12, projectile:'bullet', projectileSpeed:16, burst:3, scale:.96, color:0x13d6b0, accent:0xffd65a, score:2, coinValue:9 },
  rocketeer: { name:'火箭兵', role:'ranged', health:145, speed:1.45, damage:34, range:30, preferred:21, projectile:'grenade', projectileSpeed:7, scale:1.12, color:0xe34b38, accent:0xffca45, score:4, coinValue:18 },
  sniper: { name:'狙击手', role:'sniper', health:64, speed:1.75, damage:52, range:42, preferred:29, charge:1.65, projectile:'sniper', projectileSpeed:35, scale:.98, color:0x7256e8, accent:0xff3c87, score:5, coinValue:24 },
  boss: { name:'协议执刑者', role:'boss', health:1650, speed:1.55, damage:42, range:2, scale:1.75, color:0x262c55, accent:0xff315f, score:20, boss:true, coinValue:100 },
};

export const ENEMY_ORDER = ['assault','shooter','heavy','striker','rocketeer','exploder','drone','sniper','boss'];
export const unlockWave = type => ({ assault:1, shooter:3, heavy:4, striker:6, rocketeer:5, exploder:6, drone:7, sniper:8, boss:5 }[type] ?? 99);
