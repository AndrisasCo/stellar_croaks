/**
 * Проверка лазарета на РЕАЛЬНОМ коде проекта (без запуска игры).
 *
 * Скрипт бандлит нужные модули через esbuild и прогоняет их как обычный JS, поэтому
 * проверяются те же формулы, что работают в игре, а не их копия:
 *   1) скорости: дома +1 HP в час (очень медленно), на койке лазарета +24, болезнь
 *      в лазарете идёт втрое быстрее;
 *   2) живой тик HP: `processHpRegen` лечит дом по капле, а койку — на полный запас;
 *   3) болезни: срок в лазарете сгорает быстрее, пациент изолирован (никого не заражает),
 *      а больная в вольере соседа заражает;
 *   4) мгновенный курс от болезни за Кваксы: цена из таблицы болезней, без денег не продаётся;
 *   5) правила переноса: лазарет берёт до 6 жаб, принимает выбитых, требует ток;
 *   6) списки лазарета: кто на койках, кому нужна помощь, сколько мест свободно;
 *   7) цены: мгновенное лечение дорогое (2 🔷 за HP, минимум 8), болезнь тем дороже, чем злее.
 *
 * Запуск: node tmp-verify-hospital.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-hospital-"));
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

const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.now();

/** Жаба с нужными полями: HP задаём явно, гены без бонусов (maxHp = 100) */
const toad = (over = {}) => ({
  id: 1,
  name: "жаба",
  stage: "adult",
  generation: 1,
  sex: "male",
  type: "hybrid",
  scene_id: 1,
  created_at: new Date().toISOString(),
  parents: null,
  roomId: null,
  energy: 100,
  hp: 100,
  maxHp: 100,
  status: "ok",
  state: { hunger: 100 },
  pregnancy: null,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 0,
    speed: 1,
    rarity: 0,
    hungerRate: 1,
    fertility: 1,
    personality: null,
  },
  ...over,
});

/** Состояние болезни: `hoursLeft` часов до выздоровления */
const sickState = (diseaseId, hoursLeft, extra = {}) => ({
  hunger: 100,
  diseaseId,
  diseaseUntil: NOW + hoursLeft * HOUR_MS,
  ...extra,
});

const HOSPITAL = { id: "hospital-1", kind: "hospital", builtAt: "" };

const stubState = (patch = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 50,
    astro_quax: 0,
    biomass: 500,
    storage: { food: 90 },
  },
  scenes: [{ id: 1, name: "Био Под", capacity: 20, created_at: "" }],
  toads: [],
  colony: { rooms: [] },
  expeditions: [],
  lastSaved: "",
  createdAt: "",
  ...patch,
});

let raw = JSON.stringify(stubState());
const gameState = () => JSON.parse(raw);
const setState = (next) => {
  raw = JSON.stringify(next);
};

globalThis.localStorage = {
  getItem: () => raw,
  setItem: (_key, value) => {
    raw = value;
  },
  removeItem: () => {
    raw = "";
  },
};

// === Модули проекта ===
const hospital = bundle("src/utils/hospital.ts", "hospital");
const cfg = bundle("src/utils/expedition-config.ts", "expedition-config");
const diseaseModel = bundle("src/models/disease.ts", "models-disease");
const manager = bundle("src/utils/expedition-manager.ts", "expedition-manager");
const diseases = bundle("src/utils/disease-manager.ts", "disease-manager");
const moveRules = bundle(
  "src/components/HexMap/toad-move-rules.ts",
  "toad-move-rules",
);
const build = bundle("src/components/HexMap/colony-build.ts", "colony-build");

console.log("\n[1] Скорости: дом, койка и срок болезни");
console.log("─".repeat(60));
check("дома +1 HP в час (без лазарета очень медленно)", cfg.HP_REGEN_PER_HOUR, 1);
check("на койке лазарета +24 HP в час", hospital.HOSPITAL_HP_REGEN_PER_HOUR, 24);
check("коек в одном лазарете", hospital.HOSPITAL_ROOM_TOAD_SLOTS, 6);
check("болезнь в лазарете идёт втрое быстрее", hospital.HOSPITAL_DISEASE_SPEED, 3);

