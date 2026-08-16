# 任务书 Step2:持枪视角重做(CS2 风格)+ 后坐力机制修正 + 转身摆枪加大

## 前置
先完整阅读 CONTEXT.md、taskbooks/step1-animations.md(上一步已实现动画槽位系统)。用户实测反馈三个问题,本次全部修复。铁律:不动武器数据字段(damage/fireRate/magazine 等)、不动其他系统逻辑(波次/词条/敌人/地图)。

## 用户反馈(原始)
1. 转身摆枪幅度过小
2. 持枪视角不好:武器完全暴露在相机里面,完全浮空,要像 CS2 一样"沉静"的第一人称持枪视角
3. 后坐力机制:现在开枪后准心往上抬,但动的是准心相对屏幕本身,视角没抬。要求:准星相对屏幕只有微小的晃动,同时整个视角(camera)往上抬一小部分,模拟后坐力。准心扩散保留

## 铁律清单
1. 完整实现,禁止省略/TODO/占位
2. 视觉改动必须自己截图验证(横屏 812x375 是用户真实游玩方向,必测;PC 1280x720 次之),禁止"凭代码推断"
3. 禁 CDN、中文注释、单文件 <300 行
4. npm run build 必须成功
5. 跨文件改动全局 grep 确认无断链
6. 回复末尾贴完成清单+每模块验证数据+已知问题

## 现状代码事实
- src/weapons/animations.js:defaultAnims 的 moveSway 默认 maxPosition=.012、maxRotation=.02、rateScale=.004、decay=6
- src/player/PlayerController.js:bus.on('weapon:shoot') 累积 pitchOffset,踢值 {pistol:.004,smg:.003,shotgun:.011} 兜底 .004,上限 .025,恢复 exp(-dt/.115);第 9 行准星 #crosshair 的 --kick 设为 -min(18, pitchOffset*2400)px,即准星 UI 最多上抬 18px
- src/ui/UI.js:crosshair 由 4 个 i 元素组成,--gap 控制扩散,--kick 控制上抬
- src/weapons/modelUtils.js:builder() 默认 group.position=(.25,-.25,-1);各武器 makeModel 里再设 position(如 pistol=(.25,-.24,-.95))
- src/weapons/animations.js:idle 默认 amplitude=.004、frequency=.008
- scripts/verify_view.js:投影断言 cx 55-67%、cy 63-73%,枪口不重叠按钮

## M1. 转身摆枪加大(改 animations.js 默认值)
- moveSway 默认改为:maxPosition=.03、maxRotation=.045、rateScale=.004、decay=4
- 效果要求:快速甩视角时枪械明显反摆,停止后约 1.5s 内平滑回正;缓慢转动时几乎不可见
- 若按此参数截图后仍不明显,可继续加大 maxPosition 至 .04,自行判断,以"明显但不夸张"为准
- 更新 scripts/verify_animations.js 的 moveSway 断言:峰值期望改为新 maxPosition(0.03),恢复阈值保持

## M2. 后坐力机制修正(准星晃动 + 视角上抬)
- 相机视角后坐(主):PlayerController.js 的 kick 值放大(约 2 倍):pistol .008、smg .006、shotgun .02、兜底 .008;pitchOffset 上限 .025→.04;恢复速率保持 exp(-dt/.115)
- 准星晃动(次):UI.js/PlayerController 改造——开枪时 #crosshair 不再大幅上抬,改为微小随机晃动:每次 weapon:shoot 时设置随机偏移(水平 ±3px、垂直 -1~-4px,即微上+微横),然后约 0.12s 内回中。--kick 的 18px 上抬逻辑移除(可保留 CSS 变量但值改为晃动偏移,幅度上限 5px)
- 准星扩散逻辑(--gap)完全不动
- 验证要求:verify_view.js 的"射击模拟"断言同步更新:首帧 pitch 上抬量应为原值 2 倍左右;新增断言准星晃动幅度 ≤5px 且 0.2s 内回中
- 手机与 PC 行为一致

## M3. 持枪视角重做(CS2 沉静风格,本次核心)
目标:枪械有持握感、沉稳、不浮空。CS2 特征:能看到小臂和手从画面下缘伸入持握枪身,枪体偏低偏稳,静止时几乎无浮动,枪口朝向画面中央偏右。
- src/weapons/modelUtils.js 新增手臂生成:export function arm(group,{side='right'}={})——程序化构建小臂(圆柱或拉伸盒,长 .2-.24、半径 .04-.05,深色布料材质)+ 手(略扁椭球/盒,肤色或手套深色),从 group 底部(画面下缘方向)伸向枪身握把位置;手臂材质用现有 texture() 支持的颜色(如深色 'camo' 或新加 'sleeve' 深蓝/黑);手臂随 group 一起运动(挂在同一 group 下),不遮挡准星区域(屏幕中心 ±12% 范围)
- 所有 6 把枪:group.position 整体调低调近:参考起始值 y 从 -0.24 系列降到 -0.32~-0.34,z 从 -0.9~-1.0 收至 -0.75~-0.85(枪离眼睛更近一点、更低,产生"端在手里"的沉稳感);x 保持或微调(+0.22~+0.28)。每把枪按自身结构微调,以截图效果为准
- idle 动画更沉静:animations.js 默认 amplitude .004→.002(呼吸感更弱),frequency 保持
- 手臂必须与握把位置衔接自然,不得穿模(枪身穿过手/手臂),截图放大检查
- 验收标准(截图为准,812x375 横屏):a. 枪不再浮空,视觉上"由手臂端着";b. 枪整体在画面右下区域,不遮准星;c. 静止时枪体稳定,几乎无呼吸浮动;d. 枪口方向朝画面中央偏右

## M4. 验证与回归
- scripts/verify_view.js:因枪位置调整,投影断言范围重新标定(以新截图像素为准,给出新的 cx/cy 范围,保持"不与按钮重叠"约束);同时同步 M2 的射击模拟断言
- scripts/verify_animations.js:同步 moveSway 峰值与 idle 幅度断言
- 截图:每把枪 812x375 横屏待机图 + 开火瞬间图(验证后坐),存 artifacts/step2-view/;另存 1280x720 一张全景确认整体布局
- npm run verify:systems 无回归
- 输出 artifacts/step2-view/verification.json:各断言 pass/fail+数值+截图路径

## DoD
M1-M4 全部完成才允许 build,中途不许停下来问;视觉细节无法确定时按 CS2 风格常识决定并在"已知问题"注明。完成标准:build 成功+verify_animations/verify_view/verify:systems 全过+812x375 截图上枪械有手臂且不浮空。
