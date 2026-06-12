// ============ ОРГАНЫ УПРАВЛЕНИЯ: рычаги, кнопки, клапаны, штурвал, клаксон, шлюз ============
import * as THREE from 'three';
import { G, registerInteractable } from './state.js';
import { MAT, DECK } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeLever(x, y, z, { min = 0, max = 1, init = 0, label, onChange, color = MAT.red, rotY = 0, canUse = null }) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = rotY;
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
    hint: () => {
      if (canUse && !canUse()) return `${label} — ДВИГАТЕЛЬ НЕ ЗАПУЩЕН`;
      return `${label}: ${(value * 100) | 0}% — зажмите ЛКМ и тяните мышь`;
    },
    canUse: () => !canUse || canUse(),
    drag: {
      start() { if (!canUse || canUse()) G.sfx.leverCreak(); },
      move(dx, dy) {
        if (canUse && !canUse()) return;
        value = clamp(value + dy * 0.004 * span * -1, min, max);
        apply(); onChange(value);
      },
      end() { G.sfx.click(); },
    },
    setValue(v) { value = clamp(v, min, max); apply(); onChange(value); },
  });
  return { grp, get value() { return value; } };
}

function makeButton(x, y, z, { label, color = MAT.green, onPress, rotY = 0, canUse = null }) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), MAT.brass);
  ring.rotation.x = Math.PI / 2; grp.add(ring);
  const capMat = color.clone ? color.clone() : color;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 14), capMat);
  cap.rotation.x = Math.PI / 2; cap.position.z = 0.035; grp.add(cap);
  G.scene.add(grp);
  registerInteractable({
    mesh: grp,
    hint: () => `${label} — [E] нажать`,
    canUse: () => !canUse || canUse(),
    onPress() {
      cap.position.z = 0.01;
      setTimeout(() => { cap.position.z = 0.035; }, 140);
      onPress(cap);
    },
  });
  return { grp, cap };
}

function makeToggle(x, y, z, { label, init = false, onChange, rotY = 0 }) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.1), MAT.dark);
  grp.add(housing);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.06), MAT.brass);
  lever.position.set(0, 0.04, 0.06); grp.add(lever);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 }));
  led.position.set(0.1, 0, 0); grp.add(led);
  G.scene.add(grp);

  let on = init;
  const apply = () => {
    lever.rotation.x = on ? -0.55 : 0.35;
    lever.position.y = on ? 0.02 : 0.04;
    led.material.emissive.setHex(on ? 0x00e676 : 0x000000);
    led.material.emissiveIntensity = on ? 0.9 : 0;
  };
  apply();

  registerInteractable({
    mesh: grp,
    hint: () => `${label}: ${on ? 'ВКЛ' : 'ВЫКЛ'} — [E] переключить`,
    onPress() {
      on = !on;
      apply();
      onChange(on);
      G.sfx.click();
    },
    setOn(v) { on = !!v; apply(); },
    isOn: () => on,
  });
  return { grp, led, setOn(v) { on = !!v; apply(); }, isOn: () => on };
}

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
        const iv = setInterval(() => {
          turn *= 0.85; wheel.rotation.z = -turn; onChange(clamp(turn / 1.6, -1, 1));
          if (Math.abs(turn) < 0.02) { turn = 0; wheel.rotation.z = 0; onChange(0); clearInterval(iv); }
        }, 50);
      },
    },
  });
}

function makeKlaxonPull(x, y, z) {
  const grp = new THREE.Group(); grp.position.set(x, y, z);
  grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), MAT.dark));
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), MAT.brass);
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
        if (dy > 0) pull = clamp(pull + dy * 0.004, 0, 0.45);
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

function makeIndicator(x, y, z, { label, rotY = 0 }) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = rotY;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.04), MAT.dark);
  grp.add(panel);
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000 }));
  led.rotation.x = Math.PI / 2; led.position.z = 0.03; grp.add(led);
  G.scene.add(grp);
  return { grp, led, setState(s) {
    const colors = { off: 0x000000, warn: 0xffc400, on: 0x00e676, err: 0xff5252 };
    led.material.emissive.setHex(colors[s] || 0x000000);
    led.material.emissiveIntensity = s === 'off' ? 0 : 0.85;
  }};
}

