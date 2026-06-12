// ============ DEV: режим спектатора ============
import * as THREE from 'three';
import { G } from './state.js';
import { compartmentAt } from './world.js';

const FLY = 12;

export function initDev() {
  const el = document.createElement('div');
  el.id = 'dev-overlay';
  el.style.cssText = 'display:none;position:fixed;left:8px;top:80px;z-index:100;font:12px monospace;color:#4fc3f7;background:rgba(4,18,28,.85);padding:8px 12px;border:1px solid #1b4a66;border-radius:6px;pointer-events:none;white-space:pre;line-height:1.5;';
  document.body.appendChild(el);
  G.devOverlay = el;

  document.addEventListener('keydown', e => {
    if (e.code === 'F8' || (e.ctrlKey && e.shiftKey && e.code === 'KeyF')) {
      G.flags.spectator = !G.flags.spectator;
      if (G.flags.spectator) {
        document.exitPointerLock?.();
        el.style.display = 'block';
        G.hud?.log('🔧 SPECTATOR — WASD+QE, мышь, F8 выход', 'ok');
      } else {
        el.style.display = 'none';
      }
    }
  });
}

export function updateDev() {
  if (!G.flags.spectator || !G.player || !G.devOverlay) return;
  const p = G.player.pos;
  const comp = compartmentAt(p.z, p.y);
  G.devOverlay.textContent =
    `SPECTATOR\n` +
    `xyz: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}\n` +
    `отсек: ${comp?.name || '—'}\n` +
    `глубина: ${G.sim?.depth?.toFixed(0) || 0} м · stress: ${G.sim?.stress?.toFixed(0) || 0}\n` +
    `двигатель: ${G.sim?.engineState || '—'} · ${G.sim?.speed?.toFixed(1) || 0} уз`;
}

export function spectatorMove(player, dt) {
  if (!G.flags.spectator) return false;
  const speed = FLY * (player.keys['ShiftLeft'] ? 2.5 : 1);
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const move = new THREE.Vector3();
  if (player.keys['KeyW']) move.add(fwd);
  if (player.keys['KeyS']) move.sub(fwd);
  if (player.keys['KeyD']) move.add(right);
  if (player.keys['KeyA']) move.sub(right);
  if (player.keys['KeyE']) move.y += 1;
  if (player.keys['KeyQ']) move.y -= 1;
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed * dt);
    player.pos.add(move);
  }
  return true;
}