const onBed = toad({ id: 1, hp: 30, roomId: "hospital-1" });
const atHome = toad({ id: 2, hp: 30 });

check(
  "жаба на койке лечится по лазаретной скорости",
  hospital.getHpRegenPerHour(onBed, ["hospital-1"]),
  24,
);
check(
  "жаба дома лечится по базовой скорости",
  hospital.getHpRegenPerHour(atHome, ["hospital-1"]),
  1,
);
checkTrue(
  "жаба в другой комнате пациентом лазарета не считается",
  !hospital.isToadInHospital(toad({ id: 3, roomId: "slot-south" }), ["hospital-1"]),
);
check("70 потерянных HP дома — 70 ч", hospital.getHoursToFullHp(70, false), 70);
check("те же 70 HP на койке — 2.9 ч", hospital.getHoursToFullHp(70, true), 2.9);
check("лазарет списывает 4 ч болезни за 2 ч тика", hospital.getHospitalDiseaseHours(2, true), 4);
check("дома болезнь идёт своим ходом", hospital.getHospitalDiseaseHours(2, false), 0);

console.log("\n[2] Живой тик HP: processHpRegen");
console.log("─".repeat(60));
setState(
  stubState({
    toads: [
      toad({ id: 1, name: "дома", hp: 20 }),
      toad({ id: 2, name: "на койке", hp: 20, roomId: "hospital-1" }),
    ],
    colony: { rooms: [HOSPITAL] },
  }),
);
const touched = manager.processHpRegen(10);
const afterHp = gameState();

check("тик лечил двух жаб", touched, 2);
check("дома за 10 ч прибавилось 10 HP", afterHp.toads[0].hp, 30);
check("на койке за 10 ч жаба поднялась до максимума", afterHp.toads[1].hp, 100);

console.log("\n[3] Болезни: лазарет ускоряет срок, вольер заражает");
console.log("─".repeat(60));
setState(
  stubState({
    toads: [
      toad({ id: 1, name: "на койке", roomId: "hospital-1", state: sickState(0, 4) }),
      toad({ id: 2, name: "дома", state: sickState(0, 4) }),
    ],
    colony: { rooms: [HOSPITAL] },
  }),
);
const diseaseTick = diseases.processDiseases(2);
const afterDisease = gameState();

check("в лазарете 2 ч тика = 4 ч болезни: пациент выздоровел", diseaseTick.cured, 1);
checkTrue("пациент лазарета здоров", !diseases.isToadSick(afterDisease.toads[0]));
checkTrue("домашняя жаба всё ещё болеет", diseases.isToadSick(afterDisease.toads[1]));

// Заражение: контагиозность 0.08 в час × 100 ч = гарантированный контакт
setState(
  stubState({
    toads: [
      toad({ id: 1, name: "больная", state: sickState(1, 24) }),
      toad({ id: 2, name: "сосед" }),
    ],
  }),
);
const spread = diseases.processDiseases(100);
check("больная в вольере заразила соседа", spread.infected, 1);
checkTrue("сосед действительно болен", diseases.isToadSick(gameState().toads[1]));

setState(
  stubState({
    toads: [
      toad({ id: 1, name: "больная", roomId: "hospital-1", state: sickState(1, 24) }),
      toad({ id: 2, name: "сосед" }),
    ],
    colony: { rooms: [HOSPITAL] },
  }),
);
const isolation = diseases.processDiseases(100);
check("пациент лазарета никого не заразил (карантин)", isolation.infected, 0);
checkTrue("сосед остался здоров", !diseases.isToadSick(gameState().toads[1]));

console.log("\n[4] Мгновенный курс от болезни за Кваксы");
console.log("─".repeat(60));
setState(
  stubState({
    user: { ...stubState().user, tokens: 100 },
    toads: [
      toad({ id: 1, name: "больная", state: sickState(1, 8) }),
      toad({ id: 2, name: "здоровая" }),
    ],
  }),
);
check("цена курса у нанозаражения", diseaseModel.getDiseaseCureCost(gameState().toads[0]), 250);
check("у здоровой жабы курса нет", diseaseModel.getDiseaseCureCost(gameState().toads[1]), 0);

