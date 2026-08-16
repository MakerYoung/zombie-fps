import * as THREE from 'three';

// 两张地图共用的程序化竞技场材质，全部由 CanvasTexture 生成，不依赖外部图片。
export function arenaTexture(kind, palette='base'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  const sand=palette==='sand';
  if(kind==='concrete'||kind==='ground'){
    c.fillStyle=sand?(kind==='ground'?'#d6b36d':'#dfbd7d'):(kind==='ground'?'#d3dade':'#e5e9ea');c.fillRect(0,0,256,256);
    // 细腻颗粒与稀疏污渍让清水混凝土保有质感，但不显得破败。
    let seed=sand?731:419;for(let i=0;i<780;i++){seed=(seed*16807)%2147483647;const x=seed%256;seed=(seed*16807)%2147483647;const y=seed%256;const a=.018+(seed%9)/500;c.fillStyle=sand?`rgba(105,75,38,${a})`:`rgba(48,67,75,${a})`;c.fillRect(x,y,1+(seed%2),1+(seed%2));}
    if(kind==='ground'){c.strokeStyle=sand?'rgba(255,244,211,.34)':'rgba(255,255,255,.5)';c.lineWidth=1;for(let n=0;n<=256;n+=64){c.beginPath();c.moveTo(n,0);c.lineTo(n,256);c.stroke();c.beginPath();c.moveTo(0,n);c.lineTo(256,n);c.stroke();}}
    else{c.fillStyle='rgba(95,110,112,.045)';c.fillRect(0,184,256,10);c.fillRect(42,0,7,256);}
  }else if(kind==='glass'){
    // 深蓝灰渐变用窄色带近似，窗框网格与高光保证远处仍能读出幕墙结构。
    const colors=['#172f41','#1c3a50','#244b61','#2a566c','#315f74','#294f64','#203f54','#193347'];for(let y=0;y<256;y+=32){c.fillStyle=colors[y/32];c.fillRect(0,y,256,32);}
    c.strokeStyle='rgba(167,225,244,.72)';c.lineWidth=4;for(let n=0;n<=256;n+=64){c.beginPath();c.moveTo(n,0);c.lineTo(n,256);c.stroke();c.beginPath();c.moveTo(0,n);c.lineTo(256,n);c.stroke();}
    c.fillStyle='rgba(255,255,255,.28)';c.fillRect(9,0,5,256);c.fillRect(0,14,256,3);
  }else if(kind==='stripe'){
    c.fillStyle='#112d3d';c.fillRect(0,0,256,256);c.fillStyle='#28cfff';c.fillRect(0,52,256,38);c.fillStyle='#d9f9ff';c.fillRect(0,60,256,7);c.fillStyle='#ff7b42';c.fillRect(0,166,256,34);c.fillStyle='#fff0e8';c.fillRect(0,172,256,6);
  }else if(kind==='holo'){
    c.fillStyle='rgba(7,30,45,.78)';c.fillRect(0,0,256,256);c.strokeStyle='#28cfff';c.lineWidth=7;c.strokeRect(8,8,240,240);c.fillStyle='#ff7b42';c.fillRect(24,30,52,8);c.fillStyle='#dffaff';c.font='bold 46px sans-serif';c.textAlign='center';c.fillText(palette==='sand'?'ARENA 02':'THE FINALS',128,125);c.font='bold 20px sans-serif';c.fillStyle='#28cfff';c.fillText('VIRTUAL COMBAT',128,166);c.fillStyle='#ff7b42';c.fillRect(48,192,160,6);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}

export function arenaMaterial(kind,w=5,h=3,palette='base'){
  const map=arenaTexture(kind,palette);map.repeat.set(Math.max(1,w/5),Math.max(1,h/3));
  if(kind==='glass')return new THREE.MeshStandardMaterial({map,color:0xffffff,roughness:.2,metalness:.48,emissive:0x102c3b,emissiveIntensity:.35});
  if(kind==='stripe')return new THREE.MeshStandardMaterial({map,roughness:.24,metalness:.3,emissive:0x126a78,emissiveIntensity:1.1});
  return new THREE.MeshStandardMaterial({map,color:palette==='sand'?0xf0d6a0:0xf5f7f7,roughness:kind==='ground'?.4:.5,metalness:kind==='ground'?.17:.06});
}

// 广告、灯柱与悬浮几何是纯视觉层，不加入地图碰撞体。
export function addArenaDecor(group,{size,palette='base',holograms=[],floaters=[],pillars=[]}){
  const cyan=new THREE.MeshStandardMaterial({color:0x76e7ff,emissive:0x28cfff,emissiveIntensity:4.2,roughness:.16,metalness:.35});
  const orange=new THREE.MeshStandardMaterial({color:0xffa071,emissive:0xff7b42,emissiveIntensity:3.6,roughness:.18,metalness:.25});
  for(const [x,y,z,ry=0] of holograms){const tex=arenaTexture('holo',palette);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(7.5,3.2),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.94,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));mesh.position.set(x,y,z);mesh.rotation.y=ry;group.add(mesh);}
  for(const [x,y,z,type='cube'] of floaters){const geo=type==='ring'?new THREE.TorusGeometry(1.15,.18,10,24):new THREE.BoxGeometry(1.35,1.35,1.35);const mesh=new THREE.Mesh(geo,type==='ring'?orange:cyan);mesh.position.set(x,y,z);mesh.rotation.set(.5,.35,.15);mesh.userData.floater=true;mesh.userData.phase=(x+z)*.17;mesh.castShadow=true;group.add(mesh);}
  for(const [x,z,color='cyan'] of pillars){const mat=color==='orange'?orange:cyan;const body=new THREE.Mesh(new THREE.CylinderGeometry(.19,.28,5.4,12),mat);body.position.set(x,2.7,z);group.add(body);const light=new THREE.PointLight(color==='orange'?0xff7b42:0x28cfff,2.8,11);light.position.set(x,3.4,z);group.add(light);}
  // 低多边形天际线位于可玩区域外，只提供远景纵深。
  const skyline=new THREE.Group();skyline.name='ArenaSkyline';const skylineMat=new THREE.MeshStandardMaterial({color:palette==='sand'?0x846f62:0x526878,roughness:.82,metalness:.08});
  for(let i=0;i<30;i++){const angle=i/30*Math.PI*2;const radius=size*.83+(i%3)*2;const w=3+(i%4)*1.2,h=10+(i*7%17),d=3+(i%3);const tower=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),skylineMat);tower.position.set(Math.cos(angle)*radius,h/2-1,Math.sin(angle)*radius);tower.rotation.y=-angle;tower.receiveShadow=true;skyline.add(tower);}
  group.add(skyline);
}

export function animateArena(group,time){
  group.traverse(o=>{if(!o.userData.floater)return;o.rotation.y=time*.42+o.userData.phase;o.rotation.x=.42+Math.sin(time*.55+o.userData.phase)*.18;o.position.y+=Math.sin(time*1.05+o.userData.phase)*.0018;});
}
