import * as THREE from 'three';
import { createEnemyModel } from './enemyModelFactory.js';

const SWAY_AXIS=new THREE.Vector3(0,0,1);
export function enemyHealthMultiplier(wave){const level=Math.max(0,wave-1);return 1+level*.085+Math.pow(level,1.65)*.008;}
function createHealthBar(){const group=new THREE.Group(),background=new THREE.Sprite(new THREE.SpriteMaterial({color:0x160b0b,depthTest:true,depthWrite:false})),fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0xe33434,depthTest:true,depthWrite:false}));background.renderOrder=30;fill.renderOrder=31;background.scale.set(1,.105,1);fill.scale.set(.94,.065,1);fill.position.z=.01;group.add(background,fill);group.userData.fill=fill;return group;}

export class Enemy {
  constructor(scene,bus){this.scene=scene;this.bus=bus;this.group=new THREE.Group();this.healthBar=createHealthBar();this.group.visible=false;scene.add(this.group);this.parts=[];}
  spawn(typeId,type,pos,wave,scale={health:1,speed:1}){
    this.group.remove(...this.group.children);this.model=type.model?type.model(type,this):createEnemyModel(typeId,type,this);this.group.add(this.model.group,this.healthBar);this.parts=this.model.parts;
    this.type=typeId;this.def={...type};this.maxHealth=Math.round(type.health*enemyHealthMultiplier(wave)*scale.health);this.health=this.maxHealth;this.baseSpeed=type.speed*(1+Math.min(wave*.015,.25))*scale.speed;this.speed=this.baseSpeed;
    this.anim={walkSwing:{amplitude:.05,frequency:8},float:{amplitude:0,frequency:0},...type.anim,walkSwing:{amplitude:.05,frequency:8,...type.anim?.walkSwing},float:{amplitude:0,frequency:0,...type.anim?.float}};this.walkParts=this.parts.filter(p=>p.userData.walkLimb);
    this.group.scale.setScalar(type.scale);this.healthBar.position.set(0,2.22/type.scale,0);this.healthBar.scale.setScalar(1/type.scale);this.healthBar.userData.fill.material.color.setHex(type.elite||type.boss?0xf2c94c:0xe33434);this.group.position.set(pos.x,0,pos.z);this.baseHoverY=0;this.groundY=0;this.verticalVelocity=0;this.jumping=false;this.group.rotation.set(0,0,0);this.group.visible=true;this.alive=true;this.updateHealthBar();this.attackCd=.4;this.moveSoundCd=.2;this.phase=1;this.charge=0;this.warn=0;this.slowTimer=0;this.burnTimer=0;this.burnTick=0;this.burstLeft=0;this.lastAvoidDir=0;this.avoidHeading=null;this.path=[];this.pathIndex=0;this.pathTimer=Math.random()*.2;this.pathGoal=null;this.stuckTime=0;this.wantedMove=false;
  }
  update(dt,player,map){
    if(!this.alive)return;this.attackCd-=dt;this.moveSoundCd-=dt;if(this.moveSoundCd<=0){this.moveSoundCd=1.2+Math.random()*.6;this.bus.emit('enemy:move',{enemy:this,enemyType:this.type,position:this.group.position});}
    if(this.slowTimer>0){this.slowTimer-=dt;this.speed=this.baseSpeed*.6;}else this.speed=this.baseSpeed;
    if(this.burnTimer>0&&(this.burnTimer-=dt)>0&&(this.burnTick-=dt)<=0){this.burnTick=1;this.hit(8);}
    this.updateVertical(dt,map);const playerFeetY=Math.max(0,player.position.y-1.72),target=player.position.clone().setY(playerFeetY),delta=target.clone().sub(this.group.position),verticalGap=target.y-this.group.position.y,dist=Math.hypot(delta.x,delta.z),dir=delta.setY(0).normalize();
    const beforeX=this.group.position.x,beforeZ=this.group.position.z;
    this.wantedMove=false;if(this.def.role==='ranged'||this.def.role==='sniper')this.updateRanged(dt,dist,dir,target,map);
    else this.updateMelee(dt,dist,verticalGap,dir,target,map);
    const now=performance.now()/1000,movedDistance=Math.hypot(this.group.position.x-beforeX,this.group.position.z-beforeZ),moving=movedDistance>1e-6;
    if(this.wantedMove&&movedDistance<Math.max(.002,this.speed*dt*.08)){this.stuckTime+=dt;if(this.stuckTime>.35)this.pathTimer=0;}else if(moving)this.stuckTime=0;
    this.group.lookAt(player.position.x,this.anim.float.amplitude?this.group.position.y:0,player.position.z);this.applyAnimation(now,moving);
  }
  applyAnimation(now,moving){
    const walk=this.anim.walkSwing,float=this.anim.float,phase=now*walk.frequency;
    const sway=moving&&this.walkParts.length?Math.sin(phase)*walk.amplitude:0;
    if(sway!==0)this.group.rotateOnAxis(SWAY_AXIS,sway);
    if(this.walkParts.length)this.parts.slice(2,8).forEach((part,index)=>{part.rotation.x=Math.sin(now*8*this.speed+index*Math.PI)*.42;});
    if(!this.jumping)this.group.position.y=this.groundY+this.baseHoverY+(float.amplitude?Math.sin(now*float.frequency)*float.amplitude:0);
    this.model.group.userData.animate?.(now);
  }
  move(dir,amount,map){
    if(amount<=0||dir.lengthSq()===0)return false;
    const radius=.42*this.def.scale,collides=p=>map.collidesEnemy?map.collidesEnemy(p,radius,1.7*this.def.scale):map.collides(p,radius),desired=dir.clone().setY(0).normalize(),direct=this.group.position.clone().addScaledVector(desired,amount);
    const climb=map.climbHeightAt?.(direct,radius,this.groundY,1.5);if(!this.jumping&&climb!=null){this.jumping=true;this.verticalVelocity=7.2;this.bus.emit('enemy:jump',{enemy:this,height:climb-this.groundY});return false;}
    if(!collides(direct)){
      // 离墙后限制单帧回正角度，轨迹平滑收拢到目标方向。
      let heading=desired;if(this.avoidHeading){heading=this.avoidHeading.clone();const angle=heading.angleTo(desired),turn=Math.min(angle,.18);if(angle>1e-4)heading.applyAxisAngle(new THREE.Vector3(0,1,0),Math.sign(heading.z*desired.x-heading.x*desired.z)*turn).normalize();}
      let next=this.group.position.clone().addScaledVector(heading,amount);if(collides(next)){heading=desired;next=direct;}
      this.group.position.copy(next);this.avoidHeading=heading;if(heading.angleTo(desired)<.04){this.lastAvoidDir=0;this.avoidHeading=null;}return true;
    }
    if(this.jumping)return false;
    const order=this.lastAvoidDir?[this.lastAvoidDir,-this.lastAvoidDir]:[1,-1],probeDistance=Math.max(amount,radius*1.35);
    for(const side of order){
      // 从斜前方逐渐扫到斜后方；直角处需要先离开障碍膨胀区，不能只尝试 90° 切线。
      const sweep=[Math.PI/6,Math.PI/4,Math.PI*3/8,Math.PI/2,Math.PI*5/8].map(angle=>desired.clone().applyAxisAngle(new THREE.Vector3(0,1,0),side*angle));
      const headings=side===this.lastAvoidDir&&this.avoidHeading?[this.avoidHeading.clone(),...sweep]:sweep;
      for(const heading of headings){const probe=this.group.position.clone().addScaledVector(heading,probeDistance);if(collides(probe))continue;const next=this.group.position.clone().addScaledVector(heading,amount);if(collides(next))continue;this.group.position.copy(next);this.lastAvoidDir=side;this.avoidHeading=heading;return true;}
    }
    return false;
  }
  updateVertical(dt,map){
    if(this.jumping){this.verticalVelocity-=13.5*dt;this.group.position.y+=this.verticalVelocity*dt;const support=map.supportHeightAt?.(this.group.position,.38*this.def.scale,this.group.position.y)??0;if(this.verticalVelocity<=0&&this.group.position.y<=support+.08){this.groundY=support;this.group.position.y=support;this.verticalVelocity=0;this.jumping=false;this.bus.emit('enemy:land',{enemy:this,height:support});}return;}
    this.groundY=map.supportHeightAt?.(this.group.position,.38*this.def.scale,this.groundY+.12)??0;this.group.position.y=this.groundY;
  }
  pathDirection(target,map,dt){
    const direct=target.clone().sub(this.group.position).setY(0).normalize();if(!map.findPath)return direct;this.pathTimer-=dt;
    const goalMoved=!this.pathGoal||this.pathGoal.distanceToSquared(target)>6.25;
    if(this.pathTimer<=0||goalMoved){
      this.path=map.findPath(this.group.position,target,.42*this.def.scale);this.pathIndex=0;this.pathGoal=target.clone();this.pathTimer=.9+Math.random()*.3;this.stuckTime=0;
      this.bus.emit('enemy:path',{enemy:this,waypoints:this.path.length});
    }
    while(this.pathIndex<this.path.length){const p=this.path[this.pathIndex],distance=Math.hypot(p.x-this.group.position.x,p.z-this.group.position.z);if(distance>.24)break;this.pathIndex++;}
    const waypoint=this.path[this.pathIndex];return waypoint?new THREE.Vector3(waypoint.x-this.group.position.x,0,waypoint.z-this.group.position.z).normalize():direct;
  }
  // 用角色胸口高度沿连线采样；map.collides 与玩家/敌人的胶囊碰撞规则保持一致。
  hasLineOfSight(target,map,samples=5){
    const from=this.group.position.clone();from.y=.95*this.def.scale;const to=target.clone();to.y=Math.max(.75,to.y-.28);
    // 采用敌人胶囊半径，避免 5 个离散采样点恰好跨过一单位薄墙而产生假视线。
    const radius=.1*Math.min(1,this.def.scale);for(let i=1;i<=samples;i++){const p=from.clone().lerp(to,i/(samples+1));if(map.blocksSight?map.blocksSight(p,radius):map.collides(p,radius))return false;}return true;
  }
  updateMelee(dt,dist,verticalGap,dir,target,map){
    let speed=this.speed;if(this.def.boss&&this.health<this.maxHealth*.5){speed*=1.7;if(this.phase===1){this.phase=2;this.bus.emit('boss:phase',{enemy:this});this.bus.emit('boss:enrage',{enemy:this});}}
    if(this.type==='exploder'&&dist<6)this.warn=Math.min(1,this.warn+dt*1.8);
    const sightTarget=target.clone().add(new THREE.Vector3(0,1.05,0)),visible=this.hasLineOfSight(sightTarget,map);
    // 近战是独立的三维圆柱攻击区：进入范围后优先攻击，不依赖本帧是否移动失败。
    const attackHeight=this.def.attackHeight??1.5,inAttackArea=dist<=this.def.range&&Math.abs(verticalGap)<=attackHeight&&visible;
    if(inAttackArea){this.wantedMove=false;if(this.attackCd<=0)this.performMeleeAttack();return;}
    const moveDirection=visible?dir:this.pathDirection(target,map,dt);this.wantedMove=true;this.move(moveDirection,speed*dt,map);
  }
  performMeleeAttack(){
    this.attackCd=this.type==='exploder'?99:(this.def.boss?.7:1.05);
    this.bus.emit(this.type==='exploder'?'enemy:explode':'enemy:attack',{enemy:this,damage:this.def.damage,radius:this.def.range,attackHeight:this.def.attackHeight??1.5});
    this.bus.emit('enemy:attackSound',{enemy:this,enemyType:this.type,position:this.group.position});
    if(this.type==='exploder')this.die();
  }
  updateRanged(dt,dist,dir,target,map){
    const preferred=this.def.preferred,sightTarget=target.clone().setY(1.72),visible=this.hasLineOfSight(sightTarget,map);let moved=false;
    // 视线被挡时不蓄力、不射击，持续向玩家方向绕障寻找新的射界。
    if(!visible){this.wantedMove=true;moved=this.move(this.pathDirection(target,map,dt),this.speed*dt,map);}else if(dist<preferred*.72){this.wantedMove=true;moved=this.move(dir.clone().negate(),this.speed*dt,map);}else if(dist>preferred*1.12){this.wantedMove=true;moved=this.move(dir,this.speed*dt,map);}
    if(!visible){this.charge=0;return;}if(moved)return;
    if(this.def.role==='sniper'&&this.attackCd<=0){this.charge+=dt;if(this.charge===dt)this.bus.emit('enemy:sniperCharge',{enemy:this,duration:this.def.charge});if(this.charge>=this.def.charge){this.fireProjectile();this.charge=0;this.attackCd=2.7;}}
    else if(this.def.role!=='sniper'&&this.attackCd<=0&&dist<=this.def.range){this.fireProjectile();this.attackCd=this.type==='shooter'?.28:2.8;}
  }
  fireProjectile(){this.bus.emit('enemy:projectile',{enemy:this,type:this.def.projectile,damage:this.def.damage,speed:this.def.projectileSpeed});this.bus.emit('enemy:attackSound',{enemy:this,enemyType:this.type,position:this.group.position});}
  applyElement(type){if(type==='ice')this.slowTimer=1.5;else{this.burnTimer=2;this.burnTick=1;}this.bus.emit('enemy:element',{enemy:this,type});}
  updateHealthBar(){const ratio=Math.max(0,Math.min(1,this.health/Math.max(1,this.maxHealth))),fill=this.healthBar.userData.fill;fill.scale.x=.94*ratio;fill.position.x=-(.94-fill.scale.x)/2;this.healthBar.visible=this.alive!==false;}
  hit(damage,headshot=false,source=null,fromShot=false){if(!this.alive)return false;let applied=damage;if(this.def.armor&&source){const toSource=source.clone().sub(this.group.position).normalize(),forward=new THREE.Vector3(0,0,1).applyQuaternion(this.group.quaternion);if(forward.dot(toSource)>.2)applied*=1-this.def.armor;}this.health-=applied;this.updateHealthBar();if(this.def.role==='sniper'&&this.charge>0){this.charge=0;this.attackCd=1.2;this.bus.emit('enemy:sniperInterrupted',{enemy:this});}this.bus.emit('enemy:hit',{enemy:this,damage:applied,headshot,fromShot});if(this.health<=0)this.die();return applied;}
  die(){if(!this.alive)return;this.alive=false;this.bus.emit('enemy:killed',{enemy:this});this.group.rotation.x=-Math.PI/2;setTimeout(()=>{this.group.visible=false;this.group.rotation.set(0,0,0);this.bus.emit('enemy:despawn',{enemy:this});},420);}
}
