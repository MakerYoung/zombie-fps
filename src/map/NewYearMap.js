import * as THREE from 'three';

const object=(t,x,z,w,h,d,extra={})=>({t,x,z,w,h,d,...extra});

const objects=[
  // 80×80 实体边界，与 bounds 保持一致。
  object('wall',0,-40,80,4,.8,{color:0x7f1d1d}),object('wall',0,40,80,4,.8,{color:0x7f1d1d}),
  object('wall',-40,0,.8,4,80,{color:0x7f1d1d}),object('wall',40,0,.8,4,80,{color:0x7f1d1d}),

  // 中央防线拆段留出三条通路，防止视觉门洞与真实碰撞不一致。
  object('wall',-29,0,18,1.5,1.4,{color:0x9a3412}),object('wall',-10,0,12,1.5,1.4,{color:0x9a3412}),
  object('wall',10,0,12,1.5,1.4,{color:0x9a3412}),object('wall',29,0,18,1.5,1.4,{color:0x9a3412}),

  // 红方与蓝方对称掩体群，斜放箱体制造交叉射线与绕行选择。
  ...[[-12,-13,0],[-18,-9,Math.PI/2],[-8,-19,Math.PI/4],[-25,-22,0],[23,-17,-Math.PI/4]].map((v,i)=>object('container',v[0],v[1],3,2.2,3,{color:0xb91c1c,number:`NY-R0${i+1}`,rotation:v[2]})),
  ...[[12,13,0],[18,9,Math.PI/2],[8,19,Math.PI/4],[25,22,0],[-23,17,-Math.PI/4]].map((v,i)=>object('container',v[0],v[1],3,2.2,3,{color:0x1d4ed8,number:`NY-B0${i+1}`,rotation:v[2]})),

  // 两侧中继掩体与可跳平台，外圈依然保留宽阔导航通路。
  object('wall',-28,-8,7,1.1,1.4,{color:0x475569}),object('wall',28,8,7,1.1,1.4,{color:0x475569}),
  object('wall',-28,8,1.4,1.1,7,{color:0x475569}),object('wall',28,-8,1.4,1.1,7,{color:0x475569}),
  object('platform',-7,27,5,1,5,{color:0x7c2d12}),object('platform',7,-27,5,1,5,{color:0x1e3a8a}),
  object('platform',-4,27,1.5,.5,2,{color:0x92400e}),object('platform',4,-27,1.5,.5,2,{color:0x1e40af}),

  // 基地区域地面标识只负责视觉，不阻挡碰撞和导航。
  object('deck',0,-33,14,.06,9,{color:0x991b1b,collide:false,y:.01}),
  object('deck',0,33,14,.06,9,{color:0x1e3a8a,collide:false,y:.01}),
  object('deck',0,0,3,.035,58,{color:0x7f1d1d,collide:false,y:.012}),
];

function addFestivalDecor(group){
  const red=new THREE.MeshStandardMaterial({color:0xc81e1e,roughness:.35,metalness:.18,emissive:0x5a0808,emissiveIntensity:.45});
  const gold=new THREE.MeshStandardMaterial({color:0xf6c453,roughness:.28,metalness:.72,emissive:0x6b3c00,emissiveIntensity:.55});
  const dark=new THREE.MeshStandardMaterial({color:0x3f1515,roughness:.5,metalness:.2});
  const lanterns=[];
  // 三座红金门架标识主通路，全部是纯视觉层。
  for(const x of [-18,0,18]){
    for(const side of [-1,1]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,4.8,10),red);pole.position.set(x+side*1.7,2.4,.05);group.add(pole);}
    const beam=new THREE.Mesh(new THREE.BoxGeometry(4.2,.32,.42),gold);beam.position.set(x,4.55,.05);group.add(beam);
    const plaque=new THREE.Mesh(new THREE.BoxGeometry(1.7,.65,.18),dark);plaque.position.set(x,4.05,-.08);group.add(plaque);
  }
  // 两条灯笼带贯穿红蓝基地，给远距离移动提供视觉方向感。
  for(const z of [-25,25])for(let x=-15;x<=15;x+=5){
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.34,10,7),red.clone());lamp.scale.y=1.28;lamp.position.set(x,5,z);lamp.material.emissiveIntensity=1.6;group.add(lamp);lanterns.push({mesh:lamp,phase:(x+z)*.17});
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.12,8),gold);cap.position.set(x,5.42,z);group.add(cap);
  }
  // 红蓝基地旗帜。
  for(const [z,color] of [[-34,0xdc2626],[34,0x2563eb]]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,4,8),gold);pole.position.set(-5,2,z);group.add(pole);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.25),new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:.5}));flag.position.set(-3.8,3.15,z);group.add(flag);
  }
  return time=>lanterns.forEach(({mesh,phase})=>{mesh.position.y=5+Math.sin(time*2+phase)*.08;});
}

export const newYearMapDef={
  id:'newYear',name:'新春演武场',desc:'红蓝对称的新春竞技场，三路交锋与外圈迂回并存',
  width:80,length:80,boundsX:40,boundsZ:40,
  ground:{kind:'ground',size:80,repeat:14},
  playerSpawn:{x:0,y:1.72,z:33,yaw:0},
  enemySpawns:[{x:0,z:-33},{x:-32,z:-30},{x:32,z:-30},{x:-35,z:8},{x:35,z:-8}],
  objects,
  decor:[
    {t:'holo',x:0,y:6,z:-37.5,ry:0},{t:'floater',x:0,y:7,z:0,kind:'ring'},
    {t:'pillar',x:-34,z:-34,color:'orange'},{t:'pillar',x:34,z:34,color:'cyan'},
    {t:'line',x:-18,y:.012,z:0,len:70},{t:'line',x:18,y:.012,z:0,len:70},
  ],
  material({kind,color}){
    if(!color)return null;return new THREE.MeshStandardMaterial({color,roughness:kind==='container'?.52:.66,metalness:kind==='container'?.28:.12});
  },
  decorate:addFestivalDecor,
};
