// ============ CONTROL PANEL UI (levers, toggles, knobs, gauges) ============
const UI = (() => {
  const S = Game.S, A = Game.A;
  const $ = (id) => document.getElementById(id);
  let sonarSweepAngle = 0, sonarSweepActive = 0;

  // ---------- generic widget builders ----------

  // Toggle switch (tumbler)
  function makeToggle(el, onChange, initial = false) {
    el.classList.add('toggle-switch');
    el.innerHTML = `<div class="toggle-track"><div class="toggle-lever"></div></div><div class="toggle-led"></div>`;
    let state = initial;
    const render = () => {
      el.classList.toggle('on', state);
    };
    el.addEventListener('click', () => {
      state = !state;
      render();
      const ok = onChange(state);
      if (ok === false) { state = false; render(); }
    });
    render();
    return { set: (v) => { state = v; render(); }, get: () => state };
  }

  // Vertical lever (-1..1 or 0..1)
  function makeLever(el, onChange, opts = {}) {
    const { min = -1, max = 1, initial = 0, snap = null } = opts;
    el.classList.add('lever');
    el.innerHTML = `<div class="lever-slot"></div><div class="lever-handle"><div class="lever-grip"></div></div>`;
    const handle = el.querySelector('.lever-handle');
    let value = initial;
    const render = () => {
      const pct = (1 - (value - min) / (max - min)) * 78 + 4;
      handle.style.top = pct + '%';
    };
    let dragging = false;
    const setFromY = (clientY) => {
      const r = el.getBoundingClientRect();
      let frac = 1 - THREE.MathUtils.clamp((clientY - r.top) / r.height, 0, 1);
      let v = min + frac * (max - min);
      if (snap) v = snap.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
      if (Math.abs(v - value) > 0.001) {
        value = v; render(); onChange(value);
        if (snap) AudioEngine.leverMove();
      }
    };
    const start = (e) => { dragging = true; AudioEngine.click(); setFromY(e.touches ? e.touches[0].clientY : e.clientY); e.preventDefault(); };
    const move = (e) => { if (dragging) setFromY(e.touches ? e.touches[0].clientY : e.clientY); };
    const end = () => { if (dragging && !snap) AudioEngine.leverMove(); dragging = false; };
    el.addEventListener('mousedown', start); el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
    render();
    return { set: (v) => { value = v; render(); }, get: () => value };
  }

  // Rotary knob 0..1
  function makeKnob(el, onChange, opts = {}) {
    const { initial = 0.5, label = '' } = opts;
    el.classList.add('knob');
    el.innerHTML = `<div class="knob-body"><div class="knob-indicator"></div></div><div class="knob-label">${label}</div>`;
    const body = el.querySelector('.knob-body');
    let value = initial;
    let lastTick = initial;
    const render = () => {
      const deg = -135 + value * 270;
      body.style.transform = `rotate(${deg}deg)`;
    };
    let dragging = false, startY = 0, startV = 0;
    const start = (e) => {
      dragging = true;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      startV = value; e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      value = THREE.MathUtils.clamp(startV + (startY - y) / 150, 0, 1);
      if (Math.abs(value - lastTick) > 0.07) { AudioEngine.knobTick(); lastTick = value; }
      render(); onChange(value);
    };
    const end = () => dragging = false;
    el.addEventListener('mousedown', start); el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
    render();
    return { set: (v) => { value = v; render(); }, get: () => value };
  }

  // Push button
  function makeButton(el, onPress, opts = {}) {
    const { color = 'amber', momentary = true } = opts;
    el.classList.add('push-btn', 'btn-' + color);
    el.addEventListener('click', () => {
      el.classList.add('pressed');
      setTimeout(() => el.classList.remove('pressed'), 160);
      onPress();
    });
  }

  // Horizontal slider 0..1
  function makeSlider(el, onChange, initial = 0.5) {
    el.classList.add('h-slider');
    el.innerHTML = `<div class="h-slider-track"><div class="h-slider-fill"></div><div class="h-slider-thumb"></div></div>`;
    const fill = el.querySelector('.h-slider-fill');
    const thumb = el.querySelector('.h-slider-thumb');
    let value = initial;
    const render = () => {
      fill.style.width = (value * 100) + '%';
      thumb.style.left = (value * 100) + '%';
    };
    let dragging = false;
    const setFromX = (clientX) => {
      const r = el.getBoundingClientRect();
      value = THREE.MathUtils.clamp((clientX - r.left) / r.width, 0, 1);
      render(); onChange(value);
    };
    const start = (e) => { dragging = true; AudioEngine.click(); setFromX(e.touches ? e.touches[0].clientX : e.clientX); e.preventDefault(); };
    el.addEventListener('mousedown', start); el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', (e) => { if (dragging) setFromX(e.touches ? e.touches[0].clientX : e.clientX); });
    window.addEventListener('touchmove', (e) => { if (dragging) setFromX(e.touches[0].clientX); }, { passive: false });
    window.addEventListener('mouseup', () => dragging = false);
    window.addEventListener('touchend', () => dragging = false);
    render();
    return { set: (v) => { value = v; render(); }, get: () => value };
  }

  // ---------- build all controls ----------
  const W = {}; // widget refs

  function buildControls() {
    // MOVEMENT
    W.throttle = makeLever($('lever-throttle'), (v) => A.throttle(Math.round(v)), { min: 0, max: 3, initial: 0, snap: [0, 1, 2, 3] });
    W.leftEng = makeLever($('lever-left'), (v) => A.leftEngine(v), { initial: 0 });
    W.rightEng = makeLever($('lever-right'), (v) => A.rightEngine(v), { initial: 0 });
    W.trim = makeLever($('lever-trim'), (v) => A.trim(v), { initial: 0 });
    W.ballastFill = makeToggle($('valve-fill'), (on) => A.ballastFill(on));
    W.ballastEmpty = makeToggle($('valve-empty'), (on) => A.ballastEmpty(on));
    W.apHead = makeToggle($('ap-heading'), (on) => A.apHeading(on));
    W.apDepth = makeToggle($('ap-depth'), (on) => A.apDepth(on));

    // POWER
    makeButton($('rbtn-1'), () => { if (Game.A.reactorButton(1)) $('rbtn-1').classList.add('lit'); }, { color: 'amber' });
    makeButton($('rbtn-2'), () => { if (Game.A.reactorButton(2)) $('rbtn-2').classList.add('lit'); }, { color: 'amber' });
    makeButton($('rbtn-3'), () => { if (Game.A.reactorButton(3)) { $('rbtn-3').classList.add('lit'); } }, { color: 'green' });
    makeButton($('rbtn-scram'), () => { A.reactorScram(); ['rbtn-1', 'rbtn-2', 'rbtn-3'].forEach(i => $(i).classList.remove('lit')); }, { color: 'red' });
    W.emerg = makeToggle($('sw-emergency'), (on) => A.emergencyPower(on));
    W.batt = makeToggle($('sw-battery'), (on) => A.battery(on));
    W.dEng = makeSlider($('dist-engines'), (v) => A.distSlider('engines', v), S.dist.engines);
    W.dLgt = makeSlider($('dist-lights'), (v) => A.distSlider('lights', v), S.dist.lights);
    W.dSon = makeSlider($('dist-sonar'), (v) => A.distSlider('sonar', v), S.dist.sonar);
    W.dLife = makeSlider($('dist-life'), (v) => A.distSlider('life', v), S.dist.life);
    makeButton($('btn-fuse'), () => A.replaceFuse(), { color: 'amber' });

    // LIGHTS
    W.lF = makeToggle($('lt-front'), (on) => A.light('front', on));
    W.lL = makeToggle($('lt-left'), (on) => A.light('left', on));
    W.lR = makeToggle($('lt-right'), (on) => A.light('right', on));
    W.lB = makeToggle($('lt-bottom'), (on) => A.light('bottom', on));
    W.lRed = makeToggle($('lt-red'), (on) => A.redAlert(on));

    // SONAR
    makeButton($('btn-ping'), () => A.sonarPing(), { color: 'green' });
    W.passive = makeToggle($('sw-passive'), (on) => A.sonarPassive(on));
    W.kGain = makeKnob($('knob-gain'), (v) => A.sonarGain(v), { initial: 0.5, label: 'GAIN' });
    W.kFreq = makeKnob($('knob-freq'), (v) => A.sonarFreq(v), { initial: 0.5, label: 'FREQ' });
    W.kFilt = makeKnob($('knob-filter'), (v) => A.sonarFilter(v), { initial: 0.3, label: 'FILTER' });
    W.kDir = makeKnob($('knob-dir'), (v) => A.sonarDir(v), { initial: 0.5, label: 'BEARING' });
    makeButton($('btn-scan'), () => A.scanRuins(), { color: 'cyan' });

    // LIFE SUPPORT
    W.vent = makeToggle($('ls-vent'), (on) => A.lifeSys('vent', on));
    W.scrub = makeToggle($('ls-scrub'), (on) => A.lifeSys('airScrub', on));
    W.wfilter = makeToggle($('ls-water'), (on) => A.lifeSys('waterFilter', on));
    W.pumps = makeToggle($('ls-pumps'), (on) => A.lifeSys('pumps', on));

    // WEAPONS
    document.querySelectorAll('.torp-select').forEach((b, i) => {
      b.addEventListener('click', () => {
        A.selectTorpedo(i);
        document.querySelectorAll('.torp-select').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
      });
    });
    makeButton($('btn-load'), () => A.loadTorpedo(), { color: 'amber' });
    W.tube = makeToggle($('sw-tube'), (on) => A.openTube(on));
    makeButton($('btn-fire'), () => A.fire(), { color: 'red' });
    makeButton($('btn-decoy'), () => A.decoy(), { color: 'cyan' });
    makeButton($('btn-noise'), () => A.noisemaker(), { color: 'cyan' });

    // EXPLORATION
    W.drone = makeToggle($('sw-drone'), (on) => A.drone(on));
    W.robot = makeToggle($('sw-robot'), (on) => A.robot(on));
    W.arm = makeToggle($('sw-arm'), (on) => A.arm(on));
    makeButton($('btn-grab'), () => A.grab(), { color: 'green' });

    // EMERGENCY
    makeButton($('btn-extinguish'), () => A.extinguish(), { color: 'red' });
    W.bulk = makeToggle($('sw-bulkheads'), (on) => A.sealBulkheads(on));
  }

  // ---------- gauges & displays update ----------
  function setNeedle(id, frac) {
    const el = $(id);
    if (el) el.style.transform = `rotate(${-120 + THREE.MathUtils.clamp(frac, 0, 1) * 240}deg)`;
  }
  function setBar(id, frac, danger = 0.25, invert = false) {
    const el = $(id);
    if (!el) return;
    const f = THREE.MathUtils.clamp(frac, 0, 1);
    el.style.width = (f * 100) + '%';
    const isDanger = invert ? f > 1 - danger : f < danger;
    el.classList.toggle('bar-danger', isDanger);
  }
  function setLamp(id, on, blink = false) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('lit', on);
    el.classList.toggle('blink', blink);
  }

  function update(dt) {
    const t = Game.S.time;
    const jitter = () => (Math.random() - 0.5) * 0.015;

    // gauges with trembling needles
    setNeedle('gauge-depth', S.depth / 240 + jitter());
    setNeedle('gauge-speed', S.actualSpeed / 16 + jitter());
    setNeedle('gauge-temp', S.reactorTemp / 120 + jitter());
    setNeedle('gauge-pressure', (S.depth / 240) * 0.9 + 0.05 + jitter());

    $('digi-depth').textContent = Math.round(S.depth) + ' м';
    $('digi-speed').textContent = S.actualSpeed.toFixed(1) + ' уз';
    $('digi-heading').textContent = String(Math.round(S.heading)).padStart(3, '0') + '°';
    $('digi-temp').textContent = Math.round(S.reactorTemp) + '°C';

    // compass
    $('compass-disc').style.transform = `rotate(${-S.heading}deg)`;

    // bars
    setBar('bar-fuel', S.fuel / 100);
    setBar('bar-battery', S.battery / 100);
    setBar('bar-o2', S.o2 / 100);
    setBar('bar-co2', S.co2 / 100, 0.7, true);
    setBar('bar-hull', S.hullIntegrity / 100);
    setBar('bar-ballast', S.ballast, 2);
    setBar('bar-humidity', S.humidity / 100, 0.85, true);
    setBar('bar-flood', (S._floodLevel || 0) / 100, 0.5, true);

    // power summary
    const avail = Game.totalPowerAvail();
    $('power-total').textContent = Math.round(avail * 100) + '%';
    $('power-total').className = avail < 0.3 ? 'val danger' : 'val';

    // lamps
    setLamp('lamp-reactor', S.reactorOn, S.overheat);
    setLamp('lamp-fire', S.fire, true);
    setLamp('lamp-leak', S.leak, true);
    setLamp('lamp-short', S.shortCircuit, true);
    setLamp('lamp-overheat', S.overheat, true);
    setLamp('lamp-creature', S.creatureDist > 0.5, S.creatureDist > 0.75);
    setLamp('lamp-ap', S.apHeading || S.apDepth);
    setLamp('lamp-loaded', S.torpedoLoaded);
    setLamp('lamp-tube', S.tubeOpen);
    // random flicker lamps for atmosphere
    setLamp('lamp-aux1', Math.sin(t * 2.7) > -0.3);
    setLamp('lamp-aux2', Math.sin(t * 1.3 + 2) > 0.2);
    setLamp('lamp-aux3', S.reactorOn && Math.sin(t * 5.1) > -0.7);

    // counters
    $('cnt-torp').textContent = S.torpedoCount;
    $('cnt-decoy').textContent = S.decoyCount;
    $('cnt-noise').textContent = S.noisemakers;
    $('cnt-cargo').textContent = S.cargo.length + '/' + S.cargoMax;
    $('cnt-ruins').textContent = S.ruinsScanned + '/5';
    $('cnt-artifacts').textContent = S.artifacts + '/3';
    $('cnt-ext').textContent = S.extinguisherCharges;

    // mission objective tracker
    $('obj-scan').classList.toggle('done', S.ruinsScanned >= 5);
    $('obj-art').classList.toggle('done', S.artifacts >= 3);

    // red alert overlay
    document.body.classList.toggle('red-alert', S.redAlert);

    // sonar display
    drawSonar(dt);

    // reactor stage indicator
    for (let i = 1; i <= 3; i++) {
      $('rstage-' + i).classList.toggle('lit', S.reactorStage >= i || S.reactorOn);
    }
    if (!S.reactorOn && S.reactorStage === 0) {
      ['rbtn-1', 'rbtn-2', 'rbtn-3'].forEach(i => $(i).classList.remove('lit'));
    }
  }

  // ---------- sonar canvas ----------
  let sonarCtx = null;
  function drawSonar(dt) {
    const cv = $('sonar-canvas');
    if (!cv) return;
    if (!sonarCtx) { sonarCtx = cv.getContext('2d'); }
    const ctx = sonarCtx;
    const w = cv.width, h = cv.height, cx = w / 2, cy = h / 2, R = w / 2 - 6;
    ctx.fillStyle = 'rgba(2,12,8,0.25)';
    ctx.fillRect(0, 0, w, h);
    // rings
    ctx.strokeStyle = 'rgba(40,255,120,0.25)';
    ctx.lineWidth = 1;
    for (let r = R / 3; r <= R; r += R / 3) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

    // sweep
    if (sonarSweepActive > 0) {
      sonarSweepAngle += dt * 240;
      sonarSweepActive -= dt;
      const a = sonarSweepAngle * Math.PI / 180;
      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      grad.addColorStop(0, 'rgba(40,255,120,0)');
      grad.addColorStop(1, 'rgba(40,255,120,0.7)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
    }

    // passive noise
    if (S.sonarPassive) {
      ctx.fillStyle = 'rgba(40,255,120,0.18)';
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * R;
        ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5, 1.5);
      }
    }

    // contacts
    const gain = 0.4 + S.sonarGain * 0.8;
    for (const c of S.contacts) {
      const a = (c.ang - S.heading) * Math.PI / 180 - Math.PI / 2;
      const r = c.dist * R;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (c.type === 'creature') {
        ctx.fillStyle = `rgba(255,60,40,${0.8 * gain})`;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,60,40,0.4)';
        ctx.beginPath(); ctx.arc(x, y, 9 + Math.sin(S.time * 6) * 3, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(80,255,150,${0.65 * gain})`;
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      }
    }

    // bearing indicator from knob
    const ba = (S.sonarDir - 0.5) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = 'rgba(255,220,80,0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ba) * R, cy + Math.sin(ba) * R); ctx.stroke();
    ctx.setLineDash([]);
  }

  function sonarSweep() { sonarSweepActive = 1.6; sonarSweepAngle = 0; }

  // ---------- log ----------
  function refreshLog() {
    const el = $('mission-log');
    if (!el) return;
    el.innerHTML = S.missionLog.slice(0, 14).map(e => {
      const m = Math.floor(e.t / 60), s = Math.floor(e.t % 60);
      return `<div class="log-line"><span class="log-time">${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</span> ${e.msg}</div>`;
    }).join('');
  }

  function flashAlert() {
    const el = $('alert-flash');
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 900);
  }

  function shake() {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 600);
  }

  function showEnd(win, reason = '') {
    const el = $('end-screen');
    el.classList.add('visible');
    $('end-title').textContent = win ? '🏆 МИССИЯ ВЫПОЛНЕНА' : '☠ СУБМАРИНА ПОТЕРЯНА';
    $('end-title').className = win ? 'win' : 'lose';
    $('end-text').textContent = win
      ? `Вы просканировали руины и подняли ${S.artifacts} артефакта. «Тифон-9» возвращается на базу. Океан хранит свои тайны... пока.`
      : reason + ' Глубина: ' + Math.round(S.depth) + 'м. Время миссии: ' + Math.floor(S.time / 60) + ' мин.';
    AudioEngine.setEngine(0);
  }

  return { buildControls, update, refreshLog, sonarSweep, flashAlert, shake, showEnd };
})();
window.UI = UI;
