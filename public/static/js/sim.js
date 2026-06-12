// ============ СИМУЛЯЦИЯ СУБМАРИНЫ ============
// Электрика: РУБИЛЬНИК -> ШИНА ПИТАНИЯ -> ДВИГАТЕЛЬ
// Нагрузка (stress) — главный источник аварий: игрок сам «зарабатывает» пожары.
import { G } from './state.js';
import { COMPARTMENTS } from './world.js';

export class Sim {
  constructor() {
    // --- реактор ---
    this.reactorSeq = 0;        // 0..3 нажатые кнопки запуска
    this.reactorOn = false;
    this.reactorHeat = 20;      // °C условные
    this.cooling = 0;           // 0..1 вентиль охлаждения

    // --- электрика ---
    this.breaker = false;       // главный рубильник
    this.busPowered = false;    // подача питания на шину
    // двигатель: off | starting | on | stopping
    this.engineState = 'off';
    this.engineTimer = 0;
    this.rpm = 0;               // 0..1 фактические обороты

    // --- движение ---
    this.throttle = 0;          // -0.3..1 (машинный телеграф)
    this.speed = 0;             // узлы
    this.heading = 0;           // градусы
    this.rudder = 0;            // -1..1 (штурвал)
    this.boatX = 0; this.boatZ = 0;  // реальная позиция лодки в океане (м)
    this.distanceTravelled = 0;

    // --- балласт / глубина ---
    this.ballast = 0;           // 0..1 заполненность цистерн
    this.depth = 0;             // метры
    this.blowCharges = 2;       // аварийная продувка

    // --- ресурсы ---
    this.o2 = 100;
    this.power = 60;            // заряд аккумуляторов
    this.hull = 100;

    // --- вода в отсеках (м, 0..1.2) ---
    this.water = {};
    for (const c of COMPARTMENTS) this.water[c.id] = 0;
    this.pumpOn = false;

    // --- НАГРУЗКА (stress) 0..100 ---
    this.stress = 0;

    // прожектор
    this.lightsOn = false;

    // торпеды
    this.torpedoes = 4;

    // модификаторы от улучшений
    this.mod = { o2Eff: 1, hullArmor: 1, engineEff: 1 };

    // цели
    this.goal = { reactor: false, dive: false, upgrades: 0, surface: false };

    // миссии
    this.missions = this._initMissions();
    this.currentMission = 0;
    this.missionLog = [];
    this.credits = 0;
  }

  _initMissions() {
    return [
      {
        id: 'start', name: 'ЗАПУСК СИСТЕМ',
        desc: 'Запустите реактор и двигатель',
        objectives: [
          { text: 'Запустить реактор (1→2→3)', check: () => this.goal.reactor },
          { text: 'Запустить двигатель', check: () => this.engineOn },
        ],
        reward: 0,
        completed: false,
      },
      {
        id: 'dive', name: 'ПОГРУЖЕНИЕ',
        desc: 'Погрузитесь на глубину 100м',
        objectives: [
          { text: 'Погрузиться до 100 м', check: () => this.goal.dive },
        ],
        reward: 20,
        completed: false,
      },
      {
        id: 'upgrade', name: 'МОДЕРНИЗАЦИЯ',
        desc: 'Установите 3 улучшения',
        objectives: [
          { text: 'Установить 3 модуля', check: () => this.goal.upgrades >= 3 },
        ],
        reward: 30,
        completed: false,
      },
      {
        id: 'return', name: 'ВОЗВРАТ',
        desc: 'Всплывите на поверхность',
        objectives: [
          { text: 'Всплыть на поверхность', check: () => this.goal.surface },
        ],
        reward: 50,
        completed: false,
      },
    ];
  }

  getMissionStatus() {
    const m = this.missions[this.currentMission];
    if (!m) return null;
    const done = m.objectives.every(o => o.check());
    return {
      mission: m,
      objectives: m.objectives.map(o => ({ text: o.text, done: o.check() })),
      allDone: done,
    };
  }

  completeMission() {
    const m = this.missions[this.currentMission];
    if (!m || m.completed) return;
    m.completed = true;
    this.credits += m.reward;
    this.missionLog.push({ name: m.name, time: Date.now(), reward: m.reward });
    if (this.currentMission < this.missions.length - 1) {
      this.currentMission++;
      G.hud?.log(`✅ Миссия "${m.name}" выполнена! +${m.reward} кредитов. Новая: "${this.missions[this.currentMission].name}"`, 'ok');
    } else {
      G.hud?.log(`🏆 Все миссии выполнены! Кредитов: ${this.credits}`, 'ok');
    }
  }

