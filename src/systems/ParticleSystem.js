import * as THREE from 'three';import {Pool} from '../utils/Pool.js';
export class ParticleSystem{
  constructor(scene,bus,quality='medium'){this.scene=scene;this.max=quality==='low'?35:quality==='high'?100:65;this.pool=new Pool(()=>this.make(),this.max);bus.on('fx:burst',e=>this.burst(e.position,e.color,e.count));bus.on('enemy:killed',({enemy})=>this.burst(enemy.group.position.clone().addScalar(.5),0x25d9ff,18));}
  make(){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.045,0),new THREE.MeshBasicMaterial());m.visible=false;this.scene.add(m);return{m,v:new THREE.Vector3(),life:0};}
  burst(pos,color,count){for(let i=0;i<Math.min(count,this.max);i++){const p=this.pool.acquire();if(!p)break;p.m.visible=true;p.m.position.copy(pos);p.m.material.color.set(color);p.v.set((Math.random()-.5)*5,Math.random()*4,(Math.random()-.5)*5);p.life=.25+Math.random()*.35;}}
  update(dt){for(const p of this.pool.active){p.life-=dt;p.v.y-=9*dt;p.m.position.addScaledVector(p.v,dt);p.m.scale.setScalar(Math.max(.1,p.life*2));if(p.life<=0){p.m.visible=false;this.pool.release(p);}}}
}
