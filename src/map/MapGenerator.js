import * as THREE from 'three';
import {addArenaDecor,animateArena,arenaMaterial,arenaTexture} from './TheFinalsStyle.js';
import {buildSafeSpawns,randomSafeSpawn} from './spawnSafety.js';

export class MapGenerator {
  constructor(scene){this.scene=scene;this.colliders=[];this.group=new THREE.Group();this.group.name='FutureBase60';this.textures={};this.size=60;this.bounds=30;this.playerSpawn={x:0,y:1.72,z:9,yaw:0};this.enemySpawns=[{x:-26,z:-25},{x:26,z:-22},{x:-26,z:22},{x:26,z:25}];scene.add(this.group);this.build();buildSafeSpawns(this);}
  setActive(active){this.group.visible=active;this.active=active;}

  // CanvasTexture 在本地生成材质细节，避免所有大型表面像单色塑料块。
  texture(kind){
    if(this.textures[kind])return this.textures[kind];
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
    const fill=color=>{c.fillStyle=color;c.fillRect(0,0,256,256);};
    if(kind==='ground'){
      fill('#9fb4c4');c.strokeStyle='rgba(221,242,250,.7)';c.lineWidth=2;for(let n=0;n<=256;n+=32){c.beginPath();c.moveTo(n,0);c.lineTo(n,256);c.stroke();c.beginPath();c.moveTo(0,n);c.lineTo(256,n);c.stroke();}c.strokeStyle='rgba(52,112,145,.35)';c.lineWidth=1;for(let n=0;n<=256;n+=8){c.beginPath();c.moveTo(n,0);c.lineTo(n,256);c.stroke();}
    }else if(kind==='brick'){
      fill('#e7edf1');c.lineWidth=3;c.strokeStyle='#b4c6d0';for(let y=0;y<=256;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();}for(let x=0;x<=256;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();}c.fillStyle='#29bfff';c.fillRect(0,112,256,11);c.fillStyle='#d7f5ff';c.fillRect(0,114,256,3);
    }else if(kind==='container'){
      fill('#f3f5f6');for(let x=0;x<256;x+=32){c.fillStyle=x%64?'#ff8b38':'#ffad56';c.fillRect(x,0,18,256);c.fillStyle='#d7e0e5';c.fillRect(x+18,0,4,256);}c.fillStyle='#21c9ff';c.fillRect(0,38,256,10);c.fillStyle='#eaffff';c.fillRect(0,41,256,3);
    }else if(kind==='vehicle'){
      fill('#d8e4eb');c.fillStyle='#48758e';c.fillRect(0,42,256,50);c.fillRect(0,185,256,18);c.fillStyle='#62dcff';c.fillRect(0,46,256,8);
      for(let i=0;i<170;i++){c.fillStyle=`rgba(185,198,190,${Math.random()*.18})`;c.fillRect(Math.random()*256,Math.random()*256,2+Math.random()*5,1+Math.random()*3);}
    }else if(kind==='shack'){
      fill('#edf3f6');for(let x=0;x<256;x+=28){c.fillStyle=x%56?'#d9e5eb':'#f8fbfc';c.fillRect(x,0,24,256);c.fillStyle='#8ca8b7';c.fillRect(x+24,0,4,256);}c.fillStyle='#56d5ff';c.fillRect(0,190,256,9);
    }else{fill('#555b60');}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;this.textures[kind]=texture;return texture;
  }

  material(kind,w,d){const arenaKind=kind==='shack'?'glass':kind==='container'?'stripe':'concrete';return arenaMaterial(arenaKind,w,d);}
  box(x,z,w,h,d,color=0x555b60,kind='brick',collide=true,role='wall'){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.material(kind,w,Math.max(h,d)));mesh.position.set(x,h/2,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.world=true;mesh.userData.collide=collide;mesh.userData.collisionRole=role;this.group.add(mesh);if(collide)this.colliders.push(new THREE.Box3().setFromObject(mesh));return mesh;}
  // 屋顶只负责视觉遮盖；玩家和敌人的二维移动碰撞不能把整片室内地面封死。
  roof(x,z,w,h,d,kind='shack'){return this.box(x,z,w,h,d,0,kind,false,'roof');}

  build(){
    const groundMap=arenaTexture('ground');groundMap.repeat.set(12,12);const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({map:groundMap,roughness:.4,metalness:.18}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.userData.world=true;this.group.add(ground);
    // 60×60 紧凑基地：中央广场连接四个功能区，每个区至少有两条进出路线。
    this.box(0,-30,60,4,1,0,'brick');this.box(0,30,60,4,1,0,'brick');this.box(-30,0,1,4,60,0,'brick');this.box(30,0,1,4,60,0,'brick');
    // 西北集装箱堆叠区，错位留出 S 型穿行路线。
    [[-21,-20,11,2.8,3],[-17,-15,3,2.8,9],[-25,-10,8,2.8,3],[-22,-20,6,5.6,3]].forEach(v=>this.box(...v,0,'container'));
    // 东北掩体巷道。
    [[13,-21,1,2.2,12],[21,-16,1,2.2,14],[17,-9,9,1.35,1],[26,-23,5,1.5,2]].forEach(v=>this.box(...v,0,'brick'));
    // 西南维修间：四面墙均与视觉一致，南北各开门。
    this.roof(-20,18,12,.35,10);this.box(-26,18,1,4,10,0,'shack');this.box(-14,18,1,4,10,0,'shack');
    this.box(-23,13,6,4,1,0,'shack');this.box(-15.5,13,3,4,1,0,'shack');this.box(-24,23,4,4,1,0,'shack');this.box(-16,23,4,4,1,0,'shack');
    // 东南双舱小建筑与高台（坡道侧留开放入口）。
    this.roof(19,18,13,.4,10);this.box(12.5,18,1,3.6,10,0,'shack');this.box(25.5,18,1,3.6,10,0,'shack');this.box(16,13,6,3.6,1,0,'shack');this.box(23.5,13,4,3.6,1,0,'shack');this.box(19,23,13,3.6,1,0,'shack');
    this.box(7,24,7,1.8,7,0,'vehicle');
    // 中央广场低矮十字掩体，不堵塞四向主路线。
    [[-6,0,4,1.1,1],[6,0,4,1.1,1],[0,-6,1,1.1,4],[0,6,1,1.1,4]].forEach(v=>this.box(...v,0,'brick'));
    // 六组赛场点缀覆盖入口、中央广场和两翼，且全部不参与碰撞。
    addArenaDecor(this.group,{size:60,holograms:[[0,4.2,-27,0],[-27,3.8,4,Math.PI/2]],floaters:[[-10,5.8,-3,'cube'],[11,6.4,2,'ring']],pillars:[[-9,-9,'cyan'],[9,9,'orange'],[-9,9,'orange'],[9,-9,'cyan']]});
  }
  update(time){animateArena(this.group,time);}
  collides(pos,r){if(Math.abs(pos.x)>29.5||Math.abs(pos.z)>29.5)return true;return this.colliders.some(b=>pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&pos.y>b.min.y-.2&&pos.y-1.7<b.max.y);}
  surfaceAt(pos){return Math.abs(pos.x)<10&&Math.abs(pos.z)<10?'stone':'ground';}
  randomEdge(){return randomSafeSpawn(this);}
}
