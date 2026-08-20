# 数据驱动地图模板

新地图请复制 `examples/CompleteMap.example.js`，不要从零猜测接口。正式地图必须由一个普通对象定义，视觉、碰撞、出生安全和 A* 导航才能使用同一份数据。

## 接入步骤

1. 复制示例文件并改名，例如 `NewYearMap.js`。
2. 将导出名改为 `newYearMapDef`，将 `id` 改为唯一的 `newYear`。
3. 修改尺寸、出生点、`objects` 和 `decor`。
4. 在 `mapDefs.js` 顶部导入：

```js
import { newYearMapDef } from './NewYearMap.js';
```

5. 将它加入注册表：

```js
export const MAP_DEFS={
  // 现有地图……
  [newYearMapDef.id]:newYearMapDef,
};
```

注册完成后，选图界面、`Game` 地图实例、M 键切图、安全出生扫描和导航网格都会自动包含新地图。

## 必填字段

| 字段 | 作用 |
| --- | --- |
| `id` | 全局唯一英文标识，不要包含空格 |
| `name` | 选图界面显示名称 |
| `desc` | 选图界面地图说明 |
| `width/length` | X/Z 方向地图尺寸 |
| `boundsX/boundsZ` | 玩家和怪物活动边界，通常为尺寸的一半 |
| `ground` | 地面类型、尺寸和纹理重复次数 |
| `playerSpawn` | 玩家坐标、第一人称高度和出生朝向 |
| `enemySpawns` | 敌人出生区域中心，建议至少 4 个且分散在地图外围 |
| `objects` | 所有实体建筑、墙、掩体和平台 |
| `decor` | 纯视觉装饰；没有时也必须写 `[]` |

## objects 类型

| `t` | 默认碰撞 | 说明 |
| --- | --- | --- |
| `wall` | 是 | 墙、矮墙、建筑立面 |
| `container` | 是 | 集装箱，支持 `color/number/level/rotation` |
| `platform` | 是 | 可站立平台或台阶 |
| `deck` | 是 | 甲板；纯地面薄片应设置 `collide:false` |
| `ledge` | 是 | 边缘护栏，按墙处理 |
| `roof` | 否 | 纯视觉屋顶 |
| `hull` | 否 | 纯视觉船体或大型外壳 |

每项基础参数顺序为：

```js
object(type, x, z, width, height, depth, options)
```

常用 `options`：`mat`、`color`、`rotation`、`y`、`collide`、`role`、`number`、`level`。

## 必须遵守的设计约束

- 玩家出生点必须在边界内且不能与任何碰撞体重叠。
- 每个敌人出生中心周围至少要有一片开放区域。
- 门洞建议宽度至少 2 米；过窄通道可能被导航安全半径封闭。
- 不要用一个完整墙体覆盖门洞，再期待视觉上的门可以通行；墙必须拆成门洞两侧的两段。
- 所有需要阻挡玩家和怪物的 Mesh 都必须进入 `objects`，仅在自定义 Three.js Group 中绘制不会产生碰撞。
- 旋转箱体会按旋转后的世界包围盒参与碰撞，狭窄斜放结构要留出额外空间。
- 地图外观可以独立扩展，但不要在地图文件里重复添加全局太阳光和环境光，`Engine` 已统一提供照明。

## 验证

注册新地图后至少运行：

```bash
npm run verify:map-template
npm run verify:maps
npm run verify:spawns
npm run verify:navigation
npm run build
```

如果新增了模板未支持的物体或装饰类型，需要同时扩展 `MapGenerator.buildObject()` 或 `MapGenerator.makeDecor()`，否则生成器会主动抛出未知类型错误。

