import * as THREE from 'three';
import {LOOT_TYPES,rollLoot} from './lootTypes.js';
import {WEAPONS} from '../weapons/weaponData.js';

export class LootSystem{
  constructor(scene,bus,player,{random=Math.random,maxDrops=40}={}){
    this.scene=scene;this.bus=bus;this.player=player;this.random=random;this.maxDrops=maxDrops;this.active=[];
    bus.on('enemy:killed',({enemy})=>{for(const type of rollLoot(enemy,this.random))this.spawn(type,enemy.group.position);});
    bus.on('loot:spawn',({type,position})=>this.spawn(type,position));
  }
  spawn(typeId,position){
    const weaponId=typeof typeId==='object'?typeId.weaponId:null,weapon=WEAPONS[weaponId];
    const def=weapon?{id:`weapon:${weaponId}`,name:weapon.name,kind:'weapon',weaponId,color:weapon.rarity==='legendary'?0xffc44d:0x55baff,life:45}:LOOT_TYPES[typeId];
    if(!def)return null;if(this.active.length>=this.maxDrops)this.remove(this.active[0]);
    const size=weapon?.rarity==='legendary'?.42:.32,group=new THREE.Group();
    const core=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),new THREE.MeshStandardMaterial({color:def.color,emissive:def.color,emissiveIntensity:2.4,roughness:.16,metalness:.4,transparent:true,opacity:.92}));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(size*.95,.045,8,18),new THREE.MeshBasicMaterial({color:def.color,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
    ring.rotation.x=Math.PI/2;group.add(core,ring);group.position.copy(position).add(new THREE.Vector3(0,1,0));group.userData.loot=true;this.scene.add(group);
    const drop={typeId:def.id,def,group,baseY:group.position.y,age:0,phase:this.random()*Math.PI*2};this.active.push(drop);this.bus.emit('loot:dropped',{drop,type:def});return drop;
  }
  update(dt,active=true){
    if(!active)return;const player=this.player.position;
    for(const drop of [...this.active]){drop.age+=dt;drop.group.rotation.y+=dt*1.8;drop.group.position.y=drop.baseY+Math.sin(drop.age*2.4+drop.phase)*.16;if(drop.group.position.distanceTo(player)<2.05){this.bus.emit('loot:picked',{drop,type:drop.def});this.remove(drop);}else if(drop.age>drop.def.life)this.remove(drop);}
  }
  remove(drop){const i=this.active.indexOf(drop);if(i>=0)this.active.splice(i,1);drop.group.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});this.scene.remove(drop.group);}
  clear(){for(const drop of [...this.active])this.remove(drop);}
}
