// ============ ТОЧКА ВХОДА ============
import * as THREE from 'three';
import { G } from './state.js';
import { buildWorld, updateWorld } from './world.js';
import { Player } from './player.js';
import { Sim } from './sim.js';
import { buildControls } from './controls.js';
import { Hazards } from './hazards.js';
import { Upgrades } from './upgrades.js';
import { Hud, showEnd } from './hud.js';
import { Sfx } from './audio.js';

function init() {
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
  G.hud = new Hud();

  buildWorld();

  G.player = new Player(G.camera, canvas);
  buildControls();
  G.hazards = new Hazards();
  G.upgrades = new Upgrades();

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
    G.hud.log('⚓ Добро пожаловать на борт «Тифон-9». Идите в реакторный отсек (корма).', 'ok');
    G.hud.log('Подсказка: смотрите на объекты — появится подсказка действия.', '');
  });

  loop();
}

let elapsed = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, G.clock.getDelta());
  elapsed += dt;

  if (G.flags.started && !G.flags.over) {
    G.player.update(dt);
    G.sim.update(dt);
    G.hazards.update(dt, elapsed);
    G.upgrades.update(dt, elapsed);
    G.hud.update(dt);
    updateWorld(elapsed);

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
      showEnd(true, 'Субмарина «Тифон-9» всплыла. Реактор стабилен, все улучшения установлены, экипаж жив. Командование гордится вами, капитан!');
    }
  } else if (!G.flags.started) {
    // лёгкое вращение камеры на стартовом экране
    G.camera.position.set(Math.sin(elapsed * 0.1) * 2, 1.7, -6 + Math.cos(elapsed * 0.1));
    G.camera.lookAt(0, 1.4, -9);
  }

  G.renderer.render(G.scene, G.camera);
}

init();