const noMoney = diseases.cureToadForTokens(1);
checkTrue("без нужной суммы курс не продаётся", !noMoney.success);
check("Кваксы при отказе не списались", gameState().user.tokens, 100);

setState(
  stubState({
    user: { ...stubState().user, tokens: 300 },
    toads: [toad({ id: 1, name: "больная", state: sickState(1, 8) })],
  }),
);
const cured = diseases.cureToadForTokens(1);
checkTrue("за Кваксы болезнь снимают сразу", cured.success);
check("списали ровно цену курса", gameState().user.tokens, 50);

checkTrue(
  "болезни у жабы больше нет",
  diseaseModel.getToadDisease(gameState().toads[0]) === null,
);

console.log("\n[5] Правила переноса: лазарет, 6 коек, ток, выбитые");
console.log("─".repeat(60));
// Лазарет на гексе рядом с ядром — ток ему даёт ядро
const nearRooms = build.resolveColonyRooms({
  rooms: [{ id: "slot-north", kind: "hospital", builtAt: "" }],
});
const hospitalRoom = nearRooms.find((room) => room.kind === "hospital");
const aviaryRoom = nearRooms.find((room) => room.kind === "aviary");
const nearGrid = build.getPowerGrid(nearRooms, {});
const atRoom = (over = {}) => ({
  roomToads: [],
  aviaryCount: 0,
  aviaryCapacity: 10,
  rooms: nearRooms,
  powerGrid: nearGrid,
  ...over,
});

checkTrue("лазарет рядом с ядром получает ток", build.isRoomPowered(hospitalRoom, nearGrid));
checkTrue(
  "раненую жабу кладут в лазарет",
  moveRules.canMoveToadToRoom(toad({ id: 1, hp: 40 }), hospitalRoom, atRoom()).ok,
);
checkTrue(
  "выбитую жабу в лазарет несут (правило «сначала подлечите» не мешает)",
  moveRules.canMoveToadToRoom(toad({ id: 2, hp: 0 }), hospitalRoom, atRoom()).ok,
);
check(
  "выбитую жабу в вольер не вернуть",
  moveRules.canMoveToadToRoom(toad({ id: 3, hp: 0 }), aviaryRoom, atRoom()).reason,
  "Жаба выбита из строя — сначала подлечите её.",
);

const sixBeds = Array.from({ length: 6 }, (_item, index) =>
  toad({ id: 100 + index, roomId: "slot-north" }),
);
checkTrue(
  "пять жаб на койках — место есть",
  moveRules.canMoveToadToRoom(
    toad({ id: 4, hp: 40 }),
    hospitalRoom,
    atRoom({ roomToads: sixBeds.slice(0, 5) }),
  ).ok,
);
check(
  "седьмого в лазарет не пускают",
  moveRules.canMoveToadToRoom(
    toad({ id: 5, hp: 40 }),
    hospitalRoom,
    atRoom({ roomToads: sixBeds }),
  ).reason,
  "В лазарете заняты все 6 коек.",
);

// Лазарет на дальнем гексе: соседей с током рядом нет
const farRooms = build.resolveColonyRooms({
  rooms: [{ id: "outpost-0", kind: "hospital", builtAt: "" }],
});
const farHospital = farRooms.find((room) => room.kind === "hospital");
const farGrid = build.getPowerGrid(farRooms, {});
checkTrue("лазарет на дальнем гексе обесточен", !build.isRoomPowered(farHospital, farGrid));
check(
  "в обесточенный лазарет не переносят",
  moveRules.canMoveToadToRoom(toad({ id: 6, hp: 40 }), farHospital, {
    ...atRoom({ rooms: farRooms, powerGrid: farGrid }),
  }).reason,
  "В комнате нет электричества",
);

