// ============ МИР: интерьер субмарины (5 отсеков + шлюзовая камера) + подводный мир ============
import * as THREE from 'three';
import { G, addCollider } from './state.js';

// Интерьер: труба вдоль оси Z. Ширина 6, высота 3.2, длина 40 (z: -18..22)
// Отсеки (нос -> корма):
//  ТОРПЕДНЫЙ  z[-18,-10] · МОСТИК z[-10,-2] · ЖИЛОЙ z[-2,6] · РЕАКТОРНЫЙ z[6,14] · МАШИННЫЙ z[14,22]
//  ШЛЮЗ z[22,25]
export const HULL = { w: 6, h: 3.2, z0: -18, z1: 22 };
export const SEABED_DEPTH = 150;
export const COMPARTMENTS = [
  { id: 'torpedo', name: 'ТОРПЕДНЫЙ ОТСЕК',  z0: -18, z1: -10, color: 0x37474f },
  { id: 'bridge',  name: 'МОСТИК',            z0: -10, z1: -2,  color: 0x263238 },
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

  // --- боковые стены посегментно: в мостике — окна! ---
  for (const c of COMPARTMENTS) {
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
      } else {
        box(0.2, h, segLen, MAT.hull, X, h / 2, segZc);
      }
    }
    // коллайдер всей стены (стекло тоже непроходимо)
    addCollider(new THREE.Vector3(-w / 2 - 0.2, 0, c.z0), new THREE.Vector3(-w / 2, h, c.z1));
    addCollider(new THREE.Vector3(w / 2, 0, c.z0), new THREE.Vector3(w / 2 + 0.2, h, c.z1));
  }

  // --- НОСОВОЙ ТОРЕЦ с большим иллюминатором (вид в океан) ---
  {
    const X = 0, Z = z0 - 0.1;
    // рама вокруг круглого окна r=1.05 в центре (0, 1.6)
    box(w, 0.55, 0.2, MAT.bulk, 0, 0.275, Z, null, true);          // низ
    box(w, h - 2.65, 0.2, MAT.bulk, 0, (h + 2.65) / 2, Z, null, true); // верх
    box((w - 2.3) / 2, 2.1, 0.2, MAT.bulk, -(2.3 / 2 + (w - 2.3) / 4), 1.6, Z, null, true);
    box((w - 2.3) / 2, 2.1, 0.2, MAT.bulk,  (2.3 / 2 + (w - 2.3) / 4), 1.6, Z, null, true);
    // стекло-купол
    const glass = new THREE.Mesh(new THREE.CircleGeometry(1.08, 28), MAT.glass);
    glass.position.set(0, 1.6, Z + 0.02); glass.renderOrder = 5;
    G.scene.add(glass);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 10, 30), MAT.brass);
    rim.position.set(0, 1.6, Z + 0.05); G.scene.add(rim);
    // болты по ободу
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), MAT.dark);
      b.position.set(Math.cos(a) * 1.1, 1.6 + Math.sin(a) * 1.1, Z + 0.12);
      G.scene.add(b);
    }
    // коллайдер всего торца (через стекло не пройти)
    addCollider(new THREE.Vector3(-w / 2, 0, z0 - 0.3), new THREE.Vector3(w / 2, h, z0));
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
  }

  // скруглённые «рёбра» корпуса каждые 4 м
  for (let z = z0 + 2; z < z1; z += 4) {
    box(w - 0.1, 0.12, 0.12, MAT.dark, 0, h - 0.06, z);
  }

  // трубы вдоль потолка
  cyl(0.09, len, MAT.pipe,  -w / 2 + 0.5, h - 0.25, zc, null, 0, Math.PI / 2);
  cyl(0.09, len, MAT.pipe2, -w / 2 + 0.8, h - 0.45, zc, null, 0, Math.PI / 2);
  cyl(0.07, len, MAT.pipe2,  w / 2 - 0.5, h - 0.25, zc, null, 0, Math.PI / 2);

  // переборки между отсеками с проёмами + ЖЁЛТАЯ ОКАНТОВКА + ТАБЛИЧКИ
  const signNames = { torpedo: 'ТОРПЕДНЫЙ', bridge: 'МОСТИК', living: 'ЖИЛОЙ', reactor: 'РЕАКТОР', engine: 'МАШИННЫЙ' };
  for (let i = 1; i < COMPARTMENTS.length; i++) {
    const z = COMPARTMENTS[i].z0;
    const side = (w - 1.2) / 2;
    box(side, h, 0.25, MAT.bulk, -(1.2 / 2 + side / 2), h / 2, z, null, true);
    box(side, h, 0.25, MAT.bulk,  (1.2 / 2 + side / 2), h / 2, z, null, true);
    box(1.2, h - 2.15, 0.25, MAT.bulk, 0, h - (h - 2.15) / 2, z, null, false);
    box(1.3, 0.18, 0.3, MAT.brass, 0, 0.09, z);
    // жёлтая окантовка проёма
    box(0.12, 2.15, 0.3, MAT.hazard, -0.66, 1.075, z);
    box(0.12, 2.15, 0.3, MAT.hazard,  0.66, 1.075, z);
    box(1.44, 0.12, 0.3, MAT.hazard, 0, 2.21, z);
    // таблички с обеих сторон + лампа над проёмом
    const sFwd = makeSign('→ ' + signNames[COMPARTMENTS[i].id]);
    sFwd.position.set(0, 2.55, z - 0.16); sFwd.rotation.y = Math.PI;
    G.scene.add(sFwd);
    const sBack = makeSign('→ ' + signNames[COMPARTMENTS[i - 1].id]);
    sBack.position.set(0, 2.55, z + 0.16);
    G.scene.add(sBack);
    const doorLamp = new THREE.PointLight(0xffc400, 1.5, 3.2, 2);
    doorLamp.position.set(0, 2.35, z); G.scene.add(doorLamp);
  }
  // табличка ШЛЮЗ над кормовым проёмом
  const sAir = makeSign('→ ШЛЮЗ', 1.3, 0.3);
  sAir.position.set(0, 2.55, z1 - 0.05); sAir.rotation.y = Math.PI;
  G.scene.add(sAir);
  // табличка над носовым иллюминатором
  const sBow = makeSign('ОБЗОРНЫЙ ИЛЛЮМИНАТОР', 2.2, 0.28, '#0d1418', '#80d8ff');
  sBow.position.set(0, 2.95, z0 + 0.05);
  G.scene.add(sBow);
}

