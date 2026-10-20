/**
 * Проверка оффлайн-прогресса походов на РЕАЛЬНОМ коде проекта.
 *
 * Походы не имеют серверного таймера: `processExpeditions()` «догоняет» путь по
 * часам, когда игра запущена. Проверяем, что догон не сдвигает таймлайн:
 *   1) команда, у которой путь «туда» закончился, пока игра была закрыта,
 *      разворачивается в момент прибытия в сектор, а не в момент входа в игру;
 *   2) если к моменту входа истёк и обратный путь, поход сразу завершается —
 *      оффлайн-время не сгорает;
 *   3) обратный путь по-прежнему равен половине пройденного (0.5 × 1.5 ч = 0.75 ч).
 *
 * Запуск: node tmp-verify-expedition-offline.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-offline-"));
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

/**
 * Жаба на поход. Масса и качество дают 250 HP — событий на пути девять,
 * даже при худшем раскладе команда не выбьется и поход завершится штатно.
 */
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
    astro_quax: 0,
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

/** Поход в стартовый сектор (путь туда — 1.5 ч), уже в пути */
const outbound = (startedAt) => ({
  id: "e1",
  sectorId: 1,
  team: [{ toadId: 1, role: "scout" }],
  startedAt,
  phase: "outbound",
  progress: 0,
  resolvedSteps: 0,
  successChance: 0,
  loot: {
    biomass: 0,
    tokens: 0,
    astro_quax: 0,
    items: {},
    samples: 0,
  },
  log: [],
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

/** Почти-секунда допуска: сейв и тик идут в реальном времени */
const near = (actual, expected) => Math.abs(actual - expected) < 1000;

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
const RETURN_HOURS = 0.75; // 0.5 × 1.5 ч

console.log("\n[1] Путь «туда» закончился в оффлайне — возврат идёт по часам");
console.log("─".repeat(60));
const startedAt = Date.now() - 2 * HOUR_MS;
reset(makeState({ expeditions: [outbound(startedAt)] }));

// Первый тик «догоняет» шесть событий, второй — остальные три и разворот.
manager.processExpeditions();
check("после первого тика команда ещё в пути", savedExpedition().phase, "outbound");

manager.processExpeditions();
const returning = savedExpedition();
check("после догона команда возвращается", returning.phase, "returning");
check(
  "возврат начался в момент прибытия в сектор",
  near(returning.returnStartedAt, startedAt + OUTBOUND_MS),
  true,
);
check("обратный путь — половина пройденного", returning.returnHours, RETURN_HOURS);
check(
  "вход в игру не сдвинул старт возврата на «сейчас»",
  near(returning.returnStartedAt, Date.now()),
  false,
);

console.log("\n[2] Оффлайн длиннее всего рейса — команда уже дома");
console.log("─".repeat(60));
const longAgo = Date.now() - 8 * HOUR_MS;
reset(makeState({ expeditions: [outbound(longAgo)] }));

manager.processExpeditions();
manager.processExpeditions();
const completed = savedExpedition();
check("поход завершён без ожидания обратного пути", completed.phase, "completed");
check(
  "возврат стартовал в момент прибытия, а не при входе",
  near(completed.returnStartedAt, longAgo + OUTBOUND_MS),
  true,
);
check("добыча ждёт разбора", Array.isArray(completed.log), true);
check("поход засчитан в статистике", saved().expeditionStats.completed, 1);

Math.random = realRandom;

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}
console.log("✅ Оффлайн-походы идут по часам, а не по моменту входа в игру");
