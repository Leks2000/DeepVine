// ============ МИР: интерьер субмарины (5 отсеков) + внешняя палуба ============
import * as THREE from 'three';
import { G, addCollider } from './state.js';

// Интерьер: труба вдоль оси Z. Ширина 6, высота 3.2, длина 40 (z: -18..22)
// Отсеки (нос -> корма):
//  ТОРПЕДНЫЙ  z[-18,-10] · МОСТИК z[-10,-2] · ЖИЛОЙ z[-2,6] · РЕАКТОРНЫЙ z[6,14] · МАШИННЫЙ z[14,22]
export const HULL = { w: 6, h: 3.2, z0: -18, z1: 22 };
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
  MAT.black  = new THREE.MeshStandardMaterial({ color: 0x14181c, metalness: 0.3, roughness: 0.9 });
  MAT.screenOn  = new THREE.MeshStandardMaterial({ color: 0x06281e, emissive: 0x00e676, emissiveIntensity: 0.55 });
  MAT.screenOff = new THREE.MeshStandardMaterial({ color: 0x0a0e10, emissive: 0x000000 });
  MAT.glassWater = new THREE.MeshStandardMaterial({ color: 0x06324a, emissive: 0x0a4a6e, emissiveIntensity: 0.4, transparent: true, opacity: 0.92 });
  MAT.deck   = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.6, roughness: 0.6 });
  MAT.ocean  = new THREE.MeshStandardMaterial({ color: 0x0a3550, metalness: 0.1, roughness: 0.4, transparent: true, opacity: 0.95 });
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

// ---------- ИНТЕРЬЕР ----------
function buildHullInterior() {
  const { w, h, z0, z1 } = HULL;
  const len = z1 - z0, zc = (z0 + z1) / 2;

  // пол / потолок / стены
  box(w, 0.2, len, MAT.floor, 0, -0.1, zc);
  box(w, 0.2, len, MAT.hull, 0, h + 0.1, zc);
  box(0.2, h, len, MAT.hull, -w / 2 - 0.1, h / 2, zc, null, true);
  box(0.2, h, len, MAT.hull,  w / 2 + 0.1, h / 2, zc, null, true);
  // торцы
  box(w, h, 0.2, MAT.bulk, 0, h / 2, z0 - 0.1, null, true);
  box(w, h, 0.2, MAT.bulk, 0, h / 2, z1 + 0.1, null, true);

  // скруглённые «рёбра» корпуса каждые 4 м
  for (let z = z0 + 2; z < z1; z += 4) {
    cyl(0.07, h, MAT.dark, -w / 2 + 0.08, h / 2, z);
    cyl(0.07, h, MAT.dark,  w / 2 - 0.08, h / 2, z);
    box(w - 0.1, 0.12, 0.12, MAT.dark, 0, h - 0.06, z);
  }

  // трубы вдоль потолка
  cyl(0.09, len, MAT.pipe,  -w / 2 + 0.5, h - 0.25, zc, null, 0, Math.PI / 2);
  cyl(0.09, len, MAT.pipe2, -w / 2 + 0.8, h - 0.45, zc, null, 0, Math.PI / 2);
  cyl(0.07, len, MAT.pipe2,  w / 2 - 0.5, h - 0.25, zc, null, 0, Math.PI / 2);

  // переборки между отсеками с проёмами (дверь по центру, ширина 1.2)
  for (let i = 1; i < COMPARTMENTS.length; i++) {
    const z = COMPARTMENTS[i].z0;
    const side = (w - 1.2) / 2;
    box(side, h, 0.25, MAT.bulk, -(1.2 / 2 + side / 2), h / 2, z, null, true);
    box(side, h, 0.25, MAT.bulk,  (1.2 / 2 + side / 2), h / 2, z, null, true);
    box(1.2, h - 2.15, 0.25, MAT.bulk, 0, h - (h - 2.15) / 2, z, null, false); // верх проёма
    // порог-комингс
    box(1.3, 0.18, 0.3, MAT.brass, 0, 0.09, z);
    // рама люка
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 24), MAT.dark);
    ring.position.set(0, 1.15, z); G.scene.add(ring);
  }
}

