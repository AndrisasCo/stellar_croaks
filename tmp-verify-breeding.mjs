/**
 * Проверка гнезда на РЕАЛЬНОМ коде проекта (без запуска игры).
 *
 * Скрипт бандлит модули через esbuild и прогоняет их как обычный JS — проверяются
 * те же формулы, что работают в игре:
 *   1) ухаживание мгновенное: таймера 15–30 минут и множителей характера больше нет,
 *      а `Toad.mating` из старых сейвов всё ещё считается занятостью;
 *   2) пару заводит кнопка «Начать ухаживание»: без готовой пары она не срабатывает и
 *      объясняет причину, а с парой — сразу беременеет самку (без кнопки пара просто ждёт);
 *   3) старый сейв: первый же тик `processBreeding` доигрывает ухаживание в беременность
 *      без всплывающих уведомлений, а уход в поход/выбывание срывает устаревшую пару;
 *   4) слоты гнезда заняты беременностью; беременную самку не унести с карты, а самца
 *      после ухаживания — можно;
 *   5) гнездо как комната: 2 взрослые жабы, обесточенная комната жаб не принимает,
 *      а каждый гекс-вольер показывает своих жильцов (`RoomConfig.sceneId`), а не один
 *      общий список жаб;
 *   6) беременность ускоряется Сияющей мушкой ✨ со склада (и астро-кваксами для старых
 *      сейвов), после чего сразу идут роды;
 *   7) роды: в гнезде головастики остаются у матери, в вольере — расходятся по вольерам;
 *   8) в обучении пара тоже беременеет сразу — отдельной ветки ожидания больше нет.
 *
 * Запуск: node tmp-verify-breeding.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-breeding-"));
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

/** Жаба с нужными полями (гены — как у обычной жабы с редкостью 1) */
const toad = (over = {}) => ({
  id: 1,
  name: "жаба",
  stage: "adult",
  generation: 1,
  sex: "male",
  type: "hybrid",
  scene_id: 1,
  homeId: 1,
  created_at: new Date().toISOString(),
  parents: null,
  energy: 100,
  breedCooldownUntil: 0,
  hp: 10,
  maxHp: 10,
  status: "ok",
  state: { hunger: 100 },
  pregnancy: null,
  mating: null,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 15,
    speed: 1,
    rarity: 1,
    hungerRate: 1,
    fertility: 1,
    personality: null,
    ...(over.genes ?? {}),
  },
  ...over,
});

const stubState = (patch = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 500,
    astro_quax: 10,
    biomass: 500,
    storage: { food: 10, sparkleFlys: 1 },
  },
  scenes: [{ id: 1, name: "Био Под", capacity: 20, created_at: "" }],
  toads: [
    toad({ id: 1, name: "Муж", sex: "male" }),
    toad({ id: 2, name: "Жена", sex: "female" }),
    toad({ id: 3, name: "Вторая самка", sex: "female" }),
  ],
  colony: {
    rooms: [
      {
        id: "breeding_100000001",
        slotId: "breeding",
        kind: "breeding",
        builtAt: "",
      },
    ],
  },
  lastSaved: "",
  createdAt: "",
  ...patch,
});

let raw = JSON.stringify(stubState());
/** Достижения хранятся в localStorage по отдельному ключу — ведём и его */
let achievementsRaw = JSON.stringify({
  completed: [],
  rewards: [],
  counter: {},
  toads_collection: [],
});
/** Прогресс рассказчика — отдельный ключ: от него зависит ускоренное обучение */
let narratorRaw = "";

const NARRATOR_KEY = "Stellar_Croak_Narrator_v1";

globalThis.localStorage = {
  getItem: (key) => {
    if (key === "achivements") {
      return achievementsRaw;
    }
    if (key === NARRATOR_KEY) {
      return narratorRaw;
    }
    return raw;
  },
  setItem: (key, value) => {
    if (key === "achivements") {
      achievementsRaw = value;
      return;
    }
    if (key === NARRATOR_KEY) {
      narratorRaw = value;
      return;
    }
    raw = value;
  },
  removeItem: (key) => {
    if (key === "achivements") {
      achievementsRaw = "";
      return;
    }
    if (key === NARRATOR_KEY) {
      narratorRaw = "";
      return;
    }
    raw = "";
  },
};

