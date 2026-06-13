// ============ МИР: интерьер субмарины (5 отсеков + шлюзовая камера) + подводный мир ============
import * as THREE from 'three';
import { G, addCollider, registerInteractable } from './state.js';

// Интерьер: труба вдоль оси Z. Мостик в носу с иллюминаторами, торпедный — нижняя палуба под мостиком.
//  МОСТИК z[-18,-2] · ЖИЛОЙ z[-2,6] · РЕАКТОР z[6,14] · МАШИННЫЙ z[14,22] · ШЛЮЗ z[22,25]
//  ТОРПЕДНЫЙ (нижняя палуба) z[-18,-10], y[-1.2,0]
export const HULL = { w: 6, h: 3.2, z0: -18, z1: 22, lowerH: 1.2 };
export const SEABED_DEPTH = 150;
export const DECK = { eyeY: 4.05, z: 25.5 };
export const COMPARTMENTS = [
  { id: 'bridge',  name: 'МОСТИК',            z0: -18, z1: -2,  color: 0x263238 },
  { id: 'torpedo', name: 'ТОРПЕДНЫЙ ОТСЕК',  z0: -18, z1: -10, color: 0x37474f, lowerDeck: true },
  { id: 'living',  name: 'ЖИЛОЙ ОТСЕК',       z0: -2,  z1: 6,   color: 0x33393d },
  { id: 'reactor', name: 'РЕАКТОРНЫЙ ОТСЕК',  z0: 6,   z1: 14,  color: 0x3e2723 },
  { id: 'engine',  name: 'МАШИННЫЙ ОТСЕК',    z0: 14,  z1: 22,  color: 0x2d3436 },
];

export const MAT = {};

function buildMaterials() {
  MAT.hull   = new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.7, roughness: 0.55 });
  MAT.floor  = new THREE.MeshStandardMaterial({ color: 0x39424a, metalness: 0.5, roughness: 0.8 });
  MAT.bulk   = new THREE.MeshStandardMaterial({ color: 0x55606b, metalness: 0.8, roughness: 0.4 });
  MAT.dark   = new THREE.MeshStandardMaterial({ color: 0x22282e, metalness: 0.6, roughness: 0.7 });
  MAT.pipe   = new THREE.MeshStandardMaterial({ color: 0x8d6e63, metalness: 0.85, roughness: 0.35 });
  MAT.pipe2  = new THREE.MeshStandardMaterial({ color: 0x607d8b, metalness: 0.85, roughness: 0.35 });
  MAT.brass  = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.3 });
  MAT.red    = new THREE.MeshStandardMaterial({ color: 0xc62828, metalness: 0.4, roughness: 0.5 });
  MAT.green  = new THREE.MeshStandardMaterial({ color: 0x2e7d32, metalness: 0.4, roughness: 0.5 });
  MAT.yellow = new THREE.MeshStandardMaterial({ color: 0xf9a825, metalness: 0.4, roughness: 0.5 });
  MAT.hazard = new THREE.MeshStandardMaterial({ color: 0xf9a825, emissive: 0xf9a825, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.5 });
  MAT.black  = new THREE.MeshStandardMaterial({ color: 0x14181c, metalness: 0.3, roughness: 0.9 });
  MAT.screenOn  = new THREE.MeshStandardMaterial({ color: 0x06281e, emissive: 0x00e676, emissiveIntensity: 0.55 });
  MAT.screenOff = new THREE.MeshStandardMaterial({ color: 0x0a0e10, emissive: 0x000000 });
  MAT.glass  = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.12, metalness: 0.2, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  MAT.deck   = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.6 });
  MAT.ocean  = new THREE.MeshStandardMaterial({ color: 0x0a3550, metalness: 0.1, roughness: 0.4, transparent: true, opacity: 0.95 });
  MAT.water  = new THREE.MeshStandardMaterial({ color: 0x1565c0, transparent: true, opacity: 0.45, metalness: 0.2, roughness: 0.2 });
  MAT.sonarRing = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.8, transparent: true, opacity: 0.6 });
  MAT.sonarBg = new THREE.MeshStandardMaterial({ color: 0x0a1a14, metalness: 0.8, roughness: 0.4 });
  MAT.monitorFrame = new THREE.MeshStandardMaterial({ color: 0x1a2228, metalness: 0.7, roughness: 0.5 });
  MAT.monitorScreen = new THREE.MeshStandardMaterial({ color: 0x06281e, emissive: 0x00e676, emissiveIntensity: 0.45 });
  MAT.emergencyLight = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 0.9 });
  MAT.rivet = new THREE.MeshStandardMaterial({ color: 0x8a969d, metalness: 0.9, roughness: 0.32 });
  MAT.blackRubber = new THREE.MeshStandardMaterial({ color: 0x07090a, metalness: 0.15, roughness: 0.75 });
  MAT.ivory = new THREE.MeshStandardMaterial({ color: 0xc8bfa6, metalness: 0.25, roughness: 0.55 });
  MAT.copper = new THREE.MeshStandardMaterial({ color: 0x9b5a2e, metalness: 0.86, roughness: 0.34 });
}


function box(w, h, d, mat, x, y, z, parent, collide = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  (parent || G.scene).add(m);
  if (collide) addCollider(
    new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)
  );
  return m;
}

function cyl(r, h, mat, x, y, z, parent, rotZ = 0, rotX = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat);
  m.position.set(x, y, z); m.rotation.z = rotZ; m.rotation.x = rotX;
  (parent || G.scene).add(m);
  return m;
}

function cone(r, h, mat, x, y, z, parent, rotX = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), mat);
  m.position.set(x, y, z);
  m.rotation.x = rotX;
  (parent || G.scene).add(m);
  return m;
}

function torus(r, tube, mat, x, y, z, parent, rotX = 0, rotY = 0, rotZ = 0) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 32), mat);
  m.position.set(x, y, z);
  m.rotation.set(rotX, rotY, rotZ);
  (parent || G.scene).add(m);
  return m;
}

// ---------- ТЕКСТОВЫЕ ТАБЛИЧКИ (canvas) ----------
export function makeSign(text, w = 1.6, h = 0.32, bg = '#0d1418', fg = '#ffc400') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = fg; c.lineWidth = 8; c.strokeRect(6, 6, cv.width - 12, cv.height - 12);
  c.fillStyle = fg;
  c.font = `bold ${Math.round(cv.height * 0.55)}px monospace`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, cv.width / 2, cv.height / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }));
  return m;
}