function buildLights() {
  G.scene.add(new THREE.AmbientLight(0x223344, 0.55));
  for (const c of COMPARTMENTS) {
    const zc = (c.z0 + c.z1) / 2;
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
}

// ---------- РЕКВИЗИТ ПО ОТСЕКАМ ----------
function buildProps() {
  const w = HULL.w;

  // === ТОРПЕДНЫЙ: 2 торпедных аппарата + стеллаж ===
  for (const x of [-1.4, 1.4]) {
    cyl(0.5, 2.6, MAT.hull, x, 1.2, -16.6, null, 0, Math.PI / 2);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.18, 18), MAT.brass);
    cap.position.set(x, 1.2, -15.3); cap.rotation.x = Math.PI / 2; G.scene.add(cap);
    addCollider(new THREE.Vector3(x - 0.6, 0, -17.9), new THREE.Vector3(x + 0.6, 2, -15.2));
  }
  // торпеда на стеллаже
  cyl(0.28, 3.2, MAT.dark, 0, 0.55, -13.5, null, 0, Math.PI / 2);
  box(2.6, 0.35, 0.8, MAT.dark, 0, 0.18, -13.5, null, true);

  // === МОСТИК: консоль с иллюминаторами ===
  // главная консоль (нос мостика)
  box(4.4, 1.0, 0.9, MAT.dark, 0, 0.5, -9.2, null, true);
  box(4.4, 0.55, 0.7, MAT.bulk, 0, 1.25, -9.35);
  // три «экрана»
  for (const x of [-1.4, 0, 1.4]) {
    const scr = box(1.05, 0.62, 0.06, MAT.screenOn, x, 1.55, -9.05);
    scr.rotation.x = -0.25;
  }
  // иллюминаторы в нос (вид «в воду»)
  for (const x of [-1.6, 0, 1.6]) {
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.45, 22), MAT.glassWater);
    glass.position.set(x, 2.2, -9.93); G.scene.add(glass);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.06, 8, 24), MAT.brass);
    rim.position.set(x, 2.2, -9.9); G.scene.add(rim);
  }
  // боковые столики
  box(1.4, 0.9, 0.7, MAT.dark, -2.2, 0.45, -5, null, true);
  box(1.4, 0.9, 0.7, MAT.dark,  2.2, 0.45, -5, null, true);
  // карта на столе
  box(1.1, 0.03, 0.55, MAT.yellow, -2.2, 0.92, -5);

  // === ЖИЛОЙ: койки, стол, шкафы ===
  for (const [x, z] of [[-2.3, 0.5], [-2.3, 3.5]]) {
    box(1.2, 0.25, 2.2, MAT.dark, x, 0.5, z, null, true);
    box(1.15, 0.12, 2.1, MAT.green, x, 0.66, z);
    box(1.2, 0.25, 2.2, MAT.dark, x, 1.7, z);
    box(1.15, 0.12, 2.1, MAT.green, x, 1.86, z);
  }
  box(1.6, 0.08, 1.0, MAT.brass, 2.2, 0.85, 2, null, false); // стол
  box(0.15, 0.85, 0.15, MAT.dark, 2.2, 0.42, 2, null, true);
  // шкафы
  box(1.4, 2.2, 0.5, MAT.bulk, 2.5, 1.1, 4.8, null, true);

  // === РЕАКТОРНЫЙ: реактор-цилиндр + панели ===
  const core = cyl(0.85, 2.7, MAT.hull, -1.9, 1.35, 10);
  addCollider(new THREE.Vector3(-2.9, 0, 9), new THREE.Vector3(-0.9, 2.7, 11));
  // светящееся «окно» реактора
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 0.5, 18),
    new THREE.MeshStandardMaterial({ color: 0x1a0a00, emissive: 0xff6d00, emissiveIntensity: 0.15 }));
  glow.position.set(-1.9, 1.35, 10); G.scene.add(glow);
  G.reactorGlow = glow;
  // кольца на реакторе
  for (const y of [0.5, 1.35, 2.2]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 26), MAT.brass);
    r.position.set(-1.9, y, 10); r.rotation.x = Math.PI / 2; G.scene.add(r);
  }
  // панель управления реактором (правая стена)
  box(2.4, 1.6, 0.3, MAT.dark, 2.85, 1.5, 10, null, true);

  // === МАШИННЫЙ: дизели, верстак, шлюз ===
  for (const x of [-1.8, 1.8]) {
    box(1.6, 1.4, 3.0, MAT.dark, x, 0.7, 17.5, null, true);
    for (let i = 0; i < 4; i++) cyl(0.16, 0.5, MAT.brass, x - 0.5 + i * 0.34, 1.55, 17.5);
  }
  // верстак строится в upgrades.js, шлюз в controls.js
}

