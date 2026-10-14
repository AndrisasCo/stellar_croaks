/**
 * Проверка места жабы — «биопод ИЛИ сектор колонии» (на РЕАЛЬНОМ коде проекта).
 *
 * Скрипт бандлит модули через esbuild и гоняет те же функции, что работают в игре:
 *   1) место: жаба, посаженная в сектор (`placeToadInRoom`), в биоподе уже не живёт —
 *      `scene_id` пуст, место в биоподе свободно, а дом уехал в `homeId`;
 *   2) список и статистика биопода считают только тех, кто в нём сейчас
 *      (`getEnclosureToads`, `getHousingInfo`), карта рисует их по гексам
 *      (`getRoomToadLists`), а жабу в секторе показывает сам сектор;
 *   3) возврат домой: `sendToadHome` ведёт в биопод, который жаба помнит, и проверяет
 *      место — в полный биопод жаба не влезает (`no-space`) и остаётся, где была;
 *   4) переезд в другой биопод (`moveToadToAviary`) тоже проверяет место и меняет дом;
 *   5) новые жабы: рождённый в репродукторе головастик место в биоподе не занимает, но дом
 *      у него есть (`createToads`), а новая жаба в биоподе получает дом по месту;
 *   6) миграция старых сейвов: `scene_id` становится домом (`homeId`), жабы в секторах
 *      освобождают биоподы, «складские» жабы расселяются по биоподам.
 *
 * Запуск: node tmp-verify-toad-place.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-place-"));
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
  roomId: null,
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

/** Биоподы: #1 на два места, #2 на одно — чтобы было видно, когда «мест нет» */
const stubState = (patch = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 500,
    astro_quax: 10,
    biomass: 500,
    storage: { food: 10 },
  },
  scenes: [
    { id: 1, name: "Биопод #1", capacity: 2, created_at: "" },
    { id: 2, name: "Биопод #2", capacity: 1, created_at: "" },
  ],
  toads: [
    toad({ id: 1, name: "Домашний", scene_id: 1, homeId: 1 }),
    toad({ id: 2, name: "Домашняя", sex: "female", scene_id: 1, homeId: 1 }),
    toad({ id: 3, name: "Соседка", sex: "female", scene_id: 2, homeId: 2 }),
  ],
  colony: { rooms: [] },
  lastSaved: "",
  createdAt: "",
  ...patch,
});

let raw = JSON.stringify(stubState());
let achievementsRaw = JSON.stringify({
  completed: [],
  rewards: [],
  counter: {},
  toads_collection: [],
});

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

/** Платформенный слой читает localStorage через `window.localStorage` — отдаём тот же объект */
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
};

const gameState = () => JSON.parse(raw);
const findToad = (id) => gameState().toads.find((item) => item.id === id);

const storage = bundle("src/backend/localStorage.ts", "local-storage");
const backend = bundle("src/backend/index.ts", "backend-index");
const colony = bundle("src/backend/colony.ts", "colony");
const housing = bundle("src/utils/housing.ts", "housing");
const place = bundle("src/utils/toad-location.ts", "toad-location");
const colonyBuild = bundle("src/components/HexMap/colony-build.ts", "colony-build");
const constants = bundle("src/utils/constants.ts", "constants");
const toadLists = bundle("src/components/HexMap/room-toad-lists.ts", "room-toad-lists");

