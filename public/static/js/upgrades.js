// ============ ВЕРСТАК УЛУЧШЕНИЙ: крафт → перенос → установка в слот ============
import * as THREE from 'three';
import { G, registerInteractable, unregisterInteractable } from './state.js';
import { MAT, EXT } from './world.js';

// Рецепты улучшений
const RECIPES = [
  {
    id: 'o2filter', name: 'O₂-ФИЛЬТР «АКВАЛАНГ»', time: 5,
    desc: 'расход кислорода −40%', color: 0x4fc3f7,
    slot: 'inside-living', apply: () => { G.sim.mod.o2Eff = 1.4; },
  },
  {
    id: 'turbine', name: 'ТУРБОНАГНЕТАТЕЛЬ', time: 5,
    desc: 'КПД двигателя +50%', color: 0xffd54f,
    slot: 'inside-engine', apply: () => { G.sim.mod.engineEff = 1.5; },
  },
  {
    id: 'armor', name: 'ВНЕШНЯЯ БРОНЕПЛИТА', time: 6,
    desc: 'прочность корпуса ×2 (ставится СНАРУЖИ!)', color: 0xff8a65,
    slot: 'outside-deck', apply: () => { G.sim.mod.hullArmor = 2; },
  },
];

function moduleMesh(recipe) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.26),
    new THREE.MeshStandardMaterial({ color: recipe.color, metalness: 0.6, roughness: 0.4 }));
  g.add(body);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: 0x263238, emissive: recipe.color, emissiveIntensity: 0.5 }));
  core.rotation.z = Math.PI / 2; g.add(core);
  for (const sx of [-0.12, 0.12]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.05), MAT.dark);
    b.position.set(sx, 0, 0.1); g.add(b);
  }
  return g;
}

export class Upgrades {
  constructor() {
    this.crafting = null;     // { recipe, t }
    this.craftedIdx = 0;      // следующий рецепт
    this.installed = new Set();
    this._buildBench();
    this._buildSlots();
  }

