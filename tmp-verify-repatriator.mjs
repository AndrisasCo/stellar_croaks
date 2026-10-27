/**
 * Проверка репатриатора Медотсека и переключателей апгрейдов на РЕАЛЬНОМ коде проекта.
 *
 * Скрипт бандлит модули через esbuild и прогоняет их как обычный JS — проверяются те же
 * правила, что в игре (`MainScreen` → `runRepatriatorTick`, `RoomDataTab` → покупка):
 *   1) каталог: автокормушка и репатриатор доступны в Медотсеке, репатриатор — только там;
 *   2) покупка включает апгрейд, выключатель его не удаляет, старый сейв без `Enabled`
 *      считается включённым;
 *   3) репатриатор отправляет домой только взрослых жаб без болезни и с полным HP;
 *   4) выключенный репатриатор и апгрейд не в Медотсеке никого не выписывают;
 *   5) если домашний биопод полон и запасного нет — жаба остаётся на койке (`stuck`);
 *   6) автокормушка уважает собственный выключатель.
 *
 * Запуск: node tmp-verify-repatriator.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-repatriator-"));
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

const NEST = "breeding_100000001";
/** Жаба лежит на койке по id гекса (`getHospitalRoomIds`), а сейв помнит id постройки */
const HOSPITAL_SLOT = "slot-north";
const HOSPITAL = HOSPITAL_SLOT;
const HOSPITAL_ROOM_ID = "hospital_1";

/** Жаба с нужными полями (гены — как у обычной жабы с редкостью 1) */
const toad = (over = {}) => ({
  id: 1,
  name: "жаба",
  stage: "adult",
  generation: 1,
  sex: "male",
  type: "hybrid",
  scene_id: HOSPITAL,
  homeId: 1,
  created_at: new Date().toISOString(),
  parents: null,
  energy: 100,
  hp: 1000,
  status: "ok",
  growthStartedAt: null,
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
    ...(over.genes ?? {}),
  },
  ...over,
});

const HOSPITAL_ROOM = {
  id: HOSPITAL_ROOM_ID,
  slotId: HOSPITAL_SLOT,
  kind: "hospital",
  builtAt: "",
};

/** Состояние игры: Медотсек построен, апгрейды лежат по id гекса (как в сейве) */
const stubState = ({
  toads = [],
  upgrades = {},
  scenes = [{ id: 1, name: "Био Под", capacity: 20, created_at: "" }],
  rooms = [HOSPITAL_ROOM],
  food = 5,
}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 500,
    astro_quax: 10,
    biomass: 500,
    storage: { food, sparkleFlys: 0 },
  },
  scenes,
  toads,
  colony: { rooms, upgrades },
  lastSaved: new Date().toISOString(),
  createdAt: "",
});

let raw = "";
let achievementsRaw = JSON.stringify({
  completed: [],
  rewards: [],
  counter: {},
  toads_collection: [],
});
let narratorRaw = "";
let questJournalRaw = "";

const NARRATOR_KEY = "Stellar_Croak_Narrator_v1";
const QUEST_JOURNAL_KEY = "quest_journal";

