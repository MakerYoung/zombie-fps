// 波次商店完全数据驱动；永久强化沿用 Stats 修饰符，消耗品直接操作生命组件。
const rarityOf = (price) => price >= 90 ? "epic" : price >= 60 ? "rare" : "common";
const stat = (id, icon, name, desc, price, statKey, value, mode = "mul") => ({
  id,
  icon,
  rarity: rarityOf(price),
  name,
  desc,
  price,
  apply(c) {
    // 随机实例键允许跨波重复购买同一商品并正确叠加。
    c.stats.add(`shop:${id}:${crypto.randomUUID()}`, statKey, value, mode);
  },
});
export const SHOP_ITEMS = [
  {
    id: "medkit",
    icon: "✚",
    rarity: "common",
    name: "回血包",
    desc: "回复 40 生命",
    price: 30,
    apply: (c) => c.health.heal(40),
  },
  {
    id: "fullHeal",
    icon: "❤",
    rarity: "rare",
    name: "大血包",
    desc: "生命值完全恢复",
    price: 80,
    apply: (c) => c.health.heal(c.stats.get("maxHealth")),
  },
  {
    id: "armor",
    icon: "⬟",
    rarity: "common",
    name: "护甲板",
    desc: "立即获得 50 护甲",
    price: 50,
    apply: (c) => {
      c.health.armor += 50;
    },
  },
  stat("magazine", "▥", "弹匣扩容", "弹匣容量 +50%", 60, "magazine", 1.5),
  stat("speed", "➤", "移速药", "移动速度 +15%", 40, "moveSpeed", 1.15),
  stat("damage", "▲", "伤害增幅器", "武器伤害 +20%", 70, "damage", 1.2),
  stat("crit", "✦", "暴击器", "暴击率 +15%", 90, "critChance", 0.15, "add"),
  stat("fire", "♨", "火子弹", "命中附加持续燃烧", 60, "fireBullets", 1, "add"),
  stat("ice", "❄", "冰子弹", "命中使敌人减速", 60, "iceBullets", 1, "add"),
  stat(
    "explosive",
    "✹",
    "爆炸弹",
    "命中产生小范围爆炸",
    100,
    "explosionRadius",
    1.8,
    "add",
  ),
  {
    id: "lucky",
    icon: "★",
    rarity: "epic",
    name: "幸运币",
    desc: "为当前武器获得 2 发强化弹",
    price: 120,
    apply: (c) => {
      c.game.weapon.empoweredRounds += 2;
    },
  },
  {
    id: "revive",
    icon: "↻",
    rarity: "epic",
    name: "复活币",
    desc: "死亡时原地复活，恢复 50% 生命",
    price: 150,
    apply: (c) => {
      c.game.reviveAvailable = true;
    },
  },
];

// 每波不重复抽取 3–4 件商品。
export function rollShop() {
  const pool = [...SHOP_ITEMS],
    count = 3 + Math.floor(Math.random() * 2),
    out = [];
  while (out.length < count) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