  // ---------- ВЕРСТАК (машинный отсек) ----------
  _buildBench() {
    const self = this;
    const grp = new THREE.Group(); grp.position.set(-2.2, 0, 20.4);
    // стол
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.9), MAT.brass);
    top.position.y = 0.9; grp.add(top);
    for (const [sx, sz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), MAT.dark);
      leg.position.set(sx, 0.45, sz); grp.add(leg);
    }
    // экран-дисплей верстака
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), MAT.screenOn);
    scr.position.set(0, 1.65, -0.4); scr.rotation.x = -0.15; grp.add(scr);
    this.benchScreen = scr;
    // тиски
    const vice = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.18), MAT.dark);
    vice.position.set(0.55, 1.04, 0.1); grp.add(vice);
    G.scene.add(grp);
    G.colliders.push({ min: new THREE.Vector3(-3.1, 0, 19.9), max: new THREE.Vector3(-1.3, 1, 20.9) });

    // прогресс-бар крафта (3D)
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.03), MAT.black);
    barBg.position.set(-2.2, 1.3, 19.93); G.scene.add(barBg);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 0.6 }));
    bar.position.set(-2.2, 1.3, 19.94); bar.scale.x = 0.001; G.scene.add(bar);
    this.craftBar = bar;

    registerInteractable({
      mesh: grp,
      hint: () => {
        if (self.crafting) return `⚙ ВЕРСТАК: сборка «${self.crafting.recipe.name}»… ${((self.crafting.t / self.crafting.recipe.time) * 100) | 0}%`;
        const r = self._nextRecipe();
        if (!r) return '⚙ ВЕРСТАК: все модули собраны';
        return `⚙ ВЕРСТАК — [E] собрать «${r.name}» (${r.desc})`;
      },
      canUse: () => !self.crafting && !!self._nextRecipe(),
      onPress() {
        const r = self._nextRecipe();
        if (!r) return;
        self.crafting = { recipe: r, t: 0 };
        G.sfx.click();
        G.hud.log(`⚙ Сборка модуля: «${r.name}»…`, '');
      },
    });
  }

  _nextRecipe() {
    for (const r of RECIPES) {
      if (this.installed.has(r.id)) continue;
      if (this.pendingModule?.recipe.id === r.id) continue;
      if (G.held?.type === 'module' && G.held.recipe.id === r.id) continue;
      if (this.crafting?.recipe.id === r.id) continue;
      return r;
    }
    return null;
  }

  // готовый модуль появляется на верстаке — его нужно взять
  _spawnModule(recipe) {
    const self = this;
    const mesh = moduleMesh(recipe);
    mesh.position.set(-2.2, 1.07, 20.55);
    G.scene.add(mesh);
    const def = registerInteractable({
      mesh,
      hint: () => `📦 МОДУЛЬ «${recipe.name}» — [E] взять и нести к слоту`,
      canUse: () => !G.held,
      onPress() {
        G.sfx.pickup();
        unregisterInteractable(def);
        self.pendingModule = null;
        G.held = {
          type: 'module', mesh, recipe, label: `📦 ${recipe.name}`,
          drop() {
            G.sfx.drop();
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
            mesh.position.copy(G.player.pos).add(fwd.multiplyScalar(0.8));
            mesh.position.y = 0.3;
            G.held = null;
            self.pendingModule = { recipe, def };
            registerInteractable(def);
          },
        };
      },
    });
    this.pendingModule = { recipe, def };
  }

  // ---------- СЛОТЫ УСТАНОВКИ ----------
  _buildSlots() {
    // слот 1: жилой отсек (внутри) — O2-фильтр
    this._makeSlot('inside-living', new THREE.Vector3(-2.8, 1.6, 5), Math.PI / 2,
      'СЛОТ ЖИЗНЕОБЕСПЕЧЕНИЯ (жилой отсек)');
    // слот 2: машинный отсек (внутри) — турбина
    this._makeSlot('inside-engine', new THREE.Vector3(1.8, 1.65, 16), 0,
      'СЛОТ ДВИГАТЕЛЯ (машинный отсек)');
    // слот 3: СНАРУЖИ на палубе — броня
    this._makeSlot('outside-deck', new THREE.Vector3(EXT.x, 0.25, 6), 0,
      'ВНЕШНИЙ СЛОТ БРОНИ (палуба)', true);
  }

  _makeSlot(slotId, pos, rotY, label, flat = false) {
    const self = this;
    const grp = new THREE.Group(); grp.position.copy(pos); grp.rotation.y = rotY;
    // рамка слота
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, flat ? 0.06 : 0.38, flat ? 0.42 : 0.1),
      new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.8, roughness: 0.3 }));
    grp.add(frame);
    // мигающая рамка-индикатор
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.56, flat ? 0.04 : 0.44, flat ? 0.48 : 0.06),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc400, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }));
    if (flat) ind.position.y = -0.02; else ind.position.z = -0.03;
    grp.add(ind);
    G.scene.add(grp);
    this['ind_' + slotId] = ind;

    registerInteractable({
      mesh: grp,
      hint: () => {
        if (self.installed.has(self._recipeForSlot(slotId)?.id)) return `✅ ${label} — модуль установлен`;
        if (G.held?.type === 'module') {
          return G.held.recipe.slot === slotId
            ? `🔩 ${label} — [E] УСТАНОВИТЬ «${G.held.recipe.name}»`
            : `${label} — этот модуль сюда не подходит`;
        }
        return `${label} — нужен модуль (крафт на верстаке)`;
      },
      canUse: () => G.held?.type === 'module' && G.held.recipe.slot === slotId,
      onPress() {
        const recipe = G.held.recipe;
        const mesh = G.held.mesh;
        G.held = null;
        // зафиксировать модуль в слоте
        mesh.position.copy(pos);
        mesh.rotation.set(0, rotY, 0);
        if (flat) mesh.position.y += 0.16;
        self.installed.add(recipe.id);
        recipe.apply();
        G.sim.goal.upgrades = self.installed.size;
        ind.material.emissive.setHex(0x00e676);
        G.sfx.install();
        G.hud.log(`🔩 УСТАНОВЛЕНО: «${recipe.name}» — ${recipe.desc}`, 'ok');
        if (self.installed.size >= RECIPES.length) {
          G.hud.log('🏆 Все улучшения установлены! Всплывайте для победы.', 'ok');
        }
      },
    });
  }

  _recipeForSlot(slotId) { return RECIPES.find(r => r.slot === slotId); }

  update(dt, t) {
    if (this.crafting) {
      this.crafting.t += dt;
      const p = Math.min(1, this.crafting.t / this.crafting.recipe.time);
      this.craftBar.scale.x = p;
      this.craftBar.position.x = -2.2 - (1 - p) * 0.5;
      if (Math.random() < dt * 4) G.sfx.wrench();
      if (p >= 1) {
        const r = this.crafting.recipe;
        this.crafting = null;
        this.craftBar.scale.x = 0.001;
        this._spawnModule(r);
        G.sfx.craftDone();
        G.hud.log(`✅ Модуль «${r.name}» готов! Возьмите его с верстака [E].`, 'ok');
      }
    }
    // пульсация индикаторов слотов
    for (const r of RECIPES) {
      const ind = this['ind_' + r.slot];
      if (ind && !this.installed.has(r.id)) {
        ind.material.emissiveIntensity = 0.35 + Math.sin(t * 3) * 0.25;
      }
    }
  }
}
