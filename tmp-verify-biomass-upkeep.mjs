/**
 * Проверка содержания биомассы и изоляции апгрейдов биоподов.
 *
 * Содержание (апкипинг) берут **все** жабы колонии, кроме ушедших в поход: и жильцы
 * биоподов, и те, кто работает в лазарете, репродукторе, ⚡-секторе или «Разведке».
 * Вырабатывают биомассу только жильцы биоподов — место в секторе колонии ферме не
 * помогает. Скрипт гоняет РЕАЛЬНЫЙ код (`production-manager`, `backend/colony`,
 * `colony-build` бандлятся esbuild-ом) и проверяет:
 *   1) часовой тик списывает содержание за всех жаб вне похода, включая секторы;
 *   2) выработку получают только жильцы биоподов, а не лазарет/репродуктор/⚡/«Разведка»;
 *   3) разбивка `getBiomassFarmStats` раскладывает апкипинг по биоподам и секторам,
 *      а жабы без гекса тоже считаются;
 *   4) два биопода, построенные в одну миллисекунду, получают разные `Scene`;
 *   5) апгрейд одного биопода не виден у соседнего и не блокирует его покупку;
 *   6) модалка списка жаб отдаёт «Данные сектора» показанному гексу, а не стартовому.
 *
 * Запуск: node tmp-verify-biomass-upkeep.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-biomass-upkeep-"));
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
const extraStorage = new Map();

globalThis.localStorage = {
  getItem: (key) =>
    key === "achivements"
      ? achievementsRaw
      : (extraStorage.get(key) ?? raw),
  setItem: (key, value) => {
    if (key === "achivements") {
      achievementsRaw = value;
      return;
    }
    extraStorage.set(key, value);
    raw = value;
  },
  removeItem: (key) => {
    if (key === "achivements") {
      achievementsRaw = "";
      return;
    }
    extraStorage.delete(key);
    raw = "";
  },
};
globalThis.window.localStorage = globalThis.localStorage;

/** Взрослая жаба с предсказуемой выработкой: все множители нейтральные */
const makeToad = (id, scene_id, homeId = null) => ({
  id,
  name: `toad-${id}`,
  stage: "adult",
  sex: "male",
  scene_id,
  homeId,
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
});

const BASE_SCENES = [
  { id: 1, name: "Биопод #1", capacity: 20, created_at: "", description: "" },
];

/** Сейв с указанными жабами/постройками: остальное — стартовая колония */
const stubState = ({ toads = [], rooms = [], scenes = BASE_SCENES } = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 1000,
    astro_quax: 0,
    biomass: 100,
    storage: { food: 10 },
  },
  scenes,
  toads,
  colony: { rooms, upgrades: {} },
  expeditions: [],
  expeditionStats: { completed: 0, bestDepth: 0, downed: 0 },
  lastSaved: new Date().toISOString(),
  createdAt: new Date().toISOString(),
});

/** Сброс состояния перед проверкой */
const reset = (state) => {
  raw = JSON.stringify(state);
  achievementsRaw = JSON.stringify({
    completed: [],
    rewards: [],
    counter: {},
    toads_collection: [],
  });
};

