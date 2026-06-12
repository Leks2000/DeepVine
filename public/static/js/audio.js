// ============ WebAudio SFX (синтез, без файлов) ============
export class Sfx {
  constructor() {
    this.ctx = null;
    this.fireNodes = new Map();
    this.engine = null;     // узлы гула двигателя
    this.reactor = null;    // узлы гула реактора
    this.waterNode = null;  // шум воды при течах
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    // фоновый тихий гул субмарины (вентиляция)
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 57;
    const g = this.ctx.createGain(); g.gain.value = 0.012;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o.start(); o2.start();

    this._buildEngine();
    this._buildReactor();
    this._buildWater();
  }

  // ---------- ДВИГАТЕЛЬ: постоянный луп, управляемый rpm ----------
  _buildEngine() {
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 30;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 60;
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 8;
    const lfoG = c.createGain(); lfoG.gain.value = 0;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = c.createGain(); g.gain.value = 0;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this.engine = { o1, o2, lfo, lfoG, f, g };
  }

  // вызывается каждый кадр: rpm 0..1
  setEngine(rpm, state) {
    if (!this.engine) return;
    const e = this.engine, t = this.ctx.currentTime;
    const vol = rpm > 0.01 ? 0.02 + rpm * 0.075 : 0;
    e.g.gain.setTargetAtTime(vol, t, 0.15);
    e.o1.frequency.setTargetAtTime(28 + rpm * 50, t, 0.2);
    e.o2.frequency.setTargetAtTime(56 + rpm * 100, t, 0.2);
    e.lfo.frequency.setTargetAtTime(4 + rpm * 14, t, 0.2);
    e.lfoG.gain.setTargetAtTime(vol * 0.5, t, 0.2);
    e.f.frequency.setTargetAtTime(180 + rpm * 500, t, 0.2);
  }

  // ---------- РЕАКТОР: глубокий электрический гул ----------
  _buildReactor() {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 50;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 100.5;
    const g = c.createGain(); g.gain.value = 0;
    o.connect(g); o2.connect(g); g.connect(this.master);
    o.start(); o2.start();
    this.reactor = { o, o2, g };
  }

  setReactor(level) { // 0..1
    if (!this.reactor) return;
    const t = this.ctx.currentTime;
    this.reactor.g.gain.setTargetAtTime(level > 0 ? 0.008 + level * 0.02 : 0, t, 0.4);
    this.reactor.o2.frequency.setTargetAtTime(100 + level * 35, t, 0.4);
  }

  // ---------- ВОДА: шум при наличии течей ----------
  _buildWater() {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this.waterNode = { g };
  }

  setWater(level) { // 0..1
    if (!this.waterNode) return;
    this.waterNode.g.gain.setTargetAtTime(level * 0.06, this.ctx.currentTime, 0.3);
  }

  _env(freq, type, dur, vol = 0.2, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _noise(dur, vol = 0.15, filterFreq = 1200) {
    if (!this.ctx) return null;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    return { src, gain: g, filter: f };
  }

  click()       { this._env(900, 'square', 0.06, 0.12); }
  buttonOk()    { this._env(620, 'sine', 0.15, 0.2, 880); }
  buttonErr()   { this._env(220, 'square', 0.25, 0.18, 110); }
  leverCreak()  { this._env(160, 'sawtooth', 0.12, 0.06, 90); }
  valveTick()   { this._env(1400, 'square', 0.03, 0.05); }
  breakerOn()   { this._env(120, 'square', 0.18, 0.3, 80); this._noise(0.12, 0.18, 4000); }
  breakerOff()  { this._env(90, 'square', 0.25, 0.25, 50); }

  // запуск двигателя: стартер крутит
  engineCrank() {
    if (!this.ctx) return;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => { this._env(70 + i * 14, 'sawtooth', 0.3, 0.16, 60 + i * 16); this._noise(0.15, 0.1, 600); }, i * 380);
    }
  }
  engineOnline() { this._env(392, 'sine', 0.12, 0.2); setTimeout(() => this._env(587, 'sine', 0.3, 0.22), 130); }
  engineDieOff() { this._env(110, 'sawtooth', 1.6, 0.18, 28); this._noise(0.8, 0.1, 300); }

  hullCreak(intensity = 0.5) {
    this._env(90 + Math.random() * 60, 'sawtooth', 0.9 + Math.random(), 0.04 + intensity * 0.08, 40 + Math.random() * 30);
  }

  klaxon() {
    this._env(310, 'sawtooth', 0.55, 0.3, 290);
    setTimeout(() => this._env(260, 'sawtooth', 0.7, 0.3, 240), 600);
  }
  alarm()       { this._env(880, 'square', 0.4, 0.12, 660); }
  warnBeep()    { this._env(1100, 'sine', 0.1, 0.1); }
  splashUp()    { this._noise(1.2, 0.25, 500); }
  explosion()   { this._noise(0.8, 0.4, 200); this._env(60, 'sine', 0.8, 0.4, 30); }
  torpedoLaunch() { this._noise(1.0, 0.3, 700); this._env(140, 'sawtooth', 0.9, 0.2, 60); }
  extinguish()  { this._noise(0.3, 0.18, 3000); }
  wrench()      { this._env(1800, 'square', 0.05, 0.08); this._env(700, 'triangle', 0.1, 0.06); }
  weld()        { this._noise(0.2, 0.12, 5000); this._env(2400, 'square', 0.06, 0.05); }
  craftDone()   { this._env(523, 'sine', 0.12, 0.2); setTimeout(() => this._env(784, 'sine', 0.25, 0.2), 130); }
  install()     { this._env(392, 'sine', 0.1, 0.2); setTimeout(() => this._env(523, 'sine', 0.1, 0.2), 110); setTimeout(() => this._env(659, 'sine', 0.3, 0.22), 220); }
  pickup()      { this._env(500, 'triangle', 0.08, 0.15, 700); }
  drop()        { this._env(300, 'triangle', 0.1, 0.12, 200); }
  doorOpen()    { this._env(180, 'sawtooth', 0.5, 0.1, 90); this._noise(0.4, 0.08, 900); }
  airlock()     { this._noise(1.5, 0.2, 800); this._env(90, 'sine', 1.4, 0.15, 60); }
  blow()        { this._noise(2.0, 0.3, 600); }
  sparkCrackle() { this._noise(0.08, 0.1, 6000); }

  // зацикленный шум пожара
  fireLoopStart(id) {
    if (!this.ctx || this.fireNodes.has(id)) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.fireNodes.set(id, { src, g });
  }
  fireLoopStop(id) {
    const n = this.fireNodes.get(id);
    if (n) { try { n.src.stop(); } catch (e) {} this.fireNodes.delete(id); }
  }
}
