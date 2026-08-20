import {newYearMapDef} from './NewYearMap.js';
import {newYearSquareMapDef} from './newYearSquareMapDef.js'

const object=(t,x,z,w,h,d,extra={})=>({t,x,z,w,h,d,...extra});

const baseObjects=[
  object('wall',0,-30,60,4,1),object('wall',0,30,60,4,1),
  object('wall',-30,0,1,4,60),object('wall',30,0,1,4,60),
  ...[[-21,-20,11,2.8,3],[-17,-15,3,2.8,9],[-25,-10,8,2.8,3],[-22,-20,6,5.6,3]].map(v=>object('wall',...v,{mat:'container'})),
  ...[[13,-21,1,2.2,12],[21,-16,1,2.2,14],[17,-9,9,1.35,1],[26,-23,5,1.5,2]].map(v=>object('wall',...v)),
  object('roof',-20,18,12,.35,10,{mat:'shack'}),
  ...[[-26,18,1,4,10],[-14,18,1,4,10],[-23,13,6,4,1],[-15.5,13,3,4,1],[-24,23,4,4,1],[-16,23,4,4,1]].map(v=>object('wall',...v,{mat:'shack'})),
  object('roof',19,18,13,.4,10,{mat:'shack'}),
  ...[[12.5,18,1,3.6,10],[25.5,18,1,3.6,10],[16,13,6,3.6,1],[23.5,13,4,3.6,1],[19,23,13,3.6,1]].map(v=>object('wall',...v,{mat:'shack'})),
  object('platform',7,24,7,1.8,7,{mat:'vehicle'}),
  ...[[-6,0,4,1.1,1],[6,0,4,1.1,1],[0,-6,1,1.1,4],[0,6,1,1.1,4]].map(v=>object('wall',...v)),
];

const shipObjects=[
  object('deck',0,0,42,.34,96,{mat:'deck',collide:false,y:-.34}),
  object('hull',0,0,43,1.1,97,{mat:'hull',collide:false,y:-1.35,color:'#40515a'}),
];
for(const z of [-36,-14,14,36])for(const x of [-20.45,20.45])shipObjects.push(object('ledge',x,z,1,1.25,17,{mat:'hull'}));
shipObjects.push(object('ledge',0,-47.35,42,2.4,1.3,{mat:'hull'}),object('ledge',0,47.35,42,2.4,1.3,{mat:'hull'}));
const colors=['#28799b','#c8642d','#3f7b55'];let containerId=1;
for(const side of [-1,1])for(const lane of [8.4,13.2])for(const z of [-25,-17,-9,9,17,25]){
  const color=colors[(containerId+side+3)%3],number=`CF-${String(containerId++).padStart(3,'0')}`;
  shipObjects.push(object('container',side*lane,z,2.6,2.6,6,{mat:'container',color,number,level:0}));
  if((Math.abs(z)===17&&lane===13.2)||(z===-9&&lane===8.4))shipObjects.push(object('container',side*lane,z,2.6,2.6,6,{mat:'container',color:colors[containerId%3],number:`${number}-U`,level:1}));
}
shipObjects.push(
  object('platform',0,0,8,.7,13,{mat:'hull',color:'#28363e'}),
  object('deck',0,0,6,.18,11,{mat:'deck',y:.7,color:'#38474f'}),
);
for(const side of [-1,1])for(const z of [-28,28])shipObjects.push(
  object('platform',side*16.7,z,1.8,.85,2.2,{mat:'hull',color:'#7d563d'}),
  object('platform',side*15.2,z,1.8,1.7,2.2,{mat:'hull',color:'#6b4936'}),
);
for(const z of [-38,38])for(const x of [-8,8])shipObjects.push(object('wall',x,z,7,1.35,1.2,{mat:'hull'}));