// ---------- ИНТЕРЬЕР ----------
function buildHullInterior() {
  const { w, h, z0, z1 } = HULL;
  const len = z1 - z0, zc = (z0 + z1) / 2;

  // пол / потолок
  box(w, 0.2, len, MAT.floor, 0, -0.1, zc);
  box(w, 0.2, len, MAT.hull, 0, h + 0.1, zc);

  // --- боковые стены посегментно: в мостике — окна, в остальных — маленькие иллюминаторы ---
  for (const c of COMPARTMENTS) {
    if (c.lowerDeck) continue;
    const segLen = c.z1 - c.z0, segZc = (c.z0 + c.z1) / 2;
    for (const sx of [-1, 1]) {
      const X = sx * (w / 2 + 0.1);
      if (c.id === 'bridge') {
        // окно: y 1.25..2.35, z c.z0+1.2 .. c.z1-1.2
        const winZ0 = c.z0 + 1.2, winZ1 = c.z1 - 1.2;
        box(0.2, 1.25, segLen, MAT.hull, X, 0.625, segZc);              // низ
        box(0.2, h - 2.35, segLen, MAT.hull, X, (h + 2.35) / 2, segZc); // верх
        box(0.2, 1.1, winZ0 - c.z0, MAT.hull, X, 1.8, (c.z0 + winZ0) / 2); // торцы окна
        box(0.2, 1.1, c.z1 - winZ1, MAT.hull, X, 1.8, (winZ1 + c.z1) / 2);
        // стекло
        const glass = box(0.06, 1.1, winZ1 - winZ0, MAT.glass, X, 1.8, (winZ0 + winZ1) / 2);
        glass.renderOrder = 5;
        // рама
        box(0.24, 0.08, winZ1 - winZ0 + 0.15, MAT.brass, X, 1.25, (winZ0 + winZ1) / 2);
        box(0.24, 0.08, winZ1 - winZ0 + 0.15, MAT.brass, X, 2.35, (winZ0 + winZ1) / 2);
      } else if (c.id === 'living' || c.id === 'reactor') {
        // маленькие круглые иллюминаторы в жилом и реакторном
        // сплошная стена
        box(0.2, h, segLen, MAT.hull, X, h / 2, segZc);
        // иллюминаторы поверх стены
        const winCount = 3;
        const winSpacing = (segLen - 3) / winCount;
        for (let i = 0; i < winCount; i++) {
          const wz = c.z0 + 1.5 + i * winSpacing;
          // иллюминатор (круглое стекло)
          const porthole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14), MAT.glass);
          porthole.rotation.x = Math.PI / 2; porthole.position.set(X, 1.6, wz);
          porthole.renderOrder = 5;
          G.scene.add(porthole);
          // рама иллюминатора
          const frame = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 8, 16), MAT.brass);
          frame.rotation.y = Math.PI / 2; frame.position.set(sx * (w / 2 + 0.04), 1.6, wz);
          G.scene.add(frame);
        }
      } else if (c.id === 'engine') {
        // машинный: одно маленькое окно + сплошная стена (тут оборудование)
        box(0.2, h, segLen, MAT.hull, X, h / 2, segZc);
        // один иллюминатор
        const wz = segZc;
        const porthole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), MAT.glass);
        porthole.rotation.x = Math.PI / 2; porthole.position.set(X, 1.8, wz);
        porthole.renderOrder = 5;
        G.scene.add(porthole);
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 14), MAT.brass);
        frame.rotation.y = Math.PI / 2; frame.position.set(sx * (w / 2 + 0.04), 1.8, wz);
        G.scene.add(frame);
      } else {
        box(0.2, h, segLen, MAT.hull, X, h / 2, segZc);
      }
    }
    // коллайдер всей стены (стекло тоже непроходимо)
    addCollider(new THREE.Vector3(-w / 2 - 0.2, 0, c.z0), new THREE.Vector3(-w / 2, h, c.z1));
    addCollider(new THREE.Vector3(w / 2, 0, c.z0), new THREE.Vector3(w / 2 + 0.2, h, c.z1));
  }

  // --- НОС МОСТИКА: полноценная стена с панорамным окном ---
  {
    const Z = z0 - 0.06;
    const winH = 1.7, winY = 1.5;
    const winW = w * 0.65;
    // нижняя часть носа — полная ширина
    box(w, 0.35, 0.16, MAT.bulk, 0, 0.175, Z, null, true);
    // верхняя часть носа — полная ширина
    box(w, h - winY - 0.45, 0.16, MAT.bulk, 0, (h + winY + 0.45) / 2, Z, null, true);
    // боковые стенки по краям окна (от края стекла до края корпуса)
    const sideW = (w - winW) / 2;
    for (const sx of [-1, 1]) {
      const sideX = sx * (winW / 2 + sideW / 2);
      box(sideW, winH, 0.16, MAT.bulk, sideX, winY, Z, null, true);
    }
    // панорамное стекло
    const glass = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.06), MAT.glass);
    glass.position.set(0, winY, Z + 0.04); glass.renderOrder = 5;
    G.scene.add(glass);
    G.bridgeGlass = glass;
    // рама
    box(winW + 0.1, 0.09, 0.12, MAT.brass, 0, winY - winH / 2 - 0.04, Z + 0.02);
    box(winW + 0.1, 0.09, 0.12, MAT.brass, 0, winY + winH / 2 + 0.04, Z + 0.02);
    for (const sx of [-1, 1]) {
      box(0.1, winH + 0.08, 0.1, MAT.brass, sx * (winW / 2), winY, Z + 0.02);
    }
    const sCmd = makeSign('COMMAND · ОБЗОР ВПЕРЁД', 2.4, 0.26);
    sCmd.position.set(0, 2.8, z0 + 1.5); G.scene.add(sCmd);
  }

  // --- НИЖНЯЯ ПАЛУБА: торпедный отсек (под мостиком) ---
  {
    const tz0 = -18, tz1 = -10, tzc = (tz0 + tz1) / 2, tlen = tz1 - tz0;
    box(w - 0.4, 0.15, tlen, MAT.floor, 0, -1.05, tzc);
    box(0.2, 1.0, tlen, MAT.hull, -w / 2 + 0.1, -0.55, tzc, null, true);
    box(0.2, 1.0, tlen, MAT.hull,  w / 2 - 0.1, -0.55, tzc, null, true);
    box(w, 0.12, 0.2, MAT.bulk, 0, -0.05, tz0 - 0.1, null, true);
    // лестница с мостика
    for (let i = 0; i < 5; i++) {
      const step = box(0.7, 0.08, 0.35, MAT.brass, 2.1, 0.15 - i * 0.22, -10.2 - i * 0.35);
      step.rotation.x = -0.35;
    }
    // перила лестницы
    cyl(0.02, 1.5, MAT.brass, 1.75, 0.0, -10.8, null, 0, 0.35);
    cyl(0.02, 1.5, MAT.brass, 2.45, 0.0, -10.8, null, 0, 0.35);
    const sTorp = makeSign('↓ TORPEDO', 1.3, 0.28);
    sTorp.position.set(0, 2.6, -10.05); sTorp.rotation.y = Math.PI;
    G.scene.add(sTorp);
    const sTorp2 = makeSign('TORPEDO', 1.2, 0.26, '#0d1418', '#80d8ff');
    sTorp2.position.set(0, -0.35, tzc); G.scene.add(sTorp2);
    G.lowerDeckZ = { z0: tz0, z1: tz1 };
  }

  // --- НИЖНЯЯ ПАЛУБА: машинный отсек (двигатели) ---
  {
    const ez0 = 14, ez1 = 22, ezc = (ez0 + ez1) / 2, elen = ez1 - ez0;
    box(w - 0.4, 0.15, elen, MAT.floor, 0, -1.05, ezc);
    box(0.2, 1.0, elen, MAT.hull, -w / 2 + 0.1, -0.55, ezc, null, true);
    box(0.2, 1.0, elen, MAT.hull,  w / 2 - 0.1, -0.55, ezc, null, true);
    // люк/лестница с верхней палубы
    for (let i = 0; i < 6; i++) {
      const step = box(0.75, 0.08, 0.35, MAT.brass, -2.1, 0.15 - i * 0.2, ez0 + 0.3 + i * 0.35);
      step.rotation.x = 0.35;
    }
    // перила лестницы
    cyl(0.02, 1.8, MAT.brass, -1.7, 0.0, ez0 + 1.2, null, 0, -0.35);
    cyl(0.02, 1.8, MAT.brass, -2.5, 0.0, ez0 + 1.2, null, 0, -0.35);
    const sEng = makeSign('↓ ENGINE ROOM', 1.4, 0.28);
    sEng.position.set(0, 2.6, ez0 + 0.1); sEng.rotation.y = Math.PI;
    G.scene.add(sEng);
    const sEng2 = makeSign('ENGINE ROOM', 1.3, 0.26, '#0d1418', '#80d8ff');
    sEng2.position.set(0, -0.35, ezc); G.scene.add(sEng2);
    G.lowerEngineZ = { z0: ez0, z1: ez1 };
    // проём в полу верхнего машинного отсека
    const grate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.8, roughness: 0.5 }));
    grate.position.set(-2.0, 0.02, ez0 + 1.2); G.scene.add(grate);
  }

  // --- КОРМОВОЙ ТОРЕЦ с проёмом в шлюз ---
  {
    const Z = z1 + 0.1;
    const side = (w - 1.2) / 2;
    box(side, h, 0.2, MAT.bulk, -(1.2 / 2 + side / 2), h / 2, Z, null, true);
    box(side, h, 0.2, MAT.bulk,  (1.2 / 2 + side / 2), h / 2, Z, null, true);
    box(1.2, h - 2.15, 0.2, MAT.bulk, 0, h - (h - 2.15) / 2, Z, null, true);
    box(1.3, 0.18, 0.3, MAT.brass, 0, 0.09, Z);
  }

  // --- ШЛЮЗОВАЯ КАМЕРА z 22.2..24.8 ---
  {
    const aw = 2.6, az0 = 22.2, az1 = 24.8, azc = (az0 + az1) / 2, alen = az1 - az0;
    box(aw, 0.2, alen, MAT.floor, 0, -0.1, azc);
    box(aw, 0.2, alen, MAT.hull, 0, h + 0.1, azc);
    box(0.2, h, alen, MAT.hull, -aw / 2 - 0.1, h / 2, azc, null, true);
    box(0.2, h, alen, MAT.hull,  aw / 2 + 0.1, h / 2, azc, null, true);
    // внешний торец (наружная дверь будет в controls)
    box(aw, h, 0.2, MAT.bulk, 0, h / 2, az1 + 0.1, null, true);
    // косые стенки от корпуса к камере
    box(1.7, h, 0.25, MAT.bulk, -(aw / 2 + 0.85), h / 2, az0, null, true);
    box(1.7, h, 0.25, MAT.bulk,  (aw / 2 + 0.85), h / 2, az0, null, true);
    // красная лампа в шлюзе
    const warnL = new THREE.PointLight(0xff5544, 4, 6, 1.8);
    warnL.position.set(0, h - 0.4, azc); G.scene.add(warnL);
    G.airlockLamp = warnL;
    // манометр давления
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14), MAT.dark);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(aw / 2 - 0.3, 1.8, azc);
    G.scene.add(gauge);
    // табличка WARNING
    const sWarn = makeSign('⚠ DANGER · DIVE SUIT REQUIRED', 1.8, 0.2, '#3a0a0a', '#ff4444');
    sWarn.position.set(0, 2.6, azc);
    G.scene.add(sWarn);
  }

  // скруглённые «рёбра» корпуса каждые 2.5 м (чаще = солиднее)
  for (let z = z0 + 1; z < z1; z += 2.5) {
    box(w - 0.05, 0.14, 0.1, MAT.dark, 0, h - 0.07, z);
    box(w - 0.05, 0.14, 0.1, MAT.dark, 0, 0.07, z);
  }

  // наружные трубы (по бортам, вдоль корпуса)
  cyl(0.06, len, MAT.pipe2, -w / 2 - 0.12, h * 0.6, zc, null, 0, Math.PI / 2);
  cyl(0.06, len, MAT.pipe2,  w / 2 + 0.12, h * 0.6, zc, null, 0, Math.PI / 2);
  // трубы на днище
  cyl(0.05, len, MAT.pipe, -w / 2 + 0.3, -0.15, zc, null, 0, Math.PI / 2);
  cyl(0.05, len, MAT.pipe,  w / 2 - 0.3, -0.15, zc, null, 0, Math.PI / 2);

  // киль (нижняя гребная пластина)
  box(0.08, 0.5, len * 0.7, MAT.dark, 0, -0.35, zc + 2);

  // трубы вдоль потолка (внутри)
  cyl(0.09, len, MAT.pipe,  -w / 2 + 0.5, h - 0.25, zc, null, 0, Math.PI / 2);
  cyl(0.09, len, MAT.pipe2, -w / 2 + 0.8, h - 0.45, zc, null, 0, Math.PI / 2);
  cyl(0.07, len, MAT.pipe2,  w / 2 - 0.5, h - 0.25, zc, null, 0, Math.PI / 2);

  // переборки между отсеками с проёмами + ЖЁЛТАЯ ОКАНТОВКА + ТАБЛИЧКИ
  const signNames = { bridge: 'COMMAND', living: 'ЖИЛОЙ', reactor: 'REACTOR', engine: 'ENGINE' };
  const bulkheads = ['living', 'reactor', 'engine'];
  for (const cid of bulkheads) {
    const comp = COMPARTMENTS.find(c => c.id === cid);
    if (!comp) continue;
    const z = comp.z0;
    // боковые стенки переборки — делаем уже, чтобы не перекрывать лестницы
    const sideW = 1.6;
    const sideX = 1.2 / 2 + sideW / 2;
    box(sideW, h, 0.25, MAT.bulk, -sideX, h / 2, z, null, true);
    box(sideW, h, 0.25, MAT.bulk,  sideX, h / 2, z, null, true);
    box(1.2, h - 2.15, 0.25, MAT.bulk, 0, h - (h - 2.15) / 2, z, null, false);
    box(1.3, 0.18, 0.3, MAT.brass, 0, 0.09, z);
    // жёлтая окантовка проёма
    box(0.12, 2.15, 0.3, MAT.hazard, -0.66, 1.075, z);
    box(0.12, 2.15, 0.3, MAT.hazard,  0.66, 1.075, z);
    box(1.44, 0.12, 0.3, MAT.hazard, 0, 2.21, z);
    // таблички с обеих сторон + лампа над проёмом
    const prev = COMPARTMENTS[COMPARTMENTS.indexOf(comp) - 1];
    const sFwd = makeSign('→ ' + signNames[comp.id]);
    sFwd.position.set(0, 2.65, z - 0.2); sFwd.rotation.y = Math.PI;
    G.scene.add(sFwd);
    if (prev) {
      const sBack = makeSign('→ ' + (signNames[prev.id] || prev.name));
      sBack.position.set(0, 2.65, z + 0.2);
      G.scene.add(sBack);
    }
    const doorLamp = new THREE.PointLight(0xffc400, 1.5, 3.2, 2);
    doorLamp.position.set(0, 2.35, z); G.scene.add(doorLamp);
  }
  // табличка ШЛЮЗ над кормовым проёмом
  const sAir = makeSign('→ ШЛЮЗ', 1.3, 0.3);
  sAir.position.set(0, 2.65, z1 - 0.05); sAir.rotation.y = Math.PI;
  G.scene.add(sAir);
  const sAir2 = makeSign('AIRLOCK', 1.3, 0.28);
  sAir2.position.set(0, 2.65, 22.1);
  G.scene.add(sAir2);
}

