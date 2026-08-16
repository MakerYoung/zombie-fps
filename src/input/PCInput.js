export class PCInput {
  constructor(el,state){ this.el=el; this.s=state; this.keys=new Set();
    addEventListener('keydown',e=>{this.keys.add(e.code); if(e.code==='KeyR')state.reload=true;if(e.code==='Space')state.jump=true;}); addEventListener('keyup',e=>this.keys.delete(e.code));
    addEventListener('mousemove',e=>{if(document.pointerLockElement===el){state.look.x+=e.movementX;state.look.y+=e.movementY;}});
    el.addEventListener('mousedown',e=>{if(document.pointerLockElement!==el)el.requestPointerLock(); if(e.button===0)state.fire=true;if(e.button===2)state.aim=true;}); addEventListener('mouseup',e=>{if(e.button===0)state.fire=false;if(e.button===2)state.aim=false;}); el.addEventListener('contextmenu',e=>e.preventDefault());
    this.timer=setInterval(()=>{state.move.x=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);state.move.y=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);},16);
  }
}
