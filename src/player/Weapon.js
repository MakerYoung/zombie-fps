import {applyPose,defaultAnims} from '../weapons/animations.js';
import {applyWeaponRoll,rollWeaponPerks} from '../weapons/weaponPerks.js';

export class Weapon{
  constructor(camera,bus,stats,data){
    this.camera=camera;this.bus=bus;this.stats=stats;this.baseData=data;this.data=applyWeaponRoll(data,rollWeaponPerks(data));this.perkState={};this.anims=this.data.anims||defaultAnims();this.ammo=this.data.magazine;this.reserve=this.data.reserve;
    const model=this.data.makeModel();this.group=model.group;this.muzzle=model.muzzle;this.muzzleLight=model.muzzleLight;camera.add(this.group);this.restPosition=this.group.position.clone();this.restRotation=this.group.rotation.clone();this.restScale=this.group.scale.clone();this.rest={pos:this.restPosition,rot:this.restRotation,scale:this.restScale};
    this.cooldown=0;this.reloading=0;this.reloadDuration=0;this.reloadStage=0;this.fireTime=99;this.triggered=false;this.triggerHeld=false;this.burstRounds=0;this.burstTimer=0;this.charging=0;this.empoweredRounds=0;this.nextElement='ice';this.switchAnimation=null;this.switchLocked=false;this.lastYaw=camera.rotation.y;this.sprinting=false;this.sprintBlend=0;this.stowedTime=0;
    this.unsubscribeMovement=bus.on('player:movementState',state=>{this.sprinting=state.sprinting;});
  }
  hook(name,context={}){
    let value=context.damage;const payload=()=>({weapon:this,...context,damage:value}),base=this.data.effects?.[name]?.(payload());if(base!==undefined)value=base;
    for(const perk of this.data.perks||[]){const result=perk.hooks?.[name]?.(payload());if(result!==undefined)value=result;}return value;
  }
  update(dt,fire){
    this.cooldown-=dt;this.fireTime+=dt;this.stowedTime=this.group.visible?0:this.stowedTime+dt;this.triggerHeld=fire;
    if(this.burstRounds>0){this.burstTimer-=dt;if(this.burstTimer<=0){this.fireRound();this.burstRounds--;this.burstTimer=this.data.frame.burstInterval;}}
    if(this.charging>0){this.charging+=dt;if(!fire){this.charging=0;this.bus.emit('weapon:chargeCancel',{weapon:this});}else if(this.charging>=this.data.frame.chargeTime){this.charging=0;this.fireRound();}}
    if(this.stowedTime>2.5&&this.hasPerk('autoLoading')&&this.ammo<this.capacity()){this.finishReload();this.stowedTime=-999;}
    if(this.hasPerk('reconstruction')&&this.ammo<this.capacity()*2){this.perkState.reconstruct=(this.perkState.reconstruct||0)+dt;if(this.perkState.reconstruct>2){this.perkState.reconstruct=0;this.ammo++;}}
    this.sprintBlend=Math.max(0,Math.min(1,this.sprintBlend+(this.sprinting?dt*8:-dt*10)));const yaw=this.camera.rotation.y,yawDelta=Math.atan2(Math.sin(yaw-this.lastYaw),Math.cos(yaw-this.lastYaw)),yawRate=dt>0?yawDelta/dt:0;this.lastYaw=yaw;
    if(this.switchAnimation){this.updateSwitch(dt);if(!fire)this.triggered=false;return;}
    let reloadPose=null;if(this.reloading>0){this.reloading-=dt;const progress=1-this.reloading/this.reloadDuration;reloadPose=this.anims.reload({active:true,progress});const stage=Math.min(3,Math.floor(progress*3)+1);if(stage!==this.reloadStage){this.reloadStage=stage;this.bus.emit('weapon:reloadStage',{stage:['','remove','insert','chamber'][stage],weapon:this});}if(this.reloading<=0)this.finishReload();}
    const now=performance.now(),returnTime=.11+this.data.recoil*.7;applyPose(this.group,this.rest,[this.anims.recoil({fireTime:this.fireTime,returnTime,recoil:this.data.recoil}),reloadPose,this.anims.idle({now}),this.anims.moveSway({owner:this,yawRate,dt}),this.anims.sprint({now,blend:this.sprintBlend})]);if(!fire||this.sprinting)this.triggered=false;
  }
  hasPerk(id){return this.data.perks.some(p=>p.id===id);}
  tryShoot(){
    if(this.sprinting||this.switchLocked||this.switchAnimation||this.reloading>0||this.cooldown>0||this.burstRounds>0||this.charging>0)return false;if(this.ammo<=0){this.reload();return false;}const mode=this.data.fireMode;this.triggered=true;if(mode==='burst'){this.burstRounds=Math.min(this.data.frame.burstCount,this.ammo);this.burstTimer=0;return true;}if(mode==='charge'){this.charging=.0001;this.bus.emit('weapon:chargeStart',{weapon:this,duration:this.data.frame.chargeTime});return true;}return this.fireRound();
  }
  fireRound(){if(this.ammo<=0)return false;this.fireTime=0;this.ammo--;const rate=(this.data.fireMode==='auto'?this.stats.get('autoFireRate'):1)*(performance.now()<(this.perkState.desperadoUntil||0)?1.35:1);this.cooldown=1/(this.data.fireRate*this.stats.get('fireRate')*rate);this.hook('onShoot');this.bus.emit('weapon:shoot',{weapon:this,data:this.data});if(Math.random()<this.stats.get('doubleShotChance'))this.bus.emit('weapon:shoot',{weapon:this,data:this.data,echo:true});return true;}
  reload(){
    if(this.switchLocked||this.switchAnimation||this.reloading>0||this.ammo>=this.capacity()||this.reserve<=0)return false;if(this.memoryReady){this.finishReload();this.bus.emit('weapon:reload',{duration:0});return true;}
    let speed=this.stats.get('reloadSpeed');if(performance.now()<(this.perkState.outlaw||0))speed*=1.6;speed*=1+(this.perkState.rapidHit||0)*.08+(this.perkState.feeding||0)*.1;this.reloading=this.reloadDuration=this.data.reload/speed;this.reloadStage=0;this.bus.emit('weapon:reload',{duration:this.reloading});return true;
  }
  finishReload(){const need=this.capacity()-this.ammo,take=Math.min(need,this.reserve);this.ammo+=take;if(Number.isFinite(this.reserve))this.reserve-=take;this.hook('onReload');this.bus.emit('weapon:reloaded',{weapon:this});}
  capacity(){const heavy=this.data.slot===3?this.stats.get('heavyAmmo'):1;return Math.round(this.data.magazine*this.stats.get('magazine')*heavy);}
  addReserve(amount){if(!Number.isFinite(this.reserve)){const before=this.ammo;this.ammo=Math.min(this.capacity(),this.ammo+amount);return this.ammo-before;}const max=Math.max(this.data.magazine,this.data.reserve||0)*this.stats.get('heavyAmmo'),before=this.reserve;this.reserve=Math.min(Math.ceil(max),this.reserve+amount);this.hook('onAmmoPickup',{amount:this.reserve-before});return this.reserve-before;}
  beginSwitch(direction,onComplete){this.group.visible=true;this.switchLocked=true;this.switchAnimation={direction,elapsed:0,duration:.25,onComplete};applyPose(this.group,this.rest,[this.anims.switch({animation:this.switchAnimation})]);}
  updateSwitch(dt){const animation=this.switchAnimation;if(!animation)return;animation.elapsed=Math.min(animation.duration,animation.elapsed+dt);applyPose(this.group,this.rest,[this.anims.switch({animation})]);if(animation.elapsed/animation.duration>=1){this.switchAnimation=null;this.switchLocked=false;animation.onComplete?.(this);}}
  dispose(){this.unsubscribeMovement?.();this.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose();m.dispose();});}});this.camera.remove(this.group);}
}