function buildLights() {
  G.scene.add(new THREE.AmbientLight(0x223344, 0.55));
  for (const c of COMPARTMENTS) {
    if (c.lowerDeck) {
      const zc = (c.z0 + c.z1) / 2;
      const lamp = new THREE.PointLight(0xffe7c4, 4, 8, 1.8);
      lamp.position.set(0, -0.4, zc);
      G.scene.add(lamp);
      continue;
    }
    const zc = (c.z0 + c.z1) / 2;
    // основной свет
    const lamp = new THREE.PointLight(0xffe7c4, 9, 11, 1.6);
    lamp.position.set(0, HULL.h - 0.35, zc);
    G.scene.add(lamp);
    G.interiorLights.push({ light: lamp, comp: c.id, base: 9 });
    // плафон
    box(0.5, 0.08, 0.5, MAT.brass, 0, HULL.h - 0.12, zc);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffd089, emissiveIntensity: 1.4 }));
    bulb.position.set(0, HULL.h - 0.22, zc); G.scene.add(bulb);
    G.interiorLights[G.interiorLights.length - 1].bulb = bulb;
  }

  // --- вода в отсеках (визуал затопления) ---
  G.waterMeshes = {};
  for (const c of COMPARTMENTS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(HULL.w - 0.2, 1, c.z1 - c.z0 - 0.2), MAT.water);
    m.position.set(0, -0.5, (c.z0 + c.z1) / 2);
    m.visible = false;
    G.scene.add(m);
    G.waterMeshes[c.id] = m;
  }

  // --- разметка пола (жёлтые линии безопасности) ---
  for (const c of COMPARTMENTS) {
    if (c.lowerDeck) continue;
    const zc = (c.z0 + c.z1) / 2;
    const segLen = c.z1 - c.z0;
    // центральная линия
    box(0.06, 0.01, segLen - 1, MAT.hazard, 0, -0.04, zc);
    // боковые линии
    box(0.04, 0.01, segLen - 1, MAT.hazard, -1.5, -0.04, zc);
    box(0.04, 0.01, segLen - 1, MAT.hazard,  1.5, -0.04, zc);
  }

  // --- вентиляционные решётки на потолке ---
  for (let z = HULL.z0 + 3; z < HULL.z1; z += 6) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x3a4448, metalness: 0.8, roughness: 0.5 }));
    vent.position.set(0, HULL.h + 0.08, z);
    G.scene.add(vent);
  }
}

