// ============ ПОЖАРЫ, ТЕЧИ, КЗ — stress-driven + прогрессия ============
import * as THREE from 'three';
import { G, registerInteractable, unregisterInteractable } from './state.js';
import { MAT, COMPARTMENTS, HULL } from './world.js';

const rand = (a, b) => a + Math.random() * (b - a);

function makeCarryable({ mesh, type, label, homePos, holdDef, chargeFn }) {
  mesh.position.copy(homePos);
  G.scene.add(mesh);

  const def = registerInteractable({
    mesh,
    hint: () => `${label} — [E] взять`,
    canUse: () => !G.held,
    onPress() { pickUp(); },
  });

  function pickUp() {
    G.sfx.pickup();
    unregisterInteractable(def);
    G.held = {
      type, mesh, label,
      hold: holdDef,
      charge: chargeFn,
      drop() {
        G.sfx.drop();
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
        mesh.position.copy(G.player.pos).add(fwd.multiplyScalar(0.8));
        mesh.position.y = G.player.pos.y - 1.2;
        mesh.rotation.set(0, G.player.yaw, 0);
        G.held = null;
        registerInteractable(def);
      },
    };
  }
  return { def, mesh };
}

function buildExtinguisherMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 14), MAT.red));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.1, 10), MAT.dark);
  top.position.y = 0.26; g.add(top);
  return g;
}

function buildWrenchMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.025), MAT.brass));
  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 6), MAT.brass);
  jaw.position.y = 0.2; jaw.rotation.x = Math.PI / 2; g.add(jaw);
  return g;
}

function makeFireFx(pos) {
  const grp = new THREE.Group(); grp.position.copy(pos);
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 7), new THREE.MeshBasicMaterial({
      color: i % 2 ? 0xff6d00 : 0xffc400, transparent: true, opacity: 0.85,
    }));
    m.position.set(rand(-0.3, 0.3), rand(0, 0.25), rand(-0.3, 0.3));
    grp.add(m); flames.push(m);
  }
  const light = new THREE.PointLight(0xff6d00, 6, 6, 1.8);
  light.position.y = 0.4; grp.add(light);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.4 }));
  smoke.position.y = 0.9; grp.add(smoke);
  G.scene.add(grp);
  return { grp, flames, light, smoke };
}

function makeSmokeFx(pos) {
  const grp = new THREE.Group(); grp.position.copy(pos);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.5 }));
  smoke.position.y = 0.6; grp.add(smoke);
  G.scene.add(grp);
  return { grp, smoke };
}

function makeLeakFx(pos, tier = 1) {
  const grp = new THREE.Group(); grp.position.copy(pos);
  const drops = [];
  const n = tier === 0 ? 3 : tier === 1 ? 6 : 12;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.8 }));
    m.userData.t = Math.random();
    grp.add(m); drops.push(m);
  }
  G.scene.add(grp);
  return { grp, drops, tier };
}

function makeSparkFx(pos) {
  const grp = new THREE.Group(); grp.position.copy(pos);
  const light = new THREE.PointLight(0x80d8ff, 2, 4);
  grp.add(light);
  const sparks = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xb3e5fc }));
    grp.add(m); sparks.push(m);
  }
  G.scene.add(grp);
  return { grp, light, sparks };
}

const LEAK_RATES = [0.01, 0.05, 0.15];

export class Hazards {
  constructor() {
    this.fires = [];
    this.leaks = [];
    this.shorts = [];
    this.warnings = [];       // предупреждения до полной аварии
    this.nextId = 1;
    this.extCharge = 100;
    this.hazardPressure = 0;
    this.stressWarned = false;
    this._buildTools();
    this._buildRechargeStation();
  }

  _buildTools() {
    const self = this;
    makeCarryable({
      mesh: buildExtinguisherMesh(),
      type: 'extinguisher', label: '🧯 ОГНЕТУШИТЕЛЬ',
      homePos: new THREE.Vector3(2.78, 1.3, 0.5),
      chargeFn: () => `заряд ${self.extCharge | 0}%`,
      holdDef: { tick(dt) { self._sprayTick(dt); } },
    });
    makeCarryable({
      mesh: buildWrenchMesh(),
      type: 'wrench', label: '🔧 ГАЕЧНЫЙ КЛЮЧ',
      homePos: new THREE.Vector3(-2.6, 0.95, 20.5),
      holdDef: { tick(dt) { self._wrenchTick(dt); } },
    });
  }

