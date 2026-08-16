// 把世界坐标转换为以玩家为原点、朝向固定向上的雷达坐标。
export function worldToRadar(player, enemy, yaw, radius = 76, range = 40) {
  const dx = enemy.x - player.x;
  const dz = enemy.z - player.z;
  const distance = Math.hypot(dx, dz);
  const scale = (Math.min(distance, range) / range) * radius;
  if (distance === 0) return { x: 0, y: 0, distance };
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  // 玩家右方映射到 +x，玩家前方映射到画布 -y。
  return {
    x: ((dx * cos - dz * sin) / distance) * scale,
    y: ((dx * sin + dz * cos) / distance) * scale,
    distance,
  };
}

export class Radar {
  constructor(hud, camera, enemies, stats = null) {
    this.camera = camera;
    this.enemies = enemies;
    this.stats = stats;
    this.canvas = document.createElement("canvas");
    this.canvas.id = "radar";
    this.canvas.width = this.canvas.height = 180;
    hud.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  }

  update() {
    const c = this.ctx;
    const R = 76;
    const C = 90;
    c.clearRect(0, 0, 180, 180);
    c.save();
    c.translate(C, C);
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.clip();
    const g = c.createRadialGradient(0, 0, 8, 0, 0, R);
    g.addColorStop(0, "rgba(24,55,61,.46)");
    g.addColorStop(1, "rgba(5,20,25,.84)");
    c.fillStyle = g;
    c.fillRect(-R, -R, R * 2, R * 2);
    c.strokeStyle = "rgba(106,225,238,.22)";
    for (const r of [25, 50, 75]) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
    }
    const player = {
      x: this.camera.position.x,
      z: this.camera.position.z,
    };
    const yaw = this.camera.rotation.y;
    for (const enemy of this.enemies.active) {
      if (!enemy.alive) continue;
      const range = 40 * (this.stats?.get('radarRange') || 1);
      const point = worldToRadar(player, enemy.group.position, yaw, R, range);
      c.globalAlpha = point.distance > range ? 0.42 : 1;
      c.fillStyle = "#ff394f";
      c.beginPath();
      const size = enemy.def.boss ? 6 : enemy.def.elite ? 4.5 : 3.5;
      if (enemy.def.boss) {
        c.moveTo(point.x, point.y - size);
        c.lineTo(point.x + size, point.y);
        c.lineTo(point.x, point.y + size);
        c.lineTo(point.x - size, point.y);
        c.closePath();
      } else c.arc(point.x, point.y, size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // 玩家指示固定在圆心；雷达随玩家旋转，所以箭头始终指向屏幕上方。
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(-6, 7);
    c.lineTo(0, 4);
    c.lineTo(6, 7);
    c.closePath();
    c.fillStyle = "#c9ffff";
    c.fill();
    c.restore();
    c.strokeStyle = "#9df7ff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(C, C, R, 0, Math.PI * 2);
    c.stroke();
  }
}