// ---------- РЕКВИЗИТ ПО ОТСЕКАМ ----------
function buildProps() {
  const w = HULL.w;

  const ly = -0.55;

  // === МОСТИК: консоли по бокам + sonar ===
  for (const sx of [-1, 1]) {
    box(1.5, 0.85, 0.75, MAT.dark, sx * 2.0, 0.45, -8.5, null, true);
    box(1.5, 0.5, 0.65, MAT.bulk, sx * 2.0, 1.15, -8.65);
    const scr = box(0.95, 0.55, 0.06, MAT.screenOn, sx * 2.0, 1.42, -8.35);
    scr.rotation.x = -0.2;
    // кнопки на консоли
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8),
        new THREE.MeshStandardMaterial({ color: i === 0 ? 0x2e7d32 : i === 1 ? 0xc62828 : 0xf9a825 }));
      btn.position.set(sx * 2.0, 0.92, -8.8 + i * 0.15);
      G.scene.add(btn);
    }
  }

  // --- SONAR (кольцо) на правой консоли ---
  {
    const sonarGrp = new THREE.Group();
    sonarGrp.position.set(2.0, 1.4, -8.6);
    sonarGrp.rotation.y = -Math.PI / 2 + 0.3;
    sonarGrp.rotation.x = -0.15;
    // корпус sonar
    const sonarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 22), MAT.sonarBg);
    sonarBody.rotation.x = Math.PI / 2;
    sonarGrp.add(sonarBody);
    // кольцо sonar
    const sonarRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 8, 36), MAT.sonarRing);
    sonarRing.position.z = 0.065;
    sonarGrp.add(sonarRing);
    // второй ring (внутренний)
    const sonarRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.015, 6, 28), MAT.sonarRing);
    sonarRing2.position.z = 0.065;
    sonarGrp.add(sonarRing2);
    // линия-сканер (поворачивается)
    const scanLine = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.01), MAT.sonarRing);
    scanLine.position.z = 0.065;
    sonarGrp.add(scanLine);
    // метки POI на sonar
    const dotGeo = new THREE.CircleGeometry(0.025, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9 });
    const dots = [];
    if (G.poi) {
      for (const p of G.poi) {
        const dot = new THREE.Mesh(dotGeo, dotMat.clone());
        dot.position.z = 0.065;
        sonarGrp.add(dot);
        dots.push({ dot, poi: p });
      }
    }
    G.scene.add(sonarGrp);
    G.sonar = { grp: sonarGrp, scanLine, dots, ring: sonarRing };
    const sSonar = makeSign('SONAR', 0.8, 0.2, '#0a1a14', '#00ff88');
    sSonar.position.set(2.0, 1.72, -8.55);
    sSonar.rotation.y = -Math.PI / 2 + 0.3;
    sSonar.rotation.x = -0.2;
    G.scene.add(sSonar);
  }

  // центральный штурвальный пост — ниже и уже, чтобы не перекрывать окно и не пересекаться с мониторами
  box(1.05, 0.72, 0.48, MAT.dark, 0, 0.36, -7.8, null, true);
  box(1.0, 0.035, 0.46, MAT.yellow, 0, 0.75, -7.8);
  // дополнительные историчные приборы: манометры, телефоны, ряд тумблеров
  for (let i = 0; i < 5; i++) {
    const gx = -0.42 + i * 0.21;
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 14), MAT.ivory);
    gauge.rotation.x = Math.PI / 2; gauge.position.set(gx, 0.82, -8.05);
    G.scene.add(gauge);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.04, 0.006), MAT.red);
    needle.position.set(gx, 0.82, -8.065); needle.rotation.z = -0.5 + i * 0.25;
    G.scene.add(needle);
  }
  for (let i = 0; i < 9; i++) {
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.035), i % 3 === 0 ? MAT.red : MAT.brass);
    toggle.rotation.x = -0.45; toggle.position.set(-0.48 + i * 0.12, 0.9, -7.56);
    G.scene.add(toggle);
  }

  // историчный повторитель курса + прокладочная карта на правом пульте (без пересечений с мониторами)
  const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16), MAT.brass);
  compass.position.set(1.35, 0.95, -8.9); compass.rotation.x = Math.PI / 2; G.scene.add(compass);
  const compassGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), MAT.glass);
  compassGlass.position.set(1.35, 0.95, -8.94); compassGlass.rotation.x = Math.PI / 2; compassGlass.renderOrder = 5;
  G.scene.add(compassGlass);
  const mapBoard = box(0.85, 0.02, 0.62, MAT.ivory, -1.35, 0.86, -8.88);
  mapBoard.rotation.x = -0.18;
  for (let i = 0; i < 3; i++) {
    const marker = box(0.06, 0.025, 0.12, i === 0 ? MAT.red : i === 1 ? MAT.green : MAT.brass, -1.55 + i * 0.16, 0.9, -8.95 + i * 0.05);
    marker.rotation.x = -0.18;
  }

  // потолочные кабельные лотки и трубы разнесены по высоте, чтобы визуально не пересекались
  for (let i = 0; i < 4; i++) {
    const z = -16 + i * 3.5;
    cyl(0.035, 4.2, i % 2 ? MAT.copper : MAT.pipe2, -2.35 + i * 0.22, 2.86 - i * 0.08, z, null, 0, Math.PI / 2);
    box(0.28, 0.04, 0.05, MAT.brass, -2.35 + i * 0.22, 2.72 - i * 0.08, z - 1.9);
    box(0.28, 0.04, 0.05, MAT.brass, -2.35 + i * 0.22, 2.72 - i * 0.08, z + 1.9);
  }

  // --- АВАРИЙНЫЕ ЛАМПЫ (красные, на потолке каждого отсека) ---
  G.emergencyLights = [];
  for (const c of COMPARTMENTS) {
    if (c.lowerDeck) continue;
    const zc = (c.z0 + c.z1) / 2;
    const eLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), MAT.emergencyLight);
    eLamp.position.set(w / 2 - 0.5, HULL.h - 0.06, zc - 2);
    eLamp.rotation.x = Math.PI / 2;
    G.scene.add(eLamp);
    const eLight = new THREE.PointLight(0xff2200, 0, 5, 1.8);
    eLight.position.set(w / 2 - 0.5, HULL.h - 0.2, zc - 2);
    G.scene.add(eLight);
    G.emergencyLights.push({ mesh: eLamp, light: eLight });
    // вторая лампа с другой стороны
    const eLamp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), MAT.emergencyLight);
    eLamp2.position.set(-w / 2 + 0.5, HULL.h - 0.06, zc + 2);
    eLamp2.rotation.x = Math.PI / 2;
    G.scene.add(eLamp2);
    const eLight2 = new THREE.PointLight(0xff2200, 0, 5, 1.8);
    eLight2.position.set(-w / 2 + 0.5, HULL.h - 0.2, zc + 2);
    G.scene.add(eLight2);
    G.emergencyLights.push({ mesh: eLamp2, light: eLight2 });
  }
  G.emergencyOn = false;

  // === ЖИЛОЙ: койки, стол, шкафы, тумбочки ===
  for (const [x, z] of [[-2.3, 0.5], [-2.3, 3.5]]) {
    box(1.2, 0.25, 2.2, MAT.dark, x, 0.5, z, null, true);
    box(1.15, 0.12, 2.1, MAT.green, x, 0.66, z);
    box(1.2, 0.25, 2.2, MAT.dark, x, 1.7, z, null, true);
    box(1.15, 0.12, 2.1, MAT.green, x, 1.86, z);
    // подушки
    box(0.35, 0.06, 0.5, MAT.green, x, 0.72, z - 0.6);
    box(0.35, 0.06, 0.5, MAT.green, x, 1.92, z - 0.6);
  }
  // стол
  box(1.6, 0.08, 1.0, MAT.brass, 2.2, 0.85, 2, null, false);
  box(0.15, 0.85, 0.15, MAT.dark, 2.2, 0.42, 2, null, true);
  // стул
  box(0.45, 0.06, 0.45, MAT.dark, 2.2, 0.55, 3.2);
  box(0.45, 0.5, 0.06, MAT.dark, 2.2, 0.8, 3.45);
  // шкаф
  box(1.4, 2.2, 0.5, MAT.bulk, 2.5, 1.1, 4.8, null, true);
  // тумбочка
  box(0.5, 0.6, 0.4, MAT.dark, -2.5, 0.3, 5.5, null, true);
  // книга на тумбочке
  box(0.25, 0.04, 0.18, MAT.red, -2.5, 0.62, 5.5);

  // === РЕАКТОРНЫЙ: реактор-цилиндр + панели + трубы ===
  cyl(0.85, 2.7, MAT.hull, -1.9, 1.35, 10);
  addCollider(new THREE.Vector3(-2.9, 0, 9), new THREE.Vector3(-0.9, 2.7, 11));
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 0.5, 18),
    new THREE.MeshStandardMaterial({ color: 0x1a0a00, emissive: 0xff6d00, emissiveIntensity: 0.15 }));
  glow.position.set(-1.9, 1.35, 10); G.scene.add(glow);
  G.reactorGlow = glow;
  for (const y of [0.5, 1.35, 2.2]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 26), MAT.brass);
    r.position.set(-1.9, y, 10); r.rotation.x = Math.PI / 2; G.scene.add(r);
  }
  // панель управления реактором
  box(2.4, 1.6, 0.3, MAT.dark, 2.85, 1.5, 10, null, true);
  // трубы от реактора
  cyl(0.06, 4, MAT.pipe, -1.9, 2.5, 10, null, 0, Math.PI / 2);
  cyl(0.06, 4, MAT.pipe, -1.9, 0.2, 10, null, 0, Math.PI / 2);
  // индикаторная панель
  for (let i = 0; i < 4; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000 }));
    led.position.set(2.85, 1.8 - i * 0.2, 9.85);
    G.scene.add(led);
  }

  // === МАШИННЫЙ (верх): только проход и люк вниз ===
  box(1.2, 0.08, 1.6, MAT.brass, -2.0, 0.04, 15.2);

  // === МАШИННЫЙ (низ): дизели + место для щита + трубы ===
  const ely = -0.55;
  for (const x of [-2.1, 2.1]) {
    box(1.2, 1.2, 2.6, MAT.dark, x, ely, 18, null, true);
    for (let i = 0; i < 3; i++) cyl(0.14, 0.45, MAT.brass, x - 0.35 + i * 0.35, ely + 0.75, 18);
    // трубы от дизелей
    cyl(0.05, 3, MAT.pipe, x, ely + 1.3, 18, null, 0, Math.PI / 2);
  }
  G.engineBlocks = true;
  // пульт двигателя — крупная панель в центре нижнего машинного (controls.js)
  const panelBg = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 0.12), MAT.dark);
  panelBg.position.set(0, ely + 0.85, 16.2); G.scene.add(panelBg);
  const sEl = makeSign('⚡ ЭЛЕКТРОЩИТ / ДВИГАТЕЛЬ', 1.6, 0.3);
  sEl.position.set(0, ely + 1.55, 16.14); G.scene.add(sEl);
  // манометры на стене
  for (let i = 0; i < 3; i++) {
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), MAT.dark);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(1.5, 0.5 + i * 0.3, 17.5);
    G.scene.add(gauge);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.01), MAT.red);
    needle.position.set(1.5, 0.5 + i * 0.3, 17.48);
    G.scene.add(needle);
  }

  // === ТОРПЕДНЫЕ АППАРАТЫ (низ, нос) — управление в controls.js ===
  for (const x of [-2.0, 2.0]) {
    cyl(0.38, 2.2, MAT.hull, x, ly, -15.5, null, 0, Math.PI / 2);
    addCollider(new THREE.Vector3(x - 0.42, -1.1, -16.8), new THREE.Vector3(x + 0.42, 0.2, -14.2));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 16), MAT.brass);
    cap.position.set(x, ly, -14.3); cap.rotation.x = Math.PI / 2; G.scene.add(cap);
    // направляющие
    cyl(0.04, 2.5, MAT.pipe2, x - 0.25, ly, -15.5, null, 0, Math.PI / 2);
    cyl(0.04, 2.5, MAT.pipe2, x + 0.25, ly, -15.5, null, 0, Math.PI / 2);
  }
  cyl(0.2, 2.5, MAT.dark, -2.35, ly, -13.5, null, 0, Math.PI / 2);
  cyl(0.2, 2.5, MAT.dark, 2.35, ly, -13.5, null, 0, Math.PI / 2);
  // стойка с торпедами (запас)
  box(0.8, 1.5, 0.8, MAT.dark, 0, ly + 0.5, -16.5);
  for (let i = 0; i < 2; i++) {
    cyl(0.12, 1.2, MAT.brass, -0.2 + i * 0.4, ly + 0.8, -16.5, null, 0, Math.PI / 2);
  }
}