const NEST = constants.NEST_ROOM_ID;
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
const checkText = (label, actual, pattern) => {
  const ok = pattern.test(String(actual));
  if (!ok) {
    failures.push(`${label}: получили «${actual}», ждали ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

/** Гексы карты: базовый гекс «Биопод» + построенный, у каждого — свой биопод */
const mapRooms = () =>
  colonyBuild.resolveColonyRooms(
    { rooms: [{ id: "outpost-0", kind: "aviary", builtAt: "", sceneId: 2 }] },
    gameState().scenes,
  );

/** Что рисует каждый гекс карты по текущему состоянию игры */
const lists = () => toadLists.getRoomToadLists(mapRooms(), gameState().toads);

console.log("[1] Место жабы: биопод или сектор колонии");
console.log("─".repeat(60));
reset();
check("жильцов в биоподе #1", housing.getEnclosureToads(1).length, 2);
check("жильцов в биоподе #2", housing.getEnclosureToads(2).length, 1);
check("мест занято", housing.getHousingInfo().used, 3);
check("мест свободно", housing.getHousingInfo().free, 0);

colony.placeToadInRoom(1, NEST);
check("жаба ушла в сектор: roomId", findToad(1).roomId, NEST);
check("жаба ушла в сектор: место в биоподе пусто", findToad(1).scene_id, null);
check("жаба ушла в сектор: дом помнит биопод", place.getToadHomeId(findToad(1)), 1);
check("жаба в секторе не жилец биопода", place.isToadInEnclosure(findToad(1)), false);
check("жаба в секторе — это «в секторе»", place.isToadStationed(findToad(1)), true);
check("жильцов в биоподе #1 после ухода", housing.getEnclosureToads(1).length, 1);
check("мест занято после ухода", housing.getHousingInfo().used, 2);
check("мест свободно после ухода", housing.getHousingInfo().free, 1);

console.log("\n[2] Карта: кто на каком гексе");
console.log("─".repeat(60));
const colonyRooms = mapRooms();
check("гекс биопода #1 показывает только свою жилицу", lists().aviary.length, 1);
check("на гексе биопода #1 — жаба 2", lists().aviary[0].id, 2);
check(
  "гекс биопода #2 показывает свою жилицу",
  lists()["outpost-0"].map((item) => item.id).join(","),
  "3",
);
check(
  "жабу в репродукторе рисует сам репродуктор",
  lists()[NEST].map((item) => item.id).join(","),
  "1",
);
check(
  "у базового гекса свой биопод",
  colonyRooms.find((room) => room.id === "aviary").sceneId,
  1,
);
check(
  "у построенного гекса свой биопод",
  colonyRooms.find((room) => room.id === "outpost-0").sceneId,
  2,
);

console.log("\n[3] Домой: место есть");
console.log("─".repeat(60));
const homeResult = colony.sendToadHome(1);
check("вернулась домой", homeResult.ok, true);
check("домой — в свой биопод", homeResult.scene?.id, 1);
check("место в биоподе записано", findToad(1).scene_id, 1);
check("сектор освобождён", findToad(1).roomId, null);
check("дом не изменился", findToad(1).homeId, 1);
check("жильцов в биоподе #1 снова", housing.getEnclosureToads(1).length, 2);
check("мест свободно снова", housing.getHousingInfo().free, 0);

console.log("\n[4] Домой: мест нет — жаба остаётся в секторе");
console.log("─".repeat(60));
colony.placeToadInRoom(1, NEST);
const newcomer = backend.createToad(
  toad({ id: 500, name: "Новосёл", scene_id: 1, homeId: 1 }),
)[0];
check("новосёл занял освободившееся место", newcomer.scene_id, 1);
check("свободных мест в колонии", housing.getHousingInfo().free, 0);

const fullResult = colony.sendToadHome(1);
check("домой не пустили", fullResult.ok, false);
check("причина — нет места", fullResult.reason, "no-space");
check("в отказе назван тот самый биопод", fullResult.scene?.id, 1);
checkText("дом жабы на месте", colony.getToadHomeScene(1)?.name, /Биопод #1/);
check("жаба осталась в секторе", findToad(1).roomId, NEST);
check("жаба по-прежнему вне биопода", findToad(1).scene_id, null);
check("дом жабы не потерялся", place.getToadHomeId(findToad(1)), 1);
check(
  "жаба в секторе в жильцах не числится",
  housing.getEnclosureToads(1).some((item) => item.id === 1),
  false,
);

console.log("\n[5] Переезд в другой биопод: тоже с проверкой места");
console.log("─".repeat(60));
const moveFull = colony.moveToadToAviary(1, 2);
check("в полный биопод не переехала", moveFull.ok, false);
check("причина — нет места", moveFull.reason, "no-space");
check("жаба осталась в секторе", findToad(1).roomId, NEST);

colony.placeToadInRoom(3, "power");
check("соседка ушла в ⚡-сектор", findToad(3).roomId, "power");
check("соседка место в биоподе освободила", findToad(3).scene_id, null);
check("соседка помнит свой дом", colony.getToadHomeScene(3)?.id, 2);

const moved = colony.moveToadToAviary(1, 2);
check("переехала в биопод #2", moved.ok, true);
check("новое место", findToad(1).scene_id, 2);
check("новый дом", findToad(1).homeId, 2);
check("сектор освобождён", findToad(1).roomId, null);
check("старый биопод её больше не считает", housing.getEnclosureToads(1).length, 2);
check("в новом биоподе она жилец", housing.getEnclosureToads(2).length, 1);
check("в секторе после переезда пусто", lists()[NEST]?.length ?? 0, 0);

console.log("\n[6] Новые жабы: головастик в репродукторе и новосёл в биоподе");
console.log("─".repeat(60));
reset();
const freeBefore = housing.getHousingInfo().free;
const tadpole = backend.createToads(
  [
    toad({
      id: 900,
      name: "Головастик",
      stage: "toadpole",
      scene_id: 2,
      homeId: 2,
      roomId: NEST,
    }),
  ],
  true,
)[0];
check(
  "головастик в репродукторе место в биоподе не занял",
  housing.getHousingInfo().free,
  freeBefore,
);
check("головастик в репродукторе: место не записано", tadpole.scene_id, null);
check("головастик в репродукторе: сектор записан", tadpole.roomId, NEST);
check("головастик в репродукторе: дом — биопод матери", tadpole.homeId, 2);

const born = backend.createToad(
  toad({ id: 901, name: "Новорождённый", scene_id: 1, homeId: 1 }),
)[0];
check("новая жаба в биоподе: место", born.scene_id, 1);
check("новая жаба в биоподе: дом — тот же биопод", born.homeId, 1);

const homeless = backend.createToad(toad({ id: 902, name: "Без места" }))[0];
check("жаба без места получила биопод", typeof homeless.scene_id, "number");
check("жаба без места получила дом", homeless.homeId, homeless.scene_id);
check(
  "жаба без места влезла в биопод колонии",
  gameState().scenes.some((scene) => scene.id === homeless.scene_id),
  true,
);

console.log("\n[7] Миграция старых сейвов");
console.log("─".repeat(60));
// Старый сейв: `scene_id` был домом — жаба в репродукторе его сохраняла, поля `homeId`
// ещё нет, а «складская» жаба жила с пустым `scene_id`
reset({
  toads: [
    toad({ id: 1, name: "Домашний", scene_id: 1 }),
    toad({ id: 2, name: "В репродукторе", sex: "female", scene_id: 1, roomId: NEST }),
    toad({ id: 3, name: "На складе", sex: "female", scene_id: null }),
  ],
});
const migrated = storage.getGameState();
const migratedToad = (id) => migrated.toads.find((item) => item.id === id);
check("домашняя жаба: дом из старых данных", migratedToad(1).homeId, 1);
check("домашняя жаба: место на месте", migratedToad(1).scene_id, 1);
check("жаба в репродукторе: дом сохранён", migratedToad(2).homeId, 1);
check("жаба в репродукторе: биопод освобождён", migratedToad(2).scene_id, null);
check("«складская» жаба расселена", migratedToad(3).scene_id, 1);
check("«складская» жаба получила дом", migratedToad(3).homeId, 1);
check("биопод #1 знает только своих", housing.getEnclosureToads(1).length, 2);
check(
  "мигранты видны на гексах",
  lists().aviary.map((item) => item.id).join(","),
  "1,3",
);
check(
  "после миграции репродуктор показывает свою жабу",
  lists()[NEST].map((item) => item.id).join(","),
  "2",
);

console.log("\n" + "=".repeat(60));
if (failures.length > 0) {
  console.log(`❌ МЕСТО ЖАБЫ: провалено проверок — ${failures.length}`);
  failures.forEach((line) => console.log(`   • ${line}`));
  process.exit(1);
}
console.log("✅ Место жабы: все проверки прошли");

