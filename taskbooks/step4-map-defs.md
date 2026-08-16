# 任务书 Step4:地图数据化 + 注册表(支持故事性大地图)

## 前置
先读 CONTEXT.md。目标:地图从"硬编码类"变为"数据定义+通用加载器"——新地图只需在注册表加一份数据,游戏自动加载,无需改任何系统代码。这是模板化的最后一块拼图(武器/敌人/地图三资产对齐)。

## 铁律清单
1. 完整实现,禁止省略/TODO/占位
2. 视觉改动必须截图自证(两张图各 2 张:玩家视角+俯视),与改造前截图对比确认视觉一致
3. 禁 CDN、中文注释、单文件 <300 行
4. npm run build 必须成功
5. 跨文件改动全局 grep 确认无断链(删除 TransportShipMap 后,grep 确认零残留:import/Game.js/verify_maps)
6. 回复贴完成清单+验证数据+已知问题

## 现状代码事实
- src/map/MapGenerator.js:base 地图类。constructor(scene) 里 build() 硬编码布局;box(x,z,w,h,d,color,kind,collide,role) 建碰撞体;roof=box 不碰撞;ground=PlaneGeometry;texture()/material() 程序化贴图;collides:边界 |x|>29.5|||z|>29.5 + Box3 列表(y>b.min.y-.2&&y-1.7<b.max.y);playerSpawn={x:0,y:1.72,z:9,yaw:0};enemySpawns 4 个角;build 结尾 addArenaDecor(group,{size,holograms,floaters,pillars});update(time)=animateArena
- src/map/TransportShipMap.js:船地图 96x42。build() 硬编码:deck(0,0,42,.34,96,false,-.34)+hull(0,0,43,1.1,97,false,-1.35) 视觉;8 段舷墙 box(-/+20.45,z,1,1.25,17);船头船尾挡板 box(0,±47.35,42,2.4,1.3);两侧 2 排×6 集装箱 container(side*lane,z,color,number,level=0/1) 与两个第二层;货舱口 box(0,0,8,.7,13)+ 其上 deck(0,0,6,.18,11,true,.7);4 个台阶 box(side*16.7/15.2,±28,1.8,.85/1.7,2.2);出生区低掩体 box(±8,±38,7,1.35,1.2);导向线 2 条(PlaneGeometry 0.16×82,BasicMaterial)+ 救生圈 4 个(Torus);collides:边界 |x|+r>20.5|||z|+r>47.5 + Box3(y>b.min.y-.18&&y-1.7<b.max.y-.03);heightAt(pos,r):从 platforms(Box3.max.y>.25)返回最高可站立面;platforms 由 box() 里 collide&&max.y>.25 收集
- src/core/Game.js:this.maps={base:new MapGenerator(scene),transportShip:new TransportShipMap(scene)};M 键切换
- scripts/verify_maps.js:import 两个类,断言 bounds/出生点/200 样本碰撞准确率 100%
- PlayerController 用 map.heightAt?.(pos) 落地(跳跃上平台,运输船必须保留)

## M1. 新建 src/map/mapDefs.js(地图注册表,核心产出)
导出 MAP_DEFS(每图一条),导出 MAP_IDS。定义结构(字段全部必填,格式如下):
```
{
  id, name,
  width, length,            // 地面尺寸(宽 x 长)
  boundsX, boundsZ,         // 碰撞边界(±)
  ground:{kind:'ground'|'deck', size:60, repeat:12},  // 地面:base 用 ground(Plane),ship 用 deck 甲板纹理
  playerSpawn:{x,y,z,yaw},
  enemySpawns:[{x,z},...],
  objects:[],  // 物体列表,每项 {t,x,z,w,h,d,mat?,y?,color?,number?,level?,rotation?,collide?,role?}
  decor:[]     // 装饰列表,见 M2
}
```
object 类型 t 与构建规则(统一方法,全部进 colliders 或 platforms):
- 'wall':box(x,z,w,h,d,mat,true) 碰撞,role='wall'
- 'roof':box(...collide=false,role='roof') 视觉遮盖不碰撞
- 'container':集装箱(2.6 高;支持 level 堆叠:box(...,y=level*2.6)+platforms;rotation 支持 y 轴旋转后 Box3 重算,参照原 container() 的 setFromObject)
- 'deck':甲板/可站平台 box(...,collide=true),进 colliders+platforms(Box3.max.y>.25 时);ship 的大甲板(collide=false)用 'groundDeck' 或 collide=false 的 deck
- 'hull':船体视觉 box(collide=false,role='hull')
- 'platform':低平台/台阶 box(...,collide=true) 进 platforms(参照 ship 的台阶/货舱口)
- 'ledge':舷墙/挡板 wall 的别名(与 wall 相同,语义区分即可)
对象字段规则:mat 引用现有纹理名(brick/container/vehicle/shack/steel/wood/...),ship 的甲板/集装箱颜色 number 用现有 ship texture 颜色体系
迁移要求:把 MapGenerator.build() 与 TransportShipMap.build() 的**每一行硬编码坐标**原样转成 objects 数据(数量、坐标、尺寸、材质、碰撞标志一一对应,不得增减物体),decor 见 M2。地面/船体视觉层(ground/hull/大甲板)也进数据。

