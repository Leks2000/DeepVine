// ============ HUD → 3D МОНИТОРЫ ============
import * as THREE from 'three';
import { G } from './state.js';

const ENGINE_LABELS = {
  off: 'ВЫКЛ', starting: 'ЗАПУСК…', on: 'ONLINE', stopping: 'СТОП…',
};

export class Hud {
  constructor() {
    this._hintT = 0;
    this._stressWarnT = 0;
    this.journal = [];
    this.logEntries = [];
    this._monitors = {};
    this._hintEl = document.getElementById('interact-hint');
    this._buildMonitors();
  }

  _buildMonitors() {
    const make = (w, h, pos, rotY = 0, rotX = 0) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.LinearFilter;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w / 200, h / 200, 0.03),
        new THREE.MeshBasicMaterial({ map: tex, transparent: false })
      );
      mesh.position.copy(pos);
      mesh.rotation.y = rotY;
      mesh.rotation.x = rotX;
      G.scene.add(mesh);
      return { cv, tex, mesh };
    };

    // 1. ГЛАВНЫЙ МОНИТОР — на правой консоли, не блокирует окно
    this._monitors.main = make(420, 260,
      new THREE.Vector3(2.0, 1.55, -8.5), -Math.PI / 2 + 0.3, -0.15);

    // 2. МОНИТОР СИСТЕМ — над штурвалом (высоко, не блокирует обзор)
    this._monitors.systems = make(300, 200,
      new THREE.Vector3(0, 2.1, -9.5), -0.4);

    // 3. МОНИТОР ЦЕЛЕЙ — на левой консоли
    this._monitors.objectives = make(300, 220,
      new THREE.Vector3(-2.0, 1.55, -8.5), Math.PI / 2 - 0.3, -0.15);

    // 4. МОНИТОР ПРЕДУПРЕЖДЕНИЙ — маленький, над systems
    this._monitors.alerts = make(300, 100,
      new THREE.Vector3(0, 2.5, -9.8), -0.45);

    // 5. ПОДСКАЗКА — на приборной панели перед штурвалом
    this._monitors.hint = make(340, 50,
      new THREE.Vector3(0, 1.05, -8.8), -0.2);

    // 6. МОНИТОР КАМЕР — на правой стене мостика
    this._monitors.camera = make(320, 240,
      new THREE.Vector3(2.8, 1.6, -12), -Math.PI / 2);

    this._cameraLabel = 'НОС';
  }

  updateCameraFeed(texture, label) {
    this._cameraLabel = label;
    const m = this._monitors.camera;
    if (!m) return;
    // обновляем текстуру с рендера камеры
    if (m.mesh.material.map) m.mesh.material.map.dispose();
    m.mesh.material.map = texture;
    m.mesh.material.needsUpdate = true;
    m.tex = texture;
  }

  log(msg, cls = '') {
    this.logEntries.push({ msg, cls, time: Date.now() });
    if (this.logEntries.length > 12) this.logEntries.shift();

    const sim = G.sim;
    if (sim && cls !== '') {
      const entry = {
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        msg, depth: sim.depth | 0,
        reason: this._guessReason(sim),
      };
      this.journal.push(entry);
      if (this.journal.length > 5) this.journal.shift();
    }
  }

  _guessReason(sim) {
    const r = [];
    if (sim.engineOn) r.push('двигатель');
    if (sim.depth > 80) r.push(`глубина ${sim.depth | 0}м`);
    if (sim.reactorHeat > 80) r.push('перегрев реактора');
    if (sim.totalWater() > 0.3) r.push('затопление');
    if (Math.abs(sim.speed) > 12) r.push('высокая скорость');
    if (sim.stress > 65) r.push(`нагрузка ${sim.stress | 0}%`);
    return r.length ? r.join(', ') : 'нагрузка систем';
  }

  flash() { this._flashT = 1.6; }

  hintFlash(msg) {
    this._hintMsg = msg;
    this._hintT = 1.5;
  }

  update(dt) {
    const sim = G.sim;
    if (!sim || !this._monitors.main) return;

    if (this._flashT > 0) this._flashT -= dt;
    if (this._hintT > 0) this._hintT -= dt;

    this._drawMain(sim);
    this._drawSystems(sim);
    this._drawObjectives(sim);
    this._drawAlerts(sim);
    this._drawHint();
  }

  _drawMain(sim) {
    const m = this._monitors.main;
    const c = m.cv.getContext('2d');
    const w = m.cv.width, h = m.cv.height;
    c.fillStyle = '#040e0a'; c.fillRect(0, 0, w, h);

    // рамка
    c.strokeStyle = '#004d30'; c.lineWidth = 2;
    c.strokeRect(4, 4, w - 8, h - 8);

    // заголовок
    c.fillStyle = '#00aa66'; c.font = 'bold 16px monospace';
    c.fillText('ТИФОН-9 · КОМАНДНЫЙ ПОСТ', 14, 24);

    // глубина — крупно
    c.fillStyle = sim.depth > 150 ? '#ff4444' : sim.depth > 100 ? '#ffaa00' : '#00ff88';
    c.font = 'bold 42px monospace';
    c.fillText(`${sim.depth.toFixed(0)} м`, 14, 80);
    c.fillStyle = '#006644'; c.font = '12px monospace';
    c.fillText('ГЛУБИНА', 14, 95);

    // скорость
    c.fillStyle = '#00ff88'; c.font = 'bold 36px monospace';
    c.fillText(`${Math.abs(sim.speed).toFixed(1)} kn`, 180, 80);
    c.fillStyle = '#006644'; c.font = '12px monospace';
    c.fillText('СКОРОСТЬ', 180, 95);

    // курс
    c.fillStyle = '#00ccaa'; c.font = 'bold 28px monospace';
    c.fillText(`${String(sim.heading | 0).padStart(3, '0')}°`, 370, 75);
    c.fillStyle = '#006644'; c.font = '12px monospace';
    c.fillText('КУРС', 370, 90);

    // двигатель
    const eColor = { off: '#555', starting: '#ffaa00', on: '#00ff88', stopping: '#ff6644' };
    c.fillStyle = eColor[sim.engineState] || '#555';
    c.font = 'bold 22px monospace';
    c.fillText(`ДВИГАТЕЛЬ: ${ENGINE_LABELS[sim.engineState]}`, 14, 140);

    // нагрузка — полоска
    const stressW = 300;
    c.fillStyle = '#0a1a14'; c.fillRect(14, 155, stressW, 18);
    const sColor = sim.stress > 75 ? '#ff3333' : sim.stress > 55 ? '#ffaa00' : '#00cc66';
    c.fillStyle = sColor; c.fillRect(14, 155, stressW * sim.stress / 100, 18);
    c.fillStyle = '#aaddcc'; c.font = '12px monospace';
    c.fillText(`НАГРУЗКА: ${sim.stress.toFixed(0)}%`, 330, 169);

    // RPM
    c.fillStyle = '#00aa88'; c.font = '16px monospace';
    c.fillText(`RPM: ${(sim.rpm * 100).toFixed(0)}%`, 14, 200);
    c.fillText(`ГОРКА: ${sim.throttle > 0 ? '+' : ''}${(sim.throttle * 100).toFixed(0)}%`, 180, 200);

    // балласт
    c.fillStyle = '#00aa88'; c.font = '14px monospace';
    c.fillText(`БАЛЛАСТ: ${(sim.ballast * 100).toFixed(0)}%`, 14, 230);

    // реактор
    c.fillStyle = sim.reactorOn ? '#00ff88' : '#555';
    c.font = '14px monospace';
    c.fillText(`РЕАКТОР: ${sim.reactorOn ? 'ONLINE' : 'OFF'}  ТЕПЛО: ${sim.reactorHeat.toFixed(0)}°C`, 200, 230);

    // камера
    c.fillStyle = '#4488aa'; c.font = '12px monospace';
    c.fillText(`КАМЕРА: ${this._cameraLabel || '—'}`, 14, 260);

    // кредиты
    c.fillStyle = '#ffcc00'; c.font = 'bold 16px monospace';
    c.fillText(`${sim.credits} ₮`, 350, 260);
    c.fillStyle = '#006644'; c.font = '10px monospace';
    c.fillText('КРЕДИТЫ', 350, 275);

    // лут
    if (G.lootCrates) {
      const remaining = G.lootCrates.filter(c => !c.looted).length;
      const total = G.lootCrates.length;
      c.fillStyle = '#ffaa00'; c.font = '10px monospace';
      c.fillText(`ЛУТ: ${total - remaining}/${total}`, 350, 290);
    }

    // тревога — вспышка
    if (this._flashT > 0 && Math.sin(this._flashT * 12) > 0) {
      c.fillStyle = 'rgba(255, 0, 0, 0.15)';
      c.fillRect(0, 0, w, h);
    }

    m.tex.needsUpdate = true;
  }

  _drawSystems(sim) {
    const m = this._monitors.systems;
    const c = m.cv.getContext('2d');
    const w = m.cv.width, h = m.cv.height;
    c.fillStyle = '#040e0a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#004d30'; c.lineWidth = 2;
    c.strokeRect(3, 3, w - 6, h - 6);

    c.fillStyle = '#00aa66'; c.font = 'bold 14px monospace';
    c.fillText('СИСТЕМЫ', 10, 20);

    // полоски
    const bars = [
      { label: 'КОРПУС', val: sim.hull, y: 40 },
      { label: 'O₂', val: sim.o2, y: 75 },
      { label: 'ЭНЕРГИЯ', val: sim.power, y: 110 },
    ];
    for (const b of bars) {
      c.fillStyle = '#006644'; c.font = '11px monospace';
      c.fillText(b.label, 10, b.y);
      c.fillStyle = '#0a1a14'; c.fillRect(10, b.y + 5, 240, 14);
      const color = b.val > 50 ? '#00cc66' : b.val > 25 ? '#ffaa00' : '#ff3333';
      c.fillStyle = color; c.fillRect(10, b.y + 5, 240 * b.val / 100, 14);
      c.fillStyle = '#ccddcc'; c.font = '10px monospace';
      c.fillText(`${b.val.toFixed(0)}%`, 255, b.y + 15);
    }

    // распределение энергии
    const draw = sim.getPowerDraw();
    c.fillStyle = '#006644'; c.font = '10px monospace';
    const powerY = 155;
    c.fillText('ПОТРЕБЛЕНИЕ:', 10, powerY);
    const items = [
      { label: 'ДЕЖУРНОЕ', val: draw.base, max: 2 },
      { label: 'ШИНА', val: draw.bus, max: 2 },
      { label: 'ДВИГ', val: draw.engine, max: 5 },
      { label: 'ПОМПА', val: draw.pump, max: 2 },
      { label: 'СВЕТ', val: draw.lights, max: 2 },
    ];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const y = powerY + 15 + i * 16;
      c.fillStyle = '#005533'; c.font = '9px monospace';
      c.fillText(it.label, 10, y);
      c.fillStyle = '#0a1a14'; c.fillRect(80, y - 9, 100, 8);
      const ratio = Math.min(1, it.val / it.max);
      c.fillStyle = ratio > 0.7 ? '#ff6644' : '#00aa66';
      c.fillRect(80, y - 9, 100 * ratio, 8);
      c.fillStyle = '#88aa99'; c.font = '8px monospace';
      c.fillText(`${(it.val * 10).toFixed(0)}W`, 185, y - 2);
    }
    c.fillStyle = '#ffaa00'; c.font = '9px monospace';
    c.fillText(`ИТОГО: ${(draw.total * 10).toFixed(0)}W`, 10, powerY + 100);

    // предмет в руках
    c.fillStyle = '#006644'; c.font = '10px monospace';
    if (G.held) {
      c.fillStyle = '#ffcc00';
      c.fillText(`В РУКАХ: ${G.held.label}`, 10, 235);
    } else {
      c.fillText('В РУКАХ: —', 10, 235);
    }

    m.tex.needsUpdate = true;
  }

  _drawObjectives(sim) {
    const m = this._monitors.objectives;
    const c = m.cv.getContext('2d');
    const w = m.cv.width, h = m.cv.height;
    c.fillStyle = '#040e0a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#004d30'; c.lineWidth = 2;
    c.strokeRect(3, 3, w - 6, h - 6);

    // текущая миссия
    const status = sim.getMissionStatus();
    if (status) {
      c.fillStyle = '#00aa66'; c.font = 'bold 14px monospace';
      c.fillText(`МИССИЯ: ${status.mission.name}`, 10, 22);
      c.fillStyle = '#006644'; c.font = '12px monospace';
      c.fillText(status.mission.desc, 10, 40);

      for (let i = 0; i < status.objectives.length; i++) {
        const o = status.objectives[i];
        const y = 65 + i * 28;
        c.fillStyle = o.done ? '#00cc66' : '#88aa99';
        c.font = '13px monospace';
        c.fillText(o.done ? '● ' + o.text : '○ ' + o.text, 12, y);
      }

      // награда
      c.fillStyle = '#ffcc00'; c.font = '11px monospace';
      c.fillText(`НАГРАДА: ${status.mission.reward} очков`, 10, h - 15);
    } else {
      c.fillStyle = '#00aa66'; c.font = 'bold 14px monospace';
      c.fillText('ВСЕ МИССИИ ВЫПОЛНЕНЫ', 10, h / 2 + 5);
    }

    m.tex.needsUpdate = true;
  }

  _drawAlerts(sim) {
    const m = this._monitors.alerts;
    const c = m.cv.getContext('2d');
    const w = m.cv.width, h = m.cv.height;
    c.fillStyle = '#0a0404'; c.fillRect(0, 0, w, h);

    // текущая миссия (сверху)
    const status = sim.getMissionStatus();
    if (status) {
      c.fillStyle = '#00aa66'; c.font = 'bold 12px monospace';
      c.fillText(`▶ ${status.mission.name}`, 8, 16);
    }

    // предупреждение о балласте
    if (sim.ballast > 0.3 && sim.depth < 10) {
      c.fillStyle = '#ff6644'; c.font = 'bold 11px monospace';
      c.fillText('⚠ БАЛЛАСТ ОТКРЫТ — ПОГРУЖЕНИЕ', 8, 35);
    }

    // последние 3 записи лога
    const recent = this.logEntries.slice(-3);
    for (let i = 0; i < recent.length; i++) {
      const e = recent[recent.length - 1 - i];
      const y = 35 + i * 22;
      const age = (Date.now() - e.time) / 1000;
      const alpha = Math.max(0.3, 1 - age / 12);
      if (e.cls === 'bad') c.fillStyle = `rgba(255, 80, 80, ${alpha})`;
      else if (e.cls === 'warn') c.fillStyle = `rgba(255, 180, 80, ${alpha})`;
      else if (e.cls === 'ok') c.fillStyle = `rgba(80, 255, 140, ${alpha})`;
      else c.fillStyle = `rgba(140, 180, 160, ${alpha})`;
      c.font = '11px monospace';
      const txt = e.msg.length > 44 ? e.msg.substring(0, 44) + '…' : e.msg;
      c.fillText(txt, 8, y);
    }

    if (recent.length === 0 && !status) {
      c.fillStyle = '#004d30'; c.font = '12px monospace';
      c.fillText('СИСТЕМЫ НОМИНАЛЬНЫ', 10, h / 2 + 5);
    }

    m.tex.needsUpdate = true;
  }

  _drawHint() {
    // DOM-подсказка (основная)
    let text = '';
    if (this._hintT > 0 && this._hintMsg) {
      text = this._hintMsg;
      if (this._hintEl) { this._hintEl.textContent = text; this._hintEl.className = 'warn'; }
    } else {
      const f = G.player?.focus;
      text = f ? f.hint() : '';
      if (this._hintEl) { this._hintEl.textContent = text; this._hintEl.className = ''; }
    }

    // маленький монитор-подсказка (дубль)
    const m = this._monitors.hint;
    if (m) {
      const c = m.cv.getContext('2d');
      const w = m.cv.width, h = m.cv.height;
      c.fillStyle = '#040e0a'; c.fillRect(0, 0, w, h);
      c.fillStyle = this._hintT > 0 ? '#ffaa00' : '#00ccaa';
      c.font = '14px monospace';
      if (text) {
        const txt = text.length > 46 ? text.substring(0, 46) + '…' : text;
        c.fillText(txt, 10, h / 2 + 5);
      }
      m.tex.needsUpdate = true;
    }
  }
}

export function showEnd(win, text) {
  G.flags.over = true;
  document.exitPointerLock?.();
  const s = document.getElementById('end-screen');
  document.getElementById('end-title').textContent = win ? '◆ МИССИЯ ВЫПОЛНЕНА ◆' : '✖ СУБМАРИНА ПОТЕРЯНА ✖';
  document.getElementById('end-title').style.color = win ? '#00e676' : '#ff5252';
  document.getElementById('end-text').textContent = text;
  s.style.display = 'flex';
}
