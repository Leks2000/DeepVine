// ============ HUD / UI ============
import { G } from './state.js';

const $ = id => document.getElementById(id);

const ENGINE_LABELS = {
  off: 'ВЫКЛ', starting: 'ЗАПУСК…', on: 'ONLINE', stopping: 'СТОП…',
};

export class Hud {
  constructor() {
    this.el = {
      depth: $('h-depth'), speed: $('h-speed'), heading: $('h-heading'),
      hull: $('b-hull'), o2: $('b-o2'), power: $('b-power'),
      item: $('h-item'), charge: $('h-charge'),
      log: $('mission-log'), hint: $('interact-hint'),
      objReactor: $('obj-reactor'), objDive: $('obj-dive'),
      objUpgrade: $('obj-upgrade'), objSurface: $('obj-surface'),
      cntUpg: $('cnt-upg'), flashEl: $('alert-flash'), vign: $('damage-vignette'),
      engine: $('h-engine'), stress: $('h-stress'),
    };
    this._hintT = 0;
    this._stressWarnT = 0;
  }

  log(msg, cls = '') {
    const d = document.createElement('div');
    d.className = 'log-line ' + cls;
    d.textContent = msg;
    this.el.log.prepend(d);
    while (this.el.log.children.length > 8) this.el.log.lastChild.remove();
  }

  flash() {
    this.el.flashEl.classList.remove('on');
    void this.el.flashEl.offsetWidth;
    this.el.flashEl.classList.add('on');
  }

  hintFlash(msg) {
    this.el.hint.textContent = msg;
    this.el.hint.classList.add('warn');
    this._hintT = 1.2;
  }

  _bar(el, v) {
    if (!el) return;
    el.style.width = v + '%';
    el.className = 'fill ' + (v > 50 ? 'ok' : v > 25 ? 'mid' : 'bad');
  }

  update(dt) {
    const sim = G.sim;
    this.el.depth.textContent = sim.depth.toFixed(0) + ' м';
    this.el.speed.textContent = Math.abs(sim.speed).toFixed(1) + ' уз';
    this.el.heading.textContent = String(sim.heading | 0).padStart(3, '0') + '°';

    if (this.el.engine) {
      const lbl = ENGINE_LABELS[sim.engineState] || sim.engineState;
      this.el.engine.textContent = lbl;
      this.el.engine.className = 'val eng-' + sim.engineState;
    }
    if (this.el.stress) {
      this.el.stress.textContent = sim.stress.toFixed(0) + '%';
      this.el.stress.className = 'val' + (sim.stress > 55 ? ' stress-warn' : sim.stress > 75 ? ' stress-bad' : '');
      if (sim.stress > 65 && this._stressWarnT <= 0) {
        this._stressWarnT = 8;
      }
      if (this._stressWarnT > 0) {
        this._stressWarnT -= dt;
        if (this._stressWarnT <= 0 && sim.stress > 55) {
          this.log('⚠ Высокая нагрузка на системы!', 'warn');
        }
      }
    }

    this._bar(this.el.hull, sim.hull);
    this._bar(this.el.o2, sim.o2);
    this._bar(this.el.power, sim.power);

    if (G.held) {
      this.el.item.textContent = G.held.label + ' [G — положить]';
      this.el.charge.textContent = G.held.charge ? ' · ' + G.held.charge() : '';
    } else {
      this.el.item.textContent = '—';
      this.el.charge.textContent = '';
    }

    if (this._hintT > 0) {
      this._hintT -= dt;
      if (this._hintT <= 0) this.el.hint.classList.remove('warn');
    } else {
      const f = G.player?.focus;
      this.el.hint.textContent = f ? f.hint() : '';
    }

    this._obj(this.el.objReactor, sim.goal.reactor, 'Запустить реактор');
    this._obj(this.el.objDive, sim.goal.dive, 'Погрузиться до 100 м');
    this.el.cntUpg.textContent = sim.goal.upgrades + '/3';
    this._obj(this.el.objUpgrade, sim.goal.upgrades >= 3, null);
    this._obj(this.el.objSurface, sim.goal.surface, 'Всплыть на поверхность');

    const danger = Math.max(0, 1 - Math.min(sim.hull, sim.o2) / 35);
    this.el.vign.style.opacity = danger * 0.75;
  }

  _obj(el, done, _label) {
    el.classList.toggle('done', !!done);
    if (done && !el.dataset.done) {
      el.dataset.done = '1';
      el.textContent = '● ' + el.textContent.replace(/^[○●] /, '');
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
