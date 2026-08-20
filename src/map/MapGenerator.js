import * as THREE from 'three';
import {addArenaDecor,animateArena,arenaMaterial,arenaTexture} from './TheFinalsStyle.js';
import {MAP_DEFS} from './mapDefs.js';
import {buildSafeSpawns,randomSafeSpawn} from './spawnSafety.js';
import {NavGrid} from './NavGrid.js';

export class MapGenerator{
  constructor(scene,def=MAP_DEFS.base){
    this.scene=scene;this.def=def;this.colliders=[];this.platforms=[];this.textures={};this.group=new THREE.Group();this.group.name=`Map:${def.id}`;
    this.size=def.length;this.width=def.width;this.length=def.length;this.boundsX=def.boundsX;this.boundsZ=def.boundsZ;this.bounds=Math.max(def.boundsX,def.boundsZ);
    this.playerSpawn={...def.playerSpawn};this.enemySpawns=def.enemySpawns.map(p=>({...p}));this.hasArenaDecor=false;scene.add(this.group);this.build();buildSafeSpawns(this);this.navigation=new NavGrid(this);
  }
  setActive(active){this.group.visible=active;this.active=active;}
  texture(kind,color='#47788d',number='TS-01'){
    const key=`${kind}:${color}:${number}`;if(this.textures[key])return this.textures[key];
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,512,256);
    if(kind==='deck'){c.fillStyle='#48535a';c.fillRect(0,0,512,256);c.strokeStyle='#68777e';c.lineWidth=3;for(let y=0;y<256;y+=16){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();}for(let x=0;x<512;x+=32){c.fillStyle='rgba(20,27,31,.28)';c.fillRect(x,0,3,256);}for(let i=0;i<90;i++){c.fillStyle=i%3?'#303b40':'#9a5734';c.globalAlpha=.18;c.fillRect((i*73)%512,(i*47)%256,8+(i%17),2);}}
    else if(kind==='container'){c.strokeStyle='rgba(10,25,31,.34)';c.lineWidth=5;for(let x=10;x<512;x+=28){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();c.strokeStyle='rgba(255,255,255,.12)';c.beginPath();c.moveTo(x+5,0);c.lineTo(x+5,256);c.stroke();c.strokeStyle='rgba(10,25,31,.34)';}c.fillStyle='rgba(9,22,28,.72)';c.fillRect(22,172,210,55);c.fillStyle='#e8ecea';c.font='bold 31px monospace';c.fillText(number,34,209);c.strokeStyle='#d7ddd9';c.lineWidth=7;c.strokeRect(7,7,498,242);for(let i=0;i<22;i++){c.fillStyle='#6c3824';c.globalAlpha=.18+(i%4)*.04;c.fillRect((i*83)%490,(i*59)%240,18+i%24,3+i%5);}}
    else{c.fillStyle='#5c6870';c.fillRect(0,0,512,256);c.strokeStyle='#273238';c.lineWidth=5;for(let x=0;x<512;x+=64)c.strokeRect(x,0,64,256);for(let i=0;i<35;i++){c.fillStyle='#a4512f';c.globalAlpha=.25;c.fillRect((i*97)%512,(i*43)%256,25,5);}}
    c.globalAlpha=1;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;this.textures[key]=texture;return texture;
  }
  material(kind,w,d,color,number){
    const custom=this.def.material?.({kind,w,d,color,number});if(custom)return custom;
    if(['deck','hull'].includes(kind)||this.def.id==='transportShip'&&kind==='container')return new THREE.MeshStandardMaterial({map:this.texture(kind,color,number),color:0xffffff,metalness:.62,roughness:kind==='deck'?.42:.36});
    return arenaMaterial(kind==='shack'?'glass':kind==='container'?'stripe':'concrete',w,d);
  }
  box(x,z,w,h,d,color=0x555b60,kind='brick',collide=true,role='wall',y=0,number='TS-01',rotation=0){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.material(kind,w,Math.max(h,d),color,number));mesh.position.set(x,y+h/2,z);mesh.rotation.y=rotation;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.world=true;mesh.userData.collide=collide;mesh.userData.collisionRole=role;this.group.add(mesh);
    if(collide){const bounds=new THREE.Box3().setFromObject(mesh);bounds.userData={role,climbable:['platform','container'].includes(role)};this.colliders.push(bounds);if(bounds.max.y>.25)this.platforms.push(bounds);}return mesh;
  }
  roof(x,z,w,h,d,kind='shack',y=0){return this.box(x,z,w,h,d,0,kind,false,'roof',y);}
  container(item){return this.box(item.x,item.z,item.w,item.h,item.d,item.color,item.mat,true,'container',(item.y||0)+(item.level||0)*2.6,item.number,item.rotation||0);}
  buildObject(item){
    const collide=item.collide??!['roof','hull'].includes(item.t);const roles={wall:'wall',ledge:'wall',roof:'roof',container:'container',deck:collide?'platform':'deck',hull:'hull',platform:'platform'};
    if(!(item.t in roles))throw new Error(`Unknown map object type: ${item.t}`);if(item.t==='container')return this.container(item);
    return this.box(item.x,item.z,item.w,item.h,item.d,item.color,item.mat||'brick',collide,item.role||roles[item.t],item.y||0,item.number,item.rotation||0);
  }
  buildGround(){
    if(this.def.ground.kind!=='ground')return;const map=arenaTexture('ground');map.repeat.set(this.def.ground.repeat,this.def.ground.repeat);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(this.def.width,this.def.length),new THREE.MeshStandardMaterial({map,roughness:.4,metalness:.18}));mesh.rotation.x=-Math.PI/2;mesh.receiveShadow=true;mesh.userData.world=true;this.group.add(mesh);
  }
  makeDecor(item,batch){
    if(item.t==='holo'){batch.holograms.push([item.x,item.y,item.z,item.ry||0]);this.hasArenaDecor=true;return;}
    if(item.t==='floater'){batch.floaters.push([item.x,item.y,item.z,item.kind]);this.hasArenaDecor=true;return;}
    if(item.t==='pillar'){batch.pillars.push([item.x,item.z,item.color]);this.hasArenaDecor=true;return;}
    if(item.t==='line'){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.16,item.len),new THREE.MeshBasicMaterial({color:0xe8c64b}));mesh.rotation.x=-Math.PI/2;mesh.rotation.z=item.ry||0;mesh.position.set(item.x,item.y??.012,item.z);this.group.add(mesh);return;}
    if(item.t==='ring'){const mesh=new THREE.Mesh(new THREE.TorusGeometry(.55,.15,8,18),new THREE.MeshStandardMaterial({color:0xff6938,roughness:.45}));mesh.position.set(item.x,item.y,item.z);mesh.rotation.y=item.ry||0;this.group.add(mesh);return;}
    throw new Error(`Unknown map decor type: ${item.t}`);
  }
  build(){this.buildGround();this.def.objects.forEach(item=>this.buildObject(item));const batch={size:this.def.ground.size,holograms:[],floaters:[],pillars:[]};this.def.decor.forEach(item=>this.makeDecor(item,batch));if(this.hasArenaDecor)addArenaDecor(this.group,batch);this.customUpdate=this.def.decorate?.(this.group)||null;}
  update(time){if(this.hasArenaDecor)animateArena(this.group,time);this.customUpdate?.(time);}
  collides(pos,r){if(Math.abs(pos.x)+r>this.def.boundsX-.5||Math.abs(pos.z)+r>this.def.boundsZ-.5)return true;return this.colliders.some(b=>pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&pos.y>b.min.y-.2&&pos.y-1.7<b.max.y);}
  collidesEnemy(pos,r,height=1.7){if(Math.abs(pos.x)+r>this.def.boundsX-.5||Math.abs(pos.z)+r>this.def.boundsZ-.5)return true;return this.colliders.some(b=>pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&pos.y+height>b.min.y+.05&&pos.y<b.max.y-.05);}
  blocksSight(pos,r=.08){if(Math.abs(pos.x)+r>this.def.boundsX-.5||Math.abs(pos.z)+r>this.def.boundsZ-.5)return true;return this.colliders.some(b=>pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&pos.y+r>b.min.y&&pos.y-r<b.max.y);}
  heightAt(pos,r=.32){let height=0;for(const b of this.platforms)if(pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&b.max.y<=pos.y-1.45)height=Math.max(height,b.max.y);return height;}
  climbHeightAt(pos,r=.32,fromY=0,maxStep=1.35){let height=null;for(const b of this.colliders)if(b.userData?.climbable&&pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&b.max.y>fromY+.08&&b.max.y<=fromY+maxStep)height=Math.max(height??-Infinity,b.max.y);return height;}
  supportHeightAt(pos,r=.32,currentY=0){let height=0;for(const b of this.colliders)if(b.userData?.climbable&&pos.x+r>b.min.x&&pos.x-r<b.max.x&&pos.z+r>b.min.z&&pos.z-r<b.max.z&&b.max.y<=currentY+.18)height=Math.max(height,b.max.y);return height;}
  surfaceAt(pos){return this.def.id==='base'&&Math.abs(pos.x)<10&&Math.abs(pos.z)<10?'stone':this.def.ground.kind==='deck'?'stone':'ground';}
  randomEdge(){return randomSafeSpawn(this);}
  findPath(start,end,radius=.42){return this.navigation.findPath(start,end,radius);}
}
