// ============ MAIN BOOTSTRAP ============
(() => {
  let running = false;
  let lastT = 0;

  function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    AudioEngine.ensure();
    AudioEngine.startAmbient();
    Scene3D.init(document.getElementById('ocean-canvas'));
    UI.buildControls();
    Game.log('=== СУБМАРИНА «ТИФОН-9» — СИСТЕМЫ В РЕЖИМЕ ОЖИДАНИЯ ===');
    Game.log('▶ Запустите реактор: кнопки 1 → 2 → 3 на энергощитке');
    Game.log('▶ Включите вентиляцию и очистку воздуха');
    Game.log('▶ Включите прожекторы и погружайтесь к руинам (заполнить балласт)');
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (running) {
      Game.tick(dt);
      UI.update(dt);
      Scene3D.update(Game.viewState(), dt);
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-restart')?.addEventListener('click', () => location.reload());
  });
})();
