// ============ ПОЖАРЫ, ТЕЧИ, КЗ + ОГНЕТУШИТЕЛЬ И ГАЕЧНЫЙ КЛЮЧ ============
import * as THREE from 'three';
import { G, registerInteractable, unregisterInteractable } from './state.js';
import { MAT, COMPARTMENTS, HULL } from './world.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ---------- ПЕРЕНОСИМЫЙ ПРЕДМЕТ (общая логика взять/бросить) ----------
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
        // положить перед игроком
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
        mesh.position.copy(G.player.pos).add(fwd.multiplyScalar(0.8));
        mesh.position.y = 0.35;
        mesh.rotation.set(0, G.player.yaw, 0);
        G.held = null;
        registerInteractable(def);
      },
    };
  }
  return { def, mesh };
}

// ---------- МОДЕЛИ ИНСТРУМЕНТОВ ----------
function buildExtinguisherMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 14), MAT.red);
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.1, 10), MAT.dark);
  top.position.y = 0.26; g.add(top);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.04), MAT.black);
  handle.position.set(0.03, 0.32, 0); g.add(handle);
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.25, 8), MAT.black);
  hose.position.set(0.1, 0.1, 0); hose.rotation.z = -0.7; g.add(hose);
  return g;
}

function buildWrenchMesh() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.025), MAT.brass);
  g.add(shaft);
  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 6), MAT.brass);
  jaw.position.y = 0.2; jaw.rotation.x = Math.PI / 2; g.add(jaw);
  return g;
}

// ---------- ЧАСТИЦЫ ОГНЯ ----------
function makeFireFx(pos) {
  const grp = new THREE.Group(); grp.position.copy(pos);
  const flames = [];
  const geo = new THREE.ConeGeometry(0.16, 0.5, 7);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: i % 2 ? 0xff6d00 : 0xffc400, transparent: true, opacity: 0.85,
    }));
    m.position.set(rand(-0.3, 0.3), rand(0, 0.25), rand(-0.3, 0.3));
    grp.add(m); flames.push(m);
  }
  const light = new THREE.PointLight(0xff6d00, 6, 6, 1.8);
  light.position.y = 0.4; grp.add(light);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.35 }));
  smoke.position.y = 0.9; grp.add(smoke);
  G.scene.add(grp);
  return { grp, flames, light, smoke };
}

// ---------- ЧАСТИЦЫ ВОДЫ (течь) ----------
function makeLeakFx(pos) {
  const grp = new THREE.Group(); grp.position.copy(pos);
  const drops = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.8 }));
    m.userData.t = Math.random();
    grp.add(m); drops.push(m);
  }
  G.scene.add(grp);
  return { grp, drops };
}

