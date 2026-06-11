import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>ТИФОН-9 — Симулятор Субмарины</title>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
<link href="/static/css/panel.css" rel="stylesheet">
</head>
<body>

<!-- ============ START SCREEN ============ -->
<section id="start-screen">
  <h1 class="title-big">ТИФОН-9</h1>
  <p class="title-sub">ГЛУБОКОВОДНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ КОМПЛЕКС · 2086</p>
  <div class="briefing">
    <b>БРИФИНГ:</b> Вы — оператор субмарины «Тифон-9». Под вами — затонувший мегаполис.
    Город ушёл под воду 40 лет назад, но в окнах до сих пор горит свет. Никто не знает почему.<br><br>
    <b>ЗАДАЧА:</b><br>
    ① Запустить реактор (кнопки <b>1 → 2 → 3</b> по порядку)<br>
    ② Включить жизнеобеспечение (вентиляция + очистка воздуха)<br>
    ③ Погрузиться к руинам (глубина 80м+) — клапан «Заполнить балласт»<br>
    ④ Просканировать <b>5 секторов руин</b> сонаром<br>
    ⑤ Поднять <b>3 артефакта</b> манипулятором (глубина 100м+)<br><br>
    <span class="warn">⚠ ВНИМАНИЕ: пассивный сонар фиксирует крупный биологический объект.
    Шум двигателей и активный сонар привлекают ЕГО. Используйте ложные цели, шумовые приманки
    и торпеды (2 попадания отгоняют существо).</span><br><br>
    <b>АВАРИИ:</b> пожар → огнетушитель · протечка → задраить переборки + насосы ·
    замыкание → заменить предохранитель · перегрев реактора → снизить нагрузку.<br>
    <b>ГЛУБИНА 200м+</b> = корпус разрушается. Следите за O₂, CO₂, топливом и целостностью корпуса.
  </div>
  <button id="btn-start">⚓ ПРИНЯТЬ УПРАВЛЕНИЕ</button>
</section>

<!-- ============ END SCREEN ============ -->
<section id="end-screen">
  <h1 id="end-title" class="title-big"></h1>
  <p id="end-text"></p>
  <button id="btn-start" onclick="location.reload()">↻ НОВАЯ МИССИЯ</button>
</section>

