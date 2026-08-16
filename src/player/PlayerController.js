import * as THREE from 'three';
export class PlayerController {
  constructor(camera,input,map,stats,bus){this.camera=camera;this.input=input;this.map=map;this.stats=stats;this.bus=bus;this.velocity=new THREE.Vector3();this.yaw=0;this.pitch=0;this.pitchOffset=0;this.height=1.72;this.camera.position.set(0,this.height,8);this.grounded=true;this.stepDistance=0;this.leftFoot=false;
    // 轻量 pitch 后坐力独立于鼠标视角，按枪种累积并在约 0.35 秒内平滑恢复。
    bus.on('weapon:shoot',({data})=>{const kick={pistol:.004,smg:.003,shotgun:.011}[data.id]??.004;this.pitchOffset=Math.min(.025,this.pitchOffset+kick);});}
  sensitivity(){const value=Math.max(1,Math.min(10,Number(localStorage.getItem('sensitivity'))||7));return value<=5?.001+(value-1)*.001:.005+(value-5)*.003;}
  update(dt,active){if(!active)return;const look=this.input.consumeLook(),sens=this.sensitivity();this.yaw-=look.x*sens;this.pitch=Math.max(-1.45,Math.min(1.45,this.pitch-look.y*sens));this.pitchOffset*=Math.exp(-dt/.115);this.camera.rotation.set(this.pitch+this.pitchOffset,this.yaw,0);this.bus.emit('recoil:update',{pitchOffset:this.pitchOffset});
    // 准星与同一个 pitchOffset 同步，连续开火时保持轻微上抬并自然回落。
    if(typeof document!=='undefined')document.querySelector('#crosshair')?.style.setProperty('--kick',`${-Math.min(18,this.pitchOffset*2400)}px`);
    const m=this.input.state.move,len=Math.hypot(m.x,m.y)||1,lowHealth=this.healthRatio?.()??1,speed=this.stats.get('moveSpeed')*(lowHealth<.35?this.stats.get('lowHealthSpeed'):1);const f=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)),r=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));const delta=f.multiplyScalar(m.y/len).add(r.multiplyScalar(m.x/len)).multiplyScalar(speed*dt);
    // 分轴碰撞：某一轴被墙挡住时仍保留另一轴位移，从而沿墙自然滑动。
    const nextX=this.camera.position.clone();nextX.x+=delta.x;if(!this.map.collides(nextX,.38))this.camera.position.x=nextX.x;
    const nextZ=this.camera.position.clone();nextZ.z+=delta.z;if(!this.map.collides(nextZ,.38))this.camera.position.z=nextZ.z;
    const moving=delta.length()/Math.max(dt,.001)>.2;if(moving&&this.grounded){this.stepDistance+=delta.length();const stride=Math.max(.95,1.55-speed*.035);if(this.stepDistance>=stride){this.stepDistance=0;this.leftFoot=!this.leftFoot;const material=this.map.surfaceAt?.(this.camera.position)==='stone'?'stone':'ground';this.bus.emit('player:footstep',{position:this.camera.position,material,left:this.leftFoot,speed});}}
    if(this.input.consume('jump')&&this.grounded){this.velocity.y=5.2*this.stats.get('jumpHeight');this.grounded=false;this.bus.emit('player:jump',{position:this.camera.position});}this.velocity.y-=13*dt;this.camera.position.y+=this.velocity.y*dt;
    const floor=this.height+(this.map.heightAt?.(this.camera.position)||0);if(this.camera.position.y<=floor){const landed=!this.grounded&&this.velocity.y<-.8;this.camera.position.y=floor;this.velocity.y=0;this.grounded=true;if(landed)this.bus.emit('player:land',{position:this.camera.position});}
  }
}
