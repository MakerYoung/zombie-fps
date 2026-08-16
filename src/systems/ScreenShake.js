import * as THREE from 'three';
export class ScreenShake {
  constructor(camera,bus){this.camera=camera;this.power=0;this.fireTime=0;this.fireAmplitude=.00115;this.lastPosition=new THREE.Vector3();this.lastRotation=new THREE.Vector3();bus.on('weapon:shoot',()=>this.fireKick());bus.on('enemy:hit',()=>this.add(.005));bus.on('player:damaged',()=>this.add(.025));bus.on('enemy:killed',()=>this.add(.007));}
  add(v){this.power=Math.min(.05,this.power+v);}
  // 开火通道：短促、高频、幅度远小于命中/受击震屏。
  fireKick(){this.fireTime=Math.min(.12,this.fireTime+.1);}
  update(dt){
    // 撤销上一帧注入量，杜绝随机震动让相机永久漂移。
    this.camera.position.sub(this.lastPosition);this.camera.rotation.x-=this.lastRotation.x;this.camera.rotation.y-=this.lastRotation.y;this.camera.rotation.z-=this.lastRotation.z;this.lastPosition.set(0,0,0);this.lastRotation.set(0,0,0);
    if(this.power>=.0001){this.lastPosition.set((Math.random()-.5)*this.power,(Math.random()-.5)*this.power,0);this.power*=Math.pow(.02,dt);}
    if(this.fireTime>0){const envelope=Math.min(1,this.fireTime/.035),a=this.fireAmplitude*envelope;this.lastPosition.x+=(Math.random()-.5)*a*.6;this.lastPosition.y+=(Math.random()-.5)*a*.45;this.lastPosition.z+=(Math.random()-.5)*a*.25;this.lastRotation.set((Math.random()-.5)*a,(Math.random()-.5)*a,(Math.random()-.5)*a*.45);this.fireTime=Math.max(0,this.fireTime-dt);}
    this.camera.position.add(this.lastPosition);this.camera.rotation.x+=this.lastRotation.x;this.camera.rotation.y+=this.lastRotation.y;this.camera.rotation.z+=this.lastRotation.z;
  }
}
