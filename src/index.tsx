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
  <div class="start-shell">
    <div class="start-badge">ОПЫТНЫЙ ДИЗЕЛЬ-ЭЛЕКТРИЧЕСКИЙ КОМПЛЕКС · FPS CAP 180</div>
    <h1 class="title-big">ТИФОН-9</h1>
    <p class="title-sub">ГЛУБОКОВОДНАЯ СУБМАРИНА · ИСТОРИЧНЫЙ КОРПУС · 3D</p>
  </div>
  <div class="briefing">
    <b>ВЫ — единственный член экипажа субмарины «Тифон-9».</b><br><br>
    <b>БАЗА:</b> Подводная станция «Глубина» рядом (30м к востоку). Все системы на мониторах в рубке.<br><br>
    <b>УПРАВЛЕНИЕ:</b><br>
    <kbd>W A S D</kbd> — движение · <kbd>МЫШЬ</kbd> — осмотр · <kbd>E</kbd> — взаимодействие<br>
    <kbd>ЛКМ</kbd> (зажать) — тянуть рычаг / крутить вентиль / тушить / чинить<br>
    <kbd>G</kbd> — бросить предмет · <kbd>SHIFT</kbd> — бег · <kbd>F8</kbd> — спектатор<br><br>
    <b>МИССИИ (на мониторе «ЦЕЛИ»):</b><br>
    ① Запустить реактор (кнопки 1→2→3 в реакторном отсеке)<br>
    ② Запустить двигатель (лестница в машинный → рубильник → шина → пуск)<br>
    ③ Погрузиться до 100м (вентиль балласта на мостике)<br>
    ④ Установить 3 улучшения (верстак в машинном отсеке)<br>
    ⑤ Всплыть на поверхность<br><br>
    <span class="warn">⚠ Пожары тушите огнетушителем. Течи чините ключом. Следите за мониторами!</span>
  </div>
  <div class="settings-panel" aria-label="Настройки запуска">
    <div class="settings-title">НАСТРОЙКИ</div>
    <label class="settings-row">
      <span>Громкость</span>
      <input id="settings-volume" type="range" min="0" max="100" value="80">
      <b id="settings-volume-value">80%</b>
    </label>
    <label class="settings-check">
      <input id="settings-mute" type="checkbox">
      <span>Без звука</span>
    </label>
    <div class="settings-note">Рендер ограничен до 180 FPS; звук можно менять до и после запуска.</div>
  </div>
  <div class="start-actions">
    <button id="btn-start">ПРИНЯТЬ УПРАВЛЕНИЕ</button>
    <button id="btn-fullscreen" type="button">НА ВЕСЬ ЭКРАН</button>
  </div>
</section>

<!-- ============ END SCREEN ============ -->
<section id="end-screen">
  <h1 id="end-title" class="title-big"></h1>
  <p id="end-text"></p>
  <button class="btn-restart" onclick="location.reload()">↻ НОВАЯ МИССИЯ</button>
</section>

<!-- ============ 3D ============ -->
<main id="game-root">
  <canvas id="game-canvas"></canvas>
  <div id="crosshair">+</div>
  <div id="interact-hint"></div>
</main>

<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }
</script>
<script type="module" src="/static/js/main3d.js"></script>
</body>
</html>`)
})

export default app