// ---------- ПОДВОДНЫЙ МИР (виден через иллюминаторы) ----------
function buildUnderwater() {
  const uw = new THREE.Group();
  G.scene.add(uw);
  G.underwater = uw;

  const rng = mulberry32(4242);
  const rand = (a, b) => a + rng() * (b - a);

  // поверхность океана (видна снизу)
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x3d7ba6, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  surf.rotation.x = -Math.PI / 2; surf.position.y = 0;
  uw.add(surf);

  // === БАЗА «ГЛУБИНА» — подводная станция (стартовая точка) ===
  {
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a4a52, metalness: 0.6, roughness: 0.5 });
    const baseGroup = new THREE.Group();
    baseGroup.position.set(30, -SEABED_DEPTH + 12, 40);
    // основной модуль — цилиндр
    const mainMod = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 18, 16), baseMat);
    mainMod.rotation.x = Math.PI / 2;
    baseGroup.add(mainMod);
    // купол наверху
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2a3a42, metalness: 0.7, roughness: 0.4 }));
    dome.position.y = 0;
    baseGroup.add(dome);
    // шлюз (горизонтальный цилиндр)
    const lockMod = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 10, 12), baseMat);
    lockMod.rotation.z = Math.PI / 2;
    lockMod.position.set(-14, -4, 0);
    baseGroup.add(lockMod);
    // опоры (ножки)
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 14, 8), baseMat);
      leg.position.set(x, -7, z);
      baseGroup.add(leg);
    }
    // фонари
    for (const [x, z, c] of [[-6, 0, 0x00e676], [6, 0, 0x00e676], [0, 8, 0xffc400], [0, -8, 0xffc400]]) {
      const lt = new THREE.PointLight(c, 80, 60, 1.5);
      lt.position.set(x, 4, z);
      baseGroup.add(lt);
    }
    // антенна
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.08, 8, 6), baseMat);
    ant.position.set(0, 10, 0);
    baseGroup.add(ant);
    // табличка
    uw.add(baseGroup);
    G.baseStation = baseGroup;

    // маяк базы (светящийся)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x00e676 }));
    beacon.position.set(30, -SEABED_DEPTH + 22, 40);
    uw.add(beacon);
    const beaconLt = new THREE.PointLight(0x00e676, 300, 150, 1.6);
    beacon.position.copy(beacon.position);
    uw.add(beaconLt);
    G.baseBeacon = { mesh: beacon, light: beaconLt };
  }

  // дно
  const geo = new THREE.PlaneGeometry(1600, 1600, 48, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.012) * 6 + Math.cos(y * 0.015) * 7 + Math.sin(x * 0.05 + y * 0.04) * 2);
  }
  geo.computeVertexNormals();
  const seabed = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x14241f, roughness: 0.95 }));
  seabed.rotation.x = -Math.PI / 2; seabed.position.y = -SEABED_DEPTH;
  uw.add(seabed);

  // скалы
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x26342e, roughness: 0.9 });
  for (let i = 0; i < 46; i++) {
    const s = rand(4, 22);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(rand(-700, 700), -SEABED_DEPTH + s * 0.3, rand(-700, 700));
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    rock.scale.y = rand(0.6, 2.2);
    uw.add(rock);
  }

  // обломки кораблей
  const wreckMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.8, metalness: 0.4 });
  for (let i = 0; i < 7; i++) {
    const wreck = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(rand(14, 30), rand(4, 8), rand(5, 9)), wreckMat);
    wreck.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, rand(8, 16), 6), wreckMat);
    mast.position.y = 6; mast.rotation.z = rand(-0.5, 0.5);
    wreck.add(mast);
    wreck.position.set(rand(-600, 600), -SEABED_DEPTH + 2, rand(-600, 600));
    wreck.rotation.set(rand(-0.3, 0.3), rng() * Math.PI, rand(-0.4, 0.4));
    uw.add(wreck);
  }

  // точки интереса — светящиеся маяки + лут
  G.poi = [];
  const poiDefs = [
    { x: 120, z: -180, color: 0x00e676, name: 'СТАНЦИЯ «ГЛУБИНА»' },
    { x: -240, z: -90, color: 0xffc400, name: 'ЗАТОНУВШИЙ СУХОГРУЗ' },
    { x: 60, z: 300, color: 0xff5252, name: 'ПОДВОДНЫЙ ВУЛКАН' },
  ];
  G.lootCrates = [];
  for (const p of poiDefs) {
    const grp = new THREE.Group();
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: p.color }));
    grp.add(beacon);
    const lt = new THREE.PointLight(p.color, 400, 220, 1.6);
    grp.add(lt);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 2.4, 26, 8),
      new THREE.MeshStandardMaterial({ color: 0x222a30, roughness: 0.7 }));
    tower.position.y = -14; grp.add(tower);
    grp.position.set(p.x, -SEABED_DEPTH + 28, p.z);
    uw.add(grp);
    G.poi.push({ grp, beacon, ...p });

    // лут-контейнеры рядом с POI
    const crateCount = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < crateCount; i++) {
      const crateGrp = new THREE.Group();
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.3 }));
      crateGrp.add(crate);
      // полоска
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.92),
        new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0xffc400, emissiveIntensity: 0.2 }));
      stripe.position.y = 0.1;
      crateGrp.add(stripe);
      const lootX = p.x + (Math.random() - 0.5) * 30;
      const lootZ = p.z + (Math.random() - 0.5) * 30;
      crateGrp.position.set(lootX, -SEABED_DEPTH + 1.5, lootZ);
      crateGrp.rotation.y = Math.random() * Math.PI;
      uw.add(crateGrp);
      G.lootCrates.push({ grp: crateGrp, pos: new THREE.Vector3(lootX, -SEABED_DEPTH + 1.5, lootZ), looted: false });
    }
  }

  // жёлтые метки лута на сонаре
  if (G.sonar) {
    const dotGeo = new THREE.CircleGeometry(0.015, 6);
    for (const crate of G.lootCrates) {
      const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 }));
      dot.position.z = 0.065;
      G.sonar.grp.add(dot);
      crate.sonarDot = dot;
    }
  }

  // планктон-частицы вокруг лодки (в сцене, не в uw — чтобы всегда рядом)
  const count = 500;
  const pgeo = new THREE.BufferGeometry();
  const parr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    parr[i * 3] = (Math.random() - 0.5) * 90;
    parr[i * 3 + 1] = (Math.random() - 0.5) * 50;
    parr[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  pgeo.setAttribute('position', new THREE.BufferAttribute(parr, 3));
  const plankton = new THREE.Points(pgeo, new THREE.PointsMaterial({
    color: 0x6fa8bc, size: 0.18, transparent: true, opacity: 0.4, sizeAttenuation: true,
  }));
  G.scene.add(plankton);
  G.plankton = plankton;

  // прожектор лодки (светит вперёд из носа мостика)
  const head = new THREE.SpotLight(0xcfe8ff, 0, 260, 0.5, 0.4, 1.2);
  head.position.set(0, 1.6, -17.8);
  const tgt = new THREE.Object3D(); tgt.position.set(0, 0, -200);
  G.scene.add(tgt); head.target = tgt;
  G.scene.add(head);
  G.headlight = head;

  // тусклый свет глубины
  const dim = new THREE.HemisphereLight(0x18384a, 0x020608, 0.5);
  uw.add(dim);
  G.uwDim = dim;
}


