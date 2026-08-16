import fs from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 41741;
const artifactDir = new URL("../artifacts/ui-equipment-verify/", import.meta.url);
fs.mkdirSync(artifactDir, { recursive: true });
const server = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
);

const assert = (condition, message) => {
  if (!condition) throw new Error(`断言失败：${message}`);
  console.log(`PASS ${message}`);
};

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Vite 启动超时")), 15000);
    const ready = (chunk) => {
      if (String(chunk).includes("Local:")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on("data", ready);
    server.stderr.on("data", ready);
  });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${port}?verify=1`, { waitUntil: "networkidle" });

  // loadout 必须由三个数据驱动分组组成，并允许分类内独立选择。
  await page.locator("#start").click();
  assert(await page.locator(".weaponGroup").count() === 3, "loadout 显示 3 个武器分组");
  assert(await page.locator(".weaponGroup .selected").count() === 3, "每个分组默认选中第一把");
  await page.evaluate(() => document.querySelector('[data-weapon="khvostov"]').click());
  await page.evaluate(() => document.querySelector('[data-weapon="conditional"]').click());
  await page.screenshot({ path: new URL("loadout-3-groups.png", artifactDir).pathname });
  await page.evaluate(() => document.querySelector("#confirmLoadout").click());
  await page.waitForTimeout(250);

  const inventory = await page.evaluate(() => ({
    length: window.__verifyGame.inventory.length,
    ids: window.__verifyGame.inventory.map((weapon) => weapon.data.id),
    current: window.__verifyGame.weapon.data.id,
    category: window.__verifyGame.weapon.data.category,
    visible: window.__verifyGame.inventory.map((weapon) => weapon.group.visible),
  }));
  assert(inventory.length === 3, "Game.start 创建 3 个 Weapon 实例");
  assert(inventory.category === "auto" && inventory.current === "khvostov", "默认主手是所选全自动武器");
  assert(inventory.visible.filter(Boolean).length === 1 && inventory.visible[1], "仅默认主手模型可见");

  // 覆盖数字键、滚轮、手机按钮，并确认完整循环回到主手。
  await page.keyboard.press("Digit1");
  assert(await page.evaluate(() => window.__verifyGame.weapon.data.id) === "pistol", "数字键按库存槽切枪");
  await page.locator('canvas[data-engine^="three.js"]').dispatchEvent("wheel", { deltaY: 100 });
  assert(await page.evaluate(() => window.__verifyGame.weapon.data.id) === "khvostov", "滚轮仅在三槽库存内切换");
  // 桌面视口会隐藏手机控件，直接派发原生 click 验证同一绑定入口。
  await page.evaluate(() => document.querySelector("#switchWeapon").click());
  assert(await page.evaluate(() => window.__verifyGame.weapon.data.id) === "conditional", "手机切枪按钮进入下一库存槽");
  await page.evaluate(() => {
    const game = window.__verifyGame;
    game.cycleWeapon(1);
    game.cycleWeapon(1);
    game.cycleWeapon(1);
  });
  const cycled = await page.evaluate(() => ({
    id: window.__verifyGame.weapon.data.id,
    visible: window.__verifyGame.inventory.map((weapon) => weapon.group.visible),
    hud: document.querySelector("#weaponName").textContent,
  }));
  assert(cycled.id === "conditional", "cycleWeapon 三次完整循环回到原武器");
  assert(cycled.visible.filter(Boolean).length === 1 && cycled.visible[2], "循环后仍只有当前武器可见");
  assert(cycled.hud === "条件终局", "HUD 武器名跟随当前武器");

  // 使用实际商品数据展示结算，并通过页面点击验证扣币与购买态。
  await page.evaluate(async () => {
    const game = window.__verifyGame;
    const { SHOP_ITEMS } = await import("/src/roguelike/shopItems.js");
    game.state = "choice";
    game.economy = { coins: 100 };
    game.earned = { coins: 100 };
    const choices = [
      { id: "verifyPower", icon: "✹", name: "高爆火药", desc: "伤害提升 20%", rarity: "common" },
      { id: "verifyCrit", icon: "◉", name: "弱点透视", desc: "暴击率提升 10%", rarity: "rare" },
      { id: "verifyStorm", icon: "⚡", name: "弹幕风暴", desc: "射速与弹匣同步强化", rarity: "legendary" },
    ];
    game.ui.showSettlement(1, choices, [SHOP_ITEMS[0], SHOP_ITEMS[5], SHOP_ITEMS[10], SHOP_ITEMS[11]], game.economy, game.earned, {
      choose: () => {},
      buy: (item) => game.buy(item),
      next: () => {},
    });
  });
  await page.screenshot({ path: new URL("settlement-cards.png", artifactDir).pathname });
  assert(await page.locator(".cardRow .card").count() === 3, "结算词条显示 3 张卡牌");
  assert(await page.locator(".shopItem").count() === 4, "商店显示 4 张商品卡牌");
  await page.locator(".shopItem").first().dispatchEvent("click");
  const purchase = await page.evaluate(() => ({
    coins: window.__verifyGame.economy.coins,
    purchased: document.querySelector(".shopItem")?.classList.contains("purchased"),
    label: document.querySelector(".shopItem mark")?.textContent,
    disabled: document.querySelector(".shopItem")?.disabled,
    unaffordable: document.querySelectorAll(".shopItem.unaffordable").length,
  }));
  assert(purchase.coins === 70, "购买后金币从 100 实时扣至 70");
  assert(purchase.purchased && purchase.disabled && purchase.label.includes("已购买"), "成功商品卡进入已购买状态且不可重复点击");
  assert(purchase.unaffordable >= 1, "金币不足商品整卡置灰且禁用");
  await page.screenshot({ path: new URL("settlement-after-purchase.png", artifactDir).pathname });
  await browser.close();
  console.log(`截图目录：${artifactDir.pathname}`);
  console.log("浏览器交互验收全部通过。");
} finally {
  if (process.platform === "win32") server.kill("SIGTERM");
  else try { process.kill(-server.pid, "SIGTERM"); } catch {}
}
