/**
 * Проверка автокормушки и оффлайн-роста головастиков на РЕАЛЬНОМ коде проекта.
 *
 * Скрипт бандлит модули через esbuild и прогоняет их как обычный JS — проверяются
 * те же формулы и тот же порядок вызовов, что в игре (`MainScreen` → `catchUp`):
 *   1) автокормушка кормит только голодных жаб своего сектора, списывает по одному
 *      корму на жабу и не уходит в минус, когда склад опустел;
 *   2) без апгрейда и без корма она ничего не делает, жаба в походе не ест;
 *   3) оффлайн-роды: `created_at` головастика — реальное время родов, автокормушка
 *      ставит таймер роста на рождение, поэтому к входу в игру головастик уже
 *      повзрослел, а не начинает двухчасовой рост на входе;
 *   4) прогресс роста считается от рождения, а не от входа в игру;
 *   5) голодающий головастик из прошлой сессии получает таймер роста в момент
 *      кормления (а не «задним числом» с рождения);
 *   6) без кормления роста нет и приходит предупреждение о голоде;
 *   7) `processBreeding` растит сытых и предупреждает голодных;
 *   8) оффлайн-роды без корма: рост не начинается, о каждом головастике сообщают.
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

const HOUR = 60 * 60 * 1000;
const NEST = "breeding_100000001";

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

/** Состояние игры: гнездо-сектор в колонии (с апгрейдом или без) */
const stubState = ({ autoFeeder = true, food = 5, toads, lastSaved }) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 500,
    astro_quax: 10,
    biomass: 500,
    storage: { food, sparkleFlys: 0 },
  },
  scenes: [{ id: 1, name: "Био Под", capacity: 20, created_at: "" }],
  toads,
  colony: {
    rooms: [
      {
        id: NEST,
        slotId: "breeding",
        kind: "breeding",
        builtAt: "",
      },
    ],
    // Апгрейд лежит по `slotId` — так его ищет `getRoomUpgrades` у гекса
    upgrades: autoFeeder ? { breeding: { autoFeeder: true } } : {},
  },
  lastSaved: new Date(lastSaved).toISOString(),
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
/** Журнал заданий живёт отдельным ключом (`backend/quests-manager/storage.ts`) */
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
const babies = () =>
  gameState().toads.filter(
    (item) => item.stage === "toadpole" && item.scene_id === NEST,
  );

const breeding = bundle("src/utils/breeding-manager.ts", "breeding-manager");
const feeder = bundle("src/utils/auto-feeder.ts", "auto-feeder");
const stateManager = bundle("src/utils/state-manager.ts", "state-manager");
const dateLib = bundle("src/utils/date.ts", "date");
const storage = bundle("src/backend/localStorage.ts", "local-storage");
const growth = bundle("src/utils/toad-growth.ts", "toad-growth");
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

const notes = [];
const collect = (notification) => notes.push(notification);

