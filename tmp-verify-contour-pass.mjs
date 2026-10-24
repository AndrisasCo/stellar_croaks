/**
 * Проверка экономики пропусков КОНТУРа на РЕАЛЬНОМ коде проекта.
 *
 * Скрипт бандлит модели, конфиг и менеджер походов через esbuild и прогоняет их
 * в node с подменённым localStorage, поэтому проверяются те же функции, что
 * работают в игре:
 *   1) цена открытия сектора и награда пропусками растут с глубиной;
 *   2) старый сейв без `unlockedSectors` получает секторы по прежним порогам
 *      завершённых походов, а новый сейв — нет;
 *   3) открытие списывает пропуска со склада и сохраняет сектор открытым;
 *   4) КОНТУР проходится по порядку: предыдущий сектор должен быть открыт
 *      и пройден хотя бы раз;
 *   5) только удачный завершённый поход начисляет пропуск на склад;
 *      в добыче похода пропуск показывается отдельно и в биомассу не уходит;
 *   6) пропуска лежат на складе, но не занимают полки и не вытесняют добычу.
 *
 * Запуск: node tmp-verify-contour-pass.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-contour-"));
const root = process.cwd();

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

/** Жаба для похода: нужны только гены, HP и имя */
const toad = (id = 1) => ({
  id,
  name: `Жаба ${id}`,
  stage: "adult",
  generation: 1,
  sex: "male",
  type: "hybrid",
  scene_id: 1,
  homeId: 1,
  created_at: new Date().toISOString(),
  parents: null,
  state: { hunger: 100 },
  pregnancy: null,
  status: "ok",
  hp: 100,
  maxHp: 100,
  energy: 100,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 15,
    speed: 1,
    rarity: 1,
    hungerRate: 1,
    fertility: 1,
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
    storage: { food: 0, contourPass: 0 },
  },
  scenes: [{ id: 1, name: "Био Под", capacity: 2, created_at: "" }],
  toads: [toad()],
  colony: { rooms: [] },
  expeditions: [],
  expeditionStats: {
    completed: 0,
    bestDepth: 0,
    downed: 0,
    completedSectors: [],
    unlockedSectors: [],
  },
  lastSaved: "",
  createdAt: "",
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
const storage = bundle("src/utils/storage.ts", "storage");

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

console.log("\n[1] Цены и награды КОНТУРа");
console.log("─".repeat(60));
check(
  "цены открытия",
  models.SECTORS.map((sector) => sector.unlockCost),
  [0, 1, 3, 6, 10, 15, 28, 40],
);
check(
  "пропусков за поход",
  models.SECTORS.map((sector) => config.getContourPassReward(sector)),
  [1, 2, 2, 3, 3, 4, 4, 5],
);
check(
  "шанс особого образца за успех",
  config.EXPEDITION_SAMPLE_TOAD_CHANCE,
  0.1,
);
check(
  "редкость образца растёт с глубиной",
  models.SECTORS.map((sector) => config.getExpeditionSampleReward(sector).rarity),
  [
    "common",
    "common",
    "uncommon",
    "uncommon",
    "rare",
    "rare",
    "epic",
    "legendary",
  ],
);
check(
  "жаба-образец закреплена за уровнем",
  models.SECTORS.map(
    (sector) => config.getExpeditionSampleReward(sector).template.name,
  ),
  [
    "Лесной странник",
    "Болотный житель",
    "Изумрудный прыгун",
    "Золотистый охотник",
    "Камнелап",
    "Сапфировый призрак",
    "Кваккон",
    "Галактрон",
  ],
);

console.log("\n[2] Совместимость со старыми сейвами");
console.log("─".repeat(60));
check(
  "старый сейв: 7 походов открывали секторы 2–4",
  models.normalizeExpeditionStats({ completed: 7, bestDepth: 4, downed: 0 })
    .unlockedSectors,
  [2, 3, 4],
);
check(
  "старый сейв: пройденные глубины выводятся из bestDepth",
  models.normalizeExpeditionStats({
    completed: 7,
    bestDepth: 4,
    downed: 0,
  }).completedSectors,
  [1, 2, 3, 4],
);
check(
  "новый сейв: пустой список открытых не заполняется за походы",
  models.normalizeExpeditionStats({
    completed: 7,
    bestDepth: 4,
    downed: 0,
    unlockedSectors: [],
  }).unlockedSectors,
  [],
);
check(
  "новый сейв: пустой список пройденных не заполняется за походы",
  models.normalizeExpeditionStats({
    completed: 7,
    bestDepth: 4,
    downed: 0,
    completedSectors: [],
  }).completedSectors,
  [],
);
check(
  "стартовый сектор открыт всегда",
  models.isSectorUnlocked(models.SECTORS[0], models.DEFAULT_EXPEDITION_STATS),
  true,
);
check(
  "второй сектор без открытия закрыт",
  models.isSectorUnlocked(models.SECTORS[1], models.DEFAULT_EXPEDITION_STATS),
  false,
);
check(
  "предыдущий сектор для третьего — второй",
  models.getPreviousSector(models.SECTORS[2])?.id,
  2,
);
check(
  "второй сектор открывается от стартового",
  models.isPreviousSectorUnlocked(
    models.SECTORS[1],
    models.DEFAULT_EXPEDITION_STATS,
  ),
  true,
);
check(
  "третий сектор не открыть без второго",
  models.isPreviousSectorUnlocked(
    models.SECTORS[2],
    models.DEFAULT_EXPEDITION_STATS,
  ),
  false,
);
check(
  "стартовый сектор в новом сейве ещё не пройден",
  models.isSectorCompleted(
    models.SECTORS[0],
    models.DEFAULT_EXPEDITION_STATS,
  ),
  false,
);
check(
  "второй сектор требует прохождения первого",
  models.isPreviousSectorCompleted(
    models.SECTORS[1],
    models.DEFAULT_EXPEDITION_STATS,
  ),
  false,
);
check(
  "первый сектор можно пройти",
  models.isSectorCompleted(models.SECTORS[0], {
    ...models.DEFAULT_EXPEDITION_STATS,
    completedSectors: [1],
  }),
  true,
);
check(
  "второй сектор открывается после прохождения первого",
  models.isPreviousSectorCompleted(models.SECTORS[1], {
    ...models.DEFAULT_EXPEDITION_STATS,
    completedSectors: [1],
  }),
  true,
);
reset(
  makeState({
    expeditionStats: { completed: 7, bestDepth: 4, downed: 0 },
  }),
);
check(
  "старый сейв на диске мигрирует при чтении",
  manager.getExpeditionStats().unlockedSectors,
  [2, 3, 4],
);
check(
  "старый сейв на диске помнит пройденные глубины",
  manager.getExpeditionStats().completedSectors,
  [1, 2, 3, 4],
);

console.log("\n[3] Покупка секторов за пропуска");
console.log("─".repeat(60));
/** Сейв для покупки: 10 пропусков и заданная статистика */
const purchaseState = (stats = {}) =>
  makeState({
    user: { ...makeState().user, storage: { food: 0, contourPass: 10 } },
    expeditionStats: {
      completed: 0,
      bestDepth: 0,
      downed: 0,
      completedSectors: [],
      unlockedSectors: [],
      ...stats,
    },
  });

reset(purchaseState());

check("сектор 3 до сектора 2 не открыть", manager.unlockSector(3), {
  success: false,
  message: "Сначала откройте «Затопленный бункер»",
});
check(
  "пропуска не списались за прыжок через один сектор",
  saved().user.storage.contourPass,
  10,
);
check("сектор 2 без прохождения первого не открыть", manager.unlockSector(2), {
  success: false,
  message:
    "Сначала пройдите «Ржавый шлюз»: отправьте команду и дождитесь возвращения",
});
check(
  "пропуска не списались за непройденный первый сектор",
  saved().user.storage.contourPass,
  10,
);

reset(purchaseState({ completed: 1, bestDepth: 1, completedSectors: [1] }));

check("открытие сектора 2", manager.unlockSector(2), {
  success: true,
  message: "Сектор «Затопленный бункер» открыт за 1 🎫",
});
check("пропусков после сектора 2", saved().user.storage.contourPass, 9);
check(
  "открытые секторы после сектора 2",
  saved().expeditionStats.unlockedSectors,
  [2],
);
check(
  "после открытия второй сектор ещё не пройден",
  models.isSectorCompleted(
    models.SECTORS[1],
    models.normalizeExpeditionStats(saved().expeditionStats),
  ),
  false,
);
check("сектор 3 без прохождения второго не открыть", manager.unlockSector(3), {
  success: false,
  message:
    "Сначала пройдите «Затопленный бункер»: отправьте команду и дождитесь возвращения",
});
check(
  "пропуска не списались за непройденный второй сектор",
  saved().user.storage.contourPass,
  9,
);

/** Второй сектор пройден: возвращаемся с похода, как в настоящей игре */
const afterSecond = saved();
afterSecond.expeditionStats = {
  ...afterSecond.expeditionStats,
  completed: 2,
  bestDepth: 2,
  completedSectors: [1, 2],
};
reset(afterSecond);

check(
  "после прохождения второго третья глубина доступна",
  models.isPreviousSectorCompleted(
    models.SECTORS[2],
    models.normalizeExpeditionStats(saved().expeditionStats),
  ),
  true,
);
check("открытие сектора 3", manager.unlockSector(3), {
  success: true,
  message: "Сектор «Станция «Периметр-3»» открыт за 3 🎫",
});
check("пропусков после сектора 3", saved().user.storage.contourPass, 6);
check(
  "открытые секторы после сектора 3",
  saved().expeditionStats.unlockedSectors,
  [2, 3],
);

check("прыжок через закрытый сектор запрещён", manager.unlockSector(8), {
  success: false,
  message: "Сначала откройте «Гидропонная станция»",
});
check("пропуска не списались за прыжок", saved().user.storage.contourPass, 6);

check("повторное открытие сектора 2", manager.unlockSector(2), {
  success: false,
  message: "Сектор «Затопленный бункер» уже открыт",
});
check("сектор 4 без прохождения третьего не открыть", manager.unlockSector(4), {
  success: false,
  message:
    "Сначала пройдите «Станция «Периметр-3»»: отправьте команду и дождитесь возвращения",
});
check(
  "пропуска не списались за непройденный третий сектор",
  saved().user.storage.contourPass,
  6,
);

/** Третий сектор пройден: открываем четвёртую глубину */
const afterThird = saved();
afterThird.expeditionStats = {
  ...afterThird.expeditionStats,
  completed: 3,
  bestDepth: 3,
  completedSectors: [1, 2, 3],
};
reset(afterThird);

check("открытие сектора 4", manager.unlockSector(4), {
  success: true,
  message: "Сектор «Орбитальный обломок» открыт за 6 🎫",
});
check("пропусков после сектора 4", saved().user.storage.contourPass, 0);
check(
  "открытые секторы после сектора 4",
  saved().expeditionStats.unlockedSectors,
  [2, 3, 4],
);

/** Четвёртый сектор пройден: теперь мешают только пропуска */
const afterFourth = saved();
afterFourth.expeditionStats = {
  ...afterFourth.expeditionStats,
  completed: 4,
  bestDepth: 4,
  completedSectors: [1, 2, 3, 4],
};
reset(afterFourth);

check("пропусков не хватает на сектор 5", manager.unlockSector(5), {
  success: false,
  message: "Для открытия нужно 10 🎫 пропуск(ов) КОНТУРа (сейчас 0)",
});
check("статус сектора 4", manager.getSectorUnlockStatus(models.SECTORS[3]), {
  unlocked: true,
  available: 0,
  required: 6,
});

console.log("\n[4] Награда за завершённый поход");
console.log("─".repeat(60));
const startedAt = Date.now() - 5 * HOUR_MS;
reset(
  makeState({
    expeditions: [
      {
        id: "e1",
        sectorId: 1,
        team: [{ toadId: 1, role: "scout" }],
        startedAt,
        phase: "returning",
        progress: 1,
        resolvedSteps: 9,
        returnStartedAt: Date.now() - HOUR_MS,
        returnHours: 0.25,
        successChance: 1,
        loot: {
          biomass: 10,
          tokens: 5,
          astro_quax: 0,
          items: {},
          samples: 0,
        },
        log: [],
      },
    ],
  }),
);

check("тик походов", manager.processExpeditions(), {
  events: 0,
  arrivals: 1,
  downed: 0,
});
check(
  "поход завершён, пропуск на складе",
  saved().user.storage.contourPass,
  1,
);
check("поход засчитан", saved().expeditionStats.completed, 1);
check(
  "первый сектор засчитан пройденным",
  saved().expeditionStats.completedSectors,
  [1],
);
check(
  "сектор 2 после награды всё ещё закрыт",
  saved().expeditionStats.unlockedSectors,
  [],
);
check(
  "пропуск записан в добычу похода",
  saved().expeditions[0].contourPasses,
  1,
);
check(
  "пропуск виден в строке добычи",
  manager.getExpeditionLootSummary(saved().expeditions[0]).endsWith("+1 🎫"),
  true,
);

const completedWithPass = saved().expeditions[0];
check(
  "пропуск не входит в переработку в биомассу",
  manager.getExpeditionBiomassValue({
    ...completedWithPass,
    contourPasses: 99,
  }),
  manager.getExpeditionBiomassValue({ ...completedWithPass, contourPasses: 0 }),
);
check(
  "разбор добычи в биомассу",
  manager.finishExpedition("e1", "biomass").success,
  true,
);
check(
  "пропуск остался на складе после переработки",
  saved().user.storage.contourPass,
  1,
);
check(
  "архив сохранил пропуск в добыче",
  saved().expeditionArchive[0].contourPasses,
  1,
);

/** Провал: до сектора дошли, но бросок удачи не сложился — пропуска не будет */
reset(
  makeState({
    expeditions: [
      {
        id: "e-fail",
        sectorId: 1,
        team: [{ toadId: 1, role: "scout" }],
        startedAt,
        phase: "returning",
        progress: 1,
        reachedSector: true,
        resolvedSteps: 9,
        returnStartedAt: Date.now() - HOUR_MS,
        returnHours: 0.25,
        successChance: 0,
        loot: {
          biomass: 10,
          tokens: 5,
          astro_quax: 0,
          items: {},
          samples: 0,
        },
        log: [],
      },
    ],
  }),
);

check("тик провального похода", manager.processExpeditions().arrivals, 1);
check(
  "провал не начисляет пропуск",
  saved().user.storage.contourPass,
  0,
);
check(
  "в провальном походе пропуска нет",
  saved().expeditions[0].contourPasses ?? 0,
  0,
);
check(
  "в строке добычи провала нет пропуска",
  manager.getExpeditionLootSummary(saved().expeditions[0]).includes("🎫"),
  false,
);
check(
  "провал всё равно засчитывает поход и сектор",
  {
    completed: saved().expeditionStats.completed,
    completedSectors: saved().expeditionStats.completedSectors,
    success: saved().expeditions[0].success,
  },
  { completed: 1, completedSectors: [1], success: false },
);
check(
  "провал не приносит особый образец",
  saved().expeditions[0].loot.lootboxSamples ?? 0,
  0,
);

reset(
  makeState({
    user: {
      ...makeState().user,
      astro_quax: 10,
      storage: { food: 0, contourPass: 0 },
    },
    expeditionStats: {
      completed: 1,
      bestDepth: 1,
      downed: 0,
      completedSectors: [1],
      unlockedSectors: [2],
    },
    expeditions: [
      {
        id: "e2",
        sectorId: 2,
        team: [{ toadId: 1, role: "scout" }],
        startedAt: Date.now() - 0.1 * HOUR_MS,
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
      },
    ],
  }),
);

check("маяк до прибытия в сектор", manager.extractExpedition("e2"), {
  success: true,
  message: "Команда эвакуирована маяком — добыча ждёт разбора в «Походах»",
});
check(
  "маяк до прибытия не засчитывает сектор пройденным",
  saved().expeditionStats.completedSectors,
  [1],
);
check(
  "маяк до прибытия не начисляет пропуск",
  saved().user.storage.contourPass,
  0,
);
check(
  "маяк не приносит особый образец",
  saved().expeditions[0].loot.lootboxSamples ?? 0,
  0,
);

console.log("\n[5] Пропуска не занимают полки склада");
console.log("─".repeat(60));
check(
  "занятость: пропуска не в счёте",
  storage.getStorageUsed({ food: 40, contourPass: 30 }),
  40,
);
check(
  "на переполненный склад пропуск всё равно влезает",
  storage.fitItemsInStorage(
    { food: 100 },
    { contourPass: 5, worms: 2 },
  ),
  { contourPass: 5 },
);
check(
  "canFitInStorage пропускает только цифровой ресурс",
  storage.canFitInStorage({ food: 100 }, { contourPass: 5 }),
  true,
);
check(
  "обычный предмет на переполненный склад не влезает",
  storage.canFitInStorage({ food: 100 }, { worms: 1 }),
  false,
);

console.log("\n[6] Особый образец за успешное прохождение");
console.log("─".repeat(60));
reset(
  makeState({
    expeditions: [
      {
        id: "e-sample",
        sectorId: 1,
        team: [{ toadId: 1, role: "scout" }],
        startedAt,
        phase: "returning",
        progress: 1,
        reachedSector: true,
        resolvedSteps: 9,
        returnStartedAt: Date.now() - HOUR_MS,
        returnHours: 0.25,
        successChance: 1,
        loot: {
          biomass: 0,
          tokens: 0,
          astro_quax: 0,
          items: {},
          samples: 0,
        },
        log: [],
      },
    ],
  }),
);

// Первый бросок — успех похода, второй — выпадение образца.
const realRandom = Math.random;
Math.random = () => 0;
manager.processExpeditions();
Math.random = realRandom;

check(
  "успех сохранил особый образец в рюкзак",
  saved().expeditions[0].loot.lootboxSamples,
  1,
);

const sampleFinish = manager.finishExpedition("e-sample", "storage");
const sampleToad = saved().toads.find(
  (item) => item.name === "Лесной странник",
);

check(
  "образец стал именной жабой из лутбокса",
  {
    success: sampleFinish.success,
    type: sampleToad?.type,
    generation: sampleToad?.generation,
    scene_id: sampleToad?.scene_id,
  },
  {
    success: true,
    type: "camouflage",
    generation: 1,
    scene_id: 1,
  },
);
check(
  "отчёт называет жабу из образца",
  sampleFinish.message.includes("Лесной странник"),
  true,
);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}
console.log("✅ Все проверки пропусков КОНТУРа пройдены");
