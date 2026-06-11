// ============ СИМУЛЯЦИЯ СУБМАРИНЫ ============
import { G } from './state.js';

export class Sim {
  constructor() {
    // реактор
    this.reactorSeq = 0;        // 0..3 нажатые кнопки запуска
    this.reactorOn = false;
    this.reactorHeat = 20;      // °C условные

    // движение
    this.throttle = 0;          // -0.3..1 (рычаг)
    this.speed = 0;             // узлы
    this.heading = 0;           // градусы
    this.rudder = 0;            // -1..1 (штурвал)

    // балласт / глубина
    this.ballast = 0;           // 0..1 заполненность цистерн
    this.depth = 0;             // метры
    this.blowCharges = 2;       // аварийная продувка

    // ресурсы
    this.o2 = 100;
    this.power = 100;
    this.hull = 100;

    // модификаторы от улучшений
    this.mod = { o2Eff: 1, hullArmor: 1, engineEff: 1 };

    // цели
    this.goal = { reactor: false, dive: false, upgrades: 0, surface: false };
  }

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

  emergencyBlow() {
    if (this.blowCharges <= 0) return false;
    this.blowCharges--;
    this.ballast = 0;
    return true;
  }

  update(dt) {
    // --- реактор / энергия ---
    if (this.reactorOn) {
      this.reactorHeat = Math.min(100, this.reactorHeat + (Math.abs(this.throttle) * 4 - 1.5) * dt);
      const drain = 1.5 + Math.abs(this.throttle) * 2;
      this.power = Math.min(100, this.power + (4 - drain * (2 - this.mod.engineEff)) * dt);
    } else {
      this.reactorHeat = Math.max(20, this.reactorHeat - 3 * dt);
      this.power = Math.max(0, this.power - 0.4 * dt);
    }
    if (G.reactorGlow) {
      G.reactorGlow.material.emissiveIntensity = this.reactorOn ? 0.5 + Math.sin(performance.now() * 0.004) * 0.15 : 0.12;
    }

    // --- ход ---
    const targetSpeed = this.reactorOn && this.power > 5 ? this.throttle * 18 : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 0.4);
    this.heading = (this.heading + this.rudder * this.speed * 0.6 * dt + 360) % 360;

    // --- глубина ---
    const sink = (this.ballast - 0.45) * 9;   // балласт > 0.45 — тонем
    this.depth = Math.max(0, this.depth + sink * dt);

    // --- кислород ---
    const o2drain = G.flags.outside ? 0 : (this.reactorOn && this.power > 10 ? -0.5 : 0.55) / this.mod.o2Eff;
    this.o2 = Math.max(0, Math.min(100, this.o2 - o2drain * dt));

    // --- корпус: давление глубины ---
    if (this.depth > 160) this.hull -= (this.depth - 160) * 0.02 * dt / this.mod.hullArmor;
    this.hull = Math.max(0, Math.min(100, this.hull));

    // --- цели ---
    if (this.depth >= 100) this.goal.dive = true;
    if (this.goal.dive && this.goal.reactor && this.goal.upgrades >= 3 && this.depth <= 0.5) {
      this.goal.surface = true;
    }
  }

  isWin()  { return this.goal.surface; }
  loseReason() {
    if (this.hull <= 0) return 'КОРПУС РАЗРУШЕН. Океан забрал «Тифон-9».';
    if (this.o2 <= 0) return 'КИСЛОРОД ИСЧЕРПАН. Экипаж потерян.';
    return null;
  }
}