function buildLights() {
  G.scene.add(new THREE.AmbientLight(0x223344, 0.55));
  for (const c of COMPARTMENTS) {
    const zc = (c.z0 + c.z1) / 2;
    const lamp = new THREE.PointLight(0xffe7c4, 9, 11, 1.6);
    lamp.position.set(0, HULL.h - 0.35, zc);
    G.scene.add(lamp);
    G.interiorLights.push({ light: lamp, comp: c.id, base: 9 });
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
}

// ---------- РЕКВИЗИТ ПО ОТСЕКАМ ----------
function buildProps() {
  const w = HULL.w;

  // === ТОРПЕДНЫЙ: 2 торпедных аппарата + стеллаж (проход по центру свободен) ===
  for (const x of [-1.7, 1.7]) {
    cyl(0.5, 2.6, MAT.hull, x, 1.2, -16.6, null, 0, Math.PI / 2);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 18), MAT.brass);
    cap.position.set(x, 1.2, -15.3); cap.rotation.x = Math.PI / 2; G.scene.add(cap);
    addCollider(new THREE.Vector3(x - 0.6, 0, -17.9), new THREE.Vector3(x + 0.6, 2, -15.2));
  }
  // торпеды на стеллажах по бокам
  cyl(0.28, 3.2, MAT.dark, -2.2, 0.55, -12.5, null, 0, Math.PI / 2);
  box(0.8, 0.35, 2.6, MAT.dark, -2.2, 0.18, -12.5, null, true);
  cyl(0.28, 3.2, MAT.dark, 2.2, 0.55, -12.5, null, 0, Math.PI / 2);
  box(0.8, 0.35, 2.6, MAT.dark, 2.2, 0.18, -12.5, null, true);

  // === МОСТИК: консоль РАЗДЕЛЕНА — проход к торпедному по центру ===
  for (const sx of [-1, 1]) {
    box(1.9, 1.0, 0.9, MAT.dark, sx * 1.65, 0.5, -9.2, null, true);
    box(1.9, 0.55, 0.7, MAT.bulk, sx * 1.65, 1.25, -9.35);
    const scr = box(1.05, 0.62, 0.06, MAT.screenOn, sx * 1.65, 1.55, -9.05);
    scr.rotation.x = -0.25;
  }
  // боковые столики
  box(1.4, 0.9, 0.7, MAT.dark, -2.2, 0.45, -5, null, true);
  box(1.4, 0.9, 0.7, MAT.dark,  2.2, 0.45, -5, null, true);
  box(1.1, 0.03, 0.55, MAT.yellow, -2.2, 0.92, -5); // карта

  // === ЖИЛОЙ: койки, стол, шкафы ===
  for (const [x, z] of [[-2.3, 0.5], [-2.3, 3.5]]) {
    box(1.2, 0.25, 2.2, MAT.dark, x, 0.5, z, null, true);
    box(1.15, 0.12, 2.1, MAT.green, x, 0.66, z);
    box(1.2, 0.25, 2.2, MAT.dark, x, 1.7, z);
    box(1.15, 0.12, 2.1, MAT.green, x, 1.86, z);
  }
  box(1.6, 0.08, 1.0, MAT.brass, 2.2, 0.85, 2, null, false);
  box(0.15, 0.85, 0.15, MAT.dark, 2.2, 0.42, 2, null, true);
  box(1.4, 2.2, 0.5, MAT.bulk, 2.5, 1.1, 4.8, null, true);

  // === РЕАКТОРНЫЙ: реактор-цилиндр + панели ===
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
  box(2.4, 1.6, 0.3, MAT.dark, 2.85, 1.5, 10, null, true);

  // === МАШИННЫЙ: дизели, эл.щит, верстак ===
  for (const x of [-1.8, 1.8]) {
    box(1.6, 1.4, 3.0, MAT.dark, x, 0.7, 17.5, null, true);
    for (let i = 0; i < 4; i++) cyl(0.16, 0.5, MAT.brass, x - 0.5 + i * 0.34, 1.55, 17.5);
  }
  G.engineBlocks = true;
  // электрощит (правая стена, ближе к носу отсека) — органы в controls.js
  box(1.6, 1.8, 0.25, MAT.dark, 2.85, 1.5, 15.2, null, true);
  const sEl = makeSign('ЭЛЕКТРОЩИТ', 1.2, 0.26);
  sEl.position.set(2.72, 2.6, 15.2); sEl.rotation.y = -Math.PI / 2;
  G.scene.add(sEl);
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

  // точки интереса — светящиеся маяки
  G.poi = [];
  const poiDefs = [
    { x: 120, z: -180, color: 0x00e676, name: 'СТАНЦИЯ «ГЛУБИНА»' },
    { x: -240, z: -90, color: 0xffc400, name: 'ЗАТОНУВШИЙ СУХОГРУЗ' },
    { x: 60, z: 300, color: 0xff5252, name: 'ПОДВОДНЫЙ ВУЛКАН' },
  ];
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

  // прожектор лодки (светит вперёд из носа)
  const head = new THREE.SpotLight(0xcfe8ff, 0, 260, 0.5, 0.4, 1.2);
  head.position.set(0, 1.6, -18.5);
  const tgt = new THREE.Object3D(); tgt.position.set(0, 0, -200);
  G.scene.add(tgt); head.target = tgt;
  G.scene.add(head);
  G.headlight = head;

  // тусклый свет глубины
  const dim = new THREE.HemisphereLight(0x18384a, 0x020608, 0.5);
  uw.add(dim);
  G.uwDim = dim;
}

