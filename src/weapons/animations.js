const ZERO = () => ({ pos: [0, 0, 0], rot: [0, 0, 0], scale: [0, 0, 0] });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function defaultAnims(overrides = {}) {
  const config = {
    idle: { amplitude: .002, frequency: .008 },
    reload: { drop: .075, roll: .42 },
    moveSway: { maxPosition: .03, maxRotation: .045, rateScale: .004, decay: 4 },
  };
  for (const key of Object.keys(config)) Object.assign(config[key], overrides[key]);
  const swayByOwner = new WeakMap();
  return {
    config,
    recoil(ctx) {
      if (ctx.fireTime >= ctx.returnTime) return ZERO();
      const t = ctx.fireTime / ctx.returnTime;
      const k = t < .18 ? t / .18 : Math.exp(-(t - .18) * 4.8) * Math.cos((t - .18) * Math.PI * 2.2);
      return { pos: [0, 0, ctx.recoil * .48 * k], rot: [ctx.recoil * k, 0, 0], scale: [0, 0, 0] };
    },
    idle(ctx) {
      return { pos: [0, Math.sin(ctx.now * config.idle.frequency) * config.idle.amplitude, 0], rot: [0, 0, 0], scale: [0, 0, 0] };
    },
    reload(ctx) {
      if (!ctx.active) return ZERO();
      const wave = Math.sin(Math.PI * ctx.progress);
      return { pos: [0, -config.reload.drop * wave, 0], rot: [0, 0, -config.reload.roll * wave], scale: [0, 0, 0] };
    },
    switch(ctx) {
      if (!ctx.animation) return ZERO();
      const t = clamp(ctx.animation.elapsed / ctx.animation.duration, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      if (ctx.animation.direction === 'out') {
        return { pos: [.08 * e, -.15 * e, 0], rot: [-25 * Math.PI / 180 * e, 0, 0], scale: [-.15 * e, -.15 * e, -.15 * e] };
      }
      return { pos: [.06 * (1 - e), -.18 * (1 - e), 0], rot: [20 * Math.PI / 180 * (1 - e), 0, 0], scale: [-.15 * (1 - e), -.15 * (1 - e), -.15 * (1 - e)] };
    },
    moveSway(ctx) {
      const target = clamp(ctx.yawRate * config.moveSway.rateScale, -config.moveSway.maxPosition, config.moveSway.maxPosition);
      const previous = swayByOwner.get(ctx.owner) || 0;
      const sway = Math.abs(target) > 1e-9 ? target : previous * Math.exp(-config.moveSway.decay * ctx.dt);
      swayByOwner.set(ctx.owner, sway);
      const ratio = config.moveSway.maxPosition ? sway / config.moveSway.maxPosition : 0;
      return { pos: [-sway, 0, 0], rot: [0, 0, -ratio * config.moveSway.maxRotation], scale: [0, 0, 0] };
    },
  };
}

export function applyPose(group, rest, poses) {
  group.position.copy(rest.pos);
  group.rotation.copy(rest.rot);
  group.scale.copy(rest.scale);
  for (const pose of poses) {
    if (!pose) continue;
    group.position.x += pose.pos[0]; group.position.y += pose.pos[1]; group.position.z += pose.pos[2];
    group.rotation.x += pose.rot[0]; group.rotation.y += pose.rot[1]; group.rotation.z += pose.rot[2];
    group.scale.x += rest.scale.x * pose.scale[0]; group.scale.y += rest.scale.y * pose.scale[1]; group.scale.z += rest.scale.z * pose.scale[2];
  }
}
