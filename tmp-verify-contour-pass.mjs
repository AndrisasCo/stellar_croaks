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
 *   4) КОНТУР проходится по порядку: закрытый предыдущий сектор не перепрыгнуть;
 *   5) завершённый поход сразу начисляет пропуск на склад;
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
  [0, 1, 3, 6, 10, 15, 21, 28],
);
check(
  "пропусков за поход",
  models.SECTORS.map((sector) => config.getContourPassReward(sector)),
  [1, 2, 2, 3, 3, 4, 4, 5],
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
  "новый сейв: пустой список не заполняется за походы",
  models.normalizeExpeditionStats({
    completed: 7,
    bestDepth: 4,
    downed: 0,
    unlockedSectors: [],
  }).unlockedSectors,
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

console.log("\n[3] Покупка секторов за пропуска");
console.log("─".repeat(60));
reset(
  makeState({
    user: { ...makeState().user, storage: { food: 0, contourPass: 10 } },
  }),
);

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
  message: "Сначала откройте «Архив мёртвых генов»",
});
check("пропуска не списались за прыжок", saved().user.storage.contourPass, 6);

check("повторное открытие сектора 2", manager.unlockSector(2), {
  success: false,
  message: "Сектор «Затопленный бункер» уже открыт",
});
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
  "сектор 2 после награды всё ещё закрыт",
  saved().expeditionStats.unlockedSectors,
  [],
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

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}
console.log("✅ Все проверки пропусков КОНТУРа пройдены");
