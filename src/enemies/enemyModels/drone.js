import * as THREE from 'three';

function add(group,parts,geometry,material,name,position,rotation=[0,0,0]){
  const part=new THREE.Mesh(geometry,material);part.name=name;part.position.set(...position);part.rotation.set(...rotation);part.castShadow=true;group.add(part);parts.push(part);return part;
}

export function droneModel(def,owner){
  const group=new THREE.Group(),parts=[];
  const shell=new THREE.MeshStandardMaterial({color:0x073c52,roughness:.24,metalness:.82,emissive:def.color,emissiveIntensity:.28});
  const glow=new THREE.MeshStandardMaterial({color:0x008fa8,roughness:.12,metalness:.35,emissive:def.color,emissiveIntensity:1.15});
  const accent=new THREE.MeshStandardMaterial({color:0x8f6b16,roughness:.3,metalness:.7,emissive:def.accent,emissiveIntensity:.7});
  const core=add(group,parts,new THREE.OctahedronGeometry(.43,2),glow,'drone-core',[0,1.32,0]);
  const ringA=add(group,parts,new THREE.TorusGeometry(.72,.055,8,32),shell,'drone-ring-a',[0,1.32,0],[Math.PI/2,0,0]);
  const ringB=add(group,parts,new THREE.TorusGeometry(.58,.045,8,28),accent,'drone-ring-b',[0,1.32,0],[0,Math.PI/2,0]);
  for(const side of [-1,1]){
    add(group,parts,new THREE.CylinderGeometry(.075,.09,.62,10),shell,'drone-cannon',[side*.34,1.25,-.38],[Math.PI/2,0,0]);
    add(group,parts,new THREE.CylinderGeometry(.1,.16,.3,10),glow,'drone-thruster',[side*.22,.82,0],[0,0,side*.12]);
  }
  add(group,parts,new THREE.ConeGeometry(.18,.42,10),accent,'drone-nozzle',[0,.78,0],[0,0,Math.PI]);
  parts.forEach(part=>{part.userData.enemy=owner;part.userData.baseEmissive=part.material.emissiveIntensity;});
  group.userData.modelType='drone';group.userData.animate=now=>{ringA.rotation.z=now*.85;ringB.rotation.x=now*1.15;core.rotation.y=now*.7;};
  return {group,parts};
}
