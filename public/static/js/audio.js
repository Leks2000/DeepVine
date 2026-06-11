// ============ WebAudio SFX (синтез, без файлов) ============
export class Sfx {
  constructor() { this.ctx = null; this.humGain = null; this.fireNodes = new Map(); }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    // фоновый гул субмарины
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 57;
    const g = this.ctx.createGain(); g.gain.value = 0.018;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.ctx.destination);
    o.start(); o2.start();
    this.humGain = g;
  }

  _env(freq, type, dur, vol = 0.2, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
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
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
    return { src, gain: g, filter: f };
  }

  click()       { this._env(900, 'square', 0.06, 0.12); }
  buttonOk()    { this._env(620, 'sine', 0.15, 0.2, 880); }
  buttonErr()   { this._env(220, 'square', 0.25, 0.18, 110); }
  leverCreak()  { this._env(160, 'sawtooth', 0.12, 0.06, 90); }
  valveTick()   { this._env(1400, 'square', 0.03, 0.05); }
  klaxon() {
    this._env(310, 'sawtooth', 0.55, 0.3, 290);
    setTimeout(() => this._env(260, 'sawtooth', 0.7, 0.3, 240), 600);
  }
  alarm()       { this._env(880, 'square', 0.4, 0.12, 660); }
  splashUp()    { this._noise(1.2, 0.25, 500); }
  explosion()   { this._noise(0.8, 0.4, 200); this._env(60, 'sine', 0.8, 0.4, 30); }
  extinguish()  { this._noise(0.3, 0.18, 3000); }
  wrench()      { this._env(1800, 'square', 0.05, 0.08); this._env(700, 'triangle', 0.1, 0.06); }
  craftDone()   { this._env(523, 'sine', 0.12, 0.2); setTimeout(() => this._env(784, 'sine', 0.25, 0.2), 130); }
  install()     { this._env(392, 'sine', 0.1, 0.2); setTimeout(() => this._env(523, 'sine', 0.1, 0.2), 110); setTimeout(() => this._env(659, 'sine', 0.3, 0.22), 220); }
  pickup()      { this._env(500, 'triangle', 0.08, 0.15, 700); }
  drop()        { this._env(300, 'triangle', 0.1, 0.12, 200); }
  airlock()     { this._noise(1.5, 0.2, 800); this._env(90, 'sine', 1.4, 0.15, 60); }
  blow()        { this._noise(2.0, 0.3, 600); }

  // зацикленный шум пожара
  fireLoopStart(id) {
    if (!this.ctx || this.fireNodes.has(id)) return;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start();
    this.fireNodes.set(id, { src, g });
  }
  fireLoopStop(id) {
    const n = this.fireNodes.get(id);
    if (n) { try { n.src.stop(); } catch (e) {} this.fireNodes.delete(id); }
  }
}
