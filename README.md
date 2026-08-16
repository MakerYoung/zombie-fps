# 僵尸围城

一款完全本地打包、无 CDN 和外部素材依赖的 Three.js 3D FPS Roguelike。模型、地图、粒子与 WebAudio 音效均由代码生成。支持 PC 键鼠与手机横屏触屏双端。

![游戏画面](screenshots/gameplay.png)

![运输船地图](screenshots/transport-ship.png)

## 在线试玩

https://zombie.oblfs.cc.cd (手机建议横屏)

## 运行与构建

```bash
npm install
npm run dev
npm run build
npm run preview
```

生产文件位于 `dist/`，Vite 使用相对资源路径，可直接部署到任意静态服务器或子目录。浏览器需要支持 WebGL；PC 推荐 Chrome，移动端支持最新版 Chrome/Safari，并建议横屏。

## 操作

- PC：WASD 移动，鼠标观察，左键射击，R 换弹，空格跳跃，Esc 暂停；数字键 1/2/3 切换三类装备武器。
- 手机：左半屏拖动移动，右半屏滑动观察；右侧按钮支持持续开火、换弹、切枪和跳跃。

## 目录

- `src/core/`：场景、渲染器、相机、事件总线、资源入口、主循环和游戏状态机
- `src/player/`：玩家移动、生命属性、可修饰属性和武器实例
- `src/weapons/`：三把武器的数据配置
- `src/enemies/`：程序化僵尸、类型注册表、AI 与对象池管理
- `src/systems/`：射击、波次、音效、粒子、弹痕、震屏与反馈
- `src/roguelike/`：30 个可选词条、修饰器叠层和事件型词条
- `src/map/`：120×120 地图、掩体、建筑和简化碰撞
- `src/input/`：PC/触屏适配器与统一语义输入
- `src/ui/`：菜单、HUD、词条选择、暂停和死亡结算
- `src/utils/`：通用对象池

## 扩展内容

### 新增武器

每把武器是 `src/weapons/<id>.js` 中的独立对象。可复制 `src/weapons/longbow.js`，保留以下结构：

```js
import * as THREE from 'three';
import { arm, builder, muzzle } from './modelUtils.js';
import { defaultAnims } from './animations.js';

export const example = {
  id: 'example', category: 'pistol', name: '示例', desc: '选装说明', rarity: 'rare',
  damage: 30, fireRate: 2, magazine: 8, reserve: Infinity, reload: 1.8,
  spread: .01, recoil: .04, pellets: 1, auto: false, headshotMultiplier: 2,
  anims: defaultAnims({ idle: { amplitude: .002 } }),
  makeModel() {
    const { group, mat, part } = builder();
    part(new THREE.BoxGeometry(.2, .2, .6), mat(0x333333, 'steel'), [0, 0, -.4]);
    arm(group); // 可再加 arm(group, { side: 'left', ... })
    return { ...muzzle(group, [0, 0, -.8]), group };
  },
  effects: { onShoot() {}, onHit() {}, onKill() {}, onReload() {} },
};
```

字段说明：`category` 必须是 `pistol / auto / shotgun`；`rarity` 控制选装卡样式；`damage` 是单弹伤害，`fireRate` 是每秒射速，`magazine` 是弹匣，`reserve` 可为 `Infinity`，`reload` 单位为秒；`spread` 是弧度散布，`recoil` 驱动枪模和视角反馈，`pellets` 是每枪弹丸数，`auto` 控制按住连射，`headshotMultiplier` 是爆头倍率。`makeModel()` 必须返回 `{group,muzzle,muzzleLight}`，用 `builder()` 提供的 `mat/part` 搭模型，并用 `arm()` 衔接持枪手臂。`defaultAnims(overrides)` 可覆盖 `idle/reload/moveSway`；效果钩子的上下文包含武器、命中敌人和游戏实例，未使用的钩子可为空函数。

最后在 `src/weapons/weaponData.js` 导入对象并加入 `WEAPONS` 构建数组。类别会自动进入对应选装槽，切枪无需改系统代码。默认情况下，新 ID 不在 `Progression.js` 的 `LOCKED_WEAPONS` 就会直接解锁；若它是核心解锁武器，才把 ID 加入该常量。

