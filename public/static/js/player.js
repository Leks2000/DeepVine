// ============ FPS-ИГРОК: WASD + мышь + коллизии + raycast ============
import * as THREE from 'three';
import { G } from './state.js';
import { spectatorMove } from './dev.js';

const EYE_UPPER = 1.62;
const EYE_LOWER = 0.95;
const RADIUS = 0.32;
const WALK = 3.2, RUN = 5.4;

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.pos = new THREE.Vector3(0, EYE_UPPER, -6);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.keys = {};
    this.locked = false;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 6.2;
    this.focus = null;
    this.dragging = null;
    this.holding = null;
    this._bind();
  }

  _bind() {
    document.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE' && !G.flags.spectator) this._press();
      if (e.code === 'KeyG') this._dropHeld();
    });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    this.dom.addEventListener('click', () => {
      if (!this.locked && G.flags.started && !G.flags.over && !G.flags.spectator) {
        this.dom.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked && !G.flags.spectator) return;
      if (G.flags.spectator || this.locked) {
        if (this.dragging) {
          this.dragging.drag.move(e.movementX, e.movementY);
          return;
        }
        // сглаживание мыши: игнорировать микро-движения
        const mx = Math.abs(e.movementX) < 0.5 ? 0 : e.movementX;
        const my = Math.abs(e.movementY) < 0.5 ? 0 : e.movementY;
        this.yaw -= mx * 0.0022;
        this.pitch -= my * 0.0022;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
      }
    });
    document.addEventListener('mousedown', e => {
      if (G.flags.spectator) return;
      if (!this.locked || e.button !== 0) return;
      const f = this.focus;
      if (f && f.drag && (!f.canUse || f.canUse())) {
        this.dragging = f; f.drag.start && f.drag.start();
      } else if (f && f.hold && (!f.canUse || f.canUse())) {
        this.holding = f; f.hold.start && f.hold.start();
      } else if (G.held && G.held.hold) {
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

  _onLowerDeck() {
    return this.pos.z >= -18 && this.pos.z < -10 && this.pos.y < 1.25;
  }

  _inLadderShaft() {
    return (this.pos.x > 0.95 && this.pos.z > -12.4 && this.pos.z < -9.35)
      || (this.pos.x < -0.95 && this.pos.z > 13.2 && this.pos.z < 16.9);
  }

  _preventLowerDeckStuck() {
    // Нижняя палуба низкая и связана телепорт-площадками: мягко удерживаем игрока в свободном коридоре,
    // а если он вышел из шахты лестницы на нижней высоте — поднимаем на обычную палубу.
    if (this.pos.y < 1.25 && this.pos.z >= -18 && this.pos.z < -10) {
      this.pos.x = Math.max(-2.35, Math.min(2.35, this.pos.x));
      this.pos.z = Math.max(-17.35, Math.min(-10.35, this.pos.z));
    } else if (this.pos.y < 1.25 && this.pos.z >= 14 && this.pos.z < 22) {
      this.pos.x = Math.max(-2.35, Math.min(2.35, this.pos.x));
      this.pos.z = Math.max(14.35, Math.min(21.35, this.pos.z));
    }
  }

  _updateLadder(dt) {
    // лестница → торпедный отсек (нос)
    if (this.pos.x > 1.0 && this.pos.z > -11.8 && this.pos.z < -9.5) {
      if (this.keys['KeyS']) this.pos.y = Math.max(EYE_LOWER, this.pos.y - dt * 2.5);
      if (this.keys['KeyW']) this.pos.y = Math.min(EYE_UPPER, this.pos.y + dt * 2.5);
    }
    // лестница → машинный отсек (корма)
    if (this.pos.x < -1.0 && this.pos.z > 13.5 && this.pos.z < 16.5) {
      if (this.keys['KeyS']) this.pos.y = Math.max(EYE_LOWER, this.pos.y - dt * 2.5);
      if (this.keys['KeyW']) this.pos.y = Math.min(EYE_UPPER, this.pos.y + dt * 2.5);
    }
    // плавный переход высоты без дёрганья; вне шахты нижний уровень сам возвращает игрока вверх
    const onLower = this._onLowerDeck() || this._onLowerEngine();
    const inShaft = this._inLadderShaft();
    if (onLower && this.pos.y < 1.2) {
      this.pos.y += (EYE_LOWER - this.pos.y) * Math.min(1, dt * 12);
    } else if (!onLower && !inShaft && this.pos.y < 1.35) {
      this.pos.y += (EYE_UPPER - this.pos.y) * Math.min(1, dt * 12);
    } else if (!onLower && this.pos.y > 1.2 && this.pos.y < 1.35) {
      this.pos.y += (EYE_UPPER - this.pos.y) * Math.min(1, dt * 12);
    }
    this._preventLowerDeckStuck();
  }

  _onLowerEngine() {
    return this.pos.z >= 14 && this.pos.z < 22 && this.pos.y < 1.25;
  }

  update(dt) {
    if (!G.flags.started) return;
    if (!this.locked && !G.flags.spectator) return;

    if (spectatorMove(this, dt)) {
      this.camera.position.copy(this.pos);
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotateY(this.yaw);
      this.camera.rotateX(this.pitch);
      return;
    }

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
      // скольжение вдоль стен: проверяем X и Z отдельно
      const newX = this.pos.x + move.x;
      const newZ = this.pos.z + move.z;
      const feet = this.pos.y - 1.62;
      const bodyTop = this.pos.y + 0.1;
      let canX = true, canZ = true;
      for (const c of G.colliders) {
        if (newX + RADIUS > c.min.x && newX - RADIUS < c.max.x &&
            this.pos.z + RADIUS > c.min.z && this.pos.z - RADIUS < c.max.z &&
            bodyTop > c.min.y && feet < c.max.y) {
          canX = false;
        }
        if (this.pos.x + RADIUS > c.min.x && this.pos.x - RADIUS < c.max.x &&
            newZ + RADIUS > c.min.z && newZ - RADIUS < c.max.z &&
            bodyTop > c.min.y && feet < c.max.y) {
          canZ = false;
        }
      }
      if (canX) this.pos.x = newX;
      if (canZ) this.pos.z = newZ;
    }

    this._updateLadder(dt);

    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

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

    if (this.holding) this.holding.hold.tick && this.holding.hold.tick(dt);

    if (G.held && G.held.mesh) {
      const m = G.held.mesh;
      const offset = new THREE.Vector3(0.42, -0.38, -0.7).applyQuaternion(this.camera.quaternion);
      m.position.copy(this.camera.position).add(offset);
      m.quaternion.copy(this.camera.quaternion);
    }
  }

  _moveAxis(d, axis) {
    if (d === 0) return;
    const p = this.pos.clone();
    if (axis === 0) p.x += d; else p.z += d;
    const feet = p.y - 1.62;
    for (const c of G.colliders) {
      const bodyTop = p.y + 0.1;
      if (p.x + RADIUS > c.min.x && p.x - RADIUS < c.max.x &&
          p.z + RADIUS > c.min.z && p.z - RADIUS < c.max.z &&
          bodyTop > c.min.y && feet < c.max.y) {
        return;
      }
    }
    this.pos.copy(p);
  }

  teleport(x, z, yaw = null, y = null) {
    this.pos.set(x, y ?? EYE_UPPER, z);
    if (yaw !== null) this.yaw = yaw;
    this._preventLowerDeckStuck();
  }
}
