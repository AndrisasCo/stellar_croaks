/**
 * Проверка меню «🏠 Переместить» в карточке жабы (на РЕАЛЬНОМ коде проекта).
 *
 * Скрипт бандлит модули через esbuild и проверяет, что меню предлагает не только
 * биоподы, но и секторы, которые принимают жаб:
 *   1) все группы на месте: биоподы, Медотсеки, КОНТУРы, энергосекторы, репродукторы;
 *   2) текущий биопод и текущий сектор в списке не дублируются;
 *   3) полный биопод, полный Медотсек и обесточенный сектор видны, но недоступны —
 *      с причиной, как при переносе жабы по карте;
 *   4) выбитую жабу принимает только Медотсек, головастика — только Медотсек;
 *   5) жаба в походе не может уйти никуда.
 *
 * Запуск: node tmp-verify-toad-move-menu.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-move-menu-"));
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
const checkText = (label, actual, pattern) => {
  const ok = pattern.test(String(actual));
  if (!ok) {
    failures.push(`${label}: получили «${actual}», ждали ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

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

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window.localStorage = globalThis.localStorage;

/** Жаба с полями, которые читают правила переноса */
const toad = (over = {}) => ({
  id: 1,
  name: "Жаба",
  stage: "adult",
  generation: 1,
  sex: "male",
  type: "hybrid",
  scene_id: 1,
  homeId: 1,
  created_at: new Date().toISOString(),
  parents: null,
  state: { hunger: 100, hp: 10, energy: 100 },
  pregnancy: null,
  mating: null,
  status: "ok",
  energy: 100,
  hp: 10,
  maxHp: 10,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 50,
    speed: 1,
    rarity: 1,
    hungerRate: 1,
    fertility: 1,
    personality: null,
  },
  ...over,
});

const state = {
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 50,
    astro_quax: 10,
    biomass: 100,
    storage: { food: 100, contourPass: 0 },
  },
  scenes: [
    { id: 1, name: "Биопод #1", capacity: 6, created_at: "" },
    { id: 2, name: "Биопод #2", capacity: 1, created_at: "" },
  ],
  toads: [],
  colony: { rooms: [] },
  expeditions: [],
  lastSaved: "",
  createdAt: "",
};
globalThis.localStorage.setItem("Game_State6", JSON.stringify(state));

const moveMenu = bundle(
  "src/components/HexMap/toad-move-destinations.ts",
  "toad-move-destinations",
);
const colonyBuild = bundle(
  "src/components/HexMap/colony-build.ts",
  "colony-build",
);
const toadLists = bundle(
  "src/components/HexMap/room-toad-lists.ts",
  "room-toad-lists",
);


/**
 * Карта колонии: базовый биопод плюс построенные Репродуктор, лазарет,
 * КОНТУР, энергосектор и второй биопод на свободных гексах первого кольца.
 * Все они соседствуют с ядром, поэтому под током.
 */
const colony = {
  rooms: [
    {
      id: "breeding_1",
      slotId: "breeding",
      kind: "breeding",
      builtAt: "",
    },
    { id: "hospital_1", slotId: "slot-north", kind: "hospital", builtAt: "" },
    { id: "scout_1", slotId: "slot-south", kind: "scout", builtAt: "" },
    {
      id: "power_1",
      slotId: "slot-south-west",
      kind: "power",
      builtAt: "",
    },
    {
      id: "aviary_2",
      slotId: "slot-north-east",
      kind: "aviary",
      builtAt: "",
      sceneId: 2,
    },
  ],
};
const scenes = state.scenes;
const colonyRooms = colonyBuild.resolveColonyRooms(colony, scenes);
const roomOfKind = (kind) => colonyRooms.find((room) => room.kind === kind);

const hospital = roomOfKind("hospital");
const scout = roomOfKind("scout");
const power = roomOfKind("power");
const breeding = roomOfKind("breeding");

