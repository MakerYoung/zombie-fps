# 任务书 Step3:敌人模型文件化(与武器模块对齐)+ 示例新敌人

## 前置
先完整阅读 CONTEXT.md、taskbooks/step1-animations.md、step2-view-feedback.md。目标:敌人系统对齐武器模块的"一个资产一个文件"模式——每个敌人类型可声明自己的模型文件(可选),不填走通用工厂;动画参数可配置。并新增一个完全自定义模型的示例敌人验证全流程。

## 铁律清单
1. 完整实现,禁止省略/TODO/占位
2. 视觉改动必须自己截图验证(812x375 横屏必测),禁止"凭代码推断"
3. 禁 CDN、中文注释、单文件 <300 行
4. npm run build 必须成功
5. 跨文件改动全局 grep 确认无断链(新类型要检查 Game.js/EnemyManager/WaveManager/AudioSystem/UI 里的引用点)
6. 回复末尾贴完成清单+验证数据+已知问题
7. 不破坏现有 7 种敌人的行为(数值、AI、音效、外观),只允许新增

## 现状代码事实
- src/enemies/enemyTypes.js:ENEMY_TYPES 纯数据表(assault/heavy/exploder/shooter/rocketeer/sniper/boss),ENEMY_ORDER 顺序表,unlockWave 解锁波
- src/enemies/Enemy.js 第 7 行:reset 时调用 createEnemyModel(typeId,type,this) 生成模型,模型挂在 this.group;group.scale 用 def.scale
- src/enemies/enemyModelFactory.js:createEnemyModel(type,def,owner) 通用类人形工厂(头/躯干/四肢+按类型挂装备),返回 {group,parts};parts 每个 mesh 有 userData.enemy=owner 和 baseEmissive(受击闪烁机制)
- 敌人移动只动 group.position 的 x/z;projectile 类敌人走 EnemyProjectileSystem(已有)

## M1. 敌人模型加载器改造(核心机制)
- enemyTypes.js:每个类型条目可选新增 model 字段(值为函数,签名 (def, owner) => {group, parts}),不填为 undefined
- Enemy.js:reset 时改为 this.model=def.model?def.model(def,this):createEnemyModel(typeId,def,this);this.group.add(this.model.group);this.parts=this.model.parts。现有受击闪烁/击杀粒子对 parts 的依赖保持不变
- 保证对象池复用不受影响(同类型敌人池内复用同一个 def,模型每次 reset 重新生成,与现在一致)

## M2. 敌人动画参数化(轻量)
- enemyTypes.js 每个类型可选 anim 字段,默认 {walkSwing:{amplitude:.05,frequency:8}, float:{amplitude:0,frequency:0}}
- Enemy.js update 内:类人形敌人(有腿)应用 walkSwing——行走时 group 左右微摆(幅度/频率取 def.anim.walkSwing);def.anim.float.amplitude>0 时(悬浮类)应用上下浮动,位置 y=基础悬浮高度+sin(now*frequency)*amplitude
- 现有敌人若此前没有行走动画,统一加 walkSwing(默认值以上述为准,幅度小、不夸张);悬浮类(新敌人)用 float
- 禁止改动敌人移动速度/路径/攻击逻辑,只加视觉动画层

## M3. 示例新敌人"悬浮哨兵"(drone,完全自定义模型,验证全流程)
- 新增文件 src/enemies/enemyModels/drone.js:export function droneModel(def,owner)——完全自定义模型构建,返回 {group,parts}。设计:悬浮核心(发光球/八面体)+ 环绕旋转环(torus,2 个交叉)+ 前后双炮管(圆柱)+ 底部喷口;整体不落地,悬浮于地面约 1.2-1.4 高度(模型内 y 偏移实现);发光用 emissive(参照 enemyModelFactory 的 glow 材质做法,emissiveIntensity 高);配色 cyan 系;parts 同样设置 userData.enemy=owner 和 baseEmissive
- enemyTypes.js 注册:drone: { name:'悬浮哨兵', role:'ranged', health:90, speed:2.4, damage:13, range:20, preferred:14, projectile:'bullet', projectileSpeed:14, burst:2, scale:1, color:0x00e5ff, accent:0xffd65a, score:2, coinValue:9, model:droneModel, anim:{float:{amplitude:.16,frequency:2.2}} }
- ENEMY_ORDER 加入 'drone' 合适位置(如 exploder 之后);unlockWave 加 drone:7(第 7 波解锁)
- WaveManager 的 planWave 里小/大波混合时能出现 drone(参考现有 extras 循环逻辑,新类型会自动进入解锁池;若 planWave 有硬编码类型名单,检查确认 drone 在 wave>=7 后进入)
- 检查 AudioSystem 的敌人类型引用:若 enemy:move/enemy:attackSound 有按类型分音效的 map,drone 可复用默认或加专属轻量音效(按常识,悬浮体可配高频嗡鸣,没有现成素材就用默认)

## M4. 验证脚本 scripts/verify_enemy_models.js
本地 vite preview 4174,打开 ?verify&map=base
- 断言1 默认模型不回归:spawn 一只 assault,断言 group.children 数量>0 且模型含 head/body 部件名(工厂产物)
- 断言2 自定义模型加载:spawn 一只 drone,断言 model 是 droneModel 产物(如 group.userData.modelType==='drone' 或特定部件名存在,任选可靠判断)
- 断言3 动画:drone 连续 update 若干帧,断言 group.position.y 随时间变化(浮动生效);assault 移动时断言 rotation 或 position 出现 walkSwing 摆动
- 断言4 击杀链路:对 drone 调 hit() 至死亡,断言 enemy:killed 事件发出、金币结算(coinValue 9)
- 断言5 截图:场景中同时存在 assault+drone 各一只的 812x375 横屏图,存 artifacts/step3-enemy/;drone 特写放大图一张
- 输出 artifacts/step3-enemy/verification.json:各断言 pass/fail+数值+截图路径
- 回归:verify:systems、verify:view、verify:animations 全过

## DoD
M1-M4 全部完成才允许 build,中途不许停下来问;设计细节按常识决定并在"已知问题"注明。完成标准:build 成功+新验证脚本全过+三个旧脚本无回归+截图上 drone 悬浮且外观与类人形敌人明显不同。
