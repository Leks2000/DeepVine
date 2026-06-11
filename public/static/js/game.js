// ============ SUBMARINE GAME CORE ============
const Game = (() => {
  const S = {
    // power
    reactorOn: false,
    reactorStage: 0,           // startup sequence 0..3
    reactorTemp: 20,           // °C, overheat > 90
    reactorLoad: 0,
    emergencyPower: false,
    batteryOn: false,
    battery: 100,
    fuel: 100,
    // distribution sliders 0..1
    dist: { engines: 0.7, lights: 0.6, sonar: 0.5, life: 0.8 },
    // movement
    mainThrottle: 0,           // 0 OFF,1 IDLE,2 CRUISE,3 FULL
    leftEngine: 0, rightEngine: 0,  // -1..1 levers
    actualSpeed: 0,
    heading: 0,                // degrees
    targetHeading: 0,
    depth: 80, targetDepthAP: 80,
    ballast: 0.5,              // 0 empty(float) .. 1 full(sink)
    ballastFillOpen: false, ballastEmptyOpen: false,
    trim: 0,                   // -1 nose down .. 1 nose up
    pitch: 0, roll: 0,
    apHeading: false, apDepth: false,
    // lights
    lights: { front: false, left: false, right: false, bottom: false },
    redAlert: false,
    // sonar
    sonarActive: false, sonarPassive: false,
    sonarGain: 0.5, sonarFreq: 0.5, sonarFilter: 0.3, sonarDir: 0,
    contacts: [],
    // life support
    vent: false, airScrub: false, waterFilter: false, pumps: false,
    o2: 100, co2: 5, hullTemp: 18, pressureHull: 100, humidity: 45,
    // weapons
    torpedoSelected: 0, torpedoLoaded: false, tubeOpen: false, torpedoCount: 4,
    decoyCount: 3, noisemakers: 2,
    // exploration
    droneOut: false, robotOut: false, armExtended: false,
    cargo: [], cargoMax: 6,
    // emergencies
    fire: false, leak: false, shortCircuit: false, overheat: false,
    hullIntegrity: 100,
    bulkheadsSealed: false, fuseState: 'ok', extinguisherCharges: 3,
    // creature
    creatureDist: 0.1,        // 0 far .. 1 attacking
    creatureAgitation: 0,
    creatureHits: 0,
    creatureRepelled: false,
    // mission
    ruinsScanned: 0, artifacts: 0,
    missionLog: [],
    gameOver: false, win: false,
    time: 0,
    noiseLevel: 0,
  };

  let lastEmergencyCheck = 0;
  let fireSoundTimer = 0;
  let passiveTimer = 0;

  // ====== power computation ======
  function totalPowerAvail() {
    let p = 0;
    if (S.reactorOn && !S.overheat) p += 1.0;
    if (S.reactorOn && S.overheat) p += 0.35;
    if (S.emergencyPower) p += 0.35;
    if (S.batteryOn && S.battery > 0) p += 0.45;
    if (S.shortCircuit) p *= 0.4;
    return p;
  }
  function powerTo(sys) {
    const avail = totalPowerAvail();
    const totalDemand = S.dist.engines + S.dist.lights + S.dist.sonar + S.dist.life;
    if (totalDemand <= 0.001) return 0;
    const scale = Math.min(1, avail / Math.max(0.6, totalDemand * 0.7));
    return S.dist[sys] * scale;
  }

  // ====== main tick ======
  function tick(dt) {
    if (S.gameOver) return;
    S.time += dt;

    const pEng = powerTo('engines');
    const pLights = powerTo('lights');
    const pSonar = powerTo('sonar');
    const pLife = powerTo('life');

    // --- reactor thermals ---
    if (S.reactorOn) {
      S.reactorLoad = (S.dist.engines * (S.mainThrottle / 3) + S.dist.lights * 0.4 + S.dist.sonar * 0.3 + S.dist.life * 0.3);
      const targetTemp = 35 + S.reactorLoad * 75 + (S.fire ? 15 : 0);
      S.reactorTemp += (targetTemp - S.reactorTemp) * dt * 0.08;
      S.fuel = Math.max(0, S.fuel - dt * (0.02 + S.reactorLoad * 0.06));
      if (S.fuel <= 0) { S.reactorOn = false; log('⚠ ТОПЛИВО ИСЧЕРПАНО — реактор заглушен'); }
      if (S.reactorTemp > 90 && !S.overheat) triggerOverheat();
      if (S.reactorTemp < 75 && S.overheat) { S.overheat = false; log('✓ Реактор охладился, мощность восстановлена'); checkAlarmOff(); }
    } else {
      S.reactorTemp += (20 - S.reactorTemp) * dt * 0.05;
      S.reactorLoad = 0;
    }

    // --- battery drain/charge ---
    if (S.batteryOn && !S.reactorOn) S.battery = Math.max(0, S.battery - dt * 0.5);
    if (S.reactorOn && S.battery < 100) S.battery = Math.min(100, S.battery + dt * 0.8);
    if (S.batteryOn && S.battery <= 0) { S.batteryOn = false; log('⚠ Батареи разряжены'); }

    // --- movement ---
    const throttleMap = [0, 0.15, 0.55, 1.0];
    const base = throttleMap[S.mainThrottle] * pEng;
    const lThrust = base * (0.5 + 0.5 * S.leftEngine);
    const rThrust = base * (0.5 + 0.5 * S.rightEngine);
    const targetSpeed = (lThrust + rThrust) * 14; // knots
    S.actualSpeed += (targetSpeed - S.actualSpeed) * dt * 0.3;

    // turning from differential thrust
    let turnRate = (lThrust - rThrust) * 18; // deg/s
    if (S.apHeading) {
      let err = ((S.targetHeading - S.heading + 540) % 360) - 180;
      turnRate += THREE.MathUtils.clamp(err * 0.4, -10, 10) * Math.min(1, base * 3 + 0.2);
    }
    S.heading = (S.heading + turnRate * dt + 360) % 360;
    S.roll += ((-turnRate * 0.004) - S.roll) * dt * 2;

    // --- ballast & depth ---
    if (S.ballastFillOpen) S.ballast = Math.min(1, S.ballast + dt * 0.08);
    if (S.ballastEmptyOpen && (pLife > 0.1 || S.emergencyPower)) S.ballast = Math.max(0, S.ballast - dt * 0.08);
    let vertSpeed = (S.ballast - 0.5) * 14; // m/s-ish
    vertSpeed += -S.trim * S.actualSpeed * 0.4;
    if (S.apDepth) {
      const dErr = S.targetDepthAP - S.depth;
      vertSpeed = THREE.MathUtils.clamp(dErr * 0.15, -6, 6);
      // autopilot adjusts ballast silently
      S.ballast += THREE.MathUtils.clamp(dErr * 0.0005, -0.02, 0.02) * dt * 30;
      S.ballast = THREE.MathUtils.clamp(S.ballast, 0, 1);
    }
    if (S.leak && !S.bulkheadsSealed) vertSpeed += 2.5; // flooding pulls down
    S.depth = THREE.MathUtils.clamp(S.depth + vertSpeed * dt, 5, 240);
    S.pitch += ((S.trim * 0.25 + vertSpeed * -0.01) - S.pitch) * dt * 1.5;

    // crush depth
    if (S.depth > 200) {
      S.hullIntegrity -= dt * (S.depth - 200) * 0.15;
      if (Math.random() < dt * 0.5) AudioEngine.creak(1);
      if (!S._crushWarned) { log('⚠ ОПАСНАЯ ГЛУБИНА! Корпус трещит'); S._crushWarned = true; }
    } else S._crushWarned = false;
    // surface fail
    if (S.depth <= 6 && S.creatureAgitation > 0.5) {
      // creature drags you back down — spooky
      S.ballast = Math.min(1, S.ballast + dt * 0.1);
    }

    // --- life support ---
    if (S.vent && pLife > 0.15) S.o2 = Math.min(100, S.o2 + dt * 1.2);
    else S.o2 = Math.max(0, S.o2 - dt * 0.25);
    if (S.airScrub && pLife > 0.15) S.co2 = Math.max(2, S.co2 - dt * 0.8);
    else S.co2 = Math.min(100, S.co2 + dt * 0.3 + (S.fire ? dt * 2 : 0));
    S.humidity += ((S.leak ? 95 : (S.waterFilter ? 40 : 60)) - S.humidity) * dt * 0.02;
    S.hullTemp += (((S.fire ? 70 : 16) + S.reactorLoad * 8) - S.hullTemp) * dt * 0.03;
    if (S.o2 < 15) damage(dt * 0.4, 'Гипоксия! Экипаж задыхается');
    if (S.co2 > 80) damage(dt * 0.3, 'Отравление CO₂');

    // --- leak flooding ---
    if (S.leak) {
      if (S.bulkheadsSealed) {
        if (S.pumps && pLife > 0.2) {
          S._floodLevel = Math.max(0, (S._floodLevel || 0) - dt * 4);
          if (S._floodLevel <= 0) { S.leak = false; S.bulkheadsSealed = false; log('✓ Течь устранена, отсеки осушены'); checkAlarmOff(); }
        }
      } else {
        S._floodLevel = Math.min(100, (S._floodLevel || 0) + dt * 3);
        if (S._floodLevel > 60) damage(dt * 0.6, 'Затопление отсеков!');
      }
    }

    // --- fire ---
    if (S.fire) {
      damage(dt * 0.35, null);
      fireSoundTimer -= dt;
      if (fireSoundTimer <= 0) { AudioEngine.fireCrackle(); fireSoundTimer = 0.5; }
    }

    // --- noise level (attracts creature) ---
    S.noiseLevel =
      base * 0.5 +
      (S.sonarActive ? 0.35 : 0) +
      (S.mainThrottle === 3 ? 0.25 : 0) +
      (S.fire ? 0.1 : 0);

    // --- creature AI ---
    if (!S.creatureRepelled) {
      S.creatureAgitation += (S.noiseLevel - 0.3) * dt * 0.06;
      S.creatureAgitation = THREE.MathUtils.clamp(S.creatureAgitation, 0, 1);
      S.creatureDist += ((S.creatureAgitation) - S.creatureDist) * dt * 0.08;
      // creature attack
      if (S.creatureDist > 0.85 && Math.random() < dt * 0.15) creatureAttack();
      // random roars
      if (S.creatureDist > 0.4 && Math.random() < dt * 0.04) {
        AudioEngine.creatureRoar(S.creatureDist);
        log('🔊 Пассивный сонар: НЕОПОЗНАННЫЙ БИОЛОГИЧЕСКИЙ КОНТАКТ');
      }
    } else {
      S.creatureDist = Math.max(0, S.creatureDist - dt * 0.05);
      S.creatureAgitation = Math.max(0, S.creatureAgitation - dt * 0.05);
    }

    // --- random emergencies ---
    lastEmergencyCheck += dt;
    if (lastEmergencyCheck > 5) {
      lastEmergencyCheck = 0;
      const risk = 0.02 + S.reactorLoad * 0.03 + (S.depth > 150 ? 0.04 : 0) + S.creatureDist * 0.05;
      if (Math.random() < risk) spawnEmergency();
    }

    // --- passive sonar ambience ---
    if (S.sonarPassive && pSonar > 0.15) {
      passiveTimer -= dt;
      if (passiveTimer <= 0) {
        AudioEngine.passiveStatic(S.sonarGain);
        passiveTimer = 0.35;
      }
    }

    // --- battery emergency check loss condition ---
    if (S.hullIntegrity <= 0 && !S.gameOver) lose('КОРПУС РАЗРУШЕН. Океан забрал «Тифон-9».');

    // engine audio
    AudioEngine.setEngine(Math.min(1, base + Math.abs(lThrust - rThrust) * 0.3));
  }

  function damage(amt, msg) {
    S.hullIntegrity = Math.max(0, S.hullIntegrity - amt);
    if (msg && Math.random() < 0.02) log('⚠ ' + msg);
  }

  function log(msg) {
    S.missionLog.unshift({ t: S.time, msg });
    if (S.missionLog.length > 40) S.missionLog.pop();
    if (window.UI) UI.refreshLog();
  }

  // ====== emergencies ======
  function spawnEmergency() {
    const opts = [];
    if (!S.fire) opts.push('fire');
    if (!S.leak) opts.push('leak');
    if (!S.shortCircuit) opts.push('short');
    if (opts.length === 0) return;
    const pick = opts[Math.floor(Math.random() * opts.length)];
    if (pick === 'fire') { S.fire = true; log('🔥 ПОЖАР В МАШИННОМ ОТДЕЛЕНИИ! Используйте огнетушитель'); }
    if (pick === 'leak') { S.leak = true; S._floodLevel = 5; log('💧 ПРОТЕЧКА! Закройте переборки, затем включите насосы'); }
    if (pick === 'short') { S.shortCircuit = true; S.fuseState = 'blown'; log('⚡ КОРОТКОЕ ЗАМЫКАНИЕ! Замените предохранители'); }
    S.redAlert = true;
    AudioEngine.setAlarm(true);
    if (window.UI) UI.flashAlert();
  }

  function triggerOverheat() {
    S.overheat = true;
    S.redAlert = true;
    AudioEngine.setAlarm(true);
    log('☢ ПЕРЕГРЕВ РЕАКТОРА! Снизьте нагрузку (ползунки/дроссель)');
  }

  function creatureAttack() {
    AudioEngine.creatureRoar(1);
    AudioEngine.explosion(0.4);
    damage(8, null);
    log('💥 СУЩЕСТВО АТАКУЕТ КОРПУС! Целостность: ' + Math.round(S.hullIntegrity) + '%');
    S.redAlert = true;
    AudioEngine.setAlarm(true);
    if (Math.random() < 0.4 && !S.leak) { S.leak = true; S._floodLevel = 10; log('💧 Удар вызвал ПРОТЕЧКУ!'); }
    if (window.UI) UI.shake();
  }

  function checkAlarmOff() {
    if (!S.fire && !S.leak && !S.shortCircuit && !S.overheat && S.creatureDist < 0.7) {
      // auto turn-off alarm only if player also disabled red alert manually? keep red alert until player switches
    }
  }

  // ====== actions (called from UI) ======
  const A = {
    reactorButton(stage) {
      if (S.reactorOn) { AudioEngine.deny(); return false; }
      if (stage !== S.reactorStage + 1) {
        AudioEngine.deny(); S.reactorStage = 0;
        log('✗ Неверная последовательность запуска! Сначала кнопка ' + (1));
        return false;
      }
      S.reactorStage = stage;
      AudioEngine.click();
      if (stage === 3) {
        if (S.fuel <= 0) { log('✗ Нет топлива'); S.reactorStage = 0; return false; }
        S.reactorOn = true;
        AudioEngine.reactorStartup();
        log('☢ РЕАКТОР ЗАПУЩЕН. Мощность в сети.');
      } else {
        log('Запуск реактора: этап ' + stage + '/3');
      }
      return true;
    },
    reactorScram() {
      if (!S.reactorOn) return;
      S.reactorOn = false; S.reactorStage = 0;
      AudioEngine.bigSwitch();
      log('☢ АВАРИЙНАЯ ОСТАНОВКА РЕАКТОРА (SCRAM)');
    },
    emergencyPower(on) {
      S.emergencyPower = on;
      AudioEngine.bigSwitch();
      log(on ? '🔌 Аварийное питание ВКЛ' : '🔌 Аварийное питание ВЫКЛ');
    },
    battery(on) {
      if (on && S.battery <= 0) { AudioEngine.deny(); log('✗ Батареи пусты'); return false; }
      S.batteryOn = on; AudioEngine.clack();
      log(on ? '🔋 Резервные батареи ВКЛ' : '🔋 Батареи отключены');
      return true;
    },
    throttle(v) { S.mainThrottle = v; AudioEngine.leverMove(); log('Двигатель: ' + ['OFF', 'IDLE', 'CRUISE', 'FULL'][v]); },
    leftEngine(v) { S.leftEngine = v; },
    rightEngine(v) { S.rightEngine = v; },
    ballastFill(open) {
      S.ballastFillOpen = open;
      if (open) { S.ballastEmptyOpen = false; AudioEngine.valveTurn(); AudioEngine.bubbles(); log('⬇ Балласт: заполнение цистерн'); }
      else AudioEngine.valveTurn();
    },
    ballastEmpty(open) {
      S.ballastEmptyOpen = open;
      if (open) { S.ballastFillOpen = false; AudioEngine.valveTurn(); AudioEngine.bubbles(); log('⬆ Балласт: продувка цистерн'); }
      else AudioEngine.valveTurn();
    },
    trim(v) { S.trim = v; },
    apHeading(on) { S.apHeading = on; S.targetHeading = S.heading; AudioEngine.clack(); log(on ? '🧭 Автопилот: удержание курса ' + Math.round(S.heading) + '°' : 'Автопилот курса ВЫКЛ'); },
    apDepth(on) { S.apDepth = on; S.targetDepthAP = S.depth; AudioEngine.clack(); log(on ? '🌊 Автопилот: удержание глубины ' + Math.round(S.depth) + 'м' : 'Автопилот глубины ВЫКЛ'); },
    setTargetHeading(v) { S.targetHeading = v; },
    setTargetDepth(v) { S.targetDepthAP = v; },
    light(which, on) {
      S.lights[which] = on; AudioEngine.clack();
    },
    redAlert(on) {
      S.redAlert = on;
      AudioEngine.setAlarm(on);
      if (!on) AudioEngine.clack();
      log(on ? '🚨 КРАСНАЯ ТРЕВОГА' : 'Отбой тревоги');
    },
    sonarPing() {
      if (powerTo('sonar') < 0.1) { AudioEngine.deny(); log('✗ Сонар обесточен'); return; }
      AudioEngine.sonarPing(800 + S.sonarFreq * 1400);
      S.contacts = generateContacts();
      S.creatureAgitation = Math.min(1, S.creatureAgitation + 0.12);
      log('📡 Активный пинг. Контактов: ' + S.contacts.length);
      if (window.UI) UI.sonarSweep();
      setTimeout(() => { if (S.contacts.some(c => c.type === 'creature')) AudioEngine.sonarContact(); }, 700);
    },
    sonarPassive(on) { S.sonarPassive = on; AudioEngine.clack(); },
    sonarGain(v) { S.sonarGain = v; },
    sonarFreq(v) { S.sonarFreq = v; },
    sonarFilter(v) { S.sonarFilter = v; },
    sonarDir(v) { S.sonarDir = v; },
    lifeSys(which, on) {
      S[which] = on; AudioEngine.clack();
      const names = { vent: 'Вентиляция', airScrub: 'Очистка воздуха', waterFilter: 'Фильтрация воды', pumps: 'Насосы' };
      log((on ? '✓ ' : '✗ ') + names[which] + (on ? ' ВКЛ' : ' ВЫКЛ'));
    },
    selectTorpedo(i) { S.torpedoSelected = i; AudioEngine.click(); },
    loadTorpedo() {
      if (S.torpedoCount <= 0) { AudioEngine.deny(); log('✗ Торпеды закончились'); return; }
      if (S.torpedoLoaded) { AudioEngine.deny(); return; }
      S.torpedoLoaded = true; AudioEngine.clack(); AudioEngine.leverMove();
      log('🚀 Торпеда заряжена в аппарат №' + (S.torpedoSelected + 1));
    },
    openTube(open) {
      S.tubeOpen = open; AudioEngine.valveTurn();
      log(open ? '⭕ Шахта ОТКРЫТА' : 'Шахта закрыта');
    },
    fire() {
      if (!S.torpedoLoaded) { AudioEngine.deny(); log('✗ Аппарат не заряжен'); return; }
      if (!S.tubeOpen) { AudioEngine.deny(); log('✗ Шахта закрыта!'); return; }
      S.torpedoLoaded = false; S.torpedoCount--;
      AudioEngine.torpedoLaunch();
      Scene3D.spawnTorpedo(S.heading * Math.PI / 180 + (S.sonarDir - 0.5) * 1.2);
      S.creatureAgitation = Math.min(1, S.creatureAgitation + 0.2);
      log('🚀 ТОРПЕДА ПУЩЕНА! Осталось: ' + S.torpedoCount);
    },
    decoy() {
      if (S.decoyCount <= 0) { AudioEngine.deny(); return; }
      S.decoyCount--; AudioEngine.bubbles();
      S.creatureAgitation = Math.max(0, S.creatureAgitation - 0.45);
      S.creatureDist = Math.max(0, S.creatureDist - 0.3);
      log('🎭 Ложная цель выпущена. Существо отвлечено. Осталось: ' + S.decoyCount);
    },
    noisemaker() {
      if (S.noisemakers <= 0) { AudioEngine.deny(); return; }
      S.noisemakers--; AudioEngine.sweep(2000, 200, 1.5, 0.15, 'square');
      S.creatureAgitation = Math.max(0, S.creatureAgitation - 0.3);
      log('📢 Шумовая приманка. Осталось: ' + S.noisemakers);
    },
    drone(out) {
      S.droneOut = out;
      if (out) { Scene3D.deployDrone(); AudioEngine.bubbles(); log('🛸 Дрон выпущен — обзор руин'); }
      else { Scene3D.recallDrone(); log('🛸 Дрон возвращён'); }
      AudioEngine.clack();
    },
    robot(out) {
      S.robotOut = out; AudioEngine.clack();
      log(out ? '🤖 Подводный робот развёрнут' : '🤖 Робот в доке');
    },
    arm(ext) {
      S.armExtended = ext; AudioEngine.leverMove();
      log(ext ? '🦾 Манипулятор выдвинут' : '🦾 Манипулятор сложен');
    },
    grab() {
      if (!S.armExtended && !S.robotOut) { AudioEngine.deny(); log('✗ Нужен манипулятор или робот'); return; }
      if (S.depth < 90) { AudioEngine.deny(); log('✗ Слишком высоко. Артефакты на дне (глубина 100м+)'); return; }
      if (S.cargo.length >= S.cargoMax) { AudioEngine.deny(); log('✗ Грузовой отсек полон'); return; }
      const items = ['Обломок статуи', 'Чёрный ящик', 'Светящийся кристалл', 'Старый сейф', 'Образец ДНК', 'Капсула данных', 'Реликвия культа'];
      const item = items[Math.floor(Math.random() * items.length)];
      S.cargo.push(item); S.artifacts++;
      AudioEngine.clack(); AudioEngine.blip(1200, 0.3, 0.12);
      log('📦 Поднят артефакт: «' + item + '» (' + S.cargo.length + '/' + S.cargoMax + ')');
      checkWin();
    },
    scanRuins() {
      if (powerTo('sonar') < 0.15) { AudioEngine.deny(); log('✗ Недостаточно энергии на сонар'); return; }
      if (S.depth < 70) { AudioEngine.deny(); log('✗ Руины глубже. Погрузитесь ниже 80м'); return; }
      AudioEngine.sonarPing(2200); AudioEngine.sweep(400, 1600, 1.8, 0.08);
      S.ruinsScanned++;
      S.creatureAgitation = Math.min(1, S.creatureAgitation + 0.08);
      log('🏛 Сектор руин просканирован (' + S.ruinsScanned + '/5)');
      checkWin();
    },
    extinguish() {
      if (!S.fire) { AudioEngine.deny(); return; }
      if (S.extinguisherCharges <= 0) { AudioEngine.deny(); log('✗ Огнетушители пусты!'); return; }
      S.extinguisherCharges--;
      AudioEngine.sweep(3000, 500, 1.2, 0.12);
      if (Math.random() < 0.75) { S.fire = false; log('✓ Пожар потушен! Зарядов: ' + S.extinguisherCharges); checkAlarmOff(); }
      else log('🔥 Огонь ещё горит! Зарядов: ' + S.extinguisherCharges);
    },
    sealBulkheads(on) {
      S.bulkheadsSealed = on; AudioEngine.bigSwitch();
      log(on ? '🚪 Переборки ЗАДРАЕНЫ' : '🚪 Переборки открыты');
    },
    replaceFuse() {
      if (!S.shortCircuit) { AudioEngine.deny(); return; }
      AudioEngine.electricZap();
      setTimeout(() => {
        S.shortCircuit = false; S.fuseState = 'ok';
        AudioEngine.clack();
        log('✓ Предохранитель заменён. Питание стабильно.');
      }, 600);
    },
    distSlider(sys, v) { S.dist[sys] = v; },
  };

  function generateContacts() {
    const list = [];
    const n = 2 + Math.floor(Math.random() * 4 + S.sonarGain * 3);
    for (let i = 0; i < n; i++) {
      list.push({ type: 'ruin', ang: Math.random() * 360, dist: 0.3 + Math.random() * 0.65 });
    }
    if (S.creatureDist > 0.15) {
      list.push({ type: 'creature', ang: (S.time * 9) % 360, dist: Math.max(0.12, 1 - S.creatureDist) });
    }
    return list;
  }

  function onTorpedoHit() {
    S.creatureHits++;
    AudioEngine.explosion(0.6);
    AudioEngine.creatureRoar(1);
    log('💥 ПОПАДАНИЕ ПО СУЩЕСТВУ! (' + S.creatureHits + '/2)');
    if (S.creatureHits >= 2) {
      S.creatureRepelled = true;
      log('🐙 Существо ранено и уходит во тьму...');
      setTimeout(() => { S.creatureRepelled = false; S.creatureHits = 0; log('🔊 ...оно вернётся.'); }, 90000);
    } else {
      S.creatureAgitation = Math.min(1, S.creatureAgitation + 0.3);
    }
    if (window.UI) UI.shake();
  }

  function checkWin() {
    if (S.ruinsScanned >= 5 && S.artifacts >= 3 && !S.win) {
      S.win = true; S.gameOver = true;
      log('🏆 МИССИЯ ВЫПОЛНЕНА!');
      if (window.UI) UI.showEnd(true);
    }
  }

  function lose(reason) {
    S.gameOver = true;
    AudioEngine.explosion(0.9);
    AudioEngine.setAlarm(false);
    log('☠ ' + reason);
    if (window.UI) UI.showEnd(false, reason);
  }

  // state getter for renderer
  function viewState() {
    return {
      headingRad: S.heading * Math.PI / 180,
      pitch: S.pitch, roll: S.roll,
      depth: S.depth,
      actualSpeed: S.actualSpeed,
      lights: S.lights,
      lightPower: powerTo('lights'),
      redAlert: S.redAlert,
      creatureDist: S.creatureDist,
      ambientGlow: totalPowerAvail() > 0.2 ? 0.6 : 0.15,
    };
  }

  return { S, A, tick, viewState, powerTo, totalPowerAvail, onTorpedoHit, log };
})();
window.Game = Game;