// ---------- ЭЛЕКТРОЩИТ: рубильник → шина → пуск/стоп ----------
function makeEnginePanel(sim) {
  const px = 2.66, pz = 15.2;
  const breakerLed = makeIndicator(px, 2.35, pz, { rotY: -Math.PI / 2 });
  const busLed = makeIndicator(px, 2.05, pz, { rotY: -Math.PI / 2 });
  const engineLed = makeIndicator(px, 1.75, pz, { rotY: -Math.PI / 2 });

  const breakerTog = makeToggle(px - 0.35, 2.35, pz, {
    label: 'ГЛАВНЫЙ РУБИЛЬНИК', rotY: -Math.PI / 2,
    onChange(on) {
      sim.setBreaker(on);
      if (on) { G.sfx.breakerOn(); G.hud.log('⚡ Главный рубильник ВКЛ.', 'ok'); }
      else { G.sfx.breakerOff(); G.hud.log('⚡ Главный рубильник ВЫКЛ.', ''); }
      breakerLed.setState(on ? 'on' : 'off');
      if (!on) { busLed.setState('off'); engineLed.setState('off'); }
    },
  });

  makeButton(px - 0.35, 2.05, pz, {
    label: 'ПОДАЧА ПИТАНИЯ НА ШИНУ', rotY: -Math.PI / 2,
    color: new THREE.MeshStandardMaterial({ color: 0x1565c0 }),
    canUse: () => sim.breaker,
    onPress() {
      const r = sim.powerBus();
      if (r === 'ok') { G.sfx.buttonOk(); busLed.setState('on'); G.hud.log('🔋 Шина питания под напряжением.', 'ok'); }
      else if (r === 'no-charge') { G.sfx.buttonErr(); G.hud.hintFlash('Недостаточно заряда! Запустите реактор.'); }
      else if (r === 'already') G.hud.hintFlash('Шина уже под напряжением.');
      else G.hud.hintFlash('Сначала включите главный рубильник!');
    },
  });

  makeButton(px - 0.35, 1.75, pz, {
    label: 'ПУСК ДВИГАТЕЛЯ', rotY: -Math.PI / 2,
    color: MAT.green,
    canUse: () => sim.busPowered && sim.engineState === 'off',
    onPress() {
      const r = sim.startEngine();
      if (r === 'ok') {
        G.sfx.engineCrank();
        engineLed.setState('warn');
        G.hud.log('🔧 Запуск двигателя…', '');
      } else if (r === 'no-bus') G.hud.hintFlash('Сначала подайте питание на шину!');
      else if (r === 'no-charge') G.hud.hintFlash('Недостаточно заряда для пуска!');
      else G.hud.hintFlash('Двигатель уже работает или запускается.');
    },
  });

  makeButton(px - 0.35, 1.45, pz, {
    label: 'ОСТАНОВ ДВИГАТЕЛЯ', rotY: -Math.PI / 2,
    color: MAT.red,
    canUse: () => sim.engineState === 'on' || sim.engineState === 'starting',
    onPress() {
      const r = sim.stopEngine();
      if (r === 'ok') {
        G.sfx.engineDieOff();
        engineLed.setState('off');
        G.hud.log('🔴 Останов двигателя…', 'warn');
        G.controls.throttleRef?.setValue?.(0);
        sim.throttle = 0;
      }
    },
  });

  return { breakerLed, busLed, engineLed, breakerTog, update() {
    breakerLed.setState(sim.breaker ? 'on' : 'off');
    busLed.setState(sim.busPowered ? 'on' : 'off');
    if (sim.engineState === 'on') engineLed.setState('on');
    else if (sim.engineState === 'starting') engineLed.setState('warn');
    else engineLed.setState('off');
  }};
}