  // ---------- РЕАКТОР ----------
  pressReactorButton(n) {
    if (this.reactorOn) return 'already';
    if (n === this.reactorSeq + 1) {
      this.reactorSeq = n;
      if (this.reactorSeq === 3) {
        this.reactorOn = true;
        this.goal.reactor = true;
        return 'started';
      }
      return 'ok';
    }
    this.reactorSeq = 0;
    return 'wrong';
  }

  // ---------- ЭЛЕКТРИКА / ДВИГАТЕЛЬ ----------
  setBreaker(on) {
    this.breaker = on;
    if (!on) {
      this.busPowered = false;
      if (this.engineState === 'on' || this.engineState === 'starting') this.stopEngine();
    }
  }

  powerBus() {
    if (!this.breaker) return 'no-breaker';
    if (this.busPowered) return 'already';
    if (this.power < 5) return 'no-charge';
    this.busPowered = true;
    return 'ok';
  }

  getPowerDraw() {
    const d = { base: 0.15, bus: 0, engine: 0, pump: 0, lights: 0, total: 0 };
    if (this.busPowered) d.bus = 0.4;
    if (this.engineOn) d.engine = 1.2 + Math.abs(this.throttle) * 2.6 / this.mod.engineEff;
    if (this.engineState === 'starting') d.engine = 3;
    if (this.pumpOn) d.pump = 1.0;
    if (this.lightsOn) d.lights = 0.5;
    d.total = d.base + d.bus + d.engine + d.pump + d.lights;
    return d;
  }

  startEngine() {
    if (!this.busPowered) return 'no-bus';
    if (this.engineState === 'on' || this.engineState === 'starting') return 'already';
    if (this.power < 8) return 'no-charge';
    this.engineState = 'starting';
    this.engineTimer = 0;
    return 'ok';
  }

  stopEngine() {
    if (this.engineState === 'off' || this.engineState === 'stopping') return 'already';
    this.engineState = 'stopping';
    this.engineTimer = 0;
    return 'ok';
  }

  get engineOn() { return this.engineState === 'on'; }

  emergencyBlow() {
    if (this.blowCharges <= 0) return false;
    this.blowCharges--;
    this.ballast = 0;
    return true;
  }

  totalWater() {
    let s = 0;
    for (const k in this.water) s += this.water[k];
    return s;
  }

  // ---------- ОБНОВЛЕНИЕ ----------
  update(dt) {
    const H = G.hazards;

    // --- реактор: тепло и генерация ---
    if (this.reactorOn) {
      const gen = 5;                       // генерация
      const heatUp = 1.4 + this.rpm * 3 - this.cooling * 8;
      this.reactorHeat = Math.max(20, Math.min(120, this.reactorHeat + heatUp * dt));
      // перегрев реактора > 100 — аварийная остановка
      if (this.reactorHeat >= 118) {
        this.reactorOn = false; this.reactorSeq = 0;
        G.hud?.log('⚛ АВАРИЙНАЯ ОСТАНОВКА РЕАКТОРА: перегрев! Запустите заново (1→2→3), откройте охлаждение!', 'bad');
        G.sfx?.alarm();
      }
      this.power = Math.min(100, this.power + gen * dt);
    } else {
      this.reactorHeat = Math.max(20, this.reactorHeat - 4 * dt);
    }
    if (G.reactorGlow) {
      G.reactorGlow.material.emissiveIntensity = this.reactorOn
        ? 0.4 + this.reactorHeat / 200 + Math.sin(performance.now() * 0.004) * 0.12 : 0.1;
    }

    // --- потребление энергии ---
    let drain = 0.15;                                  // дежурное
    if (this.busPowered) drain += 0.4;
    if (this.engineOn) drain += 1.2 + Math.abs(this.throttle) * 2.6 / this.mod.engineEff;
    if (this.engineState === 'starting') drain += 3;
    if (this.pumpOn) drain += 1.0;
    if (this.lightsOn) drain += 0.5;
    this.power = Math.max(0, this.power - drain * dt);
    if (this.power <= 0 && this.busPowered) {
      this.busPowered = false;
      if (this.engineOn || this.engineState === 'starting') this.stopEngine();
      G.hud?.log('🔋 БАТАРЕИ РАЗРЯЖЕНЫ! Шина обесточена. Нужен реактор для зарядки.', 'bad');
      G.sfx?.alarm();
    }

    // --- двигатель: переходы состояний ---
    if (this.engineState === 'starting') {
      this.engineTimer += dt;
      this.rpm = Math.min(0.35, this.engineTimer / 3 * 0.35);
      if (this.engineTimer >= 3) {
        this.engineState = 'on';
        G.hud?.log('🟢 ДВИГАТЕЛЬ ЗАПУЩЕН. Машинный телеграф к вашим услугам.', 'ok');
        G.sfx?.engineOnline();
      }
    } else if (this.engineState === 'on') {
      const target = 0.25 + Math.abs(this.throttle) * 0.75;
      this.rpm += (target - this.rpm) * Math.min(1, dt * 1.2);
    } else if (this.engineState === 'stopping') {
      this.engineTimer += dt;
      this.rpm = Math.max(0, this.rpm - dt * 0.5);
      if (this.rpm <= 0.01) {
        this.rpm = 0; this.engineState = 'off';
        G.hud?.log('⚫ Двигатель остановлен.', '');
      }
    } else {
      this.rpm = Math.max(0, this.rpm - dt * 0.6);
    }
    G.sfx?.setEngine(this.rpm, this.engineState);
    G.sfx?.setReactor(this.reactorOn ? this.reactorHeat / 120 : 0);
    G.sfx?.setWater(Math.min(1, this.totalWater() / 3));
    G.sfx?.setVentilation(this.busPowered);

    // --- ход (только при работающем двигателе) ---
    if (!this.engineOn && this.engineState !== 'starting') {
      this.throttle += (0 - this.throttle) * Math.min(1, dt * 3);
    }
    const targetSpeed = this.engineOn ? this.throttle * 18 * Math.min(1, this.mod.engineEff) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 0.35);
    if (Math.abs(this.speed) < 0.02 && !this.engineOn) this.speed = 0;
    this.heading = (this.heading + this.rudder * Math.abs(this.speed) * 0.38 * dt + 360) % 360;