function buildHistoricOuterHull(g, deckY) {
  // Внешний силуэт ближе к историческим дизель-электрическим лодкам: сигарообразный корпус,
  // рубка-седло, клёпка, носовые/кормовые рули и два винта. Детали вынесены наружу,
  // чтобы не пересекаться с интерьерными объектами и проходами.
  const centerZ = (HULL.z0 + HULL.z1) / 2 + 2;
  const outerY = 1.22;
  const hullLen = 47;

  const pressureHull = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, hullLen, 32), MAT.hull);
  pressureHull.rotation.x = Math.PI / 2;
  pressureHull.position.set(0, outerY, centerZ);
  g.add(pressureHull);

  cone(2.35, 5.2, MAT.hull, 0, outerY, HULL.z0 - 3.1, g, -Math.PI / 2);
  cone(2.0, 6.2, MAT.hull, 0, outerY, HULL.z1 + 6.0, g, Math.PI / 2);

  // «Седловые» балластные цистерны по бортам, ниже окон мостика.
  for (const sx of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 30, 18), MAT.dark);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(sx * 2.55, 0.72, 2.0);
    g.add(tank);
    for (let z = -11; z <= 15; z += 5.2) {
      torus(0.56, 0.018, MAT.rivet, sx * 2.55, 0.72, z, g, Math.PI / 2, 0, 0);
    }
  }

  // Клёпка вдоль корпуса — мелкие точки не имеют коллизий.
  const rivetGeo = new THREE.SphereGeometry(0.035, 6, 4);
  for (const sx of [-1, 1]) {
    for (let z = HULL.z0 - 1; z <= HULL.z1 + 4; z += 1.55) {
      for (const y of [0.15, 2.28]) {
        const r = new THREE.Mesh(rivetGeo, MAT.rivet);
        r.position.set(sx * 2.42, y, z);
        g.add(r);
      }
    }
  }

  // Верхняя рубка/боевая рубка с перископами и боковыми иллюминаторами.
  const sailBase = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.42, 5.4), MAT.dark);
  sailBase.position.set(0, deckY + 0.25, 21.7); g.add(sailBase);
  const conning = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.55, 3.35), MAT.hull);
  conning.position.set(0, deckY + 1.55, 21.4); g.add(conning);
  const conningTop = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 2.1, 18), MAT.hull);
  conningTop.rotation.x = Math.PI / 2; conningTop.position.set(0, deckY + 2.95, 21.4); g.add(conningTop);
  for (const sx of [-1, 1]) {
    for (const z of [20.35, 21.4, 22.45]) {
      const win = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 14), MAT.glass);
      win.rotation.z = Math.PI / 2; win.position.set(sx * 1.06, deckY + 1.75, z); g.add(win);
      torus(0.21, 0.018, MAT.brass, sx * 1.075, deckY + 1.75, z, g, 0, Math.PI / 2, 0);
    }
  }
  cyl(0.055, 2.7, MAT.blackRubber, -0.34, deckY + 4.0, 21.05, g);
  cyl(0.045, 2.25, MAT.blackRubber, 0.28, deckY + 3.75, 21.85, g);
  box(0.55, 0.07, 0.18, MAT.blackRubber, -0.34, deckY + 5.35, 20.94, g);

  // Носовой волнорез/антисетевой резак и якорные клюзы.
  cyl(0.035, 5.0, MAT.brass, 0, outerY + 2.15, HULL.z0 - 4.9, g, Math.PI / 2, 0);
  for (const sx of [-1, 1]) {
    const hawse = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 18), MAT.blackRubber);
    hawse.rotation.y = Math.PI / 2; hawse.position.set(sx * 1.25, 1.25, HULL.z0 - 2.2); g.add(hawse);
  }

  // Носовые и кормовые горизонтальные рули, киль и стабилизаторы.
  for (const [z, span] of [[HULL.z0 - 1.7, 1.55], [HULL.z1 + 7.0, 1.75]]) {
    for (const sx of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.BoxGeometry(span, 0.08, 0.62), MAT.dark);
      plane.position.set(sx * (2.2 + span / 2), 0.82, z);
      plane.rotation.z = sx * 0.07;
      g.add(plane);
    }
  }
  box(0.12, 1.45, 4.2, MAT.dark, 0, -0.15, HULL.z1 + 4.7, g);
  box(0.12, 1.45, 3.0, MAT.dark, 0, 2.85, HULL.z1 + 4.2, g);

  // Два винта с защитными кольцами, расположены за корпусом, не пересекают палубу.
  for (const sx of [-0.78, 0.78]) {
    torus(0.38, 0.025, MAT.brass, sx, 0.82, HULL.z1 + 9.2, g, 0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.42), MAT.brass);
      blade.position.set(sx, 0.82, HULL.z1 + 9.2);
      blade.rotation.z = i * Math.PI * 2 / 3;
      blade.rotation.y = 0.35;
      g.add(blade);
    }
    cyl(0.05, 1.45, MAT.dark, sx, 0.82, HULL.z1 + 8.45, g, 0, Math.PI / 2);
  }

  const s = makeSign('ТИФОН-9 · RESEARCH SUBMARINE', 2.4, 0.28, '#101820', '#c9a227');
  s.position.set(0, 2.52, HULL.z0 + 2.6); s.rotation.y = Math.PI;
  g.add(s);
}

