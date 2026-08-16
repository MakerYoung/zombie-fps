# 僵尸围城 · 项目上下文(供 codex 每次开工前阅读,等同于 resume 会话)

## 项目定位
three.js 3D FPS 僵尸 Roguelike,浏览器双端(PC 键鼠+手机触控)。
线上:https://zombie.oblfs.cc.cd | 源码:~/vibeCoding/zombie-fps | 部署:build 后复制 dist 到 /var/www/zombie
规格文档:PROMPT.md(最初任务书)、GDD.md(游戏设计文档)、ARTSTYLE.md(The Finals 美术风格指引)

## 技术栈与铁律
- Vite + three.js,所有依赖 npm 本地打包,严禁 CDN
- 中文注释,模块化(单文件 <300 行),新增武器/词条/敌人/地图元素不改核心逻辑
- PC+手机双端可玩;移动端横屏为主
- 视觉/手感改动必须自己截图+像素差分+CDP 触摸实测验证,禁止"凭代码推断"

## 架构(已实现)
- src/core/:Engine(明亮天空盒/冷白天光/极淡雾)、GameLoop、EventBus、Game(状态机:menu→loadout→playing→choice→dead)
- src/map/:MapGenerator(未来基地 60x60)、TransportShipMap(运输船 96x42)、spawnSafety.js(出生点安全预扫描,防刷进墙)
- src/weapons/:注册表 WEAPONS+WEAPON_CATEGORIES(3类:pistol手枪手炮/auto全自动/shotgun霰弹)+独立武器文件(modelUtils.js 提供 builder/muzzle)
- src/player/:Weapon(通用运行时:切枪动画/换弹分步/后座)、PlayerController(分轴滑墙/灵敏度/后坐力pitch)、Stats(Buffable修饰符)、Health
- src/enemies/:EnemyManager(对象池/队列)、Enemy(近战追踪+5方向避障)、enemyTypes.js
- src/input/:InputManager(语义事件)+PCInput+TouchInput(左摇杆/右屏瞄准/开火跟手/跳跃/切枪按钮)
- src/systems/:ShootingSystem(射线/曳光tracer/弹痕)、AudioSystem(4层枪声/换弹三步/脚步/心跳/环境,25+事件)、WaveManager(波形难度)、ScreenShake、FeedbackSystem
- src/roguelike/:BuffSystem(事件驱动词条)、buffPool.js(32词条)、shopItems.js(卡牌商店商品)
- src/ui/:UI(命运2风HUD+杀戮尖塔卡牌结算+loadout选装+按键布局拖拽自定义)、Radar(命运2圆盘雷达)
- 武器:6把(制式手枪/蝰蛇冲锋枪/雷鸣霰弹枪/黑桃A/赫斯托沃夫/条件终局),3类分组各选1把共3把,默认主手全自动

## 已实现玩法
选图选枪(loadout)→ 波次(波形难度/类型渐进解锁)→ 词条三选一+商店(金币:普通5/跑者8/胖子15/精英25/BOSS100)→ 精英/BOSS(每5波,召唤+狂暴)→ 死亡结算。雷达/命中反馈/震屏/慢动作/切枪动画/无限备弹弹匣制。

## 历史踩坑(重要,避免重犯)
1. 出生点卡墙:玩家/敌人生成点必须在开阔无碰撞处,必须用 collides 校验+预扫描 safeSpawns
2. camera 必须加入 scene,否则挂在 camera 上的枪模不渲染(three.js 只渲染场景图内对象)
3. 雷达敌人位置镜像:敌人世界坐标→玩家相对坐标→按 yaw 旋转→映射圆盘,需纯函数测试(yaw=0 和 π)
4. 移动端按钮遮挡枪模:枪投影要验证(横屏 812x375/667x375),按钮缩小半透明贴边缘
5. 长按按钮复制文字:按钮加 user-select:none/-webkit-touch-callout:none/touch-action:none
6. 蹭墙卡死:分轴碰撞(X/Z 分别检测),不能整块 delta 一次检测
7. 移动中不能切枪/换弹:按钮事件与触摸手势冲突,修好后实测(左手摇杆+右手按钮同时)
8. 武器切枪/换弹动画期间要锁射击防连按
9. 僵尸穿墙:5方向候选(直行/±45°/±90°)逐个检测,全不通原地

## 验证方法
- npm run build 必须成功
- Playwright headless + CDP 触摸(~/.cache/ms-playwright/chromium-1234):触摸移动/开火/切枪断言
- 截图+像素差分(verify_view.js/verify_features.js 等),截图存 artifacts/
- 参考游戏:COD/CS2/战地5/命运2/OW2/The Finals/杀戮尖塔/黑帝斯/和平精英

## 当前待办(用户最新需求,2026-08)
1. 已完成:1:1 复刻 CF 运输船(穿越火线经典地图,货船+集装箱结构)
2. 敌人系统按霓虹协议思路重构:类型丰富(近战/远程分类)、分部件模型+专属音效、AI 差异化
3. 武器模型优化:更像真枪,提高模型精度(参考现实枪型轮廓)