// ---------- ШЛЮЗ: внутренняя дверь → камера → наружная дверь ----------
function makeAirlock() {
  const al = G.airlock;

  // внутренняя дверь (машинный → шлюз)
  const innerGrp = new THREE.Group(); innerGrp.position.set(0, 1.3, 21.5);
  const innerDoor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.1, 0.12), MAT.bulk);
  innerGrp.add(innerDoor);
  const innerRing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.2, 0.08), MAT.hazard);
  innerRing.position.z = -0.02; innerGrp.add(innerRing);
  G.scene.add(innerGrp);

  registerInteractable({
    mesh: innerGrp,
    hint: () => al.innerOpen
      ? '🚪 ВНУТРЕННЯЯ ДВЕРЬ — [E] закрыть'
      : '🚪 ВНУТРЕННЯЯ ДВЕРЬ ШЛЮЗА — [E] открыть',
    onPress() {
      if (al.outerOpen && !al.innerOpen) {
        G.hud.hintFlash('Сначала закройте наружную дверь!');
        return;
      }
      al.innerOpen = !al.innerOpen;
      innerDoor.position.x = al.innerOpen ? 0.65 : 0;
      G.sfx.doorOpen();
      G.hud.log(al.innerOpen ? '🚪 Внутренняя дверь открыта.' : '🚪 Внутренняя дверь закрыта.', '');
    },
  });

  // наружная дверь (шлюз → палуба/океан)
  const outerGrp = new THREE.Group(); outerGrp.position.set(0, 1.3, 24.5);
  const outerDoor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.1, 0.12), MAT.bulk);
  outerGrp.add(outerDoor);
  const outerRing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.2, 0.08), MAT.hazard);
  outerRing.position.z = 0.02; outerGrp.add(outerRing);
  G.scene.add(outerGrp);

  registerInteractable({
    mesh: outerGrp,
    hint: () => {
      if (G.sim.depth > 0.5) return '🚪 НАРУЖНАЯ ДВЕРЬ — заблокирована (не на поверхности!)';
      if (!al.innerOpen) return '🚪 НАРУЖНАЯ ДВЕРЬ — сначала откройте внутреннюю';
      return al.outerOpen
        ? '🚪 НАРУЖНАЯ ДВЕРЬ — [E] закрыть'
        : '🚪 НАРУЖНАЯ ДВЕРЬ — [E] выйти на палубу';
    },
    canUse: () => G.sim.depth <= 0.5 && al.innerOpen,
    onPress() {
      if (!al.outerOpen) {
        al.outerOpen = true;
        outerDoor.position.z = 0.55;
        G.sfx.airlock();
        G.flags.outside = true;
        G.player.teleport(0, DECK.z, Math.PI, DECK.eyeY);
        G.hud.log('🌊 Вы вышли на палубу. Вокруг — океан.', 'ok');
      } else {
        al.outerOpen = false;
        outerDoor.position.z = 0;
        G.sfx.doorOpen();
        G.hud.log('🚪 Наружная дверь закрыта.', '');
      }
    },
  });

  // люк с палубы обратно в шлюз
  const hatchGrp = new THREE.Group(); hatchGrp.position.set(0, DECK.eyeY - 1.72, DECK.z - 1);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18), MAT.brass);
  hatchGrp.add(hatch);
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.05, 8, 24), MAT.hazard);
  hatchRing.rotation.x = Math.PI / 2; hatchRing.position.y = 0.07; hatchGrp.add(hatchRing);
  G.scene.add(hatchGrp);

  registerInteractable({
    mesh: hatchGrp,
    hint: () => '🚪 ЛЮК ШЛЮЗА — [E] спуститься внутрь',
    onPress() {
      G.sfx.airlock();
      G.flags.outside = false;
      al.outerOpen = false;
      outerDoor.position.z = 0;
      G.player.teleport(0, 23.5, Math.PI, 1.62);
      G.hud.log('Вы в шлюзовой камере.', '');
    },
  });

  // спуск в океан с палубы (на поверхности)
  const seaGrp = new THREE.Group(); seaGrp.position.set(0, DECK.eyeY - 1.67, DECK.z + 3);
  const seaPad = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x1565c0, transparent: true, opacity: 0.6 }));
  seaGrp.add(seaPad);
  G.scene.add(seaGrp);

  registerInteractable({
    mesh: seaGrp,
    hint: () => G.sim.depth > 0.5
      ? '🌊 Спуск в воду — только на поверхности!'
      : '🌊 КРАЙ ПАЛУБЫ — [E] войти в воду (установка внешних модулей)',
    canUse: () => G.sim.depth <= 0.5 && G.flags.outside,
    onPress() {
      G.sfx.splashUp();
      G.hud.log('🌊 Вы в воде у борта. Установите внешний модуль на палубе.', 'ok');
    },
  });
}

