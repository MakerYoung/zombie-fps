import * as THREE from "three";
import { EventBus } from "./EventBus.js";
import { Engine } from "./Engine.js";
import { GameLoop } from "./GameLoop.js";
import { InputManager } from "../input/InputManager.js";
import { MapGenerator } from "../map/MapGenerator.js";
import { MAP_DEFS, MAP_IDS } from "../map/mapDefs.js";
import { Stats } from "../player/Stats.js";
import { Health } from "../player/Health.js";
import { PlayerController } from "../player/PlayerController.js";
import { Weapon } from "../player/Weapon.js";
import {
  WEAPONS,
  WEAPON_IDS,
  WEAPON_CATEGORIES,
  weaponsByCategory,
} from "../weapons/weaponData.js";
import { EnemyManager } from "../enemies/EnemyManager.js";
import { EnemyProjectileSystem } from "../enemies/EnemyProjectileSystem.js";
import { PlayerProjectileSystem } from "../systems/PlayerProjectileSystem.js";
import { AudioSystem } from "../systems/AudioSystem.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { DecalSystem } from "../systems/DecalSystem.js";
import { ScreenShake } from "../systems/ScreenShake.js";
import { ShootingSystem } from "../systems/ShootingSystem.js";
import { FeedbackSystem } from "../systems/FeedbackSystem.js";
import { WaveManager } from "../systems/WaveManager.js";
import { BuffSystem } from "../roguelike/BuffSystem.js";
import { rollShop } from "../roguelike/shopItems.js";
import { Radar } from "../ui/Radar.js";
import { Progression } from "../progression/Progression.js";
import { LootSystem } from "../loot/LootSystem.js";
export class Game {
  constructor(root, ui) {
    this.ui = ui;
    this.progression = new Progression();
    this.ui.setProgression(this.progression);
    this.bus = new EventBus();
    this.quality = matchMedia("(pointer:coarse)").matches ? "low" : "high";
    this.engine = new Engine(root, this.quality);
    this.input = new InputManager(this.engine.renderer.domElement, ui);
    this.maps = Object.fromEntries(Object.entries(MAP_DEFS).map(([id,def])=>[id,new MapGenerator(this.engine.scene,def)]));
    const requested = new URLSearchParams(location.search).get("map") || "base";
    this.map = null;
    this.setActive(this.maps[requested] || this.maps.base);
    this.stats = new Stats();
    this.health = new Health(this.stats, this.bus);
    this.player = new PlayerController(
      this.engine.camera,
      this.input,
      this.map,
      this.stats,
      this.bus,
    );
    this.player.healthRatio = () => this.health.value / this.stats.get("maxHealth");
    this.weapon = new Weapon(
      this.engine.camera,
      this.bus,
      this.stats,
      WEAPONS.pistol,
    );
    this.inventory = [this.weapon];
    this.enemies = new EnemyManager(
      this.engine.scene,
      this.bus,
      this.map,
      this.engine.camera,
      this.input.touch,
    );
    this.enemyProjectiles = new EnemyProjectileSystem(this.engine.scene,this.bus,this.engine.camera,this.map);
    this.playerProjectiles = new PlayerProjectileSystem(this.engine.scene,this.bus,this.engine.camera,this.map,this.enemies);
    this.audio = new AudioSystem(this.bus);
    this.loot = new LootSystem(this.engine.scene,this.bus,this.engine.camera);
    this.switchingWeapon = false;
    this.particles = new ParticleSystem(
      this.engine.scene,
      this.bus,
      this.quality,
    );
    this.decals = new DecalSystem(this.engine.scene, this.bus);
    this.shake = new ScreenShake(this.engine.camera, this.bus);
    this.shooting = new ShootingSystem(
      this.engine.camera,
      this.weapon,
      this.enemies,
      this.map,
      this.bus,
      this.stats,
    );
    this.shooting.game = this;
    this.purchasedItems = 0;
    this.waves = new WaveManager(this.bus, this.enemies, { getStrength:()=>this.buffs?.stacks?.size+this.purchasedItems || 0 });
    this.buffs = new BuffSystem(this.bus, this.stats, this.health);
    this.radar = new Radar(ui.hud, this.engine.camera, this.enemies, this.stats);
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.engine.render(),
    );
    this.feedback = new FeedbackSystem(this.bus, ui, this.loop);
    this.state = "menu";
    this.kills = 0;
    this.bossKills = 0;
    this.clearedWaves = 0;
    this.wave = 0;
    this.startedAt = 0;
    this.economy = { coins: 0 };
    this.earned = { coins: 0 };
    this.reviveAvailable = false;
    this.bind();
    this.loop.start();
  }
  // 两张地图统一切换入口，碰撞、玩家、敌人和射线系统同时换引用。
  setActive(map) {
    Object.values(this.maps || {}).forEach((m) => m.setActive(m === map));
    this.map = map;
    if (this.player) this.player.map = map;
    if (this.enemies) this.enemies.map = map;
    if (this.enemyProjectiles) this.enemyProjectiles.map = map;
    if (this.playerProjectiles) this.playerProjectiles.setMap(map);
    if (this.shooting) this.shooting.setMap(map);
    return map;
  }
  bind() {
    this.bus.on("player:died", (e) => {
      if (this.reviveAvailable) {
        this.reviveAvailable = false;
        this.health.value = this.stats.get("maxHealth") * 0.5;
        this.bus.emit("player:revived", { health: this.health.value });
        return;
      }
      this.end(e.source);
    });
    this.bus.on("enemy:attack", (e) =>
      Math.hypot(this.input.state.move.x, this.input.state.move.y) > 0.1 &&
      Math.random() < this.stats.get("dodgeChance")
        ? this.bus.emit("player:dodged", e)
        : this.health.damage(e.damage, e.enemy.def.name),
    );
    this.bus.on("enemy:explode", (e) => {
      if(e.enemy.group.position.distanceTo(this.engine.camera.position)<=e.radius)this.health.damage(e.damage,e.enemy.def.name);
      this.bus.emit("fx:radial",{position:e.enemy.group.position.clone(),radius:e.radius,color:0xff315f,count:42});
    });
    this.bus.on('player:projectileImpact',({position,data,enemy,weapon})=>{let damage=data.damage*this.stats.get('damage')*this.stats.get('heavyDamage');if(enemy)damage=weapon.hook('onHit',{enemy,damage,headshot:false,point:position,game:this})??damage;const killed=enemy&&enemy.health<=damage;this.radialDamage(position,data.explosionRadius||3.2,damage,null,data.projectileType==='grenade'?0xffc14a:0xff5a24);if(killed)weapon.hook('onKill',{enemy,game:this,headshot:false});this.bus.emit('weapon:explosion',{position,radius:data.explosionRadius||3.2,data,enemy});});
    this.bus.on("enemy:attack", (e) => {
      if (Math.random() < .28) this.bus.emit("bullet:whiz", { position: e.enemy.group.position });
    });
    this.bus.on("enemy:killed", ({ enemy }) => {
      this.kills++;
      if (enemy.def.boss) this.bossKills++;
      this.gainCurrency(Math.round(enemy.def.coinValue * this.stats.get("coinGain")), "kill");
      const heal = enemy.def.health * this.stats.get("lifeSteal") * 0.05;
      if (heal) this.health.heal(heal);
      if (enemy.def.deathBlast)
        this.radialDamage(enemy.group.position, enemy.def.deathBlast, 35);
      const undiscovered=WEAPON_IDS.filter(id=>!this.progression.isWeaponUnlocked(id));
      const weaponChance=enemy.def.boss?.38:enemy.def.elite?.12:.045;
      if(undiscovered.length&&Math.random()<weaponChance){const weaponId=undiscovered[Math.floor(Math.random()*undiscovered.length)];this.bus.emit('loot:spawn',{type:{weaponId},position:enemy.group.position.clone()});}
    });
    this.bus.on("shot:hit", (e) => {
      if (this.stats.get("fireBullets")) e.enemy.applyElement("fire");
      if (this.stats.get("iceBullets")) e.enemy.applyElement("ice");
      const radius = this.stats.get("explosionRadius");
      if (radius) this.radialDamage(e.point, radius, e.damage * 0.35, e.enemy);
    });
    this.bus.on("economy:gain", () => this.ui.setEconomy(this.economy));
    this.bus.on("wave:start", (e) => {
      this.ui.setWave(e.wave, e.total);
      this.ui.setBoss(e.boss);
    });
    this.bus.on("wave:count", (e) => this.ui.setWave(this.wave, e.remaining));
    this.bus.on("wave:cleared", ({ wave }) => {
      this.clearedWaves = Math.max(this.clearedWaves, wave);
      this.state = "choice";
      document.exitPointerLock?.();
      const items = rollShop();
      this.ui.showSettlement(wave, this.buffs.choices(), items, this.economy, this.earned, {
        choose: (b) => this.buffs.apply(b),
        buy: (item) => this.buy(item),
        next: () => {
          this.state = "playing";
          this.wave++;
          this.waves.start(this.wave);
          if (!this.input.touch)
            this.engine.renderer.domElement.requestPointerLock?.();
        },
      });
    });
    this.bus.on("buff:applied", (e) => this.ui.addBuff(e.buff, e.stack));
    this.bus.on("crosshair:spread", (e) => this.ui.spread(e.value));
    this.bus.on("enemy:hit", ({ enemy }) => {
      if (enemy.def.boss) this.ui.setBoss(true, enemy.health / enemy.maxHealth);
    });
    addEventListener("keydown", (e) => {
      if (this.state === "playing" && /^Digit[1-3]$/.test(e.code))
        this.switchWeapon(+e.code.at(-1) - 1);
      if (e.code === "KeyM") {
        const current=MAP_IDS.findIndex(id=>this.maps[id]===this.map);
        this.setActive(this.maps[MAP_IDS[(current+1)%MAP_IDS.length]]);
        this.startPosition();
      }
    });
    this.engine.renderer.domElement.addEventListener(
      "wheel",
      (e) => {
        if (this.state !== "playing") return;
        e.preventDefault();
        this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false },
    );
    this.ui.onWeaponSwitch(() => this.cycleWeapon(1));
    // UI 统一走事件总线，动态生成的商店按钮也自动拥有悬停/点击反馈。
    document.addEventListener("pointerover", (e) => {
      const button=e.target.closest?.("button"),from=e.relatedTarget?.closest?.("button");
      if(button&&button!==from)this.bus.emit("ui:hover");
    });
    this.bus.on("loot:picked",({type})=>{
      if(type.kind==='weapon'){const discovered=this.progression.discoverWeapon(type.weaponId);this.ui.lootNotify?.(discovered?`获得武器：${type.name}`:`重复武器：${type.name}`);this.ui.renderLoadout();this.bus.emit('weapon:discovered',{weaponId:type.weaponId,new:discovered});return;}
      if(type.kind==='health')this.health.heal(type.amount);
      else for(const weapon of this.inventory.filter(w=>w.data.ammoType===type.ammoType))weapon.addReserve(type.amount);
      this.ui.lootNotify?.(`拾取：${type.name}`);
      this.bus.emit('loot:applied',{type});
    });
    document.addEventListener("click", (e) => { if (e.target.closest?.("button")) this.bus.emit("ui:click"); });
  }
  gainCurrency(amount, source = "kill") {
    this.economy.coins += amount;
    if (source !== "shop") this.earned.coins += amount;
    this.bus.emit("economy:gain", {
      amount,
      source,
      balance: { ...this.economy },
    });
  }
  buy(item) {
    if (this.economy.coins < item.price) return false;
    this.economy.coins -= item.price;
    this.purchasedItems++;
    item.apply({
      game: this,
      stats: this.stats,
      health: this.health,
      bus: this.bus,
    });
    this.bus.emit("economy:spent", {
      item,
      price: item.price,
      balance: { ...this.economy },
    });
    this.ui.setEconomy(this.economy);
    return true;
  }
  startPosition() {
    const s = this.map.playerSpawn;
    this.engine.camera.position.set(s.x, s.y, s.z);
    this.player.yaw = s.yaw || 0;
    this.player.resetMotion();
  }
  start({ mapId = "base", weaponIds } = {}) {
    this.audio.init();
    this.enemies.clear();
    this.loot.clear();
    this.buffs.reset();
    this.stats = new Stats();
    this.health.stats = this.stats;
    this.player.stats = this.stats;
    this.buffs.stats = this.stats;
    this.radar.stats = this.stats;
    this.shooting.stats = this.stats;
    this.setActive(this.maps[mapId] || this.maps.base);
    this.startPosition();
    this.kills = 0;
    this.bossKills = 0;
    this.clearedWaves = 0;
    this.wave = 1;
    const runBonus = this.progression.applyRun(this.stats);
    this.health.reset();
    this.economy = { coins: runBonus.coins };
    this.earned = { coins: 0 };
    this.reviveAvailable = false;
    this.purchasedItems = 0;
    this.startedAt = performance.now();
    this.qBuffsClear();
    // 重开时完整重建三个实例；每一把都常驻相机，只显示当前主手。
    this.inventory.forEach((weapon) => weapon.dispose());
    const selected = WEAPON_CATEGORIES.map(({ id: category }, index) => {
      const requested = Array.isArray(weaponIds)
        ? weaponIds[index]
        : weaponIds?.[category];
      const data = WEAPONS[requested];
      return data?.category === category&&this.progression.isWeaponUnlocked(data.id) ? data : weaponsByCategory(category).find(w=>this.progression.isWeaponUnlocked(w.id));
    }).filter(Boolean);
    if(!selected.length)selected.push(WEAPONS.pistol);
    this.inventory = selected.map(
      (data) => new Weapon(this.engine.camera, this.bus, this.stats, data),
    );
    const primaryIndex=selected.findIndex(data=>data.slot===1);this.switchWeapon(Math.max(0,primaryIndex),true);
    this.ui.showGame();
    this.ui.setEconomy(this.economy);
    const begin=()=>{this.state="playing";this.waves.start(1);if(!this.input.touch)this.engine.renderer.domElement.requestPointerLock?.();};
    if(runBonus.freeChoices>0){this.state="choice";this.ui.showInitialChoices(runBonus.freeChoices,()=>this.buffs.choices(),b=>this.buffs.apply(b),begin);}else begin();
  }
  switchWeapon(target, force = false) {
    const index = typeof target === "number"
      ? target
      : this.inventory.findIndex((weapon) => weapon.data.id === target);
    const next = this.inventory[index];
    if (!next || this.switchingWeapon || (!force && next === this.weapon)) return false;
    if (force) {
      this.inventory.forEach((weapon) => { weapon.group.visible = weapon === next; weapon.switchLocked = false; weapon.switchAnimation = null; });
      this.weapon = next; this.shooting.weapon = next; return true;
    }
    const old = this.weapon; this.switchingWeapon = true;
    old.beginSwitch('out', () => { old.group.visible = false; });
    next.beginSwitch('in', () => { this.switchingWeapon = false; });
    this.weapon = next;
    this.shooting.weapon = next;
    return true;
  }
  cycleWeapon(direction = 1) {
    if (this.state !== "playing") return;
    const index = this.inventory.indexOf(this.weapon);
    this.switchWeapon(
      (index + direction + this.inventory.length) % this.inventory.length,
    );
  }
  radialDamage(pos, radius, damage, except = null, color = 0xff5522) {
    this.enemies.active.forEach((e) => {
      const distance=e.group.position.distanceTo(pos);if(e !== except && e.alive && distance < radius){const applied=e.hit(Math.round(damage*(1-distance/radius*.55)),false);this.bus.emit('damage:area',{enemy:e,damage:Math.round(applied),point:e.group.position.clone().add(new THREE.Vector3(0,1.35*e.def.scale,0)),origin:pos,radius});}
    });
    this.bus.emit("fx:radial", { position: pos.clone?.()||pos, radius, color, count: Math.max(24,Math.round(radius*10)) });
  }
  qBuffsClear() {
    this.ui.q("#buffs").innerHTML = "";
  }
  update(dt) {
    this.audio.setState(this.state);
    // 地图仅更新悬浮装饰动画，不触碰碰撞与出生逻辑。
    this.map.update?.(performance.now()*.001);
    const active = this.state === "playing";
    this.player.update(dt, active);
    if (active) {
      this.inventory.forEach((weapon) => weapon.update(dt, weapon === this.weapon && this.input.state.fire));
      if (this.input.state.fire) this.weapon.tryShoot();
      if (this.input.consume("reload")) this.weapon.reload();
    }
    this.enemies.update(dt, active);
    this.enemyProjectiles.update(dt, active);
    this.playerProjectiles.update(dt, active);
    this.loot.update(dt,active);
    this.waves.update(dt, active);
    this.shooting.update(dt);
    this.particles.update(dt);
    this.decals.update(dt);
    this.shake.update(dt);
    this.radar.update();
    this.audio.setListener(this.engine.camera.position, this.player.yaw);
    this.ui.updateDamage(dt, this.engine.camera);
    this.ui.update({
      health: this.health.value,
      maxHealth: this.stats.get("maxHealth"),
      armor: this.health.armor,
      ammo: this.weapon.ammo,
      reserve: this.weapon.reserve,
      weaponName: this.weapon.data.name,
      weaponSlot: this.weapon.data.slot,
      ammoType: this.weapon.data.ammoType,
      perks: this.weapon.data.perks,
      kills: this.kills,
      empowered: this.weapon.empoweredRounds,
    });
  }
  end(source) {
    if (this.state === "dead") return;
    this.state = "dead";
    document.exitPointerLock?.();
    const cores=this.progression.award({kills:this.kills,waves:this.clearedWaves,bossKills:this.bossKills});
    const elapsed = Math.floor((performance.now() - this.startedAt) / 1000),
      time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`,
      names = [...this.buffs.stacks].map(([id, n]) => `${id}×${n}`).join("、");
    this.ui.showResult(false, {
      kills: this.kills,
      wave: this.clearedWaves,
      cores,
      time,
      buffs: names,
      source,
      earned: this.earned,
    });
  }
  home() {
    this.state = "menu";
    this.input.reset();
    this.enemies.clear();
    this.loot.clear();
    this.enemyProjectiles.clear();
    this.playerProjectiles.clear();
    this.ui.pause(false);
    this.ui.hud.classList.remove("show");
    this.ui.cards.classList.remove("show");
    this.ui.result.classList.remove("show");
    this.ui.loadout.classList.remove("show");
    this.ui.menu.classList.add("show");
  }
  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.input.reset();
      this.ui.pause(true);
      document.exitPointerLock?.();
    } else if (this.state === "paused") {
      this.state = "playing";
      this.ui.pause(false);
      if (!this.input.touch)
        this.engine.renderer.domElement.requestPointerLock?.();
    }
  }
}
