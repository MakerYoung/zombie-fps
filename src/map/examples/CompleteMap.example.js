// 完整数据驱动地图示例
// 复制此文件、重命名导出常量与 id，然后在 mapDefs.js 的 MAP_DEFS 中注册。
// 不要直接创建 THREE.Mesh；所有参与碰撞和寻路的物体必须写进 objects。

const object=(t,x,z,w,h,d,extra={})=>({t,x,z,w,h,d,...extra});

const objects=[
  // 1. 四周实体边界。视觉边界不能代替碰撞边界。
  object('wall',0,-15,40,4,1,{mat:'brick'}),
  object('wall',0,15,40,4,1,{mat:'brick'}),
  object('wall',-20,0,1,4,30,{mat:'brick'}),
  object('wall',20,0,1,4,30,{mat:'brick'}),

  // 2. 中央墙分成两段，必须留下宽于怪物直径的通路。
  object('wall',-8,0,10,2.4,1,{mat:'brick'}),
  object('wall',8,0,10,2.4,1,{mat:'brick'}),

  // 3. 集装箱：默认参与碰撞和导航，可设置颜色、编号、旋转和叠放层级。
  object('container',-11,-7,3,2.6,6,{mat:'container',color:'#b94c35',number:'EX-R01'}),
  object('container',11,7,3,2.6,6,{mat:'container',color:'#28799b',number:'EX-B01',rotation:Math.PI/2}),
  object('container',-11,-7,3,2.6,6,{mat:'container',color:'#d47a36',number:'EX-R02',level:1}),

  // 4. 可站立平台。heightAt() 会把玩家脚底放到平台顶面。
  object('platform',8,-8,5,1.2,5,{mat:'vehicle'}),

  // 5. 屋顶默认不参与碰撞；适合纯视觉顶棚。
  object('roof',-8,8,8,.35,6,{mat:'shack'}),
  object('wall',-12,8,1,3.2,6,{mat:'shack'}),
  object('wall',-4,8,1,3.2,6,{mat:'shack'}),
  object('wall',-8,5,8,3.2,1,{mat:'shack'}),

  // 6. collide:false 明确声明纯视觉几何，不阻挡玩家、射线或导航。
  object('deck',0,11,9,.08,2,{mat:'vehicle',collide:false,y:.02}),
];

export const completeMapExample={
  // 必填且全局唯一；URL、选图和 M 键切图都使用它。
  id:'completeExample',
  name:'完整地图示例',
  desc:'供复制扩展的碰撞、出生与导航完整模板',

  // width 对应 X 轴，length 对应 Z 轴；边界通常是尺寸的一半。
  width:40,
  length:30,
  boundsX:20,
  boundsZ:15,

  // 当前支持 ground 与 deck；size 用于装饰系统，repeat 控制纹理密度。
  ground:{kind:'ground',size:40,repeat:8},

  // y 固定使用第一人称站立高度 1.72；yaw 单位是弧度。
  playerSpawn:{x:0,y:1.72,z:11,yaw:0},

  // 至少两个分散的敌人出生区。系统会在每个中心周围预扫描安全点。
  enemySpawns:[
    {x:-16,z:-11},
    {x:16,z:-11},
    {x:-16,z:11},
    {x:16,z:11},
  ],

  objects,

  // decor 全部是纯视觉元素，不加入碰撞。
  // holo: 全息牌；floater: cube/ring；pillar: cyan/orange；line/ring: 地面线与圆环。
  decor:[
    {t:'holo',x:0,y:4,z:-13.5,ry:0},
    {t:'floater',x:0,y:5.5,z:0,kind:'ring'},
    {t:'pillar',x:-6,z:-6,color:'cyan'},
    {t:'pillar',x:6,z:6,color:'orange'},
    {t:'line',x:0,y:.012,z:0,len:20},
    {t:'ring',x:0,y:1.65,z:12,ry:0},
  ],
};