const baseToads = [
  toad({ id: 1, name: "Путешественница", sex: "female", scene_id: 1 }),
  toad({ id: 2, name: "Соседка", sex: "female", scene_id: 1 }),
  toad({ id: 3, name: "Жилец второго", scene_id: 2, homeId: 2 }),
];

/** Собрать группы меню для жабы №1 с правками и дополнительными жабами */
const buildGroups = ({
  patch = {},
  extraToads = [],
  onExpedition = false,
  powerGrid,
} = {}) => {
  const toads = baseToads.map((item) =>
    item.id === 1 ? { ...item, ...patch } : item,
  );
  const allToads = [...toads, ...extraToads];
  const target = allToads.find((item) => item.id === 1);
  const toadsByRoom = toadLists.getRoomToadLists(colonyRooms, allToads);
  const grid =
    powerGrid ?? colonyBuild.getPowerGrid(colonyRooms, toadsByRoom, []);

  return moveMenu.getToadDestinationGroups({
    toad: target,
    scenes,
    rooms: colonyRooms,
    toads: allToads,
    toadsByRoom,
    powerGrid: grid,
    onExpedition,
    expeditions: [],
  });
};

const groupOf = (groups, kind) =>
  groups.find((group) => group.kind === kind);
const roomDest = (groups, kind, roomId) =>
  groupOf(groups, kind).destinations.find(
    (destination) => destination.roomId === roomId,
  );
const sceneDest = (groups, kind, sceneId) =>
  groupOf(groups, kind).destinations.find(
    (destination) => destination.sceneId === sceneId,
  );

console.log("\n[1] Меню знает все места, которые принимают жаб");
console.log("─".repeat(60));
const base = buildGroups();
check(
  "группы и их порядок",
  base.map((group) => group.kind).join(","),
  "aviary,hospital,scout,power,breeding",
);
check("подпись группы лечения", groupOf(base, "hospital").label, "Медотсеки");
check("подпись группы разведки", groupOf(base, "scout").label, "КОНТУРы");
check(
  "подпись группы энергии",
  groupOf(base, "power").label,
  "Энергосекторы",
);
check(
  "подпись группы размножения",
  groupOf(base, "breeding").label,
  "Репродукторы",
);
check("текущий биопод не предлагается", sceneDest(base, "aviary", 1), undefined);
check("второй биопод в списке", Boolean(sceneDest(base, "aviary", 2)), true);
check("лазарет в списке", Boolean(roomDest(base, "hospital", hospital.id)), true);
check("КОНТУР в списке", Boolean(roomDest(base, "scout", scout.id)), true);
check("энергосектор в списке", Boolean(roomDest(base, "power", power.id)), true);
check(
  "репродуктор в списке",
  Boolean(roomDest(base, "breeding", breeding.id)),
  true,
);
check("лазарет доступен", roomDest(base, "hospital", hospital.id).check.ok, true);
check("КОНТУР доступен", roomDest(base, "scout", scout.id).check.ok, true);
check(
  "энергосектор доступен",
  roomDest(base, "power", power.id).check.ok,
  true,
);
check(
  "репродуктор доступен",
  roomDest(base, "breeding", breeding.id).check.ok,
  true,
);

console.log("\n[2] Полные и текущие места");
console.log("─".repeat(60));
const fullAviary = sceneDest(base, "aviary", 2);
check("полный биопод виден", Boolean(fullAviary), true);
check("в полный биопод нельзя", fullAviary.check.ok, false);
checkText("причина — нет мест", fullAviary.check.reason, /нет свободных мест/);

const inHospital = buildGroups({ patch: { scene_id: hospital.id } });
check(
  "жаба в лазарете не видит свой лазарет",
  groupOf(inHospital, "hospital").destinations.length,
  0,
);
check(
  "из лазарета можно вернуться в свой биопод",
  sceneDest(inHospital, "aviary", 1).check.ok,
  true,
);

