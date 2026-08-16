import * as THREE from 'three';
import {buildSafeSpawns,randomSafeSpawn} from './spawnSafety.js';

// 运输船采用 96×42 单位长方形甲板，X 为船宽、Z 为船长。
export class TransportShipMap {
  constructor(scene){
    this.scene=scene;this.group=new THREE.Group();this.group.name='TransportShip96x42';
    this.size=96;this.width=42;this.length=96;this.boundsX=21;this.boundsZ=48;
    // spawnSafety 兼容旧地图的正方形 bounds，同时会优先读取 boundsX/boundsZ。
    this.bounds=48;this.colliders=[];this.platforms=[];this.textures={};
    this.playerSpawn={x:0,y:1.72,z:40,yaw:0};
    this.enemySpawns=[{x:0,z:-40},{x:-13,z:-41},{x:13,z:-41},{x:-17,z:-31},{x:17,z:-31}];
    scene.add(this.group);this.build();buildSafeSpawns(this);
  }
  setActive(active){this.group.visible=active;this.active=active;}
  texture(kind,color='#47788d',number='TS-01'){
    const key=`${kind}:${color}:${number}`;if(this.textures[key])return this.textures[key];
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');
    c.fillStyle=color;c.fillRect(0,0,512,256);
    if(kind==='deck'){
      c.fillStyle='#48535a';c.fillRect(0,0,512,256);c.strokeStyle='#68777e';c.lineWidth=3;
      for(let y=0;y<256;y+=16){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();}
      for(let x=0;x<512;x+=32){c.fillStyle='rgba(20,27,31,.28)';c.fillRect(x,0,3,256);}
      for(let i=0;i<90;i++){c.fillStyle=i%3?'#303b40':'#9a5734';c.globalAlpha=.18;c.fillRect((i*73)%512,(i*47)%256,8+(i%17),2);}
    }else if(kind==='container'){
      c.strokeStyle='rgba(10,25,31,.34)';c.lineWidth=5;
      for(let x=10;x<512;x+=28){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();c.strokeStyle='rgba(255,255,255,.12)';c.beginPath();c.moveTo(x+5,0);c.lineTo(x+5,256);c.stroke();c.strokeStyle='rgba(10,25,31,.34)';}
      c.fillStyle='rgba(9,22,28,.72)';c.fillRect(22,172,210,55);c.fillStyle='#e8ecea';c.font='bold 31px monospace';c.fillText(number,34,209);
      c.strokeStyle='#d7ddd9';c.lineWidth=7;c.strokeRect(7,7,498,242);
      for(let i=0;i<22;i++){c.fillStyle='#6c3824';c.globalAlpha=.18+(i%4)*.04;c.fillRect((i*83)%490,(i*59)%240,18+i%24,3+i%5);}
    }else{
      c.fillStyle='#5c6870';c.fillRect(0,0,512,256);c.strokeStyle='#273238';c.lineWidth=5;
      for(let x=0;x<512;x+=64)c.strokeRect(x,0,64,256);
      for(let i=0;i<35;i++){c.fillStyle='#a4512f';c.globalAlpha=.25;c.fillRect((i*97)%512,(i*43)%256,25,5);}
    }
    c.globalAlpha=1;const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;this.textures[key]=t;return t;
  }
  material(kind,color,number){const map=this.texture(kind,color,number);return new THREE.MeshStandardMaterial({map,color:0xffffff,metalness:.62,roughness:kind==='deck'?.42:.36});}
  box(x,z,w,h,d,kind='hull',collide=true,y=0,color='#5c6870',number='TS-01'){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.material(kind,color,number));mesh.position.set(x,y+h/2,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.world=true;mesh.userData.collide=collide;mesh.userData.collisionRole=kind==='deck'?(collide?'platform':'deck'):'obstacle';this.group.add(mesh);
    if(collide){const box=new THREE.Box3().setFromObject(mesh);this.colliders.push(box);if(box.max.y>.25)this.platforms.push(box);}return mesh;
  }
  container(x,z,color,number,level=0,rotation=0){
    // 标准化为 6×2.6×2.6，沿船长方向摆放；旋转后仍由 Box3 精确包围。
    const mesh=this.box(x,z,2.6,2.6,6,'container',true,level*2.6,color,number);mesh.rotation.y=rotation;
    const box=this.colliders.at(-1);box.setFromObject(mesh);this.platforms.at(-1).setFromObject(mesh);return mesh;
  }
  build(){
    this.box(0,0,42,.34,96,'deck',false,-.34);this.box(0,0,43,1.1,97,'hull',false,-1.35,'#40515a');
    // 两侧舷墙为低掩体；四角各留 5 单位开口通向出生区侧翼。
    for(const z of [-36,-14,14,36]){this.box(-20.45,z,1,1.25,17,'hull');this.box(20.45,z,1,1.25,17,'hull');}
    this.box(0,-47.35,42,2.4,1.3,'hull');this.box(0,47.35,42,2.4,1.3,'hull');
    // 两侧各两排集装箱，中路保持约 10 单位宽的交火走廊。
    const colors=['#28799b','#c8642d','#3f7b55'];let id=1;
    for(const side of [-1,1])for(const lane of [8.4,13.2])for(const z of [-25,-17,-9,9,17,25]){
      const color=colors[(id+side+3)%3],number=`CF-${String(id++).padStart(3,'0')}`;this.container(side*lane,z,color,number);
      if((Math.abs(z)===17&&lane===13.2)||(z===-9&&lane===8.4))this.container(side*lane,z,colors[id%3],`${number}-U`,1);
    }
    // 货舱口兼作中央低掩体，四角台阶让玩家可逐级跳上第一层与第二层箱顶。
    this.box(0,0,8,.7,13,'hull',true,0,'#28363e');this.box(0,0,6,.18,11,'deck',true,.7,'#38474f');
    for(const side of [-1,1])for(const z of [-28,28]){
      this.box(side*16.7,z,1.8,.85,2.2,'hull',true,0,'#7d563d');
      this.box(side*15.2,z,1.8,1.7,2.2,'hull',true,0,'#6b4936');
    }
    // 船头/船尾出生区用低掩体隔开正面火线，但左右均可绕行。
    for(const z of [-38,38]){this.box(-8,z,7,1.35,1.2,'hull');this.box(8,z,7,1.35,1.2,'hull');}
    // 甲板导向线与救生圈不参与碰撞，提供货船识别度。
    const lineMat=new THREE.MeshBasicMaterial({color:0xe8c64b});for(const x of [-5.3,5.3]){const line=new THREE.Mesh(new THREE.PlaneGeometry(.16,82),lineMat);line.rotation.x=-Math.PI/2;line.position.set(x,.012,0);this.group.add(line);}
    for(const z of [-31,31])for(const x of [-20.1,20.1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.15,8,18),new THREE.MeshStandardMaterial({color:0xff6938,roughness:.45}));ring.position.set(x,1.65,z);ring.rotation.y=Math.PI/2;this.group.add(ring);}
  }
  update(){}
  collides(pos,r){
    if(Math.abs(pos.x)+r>20.5||Math.abs(pos.z)+r>47.5)return true;
    return this.colliders.some(b=>pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&pos.y>b.min.y-.18&&pos.y-1.7<b.max.y-.03);
  }
  // 返回脚下最高可站立表面，供跳跃落在货舱口、台阶和集装箱顶。
  heightAt(pos,r=.32){let height=0;for(const b of this.platforms)if(pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&b.max.y<=pos.y-1.45)height=Math.max(height,b.max.y);return height;}
  surfaceAt(){return 'stone';}
  randomEdge(){return randomSafeSpawn(this);}
}
