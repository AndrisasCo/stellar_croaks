/**
 * Проверка баланса колонии на РЕАЛЬНОМ коде проекта (без запуска игры).
 *
 * Скрипт бандлит нужные модули через esbuild и прогоняет их как обычный JS, поэтому
 * проверяются те же формулы, что работают в игре, а не их копия:
 *   1) поход: «каждая роль +20%», примеры 45% / 120%, сложность сектора и удача;
 *   2) поход всегда выгоднее фермы (норма добычи против фермы за время отсутствия);
 *   3) склад предметов: вместимость от построек «Склад», обрезка пачки по месту;
 *   4) жильё жаб: расселение по вольерам без склада жаб (лишние остаются без места);
 *   5) цены построек и награды элитных заказов (нет инверсии «награда ↔ сложность»).
 *
 * Запуск: node tmp-verify-balance.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-balance-"));
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
const check = (label, actual, expected, tolerance = 1e-9) => {
  const ok =
    typeof expected === "number"
      ? Math.abs(actual - expected) <= tolerance
      : actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(
    `${ok ? "✅" : "❌"} ${label}: ${
      typeof actual === "number" ? Math.round(actual * 1000) / 1000 : actual
    }`,
  );
};

/** Состояние игры: подменяем localStorage до импорта модулей */
const stubState = (patch = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 50,
    astro_quax: 0,
    biomass: 0,
    storage: { food: 90, lootbox: 5 },
  },
  scenes: [
    { id: 1, name: "Био Под", capacity: 2, created_at: "" },
    { id: 2, name: "Био Под 2", capacity: 1, created_at: "" },
  ],
  toads: [
    { id: 10, scene_id: 1, name: "a" },
    { id: 11, scene_id: 1, name: "b" },
    { id: 12, scene_id: 2, name: "c" },
  ],
  colony: { rooms: [{ id: "slot-north", kind: "storage", builtAt: "" }] },
  lastSaved: "",
  createdAt: "",
  ...patch,
});

let raw = JSON.stringify(stubState());
globalThis.localStorage = {
  getItem: () => raw,
  setItem: (_key, value) => {
    raw = value;
  },
  removeItem: () => {
    raw = "";
  },
};

/**
 * Заглушки браузера: платформенный слой (`src/platform`) читает localStorage через
 * `window.localStorage`. Без этого чтения возвращали null и проверки видели пустое
 * состояние игры (склады, вольеры и т.д.).
 */
globalThis.window ||= { dispatchEvent: () => true, addEventListener: () => {} };
globalThis.window.localStorage = globalThis.localStorage;

const cfg = bundle("src/utils/expedition-config.ts", "expedition-config");
const models = bundle("src/models/expedition.ts", "models-expedition");
const storage = bundle("src/utils/storage.ts", "storage");
const housing = bundle("src/utils/housing.ts", "housing");
const rooms = bundle("src/components/HexMap/rooms-config.ts", "rooms-config");
const shop = bundle("src/backend/shop-state.ts", "shop-state");

/** Жаба с заданными генами (для расчёта силы роли) */
const toad = (genes = {}) => ({
  id: 1,
  name: "test",
  stage: "adult",
  generation: 1,
  sex: "male",
  type: "hybrid",
  scene_id: 1,
  created_at: new Date().toISOString(),
  parents: null,
  state: { hunger: 100 },
  pregnancy: null,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 15,
    speed: 1,
    rarity: 1,
    hungerRate: 1,
    fertility: 1,
    personality: null,
    ...genes,
  },
});

console.log("\n[1] Поход: шанс удачного завершения");
console.log("─".repeat(60));
const starter = models.getSectorById(1);
const deep = models.getSectorById(8);

check("вклад роли: сила 0.9 → юниты", cfg.getRoleSuccessUnits(0.9), 0.45);
check("вклад роли: сила 2.0 → юниты", cfg.getRoleSuccessUnits(2.0), 2.0);
check(
  "5 ролей с силой 0.9 → 45% (пример ТЗ)",
  5 * cfg.getRoleSuccessUnits(0.9) * cfg.EXPEDITION_ROLE_SUCCESS_BONUS,
  0.45,
);
check(
  "3 роли с силой 2.0 → 120% (пример ТЗ)",
  3 * cfg.getRoleSuccessUnits(2.0) * cfg.EXPEDITION_ROLE_SUCCESS_BONUS,
  1.2,
);
check("сложность сектора 1 = 1.0", cfg.getSectorSuccessFactor(starter), 1);

const team200 = ["scout", "tank", "medic"].map((role) => ({
  role,
  toad: toad(
    role === "scout"
      ? { speed: 3 }
      : role === "tank"
        ? { weight: 90 }
        : { fertility: 7 },
  ),
}));
check(
  "3 роли с силой 2.0 в секторе 1 → 120%",
  cfg.getExpeditionSuccessChance(team200, starter),
  1.2,
);
console.log(
  `ℹ️  «Дальний Периметр» (глубина 8): множитель ${cfg
    .getSectorSuccessFactor(deep)
    .toFixed(3)}, те же 3 роли по 200% → ${Math.round(
    cfg.getExpeditionSuccessChance(team200, deep) * 100,
  )}%`,
);
check(
  "удача минимум",
  cfg.rollExpeditionLuck(() => 0),
  0.9,
);
check(
  "удача максимум",
  cfg.rollExpeditionLuck(() => 1),
  1.1,
);