const borderPostObjects=[];
// 外墙在南北两侧分段形成四个门洞，东西侧保持连续防线。
for(const z of [-20,20])for(const [x,w] of [[-23,14],[-8,8],[8,8],[23,14]])borderPostObjects.push(object('wall',x,z,w,3.2,1,{mat:'brick'}));
for(const x of [-30,30])borderPostObjects.push(object('wall',x,0,1,3.2,40,{mat:'brick'}));
// 西区两座仓库，开口朝向中央道路。
for(const [cx,cz] of [[-20,-10],[-20,10]]){
  borderPostObjects.push(object('roof',cx,cz,12,.35,8,{mat:'shack'}));
  borderPostObjects.push(object('wall',cx-6,cz,1,3.6,8,{mat:'shack'}));
  borderPostObjects.push(object('wall',cx+6,cz,1,3.6,8,{mat:'shack'}));
  borderPostObjects.push(object('wall',cx,cz+(cz<0?-4:4),12,3.6,1,{mat:'shack'}));
  borderPostObjects.push(object('wall',cx-4,cz+(cz<0?4:-4),4,3.6,1,{mat:'shack'}));
}
borderPostObjects.push(
  object('container',-13,-13,2.6,2.6,6,{mat:'container',color:'#b85c2f',number:'BP-017'}),
  object('container',-14,13,2.6,2.6,6,{mat:'container',color:'#34758c',number:'BP-024',rotation:Math.PI/2}),
);
// 东区由错落矮墙和一座可跳平台组成废墟掩体区。
for(const v of [[15,-14,8,1.3,1],[23,-11,1,1.7,7],[18,-5,6,1.1,1],[26,-2,7,1.5,1],[16,4,1,1.4,7],[23,7,8,1.2,1],[27,13,1,1.6,8],[18,15,9,1.1,1],[11,11,1,1.25,6]])borderPostObjects.push(object('wall',...v,{mat:'brick'}));
borderPostObjects.push(
  object('deck',21,1,6,1.1,5,{mat:'vehicle'}),
  object('platform',17.4,1,1.5,.55,2,{mat:'vehicle'}),
  object('platform',18.7,1,1.5,.82,2,{mat:'vehicle'}),
);
// 中央检查站留出南门，并以低矮沙袋保护两侧道路。
borderPostObjects.push(
  object('roof',0,-2,8,.3,7,{mat:'shack'}),
  object('wall',-4,-2,1,3.2,7,{mat:'shack'}),object('wall',4,-2,1,3.2,7,{mat:'shack'}),
  object('wall',0,-5.5,8,3.2,1,{mat:'shack'}),
  object('wall',-2.7,1.5,2.6,3.2,1,{mat:'shack'}),object('wall',2.7,1.5,2.6,3.2,1,{mat:'shack'}),
  object('wall',-7,5,5,.8,1.2,{mat:'vehicle'}),object('wall',7,5,5,.8,1.2,{mat:'vehicle'}),
  object('wall',-6,-9,1.2,.8,5,{mat:'vehicle'}),object('wall',6,-9,1.2,.8,5,{mat:'vehicle'}),
);
// 车辙、路障与废弃岗亭材料让主路具有长期弃置后的层次。
for(const v of [[-8,16,5,.18,1],[0,14,7,.16,1],[8,16,5,.18,1],[-8,-16,5,.18,1],[0,-14,7,.16,1],[8,-16,5,.18,1]])borderPostObjects.push(object('platform',...v,{mat:'vehicle',collide:false}));
for(const v of [[-10,-2,1,.7,4],[10,-2,1,.7,4],[-11,8,3,.65,1],[11,-8,3,.65,1]])borderPostObjects.push(object('wall',...v,{mat:'shack'}));

export const MAP_DEFS={
  base:{id:'base',name:'未来基地',desc:'霓虹设施与维修间交错的近距竞技场',width:60,length:60,boundsX:30,boundsZ:30,ground:{kind:'ground',size:60,repeat:12},playerSpawn:{x:0,y:1.72,z:9,yaw:0},enemySpawns:[{x:-26,z:-25},{x:26,z:-22},{x:-26,z:22},{x:26,z:25}],objects:baseObjects,decor:[{t:'holo',x:0,y:4.2,z:-27,ry:0},{t:'holo',x:-27,y:3.8,z:4,ry:Math.PI/2},{t:'floater',x:-10,y:5.8,z:-3,kind:'cube'},{t:'floater',x:11,y:6.4,z:2,kind:'ring'},{t:'pillar',x:-9,z:-9,color:'cyan'},{t:'pillar',x:9,z:9,color:'orange'},{t:'pillar',x:-9,z:9,color:'orange'},{t:'pillar',x:9,z:-9,color:'cyan'}]},
  transportShip:{id:'transportShip',name:'运输船',desc:'集装箱堆叠的狭长货轮甲板',width:42,length:96,boundsX:21,boundsZ:48,ground:{kind:'deck',size:96,repeat:1},playerSpawn:{x:0,y:1.72,z:40,yaw:0},enemySpawns:[{x:0,z:-40},{x:-13,z:-41},{x:13,z:-41},{x:-17,z:-31},{x:17,z:-31}],objects:shipObjects,decor:[{t:'line',x:-5.3,y:.012,z:0,len:82},{t:'line',x:5.3,y:.012,z:0,len:82},...[-31,31].flatMap(z=>[-20.1,20.1].map(x=>({t:'ring',x,y:1.65,z,ry:Math.PI/2})))]},
  testmap:{id:'testmap',name:'数据驱动测试场',desc:'验证地图注册与平台碰撞的紧凑试验场',width:15,length:15,boundsX:7.5,boundsZ:7.5,ground:{kind:'ground',size:15,repeat:3},playerSpawn:{x:0,y:1.72,z:0,yaw:0},enemySpawns:[{x:-5,z:-5},{x:5,z:5}],objects:[object('wall',-5,0,1,2.5,5),object('wall',5,0,1,2.5,5),object('wall',0,-5,5,2.5,1),object('deck',0,4,3,.8,3,{mat:'vehicle'})],decor:[]},
  borderPost:{id:'borderPost',name:'边境哨站',desc:'黄沙边境的废弃检查站,东区仓库西区废墟',width:60,length:40,boundsX:30,boundsZ:20,ground:{kind:'ground',size:60,repeat:10},playerSpawn:{x:0,y:1.72,z:8,yaw:0},enemySpawns:[{x:-26,z:-15},{x:-26,z:0},{x:-26,z:15},{x:26,z:-15},{x:26,z:0},{x:26,z:15}],objects:borderPostObjects,decor:[{t:'pillar',x:-11,z:-17,color:'orange'},{t:'pillar',x:11,z:17,color:'cyan'},{t:'floater',x:0,y:5.4,z:-3,kind:'ring'}]},
  [newYearMapDef.id]:newYearMapDef,
  [newYearSquareMapDef.id]:newYearSquareMapDef,
};

export const MAP_IDS=Object.keys(MAP_DEFS);