// ---------- ИСКРЫ (КЗ) ----------
function makeSparkFx(pos) {
  const grp = new THREE.Group(); grp.position.copy(pos);
  const light = new THREE.PointLight(0x80d8ff, 0, 4);
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

// ============ МЕНЕДЖЕР АВАРИЙ ============
export class Hazards {
  constructor() {
    this.fires = [];     // { fx, hp, id, comp }
    this.leaks = [];     // { fx, hp, comp }
    this.shorts = [];    // { fx, hp, comp }
    this.nextId = 1;
    this.timer = 12;     // первая авария через N сек после запуска реактора
    this.extCharge = 100;

    this._buildTools();
    this._buildRechargeStation();
  }

  _buildTools() {
    // огнетушитель — на стене жилого отсека
    const self = this;
    makeCarryable({
      mesh: buildExtinguisherMesh(),
      type: 'extinguisher', label: '🧯 ОГНЕТУШИТЕЛЬ',
      homePos: new THREE.Vector3(2.78, 1.3, 0.5),
      chargeFn: () => `заряд ${self.extCharge | 0}%`,
      holdDef: {
        start() { },
        tick(dt) { self._sprayTick(dt); },
        end() { },
      },
    });
    // гаечный ключ — машинный отсек (возле верстака)
    makeCarryable({
      mesh: buildWrenchMesh(),
      type: 'wrench', label: '🔧 ГАЕЧНЫЙ КЛЮЧ',
      homePos: new THREE.Vector3(-2.6, 0.95, 20.5),
      holdDef: {
        tick(dt) { self._wrenchTick(dt); },
      },
    });
  }

  _buildRechargeStation() {
    const self = this;
    const grp = new THREE.Group(); grp.position.set(2.8, 1.0, 1.6);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), MAT.yellow);
    grp.add(tank);
    const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.02), MAT.red);
    lbl.position.set(0, 0, -0.16); grp.add(lbl);
    G.scene.add(grp);
    registerInteractable({
      mesh: grp,
      hint: () => G.held?.type === 'extinguisher'
        ? `⛽ СТАНЦИЯ ПЕРЕЗАРЯДКИ — [E] зарядить огнетушитель (${self.extCharge | 0}%)`
        : '⛽ СТАНЦИЯ ПЕРЕЗАРЯДКИ ОГНЕТУШИТЕЛЕЙ — нужен огнетушитель в руках',
      canUse: () => G.held?.type === 'extinguisher',
      onPress() {
        self.extCharge = 100;
        G.sfx.craftDone();
        G.hud.log('🧯 Огнетушитель перезаряжен: 100%', 'ok');
      },
    });
  }

  // --- тушение: струя из огнетушителя ---
  _sprayTick(dt) {
    if (G.held?.type !== 'extinguisher') return;
    if (this.extCharge <= 0) { G.hud.hintFlash('Огнетушитель ПУСТ — перезарядите!'); return; }
    this.extCharge = Math.max(0, this.extCharge - 9 * dt);
    G.sfx.extinguish();
    this._sprayFx();
    // попадание по ближайшему огню в конусе перед игроком
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    for (const f of this.fires) {
      const to = f.fx.grp.position.clone().sub(G.player.pos);
      const dist = to.length();
      if (dist < 3.2 && to.normalize().dot(fwd) > 0.72) {
        f.hp -= 38 * dt;
        f.fx.flames.forEach(fl => fl.scale.setScalar(Math.max(0.15, f.hp / 100)));
        if (f.hp <= 0) this._killFire(f);
      }
    }
  }

  _sprayFx() {
    // короткоживущие белые частицы
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    const p = new THREE.Mesh(new THREE.SphereGeometry(rand(0.04, 0.1), 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xeceff1, transparent: true, opacity: 0.7 }));
    p.position.copy(G.player.pos).add(new THREE.Vector3(0.3, -0.3, 0).applyQuaternion(G.camera.quaternion)).add(fwd.clone().multiplyScalar(rand(0.5, 1)));
    G.scene.add(p);
    const vel = fwd.clone().multiplyScalar(rand(2.5, 4)).add(new THREE.Vector3(rand(-0.5, 0.5), rand(-0.3, 0.5), rand(-0.5, 0.5)));
    const t0 = performance.now();
    const anim = () => {
      const dt = 0.016;
      p.position.add(vel.clone().multiplyScalar(dt));
      p.material.opacity -= 0.04;
      if (performance.now() - t0 < 700 && p.material.opacity > 0) requestAnimationFrame(anim);
      else { G.scene.remove(p); p.geometry.dispose(); p.material.dispose(); }
    };
    anim();
  }

  // --- ремонт ключом: течи и КЗ ---
  _wrenchTick(dt) {
    if (G.held?.type !== 'wrench') return;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    let worked = false;
    for (const arr of [this.leaks, this.shorts]) {
      for (const x of arr) {
        const to = x.fx.grp.position.clone().sub(G.player.pos);
        if (to.length() < 2.2 && to.normalize().dot(fwd) > 0.6) {
          x.hp -= 30 * dt; worked = true;
          if (Math.random() < dt * 6) G.sfx.wrench();
          if (x.hp <= 0) {
            if (arr === this.leaks) this._killLeak(x); else this._killShort(x);
          }
        }
      }
    }
    if (worked && G.player) {
      // лёгкая «качка» ключа
      G.held.mesh.rotation.z += Math.sin(performance.now() * 0.02) * 0.02;
    }
  }

  // --- спавн аварий ---
  spawnFire(compIdx = null) {
    const c = COMPARTMENTS[compIdx ?? (Math.random() * COMPARTMENTS.length) | 0];
    const pos = new THREE.Vector3(rand(-1.6, 1.6), 0.15, rand(c.z0 + 1.5, c.z1 - 1.5));
    const f = { fx: makeFireFx(pos), hp: 100, id: this.nextId++, comp: c };
    this.fires.push(f);
    G.sfx.alarm(); G.sfx.fireLoopStart(f.id);
    G.hud.log(`🔥 ПОЖАР: ${c.name}! Берите огнетушитель!`, 'bad');
    G.hud.flash();
    return f;
  }

  spawnLeak() {
    const c = COMPARTMENTS[(Math.random() * COMPARTMENTS.length) | 0];
    const side = Math.random() < 0.5 ? -1 : 1;
    const pos = new THREE.Vector3(side * (HULL.w / 2 - 0.35), rand(0.8, 2.2), rand(c.z0 + 1, c.z1 - 1));
    const l = { fx: makeLeakFx(pos), hp: 100, comp: c };
    this.leaks.push(l);
    G.sfx.alarm();
    G.hud.log(`💧 ТЕЧЬ: ${c.name}! Чините гаечным ключом!`, 'bad');
    G.hud.flash();
  }

  spawnShort() {
    const c = COMPARTMENTS[(Math.random() * COMPARTMENTS.length) | 0];
    const side = Math.random() < 0.5 ? -1 : 1;
    const pos = new THREE.Vector3(side * (HULL.w / 2 - 0.4), rand(1.5, 2.6), rand(c.z0 + 1, c.z1 - 1));
    const s = { fx: makeSparkFx(pos), hp: 80, comp: c };
    this.shorts.push(s);
    G.sfx.alarm();
    G.hud.log(`⚡ КОРОТКОЕ ЗАМЫКАНИЕ: ${c.name}! Свет мигает. Чините ключом!`, 'bad');
    G.hud.flash();
  }

  _killFire(f) {
    G.sfx.fireLoopStop(f.id);
    G.scene.remove(f.fx.grp);
    this.fires.splice(this.fires.indexOf(f), 1);
    G.hud.log(`✅ Пожар в отсеке «${f.comp.name}» потушен!`, 'ok');
  }
  _killLeak(l) {
    G.scene.remove(l.fx.grp);
    this.leaks.splice(this.leaks.indexOf(l), 1);
    G.hud.log(`✅ Течь в отсеке «${l.comp.name}» заделана!`, 'ok');
  }
  _killShort(s) {
    G.scene.remove(s.fx.grp);
    this.shorts.splice(this.shorts.indexOf(s), 1);
    G.hud.log(`✅ Проводка в отсеке «${s.comp.name}» починена!`, 'ok');
  }

  update(dt, t) {
    const sim = G.sim;

    // урон от аварий
    for (const f of this.fires) {
      sim.o2 -= 0.8 * dt;
      sim.hull -= 0.25 * dt;
      // анимация пламени
      f.fx.flames.forEach((fl, i) => {
        fl.scale.y = (0.8 + Math.sin(t * 9 + i * 2) * 0.3) * Math.max(0.2, f.hp / 100);
        fl.rotation.y = t * 2 + i;
      });
      f.fx.light.intensity = 4 + Math.sin(t * 13) * 2;
      f.fx.smoke.position.y = 0.9 + Math.sin(t * 2) * 0.1;
    }
    for (const l of this.leaks) {
      sim.hull -= 0.5 * dt;
      l.fx.drops.forEach(d => {
        d.userData.t += dt * 1.6;
        if (d.userData.t > 1) d.userData.t = 0;
        d.position.set(0, -d.userData.t * (l.fx.grp.position.y - 0.05), 0);
      });
    }
    for (const s of this.shorts) {
      sim.power -= 1.4 * dt;
      const on = Math.random() < 0.25;
      s.fx.light.intensity = on ? rand(3, 8) : 0;
      s.fx.sparks.forEach(sp => {
        if (on) sp.position.set(rand(-0.2, 0.2), rand(-0.3, 0), rand(-0.2, 0.2));
      });
    }

    // мигание света при КЗ
    if (this.shorts.length > 0) {
      for (const L of G.interiorLights) {
        L.light.intensity = Math.random() < 0.12 ? L.base * 0.2 : L.base;
      }
    }

    // планировщик новых аварий — только после запуска реактора
    if (sim.reactorOn && !G.flags.over) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const total = this.fires.length + this.leaks.length + this.shorts.length;
        if (total < 3) {
          const r = Math.random();
          if (r < 0.45) this.spawnFire();
          else if (r < 0.75) this.spawnLeak();
          else this.spawnShort();
        }
        this.timer = rand(22, 40) * (sim.depth > 120 ? 0.6 : 1);
      }
    }
  }
}
