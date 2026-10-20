/**
 * Проверка агрессивности походов на РЕАЛЬНОМ коде проекта.
 *
 * Фиксируем новые правила:
 *   1) весь урон событий похода умножен на 1.2 поверх опасности сектора;
 *   2) минимальный урон не срезается новым множителем;
 *   3) на возврате команда с базовым шансом 20% приносит болезнь;
 *   4) болезнь получает только живая и ещё не болеющая жаба;
 *   5) завершённый поход действительно записывает болезнь в состояние жабы;
 *   6) событие-попутчик даёт случайную жабу из лутбокса, не тратя pity;
 *   7) второй попутчик за поход не выпадает;
 *   8) на возврате попутчик поселяется в биопод, а без места — не создаётся.
 *
 * Запуск: node tmp-verify-expedition-aggression.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-expedition-aggression-"));
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
const near = (actual, expected) => Math.abs(actual - expected) < 1e-9;

globalThis.CustomEvent ||= class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
globalThis.window ||= {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  Telegram: { WebApp: { initDataUnsafe: {} } },
};

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window.localStorage = globalThis.localStorage;

const models = bundle("src/models/expedition.ts", "models-expedition");
const config = bundle("src/utils/expedition-config.ts", "expedition-config");
const events = bundle("src/utils/expedition-events.ts", "expedition-events");
const manager = bundle("src/utils/expedition-manager.ts", "expedition-manager");
const lootbox = bundle("src/models/Toad/lootbox.ts", "toad-lootbox");
const species = bundle("src/models/Toad/toad-species.ts", "toad-species");

const HOUR_MS = 60 * 60 * 1000;
const LS_KEY = "Game_State6";

const toad = (id, over = {}) => ({
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
  state: { hunger: 100, hp: 250, energy: 100 },
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
  ...over,
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
  toads: [toad(1)],
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

const reset = (state) => {
  store.clear();
  store.set(LS_KEY, JSON.stringify(state));
};
const saved = () => JSON.parse(store.get(LS_KEY));

/** rng по заданной последовательности: удобно проверить порог и выбор */
const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

console.log("\n[1] Урон событий: +20% поверх опасности сектора");
console.log("─".repeat(64));
const shallow = models.SECTORS[0];
const bunker = models.SECTORS[1];
check(
  "глобальный множитель урона",
  config.EXPEDITION_DAMAGE_MULTIPLIER,
  1.2,
);
check(
  "стартовый сектор: 1 × 1.2",
  config.getSectorDamageMultiplier(shallow),
  1.2,
);
check(
  "затопленный бункер: 1.15 × 1.2",
  near(config.getSectorDamageMultiplier(bunker), 1.38),
  true,
);
check(
  "scaleDamage(10) в стартовом секторе",
  events.scaleDamage({ sector: shallow }, 10),
  12,
);
check(
  "scaleDamage(10) в бункере",
  events.scaleDamage({ sector: bunker }, 10),
  14,
);
check(
  "минимальный урон не срезан",
  events.scaleDamage({ sector: shallow }, 1),
  config.EXPEDITION_MIN_DAMAGE,
);

console.log("\n[2] Базовый шанс принести болезнь — 20%");
console.log("─".repeat(64));
check(
  "шанс болезни",
  config.EXPEDITION_BASE_DISEASE_CHANCE,
  0.2,
);
check(
  "бросок 20% и выше — болезнь не принесена",
  config.rollExpeditionDisease([toad(1)], () => 0.2),
  null,
);

const hit = config.rollExpeditionDisease([toad(1)], sequence(0.19, 0, 0));
check("бросок ниже 20% — болезнь выбрана", Boolean(hit), true);
check("заболела живая жаба", hit?.toad.id, 1);
check("выбрана первая болезнь", hit?.disease.id, "firmware_glitch");

check(
  "мёртвая жаба болезнь не получает",
  config.rollExpeditionDisease([toad(1, { hp: 0 })], sequence(0, 0, 0)),
  null,
);
check(
  "уже болеющая жаба не перезаписывается",
  config.rollExpeditionDisease(
    [
      toad(1, {
        state: {
          hunger: 100,
          hp: 250,
          energy: 100,
          diseaseId: 1,
          diseaseUntil: Date.now() + HOUR_MS,
        },
      }),
    ],
    sequence(0, 0, 0),
  ),
  null,
);
const healthyOnly = config.rollExpeditionDisease(
  [toad(1, { hp: 0 }), toad(2)],
  sequence(0, 0, 0),
);
check("выбирается только живая здоровая жаба", healthyOnly?.toad.id, 2);

console.log("\n[3] Завершённый поход записывает болезнь на возврате");
console.log("─".repeat(64));
const now = Date.now();
const returning = {
  id: "e1",
  sectorId: 1,
  team: [{ toadId: 1, role: "scout" }],
  startedAt: now - 4 * HOUR_MS,
  phase: "returning",
  progress: 1,
  resolvedSteps: 9,
  successChance: 1,
  reachedSector: true,
  returnStartedAt: now - 2 * HOUR_MS,
  returnHours: 0.75,
  loot: { biomass: 12, tokens: 8, astro_quax: 0, items: {}, samples: 0 },
  log: [],
};
reset(makeState({ expeditions: [returning] }));

