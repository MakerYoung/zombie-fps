import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 41741;
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

try {
  await ready;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 812, height: 375 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const touch = (type, touchPoints) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  await page.goto(`http://127.0.0.1:${port}?verify=1`);
  await page.locator("#start").click();
  await page.locator("#confirmLoadout").click();
  await page.waitForTimeout(100);

  const move = { x: 110, y: 295, id: 1, radiusX: 2, radiusY: 2, force: 1 };
  const moved = { ...move, y: 235 };
  await touch("touchStart", [move]);
  await touch("touchMove", [moved]);

  const pressWhileMoving = async (selector, id) => {
    const box = await page.locator(selector).boundingBox();
    const action = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      id,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    };
    const before = await page.evaluate(() => ({
      reload: window.__verifyGame.input.state.reload,
      weapon: window.__verifyGame.weapon.data.id,
      move: { ...window.__verifyGame.input.state.move },
    }));
    await touch("touchStart", [moved, action]);
    await page.waitForTimeout(30);
    const during = await page.evaluate(() => ({
      reload: window.__verifyGame.input.state.reload,
      reloading: window.__verifyGame.weapon.reloading,
      weapon: window.__verifyGame.weapon.data.id,
      move: { ...window.__verifyGame.input.state.move },
    }));
    await touch("touchEnd", [moved]);
    return { before, during };
  };

  const reload = await pressWhileMoving("#reload", 2);
  const weaponSwitch = await pressWhileMoving("#switchWeapon", 3);
  await touch("touchEnd", []);
  console.log(JSON.stringify({ reload, weaponSwitch }, null, 2));
  await browser.close();
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