// Выписка из лазарета: выбитого пациента тоже отпускают (кнопка «Выписать в вольер»)
checkTrue(
  "выбитого пациента из лазарета выписать можно",
  !moveRules.getToadMoveIssue(toad({ id: 7, hp: 0 }), { allowDown: true }),
);
check(
  "а вне лазарета выбитую жабу не тащат",
  moveRules.getToadMoveIssue(toad({ id: 8, hp: 0 })),
  "Жаба выбита из строя — сначала подлечите её.",
);
check(
  "жаба в походе не выписывается и не переносится",
  moveRules.getToadMoveIssue(toad({ id: 9, status: "out" }), { allowDown: true }),
  "Жаба в походе: сначала дождитесь её возвращения в вольер.",
);

console.log("\n[6] Списки лазарета для интерфейса");
console.log("─".repeat(60));
const roster = [
  toad({ id: 1, name: "здоровая дома" }),
  toad({ id: 2, name: "раненая дома", hp: 50 }),
  toad({ id: 3, name: "больная дома", state: sickState(0, 5) }),
  toad({ id: 4, name: "раненая на койке", hp: 50, roomId: "hospital-1" }),
  toad({ id: 5, name: "здоровая на койке", roomId: "hospital-1" }),
];

check("на койках лежат двое", hospital.getHospitalPatients(roster, ["hospital-1"]).length, 2);
check("помощь нужна троим", hospital.getToadsNeedingCare(roster).length, 3);
checkTrue(
  "болезнь без раны тоже отправляет в список помощи",
  hospital.needsHospitalCare(roster[2]) && !hospital.isToadWounded(roster[2]),
);
check("занятых коек в лазарете", hospital.getHospitalOccupancy("hospital-1", { "hospital-1": [roster[3]] }), 1);
check(
  "свободный лазарет даёт место",
  hospital.getHospitalsWithSpace(["hospital-1"], { "hospital-1": [roster[3]] }).join(","),
  "hospital-1",
);
check(
  "занятый лазарет мест не даёт",
  hospital.getHospitalsWithSpace(["hospital-1"], { "hospital-1": sixBeds }).length,
  0,
);
check(
  "id лазаретов берутся из колонии",
  hospital
    .getHospitalRoomIds({
      rooms: [
        { id: "a", kind: "hospital", builtAt: "" },
        { id: "b", kind: "shop", builtAt: "" },
        { id: "c", kind: "hospital", builtAt: "" },
      ],
    })
    .join(","),
  "a,c",
);

console.log("\n[7] Цены: мгновенное лечение и курсы болезней");
console.log("─".repeat(60));
const wounded60 = toad({ id: 1, hp: 40 });

check("мгновенное лечение: 60 HP → 120 🔷", cfg.getHealCost(wounded60), 120);
check("минимум за лечение: 8 🔷", cfg.getHealCost(toad({ id: 2, hp: 99 })), 8);
check("здоровой жабе лечение не нужно", cfg.getHealCost(toad({ id: 3 })), 0);
check("тариф мгновенного лечения", cfg.HEAL_TOKENS_PER_HP, 2);
check("минимальная цена лечения", cfg.HEAL_MIN_COST, 8);
checkTrue(
  "мгновенное лечение дороже ожидания на койке: 120 🔷 против 2.5 ч",
  cfg.getHealCost(wounded60) > hospital.getHoursToFullHp(60, true),
);
checkTrue(
  "болезни тем дороже, чем злее (нанозаражение > сбой прошивки)",
  diseaseModel.DISEASES[1].cureTokens > diseaseModel.DISEASES[0].cureTokens,
);
checkTrue(
  "у каждой болезни есть своя цена курса",
  diseaseModel.DISEASES.every((disease) => disease.cureTokens > 0),
);

console.log("\n" + "═".repeat(60));
if (failures.length === 0) {
  console.log("✅ ЛАЗАРЕТ: все проверки прошли");
} else {
  console.log(`❌ ЛАЗАРЕТ: провалено проверок — ${failures.length}`);
  failures.forEach((failure) => console.log(`   • ${failure}`));
  process.exitCode = 1;
}