## M2. decor 装饰数据化(保留视觉)
- base 的 addArenaDecor(size,holograms,floaters,pillars) → decor 数组项:{t:'holo',x,z,ry,color?}/{t:'floater',x,z,kind:'cube'|'ring'}/{t:'pillar',x,z,color:'cyan'|'orange'};构建后挂在 group,动画保留(animateArena 需要这些节点的引用,构建时按现有方式打标记)
- ship 的导向线(2 条 PlaneGeometry .16×82,BasicMaterial 0xe8c64b,位置 ±5.3 x,y=.012)+救生圈(4 个 Torus 0.55/.15,color 0xff6938,位置 (±20.1,1.65,±31),ry=π/2)→ {t:'line',x,z,len,ry?}/{t:'ring',x,y,z,ry}
- 构建器提供 makeDecor(map,item) switch 分发;未知类型抛错(防手滑)

## M3. MapGenerator 改造为通用加载器
- constructor(scene, def=MAP_DEFS.base):按 def 构建;保留 texture()/material()/box()/roof()/container()/heightAt() 等能力方法(可内部化)
- collides 统一为:边界 |x|+r > def.boundsX-.5 或 |z|+r > def.boundsZ-.5 → true;Box3 检查 y>b.min.y-.2 && y-1.7<b.max.y(统一 base 公式;若 verify_maps 对 ship 200 样本准确率非 100%,微调公式并说明)
- heightAt(pos,r=.32):遍历 platforms(Box3.max.y>.25),返回最高可站面(参照原 TransportShipMap.heightAt)
- update(time):若 def 有 arena 装饰则 animateArena,否则 no-op
- setActive 保留
- **删除 src/map/TransportShipMap.js**(构建逻辑已由数据+通用加载器覆盖),grep 全项目确认无残留引用

## M4. Game.js 注册表接入 + 验证脚本更新
- Game.js:this.maps 改为遍历 MAP_DEFS 创建:Object.fromEntries(Object.entries(MAP_DEFS).map(([id,def])=>[id,new MapGenerator(this.engine.scene,def)]));删除 TransportShipMap import。以后加新地图只需 mapDefs 加一条
- scripts/verify_maps.js:改为遍历 MAP_DEFS 断言(结构:new MapGenerator(scene,def)),断言项与原来一致:bounds、出生点无碰撞、200 样本碰撞准确率 100%、platforms 收集正确(ship 应 >0)
- scripts/capture_maps.js 无需大改(仍按 ?map=id 截图),确认两张图视觉与改造前一致(对比 artifacts/thefinals-style/ 旧图:玩家视角+俯视,肉眼/像素差分确认无物体增减)
- 新增验证(证明数据驱动):在 mapDefs.js 临时加一张测试图 testmap(15x15,地面+boundsX/boundsZ=7.5+playerSpawn(0,1.72,0)+enemySpawns 2 个+3 个 wall+1 个 deck 平台),verify_maps 断言其加载+碰撞准确率 100%;截图一张存 artifacts/step4-map/testmap.png;**验证通过后保留 testmap 在注册表**(它是"新地图=一份数据"的活样例)
- 回归:verify:systems、verify:view、verify:animations、verify:enemy-models、verify_enemy_rotation 全过

## DoD
M1-M4 完成才允许 build。完成标准:build 成功+verify_maps 遍历所有图(含 testmap)全过+capture_maps 两张图视觉无变化+五个回归脚本全过+TransportShipMap.js 已删除且 grep 零残留。