const production = bundle("src/utils/production-manager.ts", "production");
const gamification = bundle(
  "src/utils/gamification-config.ts",
  "gamification",
);
const colony = bundle("src/backend/colony.ts", "colony");
const colonyBuild = bundle("src/components/HexMap/colony-build.ts", "build");
const roomToadLists = bundle(
  "src/components/HexMap/room-toad-lists.ts",
  "room-toad-lists",
);

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const checkClose = (label, actual, expected, epsilon = 1e-9) => {
  const ok = Math.abs(actual - expected) <= epsilon;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const checkText = (label, value, pattern) => {
  const ok = typeof value === "string" && pattern.test(value);
  if (!ok) {
    failures.push(`${label}: не найдено ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${ok ? "есть" : "нет"}`);
};

const checkNotText = (label, value, pattern) => {
  const ok = typeof value === "string" && !pattern.test(value);
  if (!ok) {
    failures.push(`${label}: осталось ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${ok ? "нет" : "есть"}`);
};

const UPKEEP = gamification.UPKEEP_PER_TOAD_HOUR;

console.log("\n[1] Содержание берут все жабы вне похода, включая секторы колонии");
console.log("─".repeat(60));

/**
 * Шесть жаб едят, одна в походе — не ест:
 *  - биопод: 1;
 *  - лазарет, репродуктор, ⚡-сектор, «Разведка»: по одной;
 *  - без гекса (старый сейв): одна;
 *  - в походе: одна.
 */
const scenario = stubState({
  toads: [
    makeToad(1, 1, 1),
    makeToad(2, "slot-south"),
    makeToad(3, "breeding"),
    makeToad(4, "slot-north"),
    makeToad(5, "slot-north-east"),
    { ...makeToad(6, null, 1), status: "out" },
    makeToad(7, null, null),
  ],
  rooms: [
    {
      id: "hospital_1",
      slotId: "slot-south",
      kind: "hospital",
      builtAt: "",
    },
    {
      id: "breeding_1",
      slotId: "breeding",
      kind: "breeding",
      builtAt: "",
    },
    { id: "power_1", slotId: "slot-north", kind: "power", builtAt: "" },
    {
      id: "scout_1",
      slotId: "slot-north-east",
      kind: "scout",
      builtAt: "",
    },
  ],
});

reset(scenario);

const tick = production.processProduction(1);
const expectedUpkeep = 6 * UPKEEP;

checkClose(
  "содержание за 6 жаб (все, кроме похода)",
  tick.upkeep,
  expectedUpkeep,
);
check("выработка есть только у жильца биопода", tick.gross > 0, true);
checkClose("итог = выработка − содержание", tick.net, tick.gross - expectedUpkeep);
checkClose(
  "биомасса на складе изменилась на итог",
  JSON.parse(raw).user.biomass,
  Math.round((100 + tick.net) * 100) / 100,
  0.01,
);

console.log("\n[2] Разбивка статистики показывает, кто именно ест");
console.log("─".repeat(60));

const baseRooms = colonyBuild.resolveColonyRooms(
  scenario.colony,
  scenario.scenes,
);
const stats = production.getBiomassFarmStats(
  baseRooms,
  scenario.toads,
  colonyBuild.getPowerGrid(
    baseRooms,
    roomToadLists.getRoomToadLists(baseRooms, scenario.toads),
    scenario.expeditions,
  ),
  scenario.expeditions,
);
const directRate = production.getSceneProductionRate(scenario.toads);

checkClose("всего содержание", stats.upkeep, expectedUpkeep);
checkClose("выработка сходится с чистым расчётом", stats.gross, directRate);
checkClose(
  "итог сходится с чистым расчётом",
  stats.net,
  directRate - expectedUpkeep,
);
check("на ферме одна жаба", stats.activeToads, 1);
check("в других секторах четыре жабы", stats.serviceToads, 4);
check("в походе одна жаба", stats.awayToads, 1);
check("без гекса одна жаба", stats.unplacedToads, 1);
check("строки секторов — по одной на гекс", stats.serviceRooms.length, 4);
check(
  "каждый сектор отдаёт по жабе",
  stats.serviceRooms.every((room) => room.toads === 1),
  true,
);
checkClose(
  "содержание сектора = одна жаба",
  stats.serviceRooms[0]?.upkeep ?? 0,
  UPKEEP,
);
check(
  "содержание раскладывается без остатка",
  stats.serviceRooms.reduce((sum, room) => sum + room.toads, 0) +
    stats.activeToads +
    stats.unplacedToads,
  6,
);

console.log("\n[3] Два биопода в одну миллисекунду получают разные Scene");
console.log("─".repeat(60));

const realNow = Date.now;
Date.now = () => 1_800_000_000_000;

try {
  reset(stubState({ rooms: [] }));
  const firstRoom = colony.buildColonyRoom("slot-north", "aviary");
  const secondRoom = colony.buildColonyRoom("slot-south", "aviary");
  const built = JSON.parse(raw);

  check("оба биопода построены", Boolean(firstRoom && secondRoom), true);
  check(
    "разные sceneId у построек",
    firstRoom?.sceneId !== secondRoom?.sceneId,
    true,
  );
  check("в сейве три биопода", built.scenes.length, 3);
  check(
    "id биоподов уникальны",
    new Set(built.scenes.map((scene) => scene.id)).size,
    built.scenes.length,
  );

  const mapRooms = colonyBuild.resolveColonyRooms(built.colony, built.scenes);
  const aviaries = mapRooms.filter((room) => room.kind === "aviary");
  check("на карте три гекса-биопода", aviaries.length, 3);
  check(
    "у каждого гекса свой sceneId",
    new Set(aviaries.map((room) => room.sceneId)).size,
    aviaries.length,
  );

  const upgradedRoom = aviaries.find(
    (room) => room.sceneId === firstRoom.sceneId,
  );
  const otherRoom = aviaries.find(
    (room) => room.sceneId === secondRoom.sceneId,
  );
  const baseRoom = aviaries.find((room) => room.slotId === "aviary");

  colony.upgradeColonyRoom(upgradedRoom.id, { autoFeeder: true });

  check(
    "апгрейд виден у купленного биопода",
    colony.getRoomUpgrades(upgradedRoom).autoFeeder,
    true,
  );
  check(
    "у соседнего биопода апгрейда нет",
    colony.getRoomUpgrades(otherRoom).autoFeeder ?? false,
    false,
  );
  check(
    "у базового биопода апгрейда нет",
    colony.getRoomUpgrades(baseRoom).autoFeeder ?? false,
    false,
  );

  colony.upgradeColonyRoom(otherRoom.id, { autoFeeder: true });

  check(
    "второй биопод тоже улучшается — покупка не заблокирована",
    colony.getRoomUpgrades(otherRoom).autoFeeder,
    true,
  );
  check(
    "базовый биопод так и остался без апгрейда",
    colony.getRoomUpgrades(baseRoom).autoFeeder ?? false,
    false,
  );
} finally {
  Date.now = realNow;
}


console.log("\n[4] «Данные сектора» относятся к показанному биоподу");
console.log("─".repeat(60));

const toadListSource = readFileSync(
  join(root, "src/components/modals/ToadListModal/index.tsx"),
  "utf8",
);
const roomDataSource = readFileSync(
  join(root, "src/components/modals/RoomDataTab.tsx"),
  "utf8",
);
const biomassSource = readFileSync(
  join(root, "src/components/modals/BiomassStatsModal.tsx"),
  "utf8",
);
const productionSource = readFileSync(
  join(root, "src/utils/production-manager.ts"),
  "utf8",
);
const colonySource = readFileSync(join(root, "src/backend/colony.ts"), "utf8");

checkText(
  "таб берёт гекс текущего биопода",
  toadListSource,
  /const roomDataRoom = room \? enclosureRoom : null;/,
);
checkText(
  "RoomDataTab получает текущий гекс",
  toadListSource,
  /tab === "room-data" && roomDataRoom/,
);
checkText(
  "в RoomDataTab передаётся roomDataRoom",
  toadListSource,
  /room=\{roomDataRoom\}/,
);
checkNotText(
  "стартовый room в RoomDataTab больше не уходит",
  toadListSource,
  /room=\{room\}/,
);
checkText(
  "улучшения читаются для полученного гекса",
  roomDataSource,
  /getRoomUpgrades\(room\)/,
);
checkText(
  "статистика раскладывает апкипинг по секторам",
  biomassSource,
  /stats\.serviceRooms\.map/,
);
checkText(
  "в модалке есть блок «Содержание вне фермы»",
  biomassSource,
  /Содержание вне фермы/,
);
checkText(
  "подпись объясняет, что едят все жабы колонии",
  biomassSource,
  /за каждую жабу\s+колонии/,
);
checkText(
  "выработку получают только жильцы биоподов",
  productionSource,
  /if \(!isToadInEnclosure\(toad\)\)/,
);
checkText(
  "апкипинг считается по всем жабам вне похода",
  productionSource,
  /upkeepToads\.length \* UPKEEP_PER_TOAD_HOUR/,
);
checkText(
  "id нового биопода защищён от совпадения",
  colonySource,
  /id: createSceneId\(scenes\)/,
);

console.log("\n" + "═".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   · ${item}`));
  process.exitCode = 1;
} else {
  console.log("✅ Все проверки содержания и изоляции апгрейдов прошли");
}
