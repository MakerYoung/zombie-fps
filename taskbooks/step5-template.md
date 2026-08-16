# 任务书 Step5:模板验收——全新武器/敌人/地图三资产各造一个 + 模板文档

## 前置
先读 CONTEXT.md 和 taskbooks/step1~step4(模板已建成:武器=文件+注册表,敌人=类型条目+可选模型,地图=mapDefs 数据)。本步是模板化工程的验收:用**三个全新资产**走通完整链路,证明"新内容=加文件/加数据,不动系统代码",并产出模板使用文档。

## 铁律清单
1. 完整实现,禁止省略/TODO/占位
2. 视觉改动必须截图自证(武器持枪视角 812x375、敌人同框、地图俯视+玩家视角),禁止"凭代码推断"
3. 禁 CDN、中文注释、单文件 <300 行
4. npm run build 必须成功
5. 跨文件改动全局 grep 确认无断链
6. 回复贴完成清单+验证数据+已知问题
7. 不得改动现有 6 把武器/7 种敌人/3 张地图的任何数值与外观(只允许新增)

## M1. 新武器"长弓狙击枪"(验证武器链路:文件+注册+模型+动画+效果)
- 新建 src/weapons/longbow.js,注册进 weaponData.js(WEAPONS + 类别归属)
- 数据:category:'pistol'(单发类,沿用现有 3 类,不开新槽位),name:'长弓',desc:'远距一击,爆头成倍',rarity:'rare',damage:120,fireRate:.9,magazine:5,reserve:Infinity,reload:2.2,spread:.001,recoil:.06,pellets:1,auto:false,headshotMultiplier:3
- makeModel:狙击枪造型(细长枪管+枪身+瞄准镜筒+枪托),用 modelUtils 的 builder/mat/part/arm(右手+左手托枪),枪体配色深灰+橙点缀,明显区别于现有武器
- anims:defaultAnims({idle:{amplitude:.0015},moveSway:{maxPosition:.022,maxRotation:.035}})(沉稳)
- effects:onShoot 可留空
- **Progression 解锁**:查 src/progression/Progression.js 的武器解锁机制(isWeaponUnlocked/WEAPON_UNLOCK_PRICE),确保长弓在 loadout 界面默认可选(若机制是"新武器默认锁定需核心解锁",把长弓加入默认解锁或初始可选列表;不要改解锁机制本身,只注册新武器)
- 验证:loadout 能选到长弓并进游戏,switchWeapon 正常

## M2. 新敌人"迅捷猎手"(验证敌人链路最简路径:纯数据,不写模型文件)
- enemyTypes.js 新增:striker:{name:'迅捷猎手',role:'melee',health:60,speed:4.5,damage:12,range:1.1,scale:.88,color:0x53ff8f,accent:0x22c55e,score:1,coinValue:6,anim:{walkSwing:{amplitude:.09,frequency:10}}}
- ENEMY_ORDER 加入 'striker'(heavy 之后),unlockWave 加 striker:6
- 不写模型文件,走通用类人形工厂(验证"只加数据也能出新敌人"),靠 color/scale/anim 区分
- WaveManager 自动进解锁池(ENEMY_ORDER 驱动,已实现,确认即可)
- AudioSystem 音效 profile 若按类型 map,加 striker 条目或确认默认兜底
- 验证:第 6 波后能刷出;击杀正常

## M3. 新地图"边境哨站"(验证地图链路:纯数据大地图,带故事感)
- mapDefs.js 新增 borderPost:{id:'borderPost',name:'边境哨站',desc:'黄沙边境的废弃检查站,东区仓库西区废墟',width:60,length:40,boundsX:30,boundsZ:20,ground:{kind:'ground',size:60,repeat:10},playerSpawn:{x:0,y:1.72,z:8,yaw:0},enemySpawns:6 个(东西两端各 3),objects:40+ 个,decor:适量}
- 布局设计(有区域感,呼应"故事性"):
  - 外围围墙(60x40 四边)+ 南北各 2 个门洞(用墙分段留口)
  - 西区:仓库群(roof+墙,参照基地维修间做法)+ 2 个集装箱
  - 东区:废墟掩体(错落矮墙)+ 1 个可跳上的平台(deck)
  - 中央:检查站小屋(roof+墙+门)+ 沙袋掩体(低矮 wall)
  - 路面:几条 vehicle/shack 材质点缀
- objects 类型复用现有:t wall/roof/container/deck/platform/hull(不用 hull);材质 brick/container/vehicle/shack
- UI 选图:mapDefs def 增加 desc 字段(现有三图也补 desc),UI.js renderLoadout 显示 desc(无 desc 显示 尺寸)
- 验证:new MapGenerator(scene,def) 碰撞准确率 100%;选图界面出现边境哨站;能进图游玩

## M4. 模板文档(核心产出之一)
- 更新 README.md 的"扩展内容"部分,写成完整模板使用指南:
  a. 新增武器:文件结构模板(数据字段表+makeModel+anims+effects+注册步骤),示例引用 longbow.js
  b. 新增敌人:类型条目字段表(必填/可选:model/anim),两条路:纯数据(参考 striker)vs 自定义模型文件(参考 enemyModels/drone.js),注册步骤(ENEMY_ORDER/unlockWave/WaveManager 自动)
  c. 新增地图:mapDefs 条目结构(objects 类型表 t=wall/roof/container/deck/platform/hull + decor 类型表 t=holo/floater/pillar/line/ring + 字段说明),示例引用 borderPost
  d. 新增词条:保留现有说明
- 文档要"codex 拿过去照着写就能加新内容"的粒度(字段名、示例代码块)

## M5. 验证脚本 scripts/verify_template.js(新增)
- 武器:WEAPONS 含 longbow;loadout/switchWeapon 可切换;模型部件>0;anims 配置存在
- 敌人:spawn striker 成功、模型正常(工厂产物)、hit 击杀链路通、金币 6
- 地图:MAP_DEFS 含 borderPost;new MapGenerator 碰撞准确率 100%(200 样本);三张老图仍 100%
- 截图:长弓持枪 812x375、striker 同框(与 assault 对比)、borderPost 俯视+玩家视角,存 artifacts/step5-template/
- 输出 artifacts/step5-template/verification.json
- 回归:verify:maps、verify:systems、verify:view、verify:animations、verify:enemy-models、verify_enemy_rotation 全过

## DoD
M1-M5 完成才允许 build。完成标准:build 成功+verify_template 全过+六个回归脚本全过+README 模板文档完成+三资产截图存在。
