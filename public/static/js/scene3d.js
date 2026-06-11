// ============ 3D OCEAN SCENE (Three.js) ============
const Scene3D = (() => {
  let scene, camera, renderer, clock;
  let spotF, spotL, spotR, spotB; // searchlights
  let cityGroup, particles, seabed, creature, drone3d, torpedoes = [];
  let cityWindows = []; // flickering windows
  let fogColor = new THREE.Color(0x010608);
  let redTint = 0;
  let initialized = false;

  const WORLD = { citySpread: 900 };

  function init(canvas) {
    if (initialized) return;
    initialized = true;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(fogColor, 0.012);
    scene.background = fogColor.clone();

    camera = new THREE.PerspectiveCamera(68, canvas.clientWidth / canvas.clientHeight, 0.1, 1200);
    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    clock = new THREE.Clock();

    // ambient deep glow
    const amb = new THREE.AmbientLight(0x0a1a24, 0.55);
    scene.add(amb);
    const moon = new THREE.DirectionalLight(0x123040, 0.25);
    moon.position.set(0, 1, 0);
    scene.add(moon);

    buildSearchlights();
    buildSeabed();
    buildCity();
    buildParticles();
    buildCreature();

    window.addEventListener('resize', onResize);
    onResize();
  }

  function onResize() {
    const canvas = renderer.domElement;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function buildSearchlights() {
    const mk = (color, angle) => {
      const s = new THREE.SpotLight(color, 0, 320, angle, 0.45, 1.2);
      s.position.set(0, 0, 0);
      const target = new THREE.Object3D();
      scene.add(target);
      s.target = target;
      scene.add(s);
      return s;
    };
    spotF = mk(0xcfe8ff, 0.42);
    spotL = mk(0xbcdcff, 0.36);
    spotR = mk(0xbcdcff, 0.36);
    spotB = mk(0xa8d4ff, 0.55);
    spotF.target.position.set(0, 0, -100);
    spotL.target.position.set(-80, 0, -60);
    spotR.target.position.set(80, 0, -60);
    spotB.target.position.set(0, -100, -30);
  }

  function buildSeabed() {
    const geo = new THREE.PlaneGeometry(2400, 2400, 64, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.01) * 6 + Math.cos(y * 0.013) * 7 + Math.sin(x * 0.05 + y * 0.04) * 2);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a2a26, roughness: 0.95, metalness: 0.05 });
    seabed = new THREE.Mesh(geo, mat);
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.y = -120;
    scene.add(seabed);
  }

  function buildCity() {
    cityGroup = new THREE.Group();
    const rng = mulberry32(1337);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x223138, roughness: 0.85, metalness: 0.25 });
    const ruinMat = new THREE.MeshStandardMaterial({ color: 0x2a3330, roughness: 0.9, metalness: 0.15 });

    for (let i = 0; i < 70; i++) {
      const w = 8 + rng() * 22, d = 8 + rng() * 22, h = 25 + rng() * 110;
      const geo = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(geo, rng() > 0.5 ? buildingMat : ruinMat);
      const ang = rng() * Math.PI * 2;
      const dist = 90 + rng() * WORLD.citySpread;
      m.position.set(Math.cos(ang) * dist, -120 + h / 2 - rng() * 18, -Math.abs(Math.sin(ang)) * dist - 60);
      m.rotation.y = rng() * Math.PI;
      m.rotation.z = (rng() - 0.5) * 0.25; // tilted ruins
      cityGroup.add(m);

      // glowing windows on some buildings — the creepy lit windows
      if (rng() > 0.45) {
        const winCount = 2 + Math.floor(rng() * 6);
        for (let j = 0; j < winCount; j++) {
          const winGeo = new THREE.PlaneGeometry(1.6, 2.2);
          const hue = rng() > 0.8 ? 0x66ff99 : 0xffcc66;
          const winMat = new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.0 });
          const win = new THREE.Mesh(winGeo, winMat);
          win.position.set(
            m.position.x + (rng() - 0.5) * w,
            m.position.y + (rng() - 0.5) * h * 0.8,
            m.position.z + d / 2 + 0.3
          );
          cityGroup.add(win);
          cityWindows.push({ mesh: win, phase: rng() * 100, speed: 0.3 + rng() * 1.5, max: 0.35 + rng() * 0.5 });
        }
      }
    }

    // sunken monument arcs
    for (let i = 0; i < 8; i++) {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(14 + rng() * 10, 1.4, 8, 24, Math.PI * (0.6 + rng() * 0.5)),
        ruinMat
      );
      const ang = rng() * Math.PI * 2;
      const dist = 120 + rng() * 500;
      torus.position.set(Math.cos(ang) * dist, -116, -Math.abs(Math.sin(ang)) * dist - 80);
      torus.rotation.z = rng() * Math.PI;
      cityGroup.add(torus);
    }
    scene.add(cityGroup);
  }

  function buildParticles() {
    const count = 900;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 220;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x7fb8cc, size: 0.35, transparent: true, opacity: 0.55, sizeAttenuation: true });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
  }

  function buildCreature() {
    creature = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0c1416, roughness: 0.6, metalness: 0.1, emissive: 0x031015, emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(4, 26, 6, 12), bodyMat);
    body.rotation.z = Math.PI / 2;
    creature.add(body);
    // glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), eyeMat);
    const e2 = e1.clone();
    e1.position.set(-15, 1.6, 2.2); e2.position.set(-15, 1.6, -2.2);
    creature.add(e1, e2);
    // tail fins
    const finMat = new THREE.MeshStandardMaterial({ color: 0x0a1214, roughness: 0.7, side: THREE.DoubleSide });
    const fin = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 4), finMat);
    fin.position.set(17, 0, 0); fin.rotation.z = -Math.PI / 2;
    creature.add(fin);
    creature.position.set(300, -40, -400);
    creature.visible = true;
    scene.add(creature);
  }

  function spawnTorpedo(headingRad) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0x889090, metalness: 0.8, roughness: 0.3 })
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const glow = new THREE.PointLight(0xffaa44, 2, 30);
    glow.position.z = 3;
    g.add(glow);
    g.position.set(0, -2, -4);
    const dir = new THREE.Vector3(Math.sin(headingRad), 0, -Math.cos(headingRad)).normalize();
    g.lookAt(g.position.clone().add(dir));
    scene.add(g);
    torpedoes.push({ mesh: g, dir, life: 6, speed: 55 });
  }

  function explosionAt(pos) {
    const flash = new THREE.PointLight(0xffcc66, 30, 200);
    flash.position.copy(pos);
    scene.add(flash);
    let t = 0;
    const iv = setInterval(() => {
      t += 0.05;
      flash.intensity = Math.max(0, 30 * (1 - t * 1.6));
      if (t > 0.7) { scene.remove(flash); clearInterval(iv); }
    }, 50);
  }

  function deployDrone() {
    if (drone3d) scene.remove(drone3d.mesh);
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xccaa33, metalness: 0.6, roughness: 0.4 }));
    g.add(hull);
    const lamp = new THREE.PointLight(0xfff2cc, 3, 50);
    g.add(lamp);
    g.position.set(2, -3, -6);
    scene.add(g);
    drone3d = { mesh: g, t: 0 };
  }

  function recallDrone() {
    if (drone3d) { scene.remove(drone3d.mesh); drone3d = null; }
  }

  // state pulled from game each frame
  function update(gs, dt) {
    if (!initialized) return;
    const t = clock.getElapsedTime();

    // camera = submarine viewport. heading rotates world view
    const heading = gs.headingRad;
    camera.rotation.set(gs.pitch * 0.6, -heading, Math.sin(t * 0.4) * 0.006 + gs.roll);
    // depth → world y shift simulated by moving city/seabed relative... simpler: move camera y
    camera.position.y = THREE.MathUtils.clamp(-((gs.depth - 60) * 0.55), -118, 60);
    // forward movement: move world toward camera
    const spd = gs.actualSpeed;
    const dx = Math.sin(heading) * spd * dt * 2.2;
    const dz = -Math.cos(heading) * spd * dt * 2.2;
    cityGroup.position.x -= dx; cityGroup.position.z -= dz;
    seabed.position.x -= dx; seabed.position.z -= dz;
    creature.position.x -= dx; creature.position.z -= dz;

    // wrap city if too far
    if (Math.abs(cityGroup.position.x) > 600 || Math.abs(cityGroup.position.z) > 600) {
      cityGroup.position.set(0, 0, 0);
      seabed.position.x = 0; seabed.position.z = 0;
    }

    // lights driven by panel
    const lp = gs.lightPower; // 0..1 effective power to lights
    spotF.intensity = gs.lights.front ? 950 * lp : 0;
    spotL.intensity = gs.lights.left ? 600 * lp : 0;
    spotR.intensity = gs.lights.right ? 600 * lp : 0;
    spotB.intensity = gs.lights.bottom ? 750 * lp : 0;

    // red alert tint
    const targetRed = gs.redAlert ? 1 : 0;
    redTint += (targetRed - redTint) * dt * 3;
    const fc = new THREE.Color(0x010608).lerp(new THREE.Color(0x180202), redTint);
    scene.fog.color.copy(fc);
    scene.background.copy(fc);
    [spotF, spotL, spotR, spotB].forEach(s => {
      s.color.setHex(redTint > 0.5 ? 0xff5544 : 0xcfe8ff);
    });

    // particles drift
    particles.rotation.y = t * 0.012;
    const pp = particles.geometry.attributes.position;
    particles.position.y = Math.sin(t * 0.3) * 1.5;

    // flickering city windows
    for (const w of cityWindows) {
      const v = Math.sin(t * w.speed + w.phase);
      w.mesh.material.opacity = v > 0 ? v * w.max : 0;
    }

    // creature behaviour
    if (creature) {
      const cd = gs.creatureDist; // 0..1, 0 = far
      const orbitR = 420 - cd * 360;
      const ca = t * (0.05 + cd * 0.18);
      creature.position.x += ((Math.cos(ca) * orbitR) - creature.position.x) * dt * 0.4;
      creature.position.z += ((-180 - Math.abs(Math.sin(ca)) * orbitR * 0.7) - creature.position.z) * dt * 0.4;
      creature.position.y = camera.position.y - 10 + Math.sin(t * 0.5) * 14;
      creature.lookAt(camera.position);
      creature.rotation.y += Math.PI / 2;
      const wag = Math.sin(t * 3) * 0.15;
      creature.rotation.z = wag;
    }

    // torpedoes
    for (let i = torpedoes.length - 1; i >= 0; i--) {
      const tp = torpedoes[i];
      tp.life -= dt;
      tp.mesh.position.addScaledVector(tp.dir, tp.speed * dt);
      // hit creature?
      if (creature && tp.mesh.position.distanceTo(creature.position) < 28) {
        explosionAt(tp.mesh.position);
        scene.remove(tp.mesh);
        torpedoes.splice(i, 1);
        if (window.Game) window.Game.onTorpedoHit();
        continue;
      }
      if (tp.life <= 0) {
        explosionAt(tp.mesh.position);
        scene.remove(tp.mesh);
        torpedoes.splice(i, 1);
        if (window.AudioEngine) AudioEngine.explosion(0.25);
      }
    }

    // drone orbit
    if (drone3d) {
      drone3d.t += dt;
      const dr = 14 + Math.sin(drone3d.t * 0.4) * 6;
      drone3d.mesh.position.set(
        Math.cos(drone3d.t * 0.8) * dr,
        camera.position.y * 0 + -4 + Math.sin(drone3d.t * 1.3) * 3,
        -10 - Math.abs(Math.sin(drone3d.t * 0.5)) * 25
      );
    }

    // darkness based on power: dim ambient if blackout
    scene.children.forEach(c => {
      if (c.isAmbientLight) c.intensity = 0.25 + gs.ambientGlow * 0.5;
    });

    renderer.render(scene, camera);
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  return { init, update, spawnTorpedo, deployDrone, recallDrone, get creature() { return creature; }, get camera() { return camera; } };
})();
window.Scene3D = Scene3D;