  _buildRechargeStation() {
    const self = this;
    const grp = new THREE.Group(); grp.position.set(2.8, 1.0, 1.6);
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), MAT.yellow));
    G.scene.add(grp);
    registerInteractable({
      mesh: grp,
      hint: () => G.held?.type === 'extinguisher'
        ? `⛽ СТАНЦИЯ ПЕРЕЗАРЯДКИ — [E] зарядить (${self.extCharge | 0}%)`
        : '⛽ СТАНЦИЯ ПЕРЕЗАРЯДКИ — нужен огнетушитель',
      canUse: () => G.held?.type === 'extinguisher',
      onPress() {
        self.extCharge = 100;
        G.sfx.craftDone();
        G.hud.log('🧯 Огнетушитель перезаряжен: 100%', 'ok');
      },
    });
  }

  _pickComp() {
    const upper = COMPARTMENTS.filter(c => !c.lowerDeck);
    return upper[(Math.random() * upper.length) | 0];
  }

  _posInComp(c, lower = false) {
    const y = lower ? rand(-0.8, -0.3) : rand(0.15, 1.8);
    return new THREE.Vector3(rand(-1.4, 1.4), y, rand(c.z0 + 1.5, c.z1 - 1.5));
  }

  _sprayTick(dt) {
    if (G.held?.type !== 'extinguisher') return;
    if (this.extCharge <= 0) { G.hud.hintFlash('Огнетушитель ПУСТ!'); return; }
    this.extCharge = Math.max(0, this.extCharge - 9 * dt);
    G.sfx.extinguish();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    for (const f of this.fires) {
      const to = f.fx.grp.position.clone().sub(G.player.pos);
      if (to.length() < 3.2 && to.normalize().dot(fwd) > 0.72) {
        f.hp -= 38 * dt;
        if (f.hp <= 0) this._killFire(f);
      }
    }
    for (const w of this.warnings) {
      if (w.type !== 'fire') continue;
      const to = w.fx.grp.position.clone().sub(G.player.pos);
      if (to.length() < 3.2 && to.normalize().dot(fwd) > 0.72) {
        w.stage = Math.max(0, w.stage - dt * 2);
        if (w.stage <= 0) { G.scene.remove(w.fx.grp); this.warnings.splice(this.warnings.indexOf(w), 1); }
      }
    }
  }

  _wrenchTick(dt) {
    if (G.held?.type !== 'wrench') return;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    for (const arr of [this.leaks, this.shorts]) {
      for (const x of arr) {
        const to = x.fx.grp.position.clone().sub(G.player.pos);
        if (to.length() < 2.2 && to.normalize().dot(fwd) > 0.6) {
          x.hp -= 30 * dt;
          if (Math.random() < dt * 6) G.sfx.wrench();
          if (x.hp <= 0) {
            if (arr === this.leaks) this._killLeak(x);
            else this._killShort(x);
          }
        }
      }
    }
  }

  _startWarning(type, comp) {
    const pos = type === 'leak'
      ? new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (HULL.w / 2 - 0.35), rand(0.8, 2), rand(comp.z0 + 1, comp.z1 - 1))
      : this._posInComp(comp);
    let fx;
    if (type === 'fire') fx = makeSparkFx(pos);
    else if (type === 'leak') fx = makeLeakFx(pos, 0);
    else fx = makeSparkFx(pos);
    const w = { type, stage: 0, maxStage: type === 'fire' ? 2 : type === 'leak' ? 2 : 1, fx, comp, timer: 0, pos };
    this.warnings.push(w);
    const reasons = [];
    const sim = G.sim;
    if (sim.engineOn) reasons.push('двигатель');
    if (sim.depth > 80) reasons.push('глубина');
    if (sim.reactorHeat > 80) reasons.push('перегрев');
    if (sim.totalWater() > 0.3) reasons.push('затопление');
    const why = reasons.length ? reasons.join(', ') : 'перегрузка';
    if (type === 'fire') G.hud.log(`⚠ Искры в «${comp.name}» — нагрузка: ${why}`, 'warn');
    else if (type === 'leak') G.hud.log(`⚠ Капель в «${comp.name}» — ${why}`, 'warn');
    else G.hud.log(`⚡ Искрение в «${comp.name}» — ${why}`, 'warn');
    G.sfx.warnBeep();
  }

  _escalateWarning(w) {
    if (w.type === 'fire') {
      if (w.stage === 1) {
        G.scene.remove(w.fx.grp);
        w.fx = makeSmokeFx(w.pos);
        G.hud.log(`💨 Задымление: ${w.comp.name}!`, 'warn');
      } else if (w.stage >= 2) {
        G.scene.remove(w.fx.grp);
        this.warnings.splice(this.warnings.indexOf(w), 1);
        this.spawnFire(COMPARTMENTS.indexOf(w.comp));
        return;
      }
    } else if (w.type === 'leak') {
      if (w.stage === 1) {
        G.scene.remove(w.fx.grp);
        w.fx = makeLeakFx(w.pos, 1);
        G.hud.log(`💧 Течь усиливается: ${w.comp.name}!`, 'bad');
      } else if (w.stage >= 2) {
        G.scene.remove(w.fx.grp);
        this.warnings.splice(this.warnings.indexOf(w), 1);
        this.spawnLeak(w.comp, 2);
        return;
      }
    } else if (w.stage >= 1) {
      G.scene.remove(w.fx.grp);
      this.warnings.splice(this.warnings.indexOf(w), 1);
      this.spawnShort(w.comp);
      return;
    }
    w.stage++;
  }

  spawnFire(compIdx = null) {
    const c = compIdx != null ? COMPARTMENTS[compIdx] : this._pickComp();
    if (!c || c.lowerDeck) return null;
    const pos = this._posInComp(c);
    const f = { fx: makeFireFx(pos), hp: 100, id: this.nextId++, comp: c };
    this.fires.push(f);
    G.sfx.alarm(); G.sfx.fireLoopStart(f.id);
    G.hud.log(`🔥 ПОЖАР: ${c.name}! Берите огнетушитель!`, 'bad');
    G.hud.flash();
    return f;
  }

  spawnLeak(comp = null, tier = 1) {
    const c = comp || this._pickComp();
    if (!c || c.lowerDeck) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const pos = new THREE.Vector3(side * (HULL.w / 2 - 0.35), rand(0.8, 2.2), rand(c.z0 + 1, c.z1 - 1));
    const l = { fx: makeLeakFx(pos, tier), hp: 60 + tier * 20, comp: c, tier };
    this.leaks.push(l);
    if (tier >= 2) { G.sfx.alarm(); G.hud.flash(); }
    G.hud.log(`💧 ${tier >= 2 ? 'КРИТИЧЕСКАЯ ' : ''}ТЕЧЬ: ${c.name}! Чините ключом!`, tier >= 2 ? 'bad' : 'warn');
  }

  spawnShort(comp = null) {
    const c = comp || this._pickComp();
    if (!c || c.lowerDeck) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const pos = new THREE.Vector3(side * (HULL.w / 2 - 0.4), rand(1.5, 2.6), rand(c.z0 + 1, c.z1 - 1));
    const s = { fx: makeSparkFx(pos), hp: 80, comp: c };
    this.shorts.push(s);
    G.sfx.alarm();
    G.hud.log(`⚡ КОРОТКОЕ ЗАМЫКАНИЕ: ${c.name}!`, 'bad');
    G.hud.flash();
  }

  _killFire(f) {
    G.sfx.fireLoopStop(f.id);
    G.scene.remove(f.fx.grp);
    this.fires.splice(this.fires.indexOf(f), 1);
    G.hud.log(`✅ Пожар в «${f.comp.name}» потушен!`, 'ok');
  }
  _killLeak(l) {
    G.scene.remove(l.fx.grp);
    this.leaks.splice(this.leaks.indexOf(l), 1);
    G.sim.water[l.comp.id] = Math.max(0, G.sim.water[l.comp.id] - 0.2);
    G.hud.log(`✅ Течь в «${l.comp.name}» заделана!`, 'ok');
  }
  _killShort(s) {
    G.scene.remove(s.fx.grp);
    this.shorts.splice(this.shorts.indexOf(s), 1);
    G.hud.log(`✅ Проводка в «${s.comp.name}» починена!`, 'ok');
  }

  update(dt, t) {
    const sim = G.sim;
    if (!sim) return;

    for (const f of this.fires) {
      sim.o2 -= 0.8 * dt;
      sim.hull -= 0.25 * dt;
      f.fx.flames?.forEach((fl, i) => {
        fl.scale.y = (0.8 + Math.sin(t * 9 + i * 2) * 0.3) * Math.max(0.2, f.hp / 100);
        fl.rotation.y = t * 2 + i;
      });
      if (f.fx.light) f.fx.light.intensity = 4 + Math.sin(t * 13) * 2;
      // распространение
      if (f.hp < 40 && Math.random() < dt * 0.08 && this.fires.length < 2) {
        const upper = COMPARTMENTS.filter(c => !c.lowerDeck);
        const idx = upper.indexOf(f.comp);
        if (idx >= 0 && idx < upper.length - 1) {
          const next = upper[idx + 1];
          if (!this.fires.find(x => x.comp.id === next.id)) {
            this.spawnFire(COMPARTMENTS.indexOf(next));
          }
        }
      }
    }

    for (const l of this.leaks) {
      sim.hull -= (0.2 + l.tier * 0.3) * dt;
      const rate = LEAK_RATES[l.tier] ?? 0.05;
      sim.water[l.comp.id] = Math.min(1.2, (sim.water[l.comp.id] || 0) + rate * dt);
      l.fx.drops?.forEach(d => {
        d.userData.t += dt * (1 + l.tier);
        if (d.userData.t > 1) d.userData.t = 0;
        d.position.set(0, -d.userData.t * 1.5, 0);
      });
    }

    for (const s of this.shorts) {
      sim.power -= 1.4 * dt;
      const on = Math.random() < 0.25;
      s.fx.light.intensity = on ? rand(3, 8) : 0;
    }

    if (this.shorts.length > 0) {
      for (const L of G.interiorLights) {
        L.light.intensity = Math.random() < 0.12 ? L.base * 0.2 : L.base;
      }
    }

    // прогрессия предупреждений
    for (const w of [...this.warnings]) {
      w.timer += dt;
      if (w.timer > 8 - w.stage * 2) {
        w.timer = 0;
        this._escalateWarning(w);
      }
      if (w.type === 'fire' && w.fx.light) {
        w.fx.light.intensity = 1 + Math.sin(t * 20) * 0.8;
      }
    }

    // stress-driven спавн
    if (sim.reactorOn && !G.flags.over) {
      this.hazardPressure += (sim.stress - this.hazardPressure) * dt * 0.08;

      if (sim.stress > 55 && !this.stressWarned) {
        this.stressWarned = true;
        G.hud.log('⚠ СИСТЕМЫ ПЕРЕГРУЖЕНЫ! Снизьте ход или глубину.', 'warn');
        G.sfx.warnBeep();
      }
      if (sim.stress < 40) this.stressWarned = false;

      const total = this.fires.length + this.leaks.length + this.shorts.length + this.warnings.length;
      if (total < 4 && this.hazardPressure > 35) {
        const chance = (this.hazardPressure - 45) * 0.00025 * dt * (1 + sim.depth / 300);
        if (Math.random() < chance) {
          const comp = this._pickComp();
          const r = Math.random();
          let type = 'fire';
          if (sim.reactorHeat > 85 || this.shorts.length > 0) type = r < 0.5 ? 'short' : 'fire';
          else if (sim.totalWater() > 0.5 || sim.depth > 100) type = r < 0.45 ? 'leak' : 'fire';
          else type = r < 0.4 ? 'fire' : r < 0.7 ? 'leak' : 'short';
          this._startWarning(type, comp);
          this.hazardPressure *= 0.6;
        }
      }
    }

    G.sfx?.setWater(Math.min(1, sim.totalWater() / 3));
  }
}
