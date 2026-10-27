/**
 * Проверка карантин-уловителя Медотсека на РЕАЛЬНОМ коде проекта.
 *
 * Скрипт бандлит модули через esbuild и проверяет те же правила, что работают в игре
 * (`MainScreen` → `runHospitalAutomationTick`, `RoomDataTab` → покупка):
 *   1) уловитель продаётся только Медотсеку и имеет отдельный выключатель;
 *   2) забирает только больных жаб, раненых и здоровых не трогает;
 *   3) HP не порог: больную выбитую жабу тоже кладут на койку;
 *   4) жаба в походе и жаба, уже лежащая в Медотсеке, остаются на месте;
 *   5) койки занимаются только свободные — лишние больные ждут следующего тика;
 *   6) выключенный и непокупленный уловитель не работает, старый сейв без `Enabled` — работает;
 *   7) автоматика и покупка апгрейда действительно вызывают уловитель.
 *
 * Запуск: node tmp-verify-quarantine.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-quarantine-"));
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

const HOSPITAL_SLOT = "slot-north";
const HOSPITAL = HOSPITAL_SLOT;
const HOSPITAL_ROOM = {
  id: "hospital_1",
  slotId: HOSPITAL_SLOT,
  kind: "hospital",
  builtAt: "",
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

const HOUR_MS = 60 * 60 * 1000;
const sickState = () => ({
  hunger: 100,
  diseaseId: 0,
  diseaseUntil: Date.now() + HOUR_MS,
});

/** Состояние игры: Медотсек построен, апгрейды лежат по id гекса (как в сейве) */
const stubState = ({
  toads = [],
  upgrades = {},
  scenes = [{ id: 1, name: "Био Под", capacity: 20, created_at: "" }],
  rooms = [HOSPITAL_ROOM],
}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 500,
    astro_quax: 10,
    biomass: 500,
    storage: { food: 5, sparkleFlys: 0 },
  },
  scenes,
  toads,
  colony: { rooms, upgrades },
  lastSaved: new Date().toISOString(),
  createdAt: "",
});

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

/** Платформенный слой (`src/platform`) читает localStorage через `window.localStorage` */
globalThis.window.localStorage = globalThis.localStorage;

/** Сброс состояния игры между проверками */
const reset = (options) => {
  raw = JSON.stringify(stubState(options));
};

const gameState = () => JSON.parse(raw);
const findToad = (id) => gameState().toads.find((item) => item.id === id);

const upgradesLib = bundle("src/utils/room-upgrades.ts", "room-upgrades");
const quarantine = bundle(
  "src/utils/quarantine-catcher.ts",
  "quarantine-catcher",
);
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

const checkText = (label, source, pattern) => {
  check(label, pattern.test(source), true);
};

/** Секторы так, как их видит игра: карта колонии + жильцы каждого гекса */
const roomContext = () => {
  const state = gameState();
  const rooms = colonyBuild.resolveColonyRooms(
    state.colony ?? {},
    state.scenes ?? [],
  );

  return {
    rooms,
    toadsByRoom: toadLists.getRoomToadLists(rooms, state.toads),
  };
};

/** Один тик уловителей на текущем состоянии игры */
const catchNow = () => {
  const { rooms, toadsByRoom } = roomContext();

  return quarantine.processQuarantineCatchers(rooms, toadsByRoom);
};

console.log("\n[1] Каталог: уловитель — только у Медотсека");
console.log("─".repeat(60));
const hospitalOptions = upgradesLib
  .getRoomUpgradeOptions("hospital")
  .map((option) => option.key);
const aviaryOptions = upgradesLib
  .getRoomUpgradeOptions("aviary")
  .map((option) => option.key);
check(
  "в Медотсеке кормушка, репатриатор и уловитель",
  hospitalOptions.join(","),
  "autoFeeder,repatriator,quarantineCatcher",
);
check("в биоподе только кормушка", aviaryOptions.join(","), "autoFeeder");

const catcherOption = upgradesLib
  .getRoomUpgradeOptions("hospital")
  .find((option) => option.key === "quarantineCatcher");
const purchase = upgradesLib.getUpgradePurchasePatch(catcherOption);
check("покупка пишет сам апгрейд", purchase.quarantineCatcher, true);
check("покупка сразу включает его", purchase.quarantineCatcherEnabled, true);
check(
  "выключенная покупка остаётся",
  upgradesLib.hasUpgrade(
    {
      quarantineCatcher: true,
      ...upgradesLib.getUpgradeTogglePatch("quarantineCatcher", false),
    },
    "quarantineCatcher",
  ),
  true,
);
check(
  "старый сейв без Enabled считается включённым",
  upgradesLib.isUpgradeActive(
    { quarantineCatcher: true },
    "quarantineCatcher",
  ),
  true,
);
check(
  "непокупка с Enabled не работает",
  upgradesLib.isUpgradeActive(
    { quarantineCatcherEnabled: true },
    "quarantineCatcher",
  ),
  false,
);

