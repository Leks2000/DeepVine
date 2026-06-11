// ============ FPS-ИГРОК: WASD + мышь + коллизии + raycast ============
import * as THREE from 'three';
import { G } from './state.js';

const EYE = 1.62;          // высота глаз
const RADIUS = 0.32;       // радиус «капсулы» игрока
const WALK = 3.2, RUN = 5.4;

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.pos = new THREE.Vector3(0, EYE, 8);   // старт на мостике
    this.yaw = Math.PI;                        // смотрим в нос
    this.pitch = 0;
    this.keys = {};
    this.locked = false;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 2.8;
    this.focus = null;        // интерактив под прицелом
    this.dragging = null;     // активный drag-интерактив
    this.holding = null;      // активный hold-интерактив
    this._bind();
  }

  _bind() {
    document.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this._press();
      if (e.code === 'KeyG') this._dropHeld();
    });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    this.dom.addEventListener('click', () => {
      if (!this.locked && G.flags.started && !G.flags.over) this.dom.requestPointerLock();
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      if (this.dragging) {
        this.dragging.drag.move(e.movementX, e.movementY);
        return; // во время перетаскивания камера зафиксирована
      }
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('mousedown', e => {
      if (!this.locked || e.button !== 0) return;
      const f = this.focus;
      if (f && f.drag && (!f.canUse || f.canUse())) {
        this.dragging = f; f.drag.start && f.drag.start();
      } else if (f && f.hold && (!f.canUse || f.canUse())) {
        this.holding = f; f.hold.start && f.hold.start();
      } else if (G.held && G.held.hold) {
        // предмет в руках с hold-действием (огнетушитель/ключ) — обрабатывает hazards.js
        this.holding = { hold: G.held.hold, _heldItem: true };
        G.held.hold.start && G.held.hold.start();
      }
    });
    document.addEventListener('mouseup', e => {
      if (e.button !== 0) return;
      if (this.dragging) { this.dragging.drag.end && this.dragging.drag.end(); this.dragging = null; }
      if (this.holding) { this.holding.hold.end && this.holding.hold.end(); this.holding = null; }
    });
  }

  _press() {
    if (!this.locked || G.flags.over) return;
    const f = this.focus;
    if (f && f.onPress && (!f.canUse || f.canUse())) f.onPress();
  }

  _dropHeld() {
    if (G.held && G.held.drop) G.held.drop();
  }

  update(dt) {
    if (!this.locked && !G.flags.started) return;

    // --- движение ---
    const speed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? RUN : WALK;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (this.keys['KeyW']) move.add(fwd);
    if (this.keys['KeyS']) move.sub(fwd);
    if (this.keys['KeyD']) move.add(right);
    if (this.keys['KeyA']) move.sub(right);
    if (move.lengthSq() > 0 && !this.dragging) {
      move.normalize().multiplyScalar(speed * dt);
      this._moveAxis(move.x, 0);
      this._moveAxis(move.z, 2);
    }

    // --- камера ---
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    // --- raycast интерактивов ---
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const meshes = [];
    for (const it of G.interactables) if (it.mesh.visible !== false) meshes.push(it.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    let found = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.interactable) o = o.parent;
      if (o) { found = o.userData.interactable; break; }
    }
    this.focus = found;

    // --- hold tick ---
    if (this.holding) this.holding.hold.tick && this.holding.hold.tick(dt);

    // --- позиция предмета в руках ---
    if (G.held && G.held.mesh) {
      const m = G.held.mesh;
      const offset = new THREE.Vector3(0.42, -0.38, -0.7).applyQuaternion(this.camera.quaternion);
      m.position.copy(this.camera.position).add(offset);
      m.quaternion.copy(this.camera.quaternion);
    }
  }

  // скользящие коллизии по AABB, по одной оси
  _moveAxis(d, axis) {
    if (d === 0) return;
    const p = this.pos.clone();
    if (axis === 0) p.x += d; else p.z += d;
    for (const c of G.colliders) {
      if (p.x + RADIUS > c.min.x && p.x - RADIUS < c.max.x &&
          p.z + RADIUS > c.min.z && p.z - RADIUS < c.max.z &&
          EYE > c.min.y && c.max.y > 0.3) {
        return; // упёрлись
      }
    }
    this.pos.copy(p);
  }

  teleport(x, z, yaw = null) {
    this.pos.set(x, EYE, z);
    if (yaw !== null) this.yaw = yaw;
  }
}