### 新增敌人

在 `src/enemies/enemyTypes.js` 的 `ENEMY_TYPES` 添加条目：

```js
striker: {
  name: '迅捷猎手', role: 'melee', health: 60, speed: 4.5,
  damage: 12, range: 1.1, scale: .88, color: 0x53ff8f,
  accent: 0x22c55e, score: 1, coinValue: 6,
  anim: { walkSwing: { amplitude: .09, frequency: 10 } },
}
```

必填字段为 `name/role/health/speed/damage/range/scale/color/accent/score/coinValue`。远程单位还应给出 `preferred/projectile/projectileSpeed`，并可使用 `burst` 或 `charge`。可选 `armor/boss` 改变既有通用行为。可选动画为 `anim.walkSwing.{amplitude,frequency}` 与 `anim.float.{amplitude,frequency}`，未填走默认值。

纯数据路线不写模型，自动使用通用类人形工厂，参考 `striker`。自定义路线新增 `src/enemies/enemyModels/<id>.js`，导出签名 `(def, owner) => ({group, parts})` 的函数，并在类型条目的 `model` 字段引用；每个可命中 mesh 要设置 `userData.enemy=owner` 与 `userData.baseEmissive`，参考 `enemyModels/drone.js`。

把 ID 插入 `ENEMY_ORDER`，并在 `unlockWave` 映射登记首次波次。`WaveManager` 会从二者自动构造解锁池，并保证解锁波至少登场一次；只有新角色需要全新 AI 或音效规则时才修改系统。

### 新增地图

在 `src/map/mapDefs.js` 的 `MAP_DEFS` 添加一份数据，参考 `borderPost`：

```js
exampleMap: {
  id: 'exampleMap', name: '示例地图', desc: '选图界面的故事说明',
  width: 60, length: 40, boundsX: 30, boundsZ: 20,
  ground: { kind: 'ground', size: 60, repeat: 10 },
  playerSpawn: { x: 0, y: 1.72, z: 8, yaw: 0 },
  enemySpawns: [{ x: -26, z: -15 }, { x: 26, z: 15 }],
  objects: [{ t: 'wall', x: 0, z: -20, w: 60, h: 3, d: 1, mat: 'brick' }],
  decor: [{ t: 'pillar', x: 8, z: 8, color: 'orange' }],
}
```

`width/length` 是地面尺寸，`boundsX/boundsZ` 是中心到边界的半径；出生点必须不碰撞，敌人出生点应分散且位于开阔区域。`ground.kind` 为 `ground` 或 `deck`，`repeat` 控制程序纹理重复。

所有 object 都用 `x/z/w/h/d`，可选 `mat/y/color/number/level/rotation/collide/role`。类型如下：`wall` 是碰撞墙；`roof` 仅视觉；`container` 支持 `level` 堆叠、编号和旋转；`deck` 是甲板或可站面；`platform` 是台阶/低平台；`hull` 是无碰撞船体。现有材质名包括 `brick/container/vehicle/shack/steel/wood/deck/hull`。

decor 类型如下：`holo` 使用 `x/y/z/ry`；`floater` 另有 `kind: cube|ring`；`pillar` 使用 `color: cyan|orange`；`line` 使用 `len` 和可选 `ry`；`ring` 使用 `x/y/z/ry`。未知 object 或 decor 类型会立即抛错。注册表由 `Game` 和选图 UI 自动遍历，无需修改加载代码；完成后用 `new MapGenerator(scene, MAP_DEFS.exampleMap)` 检查出生点、墙体和平台碰撞。

### 新增词条

在 `src/roguelike/buffPool.js` 添加配置。纯数值词条使用 `stat()`；事件词条提供 `apply(context, stack)`，通过 `context.listen()` 订阅 `weapon:shoot`、`shot:hit`、`enemy:killed`、`player:damaged` 或 `weapon:reloaded`。监听器会随一局结束卸载。
