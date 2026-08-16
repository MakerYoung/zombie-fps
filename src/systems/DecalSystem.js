import * as THREE from 'three'; import { Pool } from '../utils/Pool.js';
export class DecalSystem {
  constructor(scene,bus){this.scene=scene;this.pool=new Pool(()=>this.make(),30);bus.on('world:hit',e=>this.place(e.point,e.normal));}
  make(){const object3D=new THREE.Mesh(new THREE.CircleGeometry(.075,8),new THREE.MeshBasicMaterial({color:0x17120f,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));object3D.visible=false;this.scene.add(object3D);return{object3D,life:0};}
  place(point,normal){const d=this.pool.acquire();d.object3D.visible=true;d.object3D.position.copy(point).addScaledVector(normal,.006);d.object3D.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);d.life=6;d.object3D.material.opacity=.85;}
  update(dt){for(const d of [...this.pool.active]){d.life-=dt;d.object3D.material.opacity=Math.min(.85,d.life);if(d.life<=0)this.pool.release(d);}}
}
