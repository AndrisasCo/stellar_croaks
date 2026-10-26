/**
 * Проверка переименования биопода — вкладка «ⓘ О секторе» и «Статистика» (на РЕАЛЬНОМ коде).
 *
 * Имя биопода — это `Scene.name`: оно видно в шапке списка жаб, в карточке сектора и в
 * списке переезда. Правка сделана в двух вкладках одной и той же модалки, поэтому
 * правило имени у них общее (`utils/scene-name.ts`). Скрипт бандлит модули esbuild-ом
 * и проверяет:
 *   1) разбор ввода: пробелы по краям и внутри, пустое имя, предел длины;
 *   2) `updateScene` меняет имя только выбранного биопода — соседние биоподы и поля
 *      сейва остаются прежними, изменение сразу лежит в сейве;
 *   3) новое имя читается там, где игрок его видит: подпись места жабы
 *      (`utils/toad-picker.ts` → `getToadPickerLocation`).
 *
 * Запуск: node tmp-verify-biopod-rename.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-biopod-rename-"));
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

// Заглушки браузера: сохранение игры пишет в localStorage и шлёт событие на window
globalThis.CustomEvent ||= class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
globalThis.window ||= {
  dispatchEvent: () => true,
  addEventListener: () => {},
  Telegram: { WebApp: { initDataUnsafe: {} } },
};

let raw = "";
let achievementsRaw = "";

globalThis.localStorage = {
  getItem: (key) => (key === "achivements" ? achievementsRaw : raw),
  setItem: (key, value) => {
    if (key === "achivements") {
      achievementsRaw = value;
      return;
    }
    raw = value;
  },
  removeItem: (key) => {
    if (key === "achivements") {
      achievementsRaw = "";
      return;
    }
    raw = "";
  },
};
globalThis.window.localStorage = globalThis.localStorage;

/** Сейв с двумя биоподами и жабой во втором: остальное — стартовая колония */
const stubState = () => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 1000,
    astro_quax: 0,
    biomass: 100,
    storage: { food: 10 },
  },
  scenes: [
    {
      id: 1,
      name: "Биопод #1",
      capacity: 12,
      created_at: "",
      description: "первый биопод",
    },
    {
      id: 2,
      name: "Биопод #2",
      capacity: 12,
      created_at: "",
      description: "второй биопод",
    },
  ],
  toads: [
    {
      id: 7,
      name: "Ква",
      stage: "adult",
      sex: "female",
      scene_id: 2,
      homeId: 2,
      created_at: "",
      generation: 1,
      parents: null,
      status: "ok",
      hp: 100,
      maxHp: 100,
      state: { hunger: 100 },
      pregnancy: null,
      genes: {
        hungerRate: 1,
        fertility: 1,
        speed: 1,
        weight: 15,
        rarity: 2,
        colors: [],
        pattern: "smooth",
        personality: null,
      },
    },
  ],
  colony: { rooms: [], upgrades: {} },
  expeditions: [],
  lastSaved: new Date().toISOString(),
  createdAt: new Date().toISOString(),
});

const reset = () => {
  raw = JSON.stringify(stubState());
  achievementsRaw = JSON.stringify({
    completed: [],
    rewards: [],
    counter: {},
    toads_collection: [],
  });
};

const sceneName = bundle("src/utils/scene-name.ts", "scene-name");
const backend = bundle("src/backend/index.ts", "backend");
const picker = bundle("src/utils/toad-picker.ts", "toad-picker");

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
};

// === 1. Разбор введённого имени ============================================
console.log("=== 1. Разбор введённого имени ===");
const MAX = sceneName.SCENE_NAME_MAX_LENGTH;
check("предел длины имени", MAX, 24);
check(
  "пробелы по краям обрезаются",
  sceneName.normalizeSceneName("  Дом Квакуши  "),
  "Дом Квакуши",
);
check(
  "двойные пробелы схлопываются",
  sceneName.normalizeSceneName("Дом   Квакуши"),
  "Дом Квакуши",
);
check(
  "перенос строки становится пробелом",
  sceneName.normalizeSceneName("Дом\nКвакуши"),
  "Дом Квакуши",
);
check("пустое имя не сохраняется", sceneName.normalizeSceneName(""), null);
check(
  "имя из одних пробелов не сохраняется",
  sceneName.normalizeSceneName(" \n\t "),
  null,
);
check(
  "длина обрезается по пределу",
  sceneName.normalizeSceneName("Я".repeat(100)).length,
  MAX,
);
check(
  "обрезанное имя не кончается пробелом",
  sceneName.normalizeSceneName(`${"Я".repeat(MAX)}   `),
  "Я".repeat(MAX),
);
check(
  "эмодзи в имени сохраняются",
  sceneName.normalizeSceneName("🏠 Дом"),
  "🏠 Дом",
);

// === 2. updateScene меняет только выбранный биопод =========================
console.log("\n=== 2. updateScene меняет только выбранный биопод ===");
reset();
const renamed = backend.updateScene(2, { name: "Дом Квакуши" });
check(
  "новое имя у выбранного биопода",
  renamed.find((s) => s.id === 2).name,
  "Дом Квакуши",
);
check(
  "соседний биопод не переименован",
  renamed.find((s) => s.id === 1).name,
  "Биопод #1",
);
check(
  "имя сразу в сейве",
  backend.getScenes().find((s) => s.id === 2).name,
  "Дом Квакуши",
);
check("вместимость не потерялась", renamed.find((s) => s.id === 2).capacity, 12);
check(
  "описание не потерялось",
  renamed.find((s) => s.id === 2).description,
  "второй биопод",
);
check("число биоподов не изменилось", renamed.length, 2);

reset();
const unchanged = backend.updateScene(999, { name: "Никто" });
check("несуществующий биопод ничего не меняет", unchanged.length, 2);
check(
  "имена после промаха прежние",
  unchanged.map((s) => s.name).join(" / "),
  "Биопод #1 / Биопод #2",
);

// === 3. Новое имя видно там, где его читает игрок ==========================
console.log("\n=== 3. Новое имя видно в подписи места жабы ===");
reset();
backend.updateScene(2, { name: "Дом Квакуши" });
const toad = stubState().toads[0];
const location = picker.getToadPickerLocation(toad, [], backend.getScenes());
check("подпись дома жабы — новое имя", location.label, "Дом Квакуши");
check("значок дома не изменился", location.icon, "🏠");

console.log("\n" + "=".repeat(60));
if (failures.length > 0) {
  console.log(`❌ ПЕРЕИМЕНОВАНИЕ БИОПОДА: провалено проверок — ${failures.length}`);
  failures.forEach((line) => console.log(`   • ${line}`));
  process.exit(1);
}
console.log("✅ Переименование биопода: все проверки прошли");
