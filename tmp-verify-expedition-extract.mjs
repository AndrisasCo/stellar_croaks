/**
 * Проверка кнопки «Закончить немедленно» (Экстренный маяк) на РЕАЛЬНОМ коде.
 *
 * Правила:
 *   1) маяк до прибытия в сектор забирает только то, что уже лежит в рюкзаке:
 *      множителя удачи и добора до нормы фермы нет;
 *   2) если команда не дошла до сектора, поход не может быть успешным — даже
 *      при шансе удачи 100%;
 *   3) маяк на обратном пути — только телепорт: исход и добыча считаются ровно
 *      так же, как при обычном возвращении (удача, множитель добычи, добор до
 *      нормы), просто без ожидания таймера;
 *   4) при отзыве с середины пути обычный (не маяковый) возврат тоже не успешен.
 *
 * Запуск: node tmp-verify-expedition-extract.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-extract-"));
const root = process.cwd();

/** Собрать модуль проекта в CJS, чтобы запустить его в node */
const bundle = (entry, name) => {
  const outfile = join(outDir, `${name}.cjs`);
  execFileSync(
    "npx",
    [
      "esbuild",
      entry,
      "--bundle",
      "--format=cjs",
      "--platform=node",
      "--log-level=error",
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );

  return require(outfile);
};

const HOUR_MS = 60 * 60 * 1000;
const LS_KEY = "Game_State6";

/** Жаба с запасом HP: события пути не должны выбить её в тестах */
const toad = (id = 1) => ({
  id,
  name: `Жаба ${id}`,
  stage: "adult",
  generation: 1,
  sex: "female",
  type: "hybrid",
  scene_id: 1,
  homeId: 1,
  created_at: new Date().toISOString(),
  parents: null,
  state: { hunger: 100 },
  pregnancy: null,
  status: "out",
  energy: 100,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 60,
    speed: 1.5,
    rarity: 20,
    hungerRate: 1.5,
    fertility: 3,
    personality: null,
  },
});

const makeState = (patch = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 50,
    astro_quax: 10,
    biomass: 100,
    storage: { food: 100, contourPass: 0 },
  },
  scenes: [{ id: 1, name: "Био Под", capacity: 2, created_at: "" }],
  toads: [toad()],
  colony: { rooms: [] },
  expeditions: [],
  expeditionStats: {
    completed: 0,
    bestDepth: 0,
    downed: 0,
    unlockedSectors: [],
  },
  lastSaved: "",
  createdAt: "",
  ...patch,
});
/** Рюкзак, который «уже добыт по логам» */
const rawLoot = {
  biomass: 12,
  tokens: 7,
  astro_quax: 2,
  items: { food: 3 },
  samples: 1,
};

const expedition = (patch = {}) => ({
  id: "e1",
  sectorId: 1,
  team: [{ toadId: 1, role: "scout" }],
  startedAt: Date.now(),
  phase: "outbound",
  progress: 0,
  resolvedSteps: 1,
  successChance: 1,
  loot: { ...rawLoot, items: { ...rawLoot.items } },
  log: [],
  ...patch,
});

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const models = bundle("src/models/expedition.ts", "models-expedition");
const manager = bundle("src/utils/expedition-manager.ts", "expedition-manager");

