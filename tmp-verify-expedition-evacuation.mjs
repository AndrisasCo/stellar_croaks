/**
 * Проверка эвакуации выбитой команды на РЕАЛЬНОМ коде проекта.
 *
 * Правила:
 *   1) после полного вайпа таймер возврата не идёт: поход ждёт платной
 *      эвакуации, `processExpeditions` его не завершает;
 *   2) эвакуация стоит 100 🔷 за глубину сектора и списывает Кваксы;
 *   3) без нужной суммы поход остаётся ждать, деньги не списываются;
 *   4) после оплаты команда сразу дома, но с потерей половины добычи;
 *   5) старые сейвы с `forced` без флага по-прежнему возвращаются по таймеру.
 *
 * Запуск: node tmp-verify-expedition-evacuation.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-evacuation-"));
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

/** Жаба с нулевым HP: первый же шаг пути выбьет всю команду */
const toad = (id = 1, patch = {}) => ({
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
  hp: 0,
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
  ...patch,
});

const makeState = (patch = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 250,
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

/** Рюкзак, который команда уже добыла до вайпа */
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
  startedAt: Date.now() - 2 * HOUR_MS,
  phase: "outbound",
  progress: 0,
  resolvedSteps: 0,
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
const config = bundle("src/utils/expedition-config.ts", "expedition-config");
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

console.log("\n[1] Цена эвакуации: 100 🔷 за каждую глубину");
console.log("─".repeat(60));
check("глубина 1", config.getEvacuationCost(SECTOR), 100);
check("глубина 3", config.getEvacuationCost(models.SECTORS[2]), 300);
check(
  "нулевая глубина не бесплатна",
  config.getEvacuationCost({ depth: 0 }),
  100,
);

console.log("\n[2] Полный вайп: таймер стоит, поход не завершается сам");
console.log("─".repeat(60));
reset(makeState({ expeditions: [expedition()] }));

manager.processExpeditions();
const wiped = savedExpedition();

check("фаза — возврат", wiped.phase, "returning");
check("поход помечен выбитым", wiped.forced, true);
check("ждёт эвакуации", wiped.awaitingEvacuation, true);
check("обратный отсчёт не запущен", wiped.returnStartedAt, undefined);
check("часов возврата нет", wiped.returnHours, undefined);
check("до дома часов не осталось", config.getReturnRemainingHours(wiped), 0);
check("ускорять нечего", config.getSpeedUpReturnCost(wiped), 0);
check("таймер прибытия не идёт", manager.getExpeditionEtaMs(wiped), 0);
check("ускорить возврат нельзя", manager.speedUpReturn("e1").success, false);
check("отозвать тоже нельзя", manager.withdrawExpedition("e1").success, false);

manager.processExpeditions();
check("повторный тик не завершил поход", savedExpedition().phase, "returning");
check(
  "повторный тик не выдал добычу",
  savedExpedition().completedAt,
  undefined,
);
check("вайп после прибытия: сектор засчитан", wiped.reachedSector, true);

console.log("\n[2b] Вайп в пути: сектор не засчитан, эвакуация всё равно ждёт");
console.log("─".repeat(60));
reset(
  makeState({
    expeditions: [expedition({ startedAt: Date.now() - 0.25 * HOUR_MS })],
  }),
);

manager.processExpeditions();
const wipedMidway = savedExpedition();

check("ждёт эвакуации", wipedMidway.awaitingEvacuation, true);
check("сектор не засчитан", wipedMidway.reachedSector, undefined);
check("прогресс меньше 100%", wipedMidway.progress < 1, true);

console.log("\n[3] Не хватает Кваксов: поход ждёт, деньги не списываются");
console.log("─".repeat(60));
reset(
  makeState({
    user: { ...makeState().user, tokens: 50 },
    expeditions: [
      expedition({
        phase: "returning",
        progress: 1,
        forced: true,
        awaitingEvacuation: true,
      }),
    ],
  }),
);

const poor = manager.evacuateExpedition("e1");
check("эвакуация отклонена", poor.success, false);
check("Кваксы не списаны", saved().user.tokens, 50);
check("поход всё ещё ждёт", savedExpedition().phase, "returning");
check("флаг эвакуации сохранён", savedExpedition().awaitingEvacuation, true);

console.log(
  "\n[4] Оплата: команда сразу дома, половина добычи осталась в секторе",
);
console.log("─".repeat(60));
reset(
  makeState({
    expeditions: [
      expedition({
        phase: "returning",
        progress: 1,
        forced: true,
        awaitingEvacuation: true,
        reachedSector: true,
      }),
    ],
  }),
);

const evacuated = manager.evacuateExpedition("e1");
const home = savedExpedition();

check("эвакуация сработала", evacuated.success, true);
check("списано 100 🔷", saved().user.tokens, 150);
check("поход завершён", home.phase, "completed");
check("флаг эвакуации снят", home.awaitingEvacuation, false);
check("добыча: биомасса вдвое меньше", home.loot.biomass, 6);
check("добыча: Кваксы вдвое меньше", home.loot.tokens, 4);
check("добыча: астро-кваксы вдвое меньше", home.loot.astro_quax, 1);
check("добыча: предметы вдвое меньше", home.loot.items, { food: 1 });
check("поход без успеха — удача не бросалась", home.success, false);
check(
  "в журнале есть строка об эвакуации",
  home.log.some((entry) => entry.text.includes("эвакуировали")),
  true,
);

console.log("\n[4b] Экстренный маяк тоже снимает ожидание эвакуации");
console.log("─".repeat(60));
reset(
  makeState({
    expeditions: [
      expedition({
        phase: "returning",
        progress: 1,
        forced: true,
        awaitingEvacuation: true,
      }),
    ],
  }),
);

const beacon = manager.extractExpedition("e1");
const rescued = savedExpedition();

check("маяк сработал", beacon.success, true);
check("команда дома", rescued.phase, "completed");
check("флаг эвакуации снят", rescued.awaitingEvacuation, false);
check("Кваксы не тронуты", saved().user.tokens, 250);
check("списаны Астро-кваксы", saved().user.astro_quax, 7);

console.log("\n[5] Старый сейв: forced без флага возвращается по таймеру");
console.log("─".repeat(60));
reset(
  makeState({
    expeditions: [
      expedition({
        phase: "returning",
        progress: 1,
        forced: true,
        reachedSector: true,
        returnStartedAt: Date.now() - 2 * HOUR_MS,
        returnHours: 1,
      }),
    ],
  }),
);

manager.processExpeditions();
const legacy = savedExpedition();

check("старый поход завершился сам", legacy.phase, "completed");
check("флаг так и не появился", legacy.awaitingEvacuation, undefined);
check("Кваксы не списаны задним числом", saved().user.tokens, 250);

Math.random = realRandom;

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}
console.log(
  "✅ Выбитая команда ждёт платной эвакуации, старые сейвы не ломаются",
);