console.log("\n[2] Уловитель берёт только больных, HP не важен");
console.log("─".repeat(60));
reset({
  toads: [
    toad({ id: 40, name: "Больная", state: sickState() }),
    toad({ id: 41, name: "Раненая", hp: 1 }),
    toad({ id: 42, name: "Здоровая" }),
    toad({ id: 43, name: "Выбитая больная", hp: 0, state: sickState() }),
    toad({
      id: 44,
      name: "В походе",
      status: "out",
      state: sickState(),
    }),
    toad({
      id: 45,
      name: "Уже на койке",
      scene_id: HOSPITAL,
      state: sickState(),
    }),
    toad({
      id: 46,
      name: "Старый id койки",
      scene_id: "hospital_1",
      state: sickState(),
    }),
  ],
  upgrades: { [HOSPITAL_SLOT]: { quarantineCatcher: true } },
});
const caughtSick = catchNow();
check("изолированы две больные", caughtSick.caught, 2);
check("это жабы 40 и 43", caughtSick.toadIds.join(","), "40,43");
check("больная с полным HP на койке", findToad(40).scene_id, HOSPITAL);
check("выбитая больная тоже на койке", findToad(43).scene_id, HOSPITAL);
check("дом жабы сохранён", findToad(40).homeId, 1);
check("раненая без болезни осталась дома", findToad(41).scene_id, 1);
check("здоровая осталась дома", findToad(42).scene_id, 1);
check("жаба в походе не изолирована", findToad(44).scene_id, 1);
check("пациентка не переезжала", findToad(45).scene_id, HOSPITAL);
check(
  "старый канонический id койки тоже считается Медотсеком",
  findToad(46).scene_id,
  "hospital_1",
);

console.log("\n[3] Свободных коек хватает только одной жабе");
console.log("─".repeat(60));
const occupiedBeds = Array.from({ length: 5 }, (_, index) =>
  toad({ id: 100 + index, name: `Пациент ${index + 1}`, scene_id: HOSPITAL }),
);
reset({
  toads: [
    ...occupiedBeds,
    toad({ id: 50, name: "Больная 1", state: sickState() }),
    toad({ id: 51, name: "Больная 2", state: sickState() }),
  ],
  upgrades: { [HOSPITAL_SLOT]: { quarantineCatcher: true } },
});
const oneBed = catchNow();
check("забрана одна жаба", oneBed.caught, 1);
check("это первая по порядку", oneBed.toadIds.join(","), "50");
check("первая на койке", findToad(50).scene_id, HOSPITAL);
check("вторая ждёт следующего тика", findToad(51).scene_id, 1);

console.log("\n[4] Выключенный и непокупленный уловитель не работает");
console.log("─".repeat(60));
reset({
  toads: [toad({ id: 60, name: "Больная", state: sickState() })],
  upgrades: {
    [HOSPITAL_SLOT]: {
      quarantineCatcher: true,
      quarantineCatcherEnabled: false,
    },
  },
});
const switchedOff = catchNow();
check("выключенный никого не забрал", switchedOff.caught, 0);
check("жаба осталась дома", findToad(60).scene_id, 1);

reset({
  toads: [toad({ id: 60, name: "Больная", state: sickState() })],
  upgrades: { [HOSPITAL_SLOT]: { autoFeeder: true } },
});
const notBought = catchNow();
check("без покупки никого не забрал", notBought.caught, 0);
check("жаба осталась дома", findToad(60).scene_id, 1);

reset({
  toads: [toad({ id: 60, name: "Больная", state: sickState() })],
  upgrades: { [HOSPITAL_SLOT]: { quarantineCatcher: true } },
});
const oldSave = catchNow();
check("старый сейв: уловитель работает", oldSave.caught, 1);
check("жаба на койке", findToad(60).scene_id, HOSPITAL);

console.log("\n[5] Игровой цикл и покупка вызывают уловитель");
console.log("─".repeat(60));
const mainSource = readFileSync(
  join(root, "src/components/MainScreen/index.tsx"),
  "utf8",
);
const roomDataSource = readFileSync(
  join(root, "src/components/modals/RoomDataTab.tsx"),
  "utf8",
);
checkText(
  "MainScreen запускает уловитель в тике Медотсека",
  mainSource,
  /processQuarantineCatchers\(/,
);
checkText(
  "RoomDataTab применяет уловитель сразу",
  roomDataSource,
  /processQuarantineCatchers\(/,
);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}

console.log("✅ Все проверки карантин-уловителя прошли");
