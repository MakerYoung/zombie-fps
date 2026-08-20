import * as THREE from 'three';
import {builder,arm,muzzle} from './modelUtils.js';
const SHAPES={
  rifle:{length:.78,body:.27,barrel:.62,stock:.38,hands:2},
  smg:{length:.58,body:.25,barrel:.42,stock:.25,hands:2},
  scout:{length:.9,body:.25,barrel:.75,stock:.42,hands:2},
  pulse:{length:.82,body:.29,barrel:.62,stock:.4,hands:2},
  handcannon:{length:.55,body:.28,barrel:.48,stock:.2,hands:1},
  sidearm:{length:.42,body:.21,barrel:.3,stock:.15,hands:1},
  sniper:{length:1.05,body:.24,barrel:.9,stock:.45,hands:2},
  shotgun:{length:.9,body:.3,barrel:.78,stock:.42,hands:2},
  fusion:{length:.76,body:.32,barrel:.52,stock:.35,hands:2},
  machinegun:{length:.9,body:.34,barrel:.72,stock:.4,hands:2},
  launcher:{length:.78,body:.38,barrel:.65,stock:.35,hands:2},
  linear:{length:1.02,body:.3,barrel:.88,stock:.42,hands:2},
};
export function makeCatalogModel(data){
  const s=SHAPES[data.archetype]||SHAPES.rifle,{group,mat,part}=builder(),primary=mat(data.colors[0],data.texture||'steel',.58,.36),dark=mat(data.colors[1]||0x161b20,'camo',.48,.45),accent=mat(data.colors[2]||0xffa53b,null,.45,.3);
  group.position.set(.25,-.34,-.78);part(new THREE.BoxGeometry(s.body,.22,s.length),primary,[0,.03,-.42]);part(new THREE.BoxGeometry(s.body*.72,.13,s.stock),dark,[0,-.02,.12]);
  part(new THREE.CylinderGeometry(.035,.045,s.barrel,14),dark,[0,.07,-.42-s.length/2-s.barrel/2],[Math.PI/2,0,0]);
  for(let i=0;i<4;i++)part(new THREE.BoxGeometry(s.body*.86,.018,.035),accent,[0,.155,-.25-i*.11]);
  part(new THREE.BoxGeometry(.15,.3,.17),dark,[0,-.2,-.2],[.16,0,0]);part(new THREE.TorusGeometry(.058,.012,8,16,Math.PI),dark,[0,-.07,-.15],[Math.PI/2,0,0]);
  if(['sniper','scout','linear'].includes(data.archetype)){part(new THREE.CylinderGeometry(.055,.055,.34,12),accent,[0,.22,-.42],[0,0,Math.PI/2]);part(new THREE.CylinderGeometry(.075,.075,.09,12),dark,[0,.22,-.42],[0,0,Math.PI/2]);}
  if(['machinegun','launcher'].includes(data.archetype))part(new THREE.BoxGeometry(.24,.3,.25),accent,[0,-.16,-.48]);
  arm(group,{grip:[.015,-.23,-.12]});if(s.hands===2)arm(group,{side:'left',grip:[-.04,-.1,-.65],entry:[-.23,-.44,.06]});
  const muzzleZ=-.42-s.length/2-s.barrel;return {...muzzle(group,[0,.07,muzzleZ],data.colors[2]||0xff9b38),group};
}
