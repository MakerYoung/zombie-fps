import * as THREE from 'three';
const toward=(v,target,amount)=>v<target?Math.min(v+amount,target):Math.max(v-amount,target);

export class PlayerController {
  constructor(camera,input,map,stats,bus){
    Object.assign(this,{camera,input,map,stats,bus});this.velocity=new THREE.Vector3();this.yaw=0;this.pitch=0;this.pitchOffset=0;this.crosshairKick={x:0,y:0};this.standingHeight=1.72;this.crouchHeight=1.12;this.height=this.standingHeight;this.camera.position.set(0,this.height,8);this.grounded=true;this.sprinting=false;this.crouching=false;this.stepDistance=0;this.leftFoot=false;this.lastMovementState='';
    bus.on('weapon:shoot',({data})=>{const kick={pistol:.008,smg:.006,shotgun:.02}[data.id]??.008;this.pitchOffset=Math.min(.04,this.pitchOffset+kick);this.crosshairKick.x=(Math.random()*2-1)*3;this.crosshairKick.y=-(1+Math.random()*3);});
  }
  sensitivity(){const value=Math.max(1,Math.min(10,Number(localStorage.getItem('sensitivity'))||7));return value<=5?.001+(value-1)*.001:.005+(value-5)*.003;}
  resetMotion(){this.velocity.set(0,0,0);this.grounded=true;this.sprinting=false;this.crouching=false;this.height=this.standingHeight;this.emitMovementState(false,true);}
  emitMovementState(moving,force=false){const key=`${this.grounded}:${this.sprinting}:${this.crouching}:${moving}`;if(!force&&key===this.lastMovementState)return;this.lastMovementState=key;this.bus.emit('player:movementState',{grounded:this.grounded,sprinting:this.sprinting,crouching:this.crouching,moving,velocity:this.velocity.clone()});}
  updateLook(dt){
    const look=this.input.consumeLook(),sens=this.sensitivity();this.yaw-=look.x*sens;this.pitch=Math.max(-1.45,Math.min(1.45,this.pitch-look.y*sens));this.pitchOffset*=Math.exp(-dt/.115);const decay=Math.exp(-dt/.04);this.crosshairKick.x*=decay;this.crosshairKick.y*=decay;this.camera.rotation.set(this.pitch+this.pitchOffset,this.yaw,0);this.bus.emit('recoil:update',{pitchOffset:this.pitchOffset,crosshairKick:{...this.crosshairKick}});
    if(typeof document!=='undefined'){const crosshair=document.querySelector('#crosshair');crosshair?.style.setProperty('--kick-x',`${this.crosshairKick.x}px`);crosshair?.style.setProperty('--kick-y',`${this.crosshairKick.y}px`);}
  }
  update(dt,active){
    if(!active)return;this.updateLook(dt);const m=this.input.state.move,inputLength=Math.min(1,Math.hypot(m.x,m.y)),lowHealth=this.healthRatio?.()??1,baseSpeed=this.stats.get('moveSpeed')*(lowHealth<.35?this.stats.get('lowHealthSpeed'):1);
    const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)),right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)),desired=forward.multiplyScalar(m.y).add(right.multiplyScalar(m.x));if(desired.lengthSq()>1)desired.normalize();
    this.crouching=this.grounded&&Boolean(this.input.state.crouch);this.sprinting=this.grounded&&!this.crouching&&Boolean(this.input.state.sprint)&&m.y>.45&&inputLength>.45;const speedScale=this.sprinting ? 1.55 : this.crouching ? .52 : 1,targetX=desired.x*baseSpeed*speedScale,targetZ=desired.z*baseSpeed*speedScale;
    if(this.grounded){const acceleration=inputLength>0?48:62;this.velocity.x=toward(this.velocity.x,targetX,acceleration*dt);this.velocity.z=toward(this.velocity.z,targetZ,acceleration*dt);}
    else if(inputLength>0){const airAcceleration=8.5;this.velocity.x=toward(this.velocity.x,targetX,airAcceleration*dt);this.velocity.z=toward(this.velocity.z,targetZ,airAcceleration*dt);}
    const before=this.camera.position.clone(),nextX=this.camera.position.clone();nextX.x+=this.velocity.x*dt;if(!this.map.collides(nextX,.38))this.camera.position.x=nextX.x;else this.velocity.x=0;const nextZ=this.camera.position.clone();nextZ.z+=this.velocity.z*dt;if(!this.map.collides(nextZ,.38))this.camera.position.z=nextZ.z;else this.velocity.z=0;
    if(this.input.consume('jump')&&this.grounded){this.velocity.y=6.2*this.stats.get('jumpHeight');this.grounded=false;this.sprinting=false;this.bus.emit('player:jump',{position:this.camera.position.clone(),velocity:this.velocity.clone()});}
    const targetHeight=this.crouching?this.crouchHeight:this.standingHeight,surface=this.map.heightAt?.(this.camera.position)||0,floor=targetHeight+surface;
    if(this.grounded){this.velocity.y=0;this.height=toward(this.height,targetHeight,dt*3.8);this.camera.position.y=surface+this.height;}
    else{this.velocity.y-=15*dt;this.camera.position.y+=this.velocity.y*dt;if(this.camera.position.y<=floor){const landed=this.velocity.y<-.8;this.grounded=true;this.velocity.y=0;this.height=targetHeight;this.camera.position.y=floor;if(landed)this.bus.emit('player:land',{position:this.camera.position.clone()});}}
    const distance=Math.hypot(this.camera.position.x-before.x,this.camera.position.z-before.z),moving=distance/Math.max(dt,.001)>.2;if(moving&&this.grounded){this.stepDistance+=distance;const speed=Math.hypot(this.velocity.x,this.velocity.z),stride=Math.max(.85,1.55-speed*.035);if(this.stepDistance>=stride){this.stepDistance=0;this.leftFoot=!this.leftFoot;const material=this.map.surfaceAt?.(this.camera.position)==='stone'?'stone':'ground';this.bus.emit('player:footstep',{position:this.camera.position.clone(),material,left:this.leftFoot,speed,sprinting:this.sprinting,crouching:this.crouching});}}
    this.emitMovementState(moving);
  }
}