const realRandom = Math.random;
Math.random = () => 0;
try {
  manager.processExpeditions();
} finally {
  Math.random = realRandom;
}

const after = saved();
const sick = after.toads[0];
check("поход завершён", after.expeditions[0].phase, "completed");
check("у жабы появилась болезнь", sick.state.diseaseId, 0);
check(
  "срок болезни выставлен вперёд",
  (sick.state.diseaseUntil ?? 0) > Date.now(),
  true,
);
check(
  "в логе похода есть отметка о болезни",
  after.expeditions[0].log.some((entry) => entry.text.includes("подхватила")),
  true,
);

console.log("\n[4] Случайный попутчик в походе");
console.log("─".repeat(64));
store.delete("toad_lootbox_pity");
const rolledCompanion = lootbox.generateRandomLootboxToad(1, () => 0);
check(
  "случайная жаба не тратит pity лутбокса",
  store.has("toad_lootbox_pity"),
  false,
);
check(
  "тип попутчика — из таблицы жаб",
  Object.values(species.ToadTypes).includes(rolledCompanion.baseToad.type),
  true,
);
check("попутчик взрослый", rolledCompanion.baseToad.stage, "adult");

const companionEvent = events.EXPEDITION_EVENTS.find(
  (event) => event.id === "stowaway_toad",
);
check("событие попутчика есть в пуле", Boolean(companionEvent), true);

const joined = [];
const companionLogs = [];
const companionCtx = {
  expedition: { companions: [] },
  sector: shallow,
  alive: [],
  byRole: () => null,
  randomMember: () => null,
  check: () => true,
  damage: () => 0,
  teamDamage: () => ({ total: 0, absorbed: 0 }),
  heal: () => 0,
  loot: () => {},
  infect: () => null,
  join: (toad) => {
    joined.push(toad);
    return true;
  },
  log: (entry) => companionLogs.push(entry),
  rng: () => 0,
};
companionEvent.run(companionCtx);
check("событие присоединило одну жабу", joined.length, 1);
check("попутчик получил случайный тип", Boolean(joined[0].type), true);
check(
  "в чате есть сообщение о попутчике",
  companionLogs[0]?.text.includes("прибилась"),
  true,
);
check("повторное событие доступно без попутчика", companionEvent.available(companionCtx), true);
check(
  "повторное событие исключено, когда попутчик уже есть",
  companionEvent.available({ ...companionCtx, expedition: { companions: joined } }),
  false,
);

console.log("\n[5] Попутчик поселяется в биопод на возврате");
console.log("─".repeat(64));
const companion = {
  name: "Вентиляционная Ванда",
  type: species.ToadTypes.cosmos,
  generation: 1,
  sex: "female",
  stage: "adult",
  parents: null,
  pregnancy: null,
  state: { hunger: 50, genetic_fault: 0 },
  genes: {
    colors: ["#111111", "#222222"],
    pattern: "smooth",
    weight: 20,
    speed: 1,
    rarity: 10,
    hungerRate: 1,
    fertility: 1,
    personality: null,
  },
};
const nowWithCompanion = Date.now();
const returningWithCompanion = {
  ...returning,
  id: "e2",
  startedAt: nowWithCompanion - 4 * HOUR_MS,
  returnStartedAt: nowWithCompanion - 2 * HOUR_MS,
  companions: [companion],
};
reset(makeState({ expeditions: [returningWithCompanion] }));

const randomBeforeCompanion = Math.random;
Math.random = () => 0.9;
try {
  manager.processExpeditions();
} finally {
  Math.random = randomBeforeCompanion;
}

const afterCompanion = saved();
const settledCompanion = afterCompanion.toads.find(
  (item) => item.name === companion.name,
);
check("попутчик создан в колонии", Boolean(settledCompanion), true);
check("попутчик живёт в биоподе", settledCompanion?.scene_id, 1);
check("попутчик помнит дом", settledCompanion?.homeId, 1);
check("очередь попутчиков очищена", afterCompanion.expeditions[0].companions, []);
check(
  "отчёт похода упоминает попутчика",
  afterCompanion.expeditions[0].log.some((entry) =>
    entry.text.includes("Попутчик"),
  ),
  true,
);

const nowNoSpace = Date.now();
reset(
  makeState({
    scenes: [{ id: 1, name: "Био Под", capacity: 1, created_at: "" }],
    expeditions: [
      {
        ...returningWithCompanion,
        id: "e3",
        startedAt: nowNoSpace - 4 * HOUR_MS,
        returnStartedAt: nowNoSpace - 2 * HOUR_MS,
      },
    ],
  }),
);
Math.random = () => 0.9;
try {
  manager.processExpeditions();
} finally {
  Math.random = randomBeforeCompanion;
}
const afterNoSpace = saved();
check("без места попутчик не создан", afterNoSpace.toads.length, 1);
check(
  "отчёт честно говорит об отсутствии места",
  afterNoSpace.expeditions[0].log.some((entry) =>
    entry.text.includes("не поместилось в биопод"),
  ),
  true,
);

console.log("\n" + "─".repeat(64));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}

console.log(
  "✅ Походы стали агрессивнее: урон +20%, базовый риск болезни 20%, случайный попутчик работает",
);