// ---------- ВНЕШНИЙ МИР (палуба, доступ через шлюз на поверхности) ----------
export const EXT = { x: 80 }; // внешняя зона смещена по X чтобы не пересекаться
function buildExterior() {
  const g = new THREE.Group();
  g.position.x = EXT.x;
  G.scene.add(g);
  G.exterior = g;

  // океан
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 40, 40), MAT.ocean);
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -0.8; g.add(ocean);
  G.oceanMesh = ocean;

  // корпус субмарины (вид сверху-снаружи), палуба по y=0
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(3, 34, 6, 14), MAT.deck);
  hull.rotation.x = Math.PI / 2; hull.position.set(0, -2.2, 2); g.add(hull);
  // плоская палуба
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 36), MAT.deck);
  deck.position.set(0, -0.05, 2); g.add(deck);
  // рубка
  const sail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 5), MAT.hull);
  sail.position.set(0, 1.7, -4); g.add(sail);
  addCollider(new THREE.Vector3(EXT.x - 1.1, 0, -6.5), new THREE.Vector3(EXT.x + 1.1, 3.4, -1.5));
  // перископ
  cyl(0.09, 2.4, MAT.dark, 0, 4.5, -4.5, g);
  // леера (ограждение) — коллайдеры по краям палубы
  for (const sx of [-1.6, 1.6]) {
    for (let z = -15; z <= 19; z += 2) {
      cyl(0.03, 0.9, MAT.dark, sx, 0.45, z, g);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 35, 6), MAT.brass);
    rail.rotation.x = Math.PI / 2; rail.position.set(sx, 0.9, 2); g.add(rail);
    addCollider(new THREE.Vector3(EXT.x + sx - 0.15, 0, -16), new THREE.Vector3(EXT.x + sx + 0.15, 1.2, 20));
  }
  // торцевые коллайдеры палубы
  addCollider(new THREE.Vector3(EXT.x - 2, 0, -16.3), new THREE.Vector3(EXT.x + 2, 1.2, -15.8));
  addCollider(new THREE.Vector3(EXT.x - 2, 0, 19.8), new THREE.Vector3(EXT.x + 2, 1.2, 20.3));

  // люк шлюза на палубе (визуальный)
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 18), MAT.brass);
  hatch.position.set(0, 0.12, 16); g.add(hatch);
  G.extHatch = hatch;

  // небо/солнце для поверхности
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.5);
  sun.position.set(40, 60, -30); g.add(sun);
  const amb = new THREE.HemisphereLight(0x9fd8ff, 0x0a3550, 0.9);
  g.add(amb);
}

export function buildWorld() {
  buildMaterials();
  buildHullInterior();
  buildLights();
  buildProps();
  buildExterior();
}

// волны океана
export function updateWorld(t) {
  if (G.oceanMesh) {
    const pos = G.oceanMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.3 + t * 1.2) * 0.25 + Math.cos(y * 0.25 + t * 0.9) * 0.2);
    }
    pos.needsUpdate = true;
  }
}

export function compartmentAt(z) {
  for (const c of COMPARTMENTS) if (z >= c.z0 && z < c.z1) return c;
  return COMPARTMENTS[2];
}
