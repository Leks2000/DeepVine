// ============ ОРГАНЫ УПРАВЛЕНИЯ: рычаги, кнопки, клапаны, штурвал, клаксон, шлюз ============
import * as THREE from 'three';
import { G, registerInteractable } from './state.js';
import { MAT, EXT } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- БОЛЬШОЙ РЫЧАГ (drag вверх-вниз) ----------
// onChange(value 0..1 или -0.3..1)
function makeLever(x, y, z, { min = 0, max = 1, init = 0, label, onChange, color = MAT.red, rotY = 0 }) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = rotY;
  // основание-сектор
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.3), MAT.dark);
  grp.add(base);
  const pivot = new THREE.Group(); pivot.position.set(0, 0, 0.08); grp.add(pivot);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.55, 8), MAT.brass);
  arm.position.y = 0.27; pivot.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), color);
  knob.position.y = 0.55; pivot.add(knob);
  G.scene.add(grp);

  let value = init;
  const span = max - min;
  const apply = () => { pivot.rotation.x = ((value - min) / span - 0.5) * 1.5; };
  apply();

  registerInteractable({
    mesh: grp,
    hint: () => `${label}: ${(value * 100) | 0}% — зажмите ЛКМ и тяните мышь`,
    drag: {
      start() { G.sfx.leverCreak(); },
      move(dx, dy) {
        value = clamp(value + dy * 0.004 * span * -1, min, max);
        apply(); onChange(value);
      },
      end() { G.sfx.click(); },
    },
    setValue(v) { value = clamp(v, min, max); apply(); onChange(value); },
  });
  return { grp, get value() { return value; } };
}

// ---------- КНОПКА ----------
function makeButton(x, y, z, { label, color = MAT.green, onPress, rotY = 0 }) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), MAT.brass);
  ring.rotation.x = Math.PI / 2; grp.add(ring);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 14), color.clone ? color : color);
  cap.rotation.x = Math.PI / 2; cap.position.z = 0.035; grp.add(cap);
  G.scene.add(grp);
  registerInteractable({
    mesh: grp,
    hint: () => `${label} — [E] нажать`,
    onPress() {
      cap.position.z = 0.01;
      setTimeout(() => { cap.position.z = 0.035; }, 140);
      onPress(cap);
    },
  });
  return grp;
}

// ---------- КЛАПАН-ВЕНТИЛЬ (drag по кругу) ----------
function makeValve(x, y, z, { label, onChange, init = 0, rotY = 0, color = MAT.red }) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), MAT.dark);
  stem.rotation.x = Math.PI / 2; stem.position.z = -0.06; grp.add(stem);
  const wheel = new THREE.Group(); wheel.position.z = 0.07; grp.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 22), color);
  wheel.add(rim);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 6), color);
    spoke.rotation.z = i * Math.PI / 3; wheel.add(spoke);
  }
  G.scene.add(grp);

  let value = init, angle = init * Math.PI * 4;
  wheel.rotation.z = -angle;
  registerInteractable({
    mesh: grp,
    hint: () => `${label}: ${(value * 100) | 0}% — зажмите ЛКМ, крутите мышью`,
    drag: {
      move(dx) {
        angle = clamp(angle + dx * 0.012, 0, Math.PI * 4);
        const v = angle / (Math.PI * 4);
        if (((v * 20) | 0) !== ((value * 20) | 0)) G.sfx.valveTick();
        value = v;
        wheel.rotation.z = -angle;
        onChange(value);
      },
    },
    setValue(v) { value = clamp(v, 0, 1); angle = value * Math.PI * 4; wheel.rotation.z = -angle; onChange(value); },
  });
  return grp;
}

// ---------- ШТУРВАЛ ----------
function makeWheel(x, y, z, { onChange }) {
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.7, 10), MAT.dark);
  col.position.y = -0.35; col.rotation.x = -0.5; grp.add(col);
  const wheel = new THREE.Group(); wheel.rotation.x = -0.5; grp.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 10, 28), MAT.brass);
  wheel.add(rim);
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.84, 6), MAT.pipe);
    sp.rotation.z = i * Math.PI / 4; wheel.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), MAT.red);
  wheel.add(hub);
  G.scene.add(grp);

  let turn = 0;
  registerInteractable({
    mesh: grp,
    hint: () => `ШТУРВАЛ (курс) — зажмите ЛКМ, ведите влево/вправо`,
    drag: {
      move(dx) {
        turn = clamp(turn + dx * 0.01, -1.6, 1.6);
        wheel.rotation.z = -turn;
        onChange(clamp(turn / 1.6, -1, 1));
      },
      end() {
        // штурвал плавно возвращается
        const iv = setInterval(() => {
          turn *= 0.85; wheel.rotation.z = -turn; onChange(clamp(turn / 1.6, -1, 1));
          if (Math.abs(turn) < 0.02) { turn = 0; wheel.rotation.z = 0; onChange(0); clearInterval(iv); }
        }, 50);
      },
    },
  });
}