// ---------- ПАЛУБА (единая карта, корма субмарины) ----------
function buildExterior() {
  const g = new THREE.Group();
  G.scene.add(g);
  G.exterior = g;

  const deckY = DECK.eyeY - 1.62;
  buildHistoricOuterHull(g, deckY);
  // палуба на корме
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 14), MAT.deck);
  deck.position.set(0, deckY, 24); g.add(deck);
  // невысокая обслуживаемая площадка на рубке — основной историчный силуэт строится отдельно
  const lookout = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.36, 1.45), MAT.dark);
  lookout.position.set(0, deckY + 3.25, 21.2); g.add(lookout);
  cyl(0.03, 0.9, MAT.brass, 0, deckY + 3.78, 20.4, g);

  // палубные трубы
  cyl(0.04, 6, MAT.pipe2, -1.8, deckY + 0.15, 25, g, Math.PI / 2, 0);
  cyl(0.04, 6, MAT.pipe2,  1.8, deckY + 0.15, 25, g, Math.PI / 2, 0);

  // океан вокруг (поверхность) — 4 плитки с «сухим» окном у корпуса,
  // чтобы водная плоскость не проходила сквозь интерьер подлодки.
  G.oceanMeshes = [];
  const oceanY = deckY - 0.5;
  const holeHalfX = 16;
  const holeHalfZ = 22;
  const addOceanTile = (w, d, x, z) => {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 24, 24), MAT.ocean);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(x, oceanY, z);
    g.add(tile);
    G.oceanMeshes.push(tile);
  };
  addOceanTile(400, 180, 0, 24 + holeHalfZ + 90);   // нос
  addOceanTile(400, 180, 0, 24 - holeHalfZ - 90);   // корма
  addOceanTile(180, holeHalfZ * 2, -holeHalfX - 90, 24); // левый борт
  addOceanTile(180, holeHalfZ * 2, holeHalfX + 90, 24);  // правый борт

  // перила
  for (const sx of [-2.0, 2.0]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 13, 6), MAT.brass);
    rail.rotation.x = Math.PI / 2; rail.position.set(sx, deckY + 0.95, 24); g.add(rail);
    addCollider(new THREE.Vector3(sx - 0.15, deckY, 17.5), new THREE.Vector3(sx + 0.15, deckY + 1.2, 30.5));
  }
  addCollider(new THREE.Vector3(-2.2, deckY, 17.3), new THREE.Vector3(2.2, deckY + 1.2, 17.8));
  addCollider(new THREE.Vector3(-2.2, deckY, 30.2), new THREE.Vector3(2.2, deckY + 1.2, 30.7));

  const sDeck = makeSign('ПАЛУБА / AIRLOCK', 1.8, 0.3);
  sDeck.position.set(0, deckY + 1.15, 24.5); sDeck.rotation.x = -0.4;
  g.add(sDeck);

  const sun = new THREE.DirectionalLight(0xfff3e0, 1.2);
  sun.position.set(30, 50, 10); G.scene.add(sun);
  G.extSun = sun;
  const amb = new THREE.HemisphereLight(0x9fd8ff, 0x0a3550, 0.6);
  G.scene.add(amb);
  G.extAmb = amb;
}

