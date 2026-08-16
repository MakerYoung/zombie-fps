import * as THREE from 'three';
export class GameLoop {
  constructor(update,render){ this.update=update; this.render=render; this.clock=new THREE.Clock(); this.running=false; this.timeScale=1; }
  start(){ if(this.running)return; this.running=true; this.clock.start(); requestAnimationFrame(()=>this.tick()); }
  tick(){ if(!this.running)return; const dt=Math.min(this.clock.getDelta(),.05)*this.timeScale; this.update(dt); this.render(); requestAnimationFrame(()=>this.tick()); }
  slowMotion(scale=.35,duration=100){ this.timeScale=scale; clearTimeout(this.slowTimer); this.slowTimer=setTimeout(()=>this.timeScale=1,duration); }
}