// ---------- КЛАКСОН: ручка под потолком, тянуть строго ВНИЗ ----------
function makeKlaxonPull(x, y, z) {
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), MAT.dark);
  grp.add(mount);
  const chainMat = MAT.brass;
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), chainMat);
  chain.position.y = -0.19; grp.add(chain);
  const handleGrp = new THREE.Group(); handleGrp.position.y = -0.36; grp.add(handleGrp);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), MAT.red);
  handle.rotation.z = Math.PI / 2; handleGrp.add(handle);
  G.scene.add(grp);

  let pull = 0, fired = false;
  registerInteractable({
    mesh: grp,
    hint: () => 'КЛАКСОН — зажмите ЛКМ и потяните ВНИЗ',
    drag: {
      start() { fired = false; },
      move(dx, dy) {
        if (dy > 0) pull = clamp(pull + dy * 0.004, 0, 0.45);  // только вниз!
        handleGrp.position.y = -0.36 - pull;
        chain.scale.y = 1 + pull / 0.3; chain.position.y = -0.19 - pull / 2;
        if (pull >= 0.42 && !fired) {
          fired = true;
          G.sfx.klaxon();
          G.hud.log('📯 КЛАКСОН! Сигнал подан.', 'ok');
        }
      },
      end() {
        const iv = setInterval(() => {
          pull *= 0.7; handleGrp.position.y = -0.36 - pull;
          chain.scale.y = 1 + pull / 0.3; chain.position.y = -0.19 - pull / 2;
          if (pull < 0.01) { pull = 0; clearInterval(iv); }
        }, 40);
      },
    },
  });
}

// ---------- АВАРИЙНАЯ ПРОДУВКА (рычаг с защитной скобой) ----------
function makeEmergencyBlow(x, y, z, rotY) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY;
  box3(grp, 0.5, 0.7, 0.12, MAT.yellow, 0, 0, -0.06);
  box3(grp, 0.42, 0.62, 0.13, MAT.dark, 0, 0, -0.05);
  const pivot = new THREE.Group(); grp.add(pivot);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 8), MAT.red);
  arm.position.y = 0.2; pivot.add(arm);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.08), MAT.red);
  grip.position.y = 0.42; pivot.add(grip);
  pivot.rotation.x = -0.6;
  G.scene.add(grp);

  let v = 0;
  registerInteractable({
    mesh: grp,
    hint: () => `АВАРИЙНАЯ ПРОДУВКА (${G.sim.blowCharges} зар.) — тянуть ВНИЗ до упора`,
    canUse: () => G.sim.blowCharges > 0,
    drag: {
      move(dx, dy) {
        if (dy > 0) v = clamp(v + dy * 0.005, 0, 1);
        pivot.rotation.x = -0.6 + v * 1.2;
        if (v >= 1) {
          v = 0; pivot.rotation.x = -0.6;
          if (G.sim.emergencyBlow()) {
            G.sfx.blow(); G.sfx.alarm();
            G.hud.log('⛽ АВАРИЙНАЯ ПРОДУВКА! Балласт сброшен!', 'warn');
            G.controls.ballastValve?.setValue?.(0);
          }
        }
      },
      end() { v = 0; pivot.rotation.x = -0.6; },
    },
  });
}

function box3(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}

