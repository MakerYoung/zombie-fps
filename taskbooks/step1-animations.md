# 任务书 Step1:武器动画系统抽象(模板化第一刀)

## 前置
先完整阅读 CONTEXT.md 和 GDD.md。本次改造是"模板化"工程的第一步,目标:把 Weapon.js 里硬编码的第一人称动画公式抽象成"每把武器可配置的动画系统",并新增转身摆动。铁律:现有手感数值必须等价,不得改变任何武器数据字段,不得动其他系统。

## 铁律清单
1. 完整实现,禁止省略/TODO/占位/简化
2. 每模块完成必须 headless 实测并输出数据,禁止"凭代码推断没问题"
3. 禁 CDN、中文注释、单文件 <300 行
4. npm run build 必须成功
5. 跨文件改动必须全局 grep 确认无断链
6. 回复末尾贴"完成清单(逐项勾选)+每模块验证数据+已知问题"

## 背景(现状代码事实)
src/player/Weapon.js 的 update() 内硬编码了所有动画公式:
- 开火后坐:kick=data.recoil*0.48;returnTime=0.11+data.recoil*0.7;t=fireTime/returnTime;k=t<.18?t/.18:Math.exp(-(t-.18)*4.8)*Math.cos((t-.18)*Math.PI*2.2);p.z+=kick*k;r.x+=data.recoil*k
- 待机浮动:p.y+=Math.sin(performance.now()*0.008)*0.004
- 换弹:p.y-=0.075*s;r.z-=0.42*s(s=sin(pi*t));并emit reloadStage 事件 remove/insert/chamber
- 切枪:beginSwitch/updateSwitch,CS2 风格交错(旧枪下沉+新枪上抬,三次缓动曲线,持续 0.25s)
这些公式就是"默认动画",必须被动画系统原样复现。

## M1. 新建 src/weapons/animations.js(动画系统核心,<300行)
- export function defaultAnims():返回默认动画配置对象
- 动画槽位设计:每个槽位是一个函数 (ctx)=>poseDelta,其中 poseDelta={pos:[x,y,z],rot:[x,y,z],scale:[x,y,z]},各槽位输出后相加到 restPosition/restRotation/restScale
- 槽位集合:
  a. recoil(ctx):复现上述开火后坐公式,输入 ctx.fireTime/ctx.returnTime,输出 pos.z 与 rot.x 偏移
  b. idle(ctx):复现待机浮动,幅度/频率可从配置覆盖
  c. reload(ctx):复现换弹公式,同时保留 reloadStage 事件发射(事件仍在 Weapon 层发,见 M2)
  d. switch(ctx):复现 beginSwitch/updateSwitch 的 in/out 曲线(位置/旋转/缩放三次缓动)
  e. moveSway(ctx):新增转身摆动(见下)
- 姿态混合:export function applyPose(group,rest,pose):group.position=rest.pos+sum(pos),rotation/scale 同理。开关锁(switchLocked)期间只应用 switch 槽位,与现状一致
- moveSway 设计(新功能):第一人称惯性摆枪。输入:视角转向速率(rad/s,由 Weapon 层计算传入),输出:枪械反方向位置偏移与轻微旋转。默认参数:最大位置偏移 0.012、最大旋转 0.02rad,偏移量=clamp(速率*0.004,0,最大),视角停止后指数衰减(衰减系数每秒 6)。方向:视角左转(yaw 增大),枪向右摆(x 偏移取反),并带轻微 rot.z 倾斜
- 所有数值必须与现状公式精确等价(除 moveSway 是新增)

## M2. 重构 src/player/Weapon.js
- 构造函数:this.anims=data.anims||defaultAnims();保持 restPosition/restRotation/restScale 逻辑
- update(dt,fire) 改为:计算当前各槽位状态(recoil 用 fireTime、reload 用 reloading、switch 用 switchAnimation、moveSway 用视角速率),调用 animations.js 的槽位函数与 applyPose 应用姿态;开关锁期间只应用 switch
- 视角速率:从 this.camera.rotation.y 与上一帧差值计算(自存 lastYaw),或从 input.state.look 读取,选最干净的方式并在注释说明
- 保留全部对外接口与行为:tryShoot 的判定顺序、reload 的 memoryReady 分支、finishReload、capacity、beginSwitch/updateSwitch 的 lock 语义、reloadStage/weapon:reload/weapon:reloaded/weapon:shoot 事件、dispose
- 禁止改动:弹药/伤害/射速逻辑、PlayerController、ShootingSystem

## M3. 6 把武器文件添加 anims 差异化(差异化覆盖默认,数值必须基于现有字段推导,不得改 recoil/damage/fireRate 等数据字段)
- pistol(制式手枪):轻快,recoil 保持默认推导;idle 幅度略小(0.003);moveSway 幅度略大(敏捷感)
- smg(蝰蛇冲锋枪):recoil 默认;idle 频率略快;reload 保持默认
- shotgun(雷鸣霰弹枪):重武器感,recoil 保持默认推导(其 data.recoil 已大);idle 幅度略大(0.005);reload 下沉幅度可略增(0.09)
- aceOfSpades(黑桃A):精致感,idle 幅度小(0.003);moveSway 略小(沉稳)
- khvostov(赫斯托沃夫):默认
- conditionalFinality(条件终局):默认
每把枪的 anims 只需写差异字段,继承默认。改动仅限各自武器文件,不得动 weaponData.js 的数值字段。

## M4. 验证脚本 scripts/verify_animations.js(Playwright,风格对齐现有 verify_batch*.js)
本地起 npx vite preview --port 4174 后测试 http://localhost:4174/?verify&map=base
- 断言1 开火后坐:进入游戏后调用 window.__verifyGame.weapon 触发开火(fireTime=0 或走 tryShoot),0.05s 后 group.position.z 相对 rest 出现负偏移(后退),0.6s 后恢复至 rest 误差<1e-4
- 断言2 换弹阶段:weapon.reload() 后收集 reloadStage 事件,顺序为 remove→insert→chamber
- 断言3 切枪:game.switchWeapon 切换,0.4s 后新主手 group 回到 rest,误差<1e-4
- 断言4 转身摆动:直接修改 camera.rotation.y 连续 5 帧各 +0.05(模拟快速转身),期间 group.position.x 出现非零偏移,停止后 1s 内回落<1e-4
- 断言5 截图:待机/开火瞬间/换弹中/切枪中 四张,812x375 横屏与 1280x720 各一套,存 artifacts/step1-anim/
- 输出 artifacts/step1-anim/verification.json:{断言1..4 pass/fail+实测数值,截图路径列表}
- 同时跑 npm run verify:systems 和 verify:view 确认无回归

## DoD
M1-M4 全部完成才允许 build,中途不许停下来问;无法决定的设计细节按常识决定并在"已知问题"注明。完成标准:build 成功 + verify_animations 四项断言全过 + 两个旧验证脚本无回归 + 截图存在。