<main id="game-container">
  <!-- ============ 3D VIEWPORT ============ -->
  <section id="viewport-wrap">
    <canvas id="ocean-canvas"></canvas>
    <div class="porthole-bolt" style="top:8px;left:8px"></div>
    <div class="porthole-bolt" style="top:8px;right:8px"></div>
    <div class="porthole-bolt" style="bottom:8px;left:8px"></div>
    <div class="porthole-bolt" style="bottom:8px;right:8px"></div>

    <header id="hud">
      <div class="hud-box">
        ГЛУБИНА <span id="digi-depth" class="val">80 м</span> ·
        СКОРОСТЬ <span id="digi-speed" class="val">0.0 уз</span> ·
        КУРС <span id="digi-heading" class="val">000°</span>
      </div>
      <div class="hud-box">
        <div class="objective" id="obj-scan">◈ Сканировать руины: <span class="cnt" id="cnt-ruins">0/5</span></div>
        <div class="objective" id="obj-art">◈ Артефакты: <span class="cnt" id="cnt-artifacts">0/3</span></div>
      </div>
    </header>

    <aside id="mission-log"></aside>
    <div id="alert-flash"></div>
  </section>

  <!-- ============ CONTROL DECK ============ -->
  <section id="control-deck">

    <!-- ПАНЕЛЬ ДВИЖЕНИЯ -->
    <article class="panel-section" id="panel-movement">
      <h2 class="panel-title">⚙ Движение</h2>
      <div class="ctl-row">
        <div class="ctl-col">
          <div id="lever-throttle"></div>
          <span class="ctl-label">Главный<br>OFF·IDLE·CRUISE·FULL</span>
        </div>
        <div class="ctl-col">
          <div id="lever-left"></div>
          <span class="ctl-label">Левый<br>двигатель</span>
        </div>
        <div class="ctl-col">
          <div id="lever-right"></div>
          <span class="ctl-label">Правый<br>двигатель</span>
        </div>
        <div class="ctl-col">
          <div id="lever-trim"></div>
          <span class="ctl-label">Триммер<br>нос ↑↓</span>
        </div>
      </div>
      <div class="ctl-row">
        <div class="ctl-col"><div id="valve-fill"></div><span class="ctl-label">Заполнить<br>балласт</span></div>
        <div class="ctl-col"><div id="valve-empty"></div><span class="ctl-label">Продуть<br>балласт</span></div>
        <div class="ctl-col"><div id="ap-heading"></div><span class="ctl-label">АП курс</span></div>
        <div class="ctl-col"><div id="ap-depth"></div><span class="ctl-label">АП глубина</span></div>
      </div>
      <div class="sbar-wrap">
        <div class="sbar-label"><span>БАЛЛАСТ</span></div>
        <div class="sbar"><div class="sbar-fill" id="bar-ballast"></div></div>
      </div>
    </article>

    <!-- ПРИБОРЫ -->
    <article class="panel-section" id="panel-gauges">
      <h2 class="panel-title">◉ Приборы</h2>
      <div class="ctl-row">
        <div class="gauge"><div class="gauge-needle" id="gauge-depth"></div><div class="gauge-cap"></div><span class="gauge-title">ГЛУБИНА</span></div>
        <div class="gauge"><div class="gauge-needle" id="gauge-speed"></div><div class="gauge-cap"></div><span class="gauge-title">УЗЛЫ</span></div>
      </div>
      <div class="ctl-row">
        <div class="gauge"><div class="gauge-needle" id="gauge-temp"></div><div class="gauge-cap"></div><span class="gauge-title">Т° РЕАКТОРА</span></div>
        <div class="gauge"><div class="gauge-needle" id="gauge-pressure"></div><div class="gauge-cap"></div><span class="gauge-title">ДАВЛЕНИЕ</span></div>
      </div>
      <div class="ctl-row">
        <div class="ctl-col"><div class="digi" id="digi-temp">20°C</div><span class="digi-label">РЕАКТОР</span></div>
      </div>
      <div class="lamp-row">
        <div class="lamp lamp-green" id="lamp-aux1"><div class="lamp-bulb"></div><span class="lamp-name">ГИДР</span></div>
        <div class="lamp" id="lamp-aux2"><div class="lamp-bulb"></div><span class="lamp-name">СЕТЬ</span></div>
        <div class="lamp lamp-green" id="lamp-aux3"><div class="lamp-bulb"></div><span class="lamp-name">ЦИРК</span></div>
        <div class="lamp lamp-green" id="lamp-ap"><div class="lamp-bulb"></div><span class="lamp-name">АП</span></div>
      </div>
    </article>

    <!-- ЭНЕРГОЩИТОК -->
    <article class="panel-section" id="panel-power">
      <h2 class="panel-title">☢ Энергощиток</h2>
      <div class="ctl-row">
        <button class="push-btn btn-amber" id="rbtn-1">1</button>
        <button class="push-btn btn-amber" id="rbtn-2">2</button>
        <button class="push-btn btn-green" id="rbtn-3">3<br>ПУСК</button>
        <button class="push-btn btn-red" id="rbtn-scram">SCRAM</button>
      </div>
      <div class="lamp-row">
        <div class="lamp" id="rstage-1"><div class="lamp-bulb"></div><span class="lamp-name">НАСОС</span></div>
        <div class="lamp" id="rstage-2"><div class="lamp-bulb"></div><span class="lamp-name">СТЕРЖНИ</span></div>
        <div class="lamp lamp-green" id="rstage-3"><div class="lamp-bulb"></div><span class="lamp-name">КРИТ</span></div>
        <div class="lamp lamp-green" id="lamp-reactor"><div class="lamp-bulb"></div><span class="lamp-name">РЕАКТОР</span></div>
      </div>
      <div class="ctl-row">
        <div class="ctl-col"><div id="sw-emergency"></div><span class="ctl-label">Аварийное<br>питание</span></div>
        <div class="ctl-col"><div id="sw-battery"></div><span class="ctl-label">Резервные<br>батареи</span></div>
        <div class="ctl-col">
          <div class="digi" id="power-total">0%</div>
          <span class="digi-label">МОЩНОСТЬ</span>
        </div>
      </div>
      <div class="sbar-wrap"><div class="sbar-label"><span>ТОПЛИВО</span></div><div class="sbar"><div class="sbar-fill" id="bar-fuel"></div></div></div>
      <div class="sbar-wrap"><div class="sbar-label"><span>БАТАРЕИ</span></div><div class="sbar"><div class="sbar-fill" id="bar-battery"></div></div></div>
    </article>

    <!-- РАСПРЕДЕЛЕНИЕ ЭНЕРГИИ -->
    <article class="panel-section" id="panel-dist">
      <h2 class="panel-title">⚡ Распределение</h2>
      <div class="sbar-wrap"><div class="sbar-label"><span>ДВИГАТЕЛИ</span></div><div id="dist-engines"></div></div>
      <div class="sbar-wrap"><div class="sbar-label"><span>ФОНАРИ</span></div><div id="dist-lights"></div></div>
      <div class="sbar-wrap"><div class="sbar-label"><span>СОНАР</span></div><div id="dist-sonar"></div></div>
      <div class="sbar-wrap"><div class="sbar-label"><span>ЖИЗНЕОБЕСП.</span></div><div id="dist-life"></div></div>
      <div class="ctl-row">
        <div class="lamp lamp-red" id="lamp-short"><div class="lamp-bulb"></div><span class="lamp-name">КЗ</span></div>
        <button class="push-btn btn-amber" id="btn-fuse">Заменить<br>предохр.</button>
      </div>
    </article>

    <!-- ОСВЕЩЕНИЕ -->
    <article class="panel-section" id="panel-lights">
      <h2 class="panel-title">💡 Освещение</h2>
      <div class="ctl-row">
        <div class="ctl-col"><div id="lt-front"></div><span class="ctl-label">Передний</span></div>
        <div class="ctl-col"><div id="lt-bottom"></div><span class="ctl-label">Нижний</span></div>
      </div>
      <div class="ctl-row">
        <div class="ctl-col"><div id="lt-left"></div><span class="ctl-label">Левый</span></div>
        <div class="ctl-col"><div id="lt-right"></div><span class="ctl-label">Правый</span></div>
      </div>
      <div class="ctl-row">
        <div class="ctl-col"><div id="lt-red"></div><span class="ctl-label">🚨 Красная<br>тревога</span></div>
      </div>
    </article>

    <!-- СОНАР -->
    <article class="panel-section" id="panel-sonar">
      <h2 class="panel-title">📡 Сонарный стол</h2>
      <canvas id="sonar-canvas" width="150" height="150"></canvas>
      <div class="ctl-row">
        <button class="push-btn btn-green" id="btn-ping">ПИНГ</button>
        <div class="ctl-col"><div id="sw-passive"></div><span class="ctl-label">Пассивный</span></div>
        <button class="push-btn btn-cyan" id="btn-scan">СКАН<br>РУИН</button>
      </div>
      <div class="ctl-row">
        <div id="knob-gain"></div>
        <div id="knob-freq"></div>
        <div id="knob-filter"></div>
        <div id="knob-dir"></div>
      </div>
      <div class="lamp-row">
        <div class="lamp lamp-red" id="lamp-creature"><div class="lamp-bulb"></div><span class="lamp-name">БИО-КОНТАКТ</span></div>
      </div>
    </article>

    <!-- НАВИГАЦИЯ -->
    <article class="panel-section" id="panel-nav">
      <h2 class="panel-title">🧭 Навигация</h2>
      <div id="compass">
        <div id="compass-disc">
          <span class="c-n">N</span><span class="c-s">S</span>
          <span class="c-e">E</span><span class="c-w">W</span>
        </div>
      </div>
      <div class="ctl-row">
        <div class="ctl-col"><div class="digi" id="digi-heading2">000°</div><span class="digi-label">КУРС</span></div>
      </div>
      <div class="objective">◈ Координаты: 41°N 167°W</div>
      <div class="objective">◈ Сектор: Мёртвый город</div>
      <div class="objective">◈ Руины: <span class="cnt" id="cnt-ruins2">глубина 80–160м</span></div>
    </article>

    <!-- ЖИЗНЕОБЕСПЕЧЕНИЕ -->
    <article class="panel-section" id="panel-life">
      <h2 class="panel-title">🫁 Жизнеобеспечение</h2>
      <div class="ctl-row">
        <div class="ctl-col"><div id="ls-vent"></div><span class="ctl-label">Вентиляция</span></div>
        <div class="ctl-col"><div id="ls-scrub"></div><span class="ctl-label">Очистка<br>воздуха</span></div>
      </div>
      <div class="ctl-row">
        <div class="ctl-col"><div id="ls-water"></div><span class="ctl-label">Фильтр<br>воды</span></div>
        <div class="ctl-col"><div id="ls-pumps"></div><span class="ctl-label">Насосы</span></div>
      </div>
      <div class="sbar-wrap"><div class="sbar-label"><span>O₂</span></div><div class="sbar"><div class="sbar-fill" id="bar-o2"></div></div></div>
      <div class="sbar-wrap"><div class="sbar-label"><span>CO₂</span></div><div class="sbar"><div class="sbar-fill" id="bar-co2"></div></div></div>
      <div class="sbar-wrap"><div class="sbar-label"><span>ВЛАЖНОСТЬ</span></div><div class="sbar"><div class="sbar-fill" id="bar-humidity"></div></div></div>
    </article>

    <!-- ВООРУЖЕНИЕ -->
    <article class="panel-section" id="panel-weapons">
      <h2 class="panel-title">🚀 Вооружение</h2>
      <div class="ctl-row">
        <button class="torp-select sel">1</button>
        <button class="torp-select">2</button>
        <button class="torp-select">3</button>
        <button class="torp-select">4</button>
      </div>
      <div class="ctl-row">
        <button class="push-btn btn-amber" id="btn-load">ЗАРЯДИТЬ</button>
        <div class="ctl-col"><div id="sw-tube"></div><span class="ctl-label">Шахта</span></div>
        <button class="push-btn btn-red" id="btn-fire">ПУСК</button>
      </div>
      <div class="lamp-row">
        <div class="lamp" id="lamp-loaded"><div class="lamp-bulb"></div><span class="lamp-name">ЗАРЯЖЕНО</span></div>
        <div class="lamp lamp-green" id="lamp-tube"><div class="lamp-bulb"></div><span class="lamp-name">ШАХТА</span></div>
      </div>
      <div class="ctl-row">
        <button class="push-btn btn-cyan" id="btn-decoy">ДЕКОЙ<br><span id="cnt-decoy">3</span></button>
        <button class="push-btn btn-cyan" id="btn-noise">ШУМ<br><span id="cnt-noise">2</span></button>
        <div class="ctl-col"><div class="digi" id="cnt-torp">4</div><span class="digi-label">ТОРПЕДЫ</span></div>
      </div>
    </article>

    <!-- ИССЛЕДОВАНИЕ -->
    <article class="panel-section" id="panel-explore">
      <h2 class="panel-title">🤖 Исследование</h2>
      <div class="ctl-row">
        <div class="ctl-col"><div id="sw-drone"></div><span class="ctl-label">Дрон</span></div>
        <div class="ctl-col"><div id="sw-robot"></div><span class="ctl-label">Робот</span></div>
        <div class="ctl-col"><div id="sw-arm"></div><span class="ctl-label">Манипулятор</span></div>
      </div>
      <div class="ctl-row">
        <button class="push-btn btn-green" id="btn-grab">⬇ ПОДНЯТЬ<br>АРТЕФАКТ</button>
        <div class="ctl-col"><div class="digi" id="cnt-cargo">0/6</div><span class="digi-label">ГРУЗ. ОТСЕК</span></div>
      </div>
    </article>

    <!-- АВАРИЙНАЯ ПАНЕЛЬ -->
    <article class="panel-section" id="panel-emergency">
      <h2 class="panel-title">🚨 Аварийная панель</h2>
      <div class="lamp-row">
        <div class="lamp lamp-red" id="lamp-fire"><div class="lamp-bulb"></div><span class="lamp-name">ПОЖАР</span></div>
        <div class="lamp lamp-red" id="lamp-leak"><div class="lamp-bulb"></div><span class="lamp-name">ТЕЧЬ</span></div>
        <div class="lamp lamp-red" id="lamp-overheat"><div class="lamp-bulb"></div><span class="lamp-name">ПЕРЕГРЕВ</span></div>
      </div>
      <div class="ctl-row">
        <button class="push-btn btn-red" id="btn-extinguish">🧯 ТУШИТЬ<br><span id="cnt-ext">3</span></button>
        <div class="ctl-col"><div id="sw-bulkheads"></div><span class="ctl-label">Переборки</span></div>
      </div>
      <div class="sbar-wrap"><div class="sbar-label"><span>КОРПУС</span></div><div class="sbar"><div class="sbar-fill" id="bar-hull"></div></div></div>
      <div class="sbar-wrap"><div class="sbar-label"><span>ЗАТОПЛЕНИЕ</span></div><div class="sbar"><div class="sbar-fill" id="bar-flood"></div></div></div>
    </article>

  </section>
</main>

<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="/static/js/audio.js"></script>
<script src="/static/js/scene3d.js"></script>
<script src="/static/js/game.js"></script>
<script src="/static/js/ui.js"></script>
<script src="/static/js/main.js"></script>
</body>
</html>`)
})

export default app
