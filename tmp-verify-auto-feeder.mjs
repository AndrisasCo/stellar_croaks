/**
 * Проверка автокормушки — единственного улучшения комнаты (на РЕАЛЬНОМ коде проекта).
 *
 * Скрипт бандлит модули через esbuild и гоняет те же функции, что работают в игре:
 *   1) каталог улучшений: апгрейд один — автокормушка (1000 🔷), легаси-улучшений нет;
 *   2) апгрейд живёт у КОМНАТЫ (`ColonyState.upgrades`): покупка не трогает постройки,
 *      а кормушка, купленная вольеру в старой версии (`Scene.bonuses.autoFeeder`),
 *      дочитывается гексом-вольером;
 *   3) кормление: жаба комнаты с кормушкой ест со склада при голоде ≤ 20 % (один корм на жабу),
 *      жаба выше порога — нет; корм кончился — кормление прекращается;
 *   4) кормушка работает в любой жилой комнате: и в вольере (жильцы по `scene_id`),
 *      и в ⚡-энергокомнате (работяги по `roomId`); комната без апгрейда не кормит;
 *   5) жаба в походе (`status: "out"`) дома не ест;
 *   6) ручное кормление стоит один корм на жабу (`getFeedCost`);
 *   7) пороги согласованы: кормушка кормит ровно на пороге выработки биомассы
 *      (`AUTO_FEED_HUNGER` = `PRODUCTION_MIN_HUNGER`), а голодная жаба работает на
 *      минимуме (`PRODUCTION_HUNGRY_FACTOR`), поэтому голодовка не запирает игрока:
 *      колония без корма всё равно копит биомассу — и кормушка сразу поднимает её до нормы;
 *   8) снос комнаты (`demolishColonyRoom`): постройка уходит из сейва, гекс помечается
 *      снесённым (`Resolve` показывает его свободным слотом), улучшения комнаты забываются,
 *      постройка на этом гексе возвращает его в строй, а чужие улучшения снос не трогает.
 *
 * Запуск: node tmp-verify-auto-feeder.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-auto-feeder-"));
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
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};
const checkTrue = (label, value) => check(label, Boolean(value), true);

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
globalThis.localStorage = {
  getItem: () => raw,
  setItem: (_key, value) => {
    raw = value;
  },
  removeItem: () => {
    raw = "";
  },
};
globalThis.window.localStorage = globalThis.localStorage;

// === Модули проекта ===
const autoFeeder = bundle("src/utils/auto-feeder.ts", "auto-feeder");
const upgrades = bundle("src/utils/room-upgrades.ts", "room-upgrades");
const colony = bundle("src/backend/colony.ts", "colony");
const feeding = bundle("src/utils/feeding.ts", "feeding");
const gamification = bundle(
  "src/utils/gamification-config.ts",
  "gamification-config",
);
const colonyBuild = bundle("src/components/HexMap/colony-build.ts", "colony-build");
const roomToadLists = bundle(
  "src/components/HexMap/room-toad-lists.ts",
  "room-toad-lists",
);
const constants = bundle("src/utils/constants.ts", "constants");

/** Жаба с нужными полями: голод, дом (`scene_id`), рабочее место (`roomId`), статус */
const toad = (over = {}) => ({
  id: 1,
  name: "жаба",
  stage: "adult",
  sex: "female",
  status: "alive",
  scene_id: 1,
  roomId: null,
  state: { hunger: 50, hp: 100, energy: 100 },
  genes: { rarity: 1, weight: 1, speed: 1, hungerRate: 1, personality: "calm" },
  created_at: new Date().toISOString(),
  ...over,
});

const scene = (over = {}) => ({
  id: 1,
  name: "Био Под",
  description: null,
  gradient: 0,
  price: 0,
  texture: null,
  capacity: 20,
  created_at: new Date().toISOString(),
  ...over,
});

