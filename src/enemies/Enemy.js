import * as THREE from 'three';
import { createEnemyModel } from './enemyModelFactory.js';

const SWAY_AXIS=new THREE.Vector3(0,0,1);

export class Enemy {
  constructor(scene,bus){this.scene=scene;this.bus=bus;this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);this.parts=[];}
  spawn(typeId,type,pos,wave,scale={health:1,speed:1}){
    this.group.remove(...this.group.children);this.model=type.model?type.model(type,this):createEnemyModel(typeId,type,this);this.group.add(this.model.group);this.parts=this.model.parts;
    this.type=typeId;this.def={...type};this.maxHealth=type.health*(1+(wave-1)*.11)*scale.health;this.health=this.maxHealth;this.baseSpeed=type.speed*(1+Math.min(wave*.015,.25))*scale.speed;this.speed=this.baseSpeed;
    this.anim={walkSwing:{amplitude:.05,frequency:8},float:{amplitude:0,frequency:0},...type.anim,walkSwing:{amplitude:.05,frequency:8,...type.anim?.walkSwing},float:{amplitude:0,frequency:0,...type.anim?.float}};this.walkParts=this.parts.filter(p=>p.userData.walkLimb);
    this.group.scale.setScalar(type.scale);this.group.position.set(pos.x,0,pos.z);this.baseHoverY=0;this.group.rotation.set(0,0,0);this.group.visible=true;this.alive=true;this.attackCd=.4;this.moveSoundCd=.2;this.phase=1;this.charge=0;this.warn=0;this.slowTimer=0;this.burnTimer=0;this.burnTick=0;this.burstLeft=0;this.lastAvoidDir=0;this.avoidHeading=null;
  }
  update(dt,player,map){
    if(!this.alive)return;this.attackCd-=dt;this.moveSoundCd-=dt;if(this.moveSoundCd<=0){this.moveSoundCd=1.2+Math.random()*.6;this.bus.emit('enemy:move',{enemy:this,enemyType:this.type,position:this.group.position});}
    if(this.slowTimer>0){this.slowTimer-=dt;this.speed=this.baseSpeed*.6;}else this.speed=this.baseSpeed;
    if(this.burnTimer>0&&(this.burnTimer-=dt)>0&&(this.burnTick-=dt)<=0){this.burnTick=1;this.hit(8);}
    const target=player.position.clone().setY(0),delta=target.sub(this.group.position),dist=delta.length(),dir=delta.normalize();
    const beforeX=this.group.position.x,beforeZ=this.group.position.z;
    if(this.def.role==='ranged'||this.def.role==='sniper')this.updateRanged(dt,dist,dir,map);
    else this.updateMelee(dt,dist,dir,map);
    const now=performance.now()/1000,moving=Math.hypot(this.group.position.x-beforeX,this.group.position.z-beforeZ)>1e-6;
    this.group.lookAt(player.position.x,this.anim.float.amplitude?this.group.position.y:0,player.position.z);this.applyAnimation(now,moving);
  }
  applyAnimation(now,moving){
    const walk=this.anim.walkSwing,float=this.anim.float,phase=now*walk.frequency;
    const sway=moving&&this.walkParts.length?Math.sin(phase)*walk.amplitude:0;
    if(sway!==0)this.group.rotateOnAxis(SWAY_AXIS,sway);
    if(this.walkParts.length)this.parts.slice(2,8).forEach((part,index)=>{part.rotation.x=Math.sin(now*8*this.speed+index*Math.PI)*.42;});
    this.group.position.y=this.baseHoverY+(float.amplitude?Math.sin(now*float.frequency)*float.amplitude:0);
    this.model.group.userData.animate?.(now);
  }
  move(dir,amount,map){
    if(amount<=0||dir.lengthSq()===0)return false;
    const radius=.42*this.def.scale,desired=dir.clone().setY(0).normalize(),direct=this.group.position.clone().addScaledVector(desired,amount);
    if(!map.collides(direct,radius)){
      // 离墙后限制单帧回正角度，轨迹平滑收拢到目标方向。
      let heading=desired;if(this.avoidHeading){heading=this.avoidHeading.clone();const angle=heading.angleTo(desired),turn=Math.min(angle,.18);if(angle>1e-4)heading.applyAxisAngle(new THREE.Vector3(0,1,0),Math.sign(heading.z*desired.x-heading.x*desired.z)*turn).normalize();}
      let next=this.group.position.clone().addScaledVector(heading,amount);if(map.collides(next,radius)){heading=desired;next=direct;}
      this.group.position.copy(next);this.avoidHeading=heading;if(heading.angleTo(desired)<.04){this.lastAvoidDir=0;this.avoidHeading=null;}return true;
    }
    const order=this.lastAvoidDir?[this.lastAvoidDir,-this.lastAvoidDir]:[1,-1],probeDistance=Math.max(amount,radius*.9);
    for(const side of order){
      // 已开始绕墙时沿用上帧切向，避免目标方位细微变化造成切向反复扎回墙内。
      const tangent=side===this.lastAvoidDir&&this.avoidHeading?this.avoidHeading.clone():desired.clone().applyAxisAngle(new THREE.Vector3(0,1,0),side*Math.PI/2),probe=this.group.position.clone().addScaledVector(tangent,probeDistance);
      if(map.collides(probe,radius))continue;const next=this.group.position.clone().addScaledVector(tangent,amount);if(map.collides(next,radius))continue;
      this.group.position.copy(next);this.lastAvoidDir=side;this.avoidHeading=tangent;return true;
    }
    return false;
  }
  // 用角色胸口高度沿连线采样；map.collides 与玩家/敌人的胶囊碰撞规则保持一致。
  hasLineOfSight(target,map,samples=5){
    const from=this.group.position.clone();from.y=.95*this.def.scale;const to=target.clone();to.y=Math.max(.75,to.y-.28);
    // 采用敌人胶囊半径，避免 5 个离散采样点恰好跨过一单位薄墙而产生假视线。
    const radius=.42*Math.min(1,this.def.scale);for(let i=1;i<=samples;i++){const p=from.clone().lerp(to,i/(samples+1));if(map.collides(p,radius))return false;}return true;
  }
  updateMelee(dt,dist,dir,map){
    let speed=this.speed;if(this.def.boss&&this.health<this.maxHealth*.5){speed*=1.7;if(this.phase===1){this.phase=2;this.bus.emit('boss:phase',{enemy:this});this.bus.emit('boss:enrage',{enemy:this});}}
    if(this.type==='exploder'&&dist<6)this.warn=Math.min(1,this.warn+dt*1.8);
    // 玩家本身视作最终阻挡物：尚未贴身时始终先寻路，移动成功的帧绝不攻击。
    const contact=Math.max(.62,this.def.range*.72),target=this.group.position.clone().add(dir.clone().multiplyScalar(dist)).setY(1.72),visible=this.hasLineOfSight(target,map);
    // 即使直线距离已经很近，只要中间隔墙也必须继续走，不能进入“既不走也不打”的死锁。
    const moved=(!visible||dist>contact)&&this.move(dir,speed*dt,map);
    if(!moved&&dist<=this.def.range&&visible&&this.attackCd<=0){this.attackCd=this.type==='exploder'?99:(this.def.boss?.7:1.05);this.bus.emit(this.type==='exploder'?'enemy:explode':'enemy:attack',{enemy:this,damage:this.def.damage,radius:this.def.range});this.bus.emit('enemy:attackSound',{enemy:this,enemyType:this.type,position:this.group.position});if(this.type==='exploder')this.die();}
  }
  updateRanged(dt,dist,dir,map){
    const preferred=this.def.preferred,target=this.group.position.clone().add(dir.clone().multiplyScalar(dist)).setY(1.72),visible=this.hasLineOfSight(target,map);let moved=false;
    // 视线被挡时不蓄力、不射击，持续向玩家方向绕障寻找新的射界。
    if(!visible)moved=this.move(dir,this.speed*dt,map);else if(dist<preferred*.72)moved=this.move(dir.clone().negate(),this.speed*dt,map);else if(dist>preferred*1.12)moved=this.move(dir,this.speed*dt,map);
    if(!visible){this.charge=0;return;}if(moved)return;
    if(this.def.role==='sniper'&&this.attackCd<=0){this.charge+=dt;if(this.charge===dt)this.bus.emit('enemy:sniperCharge',{enemy:this,duration:this.def.charge});if(this.charge>=this.def.charge){this.fireProjectile();this.charge=0;this.attackCd=2.7;}}
    else if(this.def.role!=='sniper'&&this.attackCd<=0&&dist<=this.def.range){this.fireProjectile();this.attackCd=this.type==='shooter'?.28:2.8;}
  }
  fireProjectile(){this.bus.emit('enemy:projectile',{enemy:this,type:this.def.projectile,damage:this.def.damage,speed:this.def.projectileSpeed});this.bus.emit('enemy:attackSound',{enemy:this,enemyType:this.type,position:this.group.position});}
  applyElement(type){if(type==='ice')this.slowTimer=1.5;else{this.burnTimer=2;this.burnTick=1;}this.bus.emit('enemy:element',{enemy:this,type});}
  hit(damage,headshot=false,source=null,fromShot=false){if(!this.alive)return false;let applied=damage;if(this.def.armor&&source){const toSource=source.clone().sub(this.group.position).normalize(),forward=new THREE.Vector3(0,0,1).applyQuaternion(this.group.quaternion);if(forward.dot(toSource)>.2)applied*=1-this.def.armor;}this.health-=applied;if(this.def.role==='sniper'&&this.charge>0){this.charge=0;this.attackCd=1.2;this.bus.emit('enemy:sniperInterrupted',{enemy:this});}this.bus.emit('enemy:hit',{enemy:this,damage:applied,headshot,fromShot});if(this.health<=0)this.die();return applied;}
  die(){if(!this.alive)return;this.alive=false;this.bus.emit('enemy:killed',{enemy:this});this.group.rotation.x=-Math.PI/2;setTimeout(()=>{this.group.visible=false;this.group.rotation.set(0,0,0);this.bus.emit('enemy:despawn',{enemy:this});},420);}
}