const checkText = (label, value, pattern) => {
  const ok = typeof value === "string" && pattern.test(value);

  if (!ok) {
    failures.push(`${label}: получили «${value}», ждали ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${value}`);
};

/** Секторы так, как их видит игра: карта колонии + жильцы каждого гекса */
const roomFeeding = () => {
  const state = gameState();
  const rooms = colonyBuild.resolveColonyRooms(
    state.colony ?? {},
    state.scenes ?? [],
  );

  return { rooms, toadsByRoom: toadLists.getRoomToadLists(rooms, state.toads) };
};

/** Один тик автокормушки на текущем состоянии игры */
const feedNow = (options = {}) => {
  const { rooms, toadsByRoom } = roomFeeding();

  return feeder.processAutoFeeders(rooms, toadsByRoom, options);
};

/**
 * Упрощённый оффлайн-догон для проверки кормушки:
 * роды (без роста) → голод + автокормушка → рост.
 */
const catchUp = () => {
  const { hours: offlineHours, since: lastPlayTime } = dateLib.getOfflineTime(
    storage.getGameState().lastSaved
  );

  breeding.processBreeding(collect, { skipGrowth: true });
  // Новорождённые до кормления: дальше автокормушка может сразу их накормить,
  // и рост завершит их в этом же догоне — снимок нужен для проверок.
  const newborn = babies();
  stateManager.processHunger(offlineHours);

  const { rooms, toadsByRoom } = roomFeeding();
  const fed = feeder.processAutoFeeders(rooms, toadsByRoom, {
    newbornSince: lastPlayTime,
  });

  breeding.processToadpoleGrowth(collect);

  return { offlineHours, newbornSince: lastPlayTime, fed, newborn };
};


console.log("\n[1] Кормушка кормит голодных, тратит корм и не уходит в минус");
console.log("─".repeat(60));
reset({
  food: 2,
  lastSaved: Date.now(),
  toads: [
    toad({ id: 1, scene_id: NEST, state: { hunger: 10 } }),
    toad({ id: 2, scene_id: NEST, state: { hunger: 0 } }),
    toad({ id: 3, scene_id: NEST, state: { hunger: 100 } }),
  ],
});
const firstFeed = feedNow();
check("покормлено голодных", firstFeed.fed, 2);
check("корма списано по одному на жабу", firstFeed.spent, 2);
check("склад опустел ровно в ноль", gameState().user.storage.food, 0);
check("сытая жаба не тронута", findToad(3).state.hunger, 100);
check("голодные накормлены до 100 %", findToad(1).state.hunger, 100);

const emptyFeed = feedNow();
check("пустой склад: некого кормить", emptyFeed.fed, 0);
check("пустой склад: ничего не списано", emptyFeed.spent, 0);
check("корм не ушёл в минус", gameState().user.storage.food, 0);

reset({
  food: 5,
  lastSaved: Date.now(),
  toads: [
    toad({ id: 1, scene_id: NEST, state: { hunger: 5 } }),
    toad({ id: 2, scene_id: NEST, state: { hunger: 5 }, status: "out" }),
    toad({ id: 3, scene_id: 1, state: { hunger: 5 } }),
  ],
});
const expeditionFeed = feedNow();
check("жаба в походе не ест", expeditionFeed.fed, 1);
check("жаба из биопода не ест", findToad(3).state.hunger, 5);
check("жаба в походе осталась голодной", findToad(2).state.hunger, 5);
check("за корм в походе не списано", gameState().user.storage.food, 4);

console.log("\n[2] Без корма и без апгрейда кормушка ничего не делает");
console.log("─".repeat(60));
reset({
  food: 0,
  lastSaved: Date.now(),
  toads: [toad({ id: 1, scene_id: NEST, state: { hunger: 1 } })],
});
const noFood = feedNow();
check("без корма никто не накормлен", noFood.fed, 0);
check("без корма жаба осталась голодной", findToad(1).state.hunger, 1);

reset({
  autoFeeder: false,
  food: 10,
  lastSaved: Date.now(),
  toads: [toad({ id: 1, scene_id: NEST, state: { hunger: 1 } })],
});
const noUpgrade = feedNow();
check("без апгрейда никто не накормлен", noUpgrade.fed, 0);
check("без апгрейда корм цел", gameState().user.storage.food, 10);

console.log("\n[3] Оффлайн-роды: головастик растёт с рождения");
console.log("─".repeat(60));
const now = Date.now();
const lastSaved = now - 6 * HOUR;
const pregnancyStart = lastSaved - HOUR / 2;
const birthMs = pregnancyStart + HOUR;
notes.length = 0;
reset({
  food: 3,
  lastSaved,
  toads: [
    // Родители в репродукторе: аппетит 1, за 6 часов оффлайна они не проголодаются
    toad({
      id: 1,
      name: "Муж",
      sex: "male",
      scene_id: NEST,
      state: { hunger: 100 },
    }),
    toad({
      id: 2,
      name: "Жена",
      sex: "female",
      scene_id: NEST,
      state: { hunger: 100 },
      pregnancy: {
        isPregnant: true,
        pregnancyStart,
        pregnancyDuration: 1,
        fatherId: 1,
        father: toad({ id: 1 }),
        offspringCount: 2,
      },
    }),
  ],
});
const offline = catchUp();
check("оффлайн посчитан", offline.offlineHours > 5.9, true);
const born = offline.newborn;
check("родились двое головастиков", born.length, 2);
check(
  "время рождения записано в created_at",
  Math.abs(new Date(born[0].created_at).getTime() - birthMs) < 1000,
  true,
);
const grownUp = findToad(born[0].id);
check(
  "таймер роста идёт от рождения",
  grownUp.growthStartedAt,
  new Date(grownUp.created_at).getTime(),
);
check("второй головастик тоже", findToad(born[1].id).growthStartedAt, grownUp.growthStartedAt);
check("корм ушёл только на головастиков", offline.fed.spent, 2);
check("корм на складе остался", gameState().user.storage.food, 1);
check("головастики накормлены", grownUp.state.hunger, 100);
check("родителей не кормили", findToad(1).state.hunger < 100, true);
check("без ложных предупреждений о голоде", notes.length, 0);
check(
  "в догоне они уже выросли",
  offline.newborn.filter((item) => findToad(item.id).stage === "adult").length,
  2,
);
check("головастиков в гнезде не осталось", babies().length, 0);
check(
  "в колонии четверо взрослых",
  gameState().toads.filter((item) => item.stage === "adult").length,
  4,
);

console.log("\n[4] Прогресс роста считается от рождения");
console.log("─".repeat(60));
reset({
  food: 2,
  lastSaved: now - 3 * HOUR,
  toads: [
    toad({
      id: 1,
      stage: "toadpole",
      scene_id: NEST,
      created_at: new Date(now - HOUR).toISOString(),
      state: { hunger: 0 },
    }),
  ],
});
const halfWay = catchUp();
const halfToad = findToad(1);
check("головастик накормлен", halfToad.state.hunger, 100);
check(
  "таймер роста от рождения",
  halfToad.growthStartedAt,
  new Date(halfToad.created_at).getTime(),
);
const growthInfo = growth.getToadGrowthInfo(halfToad);
check("прогресс за час из двух", Math.round(growthInfo.progress), 50);
check("ещё не готов повзрослеть", growthInfo.isDue, false);
check("остался головастиком", halfToad.stage, "toadpole");
check("корм списан", halfWay.fed.spent, 1);

console.log("\n[5] Голодающий головастик из прошлой сессии растёт с кормления");
console.log("─".repeat(60));
reset({
  food: 1,
  lastSaved: now - 60 * 1000,
  toads: [
    toad({
      id: 1,
      stage: "toadpole",
      scene_id: NEST,
      created_at: new Date(now - 10 * HOUR).toISOString(),
      state: { hunger: 0 },
    }),
  ],
});
const beforeFeed = Date.now();
const lateFeed = catchUp();
const lateToad = findToad(1);
check(
  "таймер стартовал в момент кормления",
  lateToad.growthStartedAt >= beforeFeed,
  true,
);
check(
  "роста задним числом нет",
  lateToad.growthStartedAt > new Date(lateToad.created_at).getTime(),
  true,
);
check(
  "прогресс почти нулевой",
  growth.getToadGrowthInfo(lateToad).progress < 1,
  true,
);
check("остался головастиком", lateToad.stage, "toadpole");
check("корм списан", lateFeed.fed.spent, 1);

// Контроль: в игровом тике кормушка не знает про оффлайн и стартует рост «сейчас»
reset({
  food: 1,
  lastSaved: now,
  toads: [
    toad({
      id: 1,
      stage: "toadpole",
      scene_id: NEST,
      created_at: new Date(now - HOUR).toISOString(),
      state: { hunger: 0 },
    }),
  ],
});
feedNow();
check(
  "игровой тик стартует рост с кормления",
  Math.abs(findToad(1).growthStartedAt - Date.now()) < 1000,
  true,
);
check(
  "игровой тик не засчитывает оффлайн",
  growth.getToadGrowthInfo(findToad(1)).progress < 1,
  true,
);

console.log("\n[6] Без кормления роста нет");
console.log("─".repeat(60));
reset({
  autoFeeder: false,
  food: 5,
  lastSaved: now,
  toads: [
    toad({
      id: 1,
      stage: "toadpole",
      scene_id: NEST,
      created_at: new Date(now - 5 * HOUR).toISOString(),
      state: { hunger: 0 },
    }),
  ],
});
notes.length = 0;
breeding.processBreeding(collect);
const starving = findToad(1);
check("таймер роста не запущен", starving.growthStartedAt, null);
check("головастик не вырос", starving.stage, "toadpole");
check("игра предупредила о голоде", notes.length, 1);

console.log("\n[7] processBreeding растит сытых и предупреждает голодных");
console.log("─".repeat(60));
reset({
  food: 0,
  lastSaved: now,
  toads: [
    toad({
      id: 1,
      stage: "toadpole",
      scene_id: NEST,
      created_at: new Date(now - 5 * HOUR).toISOString(),
      growthStartedAt: now - 3 * HOUR,
      state: { hunger: 100 },
    }),
    toad({
      id: 2,
      stage: "toadpole",
      scene_id: NEST,
      created_at: new Date(now - 5 * HOUR).toISOString(),
      growthStartedAt: now - 3 * HOUR,
      state: { hunger: 0 },
    }),
  ],
});
notes.length = 0;
breeding.processBreeding(collect);
check("сытый головастик вырос", findToad(1).stage, "adult");
check("голодный остался головастиком", findToad(2).stage, "toadpole");
check("про голодного предупредили", notes.length, 1);

console.log("\n[8] Оффлайн-роды без корма: рост не начинается");
console.log("─".repeat(60));
notes.length = 0;
reset({
  autoFeeder: false,
  food: 0,
  lastSaved,
  toads: [
    toad({ id: 1, name: "Муж", sex: "male", scene_id: NEST }),
    toad({
      id: 2,
      name: "Жена",
      sex: "female",
      scene_id: NEST,
      pregnancy: {
        isPregnant: true,
        pregnancyStart,
        pregnancyDuration: 1,
        fatherId: 1,
        father: toad({ id: 1 }),
        offspringCount: 2,
      },
    }),
  ],
});
const hungryOffline = catchUp();
check("головастики родились голодными", hungryOffline.newborn.length, 2);
check(
  "роста без кормления нет",
  hungryOffline.newborn.filter((item) => findToad(item.id).growthStartedAt == null)
    .length,
  2,
);
check(
  "они остались головастиками",
  hungryOffline.newborn.filter((item) => findToad(item.id).stage === "toadpole")
    .length,
  2,
);
check("игрока предупредили о каждом", notes.length, 2);
checkText("предупреждение ведёт покормить", notes[0]?.content, /Покормите/);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   • ${item}`));
  process.exit(1);
}

console.log("✅ Все проверки автокормушки и роста прошли");

