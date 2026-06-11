// ============ SUBMARINE AUDIO ENGINE (procedural Web Audio) ============
const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null, engineLFO = null, engineLFOGain = null;
  let ambientNoise = null, ambientGain = null, ambientFilter = null;
  let alarmInterval = null;
  let started = false;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer(seconds = 2) {
    const c = ensure();
    const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---- ambient submarine hum + water pressure drone ----
  function startAmbient() {
    if (started) return;
    started = true;
    const c = ensure();
    // low drone
    const drone = c.createOscillator();
    drone.type = 'sine'; drone.frequency.value = 48;
    const droneG = c.createGain(); droneG.gain.value = 0.05;
    drone.connect(droneG); droneG.connect(master); drone.start();
    const drone2 = c.createOscillator();
    drone2.type = 'sine'; drone2.frequency.value = 51.3;
    drone2.connect(droneG); drone2.start();
    // filtered noise = water
    ambientNoise = c.createBufferSource();
    ambientNoise.buffer = noiseBuffer(4); ambientNoise.loop = true;
    ambientFilter = c.createBiquadFilter();
    ambientFilter.type = 'lowpass'; ambientFilter.frequency.value = 220; ambientFilter.Q.value = 0.5;
    ambientGain = c.createGain(); ambientGain.gain.value = 0.035;
    ambientNoise.connect(ambientFilter); ambientFilter.connect(ambientGain); ambientGain.connect(master);
    ambientNoise.start();
    // random metal creaks
    scheduleCreak();
  }

  function scheduleCreak() {
    setTimeout(() => { creak(); scheduleCreak(); }, 8000 + Math.random() * 20000);
  }

  function creak(intensity = 0.5) {
    if (!ctx) return;
    const c = ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f0 = 80 + Math.random() * 200;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (0.5 + Math.random()), t + 1.2);
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = f0 * 2; flt.Q.value = 8;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07 * intensity, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(flt); flt.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1.5);
  }

  // ---- engine loop, intensity 0..1 ----
  function setEngine(power) {
    const c = ensure();
    if (!engineOsc) {
      engineOsc = c.createOscillator(); engineOsc.type = 'sawtooth';
      const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 140;
      engineGain = c.createGain(); engineGain.gain.value = 0;
      engineLFO = c.createOscillator(); engineLFO.frequency.value = 8;
      engineLFOGain = c.createGain(); engineLFOGain.gain.value = 0.015;
      engineLFO.connect(engineLFOGain); engineLFOGain.connect(engineGain.gain);
      engineOsc.connect(flt); flt.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineLFO.start();
    }
    const t = c.currentTime;
    engineOsc.frequency.linearRampToValueAtTime(30 + power * 60, t + 0.8);
    engineLFO.frequency.linearRampToValueAtTime(4 + power * 14, t + 0.8);
    engineGain.gain.linearRampToValueAtTime(power * 0.10, t + 0.8);
  }

  // ---- one-shots ----
  function click() { blip(1800, 0.03, 0.12, 'square'); }
  function clack() { blip(900, 0.05, 0.18, 'square'); blip(300, 0.08, 0.1, 'triangle'); }
  function leverMove() { sweep(220, 420, 0.12, 0.08); }
  function knobTick() { blip(2400, 0.015, 0.07, 'square'); }
  function valveTurn() { sweep(150, 90, 0.3, 0.1, 'sawtooth'); }
  function bigSwitch() { blip(120, 0.18, 0.35, 'square'); blip(600, 0.04, 0.2, 'square'); }
  function deny() { blip(180, 0.2, 0.25, 'sawtooth'); }

  function blip(freq, dur, vol, type = 'sine') {
    const c = ensure(); const t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  function sweep(f0, f1, dur, vol, type = 'sine') {
    const c = ensure(); const t = c.currentTime;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  // ---- sonar ping with echo ----
  function sonarPing(freq = 1200) {
    const c = ensure(); const t = c.currentTime;
    const mk = (dt, vol) => {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(freq, t + dt);
      o.frequency.exponentialRampToValueAtTime(freq * 0.92, t + dt + 0.5);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(vol, t + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.9);
      o.connect(g); g.connect(master); o.start(t + dt); o.stop(t + dt + 1);
    };
    mk(0, 0.22); mk(0.9, 0.07); mk(1.7, 0.025);
  }

  function sonarContact() { blip(700, 0.4, 0.12); setTimeout(() => blip(700, 0.3, 0.08), 200); }

  // ---- alarm ----
  function setAlarm(on) {
    if (on && !alarmInterval) {
      const fire = () => { sweep(520, 780, 0.45, 0.10, 'square'); setTimeout(() => sweep(780, 520, 0.45, 0.10, 'square'), 480); };
      fire();
      alarmInterval = setInterval(fire, 1100);
    } else if (!on && alarmInterval) {
      clearInterval(alarmInterval); alarmInterval = null;
    }
  }

  // ---- creature roar (scary low growl) ----
  function creatureRoar(closeness = 0.5) {
    const c = ensure(); const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(38, t);
    o.frequency.linearRampToValueAtTime(55, t + 1.2);
    o.frequency.linearRampToValueAtTime(30, t + 3);
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 41;
    const flt = c.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(200, t);
    flt.frequency.linearRampToValueAtTime(500, t + 1);
    flt.frequency.linearRampToValueAtTime(120, t + 3);
    const g = c.createGain();
    const v = 0.12 + closeness * 0.22;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    o.connect(flt); o2.connect(flt); flt.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + 3.3); o2.stop(t + 3.3);
    creak(1);
  }

  // ---- explosion / impact ----
  function explosion(vol = 0.5) {
    const c = ensure(); const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(1.5);
    const flt = c.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(900, t);
    flt.frequency.exponentialRampToValueAtTime(60, t + 1.2);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + 1.5);
    blip(45, 1.2, vol * 0.8, 'sine');
  }

  function torpedoLaunch() {
    const c = ensure(); const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(2);
    const flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 1.5;
    flt.frequency.setValueAtTime(300, t);
    flt.frequency.exponentialRampToValueAtTime(1800, t + 0.6);
    flt.frequency.exponentialRampToValueAtTime(200, t + 1.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + 2);
  }

  function bubbles() {
    const c = ensure();
    for (let i = 0; i < 14; i++) {
      setTimeout(() => blip(400 + Math.random() * 900, 0.06, 0.05), i * 90 + Math.random() * 60);
    }
  }

  function reactorStartup() {
    sweep(60, 220, 2.5, 0.12, 'sawtooth');
    setTimeout(() => blip(880, 0.5, 0.1), 2300);
  }

  function electricZap() {
    const c = ensure(); const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(0.4);
    const flt = c.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 2500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.4);
  }

  function fireCrackle(on) {
    // short crackle burst, called periodically while fire active
    if (!ctx) return;
    const c = ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(0.8);
    const flt = c.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1500; flt.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.8);
  }

  function passiveStatic(level) {
    // returns nothing; quick hiss burst for passive sonar
    if (!ctx) return;
    const c = ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(0.3);
    const g = c.createGain(); g.gain.value = 0.02 + level * 0.04;
    const flt = c.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 1000;
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.3);
  }

  return {
    ensure, startAmbient, setEngine, click, clack, leverMove, knobTick, valveTurn,
    bigSwitch, deny, sonarPing, sonarContact, setAlarm, creatureRoar, explosion,
    torpedoLaunch, bubbles, reactorStartup, electricZap, fireCrackle, creak, passiveStatic, blip, sweep
  };
})();
window.AudioEngine = AudioEngine;