    // --- реальное перемещение лодки ---
    const hr = this.heading * Math.PI / 180;
    const ms = this.speed * 0.514;        // узлы -> м/с
    this.boatX += Math.sin(hr) * ms * dt;
    this.boatZ += -Math.cos(hr) * ms * dt;
    this.distanceTravelled += Math.abs(ms) * dt;

    // --- глубина ---
    const floodW = this.totalWater();
    const sink = (this.ballast - 0.45) * 9 + floodW * 1.6;
    this.depth = Math.max(0, this.depth + sink * dt);

    // --- вода: помпа откачивает ---
    if (this.pumpOn && this.busPowered) {
      for (const k in this.water) this.water[k] = Math.max(0, this.water[k] - 0.06 * dt);
    }

    // --- кислород ---
    const scrubber = this.reactorOn && this.power > 10;
    const o2drain = G.flags.outside
      ? 0.9                                     // в скафандре снаружи — расход!
      : (scrubber ? -0.6 : 0.5) / this.mod.o2Eff;
    this.o2 = Math.max(0, Math.min(100, this.o2 - o2drain * dt));

    // --- корпус: давление глубины ---
    if (this.depth > 160) this.hull -= (this.depth - 160) * 0.02 * dt / this.mod.hullArmor;
    this.hull = Math.max(0, Math.min(100, this.hull));

    // --- НАГРУЗКА (stress): источники ---
    let s = 0;
    if (this.engineOn) s += 6 + Math.abs(this.throttle) * 14;
    if (this.engineState === 'starting') s += 10;
    s += Math.max(0, this.depth - 60) * 0.13;
    s += Math.abs(this.speed) * 0.9;
    if (this.reactorHeat > 75) s += (this.reactorHeat - 75) * 0.5;
    s += floodW * 22;
    if (H) s += H.fires.length * 8 + H.shorts.length * 6;
    this.stress += (Math.min(100, s) - this.stress) * Math.min(1, dt * 0.12);
    this.stress = Math.max(0, Math.min(100, this.stress));

    // --- предупреждение о балласте ---
    if (this.ballast > 0.3 && this.depth < 10 && !this._ballastWarned) {
      this._ballastWarned = true;
      G.hud?.log('⚠ БАЛЛАСТ ОТКРЫТ — ПОГРУЖЕНИЕ!', 'warn');
      G.sfx?.alarm();
    }
    if (this.ballast < 0.1) this._ballastWarned = false;

    // --- скрипы корпуса на глубине ---
    G.sfx?.setDepthCreak(this.depth, dt);

    // --- цели ---
    if (this.depth >= 100) this.goal.dive = true;
    if (this.goal.dive && this.goal.reactor && this.goal.upgrades >= 3 && this.depth <= 0.5) {
      this.goal.surface = true;
    }

    // --- проверка завершения миссий ---
    const status = this.getMissionStatus();
    if (status && status.allDone && !status.mission.completed) {
      this.completeMission();
    }
  }

  isWin()  { return this.goal.surface; }
  loseReason() {
    if (this.hull <= 0) return 'КОРПУС РАЗРУШЕН. Океан забрал «Тифон-9».';
    if (this.o2 <= 0) return 'КИСЛОРОД ИСЧЕРПАН. Экипаж потерян.';
    return null;
  }
}
