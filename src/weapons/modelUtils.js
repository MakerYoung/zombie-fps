import * as THREE from 'three';

// 枪模通用积木与程序纹理，所有贴图均本地生成，不依赖外部资源。
export function texture(kind){
  if(typeof document==='undefined'){const t=new THREE.DataTexture(new Uint8Array([150,150,150,255]),1,1);t.needsUpdate=true;return t;}
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');
  const bg={steel:'#8d979d',camo:'#465344',wood:'#774426',ace:'#111318',khvostov:'#556149',icefire:'#176d92'}[kind]||'#555';c.fillStyle=bg;c.fillRect(0,0,256,128);
  if(kind==='ace'){c.strokeStyle='#d9ad3e';c.lineWidth=5;c.strokeRect(7,7,242,114);c.font='bold 76px serif';c.fillStyle='#f1ce62';c.textAlign='center';c.fillText('♠',128,91);}
  else if(kind==='khvostov'){for(let x=0;x<256;x+=32){c.fillStyle=x%64?'#69765a':'#354136';c.fillRect(x,0,22,128);}c.fillStyle='#c5a646';c.fillRect(0,96,256,8);}
  else if(kind==='icefire'){const g=c.createLinearGradient(0,0,256,0);g.addColorStop(0,'#61dcff');g.addColorStop(.48,'#d9f7ff');g.addColorStop(.52,'#ffcf42');g.addColorStop(1,'#ff4d18');c.fillStyle=g;c.fillRect(0,0,256,128);for(let i=0;i<18;i++){c.strokeStyle=i%2?'#fff8':'#192d4c66';c.beginPath();c.moveTo(i*17,0);c.lineTo(i*17-25,128);c.stroke();}}
  else {c.globalAlpha=.28;for(let i=0;i<45;i++){c.fillStyle=i%2?'#fff':'#172126';c.fillRect(Math.random()*256,Math.random()*128,18+Math.random()*30,3+Math.random()*9);}}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
export function builder(){
  const group=new THREE.Group();group.position.set(.25,-.25,-1);group.scale.setScalar(1.05);
  // 适当自发光确保手机低画质（弱阴影）下黑金枪体仍能读出轮廓和贴图。
  const mat=(color,kind=null,metalness=.55,roughness=.38)=>new THREE.MeshStandardMaterial({color,map:kind?texture(kind):null,metalness,roughness,emissive:color,emissiveIntensity:.34});
  group.userData.partCount=0;
  const part=(geometry,material,p,r)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...p);if(r)mesh.rotation.set(...r);mesh.castShadow=true;group.add(mesh);group.userData.partCount++;return mesh;};
  return {group,mat,part};
}
export function muzzle(group,position,color=0xff9b38){const node=new THREE.Object3D();node.position.set(...position);const light=new THREE.PointLight(color,0,4);node.add(light);group.add(node);return {muzzle:node,muzzleLight:light};}
