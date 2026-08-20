# 三槽位武器系统

## 数据边界

- weaponCatalog.js：30 把武器的属性、槽位、原型、弹药类型与词条池。
- weaponPerks.js：30 条可组合词条。静态属性写入 mods，动态行为写入事件钩子。
- catalogModel.js：按 archetype 生成第一人称模型，不依赖具体枪名。
- weaponData.js：只负责导出注册表与按槽位查询。
- player/Weapon.js：每次创建实例时从词条池无重复抽取 2 条并执行组合。
- loot/lootTypes.js：拾取物定义和敌人掉落表。
- loot/LootSystem.js：掉落实体的生成、动画、拾取和回收。

## 新增武器

在 WEAPON_CATALOG 增加一个 make 条目即可。必须提供唯一 id、slot、archetype、战斗属性、配色和 perkPool。UI、切枪、随机词条、音效回退和存档会自动识别。

## 新增词条

在 WEAPON_PERKS 增加定义，再把 ID 放入某类武器的词条池。支持 onShoot、onHit、onKill、onReload、onAmmoPickup 钩子。钩子通过上下文工作，不应导入具体游戏系统。

## 新增掉落物

1. 在 LOOT_TYPES 注册外观和基础数据。
2. 在 DEFAULT_LOOT_TABLE 配置概率，或由任意系统发布 loot:spawn。
3. 在游戏协调层监听 loot:picked 并应用效果。

掉落实体系统不直接依赖武器、生命、商店或任务系统，因此可以继续扩展护甲、技能能量、临时 Buff、任务道具等类型。

## 框架与获取

`weaponFrames.js` 是类型行为注册表，定义全自动、半自动、三连发、散射、聚合蓄力、线性蓄力和火箭等扳机模式。具体武器只配置伤害、射速、射程、稳定性、弹匣量、操纵性与外观；新增行为应增加框架，不要在 `Game` 中判断具体枪名。

新存档仅拥有 `pistol`。敌人死亡后，游戏协调层通过 `loot:spawn` 发布未发现武器；`LootSystem` 只管理发光悬浮实体和拾取事件，`Progression.discoverWeapon` 只管理永久收藏，UI 只查询收藏。三个职责可独立替换。