const failures = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures.push(
      `${label}: получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`,
    );
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${JSON.stringify(actual)}`);
};

const reset = (state) => {
  store.clear();
  store.set(LS_KEY, JSON.stringify(state));
};
const saved = () => JSON.parse(store.get(LS_KEY));
const savedExpedition = () => saved().expeditions[0];

/** События похода случайны: фиксируем rng, чтобы проверка была воспроизводимой */
const realRandom = Math.random;
Math.random = () => 0.99;

const SECTOR = models.SECTORS[0];
const OUTBOUND_MS = SECTOR.durationHours * HOUR_MS;
/** `EXPEDITION_GOOD_FINISH_LOOT` из `expedition-config.ts` */
const GOOD_FINISH_LOOT = 1.7;

console.log("\n[1] Маяк на середине пути: только добытое, поход не успешен");
console.log("─".repeat(60));
reset(makeState({ expeditions: [expedition()] }));

const extracted = manager.extractExpedition("e1");
const midway = savedExpedition();

check("маяк сработал", extracted.success, true);
check("поход завершён", midway.phase, "completed");
check("без прибытия в сектор успеха нет", midway.success, false);
check("добыча ровно из рюкзака", midway.loot, rawLoot);
check("астро-кваксы списаны", saved().user.astro_quax, 7);
check(
  "множитель удачи не начислен",
  midway.log.some((entry) => entry.text.includes("×1.7")),
  false,
);
check(
  "добора до нормы фермы нет",
  midway.log.some((entry) => entry.text.includes("добрала норму")),
  false,
);

console.log("\n[2] Маяк на обратном пути: итог как при обычном возвращении");
console.log("─".repeat(60));
/** Обратный путь: команда уже была в секторе и сама везёт добычу домой */
const returnPatch = {
  startedAt: Date.now() - 2 * HOUR_MS,
  phase: "returning",
  progress: 1,
  resolvedSteps: 9,
  reachedSector: true,
  returnHours: 5,
};

// Эталон: команда доходит до дома сама — возврат уже истёк по времени.
reset(
  makeState({
    expeditions: [
      expedition({ ...returnPatch, returnStartedAt: Date.now() - 6 * HOUR_MS }),
    ],
  }),
);
manager.processExpeditions();
const naturalReturn = savedExpedition();

// Тот же поход, но игрок жмёт маяк в начале обратного пути.
reset(
  makeState({
    expeditions: [expedition({ ...returnPatch, returnStartedAt: Date.now() })],
  }),
);
manager.extractExpedition("e1");
const teleported = savedExpedition();

check("маяк вернул команду домой", teleported.phase, "completed");
check(
  "исход как при обычном возврате",
  teleported.success,
  naturalReturn.success,
);
check("добыча как при обычном возврате", teleported.loot, naturalReturn.loot);
check(
  "удача умножила добычу",
  teleported.loot.biomass,
  Math.round(rawLoot.biomass * GOOD_FINISH_LOOT),
);
check(
  "в журнале есть множитель удачи",
  teleported.log.some((entry) => entry.text.includes("×1.7")),
  true,
);
check(
  "в отчёте удачный поход, а не эвакуация",
  teleported.log.some(
    (entry) =>
      entry.text.includes("Удачный поход") &&
      !entry.text.includes("эвакуирована"),
  ),
  true,
);

console.log("\n[2b] Маяк на обратном пути добирает норму фермы");
console.log("─".repeat(60));
/** Пустой рюкзак: добыча целиком зависит от нормы «поход выгоднее фермы» */
const emptyLoot = {
  biomass: 0,
  tokens: 0,
  astro_quax: 0,
  items: {},
  samples: 0,
};

reset(
  makeState({
    expeditions: [
      expedition({
        ...returnPatch,
        returnStartedAt: Date.now() - 6 * HOUR_MS,
        loot: { ...emptyLoot },
      }),
    ],
  }),
);
manager.processExpeditions();
const naturalFloor = savedExpedition();

reset(
  makeState({
    expeditions: [
      expedition({
        ...returnPatch,
        returnStartedAt: Date.now(),
        loot: { ...emptyLoot },
      }),
    ],
  }),
);
manager.extractExpedition("e1");
const teleportedFloor = savedExpedition();

// В текущем балансе норма фермы для этого похода — 72 🔷.
check("норма фермы добрана", naturalFloor.loot.tokens, 72);
check(
  "маяк добрал столько же",
  teleportedFloor.loot.tokens,
  naturalFloor.loot.tokens,
);
check(
  "в журнале есть добор до нормы",
  teleportedFloor.log.some((entry) => entry.text.includes("добрала норму")),
  true,
);

console.log("\n[3] Отзыв с середины пути: обычный возврат тоже не успешен");
console.log("─".repeat(60));
reset(
  makeState({
    expeditions: [
      expedition({
        startedAt: Date.now() - 0.5 * HOUR_MS,
        progress: 0.33,
        resolvedSteps: 3,
      }),
    ],
  }),
);

const withdrawn = manager.withdrawExpedition("e1");
check("отзыв сработал", withdrawn.success, true);

// Возврат уже истёк: сдвигаем его старт в прошлое, чтобы завершить поход.
const beforeArrival = saved();
beforeArrival.expeditions[0].returnStartedAt =
  Date.now() - (beforeArrival.expeditions[0].returnHours + 1) * HOUR_MS;
store.set(LS_KEY, JSON.stringify(beforeArrival));
manager.processExpeditions();
const withdrawnHome = savedExpedition();

check("поход завершён", withdrawnHome.phase, "completed");
check(
  "ранний разворот не успешен даже при шансе 100%",
  withdrawnHome.success,
  false,
);

console.log("\n[4] Старый сейв на обратном пути: прибытие определяется по времени");
console.log("─".repeat(60));
const oldStartedAt = Date.now() - 3 * HOUR_MS;
reset(
  makeState({
    expeditions: [
      expedition({
        startedAt: oldStartedAt,
        phase: "returning",
        progress: 1,
        resolvedSteps: 9,
        returnStartedAt: oldStartedAt + OUTBOUND_MS,
        returnHours: 5,
      }),
    ],
  }),
);

manager.extractExpedition("e1");
const legacyReturn = savedExpedition();

check("возврат после прибытия успешен без флага", legacyReturn.success, true);
check(
  "добыча пересчитана как при обычном возврате",
  legacyReturn.loot.biomass,
  Math.round(rawLoot.biomass * GOOD_FINISH_LOOT),
);

Math.random = realRandom;

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}
console.log(
  "✅ Маяк на обратном пути не меняет исход, до прибытия — только рюкзак",
);

