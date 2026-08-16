import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { worldToRadar } from "../src/ui/Radar.js";

const output = new URL("../artifacts/requested-changes/", import.meta.url);
fs.mkdirSync(output, { recursive: true });
const assert = (condition, message, data) => {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(data)}`);
};

// 纯函数验收：两个相反出生朝向的“正前方”都必须落在雷达正上方。
const radarUnit = {
  yaw0: worldToRadar({ x: 0, z: 0 }, { x: 0, z: -10 }, 0),
  yawPi: worldToRadar({ x: 0, z: 0 }, { x: 0, z: 10 }, Math.PI),
};
for (const point of Object.values(radarUnit))
  assert(Math.abs(point.x) < 1e-8 && point.y < 0, "雷达纯函数方向错误", radarUnit);

const port = 41742;
const server = spawn(
  "npm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"], detached: true },
);
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Vite 启动超时")), 15000);
  const done = (data) => {
    if (String(data).includes("Local:")) {
      clearTimeout(timer);
      resolve();
    }
  };
  server.stdout.on("data", done);
  server.stderr.on("data", done);
});

const touchPoint = (box, id) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
  id,
  radiusX: 2,
  radiusY: 2,
  force: 1,
});

let browser;
try {
  await ready;
  browser = await chromium.launch({ headless: true });

  // 桌面尺寸用于清晰展示三个武器分组。
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const loadoutPage = await desktop.newPage();
  await loadoutPage.goto(`http://127.0.0.1:${port}?verify=1`);
  await loadoutPage.locator("#start").click();
  const loadout = await loadoutPage.evaluate(() => ({
    groups: [...document.querySelectorAll(".weaponGroup")].map((group) => ({
      category: group.dataset.category,
      title: group.querySelector("h4").textContent.trim(),
      selected: group.querySelector(".selected")?.dataset.weapon,
    })),
    counter: document.querySelector(".loadoutBox > h3 small")?.textContent,
  }));
  assert(loadout.groups.length === 3, "Loadout 不是三个分组", loadout);
  await loadoutPage.screenshot({ path: new URL("loadout-3-groups-1280x720.png", output).pathname });
  await loadoutPage.locator("#confirmLoadout").click();
  await loadoutPage.waitForTimeout(80);
  const inventory = await loadoutPage.evaluate(() => ({
    length: window.__verifyGame.inventory.length,
    categories: window.__verifyGame.inventory.map((weapon) => weapon.data.category),
    ids: window.__verifyGame.inventory.map((weapon) => weapon.data.id),
    currentId: window.__verifyGame.weapon.data.id,
    currentCategory: window.__verifyGame.weapon.data.category,
  }));
  assert(inventory.length === 3 && inventory.currentCategory === "auto", "三武器背包或默认主手错误", inventory);
  console.log("[验收] Loadout 与三武器背包通过");

  const mobile = await browser.newContext({
    viewport: { width: 812, height: 375 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });

  const verifyRadar = async (mapId, fileName) => {
    const page = await mobile.newPage();
    await page.goto(`http://127.0.0.1:${port}?verify=1`);
    await page.evaluate((id) => {
      document.querySelector("#start").click();
      document.querySelector(`[data-map="${id}"]`).click();
      document.querySelector("#confirmLoadout").click();
    }, mapId);
    await page.waitForTimeout(80);
    const result = await page.evaluate(() => {
      const game = window.__verifyGame;
      game.enemies.clear();
      const enemy = game.enemies.spawn("elite", 1);
      const yaw = game.player.yaw;
      const camera = game.engine.camera;
      camera.rotation.set(0, yaw, 0);
      enemy.group.position.set(
        camera.position.x - Math.sin(yaw) * 15,
        0,
        camera.position.z - Math.cos(yaw) * 15,
      );
      game.state = "paused";
      game.radar.update();
      document.querySelector("#menuBtn").style.visibility = "hidden";
      const canvas = document.querySelector("#radar");
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let sx = 0, sy = 0, count = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (pixels[i] > 210 && pixels[i + 1] < 100 && pixels[i + 2] < 120) {
          sx += x;
          sy += y;
          count++;
        }
      }
      return {
        yaw,
        player: [camera.position.x, camera.position.z],
        enemy: [enemy.group.position.x, enemy.group.position.z],
        redCentroid: [sx / count, sy / count],
        center: [canvas.width / 2, canvas.height / 2],
        redPixels: count,
      };
    });
    assert(
      result.redPixels > 0 && Math.abs(result.redCentroid[0] - result.center[0]) < 2 && result.redCentroid[1] < result.center[1],
      `${mapId} 正前方敌人未显示在雷达上方`,
      result,
    );
    await page.locator("#radar").screenshot({ path: new URL(fileName, output).pathname });
    await page.close();
    return result;
  };
  const radar = {
    base: await verifyRadar("base", "radar-base-front.png"),
    transportShip: await verifyRadar("transportShip", "radar-transportShip-front.png"),
  };
  console.log("[验收] base / TransportShip 雷达通过");

  const page = await mobile.newPage();
  const cdp = await mobile.newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  await page.goto(`http://127.0.0.1:${port}?verify=1`);
  await page.evaluate(() => {
    document.querySelector("#start").click();
    document.querySelector("#confirmLoadout").click();
  });
  await page.waitForTimeout(80);

  const moveStart = { x: 90, y: 300, id: 11, radiusX: 2, radiusY: 2, force: 1 };
  const moveHeld = { ...moveStart, y: 235 };
  const beginMove = async () => {
    await touch("touchStart", [moveStart]);
    await touch("touchMove", [moveHeld]);
    await page.waitForTimeout(25);
  };
  const secondFinger = async (selector, id) => {
    const box = await page.evaluate((value) => {
      const element = document.querySelector(value);
      const rect = element?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    }, selector);
    assert(box?.width > 0 && box?.height > 0, "触摸按钮当前不可见", { selector, box });
    const point = touchPoint(box, id);
    await touch("touchStart", [moveHeld, point]);
    await page.waitForTimeout(45);
  };

  await page.evaluate(() => window.__verifyGame.weapon.ammo--);
  await beginMove();
  await secondFinger("#reload", 12);
  const reloadWhileMoving = await page.evaluate(() => ({
    move: { ...window.__verifyGame.input.state.move },
    reloading: window.__verifyGame.weapon.reloading,
  }));
  assert(reloadWhileMoving.move.y > 0.5 && reloadWhileMoving.reloading > 0, "移动中换弹失败", reloadWhileMoving);
  await touch("touchEnd", []);

  await beginMove();
  const weaponBefore = await page.evaluate(() => window.__verifyGame.weapon.data.id);
  await secondFinger("#switchWeapon", 13);
  const switchWhileMoving = await page.evaluate((before) => ({
    before,
    after: window.__verifyGame.weapon.data.id,
    move: { ...window.__verifyGame.input.state.move },
  }), weaponBefore);
  assert(switchWhileMoving.move.y > 0.5 && switchWhileMoving.after !== switchWhileMoving.before, "移动中切枪失败", switchWhileMoving);
  await touch("touchEnd", []);

  await beginMove();
  const ammoBefore = await page.evaluate(() => {
    const game = window.__verifyGame;
    game.weapon.reloading = 0;
    return game.weapon.ammo;
  });
  await secondFinger("#fire", 14);
  await page.waitForTimeout(90);
  const fireWhileMoving = await page.evaluate((before) => ({
    before,
    after: window.__verifyGame.weapon.ammo,
    firing: window.__verifyGame.input.state.fire,
    move: { ...window.__verifyGame.input.state.move },
  }), ammoBefore);
  assert(fireWhileMoving.move.y > 0.5 && fireWhileMoving.firing && fireWhileMoving.after < fireWhileMoving.before, "移动中开火回归失败", fireWhileMoving);
  await touch("touchEnd", []);
  console.log("[验收] 移动中换弹、切枪、开火通过");

  const jumpBox = await page.evaluate(() => {
    const rect = document.querySelector("#jump").getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const jumpPoint = touchPoint(jumpBox, 15);
  const groundY = await page.evaluate(() => window.__verifyGame.engine.camera.position.y);
  await touch("touchStart", [jumpPoint]);
  await touch("touchEnd", []);
  let maxY = groundY;
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(30);
    maxY = Math.max(maxY, await page.evaluate(() => window.__verifyGame.engine.camera.position.y));
  }
  await page.waitForTimeout(500);
  const mobileJump = await page.evaluate((ground) => ({
    ground,
    finalY: window.__verifyGame.engine.camera.position.y,
    velocityY: window.__verifyGame.player.velocity.y,
    grounded: window.__verifyGame.player.grounded,
  }), groundY);
  mobileJump.maxY = maxY;
  assert(maxY > groundY + 0.2 && mobileJump.grounded && Math.abs(mobileJump.finalY - groundY) < 0.01, "手机跳跃未上升并回落", mobileJump);
  console.log("[验收] 手机跳跃通过");

  const pcPage = await desktop.newPage();
  await pcPage.goto(`http://127.0.0.1:${port}?verify=1`);
  await pcPage.evaluate(() => {
    document.querySelector("#start").click();
    document.querySelector("#confirmLoadout").click();
  });
  await pcPage.waitForTimeout(50);
  const pcGround = await pcPage.evaluate(() => window.__verifyGame.engine.camera.position.y);
  await pcPage.keyboard.press("Space");
  await pcPage.waitForTimeout(120);
  const pcJump = await pcPage.evaluate((ground) => ({
    ground,
    y: window.__verifyGame.engine.camera.position.y,
    velocityY: window.__verifyGame.player.velocity.y,
    sprintField: "sprint" in window.__verifyGame.input.state,
  }), pcGround);
  assert(pcJump.y > pcGround && pcJump.velocityY > 0 && !pcJump.sprintField, "PC 空格跳跃或冲刺移除失败", pcJump);

  const result = {
    radarUnit,
    loadout,
    inventory,
    radar,
    movingActions: { reloadWhileMoving, switchWhileMoving, fireWhileMoving },
    jump: { mobile: mobileJump, pc: pcJump },
  };
  fs.writeFileSync(new URL("verification.json", output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
