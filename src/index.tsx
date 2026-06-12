import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>ТИФОН-9 — 3D Симулятор Субмарины</title>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
<link href="/static/css/game.css" rel="stylesheet">
</head>
<body>

<!-- ============ START SCREEN ============ -->
<section id="start-screen">
  <h1 class="title-big">ТИФОН-9</h1>
  <p class="title-sub">ГЛУБОКОВОДНЫЙ ИССЛЕДОВАТЕЛЬСКИЙ КОМПЛЕКС · 2086 · 3D</p>
  <div class="briefing">
    <b>ВЫ — единственный член экипажа субмарины «Тифон-9».</b><br><br>
    <b>УПРАВЛЕНИЕ:</b><br>
    <kbd>W A S D</kbd> — движение · <kbd>МЫШЬ</kbd> — осмотр · <kbd>E</kbd> — взаимодействие / взять / установить<br>
    <kbd>ЛКМ</kbd> (зажать) — тянуть рычаг / крутить вентиль / тушить / чинить<br>
    <kbd>G</kbd> — бросить предмет · <kbd>SHIFT</kbd> — бег<br><br>
    <b>ЗАДАЧИ МИССИИ:</b><br>
    ① Запустить реактор (кнопки 1→2→3 в реакторном отсеке)<br>
    ② Погрузиться на глубину 100м (вентиль балласта на мостике)<br>
    ③ Скрафтить и установить 3 улучшения (верстак в кормовом отсеке)<br>
    &nbsp;&nbsp;&nbsp;— одно из них устанавливается СНАРУЖИ через шлюз (только на поверхности!)<br>
    ④ Всплыть на поверхность (аварийная продувка или вентиль)<br><br>
    <span class="warn">⚠ Пожары тушите огнетушителем (висит на стене). Течи и замыкания чините
    гаечным ключом (на верстаке). Следите за O₂, корпусом и энергией.
    Верхняя ручка над мостиком — КЛАКСОН: хватайте и тяните ВНИЗ.</span>
  </div>
  <button id="btn-start">⚓ ПРИНЯТЬ УПРАВЛЕНИЕ</button>
</section>

<!-- ============ END SCREEN ============ -->
<section id="end-screen">
  <h1 id="end-title" class="title-big"></h1>
  <p id="end-text"></p>
  <button class="btn-restart" onclick="location.reload()">↻ НОВАЯ МИССИЯ</button>
</section>

<!-- ============ 3D + HUD ============ -->
<main id="game-root">
  <canvas id="game-canvas"></canvas>

  <div id="hud">
    <div id="crosshair">+</div>
    <div id="interact-hint"></div>

    <div id="hud-top">
      <div class="hud-box">
        ГЛУБИНА <span id="h-depth" class="val">0 м</span> ·
        СКОРОСТЬ <span id="h-speed" class="val">0.0 уз</span> ·
        КУРС <span id="h-heading" class="val">000°</span> ·
        ДВИГАТЕЛЬ <span id="h-engine" class="val eng-off">ВЫКЛ</span> ·
        НАГРУЗКА <span id="h-stress" class="val">0%</span>
      </div>
      <div class="hud-box" id="objectives">
        <div class="obj" id="obj-reactor">○ Запустить реактор</div>
        <div class="obj" id="obj-dive">○ Погрузиться до 100 м</div>
        <div class="obj" id="obj-upgrade">○ Улучшения: <span id="cnt-upg">0/3</span></div>
        <div class="obj" id="obj-surface">○ Всплыть на поверхность</div>
      </div>
    </div>

    <div id="hud-bottom">
      <div class="hud-box bars">
        <div class="bar-row">КОРПУС <div class="bar"><div id="b-hull" class="fill ok"></div></div></div>
        <div class="bar-row">O₂ <div class="bar"><div id="b-o2" class="fill ok"></div></div></div>
        <div class="bar-row">ЭНЕРГИЯ <div class="bar"><div id="b-power" class="fill ok"></div></div></div>
        <div class="bar-row" id="row-item">В РУКАХ <span id="h-item" class="val">—</span><span id="h-charge"></span></div>
      </div>
      <div class="hud-box" id="mission-log"></div>
    </div>

    <div id="alert-flash"></div>
    <div id="damage-vignette"></div>
  </div>
</main>

<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
</script>
<script type="module" src="/static/js/main3d.js"></script>
</body>
</html>`)
})

export default app