// ---------- ШЛЮЗ (выход наружу) ----------
function makeAirlock() {
  // дверь шлюза в машинном отсеке, корма
  const grp = new THREE.Group(); grp.position.set(0, 1.3, 21.8);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.15, 22), MAT.bulk);
  door.rotation.x = Math.PI / 2; grp.add(door);
  const wheelV = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 20), MAT.red);
  wheelV.position.z = -0.12; grp.add(wheelV);
  G.scene.add(grp);

  registerInteractable({
    mesh: grp,
    hint: () => G.sim.depth > 0.5
      ? '🚪 ШЛЮЗ — заблокирован: всплывите на поверхность!'
      : '🚪 ШЛЮЗ — [E] выйти на палубу',
    canUse: () => G.sim.depth <= 0.5,
    onPress() {
      G.sfx.airlock();
      G.flags.outside = true;
      G.player.teleport(EXT.x, 14, Math.PI);
      G.hud.log('🌊 Вы на палубе. Свежий воздух!', 'ok');
    },
  });

  // люк на палубе — вернуться внутрь
  const back = new THREE.Group(); back.position.set(EXT.x, 0.35, 16);
  const h2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 18), MAT.bulk);
  back.add(h2);
  G.scene.add(back);
  registerInteractable({
    mesh: back,
    hint: () => '🚪 ЛЮК — [E] спуститься внутрь',
    onPress() {
      G.sfx.airlock();
      G.flags.outside = false;
      G.player.teleport(0, 20, Math.PI);
      G.hud.log('Вы внутри субмарины.', '');
    },
  });
}

// ---------- СБОРКА ВСЕХ ОРГАНОВ ----------
export function buildControls() {
  const C = {};
  const sim = G.sim;

  // мостик: на главной консоли
  makeWheel(0, 1.35, -8.6, { onChange: v => { sim.rudder = v; } });

  C.throttle = makeLever(-1.7, 1.15, -8.8, {
    min: -0.3, max: 1, init: 0, label: 'МАШИННЫЙ ТЕЛЕГРАФ (ход)',
    onChange: v => { sim.throttle = v; }, color: MAT.brass,
  });

  // вентиль балласта — мостик, левая стена
  C.ballastValve = null;
  C.ballastValve = (() => {
    let ref = null;
    const grp = makeValve(-2.85, 1.5, -6, {
      label: 'БАЛЛАСТ (заполнение)', rotY: Math.PI / 2,
      onChange: v => { sim.ballast = v; },
    });
    ref = G.interactables[G.interactables.length - 1];
    return ref;
  })();
  // табличка
  // клаксон — под потолком мостика
  makeKlaxonPull(0.9, 2.85, -7.2);

  // аварийная продувка — мостик, правая стена
  makeEmergencyBlow(2.8, 1.5, -6.5, -Math.PI / 2);

  // реакторный отсек: 3 кнопки запуска на панели (правая стена)
  const names = ['I', 'II', 'III'];
  for (let i = 0; i < 3; i++) {
    makeButton(2.66, 1.7, 9 + i * 0.8, {
      label: `ЗАПУСК РЕАКТОРА ${names[i]}`, rotY: -Math.PI / 2,
      color: new THREE.MeshStandardMaterial({ color: 0x9e9e9e, emissive: 0x000000 }),
      onPress(cap) {
        const r = sim.pressReactorButton(i + 1);
        if (r === 'started') {
          G.sfx.buttonOk(); G.sfx.craftDone();
          G.hud.log('⚛ РЕАКТОР ЗАПУЩЕН! Энергия и регенерация O₂ активны.', 'ok');
          cap.material.emissive.setHex(0x00e676); cap.material.emissiveIntensity = 0.8;
        } else if (r === 'ok') {
          G.sfx.buttonOk();
          G.hud.log(`Реактор: ступень ${i + 1}/3 ✓`, '');
          cap.material.emissive.setHex(0x00e676); cap.material.emissiveIntensity = 0.8;
        } else if (r === 'wrong') {
          G.sfx.buttonErr();
          G.hud.log('⚠ Неверная последовательность! Сброс. Жмите 1→2→3.', 'warn');
          // погасить все
          for (const it of G.interactables) {
            it.mesh.traverse(o => {
              if (o.material?.emissive && o.geometry?.type === 'CylinderGeometry' && o.material.color?.getHex() === 0x9e9e9e)
                o.material.emissive.setHex(0x000000);
            });
          }
        }
      },
    });
  }

  // вентиль охлаждения реактора (декоративно-полезный: снижает нагрев)
  makeValve(2.66, 0.9, 12.5, {
    label: 'ОХЛАЖДЕНИЕ РЕАКТОРА', rotY: -Math.PI / 2, color: MAT.green,
    onChange: v => { sim.reactorHeat = Math.max(20, sim.reactorHeat - v * 0.5); },
  });

  // шлюз
  makeAirlock();

  G.controls = C;
}
