export class TouchInput {
  constructor(el, state, ui) {
    this.s = state;
    this.ui = ui;
    this.moveId = null;
    this.lookId = null;
    this.fireId = null;
    this.touchFireId = null;
    this.origin = { x: 0, y: 0 };
    this.lastLook = { x: 0, y: 0 };
    this.lastFire = { x: 0, y: 0 };
    el.addEventListener("touchstart", (e) => this.start(e), { passive: false });
    el.addEventListener("touchmove", (e) => this.move(e), { passive: false });
    el.addEventListener("touchend", (e) => this.end(e), { passive: false });
    el.addEventListener("touchcancel", (e) => this.end(e), { passive: false });

    // 按钮自身收到 Pointer Events 时直接响应，兼容鼠标调试与常规单指触控。
    ui.fireButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.fireId = e.pointerId;
      this.lastFire = { x: e.clientX, y: e.clientY };
      state.fire = true;
      ui.fireButton.setPointerCapture?.(e.pointerId);
    });
    ui.fireButton.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.fireId) return;
      e.preventDefault();
      const scale = Math.max(
        0.5,
        Math.min(2, Number(localStorage.getItem("fireLookScale")) || 1),
      );
      state.look.x += (e.clientX - this.lastFire.x) * scale;
      state.look.y += (e.clientY - this.lastFire.y) * scale;
      this.lastFire = { x: e.clientX, y: e.clientY };
    });
    const stopFire = (e) => {
      if (e.pointerId !== this.fireId) return;
      e.preventDefault();
      this.fireId = null;
      state.fire = false;
    };
    ui.fireButton.addEventListener("pointerup", stopFire);
    ui.fireButton.addEventListener("pointercancel", stopFire);
    ui.reloadButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.reload = true;
    });
    ui.jumpButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.jump = true;
    });
    ui.weaponButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      ui.triggerWeaponSwitch();
    });
  }

  // 多指手势常沿用首指的画布事件目标，因此按坐标命中按钮，避免移动时操作失效。
  actionAt(touch) {
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target?.closest("#reload")) this.s.reload = true;
    else if (target?.closest("#switchWeapon")) this.ui.triggerWeaponSwitch();
    else if (target?.closest("#jump")) this.s.jump = true;
    else if (target?.closest("#fire")) {
      this.touchFireId = touch.identifier;
      this.lastFire = { x: touch.clientX, y: touch.clientY };
      this.s.fire = true;
    } else return false;
    return true;
  }

  start(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.actionAt(t)) continue;
      if (t.clientX < innerWidth * 0.48 && this.moveId === null) {
        this.moveId = t.identifier;
        this.origin = { x: t.clientX, y: t.clientY };
      } else if (this.lookId === null) {
        this.lookId = t.identifier;
        this.lastLook = { x: t.clientX, y: t.clientY };
      }
    }
  }

  move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.moveId) {
        this.s.move.x = Math.max(-1, Math.min(1, (t.clientX - this.origin.x) / 55));
        this.s.move.y = Math.max(-1, Math.min(1, (this.origin.y - t.clientY) / 55));
      } else if (t.identifier === this.touchFireId) {
        const scale = Math.max(
          0.5,
          Math.min(2, Number(localStorage.getItem("fireLookScale")) || 1),
        );
        this.s.look.x += (t.clientX - this.lastFire.x) * scale;
        this.s.look.y += (t.clientY - this.lastFire.y) * scale;
        this.lastFire = { x: t.clientX, y: t.clientY };
      } else if (t.identifier === this.lookId) {
        this.s.look.x += t.clientX - this.lastLook.x;
        this.s.look.y += t.clientY - this.lastLook.y;
        this.lastLook = { x: t.clientX, y: t.clientY };
      }
    }
  }

  end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.moveId) {
        this.moveId = null;
        this.s.move = { x: 0, y: 0 };
      }
      if (t.identifier === this.lookId) this.lookId = null;
      if (t.identifier === this.touchFireId) {
        this.touchFireId = null;
        this.s.fire = false;
      }
    }
  }
}
