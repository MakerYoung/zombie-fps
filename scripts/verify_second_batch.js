import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const out = new URL("../artifacts/second-batch/", import.meta.url);
fs.mkdirSync(out, { recursive: true });
const port = 41732;
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

const assert = (condition, message, data) => {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(data)}`);
};

try {
  await ready;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`http://127.0.0.1:${port}?verify=1`);
  console.log("[verify] 页面已加载");

  await page.locator("#start").click();
  const loadout = await page.evaluate(() => ({
    visible: document.querySelector("#loadout").classList.contains("show"),
    mapCards: document.querySelectorAll(".mapOption").length,
    weaponCards: document.querySelectorAll(".weaponOption").length,
    selectedMap: document.querySelector(".mapOption.selected")?.dataset.map,
    selectedWeapon: document.querySelector(".weaponOption.selected")?.dataset.weapon,
  }));
  assert(loadout.visible && loadout.mapCards >= 2 && loadout.weaponCards >= 6, "Loadout 未完整显示", loadout);
  console.log("[verify] loadout 通过");
  await page.screenshot({ path: new URL("loadout-1280x720.png", out).pathname });
  await page.locator("#confirmLoadout").click();
  await page.waitForTimeout(250);
  const start = await page.evaluate(() => {
    const g = window.__verifyGame;
    return {
      state: g.state,
      mapId: Object.entries(g.maps).find(([, map]) => map === g.map)?.[0],
      weaponId: g.weapon.data.id,
      touchAdapter: g.input.touch,
      camera: g.engine.camera.position.toArray(),
    };
  });
  assert(start.state === "playing" && start.mapId === loadout.selectedMap && start.weaponId === loadout.selectedWeapon, "默认配置进入游戏失败", { loadout, start });
  console.log("[verify] 默认配置进入游戏通过");

  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points,
  });
  await touch("touchStart", [{ x: 150, y: 540, id: 11, radiusX: 2, radiusY: 2, force: 1 }]);
  await touch("touchMove", [{ x: 150, y: 430, id: 11, radiusX: 2, radiusY: 2, force: 1 }]);
  await page.waitForTimeout(350);
  const movedCamera = await page.evaluate(() => window.__verifyGame.engine.camera.position.toArray());
  await touch("touchEnd", []);
  const distance = Math.hypot(movedCamera[0] - start.camera[0], movedCamera[2] - start.camera[2]);
  assert(distance > 0.05, "真实触摸拖动未使玩家移动", { before: start.camera, after: movedCamera, distance });
  console.log("[verify] 真实触摸移动通过");

  await page.evaluate(() => {
    window.__shotEvents = 0;
    window.__verifyGame.bus.on("weapon:shoot", () => window.__shotEvents++);
  });
  const fireBox = await page.locator("#fire").boundingBox();
  const ammoBefore = await page.evaluate(() => window.__verifyGame.weapon.ammo);
  const firePoint = { x: fireBox.x + fireBox.width / 2, y: fireBox.y + fireBox.height / 2, id: 22, radiusX: 2, radiusY: 2, force: 1 };
  await touch("touchStart", [firePoint]);
  await page.waitForTimeout(120);
  await touch("touchEnd", []);
  await page.waitForTimeout(30);
  const firing = await page.evaluate((before) => ({
    ammoBefore: before,
    ammoAfter: window.__verifyGame.weapon.ammo,
    shootEvents: window.__shotEvents,
    fireReleased: !window.__verifyGame.input.state.fire,
  }), ammoBefore);
  assert(firing.ammoAfter < firing.ammoBefore && firing.shootEvents > 0, "真实触摸开火失败", firing);
  console.log("[verify] 真实触摸开火通过");

  const beforeSettlement = await page.evaluate(() => {
    const g = window.__verifyGame;
    g.enemies.clear();
    g.economy.coins = 500;
    g.health.value = 20;
    g.ui.setEconomy(g.economy);
    const originalRandom = Math.random;
    const sequence = [0, 0, 0.1, 0.2, 0.1, 0.2, 0.3];
    let randomIndex = 0;
    Math.random = () => sequence[randomIndex++ % sequence.length];
    try {
      g.bus.emit("wave:cleared", { wave: g.wave });
    } finally {
      Math.random = originalRandom;
    }
    return { state: g.state, wave: g.wave, coins: g.economy.coins, health: g.health.value };
  });
  await page.waitForTimeout(50);
  const settlement = await page.evaluate(() => ({
    visible: document.querySelector("#cards").classList.contains("show"),
    title: document.querySelector("#cards h2").textContent,
    buffCards: document.querySelectorAll(".cardRow .card").length,
    shopItems: [...document.querySelectorAll(".shopItem")].map((el) => el.textContent.trim()),
    balance: document.querySelector(".shopBalance").textContent,
  }));
  assert(settlement.visible && settlement.buffCards === 3 && settlement.shopItems.length >= 3 && settlement.balance.includes("500"), "结算界面内容不完整", settlement);
  console.log("[verify] 结算界面通过");
  await page.screenshot({ path: new URL("settlement-1280x720.png", out).pathname });

  await page.getByRole("button", { name: /回血包/ }).click();
  const purchase = await page.evaluate((before) => {
    const g = window.__verifyGame;
    return {
      coinsBefore: before.coins,
      coinsAfter: g.economy.coins,
      coinDelta: before.coins - g.economy.coins,
      healthBefore: before.health,
      healthAfter: g.health.value,
      healthDelta: g.health.value - before.health,
    };
  }, beforeSettlement);
  assert(purchase.coinDelta === 30 && purchase.healthDelta === 40, "商店购买扣币或效果失败", purchase);

  await page.locator(".cardRow .card").first().click();
  const nextEnabled = await page.locator(".nextWave").isEnabled();
  await page.locator(".nextWave").click();
  await page.waitForTimeout(50);
  const nextWave = await page.evaluate((previousWave) => ({
    previousWave,
    wave: window.__verifyGame.wave,
    state: window.__verifyGame.state,
    settlementHidden: !document.querySelector("#cards").classList.contains("show"),
  }), beforeSettlement.wave);
  assert(nextEnabled && nextWave.state === "playing" && nextWave.wave === nextWave.previousWave + 1 && nextWave.settlementHidden, "下一波流程失败", nextWave);

  const economy = await page.evaluate(() => {
    const g = window.__verifyGame;
    let event;
    const off = g.bus.on("economy:gain", (data) => event = data);
    const before = { balance: g.economy.coins, earned: g.earned.coins };
    g.gainCurrency(8);
    off();
    return {
      before,
      after: { balance: g.economy.coins, earned: g.earned.coins },
      event,
      economyKeys: Object.keys(g.economy),
      earnedKeys: Object.keys(g.earned),
      hud: document.querySelector("#economy").textContent.trim(),
    };
  });
  assert(economy.after.balance - economy.before.balance === 8 && economy.after.earned - economy.before.earned === 8 && economy.economyKeys.join() === "coins" && economy.earnedKeys.join() === "coins", "单金币经济断言失败", economy);

  const dataIntegrity = await page.evaluate(async () => {
    const [{ SHOP_ITEMS }, { ENEMY_TYPES }] = await Promise.all([
      import("/src/roguelike/shopItems.js"),
      import("/src/enemies/enemyTypes.js"),
    ]);
    return {
      shopCurrencyFields: SHOP_ITEMS.filter((item) => "currency" in item).map((item) => item.id),
      premiumPrices: Object.fromEntries(SHOP_ITEMS.filter((item) => ["lucky", "revive"].includes(item.id)).map((item) => [item.id, item.price])),
      enemyCoinValues: Object.fromEntries(Object.entries(ENEMY_TYPES).map(([id, enemy]) => [id, enemy.coinValue])),
      enemyCoinTypeFields: Object.entries(ENEMY_TYPES).filter(([, enemy]) => "coinType" in enemy).map(([id]) => id),
    };
  });
  assert(dataIntegrity.shopCurrencyFields.length === 0 && dataIntegrity.enemyCoinTypeFields.length === 0 && JSON.stringify(dataIntegrity.premiumPrices) === JSON.stringify({ lucky: 120, revive: 150 }) && JSON.stringify(dataIntegrity.enemyCoinValues) === JSON.stringify({ basic: 5, runner: 8, brute: 15, elite: 25, boss: 100 }), "单金币数据配置失败", dataIntegrity);

  const result = { loadout, start, movement: { before: start.camera, after: movedCamera, distance }, firing, settlement, purchase, nextWave, economy, dataIntegrity };
  fs.writeFileSync(new URL("verification.json", out), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
}