console.log("\n[3] Выбитую жабу принимает только Медотсек");
console.log("─".repeat(60));
const downed = buildGroups({
  patch: { scene_id: scout.id, hp: 0 },
});
check(
  "свой КОНТУР не предлагается",
  groupOf(downed, "scout").destinations.length,
  0,
);
check(
  "выбитую принимает лазарет",
  roomDest(downed, "hospital", hospital.id).check.ok,
  true,
);
const downedAviary = sceneDest(downed, "aviary", 1);
check("выбитую не тащат в биопод", downedAviary.check.ok, false);
checkText("причина — выбита", downedAviary.check.reason, /выбита/);
const downedPower = roomDest(downed, "power", power.id);
check("выбитую не тащат в энергосектор", downedPower.check.ok, false);

console.log("\n[4] Головастику — только Медотсек");
console.log("─".repeat(60));
const tadpole = buildGroups({ patch: { stage: "toadpole" } });
check(
  "головастика принимает лазарет",
  roomDest(tadpole, "hospital", hospital.id).check.ok,
  true,
);
const tadpoleScout = roomDest(tadpole, "scout", scout.id);
check("головастика не пускают в КОНТУР", tadpoleScout.check.ok, false);
checkText("причина — только взрослые", tadpoleScout.check.reason, /взрослые/);
check(
  "головастика не пускают в энергосектор",
  roomDest(tadpole, "power", power.id).check.ok,
  false,
);
const tadpoleBreeding = roomDest(tadpole, "breeding", breeding.id);
check("головастика не пускают в репродуктор", tadpoleBreeding.check.ok, false);
checkText(
  "причина — только взрослые",
  tadpoleBreeding.check.reason,
  /взрослые/,
);

console.log("\n[5] Полный Медотсек");
console.log("─".repeat(60));
const patients = Array.from({ length: 6 }, (_, index) =>
  toad({
    id: 20 + index,
    name: `Пациент ${index + 1}`,
    sex: index % 2 ? "female" : "male",
    scene_id: hospital.id,
  }),
);
const fullHospital = buildGroups({ extraToads: patients });
const fullHospitalDest = roomDest(fullHospital, "hospital", hospital.id);
check("полный лазарет виден", Boolean(fullHospitalDest), true);
check("в полный лазарет нельзя", fullHospitalDest.check.ok, false);
checkText(
  "причина — заняты койки",
  fullHospitalDest.check.reason,
  /заняты все 6 коек/,
);

console.log("\n[6] Обесточенный сектор");
console.log("─".repeat(60));
const grid = colonyBuild.getPowerGrid(
  colonyRooms,
  toadLists.getRoomToadLists(colonyRooms, baseToads),
  [],
);
const unpoweredGrid = {
  ...grid,
  powered: { ...grid.powered, [hospital.id]: false },
};
const unpowered = buildGroups({ powerGrid: unpoweredGrid });
const unpoweredHospital = roomDest(unpowered, "hospital", hospital.id);
check("обесточенный лазарет в списке", Boolean(unpoweredHospital), true);
check("в обесточенный лазарет нельзя", unpoweredHospital.check.ok, false);
checkText(
  "причина — нет электричества",
  unpoweredHospital.check.reason,
  /электричества/,
);
check(
  "запитанный лазарет доступен",
  roomDest(base, "hospital", hospital.id).check.ok,
  true,
);

console.log("\n[7] Жаба в походе");
console.log("─".repeat(60));
const busy = buildGroups({ onExpedition: true });
const busyHospital = roomDest(busy, "hospital", hospital.id);
check("лазарет виден", Boolean(busyHospital), true);
check("в походе лазарет недоступен", busyHospital.check.ok, false);
checkText("причина — поход", busyHospital.check.reason, /походе/);
check(
  "в походе закрыты все направления",
  busy
    .flatMap((group) => group.destinations)
    .every((destination) => !destination.check.ok),
  true,
);

console.log("\n" + "=".repeat(60));
if (failures.length > 0) {
  console.log(`❌ МЕНЮ ПЕРЕМЕЩЕНИЯ: провалено проверок — ${failures.length}`);
  failures.forEach((line) => console.log(`   • ${line}`));
  process.exit(1);
}
console.log("✅ Меню перемещения: все проверки прошли");
