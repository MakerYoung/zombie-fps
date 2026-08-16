# 任务书 Step3-Fix:敌人上下翻转 bug(欧拉角表示问题)

## 前置
先读 CONTEXT.md。这是紧急 bug 修复:用户反馈基地地图普通僵尸"只有脚底板,身体没渲染,在地面另一边走"。**根因已由我完全定位,按本任务书精确修复,不要另辟蹊径。**

## 根因(已确认,勿改方向)
- three.js r185 的 Object3D.lookAt(非 Camera)让物体 **+z 轴指向目标**(源码:_m1.lookAt(_target,_position,up))
- 敌人追玩家时,玩家常在敌人 -z 方向 → lookAt 产生 Ry(π) 旋转
- **Ry(π) 的欧拉角等价表示是 (π, 0, π)**(three.js Euler.setFromQuaternion 对 Ry(π) 输出 x=π,z=π,已实测)
- src/enemies/Enemy.js applyAnimation 里 `this.group.rotation.z=moving&&this.walkParts.length?Math.sin(phase)*walk.amplitude:0` 直接覆盖欧拉 z:欧拉从 (π,0,π) 变成 (π,0,±0.05),等于 Rx(π)·Rz(±0.05) → **模型绕 x 翻转 180°,身体翻到地下,只有脚贴近地面**
- 触发条件:玩家在敌人正 -z 方向(敌人正面朝玩家走来,玩家站桩时持续触发)
- 旧代码不碰 group.rotation(只摆 parts 腿部),故 Step3 之前无此 bug

## 铁律清单
1. 只修本 bug,禁止改动其他逻辑(数值/波次/地图/武器)
2. 修复后必须 headless 实测复现场景,输出数据
3. 禁 CDN、中文注释
4. npm run build 必须成功
5. 回复贴完成清单+验证数据+已知问题

## M1. 修复 Enemy.js(核心)
- src/enemies/Enemy.js applyAnimation:删除 `this.group.rotation.z=...` 覆盖写法,改为四元数旋转:
  - 模块级常量:`const SWAY_AXIS=new THREE.Vector3(0,0,1);`(文件顶部,不每帧 new)
  - 在 applyAnimation 内(在 lookAt 之后调用,lookAt 每帧重置 quaternion 所以不会累积):
    ```
    const sway=moving&&this.walkParts.length?Math.sin(phase)*walk.amplitude:0;
    if(sway!==0)this.group.rotateOnAxis(SWAY_AXIS,sway);
    ```
  - rotateOnAxis 直接对 quaternion 做局部 z 轴旋转,不经过欧拉角,彻底规避表示跳变
- 检查 Enemy.js 其他 group.rotation 直写点:die() 的 rotation.x=-π/2 与 420ms 后 rotation.set(0,0,0) 是明确赋值(躺倒/复位),保持不动;spawn() 的 rotation.set(0,0,0) 保持不动
- **全局 grep 检查其他文件是否有同类隐患**:搜索 `rotation.z=`、`rotation.x=` 对 group 的直接覆盖(武器 animations.js 的 applyPose 对 weapon group 的 rot 增量是安全的小角度叠加,但请确认 Weapon 的 group 不会出现 ±π 表示;若有风险,说明理由,不要擅自大改)

## M2. 验证脚本 scripts/verify_enemy_rotation.js(新增)
本地 vite preview 4174,打开 ?verify&map=base
- 场景1(核心复现场景):g.start 后 spawn 一只 assault 在 {x:0,z:12}(玩家出生点 z=9,玩家在敌人 -z 方向,敌人面向玩家),跑 120 帧(每帧先 scene.updateMatrixWorld(true) 再 enemies.update,再 updateMatrixWorld,模拟真实渲染);断言:
  a. 每帧 e.group.rotation.x 绝对值 < 1(欧拉不再卡在 ±π)
  b. 每帧模型所有 mesh 的 matrixWorld.elements[13](世界 y)最小值 >= -0.05(不穿地)
- 场景2(玩家在敌人 +z 方向,控制组):spawn assault 在 {x:0,z:-12},跑 60 帧,同样断言
- 场景3(移动中):玩家站桩,敌人从 4 个方向各 spawn 2 只,跑 300 帧,全程断言旋转 x 与不穿地
- 截图:场景1 第 60 帧整屏 812x375,存 artifacts/step3-fix/flip-fix.png(应看到僵尸正常站立,身体/头完整)
- 输出 artifacts/step3-fix/verification.json:各场景断言 pass/fail+实测数值(最大|rotation.x|、最小部件y)
- 回归:verify:enemy-models、verify:systems、verify:view、verify:animations 全过

## DoD
M1-M2 完成才允许 build。完成标准:build 成功 + verify_enemy_rotation 三场景全过 + 四个旧脚本无回归 + 截图上僵尸身体完整站立。