export function buildWorld() {
  buildMaterials();
  buildHullInterior();
  buildLights();
  buildProps();
  buildUnderwater();
  buildExterior();
}

const _Y = new THREE.Vector3(0, 1, 0);
const _tmp = new THREE.Vector3();

// каждый кадр: волны + позиционирование подводного мира относительно лодки
export function updateWorld(t, dt) {
  const sim = G.sim;

  // волны океана на палубе + визуальное движение (вода не проходит через корпус)
  if (G.oceanMeshes && G.oceanMeshes.length) {
    const showSurface = G.flags.outside && sim.depth <= 0.5;
    for (const ocean of G.oceanMeshes) {
      ocean.visible = showSurface;
      if (!showSurface) continue;
      const pos = ocean.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i,
          Math.sin(x * 0.3 + t * 1.2 + sim.boatX * 0.01) * 0.25
          + Math.cos(y * 0.25 + t * 0.9 + sim.boatZ * 0.01) * 0.2
        );
      }
      pos.needsUpdate = true;
    }
  }
  // визуальное движение: планктон дрейфует мимо при ходу
  if (G.plankton && sim) {
    G.plankton.position.z += sim.speed * 0.15 * dt;
    if (Math.abs(G.plankton.position.z) > 20) G.plankton.position.z = 0;
  }

  // внешнее освещение: только на поверхности
  if (G.extSun) G.extSun.intensity = sim.depth <= 0.5 ? 1.2 : 0;
  if (G.extAmb) G.extAmb.intensity = sim.depth <= 0.5 ? 0.6 : 0;

  // --- подводный мир: вращаем/смещаем вокруг лодки ---
  if (G.underwater && sim) {
    const th = sim.heading * Math.PI / 180;
    G.underwater.rotation.y = th;
    _tmp.set(-sim.boatX, sim.depth + 0.5, -sim.boatZ).applyAxisAngle(_Y, th);
    G.underwater.position.copy(_tmp);

    // пульс маяков POI
    if (G.poi) for (let i = 0; i < G.poi.length; i++) {
      const p = G.poi[i];
      const s = 1 + Math.sin(t * 2 + i * 2) * 0.25;
      p.beacon.scale.setScalar(s);
    }

    // пульс маяка базы
    if (G.baseBeacon) {
      const s = 1 + Math.sin(t * 3) * 0.2;
      G.baseBeacon.mesh.scale.setScalar(s);
      G.baseBeacon.light.intensity = 250 + Math.sin(t * 3) * 80;
    }
  }

  // прожектор
  if (G.headlight) {
    G.headlight.intensity = sim?.lightsOn && sim?.busPowered ? 900 : 0;
  }

  // иллюминатор мостика слегка «дрожит» на ходу
  if (G.bridgeGlass && sim) {
    const shake = Math.abs(sim.speed) * 0.002;
    G.bridgeGlass.position.x = Math.sin(t * 3.7) * shake;
  }

    // sonar: вращение линии-сканера + пульс колец + позиция меток POI + лут + пинг
  if (G.sonar && sim) {
    G.sonar.scanLine.rotation.z = -t * 2.5;
    G.sonar.ring.material.opacity = 0.4 + Math.sin(t * 4) * 0.2;
    // пинг сонара каждые 3 сек
    if (!G.sonar._pingTimer) G.sonar._pingTimer = 0;
    G.sonar._pingTimer += dt;
    if (G.sonar._pingTimer > 3) {
      G.sonar._pingTimer = 0;
      G.sfx?.sonarPing();
    }
    // метки POI + лут на сонаре
    if (G.sonar.dots) {
      const sHeading = sim.heading * Math.PI / 180;
      for (const d of G.sonar.dots) {
        const dx = d.poi.x - sim.boatX;
        const dz = d.poi.z - sim.boatZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, -dz) - sHeading;
        const maxR = 0.33;
        const displayR = Math.min(dist / 400, 1) * maxR;
        d.dot.position.x = Math.sin(angle) * displayR;
        d.dot.position.y = -Math.cos(angle) * displayR;
        d.dot.material.opacity = dist < 300 ? 0.9 : 0.3 + Math.sin(t * 3) * 0.2;
      }
    }
    // метки лута на сонаре (жёлтые)
    if (G.lootCrates && G.sonar.grp) {
      const sHeading = sim.heading * Math.PI / 180;
      for (const crate of G.lootCrates) {
        if (crate.looted || !crate.sonarDot) continue;
        const dx = crate.pos.x - sim.boatX;
        const dz = crate.pos.z - sim.boatZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, -dz) - sHeading;
        const maxR = 0.33;
        const displayR = Math.min(dist / 400, 1) * maxR;
        crate.sonarDot.position.x = Math.sin(angle) * displayR;
        crate.sonarDot.position.y = -Math.cos(angle) * displayR;
        crate.sonarDot.material.opacity = dist < 50 ? 0.9 : 0.2;
      }
    }
  }

  // аварийное освещение: мигание при активации
  if (G.emergencyLights && G.emergencyOn) {
    const blink = Math.sin(t * 6) > 0 ? 1 : 0.15;
    for (const el of G.emergencyLights) {
      el.light.intensity = blink * 3;
    }
  } else if (G.emergencyLights) {
    for (const el of G.emergencyLights) {
      el.light.intensity = 0;
    }
  }

  // вода в отсеках (видна только при течи/реальном накоплении)
  if (G.waterMeshes && sim) {
    const leakIds = new Set((G.hazards?.leaks || []).map(l => l.comp.id));
    for (const c of COMPARTMENTS) {
      const lvl = sim.water[c.id];
      const m = G.waterMeshes[c.id];
      const shouldShow = lvl > 0.02 && (leakIds.has(c.id) || lvl > 0.12);
      if (shouldShow) {
        m.visible = true;
        m.scale.y = lvl;
        const floorY = c.lowerDeck ? -1.0 : 0;
        m.position.y = floorY + lvl / 2;
      } else {
        m.visible = false;
      }
    }
  }
}

export function compartmentAt(z, y = 1.62) {
  if (z >= -18 && z < -10 && y < 1.0) {
    return COMPARTMENTS.find(c => c.id === 'torpedo') || COMPARTMENTS[0];
  }
  for (const c of COMPARTMENTS) {
    if (c.lowerDeck) continue;
    if (z >= c.z0 && z < c.z1) return c;
  }
  if (z >= 22) return { name: 'ШЛЮЗ' };
  if (z >= 17.5) return { name: 'ПАЛУБА' };
  return COMPARTMENTS[0];
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