/** Записать сейв: состояние игры читается из localStorage на каждый вызов */
const setState = ({
  toads = [],
  scenes = [scene()],
  upgrades: roomUpgrades = {},
  food = 0,
  rooms = [],
  demolished = [],
}) => {
  raw = JSON.stringify({
    user: {
      id: "u",
      username: "u",
      tg_id: null,
      tokens: 5000,
      astro_quax: 0,
      biomass: 0,
      storage: { food },
    },
    scenes,
    toads,
    colony: { rooms, upgrades: roomUpgrades, demolished },
    lastSaved: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
};

const stateNow = () => JSON.parse(raw);
const toadNow = (id) => stateNow().toads.find((item) => item.id === id);
const foodNow = () => stateNow().user.storage.food;

console.log("── 1. Каталог улучшений комнаты ───────────────────────────");
check("апгрейд в каталоге один", upgrades.ROOM_UPGRADES.length, 1);
check("название апгрейда", upgrades.ROOM_UPGRADES[0].title, "Автокормушка");
check("цена апгрейда в Кваксах", upgrades.ROOM_UPGRADES[0].cost, 1000);
checkTrue(
  "апгрейд ставит автокормушку",
  upgrades.ROOM_UPGRADES[0].upgrade.autoFeeder === true,
);
checkTrue("пустая комната улучшений не имеет", !upgrades.hasUpgrade({}, { autoFeeder: true }));
checkTrue(
  "улучшенная комната апгрейд имеет",
  upgrades.hasUpgrade({ autoFeeder: true }, { autoFeeder: true }),
);
console.log(`   порог кормления: голод ≤ ${autoFeeder.AUTO_FEED_HUNGER} %`);

console.log("\n── 2. Апгрейд принадлежит комнате ─────────────────────────");
setState({
  rooms: [{ id: "slot-north", kind: "power", builtAt: new Date().toISOString() }],
  toads: [toad()],
});
colony.upgradeColonyRoom("slot-north", { autoFeeder: true });
checkTrue(
  "апгрейд записался в ColonyState.upgrades",
  stateNow().colony.upgrades["slot-north"].autoFeeder === true,
);
checkTrue(
  "постройки комнат покупка не тронула",
  stateNow().colony.rooms.length === 1,
);
const powerRoom = { id: "slot-north" };
checkTrue(
  "getRoomUpgrades видит апгрейд комнаты",
  colony.getRoomUpgrades(powerRoom).autoFeeder === true,
);
checkTrue(
  "у комнаты без апгрейда улучшений нет",
  !colony.getRoomUpgrades({ id: "slot-east" }).autoFeeder,
);

console.log("\n── 3. Легаси: кормушка, купленная вольеру ─────────────────");
setState({ scenes: [scene({ bonuses: { autoFeeder: 1, grow: 2 } })], toads: [toad()] });
checkTrue(
  "старый бонус вольера читается у его гекса",
  colony.getRoomUpgrades({ id: "aviary", sceneId: 1 }).autoFeeder === true,
);
checkTrue(
  "гекс без вольера чужой бонус не берёт",
  !colony.getRoomUpgrades({ id: "aviary" }).autoFeeder,
);
setState({ scenes: [scene()], toads: [toad()] });
checkTrue(
  "без бонуса апгрейда нет",
  !colony.getRoomUpgrades({ id: "aviary", sceneId: 1 }).autoFeeder,
);

const feedHunger = autoFeeder.AUTO_FEED_HUNGER;

console.log(`\n── 4. Кормушка в вольере: голод ≤ ${feedHunger} % ───────────────`);
setState({
  toads: [
    toad({ id: 1, state: { hunger: feedHunger } }),
    toad({ id: 2, state: { hunger: feedHunger + 1 } }),
  ],
  food: 50,
});
let rooms = colonyBuild.resolveColonyRooms(stateNow().colony, stateNow().scenes);
let aviaryRoom = rooms.find((room) => room.kind === "aviary" && room.sceneId === 1);
colony.upgradeColonyRoom(aviaryRoom.id, { autoFeeder: true });
let result = autoFeeder.processAutoFeeders(
  rooms,
  roomToadLists.getRoomToadLists(rooms, stateNow().toads),
);
check("покормлена одна жаба", result.fed, 1);
check("корм ушёл со склада (1 на жабу)", result.spent, 1);
check("голодная жаба сыта", toadNow(1).state.hunger, 100);
check("жаба выше порога не кормится", toadNow(2).state.hunger, feedHunger + 1);
check("корм списался со склада", foodNow(), 49);

console.log("\n── 5. Повторный тик ничего не делает ──────────────────────");
result = autoFeeder.processAutoFeeders(
  rooms,
  roomToadLists.getRoomToadLists(rooms, stateNow().toads),
);
check("сытых жаб кормушка не трогает", result.fed, 0);
check("корм остался на складе", foodNow(), 49);

console.log("\n── 6. Корм кончился ───────────────────────────────────────");
setState({
  toads: [
    toad({ id: 1, state: { hunger: 2 } }),
    toad({ id: 2, state: { hunger: 3 } }),
    toad({ id: 3, state: { hunger: 4 } }),
  ],
  food: 1,
});
rooms = colonyBuild.resolveColonyRooms(stateNow().colony, stateNow().scenes);
aviaryRoom = rooms.find((room) => room.kind === "aviary" && room.sceneId === 1);
colony.upgradeColonyRoom(aviaryRoom.id, { autoFeeder: true });
result = autoFeeder.processAutoFeeders(
  rooms,
  roomToadLists.getRoomToadLists(rooms, stateNow().toads),
);
check("покормили ровно на остаток корма", result.fed, 1);
check("склад опустел", foodNow(), 0);
check("остальные остались голодными", `${toadNow(2).state.hunger},${toadNow(3).state.hunger}`, "3,4");

console.log("\n── 7. Комната без апгрейда не кормит ──────────────────────");
setState({ toads: [toad({ id: 1, state: { hunger: 1 } })], food: 10 });
rooms = colonyBuild.resolveColonyRooms(stateNow().colony, stateNow().scenes);
result = autoFeeder.processAutoFeeders(
  rooms,
  roomToadLists.getRoomToadLists(rooms, stateNow().toads),
);
check("без апгрейда кормушка молчит", result.fed, 0);
check("корм не списан", foodNow(), 10);
check("голод остался", toadNow(1).state.hunger, 1);

console.log("\n── 8. ⚡-энергокомната и гнездо ────────────────────────────");
setState({
  rooms: [{ id: "slot-north", kind: "power", builtAt: new Date().toISOString() }],
  toads: [
    toad({ id: 1, state: { hunger: 5 }, roomId: "slot-north" }),
    toad({ id: 2, state: { hunger: 5 }, roomId: "breeding" }),
  ],
  food: 10,
});
colony.upgradeColonyRoom("slot-north", { autoFeeder: true });
rooms = colonyBuild.resolveColonyRooms(stateNow().colony, stateNow().scenes);
result = autoFeeder.processAutoFeeders(
  rooms,
  roomToadLists.getRoomToadLists(rooms, stateNow().toads),
);
check("работает жаба энергокомнаты", toadNow(1).state.hunger, 100);
check("без апгрейда в гнезде жаба не кормится", toadNow(2).state.hunger, 5);
check("корм: один на покормленную жабу", foodNow(), 9);

console.log("\n── 9. Жаба в походе дома не ест ───────────────────────────");
setState({
  toads: [toad({ id: 1, state: { hunger: 1 }, status: "out" })],
  food: 10,
});
rooms = colonyBuild.resolveColonyRooms(stateNow().colony, stateNow().scenes);
aviaryRoom = rooms.find((room) => room.kind === "aviary" && room.sceneId === 1);
colony.upgradeColonyRoom(aviaryRoom.id, { autoFeeder: true });
result = autoFeeder.processAutoFeeders(
  rooms,
  roomToadLists.getRoomToadLists(rooms, stateNow().toads),
);
check("жаба в походе не кормится", result.fed, 0);
check("корм не списан", foodNow(), 10);

console.log("\n── 10. Ручное кормление: один корм на жабу ────────────────");
check("корм на трёх жаб", feeding.getFeedCost([toad({ id: 1 }), toad({ id: 2 }), toad({ id: 3 })]), 3);
check("корм на пустой список", feeding.getFeedCost([]), 0);

console.log("\n── 11. Пороги: кормушка кормит на пороге выработки ────────");
check(
  "порог кормления = порогу выработки биомассы",
  autoFeeder.AUTO_FEED_HUNGER,
  gamification.PRODUCTION_MIN_HUNGER,
);
check("порог кормления жабы", autoFeeder.AUTO_FEED_HUNGER, 20);
check("порог выработки биомассы", gamification.PRODUCTION_MIN_HUNGER, 20);
check(
  "при голоде 20 жаба работает на минимуме",
  gamification.getProductionFactor(20),
  gamification.PRODUCTION_HUNGRY_FACTOR,
);
checkTrue(
  "при голоде 21 выработки больше, чем на минимуме",
  gamification.getProductionFactor(21) > gamification.PRODUCTION_HUNGRY_FACTOR,
);
check(
  "при голоде 60 — между минимумом и нормой",
  Math.round(gamification.getProductionFactor(60) * 100) / 100,
  0.65,
);
check("при голоде 100 выработка полная", gamification.getProductionFactor(100), 1);

console.log("\n── 12. Голодовка не запирает игрока ──────────────────────");
/** Жаба с обычными генами: rarity 1.2, weight 15 — как средняя на рынке */
const averageToad = (hunger) =>
  toad({ state: { hunger, hp: 100, energy: 100 }, genes: { rarity: 1.2, weight: 15, hungerRate: 1, personality: null } });
const hungryRate = gamification.getBiomassRate(averageToad(gamification.PRODUCTION_MIN_HUNGER));
checkTrue(
  "голодная жаба перекрывает апкипинг",
  hungryRate > gamification.UPKEEP_PER_TOAD_HOUR,
);
check(
  "голодная колония в плюсе, биомассы в сутки",
  Math.round((hungryRate - gamification.UPKEEP_PER_TOAD_HOUR) * 24 * 100) / 100,
  7.61,
);
const fedRate = gamification.getBiomassRate(averageToad(100));
checkTrue("сытая жаба вырабатывает больше голодной", fedRate > hungryRate);
check(
  "голодная жаба даёт долю от нормы",
  Math.round((hungryRate / gamification.getBiomassPotentialRate(averageToad(50))) * 100) / 100,
  gamification.PRODUCTION_HUNGRY_FACTOR,
);

console.log("\n── 13. Снос комнаты: состояние колонии ────────────────────");
const demolishCost = constants.DEMOLISH_ROOM_COST;
check("снос комнаты стоит 100 🔷", demolishCost, 100);

/** Настоящий свободный слот карты: рядом с ним есть комната, поэтому карта его открыла */
const slotId = colonyBuild.getBuildableSlots(
  colonyBuild.resolveColonyRooms({ rooms: [] }),
)[0].id;

setState({
  rooms: [],
  upgrades: { breeding: { autoFeeder: true } },
});
const builtRoom = colony.buildColonyRoom(slotId, "storage");
checkTrue("комната построена", Boolean(builtRoom));
check("постройка записала гекс", stateNow().colony.rooms.length, 1);
checkTrue(
  "постройка не потеряла чужие улучшения",
  stateNow().colony.upgrades.breeding?.autoFeeder === true,
);

// Улучшение стоит и у самой комнаты: снос обязан забрать его вместе со зданием
colony.upgradeColonyRoom(slotId, { autoFeeder: true });
const demolished = colony.demolishColonyRoom(slotId);
check("снос убрал постройку из сейва", demolished.rooms.length, 0);
checkTrue(
  "гекс помечен снесённым",
  stateNow().colony.demolished.includes(slotId),
);
checkTrue(
  "снос забрал улучшения комнаты",
  stateNow().colony.upgrades[slotId] === undefined,
);
checkTrue(
  "чужие улучшения снос не тронул",
  stateNow().colony.upgrades.breeding?.autoFeeder === true,
);
check(
  "снесённый гекс на карте — свободный слот",
  colonyBuild
    .resolveColonyRooms(stateNow().colony)
    .find((room) => room.id === slotId)?.kind,
  "empty",
);

// Тот же гекс застраивают заново: метка сноса должна сняться
colony.buildColonyRoom(slotId, "storage");
checkTrue(
  "постройка сняла метку сноса",
  !stateNow().colony.demolished.includes(slotId),
);
check(
  "гекс снова показывает комнату",
  colonyBuild
    .resolveColonyRooms(stateNow().colony)
    .find((room) => room.id === slotId)?.kind,
  "storage",
);

// Базовая комната в сейве не лежит: её снос помнит только метка
setState({ rooms: [], upgrades: { breeding: { autoFeeder: true } } });
colony.demolishColonyRoom("breeding");
checkTrue(
  "снос базового гнезда помнит метка",
  stateNow().colony.demolished.includes("breeding"),
);
check(
  "снесённое гнездо на карте — слот",
  colonyBuild
    .resolveColonyRooms(stateNow().colony)
    .find((room) => room.id === "breeding")?.kind,
  "empty",
);
checkTrue(
  "снос гнезда забрал его улучшения",
  stateNow().colony.upgrades.breeding === undefined,
);
check("повторный снос не задваивает метку", colony.demolishColonyRoom("breeding").demolished.length, 1);

console.log("\n────────────────────────────────────────────────────────────");
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.error(`   • ${item}`));
  process.exit(1);
}
console.log("✅ Автокормушка: все проверки прошли");

