import * as THREE from 'three';

const textureCache = new Map();
function texture(key, base, accent) {
  if (textureCache.has(key)) return textureCache.get(key);
  const size=16, data=new Uint8Array(size*size*4), a=new THREE.Color(base), b=new THREE.Color(accent);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const stripe=((x+y*2)%7)<2, c=stripe?b:a, grain=((x*17+y*31)%19)/120, i=(y*size+x)*4;
    data[i]=Math.min(255,c.r*255+grain*255);data[i+1]=Math.min(255,c.g*255+grain*180);data[i+2]=Math.min(255,c.b*255+grain*120);data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.needsUpdate=true;textureCache.set(key,t);return t;
}
function material(key,color,accent,metal=.55){return new THREE.MeshStandardMaterial({color:0xffffff,map:texture(key,color,accent),roughness:.42,metalness:metal,emissive:accent,emissiveIntensity:.12});}
function mesh(g,geo,mat,name,pos,scale=[1,1,1]){const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;g.add(m);return m;}

// 每种单位均由头、躯干、四肢和独立装备组成，并使用条纹/颗粒程序化纹理。
export function createEnemyModel(type,def,owner){
  const g=new THREE.Group(), armor=material(`${type}:armor`,def.color,def.accent,.72), suit=material(`${type}:suit`,0x172039,def.color,.28), glow=material(`${type}:glow`,def.accent,0xffffff,.48);
  glow.emissiveIntensity=.75;
  const parts=[];
  parts.push(mesh(g,new THREE.BoxGeometry(.7,.82,.42),armor,'body',[0,1.08,0]));
  parts.push(mesh(g,new THREE.SphereGeometry(.27,10,7),glow,'head',[0,1.73,0]));
  for(const side of [-1,1]){
    parts.push(mesh(g,new THREE.BoxGeometry(.2,.68,.22),suit,'body',[side*.48,1.1,0]));
    const leg=mesh(g,new THREE.BoxGeometry(.24,.72,.28),suit,'body',[side*.2,.38,0]);leg.userData.walkLimb=true;parts.push(leg);
    parts.push(mesh(g,new THREE.BoxGeometry(.3,.2,.4),armor,'body',[side*.2,.08,-.05]));
  }
  parts.push(mesh(g,new THREE.BoxGeometry(.78,.2,.5),armor,'body',[0,1.42,0]));
  if(type==='heavy'||type==='boss')parts.push(mesh(g,new THREE.BoxGeometry(.8,.92,.12),armor,'shield',[0,1.08,-.29],[1.15,1.05,1]));
  if(type==='exploder')parts.push(mesh(g,new THREE.SphereGeometry(.34,10,7),glow,'core',[0,1.08,-.35]));
  else if(type==='rocketeer')parts.push(mesh(g,new THREE.CylinderGeometry(.13,.17,.9,8),glow,'launcher',[.55,1.35,0],[1,1,1]));
  else if(type==='sniper')parts.push(mesh(g,new THREE.BoxGeometry(.12,.12,1.25),glow,'rifle',[.42,1.2,-.38]));
  else if(type==='shooter')parts.push(mesh(g,new THREE.BoxGeometry(.16,.16,.72),glow,'rifle',[.42,1.18,-.28]));
  else parts.push(mesh(g,new THREE.BoxGeometry(.46,.16,.18),glow,'weapon',[.5,1.08,-.18]));
  parts.forEach(p=>{p.userData.enemy=owner;p.userData.baseEmissive=p.material.emissiveIntensity;});
  g.userData.modelType=type;return {group:g,parts};
}