/**
 * Платформенный слой (`src/platform`) читает localStorage через `window.localStorage`:
 * в браузере это один и тот же объект, поэтому в заглушке тоже отдаём его туда.
 * Без этого сохранение игры молча падало и проверки гнезда видели пустое состояние.
 */
globalThis.window.localStorage = globalThis.localStorage;

/** Сброс состояния игры между проверками */
const reset = (patch) => {
  raw = JSON.stringify(stubState(patch));
  achievementsRaw = JSON.stringify({
    completed: [],
    rewards: [],
    counter: {},
    toads_collection: [],
  });
  narratorRaw = "";
};

const gameState = () => JSON.parse(raw);
const findToad = (id) => gameState().toads.find((item) => item.id === id);

/** Прямая правка жабы в состоянии — так же правят механики игры */
const patchToad = (id, patch) => {
  const state = gameState();
  state.toads = state.toads.map((item) =>
    item.id === id ? { ...item, ...patch } : item
  );
  raw = JSON.stringify(state);
};
const cfg = bundle("src/utils/gamification-config.ts", "gamification-config");
const breeding = bundle("src/utils/breeding-manager.ts", "breeding-manager");
const astro = bundle("src/utils/astro-shop.ts", "astro-shop");
const housing = bundle("src/utils/housing.ts", "housing");
const constants = bundle("src/utils/constants.tsx", "constants");
const rooms = bundle("src/components/HexMap/rooms-config.ts", "rooms-config");
const colonyBuild = bundle("src/components/HexMap/colony-build.ts", "colony-build");
const moveRules = bundle("src/components/HexMap/toad-move-rules.ts", "move-rules");
const toadLists = bundle("src/components/HexMap/room-toad-lists.ts", "room-toad-lists");

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
    }`
  );
};

const checkIn = (label, value, min, max) => {
  const ok = value >= min && value <= max;
  if (!ok) {
    failures.push(`${label}: получили ${value}, ждали ${min}…${max}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${value} (${min}…${max})`);
};

const checkText = (label, value, pattern) => {
  const ok = typeof value === "string" && pattern.test(value);
  if (!ok) {
    failures.push(`${label}: получили «${value}», ждали ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${value}`);
};

const notes = [];
const collect = (notification) => notes.push(notification);


console.log("\n[1] Ухаживание мгновенное: таймера 15–30 минут больше нет");
console.log("─".repeat(60));
check("getMatingMinutes убран из конфига", "getMatingMinutes" in cfg, false);
check("getMatingPersonalityFactor убран из конфига", "getMatingPersonalityFactor" in cfg, false);
check("getMatingTimeLeft убран из конфига", "getMatingTimeLeft" in cfg, false);
check("MATING_MIN_MINUTES убран из конфига", "MATING_MIN_MINUTES" in cfg, false);
check("isToadCourting убран из конфига", "isToadCourting" in cfg, false);

// Старый сейв: `mating` доигрывается тиком, но до тех пор жаба занята
const legacyCourting = toad({
  sex: "female",
  mating: { startedAt: Date.now(), startAt: Date.now() + 600000, partnerId: 1 },
});
check(
  "старое ухаживание ещё считается занятостью",
  cfg.isToadReadyToBreed(legacyCourting),
  false
);

/** Посадить жабу в гнездо — так же, как это делает игрок на карте колонии */
const intoNest = (id) => patchToad(id, { scene_id: constants.NEST_ROOM_ID });

/** Собрать пару в гнезде и нажать кнопку «Начать ухаживание» — так же, как это делает игрок */
const pairInNest = () => {
  intoNest(1);
  intoNest(2);

  return breeding.startNestCourtship(constants.NEST_ROOM_ID, collect);
};

console.log("\n[2] Пару заводит кнопка «Начать ухаживание»");
console.log("─".repeat(60));
reset();
notes.length = 0;
intoNest(1);
const lonelyCheck = breeding.checkNestCourtship(constants.NEST_ROOM_ID);
const lonely = breeding.startNestCourtship(constants.NEST_ROOM_ID, collect);
check("кнопка не готова: в гнезде только самец", lonelyCheck.ready, false);
check("с одним самцом ухаживание не начинается", lonely.started, false);
checkText("кнопка объясняет причину", lonelyCheck.message, /нужны самец и самка/);
checkText("уведомление о причине", notes.at(-1)?.content, /нужны самец и самка/);
check("причина уходит в уведомление как warn", notes.at(-1)?.type, "warn");

notes.length = 0;
intoNest(2);
const pairCheck = breeding.checkNestCourtship(constants.NEST_ROOM_ID);
check("кнопка готова: пара в гнезде", pairCheck.ready, true);
checkText("подсказка про мгновенное ухаживание", pairCheck.message, /ухаживание мгновенное/);
const breed = breeding.startNestCourtship(constants.NEST_ROOM_ID, collect);
check("кнопка запустила ухаживание", breed.started, true);
check("старт ухаживания без тоста", notes.length, 0);
const mother = findToad(2);
const father = findToad(1);
check("самка сразу беременна", Boolean(mother.pregnancy?.isPregnant), true);
check("в беременности записан отец", mother.pregnancy?.fatherId, father.id);
check("самка больше не ухаживает", mother.mating, null);
check("самец больше не ухаживает", father.mating, null);
check("самка в гнезде", mother.scene_id, constants.NEST_ROOM_ID);
check("самец в гнезде", father.scene_id, constants.NEST_ROOM_ID);
check("энергия самки списана", mother.energy < 100, true);
check("энергия самца списана", father.energy < 100, true);
check("биомасса списана", gameState().user.biomass < 500, true);

// Женская особь остаётся в репродукторе до родов, самец после ухаживания свободен:
// его можно забрать в биопод, и беременность от этого не срывается.
check("беременную самку с карты не унести", typeof moveRules.getToadMoveIssue(mother), "string");
checkText(
  "причина: самка вынашивает потомство",
  moveRules.getToadMoveIssue(mother),
  /вынашивает потомство/
);
check("самца после ухаживания можно забрать", moveRules.getToadMoveIssue(father), null);

const nestAdults = () =>
  gameState().toads.filter(
    (item) => item.scene_id === constants.NEST_ROOM_ID && item.stage === "adult"
  );
check("пара занимает оба слота репродуктора", nestAdults().length, 2);

// Третья жаба в гнезде новую пару не заводит: кнопка видит беременность
notes.length = 0;
intoNest(3);
const busyCheck = breeding.checkNestCourtship(constants.NEST_ROOM_ID);
const secondPair = breeding.startNestCourtship(constants.NEST_ROOM_ID, collect);
check("кнопка погасла: беременность уже идёт", busyCheck.ready, false);
checkText(
  "причина: в репродукторе уже идёт беременность",
  busyCheck.message,
  /уже идёт беременность/,
);
check("вторую пару кнопка не берёт", secondPair.started, false);
check("третья жаба в гнезде не ухаживает", Boolean(findToad(3).mating), false);
check("третья жаба в гнезде не беременна", Boolean(findToad(3).pregnancy), false);



console.log("\n[3] Старый сейв: первый тик сразу даёт беременность");
console.log("─".repeat(60));
reset();
intoNest(1);
intoNest(2);
// Таймер из старого сейва ещё «в будущем»: новый код его не ждёт
const legacyMating = {
  startedAt: Date.now(),
  startAt: Date.now() + 600000,
};
patchToad(1, { mating: { ...legacyMating, partnerId: 2 } });
patchToad(2, { mating: { ...legacyMating, partnerId: 1 } });
notes.length = 0;
breeding.processBreeding(collect);
const born = findToad(2);
check("самка беременна на первом тике", born.pregnancy?.isPregnant, true);
check("беременность без ухаживания", born.mating, null);
check("самка осталась в гнезде", born.scene_id, constants.NEST_ROOM_ID);
check("самец перестал ухаживать", findToad(1).mating, null);
check("самец остался в гнезде", findToad(1).scene_id, constants.NEST_ROOM_ID);
check("беременность без тоста об успехе", notes.length, 0);
check("беременность заняла репродуктор", breeding.checkNestCourtship(constants.NEST_ROOM_ID).ready, false);

console.log("\n[4] Старый сейв: срыв ухаживания и независимость беременности");
console.log("─".repeat(60));
reset();
intoNest(1);
intoNest(2);
patchToad(1, { mating: { ...legacyMating, partnerId: 2 }, status: "out" });
patchToad(2, { mating: { ...legacyMating, partnerId: 1 } });
notes.length = 0;
breeding.processBreeding(collect);
check("самка перестала ухаживать", findToad(2).mating, null);
check("самец перестал ухаживать", findToad(1).mating, null);
check("беременность не началась", Boolean(findToad(2).pregnancy), false);
check("самка осталась в гнезде", findToad(2).scene_id, constants.NEST_ROOM_ID);
check(
  "предупреждение о срыве",
  notes.some((item) => item.type === "warn" && /прервано/.test(item.content)),
  true
);

// Беременность уже началась — уход самца из репродуктора её не срывает
reset();
pairInNest();
const pregnancyBefore = findToad(2).pregnancy;
patchToad(1, { scene_id: 1 });
notes.length = 0;
breeding.processBreeding(collect);
check("беременность не зависит от самца", findToad(2).pregnancy?.isPregnant, true);
check(
  "беременность не перезапустилась",
  findToad(2).pregnancy?.pregnancyStart,
  pregnancyBefore.pregnancyStart
);
check("самец вне репродуктора", findToad(1).scene_id, 1);
check("роды не наступили раньше срока", notes.length, 0);


console.log("\n[5] Гнездо как комната на карте");
console.log("─".repeat(60));
reset();
// Вольеры карты: базовый гекс «Вольер» показывает вольер колонии, постройка — свой
// (`ColonyRoomState.sceneId` → `RoomConfig.sceneId`), иначе один список жаб рисовался бы
// на всех гексах-вольерах сразу.
const baseScene = { id: 1, name: "Био Под", capacity: 20, created_at: "" };
const secondScene = { id: 99, name: "Вольер #2", capacity: 20, created_at: "" };
const colonyRooms = colonyBuild.resolveColonyRooms(
  {
    rooms: [
      { id: "outpost-0", kind: "aviary", builtAt: "", sceneId: secondScene.id },
      {
        id: constants.NEST_ROOM_ID,
        slotId: "breeding",
        kind: "breeding",
        builtAt: "",
      },
    ],
  },
  [baseScene, secondScene]
);
const grid = colonyBuild.getPowerGrid(colonyRooms, {});
const nest = colonyRooms.find((room) => room.kind === "breeding");
const nestMapId = nest.id;
check("гнездо на карте есть", Boolean(nest), true);
check(
  "гнездо под током (ядро питает кольцо 1)",
  colonyBuild.isRoomPowered(nest, grid),
  true
);
check(
  "базовый гекс вольера показывает вольер колонии",
  colonyRooms.find((room) => room.kind === "aviary").sceneId,
  baseScene.id
);
check(
  "построенный гекс вольера показывает свой вольер",
  colonyRooms.find((room) => room.slotId === "outpost-0").sceneId,
  secondScene.id
);

const adult = toad();
const moveContext = {
  aviaryCount: 0,
  aviaryCapacity: 20,
  rooms: colonyRooms,
  powerGrid: grid,
};
check(
  "гнездо принимает взрослую жабу",
  moveRules.canMoveToadToRoom(adult, nest, { ...moveContext, roomToads: [] }).ok,
  true
);
checkText(
  "гнездо полно (2/2)",
  moveRules.canMoveToadToRoom(adult, nest, {
    ...moveContext,
    roomToads: [toad({ id: 9 }), toad({ id: 8 })],
  }).reason,
  /\(2\/2\)/
);
checkText(
  "головастик в гнездо нельзя",
  moveRules.canMoveToadToRoom(toad({ stage: "toadpole" }), nest, {
    ...moveContext,
    roomToads: [],
  }).reason,
  /только взрослые жабы/
);
checkText(
  "беременную жабу не унести",
  moveRules.getToadMoveIssue(toad({ pregnancy: { isPregnant: true } })),
  /вынашивает потомство/
);

// Гексы рисуют каждый своих жаб: вольер — жильцов своего вольера (`scene_id`),
// комнаты — тех, кто физически в них сидит (`scene_id` = id комнаты)
const mapLists = toadLists.getRoomToadLists(colonyRooms, [
  toad({ id: 1, scene_id: baseScene.id }),
  toad({ id: 20, scene_id: secondScene.id }),
  toad({ id: 2, scene_id: nestMapId }),
  toad({ id: 7, scene_id: nestMapId }),
]);
check(
  "гнездо рисует только тех, кого туда посадили",
  mapLists[nestMapId].length,
  2
);
check(
  "головастики в гнезде мест не занимают",
  moveRules.canMoveToadToRoom(adult, nest, {
    ...moveContext,
    roomToads: [
      toad({ id: 9 }),
      toad({ id: 7, stage: "toadpole" }),
      toad({ id: 6, stage: "toadpole" }),
    ],
  }).ok,
  true
);
checkText(
  "жаба, посаженная в гнездо, не пропадает с карты",
  mapLists[nestMapId].some((item) => item.id === 7) ? "да" : "нет",
  /да/
);
check("вольер показывает жильцов своего вольера", mapLists[constants.AVIARY_ROOM_ID].length, 1);
check("второй вольер показывает своих жильцов", mapLists["outpost-0"].length, 1);
checkText(
  "жаба из вольера не висит ещё и в гнезде",
  mapLists[nestMapId].some((item) => item.id === 1) ? "да" : "нет",
  /нет/
);
check(
  "в вольере не видно жаб из комнаты",
  mapLists[constants.AVIARY_ROOM_ID].some((item) => typeof item.scene_id === "string")
    ? "да"
    : "нет",
  "нет"
);
check("у пустых гексов жаб нет", Boolean(mapLists["slot-north"]), false);

// Страховка: вольер без своего гекса (старые сейвы покупали вольеры в магазине)
// показывает базовый гекс — жаба не пропадает с карты вовсе
const orphanLists = toadLists.getRoomToadLists(colonyRooms, [
  toad({ id: 300, scene_id: 12345 }),
]);
check("жаба из вольера без гекса видна на базовом вольере", orphanLists[constants.AVIARY_ROOM_ID].length, 1);

const darkColony = colonyBuild.resolveColonyRooms({
  rooms: [{ id: "outpost-0", kind: "storage", builtAt: "" }],
});
const darkGrid = colonyBuild.getPowerGrid(darkColony, {});
const darkStorage = { ...rooms.HEX_ROOM_BY_ID["outpost-0"], kind: "storage" };
check(
  "дальний склад обесточен",
  colonyBuild.isRoomPowered(darkStorage, darkGrid),
  false
);
checkText(
  "в обесточенную комнату жабу не пускают",
  moveRules.canMoveToadToRoom(adult, darkStorage, {
    ...moveContext,
    roomToads: [],
    rooms: darkColony,
    powerGrid: darkGrid,
  }).reason,
  /нет электричества/
);

console.log("\n[4.1] Отдых пары, кнопка и работа в комнатах");
console.log("─".repeat(60));
reset();
intoNest(1);
intoNest(2);
// Пара после спаривания уходит на отдых: кнопка не берёт её, пока не пройдёт кулдаун
patchToad(1, { breedCooldownUntil: Date.now() + 600000 });
patchToad(2, { breedCooldownUntil: Date.now() + 600000 });
const tooSoonCheck = breeding.checkNestCourtship(constants.NEST_ROOM_ID);
const tooSoon = breeding.startNestCourtship(constants.NEST_ROOM_ID, collect);
check("уставшую пару кнопка не берёт", tooSoon.started, false);
checkText("причина: жабы набираются сил", tooSoon.message, /восстанавливает силы/);
checkText("та же причина под кнопкой", tooSoonCheck.message, /восстанавливает силы/);

// Тик пару не заводит: ухаживание всегда начинается кнопкой игрока
notes.length = 0;
breeding.processBreeding(collect);
check("тик не заводит уставшую пару", Boolean(findToad(2).pregnancy), false);
check("тик молчит о причине", notes.length, 0);

patchToad(1, { breedCooldownUntil: 0 });
patchToad(2, { breedCooldownUntil: 0 });
const restedCheck = breeding.checkNestCourtship(constants.NEST_ROOM_ID);
check("после отдыха кнопка оживает", restedCheck.ready, true);

notes.length = 0;
breeding.processBreeding(collect);
check("тик молчит и у отдохнувшей пары", Boolean(findToad(1).pregnancy), false);
check("тик не шумит уведомлением", notes.length, 0);

const byButton = breeding.startNestCourtship(constants.NEST_ROOM_ID, collect);
check("отдохнувшую пару заводит кнопка", byButton.started, true);
check("беременность началась сразу", findToad(2).pregnancy?.isPregnant, true);

reset();
patchToad(1, { scene_id: "outpost-3" });
intoNest(2);
const worker = breeding.startNestCourtship(constants.NEST_ROOM_ID, collect);
check("жаба с работы в пару не встаёт", worker.started, false);
checkText("причина: в гнезде нет пары", worker.message, /нужны самец и самка/);

console.log("\n[6] Ускорение беременности мушкой ✨ и жильё");
console.log("─".repeat(60));
reset();
pairInNest();
const fliesBefore = gameState().user.storage.sparkleFlys;
check("сияющая мушка на складе есть", fliesBefore, 1);
const flyAccelerated = await breeding.accelerateNestPregnancy(2, collect);
check("беременность ускоряется мушкой", flyAccelerated.success, true);
check("мушка списана со склада", gameState().user.storage.sparkleFlys, fliesBefore - 1);
check("мать больше не беременна", Boolean(findToad(2).pregnancy), false);
check("мать осталась в репродукторе", findToad(2).scene_id, constants.NEST_ROOM_ID);
check(
  "после ускорения родились головастики",
  gameState().toads.filter(
    (item) => item.stage === "toadpole" && item.scene_id === constants.NEST_ROOM_ID
  ).length > 0,
  true
);

// Мушка одна: повторное ускорение уже нечего ускорять
notes.length = 0;
const noPregnancy = await breeding.accelerateNestPregnancy(2, collect);
check("небеременную жабу не ускоряют", noPregnancy.success, false);
checkText("причина: потомства нет", noPregnancy.message, /не вынашивает/);

// Старый сейв с беременностью: астро-кваксы по-прежнему ускоряют её вдвое
reset();
patchToad(2, {
  pregnancy: {
    isPregnant: true,
    pregnancyStart: Date.now(),
    pregnancyDuration: 3600000,
    fatherId: 1,
    father: toad({ id: 1 }),
    offspringCount: 1,
  },
});
const astroAccelerated = astro.acceleratePregnancy(2);
check("астро-кваксы ускоряют беременность", astroAccelerated.success, true);
check("астро-кваксы списаны", gameState().user.astro_quax, 8);

// Ухаживание ускорять больше нечем: оно мгновенное, а старый сейв доиграется сам
reset();
intoNest(1);
intoNest(2);
patchToad(1, {
  mating: { startedAt: Date.now(), startAt: Date.now() + 600000, partnerId: 2 },
});
patchToad(2, {
  mating: { startedAt: Date.now(), startAt: Date.now() + 600000, partnerId: 1 },
});
const astroCourtship = astro.acceleratePregnancy(2);
check("астро не ускоряют устаревшее ухаживание", astroCourtship.success, false);
checkText("причина: ухаживание мгновенное", astroCourtship.message, /мгновенное/);
check("астро за пустое ускорение не списаны", gameState().user.astro_quax, 10);

reset();
pairInNest();
// Место у жабы одно: пара ушла в репродуктор, поэтому биопод занят только третьей жабой,
// а вернутся они домой кнопкой «Домой» — с проверкой свободного места
check("пара в репродукторе место в биоподе освободила", housing.getHousingInfo().used, 1);
check("жильцов в биоподе осталось", housing.getEnclosureToads(1).length, 1);
check("мест в биоподах не прибавилось", housing.getHousingInfo().capacity, 20);

console.log("\n[7] Роды: гнездо оставляет головастиков у матери");
console.log("─".repeat(60));
reset();
pairInNest();
const waited = { startedAt: Date.now() - 900000, startAt: Date.now() - 1 };
patchToad(1, { mating: { ...findToad(1).mating, ...waited } });
patchToad(2, { mating: { ...findToad(2).mating, ...waited } });
breeding.processBreeding(collect);
const pregnancy = findToad(2).pregnancy;
check("самка беременна в гнезде", Boolean(pregnancy?.isPregnant), true);

// Состариваем беременность: следующий тик становится родами
patchToad(2, {
  pregnancy: { ...pregnancy, pregnancyStart: Date.now() - 3600000 * 99 },
});
notes.length = 0;
breeding.processBreeding(collect);
await new Promise((resolve) => setTimeout(resolve, 30));
const bornInNest = gameState().toads.filter(
  (item) => item.stage === "toadpole" && item.scene_id === constants.NEST_ROOM_ID
);
check("головастики родились в репродукторе", bornInNest.length > 0, true);
check("роды в репродукторе без тоста", notes.length, 0);
check("мать осталась в репродукторе", findToad(2).scene_id, constants.NEST_ROOM_ID);
check("мать больше не беременна", Boolean(findToad(2).pregnancy), false);

// Старая беременность вне гнезда (до обновления): потомство расходится по вольерам
reset();
patchToad(2, {
  pregnancy: {
    isPregnant: true,
    pregnancyStart: Date.now() - 3600000 * 99,
    pregnancyDuration: 1,
    fatherId: 1,
    father: toad({ id: 1 }),
    offspringCount: 2,
  },
});
patchToad(1, { scene_id: "outpost-3" });
notes.length = 0;
breeding.processBreeding(collect);
await new Promise((resolve) => setTimeout(resolve, 30));
check("мать из вольера осталась в своём биоподе", findToad(2).scene_id, 1);
check("роды в вольере без тоста", notes.length, 0);
check(
  "головастики вольера остались в биоподах",
  gameState().toads.filter(
    (item) => item.stage === "toadpole" && typeof item.scene_id === "string"
  ).length,
  0
);

// В обучении отдельной ветки ожидания больше нет: пара тоже беременеет сразу.
console.log("\n[8] Обучение: беременность тоже сразу после ухаживания");
console.log("─".repeat(60));
reset();
narratorRaw = JSON.stringify({ status: "active", step: "breed" });
notes.length = 0;
const tutorialPair = pairInNest();
check("кнопка обучения запускает ухаживание", tutorialPair.started, true);
checkText(
  "сообщение ведёт к ускорению беременности",
  tutorialPair.message,
  /сразу забеременела/
);
const tutorialMother = findToad(2);
check("самка сразу беременна", tutorialMother.pregnancy?.isPregnant, true);
check("ухаживание не висит", tutorialMother.mating, null);
check(
  "самка осталась в репродукторе",
  tutorialMother.scene_id,
  constants.NEST_ROOM_ID
);
check(
  "самец остался в репродукторе",
  findToad(1).scene_id,
  constants.NEST_ROOM_ID
);
check("самец больше не ухаживает", findToad(1).mating, null);
check("уведомлений об успехе нет", notes.length, 0);

// Вне обучения поведение то же самое — таймеров ожидания нет
reset();
pairInNest();
check("вне обучения беременность тоже сразу", findToad(2).pregnancy?.isPregnant, true);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   • ${item}`));
  process.exit(1);
}

console.log("✅ Все проверки гнезда прошли");