export function buildControls() {
  const C = {};
  const sim = G.sim;

  makeWheel(0, 1.35, -8.6, { onChange: v => { sim.rudder = v; } });

  const throttleRef = makeLever(-1.7, 1.15, -8.8, {
    min: -0.3, max: 1, init: 0, label: 'МАШИННЫЙ ТЕЛЕГРАФ (ход)', color: MAT.brass,
    canUse: () => sim.engineOn,
    onChange: v => { sim.throttle = v; },
  });
  C.throttle = throttleRef;
  C.throttleRef = G.interactables[G.interactables.length - 1];

  C.ballastValve = G.interactables[G.interactables.length];
  makeValve(-2.85, 1.5, -6, {
    label: 'БАЛЛАСТ (заполнение)', rotY: Math.PI / 2,
    onChange: v => { sim.ballast = v; },
  });
  C.ballastValve = G.interactables[G.interactables.length - 1];

  makeKlaxonPull(0.9, 2.85, -7.2);
  makeEmergencyBlow(2.8, 1.5, -6.5, -Math.PI / 2);

  // дублирующий пуск/стоп на мостике
  makeButton(-2.5, 1.55, -9.0, {
    label: 'ПУСК ДВИГАТЕЛЯ (мостик)', rotY: Math.PI / 2, color: MAT.green,
    canUse: () => sim.busPowered && sim.engineState === 'off',
    onPress() {
      const r = sim.startEngine();
      if (r === 'ok') { G.sfx.engineCrank(); G.hud.log('🔧 Запуск двигателя с мостика…', ''); }
      else G.hud.hintFlash('Нет питания на шине — идите в машинный отсек.');
    },
  });
  makeButton(-2.5, 1.2, -9.0, {
    label: 'СТОП ДВИГАТЕЛЯ (мостик)', rotY: Math.PI / 2, color: MAT.red,
    canUse: () => sim.engineOn || sim.engineState === 'starting',
    onPress() {
      sim.stopEngine();
      G.sfx.engineDieOff();
      C.throttleRef?.setValue?.(0);
      sim.throttle = 0;
      G.hud.log('🔴 Останов двигателя.', 'warn');
    },
  });

  makeToggle(2.5, 1.55, -8.5, {
    label: 'ПРОЖЕКТОР', rotY: -Math.PI / 2,
    onChange(on) { sim.lightsOn = on; G.hud.log(on ? '💡 Прожектор ВКЛ.' : '💡 Прожектор ВЫКЛ.', ''); },
  });

  makeToggle(2.5, 1.2, -8.5, {
    label: 'ПОМПА ОТКАЧКИ', rotY: -Math.PI / 2,
    onChange(on) {
      sim.pumpOn = on;
      G.hud.log(on ? '💧 Помпа ВКЛ.' : '💧 Помпа ВЫКЛ.', '');
    },
  });

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
        }
      },
    });
  }

  makeValve(2.66, 0.9, 12.5, {
    label: 'ОХЛАЖДЕНИЕ РЕАКТОРА', rotY: -Math.PI / 2, color: MAT.green,
    onChange: v => { sim.cooling = v; },
  });

  C.enginePanel = makeEnginePanel(sim);
  makeAirlock();

  G.controls = C;
}

export function updateControls() {
  G.controls?.enginePanel?.update();
}
