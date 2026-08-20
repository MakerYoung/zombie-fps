import {defaultAnims} from './animations.js';
import {makeCatalogModel} from './catalogModel.js';
import {frameFor} from './weaponFrames.js';

const pools={
  primary:['subsistence','rapidHit','feedingFrenzy','rampage','killClip','frenzy','headseeker','demolitionist'],
  precision:['outlaw','rapidHit','tripleTap','fourthCharm','openingShot','vorpal','explosive','firefly','desperado'],
  close:['feedingFrenzy','subsistence','surrounded','oneTwoPunch','trenchBarrel','demolitionist','rampage','overflow'],
  heavy:['fieldPrep','autoLoading','reconstruction','vorpal','chainReaction','lastingImpression','demolitionist','explosive'],
};
const make=(id,slot,name,archetype,stats,colors,perkPool)=>{
  const ammoType=slot===1?'primary':slot===3?'heavy':['sniper','shotgun','fusion'].includes(archetype)?'special':'primary';
  const frame=frameFor(archetype,stats.frame),range=stats.range??Math.round(100-Math.min(.08,stats.spread)*900),stability=stats.stability??Math.round(100-Math.min(.12,stats.recoil)*650),handling=stats.handling??Math.round(88-Math.min(3,stats.reload)*13);
  return {id,slot,category:String(slot),name,archetype,frame,fireMode:frame.mode,projectileType:stats.projectileType,projectileSpeed:stats.projectileSpeed,ammoType,desc:stats.desc||`${name} · ${frame.name}`,rarity:stats.rarity||'rare',damage:stats.damage,fireRate:stats.fireRate,range,stability,handling,magazine:stats.magazine,reserve:stats.reserve??(ammoType==='primary'?Infinity:ammoType==='special'?stats.magazine*3:0),reload:stats.reload,spread:stats.spread,recoil:stats.recoil,pellets:stats.pellets||1,explosionRadius:stats.explosionRadius??(archetype==='launcher'?3.2:0),auto:frame.mode==='auto',headshotMultiplier:stats.headshotMultiplier||2.35,colors,perkPool,anims:defaultAnims(stats.anims),sound:stats.sound||archetype,makeModel(){return makeCatalogModel(this);},effects:stats.effects||{}};
};
export const WEAPON_CATALOG=[
  // 一号位：步枪、冲锋枪与常规弹药武器
  make('smg',1,'蝰蛇冲锋枪','smg',{damage:19,fireRate:11,magazine:32,reload:1.65,spread:.012,recoil:.017},[0x475158,0x121518,0xff9b38],pools.primary),
  make('khvostov',1,'赫斯托沃夫 7G-0X','rifle',{damage:22,fireRate:9,magazine:40,reload:1.15,spread:.007,recoil:.012,rarity:'legendary'},[0x69745b,0x171a1d,0xc5a646],pools.primary),
  make('vanguard',1,'先锋 AR-7','rifle',{damage:26,fireRate:7.2,magazine:36,reload:1.55,spread:.007,recoil:.018},[0x486478,0x18232c,0x62d5ff],pools.primary),
  make('redjack',1,'赤卫脉冲','pulse',{damage:31,fireRate:5.6,magazine:30,reload:1.7,spread:.005,recoil:.024},[0x7f2f2f,0x231719,0xffb13b],pools.precision),
  make('nightwatch',1,'夜巡斥候','scout',{damage:43,fireRate:3.4,magazine:18,reload:1.8,spread:.003,recoil:.032,auto:false},[0x26313d,0x11161c,0x84c9ff],pools.precision),
  make('funnelweb',1,'漏斗蛛网','smg',{damage:17,fireRate:13,magazine:38,reload:1.45,spread:.014,recoil:.014},[0x3d3757,0x15131d,0xb38cff],pools.primary),
  make('horrorStory',1,'恐怖故事','rifle',{damage:29,fireRate:6.4,magazine:32,reload:1.6,spread:.006,recoil:.021},[0x704f2e,0x211912,0xffdf72],pools.primary),
  make('syncopation',1,'切分音-53','pulse',{damage:35,fireRate:4.8,magazine:27,reload:1.75,spread:.004,recoil:.026},[0x3f5964,0x151d21,0x6cf1de],pools.precision),
  make('chromaRush',1,'炫彩突进','rifle',{damage:21,fireRate:10,magazine:45,reload:1.65,spread:.009,recoil:.015},[0x6e4285,0x1b1320,0xff72dd],pools.primary),
  make('multimach',1,'多机 CCX','smg',{damage:20,fireRate:12,magazine:34,reload:1.35,spread:.011,recoil:.016},[0x756c5b,0x1d1c19,0xe7d39b],pools.primary),

  // 二号位：手炮、手枪、狙击、霰弹与聚合步枪
  make('pistol',2,'制式手枪','sidearm',{damage:34,fireRate:4.2,magazine:12,reload:1.25,spread:.006,recoil:.027,auto:false},[0xaeb8be,0x171a1d,0xff9b38],pools.precision),
  make('ace',2,'黑桃 A','handcannon',{damage:60,fireRate:2.5,magazine:6,reload:1.75,spread:.002,recoil:.055,auto:false,headshotMultiplier:3,rarity:'legendary'},[0xd6a92e,0x101116,0xf1ce62],pools.precision),
  make('shotgun',2,'雷鸣霰弹枪','shotgun',{damage:15,fireRate:1.25,magazine:7,reserve:21,reload:2.1,spread:.055,recoil:.075,pellets:8,auto:false},[0x92532e,0x171a1d,0xd8b07b],pools.close),
  make('conditional',2,'条件终局','shotgun',{damage:17,fireRate:1.1,magazine:6,reserve:18,reload:2,spread:.05,recoil:.08,pellets:8,auto:false,rarity:'legendary'},[0x61dcff,0x18233d,0xff5a1f],pools.close),
  make('longbow',2,'长弓','sniper',{damage:120,fireRate:.9,magazine:5,reserve:15,reload:2.2,spread:.001,recoil:.065,auto:false,headshotMultiplier:3},[0x65737e,0x141a20,0x8fdcff],pools.precision),
  make('palindrome',2,'回文','handcannon',{damage:66,fireRate:2.2,magazine:9,reload:1.8,spread:.0025,recoil:.058,auto:false},[0x5a6172,0x171923,0xe75f8d],pools.precision),
  make('beloved',2,'挚爱','sniper',{damage:105,fireRate:1.2,magazine:6,reserve:18,reload:2,spread:.0012,recoil:.052,auto:false,headshotMultiplier:3.2},[0x8b6c55,0x251b17,0xffd09b],pools.precision),
  make('foundVerdict',2,'裁决定论','shotgun',{damage:19,fireRate:.95,magazine:5,reserve:15,reload:2.3,spread:.06,recoil:.09,pellets:9,auto:false},[0x56656b,0x151b1e,0x71e4ff],pools.close),
  make('cartesian',2,'笛卡尔坐标','fusion',{damage:29,fireRate:2.4,magazine:7,reserve:21,reload:2,spread:.025,recoil:.045,pellets:5,auto:false},[0x44395f,0x171421,0xb987ff],pools.close),
  make('drang',2,'德朗','sidearm',{damage:38,fireRate:5,magazine:18,reload:1.35,spread:.007,recoil:.023,auto:false},[0x8c744e,0x211b13,0xffcc72],pools.primary),

  // 三号位：重型弹药武器
  make('hammerhead',3,'锤头','machinegun',{damage:58,fireRate:7.5,magazine:45,reload:2.5,spread:.012,recoil:.028},[0x29343c,0x101518,0x58d5ff],pools.heavy),
  make('commemoration',3,'纪念','machinegun',{damage:52,fireRate:9,magazine:55,reload:2.65,spread:.014,recoil:.024},[0x4b3a63,0x17131e,0xc28cff],pools.heavy),
  make('xenophage',3,'异星噬菌体','machinegun',{damage:145,fireRate:1.8,magazine:13,reload:2.8,spread:.004,recoil:.085,auto:false,rarity:'legendary'},[0x8b5e2e,0x20150d,0xff9a32],pools.heavy),
  make('taipan',3,'太攀蛇-4FR','linear',{damage:190,fireRate:.8,magazine:6,reload:2.6,spread:.001,recoil:.07,auto:false,headshotMultiplier:3},[0x52466b,0x171420,0xbe91ff],pools.heavy),
  make('cataclysmic',3,'灾变','linear',{damage:220,fireRate:.65,magazine:5,reload:2.9,spread:.001,recoil:.082,auto:false,headshotMultiplier:3.1},[0x713d31,0x201210,0xff784e],pools.heavy),
  make('hothead',3,'急性子','launcher',{damage:260,fireRate:.45,magazine:1,reload:2.7,spread:.006,recoil:.11,projectileType:'rocket',projectileSpeed:30,auto:false},[0x6d4a29,0x21160d,0xffb23f],pools.heavy),
  make('gjallarhorn',3,'加拉尔号角','launcher',{damage:235,fireRate:.5,magazine:2,reload:3,spread:.008,recoil:.12,explosionRadius:6.5,projectileType:'rocket',projectileSpeed:27,auto:false,rarity:'legendary'},[0xe0c26d,0x332815,0xffffff],pools.heavy),
  make('wendigo',3,'温迪戈 GL3','launcher',{damage:175,fireRate:1.2,magazine:6,reload:2.8,spread:.018,recoil:.08,projectileType:'grenade',projectileSpeed:17,auto:false},[0x575c63,0x17191b,0x9bd8ff],pools.heavy),
  make('parasite',3,'寄生虫','launcher',{damage:320,fireRate:.32,magazine:1,reload:3.1,spread:.012,recoil:.13,projectileType:'grenade',projectileSpeed:14,auto:false,rarity:'legendary'},[0x77652f,0x231d0d,0xd7ff55],pools.heavy),
  make('retrofit',3,'改造逃逸','machinegun',{damage:43,fireRate:12,magazine:70,reload:2.9,spread:.016,recoil:.019},[0x315d62,0x102023,0x5effdb],pools.heavy),
];
