import * as THREE from "three";
import { WEAPON_CATEGORIES, weaponsByCategory } from "../weapons/weaponData.js";
import { LOCKED_WEAPONS, TALENTS, TALENT_PRICES, WEAPON_UNLOCK_PRICE } from "../progression/Progression.js";
export class UI {
  constructor(root) {
    this.root = root;
    // 三类武器各自保存一个选择，新增武器会由 category 自动进入对应分组。
    this.selection = {
      mapId: "base",
      weaponIds: Object.fromEntries(
        WEAPON_CATEGORIES.map(({ id }) => [id, weaponsByCategory(id)[0]?.id]),
      ),
    };
    root.innerHTML = this.html();
    this.bind();
    this.renderLoadout();
    this.damage = [];
    this.camera = null;
    this.layoutEditing = false;
    this.applyControlLayout();
  }
  html() {
    return `<div id="menu" class="panel show"><h1>僵尸围城</h1><p class="tag">3D FPS · ROGUELIKE</p><button id="start">开始游戏</button><button id="baseEntry">基地</button><button id="fullscreen">全屏</button><button data-dialog="help">操作说明</button><button data-dialog="settings">设置</button><button data-dialog="about">关于</button></div>
  <div id="base" class="overlay"><div class="baseBox"><header><button id="baseBack">← 返回</button><div><h2>作战基地</h2><p class="coreBalance"></p></div></header><h3>武器授权</h3><div class="baseWeapons"></div><h3>永久天赋</h3><div class="talentList"></div><p class="baseMessage" aria-live="polite"></p></div></div>
  <div id="loadout" class="overlay"><div class="loadoutBox"><header><button id="loadoutBack">← 返回</button><div><h2>选择作战配置</h2><p>从三类武器中各选一把，全自动武器将作为默认主手</p></div></header><h3>行动区域</h3><div class="mapChoices"></div><h3>武器装备 <small>3 / 3</small></h3><div class="weaponChoices"></div><button id="confirmLoadout">确认出发</button></div></div>
  <div id="dialog" class="panel"><div id="dialogText"></div><button id="closeDialog">返回</button></div><div id="hud"><div id="wave">第 1 波</div><div id="boss"><span>协议执刑者</span><i></i></div><div id="buffs"></div><div id="economy"><span>●</span> 金币 0</div><div id="health"><b>生命</b><i></i><span>100</span></div><div id="weaponName">制式手枪</div><div id="ammo">12 <small>/ ∞</small></div><div id="kills">击杀 0</div><div id="crosshair"><i></i><i></i><i></i><i></i></div><div id="hit">×</div><div id="damageFlash"></div></div>
  <div id="pause" class="overlay"><h2>游戏暂停</h2><button id="resume">继续战斗</button><button id="pauseHome">返回菜单</button><button id="pauseFullscreen">退出全屏</button></div><div id="cards" class="overlay"><div class="settlement"><h2></h2><div class="settlementGrid"><section><h3>选择一项词条 <small>必选</small></h3><div class="cardRow"></div></section><section class="shop"><h3>战地商店 <small>可选</small></h3><div class="shopBalance"></div><div class="shopItems"></div><button class="skipShop">跳过商店</button></section></div><footer><span class="choiceHint">请先选择一项词条</span><button class="nextWave" disabled>进入下一波</button></footer></div></div><div id="result" class="overlay"><div class="resultBox"><h2></h2><div class="stats"></div><button id="restart">再来一局</button><button id="home">返回菜单</button></div></div>
  <div id="mobile"><div id="moveControls" class="controlGroup" data-label="移动"><div id="joystick">●</div></div><div id="actionControls" class="controlGroup" data-label="开火"><button id="fire">开火</button><button id="reload">换弹</button><button id="switchWeapon">切枪</button><button id="jump">跳跃</button></div><button id="menuBtn" aria-label="暂停菜单">☰</button><button id="finishLayout">保存布局</button></div>`;
  }
  bind() {
    this.menu = this.q("#menu");
    this.loadout = this.q("#loadout");
    this.hud = this.q("#hud");
    this.cards = this.q("#cards");
    this.result = this.q("#result");
    this.base = this.q("#base");
    this.fireButton = this.q("#fire");
    this.reloadButton = this.q("#reload");
    this.weaponButton = this.q("#switchWeapon");
    this.jumpButton = this.q("#jump");
    this.menuButton = this.q("#menuBtn");
    this.q("#start").onclick = () => {
      this.menu.classList.remove("show");
      this.loadout.classList.add("show");
    };
    this.q("#loadoutBack").onclick = () => {
      this.loadout.classList.remove("show");
      this.menu.classList.add("show");
    };
    this.q("#baseEntry").onclick=()=>{this.menu.classList.remove("show");this.base.classList.add("show");this.renderBase();};
    this.q("#baseBack").onclick=()=>{this.base.classList.remove("show");this.menu.classList.add("show");};
    this.q("#closeDialog").onclick = () => {
      this.q("#dialog").classList.remove("show");
      this.menu.classList.add("show");
    };
    this.root
      .querySelectorAll("[data-dialog]")
      .forEach((b) => (b.onclick = () => this.dialog(b.dataset.dialog)));
    this.q("#finishLayout").onclick = () => this.endLayoutEdit();
    for (const group of this.root.querySelectorAll(".controlGroup"))
      group.addEventListener(
        "pointerdown",
        (e) => this.startLayoutDrag(e, group),
        true,
      );
  }
  setProgression(progression){this.progression=progression;this.renderLoadout();}
  notify(message){const el=this.q(".baseMessage");if(el)el.textContent=message;}
  renderBase(){
    if(!this.progression)return;const p=this.progression.data;
    this.q(".coreBalance").textContent=`数据核心：${p.cores}`;
    this.q(".baseWeapons").innerHTML=LOCKED_WEAPONS.map(id=>{const w=weaponsByCategory('pistol').concat(weaponsByCategory('auto'),weaponsByCategory('shotgun')).find(x=>x.id===id),open=this.progression.isWeaponUnlocked(id);return `<button data-unlock="${id}" ${open?'disabled':''}><b>${w.name}</b><small>${open?'已解锁':`🔒 ${WEAPON_UNLOCK_PRICE} 核心`}</small></button>`;}).join('');
    this.q(".talentList").innerHTML=Object.entries(TALENTS).map(([id,t])=>{const level=p.talents[id],price=TALENT_PRICES[level];return `<button data-talent="${id}" ${level>=3?'disabled':''}><span><b>${t.name}</b><small>${t.desc}</small></span><strong>${level}/3 · ${level>=3?'已满级':`${price} 核心`}</strong></button>`;}).join('');
    this.q(".baseWeapons").onclick=e=>{const b=e.target.closest('[data-unlock]');if(!b)return;const r=this.progression.unlockWeapon(b.dataset.unlock);this.notify(r.ok?'武器解锁成功':'数据核心不足');this.renderBase();this.renderLoadout();};
    this.q(".talentList").onclick=e=>{const b=e.target.closest('[data-talent]');if(!b)return;const r=this.progression.upgradeTalent(b.dataset.talent);this.notify(r.ok?`天赋升级至 ${r.level} 级`:r.reason==='cores'?'数据核心不足':'已达到最高等级');this.renderBase();};
  }
  renderLoadout() {
    const maps = [
        {
          id: "base",
          icon: "⬡",
          name: "未来基地",
          desc: "开阔环形基地，适合灵活走位",
        },
        {
          id: "transportShip",
          icon: "▰",
          name: "运输船",
          desc: "海上货船甲板，集装箱立体交火",
        },
      ],
      mapRow = this.q(".mapChoices"),
      weaponRow = this.q(".weaponChoices");
    mapRow.innerHTML = maps
      .map(
        (m) =>
          `<button class="mapOption ${m.id === this.selection.mapId ? "selected" : ""}" data-map="${m.id}"><i>${m.icon}</i><span><b>${m.name}</b><small>${m.desc}</small></span></button>`,
      )
      .join("");
    weaponRow.innerHTML = WEAPON_CATEGORIES.map(
      (category) => `<section class="weaponGroup" data-category="${category.id}">
        <h4>${category.name}${category.id === "auto" ? " <em>主手</em>" : ""}</h4>
        <div>${weaponsByCategory(category.id).map(
          (w) => {const locked=this.progression&&!this.progression.isWeaponUnlocked(w.id);return `<button class="weaponOption ${w.rarity} ${locked?'locked':''} ${w.id === this.selection.weaponIds[category.id] ? "selected" : ""}" data-weapon="${w.id}">
            <em>${w.rarity === "legendary" ? "传说" : w.rarity === "rare" ? "稀有" : "普通"}</em><b>${locked?'🔒 ':''}${w.name}</b><small>${locked?`${WEAPON_UNLOCK_PRICE} 数据核心 · 点击前往基地解锁`:w.desc}</small>
          </button>`;},
        ).join("")}</div>
      </section>`,
    )
      .join("");
    mapRow.onclick = (e) => {
      const b = e.target.closest("[data-map]");
      if (b) {
        this.selection.mapId = b.dataset.map;
        this.renderLoadout();
      }
    };
    weaponRow.onclick = (e) => {
      const b = e.target.closest("[data-weapon]");
      if (b) {
        if(this.progression&&!this.progression.isWeaponUnlocked(b.dataset.weapon)){this.loadout.classList.remove('show');this.base.classList.add('show');this.renderBase();this.notify('请先在基地解锁该武器');return;}
        const category = b.closest("[data-category]").dataset.category;
        this.selection.weaponIds[category] = b.dataset.weapon;
        this.renderLoadout();
      }
    };
  }
  q(s) {
    return this.root.querySelector(s);
  }
  onStart(fn) {
    this.q("#confirmLoadout").onclick = () => fn({ ...this.selection });
    this.q("#restart").onclick = () => fn({ ...this.selection });
  }
  onHome(fn) {
    this.q("#home").onclick = fn;
    this.q("#pauseHome").onclick = fn;
  }
  onResume(fn) {
    this.q("#resume").onclick = fn;
  }
  onPause(fn) {
    this.menuButton.onclick = fn;
  }
  onFullscreen(fn) {
    this.q("#fullscreen").onclick = fn;
    this.q("#pauseFullscreen").onclick = fn;
  }
  onWeaponSwitch(fn) {
    this.weaponSwitchHandler = fn;
    this.weaponButton.onclick = fn;
  }
  triggerWeaponSwitch() {
    this.weaponSwitchHandler?.();
  }
  pause(show) {
    this.q("#pause").classList.toggle("show", show);
  }
  dialog(type) {
    this.menu.classList.remove("show");
    const sensitivity = localStorage.getItem("sensitivity") || "7";
    const fireLookScale = localStorage.getItem("fireLookScale") || "1.0";
    const content = {
      help: "<h2>操作说明</h2><p>PC：WASD 移动，鼠标瞄准，左键射击，R 换弹，数字键 1/2/3 或鼠标滚轮换武器，空格跳跃，ESC 释放鼠标。</p><p>手机：左侧摇杆移动，右侧滑动或按住开火键拖动瞄准；右侧按钮可射击、换弹、切枪与跳跃。</p>",
      settings: `<h2>设置</h2><label>灵敏度 <input id="sensitivity" type="range" min="1" max="10" value="${sensitivity}"></label><label>开火转向灵敏度倍率 <output id="fireLookValue">${Number(fireLookScale).toFixed(1)}x</output><input id="fireLookScale" type="range" min="0.5" max="2" step="0.1" value="${fireLookScale}"></label><label>音量 <input id="volume" type="range" min="0" max="100" value="65"></label><label>画质 <select><option>自动</option><option>低</option><option>中</option><option>高</option></select></label><button id="editLayout">调整按键位置</button>`,
      about:
        "<h2>关于</h2><p>程序化生成的 Three.js 僵尸 FPS。所有模型、视觉反馈和 WebAudio 音效均在本地生成。</p>",
    };
    this.q("#dialogText").innerHTML = content[type];
    this.q("#dialog").classList.add("show");
    const slider = this.q("#sensitivity");
    if (slider)
      slider.oninput = () => localStorage.setItem("sensitivity", slider.value);
    const fireSlider = this.q("#fireLookScale");
    if (fireSlider)
      fireSlider.oninput = () => {
        localStorage.setItem("fireLookScale", fireSlider.value);
        this.q("#fireLookValue").textContent =
          `${Number(fireSlider.value).toFixed(1)}x`;
      };
    const edit = this.q("#editLayout");
    if (edit) edit.onclick = () => this.beginLayoutEdit();
  }
  // 两组布局以视口百分比持久化，旋转屏幕或换设备后仍保持相对位置。
  applyControlLayout() {
    for (const [id, key] of [
      ["moveControls", "move"],
      ["actionControls", "action"],
    ]) {
      const group = this.q(`#${id}`);
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(`controlLayout.${key}`));
      } catch {}
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        group.style.left = `${saved.x}%`;
        group.style.top = `${saved.y}%`;
        group.style.right = group.style.bottom = "auto";
      }
    }
  }
  beginLayoutEdit() {
    this.layoutEditing = true;
    this.q("#dialog").classList.remove("show");
    this.root.classList.add("layout-editing");
  }
  endLayoutEdit() {
    this.layoutEditing = false;
    this.root.classList.remove("layout-editing");
    this.menu.classList.add("show");
  }
  startLayoutDrag(e, group) {
    if (!this.layoutEditing) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const rect = group.getBoundingClientRect(),
      dx = e.clientX - rect.left,
      dy = e.clientY - rect.top;
    group.setPointerCapture?.(e.pointerId);
    const move = (event) => {
      const x = Math.max(
          8,
          Math.min(innerWidth - group.offsetWidth - 8, event.clientX - dx),
        ),
        y = Math.max(
          8,
          Math.min(innerHeight - group.offsetHeight - 8, event.clientY - dy),
        );
      group.style.left = `${x}px`;
      group.style.top = `${y}px`;
      group.style.right = group.style.bottom = "auto";
    };
    const up = () => {
      group.removeEventListener("pointermove", move);
      group.removeEventListener("pointerup", up);
      const r = group.getBoundingClientRect(),
        key = group.id === "moveControls" ? "move" : "action";
      localStorage.setItem(
        `controlLayout.${key}`,
        JSON.stringify({
          x: +((r.left / innerWidth) * 100).toFixed(3),
          y: +((r.top / innerHeight) * 100).toFixed(3),
        }),
      );
    };
    group.addEventListener("pointermove", move);
    group.addEventListener("pointerup", up, { once: true });
  }
  showGame() {
    this.menu.classList.remove("show");
    this.loadout.classList.remove("show");
    this.result.classList.remove("show");
    this.cards.classList.remove("show");
    this.hud.classList.add("show");
  }
  update(state) {
    this.q("#health i").style.width =
      `${Math.max(0, (state.health / state.maxHealth) * 100)}%`;
    this.q("#health span").textContent =
      `${Math.ceil(state.health)} +${Math.ceil(state.armor)}`;
    const ammo = this.q("#ammo");
    ammo.classList.toggle("empowered", state.empowered > 0);
    ammo.innerHTML = `${state.ammo} <small>/ ${Number.isFinite(state.reserve) ? state.reserve : "∞"}${state.empowered ? ` · 强化 ${state.empowered}` : ""}</small>`;
    this.q("#weaponName").textContent = state.weaponName;
    this.q("#kills").textContent = `击杀 ${state.kills}`;
  }
  fullscreenChanged(active) {
    this.q("#fullscreen").textContent = active ? "退出全屏" : "全屏";
    this.q("#pauseFullscreen").textContent = active ? "退出全屏" : "进入全屏";
  }
  setWave(w, r) {
    this.q("#wave").textContent = `第 ${w} 波 · 剩余 ${r}`;
  }
  setBoss(v, p = 1) {
    const b = this.q("#boss");
    b.classList.toggle("show", v);
    b.querySelector("i").style.width = `${p * 100}%`;
  }
  setEconomy(e) {
    this.q("#economy").innerHTML = `<span>●</span> 金币 ${e.coins}`;
  }
  spread(v) {
    const px = 8 + v * 360;
    this.q("#crosshair").style.setProperty("--gap", `${px}px`);
  }
  recoil({ x = 0, y = 0 } = {}) {
    const crosshair = this.q("#crosshair");
    crosshair.style.setProperty("--kick-x", `${Math.max(-3, Math.min(3, x))}px`);
    crosshair.style.setProperty("--kick-y", `${Math.max(-4, Math.min(0, y))}px`);
  }
  hitMarker(type) {
    const h = this.q("#hit");
    h.className = `show ${type}`;
    clearTimeout(this.ht);
    this.ht = setTimeout(() => (h.className = ""), 100);
  }
  damageFlash() {
    const d = this.q("#damageFlash");
    d.classList.add("show");
    setTimeout(() => d.classList.remove("show"), 180);
  }
  damageNumber(value, point, head) {
    const el = document.createElement("b");
    el.className = `damageNum ${head ? "head" : ""}`;
    el.textContent = value;
    document.body.appendChild(el);
    this.damage.push({ el, point: point.clone(), life: 0.7 });
  }
  updateDamage(dt, camera) {
    for (const d of [...this.damage]) {
      d.life -= dt;
      const p = d.point.clone().project(camera);
      d.el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
      d.el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight - d.life * 30}px`;
      d.el.style.opacity = Math.max(0, d.life * 2);
      if (d.life <= 0) {
        d.el.remove();
        this.damage.splice(this.damage.indexOf(d), 1);
      }
    }
  }
  // 词条与商店在同一结算页独立交互，仅词条选择是进入下一波的前置条件。
  showSettlement(wave, list, items, economy, earned, actions) {
    this.cards.classList.add("show");
    this.q('.shop').style.display='';this.q('.settlement footer').style.display='';
    this.q("#cards h2").textContent =
      `第 ${wave} 波 清除 · 本局获得金币 ${earned.coins}`;
    const row = this.q(".cardRow"),
      next = this.q(".nextWave"),
      hint = this.q(".choiceHint"),
      shop = this.q(".shop");
    let chosen = false;
    row.innerHTML = "";
    list.forEach((b) => {
      const el = document.createElement("button");
      el.className = `card ${b.rarity}`;
      el.innerHTML = `<em>${{ common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" }[b.rarity]}</em><i class="cardIcon">${b.icon || { common: "✦", rare: "◆", epic: "✹", legendary: "★" }[b.rarity]}</i><h3>${b.name}</h3><p>${b.desc}</p><span class="cardOrnament">◆</span>`;
      el.onclick = () => {
        if (chosen) return;
        chosen = true;
        actions.choose(b);
        row.querySelectorAll(".card").forEach((x) => (x.disabled = true));
        el.classList.add("selected");
        el.disabled = false;
        next.disabled = false;
        hint.textContent = `已选择：${b.name}`;
      };
      row.appendChild(el);
    });
    const purchased = new Set();
    const renderShop = () => {
      this.q(".shopBalance").innerHTML = `<span>●</span> 金币 <b>${economy.coins}</b>`;
      const box = this.q(".shopItems");
      box.innerHTML = "";
      items.forEach((item) => {
        const bought = purchased.has(item.id),
          affordable = !bought && economy.coins >= item.price,
          el = document.createElement("button");
        el.className = `shopItem ${item.rarity} ${bought ? "purchased" : ""} ${!affordable && !bought ? "unaffordable" : ""}`;
        el.disabled = !affordable;
        el.innerHTML = `<em>${{ common: "普通", rare: "稀有", epic: "史诗" }[item.rarity]}</em><i class="cardIcon">${item.icon}</i><h3>${item.name}</h3><p>${item.desc}</p><strong><span>●</span> ${item.price}</strong><span class="cardOrnament">◆</span>${bought ? '<mark>✓ 已购买</mark>' : ""}`;
        el.onclick = () => {
          if (actions.buy(item)) {
            purchased.add(item.id);
            renderShop();
          }
        };
        box.appendChild(el);
      });
    };
    renderShop();
    shop.classList.remove("skipped");
    this.q(".skipShop").onclick = () => shop.classList.add("skipped");
    next.disabled = true;
    hint.textContent = "请先选择一项词条";
    next.onclick = () => {
      if (!chosen) return;
      this.cards.classList.remove("show");
      actions.next();
    };
  }
  showInitialChoices(total,getChoices,apply,done){let current=0;const next=()=>{if(current>=total){this.cards.classList.remove('show');done();return;}current++;this.cards.classList.add('show');this.q('#cards h2').textContent=`基地增援 · 免费词条 ${current} / ${total}`;this.q('.shop').style.display='none';this.q('.settlement footer').style.display='none';const row=this.q('.cardRow');row.innerHTML='';for(const b of getChoices()){const el=document.createElement('button');el.className=`card ${b.rarity}`;el.innerHTML=`<em>免费</em><i class="cardIcon">${b.icon||'✦'}</i><h3>${b.name}</h3><p>${b.desc}</p>`;el.onclick=()=>{apply(b);next();};row.appendChild(el);}};next();}
  addBuff(buff, stack) {
    let el = this.q(`[data-buff="${buff.id}"]`);
    if (!el) {
      el = document.createElement("span");
      el.dataset.buff = buff.id;
      this.q("#buffs").appendChild(el);
    }
    el.textContent = `${buff.name} ×${stack}`;
  }
  showResult(win, s) {
    this.hud.classList.remove("show");
    this.cards.classList.remove("show");
    this.result.classList.add("show");
    this.q("#result h2").textContent = win ? "撤离成功" : "你已阵亡";
    this.q("#result .stats").innerHTML =
      `<p>击杀：${s.kills}</p><p>通过波次：${s.wave}</p><p>生存时间：${s.time}</p><p>本局获得金币：${s.earned.coins}</p><p class="coreEarned">获得数据核心：${s.cores}</p><p>词条：${s.buffs || "无"}</p>`;
  }
}
