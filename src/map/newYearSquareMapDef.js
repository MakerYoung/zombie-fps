// 新年广场地图 - 基于穿越火线经典地图复刻
// 数据驱动，所有碰撞和寻路物体均在 objects 中定义

const object = (t, x, z, w, h, d, extra = {}) => ({ t, x, z, w, h, d, ...extra });

const objects = [
  // ----- 四周实体边界（围墙） -----
  // 前后墙 (Z 方向)
  object('wall', 0, -20, 50, 4, 1, { mat: 'brick' }),
  object('wall', 0, 20, 50, 4, 1, { mat: 'brick' }),
  // 左右墙 (X 方向)
  object('wall', -25, 0, 1, 4, 40, { mat: 'brick' }),
  object('wall', 25, 0, 1, 4, 40, { mat: 'brick' }),

  // ----- 中央门洞墙（分成两段，留出 8 米宽通道）-----
  object('wall', -8, 0, 8, 2.5, 1, { mat: 'brick' }),   // 左段：x 从 -12 到 -4
  object('wall', 8, 0, 8, 2.5, 1, { mat: 'brick' }),    // 右段：x 从 4 到 12

  // ----- 集装箱掩体（对称布置）-----
  // 左侧两个（一个叠放）
  object('container', -18, -6, 3, 2.6, 6, { mat: 'container', color: '#b94c35', number: 'A1' }),
  object('container', -18, 6, 3, 2.6, 6, { mat: 'container', color: '#d47a36', number: 'A2', level: 1 }),
  // 右侧两个（旋转，叠放）
  object('container', 18, -6, 3, 2.6, 6, { mat: 'container', color: '#4caf50', number: 'B1', rotation: Math.PI / 2 }),
  object('container', 18, 6, 3, 2.6, 6, { mat: 'container', color: '#28799b', number: 'B2', rotation: Math.PI / 2, level: 1 }),

  // 中央门洞两侧的矮箱（增加掩体）
  object('container', -4, -4, 2, 1.6, 2, { mat: 'container', color: '#ff5722' }),
  object('container', 4, 4, 2, 1.6, 2, { mat: 'container', color: '#ff5722' }),

  // ----- 狙击平台（两端高位）-----
  object('platform', -12, -14, 4, 1.2, 4, { mat: 'vehicle' }),
  object('platform', 12, 14, 4, 1.2, 4, { mat: 'vehicle' }),

  // ----- 两端出生点小建筑（屋顶 + 墙壁）-----
  // 潜伏者基地（Z 负方向）
  object('roof', -12, -18, 6, 0.35, 4, { mat: 'shack' }),
  object('wall', -15, -18, 1, 2.4, 4, { mat: 'shack' }),
  object('wall', -9, -18, 1, 2.4, 4, { mat: 'shack' }),
  object('wall', -12, -20, 4, 2.4, 1, { mat: 'shack' }),
  // 保卫者基地（Z 正方向）
  object('roof', 12, 18, 6, 0.35, 4, { mat: 'shack' }),
  object('wall', 9, 18, 1, 2.4, 4, { mat: 'shack' }),
  object('wall', 15, 18, 1, 2.4, 4, { mat: 'shack' }),
  object('wall', 12, 16, 4, 2.4, 1, { mat: 'shack' }),

  // ----- 地面装饰性薄片（无碰撞）-----
  // 中央广场红色地毯效果（实际为 deck，但 collide:false）
  object('deck', 0, 0, 20, 0.08, 12, { mat: 'vehicle', collide: false, y: 0.02 }),
];

export const newYearSquareMapDef = {
  id: 'newYearSquare',
  name: '新年广场',
  desc: '穿越火线经典新年主题地图，对称布局，适合团队对抗',

  // 地图尺寸（X 方向宽度，Z 方向长度）
  width: 50,
  length: 40,
  boundsX: 25,
  boundsZ: 20,

  // 地面配置
  ground: { kind: 'ground', size: 50, repeat: 10 },

  // 玩家出生点（保卫者基地，面向潜伏者）
  playerSpawn: { x: 0, y: 1.72, z: 17, yaw: Math.PI },

  // 敌人出生区（潜伏者基地，两个分散点）
  enemySpawns: [
    { x: -8, z: -16 },
    { x: 8, z: -16 },
  ],

  // 所有碰撞物体
  objects,

  // 纯视觉装饰（无碰撞）
  decor: [
    // 中央全息牌（新年祝福）
    { t: 'holo', x: 0, y: 4, z: 0, ry: 0 },
    // 悬浮环（节日彩灯）
    { t: 'floater', x: 0, y: 5.5, z: 0, kind: 'ring' },
    // 彩色灯柱（红金搭配）
    { t: 'pillar', x: -6, z: -6, color: 'red' },
    { t: 'pillar', x: 6, z: 6, color: 'gold' },
    // 地面引导线（通向中央）
    { t: 'line', x: 0, y: 0.012, z: 0, len: 30 },
    // 环形装饰（出生点附近）
    { t: 'ring', x: 0, y: 1.65, z: 15, ry: 0 },
    // 两侧额外灯柱
    { t: 'pillar', x: -12, z: -10, color: 'cyan' },
    { t: 'pillar', x: 12, z: 10, color: 'orange' },
  ],
};