import * as THREE from 'three';
import { arm, builder, muzzle } from './modelUtils.js';
import { defaultAnims } from './animations.js';

export const longbow = {
  id: 'longbow', category: 'pistol', name: '长弓', desc: '远距一击,爆头成倍', rarity: 'rare',
  damage: 120, fireRate: .9, magazine: 5, reserve: Infinity, reload: 2.2,
  spread: .001, recoil: .06, pellets: 1, auto: false, headshotMultiplier: 3,
  anims: defaultAnims({ idle: { amplitude: .0015 }, moveSway: { maxPosition: .022, maxRotation: .035 } }),
  makeModel() {
    const { group, mat, part } = builder();
    const dark = mat(0x20262c, 'steel', .72, .3), black = mat(0x0c1014, null, .7, .28);
    const orange = mat(0xff7626, null, .62, .3), glass = mat(0x173743, null, .42, .16);
    group.position.set(.25, -.34, -.8);
    part(new THREE.BoxGeometry(.24, .18, .92), dark, [0, .05, -.58]);
    part(new THREE.BoxGeometry(.19, .13, .38), orange, [0, .045, -.7]);
    part(new THREE.CylinderGeometry(.038, .046, 1.06, 16), black, [0, .07, -1.56], [Math.PI / 2, 0, 0]);
    part(new THREE.CylinderGeometry(.065, .05, .12, 16), orange, [0, .07, -2.12], [Math.PI / 2, 0, 0]);
    part(new THREE.CylinderGeometry(.074, .074, .52, 16), black, [0, .25, -.66], [Math.PI / 2, 0, 0]);
    part(new THREE.CylinderGeometry(.06, .06, .02, 16), glass, [0, .25, -.93], [Math.PI / 2, 0, 0]);
    part(new THREE.CylinderGeometry(.085, .085, .035, 16), orange, [0, .25, -.39], [Math.PI / 2, 0, 0]);
    for (const z of [-.82, -.5]) part(new THREE.BoxGeometry(.045, .12, .035), black, [0, .16, z]);
    part(new THREE.BoxGeometry(.19, .33, .18), dark, [0, -.18, -.22], [-.22, 0, 0]);
    part(new THREE.BoxGeometry(.22, .2, .58), dark, [0, -.04, .18], [-.08, 0, 0]);
    part(new THREE.BoxGeometry(.25, .25, .1), orange, [0, -.05, .49]);
    part(new THREE.TorusGeometry(.055, .012, 8, 16, Math.PI), black, [0, -.08, -.38], [Math.PI / 2, 0, 0]);
    arm(group, { grip: [.015, -.24, -.13] });
    arm(group, { side: 'left', grip: [-.035, -.08, -1.02], entry: [-.24, -.44, .03] });
    return { ...muzzle(group, [0, .07, -2.2], 0xff8a30), group };
  },
  effects: { onShoot() {}, onHit() {}, onKill() {}, onReload() {} },
};