// ---------- ВНЕШНЯЯ ЗОНА (палуба, выход через шлюз) ----------
export const EXT = { x: 80 };
function buildExterior() {
  const g = new THREE.Group();
  g.position.x = EXT.x;
  G.scene.add(g);
  G.exterior = g;

  // океан (поверхность; прячется под водой)
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 40, 40), MAT.ocean);
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -0.8; g.add(ocean);
  G.oceanMesh = ocean;

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(3, 34, 6, 14), MAT.deck);
  hull.rotation.x = Math.PI / 2; hull.position.set(0, -2.2, 2); g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 36), MAT.deck);
  deck.position.set(0, -0.05, 2); g.add(deck);
  const sail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 5), MAT.hull);
  sail.position.set(0, 1.7, -4); g.add(sail);
  addCollider(new THREE.Vector3(EXT.x - 1.1, 0, -6.5), new THREE.Vector3(EXT.x + 1.1, 3.4, -1.5));
  cyl(0.09, 2.4, MAT.dark, 0, 4.5, -4.5, g);
  for (const sx of [-1.6, 1.6]) {
    for (let z = -15; z <= 19; z += 2) {
      cyl(0.03, 0.9, MAT.dark, sx, 0.45, z, g);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 35, 6), MAT.brass);
    rail.rotation.x = Math.PI / 2; rail.position.set(sx, 0.9, 2); g.add(rail);
    addCollider(new THREE.Vector3(EXT.x + sx - 0.15, 0, -16), new THREE.Vector3(EXT.x + sx + 0.15, 1.2, 20));
  }
  addCollider(new THREE.Vector3(EXT.x - 2, 0, -16.3), new THREE.Vector3(EXT.x + 2, 1.2, -15.8));
  addCollider(new THREE.Vector3(EXT.x - 2, 0, 19.8), new THREE.Vector3(EXT.x + 2, 1.2, 20.3));

  // люк шлюза на палубе с ЖЁЛТОЙ окантовкой
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 18), MAT.brass);
  hatch.position.set(0, 0.12, 16); g.add(hatch);
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 24), MAT.hazard);
  hatchRing.rotation.x = Math.PI / 2; hatchRing.position.set(0, 0.13, 16); g.add(hatchRing);
  G.extHatch = hatch;

  // солнце/небо (выключаются под водой)
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.5);
  sun.position.set(40, 60, -30); g.add(sun);
  G.extSun = sun;
  const amb = new THREE.HemisphereLight(0x9fd8ff, 0x0a3550, 0.9);
  g.add(amb);
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

  // волны океана (внешняя зона)
  if (G.oceanMesh && G.flags.outside && sim.depth <= 0.5) {
    const pos = G.oceanMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.3 + t * 1.2) * 0.25 + Math.cos(y * 0.25 + t * 0.9) * 0.2);
    }
    pos.needsUpdate = true;
  }

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
  }

  // прожектор
  if (G.headlight) {
    G.headlight.intensity = sim?.lightsOn && sim?.busPowered ? 900 : 0;
  }

  // планктон дрейфует
  if (G.plankton) {
    G.plankton.rotation.y = t * 0.01;
    G.plankton.position.y = Math.sin(t * 0.3) * 1.2;
  }

  // вода в отсеках
  if (G.waterMeshes && sim) {
    for (const c of COMPARTMENTS) {
      const lvl = sim.water[c.id];
      const m = G.waterMeshes[c.id];
      if (lvl > 0.01) {
        m.visible = true;
        m.scale.y = lvl;
        m.position.y = lvl / 2 - 0.5 + 0.5; // от пола вверх
        m.position.y = lvl / 2;
      } else m.visible = false;
    }
  }
}

export function compartmentAt(z) {
  for (const c of COMPARTMENTS) if (z >= c.z0 && z < c.z1) return c;
  return COMPARTMENTS[2];
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
