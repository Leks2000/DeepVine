// ============ ГЛОБАЛЬНОЕ СОСТОЯНИЕ ИГРЫ ============
export const G = {
  // three.js
  scene: null, camera: null, renderer: null, clock: null,

  // пользовательские настройки
  settings: { volume: 0.8, muted: false, fpsCap: 180 },

  // мир
  colliders: [],        // THREE.Box3 — статичные препятствия
  interactables: [],    // зарегистрированные интерактивные объекты
  exterior: null,       // группа внешнего мира (палуба, океан)
  oceanMeshes: [],      // плитки океана вокруг корпуса (без пересечения интерьера)
  interiorLights: [],   // лампы по отсекам
  emergencyLights: [],  // аварийные лампы
  emergencyOn: false,   // аварийное освещение активно

  // sonar
  sonar: null,

  // база
  baseStation: null,
  baseBeacon: null,

  // лут
  lootCrates: [],
  player: null,
  held: null,           // { type, mesh, data } — предмет в руках

  // симуляция (заполняется sim.js)
  sim: null,

  // флаги
  flags: { started: false, over: false, outside: false, spectator: false },

  // шлюз
  airlock: { innerOpen: false, outerOpen: false, flooded: false },

  // dev
  devOverlay: null,

  // сервисы (заполняются модулями)
  hud: null,
  sfx: null,
  hazards: null,
  upgrades: null,
  controls: null,
};

// Регистрация интерактивного объекта.
// def: { mesh, hint:()=>string, canUse:()=>bool,
//        onPress:()=>void,                        — клавиша E
//        drag:{ start(), move(dx,dy), end() },    — зажать ЛКМ и тянуть
//        hold:{ tick(dt), start(), end() } }      — удерживать ЛКМ
export function registerInteractable(def) {
  def.mesh.traverse(o => { o.userData.interactable = def; });
  def.mesh.userData.interactable = def;
  G.interactables.push(def);
  return def;
}

export function unregisterInteractable(def) {
  const i = G.interactables.indexOf(def);
  if (i >= 0) G.interactables.splice(i, 1);
  def.mesh.traverse(o => { delete o.userData.interactable; });
}

export function addCollider(min, max) {
  G.colliders.push({ min, max });
}