console.log("\n[2] Поход против фермы");
console.log("─".repeat(60));
const team5 = [
  toad({ speed: 1.35 }),
  toad({ weight: 36 }),
  toad({ fertility: 2.7 }),
  toad({ rarity: 10.8 }),
  toad({ personality: "glutton" }),
];
const awayHours = starter.durationHours * (1 + cfg.EXPEDITION_RETURN_RATIO);
const supply = cfg.getExpeditionSendCost(starter, team5.length);
const floor = cfg.getExpeditionProfitFloor(team5, awayHours, supply);
const farm = cfg.getFarmValueForTeam(team5, awayHours);
console.log(
  `ℹ️  сектор 1, 5 жаб, ${awayHours.toFixed(2)} ч пути: норма ${Math.round(
    floor,
  )} 🔷-экв, ферма ${Math.round(farm)} 🔷-экв, снаряжение ${supply} 🧪`,
);
check("норма выше фермы в 1.5 раза", floor > farm * 1.5, true);
check("снаряжение стоит биомассы", supply > 0, true);

console.log("\n[3] Склад предметов");
console.log("─".repeat(60));
check("складов в колонии", storage.getStorageRoomCount(), 1);
check("вместимость = 100 + 300", storage.getStorageCapacity(), 400);
check("занято предметов", storage.getStorageUsed(stubState().user.storage), 95);
const accepted = storage.fitItemsInStorage(stubState().user.storage, {
  food: 300,
  lootbox: 10,
});
check("влезло корма", accepted.food, 300);
check("влезло лутбоксов по остатку места", accepted.lootbox, 5);
check(
  "пачка больше вместимости не проходит",
  storage.canFitInStorage(stubState().user.storage, { food: 306 }),
  false,
);

console.log("\n[4] Жильё жаб (склада жаб нет)");
console.log("─".repeat(60));
const info = housing.getHousingInfo();
check("мест в вольерах", info.capacity, 3);
check("занято жаб", info.used, 3);
check("вольеров", info.enclosures, 2);
check("мест нет — новая жаба не появится", housing.pickSceneForNewToad(), null);
raw = JSON.stringify(stubState({ toads: stubState().toads.slice(0, 1) }));
check("свободный вольер найден", housing.getSceneWithFreeSlot()?.id, 1);
const placed = housing.assignToadsToScenes([{ name: "x" }, { name: "y" }]);
check("расселилось по вольерам", placed.assigned.length, 2);
check(
  "вольеры заполняются по порядку",
  placed.assigned.map((t) => t.scene_id).join(","),
  "1,2",
);
raw = JSON.stringify(stubState());
const overflow = housing.assignToadsToScenes([{ name: "z" }]);
check("переполнение: без места", overflow.rejected, 1);

console.log("\n[5] Цены построек и награды элитных заказов");
console.log("─".repeat(60));
const order = rooms.ROOM_BLUEPRINT_ORDER;
check("первый гекс обучения — «Разведка»", order[0], "scout");
check("второй — «Склад»", order[1], "storage");
const scoutCost = rooms.ROOM_BLUEPRINTS.scout.baseCost;
const storageCost = rooms.ROOM_BLUEPRINTS.storage.baseCost;
console.log(
  `ℹ️  разведка ${scoutCost}🔷 + склад ${storageCost}🔷 = ${
    scoutCost + storageCost
  }🔷 при стартовых 50🔷`,
);
check(
  "на обучении хватает стартовых 50🔷",
  scoutCost + storageCost <= 50,
  true,
);
check(
  "вольер строит новый вольер (+20 мест)",
  rooms.ROOM_BLUEPRINTS.aviary.description.includes("+20 мест"),
  true,
);
check(
  "склад расширяет полки (+300)",
  rooms.ROOM_BLUEPRINTS.storage.description.includes("300"),
  true,
);
check("коллайдер — единственный", rooms.ROOM_BLUEPRINTS.collider.unique, true);

const rewards = shop.eliteOrders.map((item) => item.reward);
const hardest = shop.eliteOrders.filter((item) =>
  ["elite_4", "elite_5", "elite_12", "elite_15"].includes(item.id),
);
const waiting = shop.eliteOrders.filter((item) =>
  ["elite_23", "elite_19", "elite_24", "elite_2"].includes(item.id),
);
check(
  "нет инверсии «награда ↔ сложность»",
  Math.min(...hardest.map((item) => item.reward)) >
    Math.max(...waiting.map((item) => item.reward)),
  true,
);
check(
  "чистое ожидание (10 дней) платит мало",
  shop.eliteOrders.find((item) => item.id === "elite_23")?.reward,
  25,
);
console.log(
  `ℹ️  награды: ${Math.min(...rewards)}..${Math.max(...rewards)} 💎, заказов: ${rewards.length}`,
);

console.log(
  `\n${failures.length === 0 ? "✅ ВСЕ ПРОВЕРКИ ПРОШЛИ" : `❌ ПРОВАЛЫ (${failures.length}):`}`,
);
failures.forEach((line) => console.log("   " + line));

process.exit(failures.length === 0 ? 0 : 1);
