// ============ ТОЧКА ВХОДА ============
import * as THREE from 'three';
import { G } from './state.js';
import { buildWorld, updateWorld } from './world.js';
import { Player } from './player.js';
import { Sim } from './sim.js';
import { buildControls, updateControls } from './controls.js';
import { initDev, updateDev } from './dev.js';
import { Hazards } from './hazards.js';
import { Upgrades } from './upgrades.js';
import { Hud, showEnd } from './hud.js';
import { Sfx } from './audio.js';

const MAX_FPS = 180;
const MIN_FRAME_MS = 1000 / MAX_FPS;


function initSettingsUi() {
  const savedVolume = localStorage.getItem('typhon9.volume');
  const savedMuted = localStorage.getItem('typhon9.muted');
  if (savedVolume !== null) G.settings.volume = Math.max(0, Math.min(1, Number(savedVolume)));
  if (savedMuted !== null) G.settings.muted = savedMuted === 'true';

  const volume = document.getElementById('settings-volume');
  const volumeValue = document.getElementById('settings-volume-value');
  const muted = document.getElementById('settings-mute');
  const fullscreen = document.getElementById('btn-fullscreen');

  const syncAudio = () => {
    if (volumeValue) volumeValue.textContent = `${Math.round(G.settings.volume * 100)}%`;
    G.sfx?.setMasterVolume(G.settings.volume);
    G.sfx?.setMuted(G.settings.muted);
  };

  if (volume) {
    volume.value = String(Math.round(G.settings.volume * 100));
    volume.addEventListener('input', () => {
      G.settings.volume = Number(volume.value) / 100;
      localStorage.setItem('typhon9.volume', String(G.settings.volume));
      syncAudio();
    });
  }
  if (muted) {
    muted.checked = G.settings.muted;
    muted.addEventListener('change', () => {
      G.settings.muted = muted.checked;
      localStorage.setItem('typhon9.muted', String(G.settings.muted));
      syncAudio();
    });
  }
  fullscreen?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  });
  syncAudio();
}

function init() {
  try {
  const canvas = document.getElementById('game-canvas');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  G.renderer.setSize(innerWidth, innerHeight);
  G.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  G.renderer.outputColorSpace = THREE.SRGBColorSpace;

  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x03080d);
  G.scene.fog = new THREE.Fog(0x03080d, 18, 60);

  G.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 400);
  G.clock = new THREE.Clock();

  G.sfx = new Sfx();
  G.sim = new Sim();
  initSettingsUi();

  // внешние камеры
  G.extCameras = [
    { name: 'НОС', offset: new THREE.Vector3(0, 2, -12), target: new THREE.Vector3(0, 0, -30), color: 0x1a2a3a },
    { name: 'КОРМА', offset: new THREE.Vector3(0, 2, 14), target: new THREE.Vector3(0, 0, 30), color: 0x1a2a3a },
    { name: 'БОРТ', offset: new THREE.Vector3(8, 3, 0), target: new THREE.Vector3(0, 0, 0), color: 0x1a2a3a },
  ];
  G.extCameraIdx = 0;
  for (const ec of G.extCameras) {
    ec.cam = new THREE.PerspectiveCamera(60, 4 / 3, 0.5, 200);
    ec.rt = new THREE.WebGLRenderTarget(256, 192);
  }

  buildWorld();

  G.hud = new Hud();
  G.player = new Player(G.camera, canvas);
  buildControls();
  G.hazards = new Hazards();
  G.upgrades = new Upgrades();
  initDev();

  addEventListener('resize', () => {
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    G.flags.started = true;
    G.sfx.init();
    canvas.requestPointerLock?.();
    G.hud.log('⚓ Добро пожаловать на борт «Тифон-9».', 'ok');
    G.hud.log('База «Глубина» рядом (30м к востоку). Мониторы показывают все системы.', '');
    G.hud.log('Начните с запуска реактора (реакторный отсек, кнопки 1→2→3).', '');
  });

  loop();
  } catch(e) { console.error('INIT ERROR:', e); }
}

let elapsed = 0;
let lastFrameMs = 0;
function loop(now = 0) {
  requestAnimationFrame(loop);
  if (now - lastFrameMs < MIN_FRAME_MS) return;
  lastFrameMs = now;
  const dt = Math.min(0.05, G.clock.getDelta());
  elapsed += dt;

  if (G.flags.started && !G.flags.over) {
    G.player.update(dt);
    G.sim.update(dt);
    G.hazards.update(dt, elapsed);
    G.upgrades.update(dt, elapsed);
    G.hud.update(dt);
    updateControls();
    updateDev();
    updateWorld(elapsed, dt);

    // обновление внешних камер
    if (G.extCameras && G.sim) {
      const sim = G.sim;
      const th = sim.heading * Math.PI / 180;
      const boatPos = new THREE.Vector3(sim.boatX, -sim.depth, sim.boatZ);
      for (const ec of G.extCameras) {
        const offset = ec.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), th);
        ec.cam.position.copy(boatPos).add(offset);
        const target = ec.target.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), th).add(boatPos);
        ec.cam.lookAt(target);
      }
      // рендер активной камеры в текстуру
      const active = G.extCameras[G.extCameraIdx];
      G.renderer.setRenderTarget(active.rt);
      G.renderer.render(G.scene, active.cam);
      G.renderer.setRenderTarget(null);
      if (G.hud?.updateCameraFeed) G.hud.updateCameraFeed(active.rt.texture, active.name);
    }

    // туман/окружение: снаружи светло, внутри темно
    if (G.flags.outside) {
      G.scene.background.setHex(0x87bfe8);
      G.scene.fog.color.setHex(0x87bfe8);
      G.scene.fog.near = 60; G.scene.fog.far = 260;
    } else {
      G.scene.background.setHex(0x03080d);
      G.scene.fog.color.setHex(0x03080d);
      G.scene.fog.near = 18; G.scene.fog.far = 60;
    }

    // условия конца
    const lose = G.sim.loseReason();
    if (lose) { G.sfx.explosion(); showEnd(false, lose); }
    else if (G.sim.isWin()) {
      G.sfx.splashUp();
      const missions = G.sim.missions.filter(m => m.completed).length;
      const looted = G.sim.credits;
      showEnd(true, `Субмарина «Тифон-9» всплыла.\nМиссий: ${missions}/${G.sim.missions.length}\nКредитов: ${looted}\nРеактор стабилен, экипаж жив. Командование гордится вами, капитан!`);
    }
  } else if (!G.flags.started) {
    // лёгкое вращение камеры на стартовом экране
    G.camera.position.set(Math.sin(elapsed * 0.1) * 2, 1.7, -6 + Math.cos(elapsed * 0.1));
    G.camera.lookAt(0, 1.4, -9);
  }

  G.renderer.render(G.scene, G.camera);
}

init();