globalThis.localStorage = {
  getItem: (key) => {
    if (key === "achivements") {
      return achievementsRaw;
    }
    if (key === NARRATOR_KEY) {
      return narratorRaw;
    }
    if (key === QUEST_JOURNAL_KEY) {
      return questJournalRaw;
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
    if (key === QUEST_JOURNAL_KEY) {
      questJournalRaw = value;
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
    if (key === QUEST_JOURNAL_KEY) {
      questJournalRaw = "";
      return;
    }
    raw = "";
  },
};

/** Платформенный слой (`src/platform`) читает localStorage через `window.localStorage` */
globalThis.window.localStorage = globalThis.localStorage;

/** Сброс состояния игры между проверками */
const reset = (options) => {
  raw = JSON.stringify(stubState(options));
  achievementsRaw = JSON.stringify({
    completed: [],
    rewards: [],
    counter: {},
    toads_collection: [],
  });
  narratorRaw = "";
  questJournalRaw = "";
};

const gameState = () => JSON.parse(raw);
const findToad = (id) => gameState().toads.find((item) => item.id === id);

const upgradesLib = bundle("src/utils/room-upgrades.ts", "room-upgrades");
const feeder = bundle("src/utils/auto-feeder.ts", "auto-feeder");
const repatriator = bundle("src/utils/repatriator.ts", "repatriator");
const diseases = bundle("src/utils/disease-manager.ts", "disease-manager");
const colonyBuild = bundle(
  "src/components/HexMap/colony-build.ts",
  "colony-build",
);
const toadLists = bundle(
  "src/components/HexMap/room-toad-lists.ts",
  "room-toad-lists",
);

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

/** Секторы так, как их видит игра: карта колонии + жильцы каждого гекса */
const roomContext = () => {
  const state = gameState();
  const rooms = colonyBuild.resolveColonyRooms(
    state.colony ?? {},
    state.scenes ?? [],
  );

  return { rooms, toadsByRoom: toadLists.getRoomToadLists(rooms, state.toads) };
};

/** Один тик репатриаторов на текущем состоянии игры */
const repatriateNow = () => {
  const { rooms, toadsByRoom } = roomContext();

  return repatriator.processRepatriators(rooms, toadsByRoom);
};

/** Один тик автокормушки на текущем состоянии игры */
const feedNow = () => {
  const { rooms, toadsByRoom } = roomContext();

  return feeder.processAutoFeeders(rooms, toadsByRoom);
};

console.log("\n[1] Каталог: репатриатор — только у Медотсека");
console.log("─".repeat(60));
const hospitalOptions = upgradesLib
  .getRoomUpgradeOptions("hospital")
  .map((option) => option.key);
const aviaryOptions = upgradesLib
  .getRoomUpgradeOptions("aviary")
  .map((option) => option.key);
check(
  "в Медотсеке кормушка, репатриатор и карантин-уловитель",
  hospitalOptions.join(","),
  "autoFeeder,repatriator,quarantineCatcher",
);
check("в биоподе только кормушка", aviaryOptions.join(","), "autoFeeder");
check("у ядра улучшений нет", upgradesLib.getRoomUpgradeOptions("core").length, 0);

const repatriatorOption = upgradesLib
  .getRoomUpgradeOptions("hospital")
  .find((option) => option.key === "repatriator");
const purchase = upgradesLib.getUpgradePurchasePatch(repatriatorOption);
check("покупка пишет сам апгрейд", purchase.repatriator, true);
check("покупка сразу включает его", purchase.repatriatorEnabled, true);
check(
  "выключатель не удаляет покупку",
  upgradesLib.hasUpgrade(
    {
      repatriator: true,
      ...upgradesLib.getUpgradeTogglePatch("repatriator", false),
    },
    "repatriator",
  ),
  true,
);

const disabledUpgrade = {
  ...purchase,
  ...upgradesLib.getUpgradeTogglePatch("repatriator", false),
};
check(
  "покупка осталась после выключения",
  upgradesLib.hasUpgrade(disabledUpgrade, "repatriator"),
  true,
);
check(
  "выключенный апгрейд не работает",
  upgradesLib.isUpgradeActive(disabledUpgrade, "repatriator"),
  false,
);
check(
  "старый сейв без Enabled считается включённым",
  upgradesLib.isUpgradeActive({ repatriator: true }, "repatriator"),
  true,
);
check(
  "непокупка с Enabled не работает",
  upgradesLib.isUpgradeActive({ repatriatorEnabled: true }, "repatriator"),
  false,
);

console.log("\n[2] Репатриатор выписывает только здоровых и целых");
console.log("─".repeat(60));
reset({
  toads: [
    toad({ id: 10, name: "Здоровый" }),
    toad({ id: 11, name: "Раненый", hp: 1 }),
    toad({
      id: 12,
      name: "Больной",
      state: {
        hunger: 100,
        diseaseId: 0,
        diseaseUntil: Date.now() + 60 * 60 * 1000,
      },
    }),
    toad({ id: 13, name: "В походе", status: "out" }),
    toad({ id: 14, name: "Головастик", stage: "toadpole" }),
  ],
  upgrades: { [HOSPITAL_SLOT]: { repatriator: true } },
});
const firstRepatriation = repatriateNow();
check("отправлена одна жаба", firstRepatriation.sent, 1);
check("это здоровая жаба", firstRepatriation.toadIds.join(","), "10");
check("места хватило всем", firstRepatriation.stuck, 0);
check("здоровая дома, в своём биоподе", findToad(10).scene_id, 1);
check("дом жабы сохранён", findToad(10).homeId, 1);
check("раненая осталась на койке", findToad(11).scene_id, HOSPITAL);
check("больная осталась на койке", findToad(12).scene_id, HOSPITAL);
check("жаба в походе не выписана", findToad(13).scene_id, HOSPITAL);
check("головастик не выписан", findToad(14).scene_id, HOSPITAL);

console.log("\n[2b] Вылеченная жаба уезжает домой, как только болезнь снята");
console.log("─".repeat(60));
reset({
  toads: [
    toad({
      id: 12,
      name: "Больной",
      state: {
        hunger: 100,
        diseaseId: 0,
        diseaseUntil: Date.now() + 60 * 60 * 1000,
      },
    }),
  ],
  upgrades: { [HOSPITAL_SLOT]: { repatriator: true } },
});
const whileSick = repatriateNow();
check("больную не выписывают", whileSick.sent, 0);
check("болезнь ещё идёт", findToad(12).state.diseaseId, 0);
check("лечение сработало", diseases.cureToad(12), true);
const afterCure = repatriateNow();
check("после лечения жаба выписана", afterCure.sent, 1);
check("жаба уехала домой", findToad(12).scene_id, 1);

console.log("\n[3] Выключенный репатриатор никого не трогает");
console.log("─".repeat(60));
reset({
  toads: [toad({ id: 10 })],
  upgrades: {
    [HOSPITAL_SLOT]: { repatriator: true, repatriatorEnabled: false },
  },
});
const switchedOff = repatriateNow();
check("никого не отправил", switchedOff.sent, 0);
check("жаба осталась на койке", findToad(10).scene_id, HOSPITAL);

reset({
  toads: [toad({ id: 10 })],
  upgrades: { [HOSPITAL_SLOT]: { autoFeeder: true } },
});
const noRepatriator = repatriateNow();
check("без апгрейда репатриатора никто не выписан", noRepatriator.sent, 0);
check("жаба всё ещё в Медотсеке", findToad(10).scene_id, HOSPITAL);

console.log("\n[4] Дома и в резерве нет места — жаба остаётся на койке");
console.log("─".repeat(60));
reset({
  scenes: [{ id: 1, name: "Био Под", capacity: 1, created_at: "" }],
  toads: [toad({ id: 10 }), toad({ id: 20, name: "Жилец", scene_id: 1 })],
  upgrades: { [HOSPITAL_SLOT]: { repatriator: true } },
});
const noSpace = repatriateNow();
check("никого не отправил", noSpace.sent, 0);
check("выписка не удалась", noSpace.stuck, 1);
check("пациент остался на койке", findToad(10).scene_id, HOSPITAL);
check("жилец биопода не тронут", findToad(20).scene_id, 1);

console.log("\n[5] Автокормушка тоже уважает выключатель");
console.log("─".repeat(60));
const NEST_ROOM = {
  id: NEST,
  slotId: "breeding",
  kind: "breeding",
  builtAt: "",
};
reset({
  food: 5,
  rooms: [NEST_ROOM],
  toads: [toad({ id: 30, scene_id: NEST, state: { hunger: 0 } })],
  upgrades: {
    breeding: { autoFeeder: true, autoFeederEnabled: false },
  },
});
const offFeed = feedNow();
check("выключенная кормушка не кормит", offFeed.fed, 0);
check("жаба осталась голодной", findToad(30).state.hunger, 0);
check("корм цел", gameState().user.storage.food, 5);

reset({
  food: 5,
  rooms: [NEST_ROOM],
  toads: [toad({ id: 30, scene_id: NEST, state: { hunger: 0 } })],
  upgrades: { breeding: { autoFeeder: true } },
});
const onFeed = feedNow();
check("включённая кормушка кормит", onFeed.fed, 1);
check("жаба накормлена", findToad(30).state.hunger, 100);
check("корм списан", gameState().user.storage.food, 4);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}

console.log("✅ Все проверки репатриатора прошли");


