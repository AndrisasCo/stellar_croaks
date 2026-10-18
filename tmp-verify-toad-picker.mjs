/**
 * Проверка общего списка жаб и слотов репродуктора — «первый слот самке, второй самцу»
 * (на РЕАЛЬНОМ коде).
 *
 * Скрипт бандлит модули через esbuild и гоняет те же функции, что работают в игре:
 *   1) пол слотов (`NEST_SLOT_SEXES`): слот 0 — самка, слот 1 — самец, третьего слота нет,
 *      а слотов ровно столько, сколько мест в репродукторе (`NEST_ROOM_TOAD_SLOTS`);
 *   2) список жаб слота самки (`getNestSlotCandidates(0)`): только взрослые самки —
 *      не беременные, не в походе, не выбитые, не больные и не из другого репродуктора;
 *   3) список жаб слота самца (`getNestSlotCandidates(1)`) — то же правило для самцов;
 *   4) порядок списка: сначала самые редкие (пару собирают из лучших жаб колонии);
 *   5) причины отказа (`getNestSlotRejectReason`): у каждой отсеянной жабы своя причина —
 *      её видит игрок, когда жабы нет в списке;
 *   6) пол слотов и логика пары сходятся: жабы из списка дают пару, на которой кнопка
 *      «Начать ухаживание» активна;
 *   7) больная и выбитая жаба пару не образуют — кнопка объясняет причину;
 *   8) общий список жаб (`utils/toad-picker.ts`) — тот, что рисует выпадающий список
 *      `shared/ToadPicker` во всех местах, где жабу сажают в слот: краткая информация
 *      (пол, стадия, силы ⚡, сытость 🍽), редкость строкой и раскладка на «можно взять»
 *      и «не подходят» с причинами — одна на репродуктор, энергосектор и роли похода.
 *
 * Запуск: node tmp-verify-toad-picker.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-nest-slots-"));
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

/** Жаба с нужными полями (гены — как у обычной жабы) */
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

/** Жаба в походе: поход с ней в команде (по нему `isToadOnExpedition`) */
const ON_EXPEDITION = {
  id: "exp-1",
  sectorId: 1,
  team: [{ toadId: 14, role: "scout" }],
  startedAt: Date.now(),
  phase: "outbound",
  progress: 0,
  resolvedSteps: 0,
  loot: { biomass: 0, tokens: 0, astro_quax: 0, items: {}, samples: 0 },
  log: [],
};

/**
 * Колония для проверки списка жаб. Половина жаб нарочно «не годится» — у каждой своя
 * причина: по ним и видно, что фильтр слота отсеивает всех, кого не пускают в репродуктор.
 */
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
  scenes: [{ id: 1, name: "Биопод #1", capacity: 20, created_at: "" }],
  // Построенный репродуктор: его жильцов список тоже не предлагает
  colony: { rooms: [{ id: "outpost-3", kind: "breeding", builtAt: "" }] },
  expeditions: [ON_EXPEDITION],
  toads: [
    toad({ id: 1, name: "Муж", sex: "male", genes: { rarity: 5 } }),
    toad({ id: 2, name: "Жена", sex: "female", genes: { rarity: 6 } }),
    toad({
      id: 3,
      name: "Беременная",
      sex: "female",
      genes: { rarity: 7 },
      pregnancy: {
        isPregnant: true,
        pregnancyStart: Date.now(),
        pregnancyDuration: 3600000,
        fatherId: 1,
        father: null,
        offspringCount: 2,
      },
    }),
    toad({
      id: 4,
      name: "Больная самка",
      sex: "female",
      genes: { rarity: 7.5 },
      state: { hunger: 100, diseaseId: 0, diseaseUntil: Date.now() + 3600000 },
    }),
    toad({ id: 5, name: "Выбитая самка", sex: "female", hp: 0 }),
    toad({ id: 6, name: "Самка в походе", sex: "female", status: "out" }),
    toad({
      id: 7,
      name: "Больной самец",
      sex: "male",
      genes: { rarity: 7.5 },
      state: { hunger: 100, diseaseId: 0, diseaseUntil: Date.now() + 3600000 },
    }),
    toad({ id: 8, name: "Самец в походе", sex: "male", status: "out" }),
    toad({
      id: 9,
      name: "Самец в репродукторе",
      sex: "male",
      scene_id: "outpost-3",
    }),
    toad({ id: 10, name: "Головастик", sex: "female", stage: "toadpole" }),
    toad({ id: 11, name: "Нейтрал", sex: "neuter" }),
    toad({ id: 12, name: "Редкая самка", sex: "female", genes: { rarity: 9.5 } }),
    toad({ id: 13, name: "Редкий самец", sex: "male", genes: { rarity: 8.5 } }),
    // Жаба без статуса «в походе», но с походом в команде: её скрывает `isToadOnExpedition`
    toad({ id: 14, name: "Самка из команды", sex: "female", genes: { rarity: 9 } }),
  ],
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

/** Платформенный слой читает localStorage через `window.localStorage` — в браузере это один объект */
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

/** Прямая правка жабы в состоянии — так же правят механики игры */
const patchToad = (id, patch) => {
  const state = gameState();
  state.toads = state.toads.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );
  raw = JSON.stringify(state);
};

const breeding = bundle("src/utils/breeding-manager.ts", "breeding-manager");
const cfg = bundle("src/utils/gamification-config.ts", "gamification-config");
const constants = bundle("src/utils/constants.ts", "constants");

const NEST = constants.NEST_ROOM_ID;
const OTHER_NEST = "outpost-3";

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const checkText = (label, value, pattern) => {
  const ok = typeof value === "string" && pattern.test(value);
  if (!ok) {
    failures.push(`${label}: получили «${value}», ждали ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${value}`);
};

/** Список id жаб — так сравниваем состав списка целиком, включая порядок */
const ids = (toads) => toads.map((item) => item.id).join(", ");
const checkIds = (label, toads, expected) =>
  check(label, ids(toads), expected);

const notes = [];
const collect = (notification) => notes.push(notification);


console.log("\n[1] Слоты пары: первый — самка, второй — самец");
console.log("─".repeat(60));
reset();
check(
  "слотов ровно столько, сколько мест в репродукторе",
  breeding.NEST_SLOT_SEXES.length,
  cfg.NEST_ROOM_TOAD_SLOTS,
);
check("слот 0 — самка", breeding.getNestSlotSex(0), "female");
check("слот 1 — самец", breeding.getNestSlotSex(1), "male");
check("третьего слота нет", breeding.getNestSlotSex(2), null);
checkText("имя первого слота", breeding.getNestSlotLabel(0), /^Слот самки$/);
checkText("имя второго слота", breeding.getNestSlotLabel(1), /^Слот самца$/);
checkText("имя слота вне пары", breeding.getNestSlotLabel(9), /Слот репродуктора/);
check("иконка самки есть в подписях", Boolean(constants.TYPE_ICONS.female), true);
check("иконка самца есть в подписях", Boolean(constants.TYPE_ICONS.male), true);

console.log("\n[2] Список для слота самки: взрослые самки без беременности");
console.log("─".repeat(60));
reset();
const femaleCandidates = breeding.getNestSlotCandidates(0);
checkIds(
  "в списке только подходящие самки, сверху редкие",
  femaleCandidates,
  "12, 2",
);
check(
  "все кандидаты — взрослые самки",
  femaleCandidates.every(
    (item) => item.sex === "female" && item.stage === "adult",
  ),
  true,
);
check(
  "список отсортирован по редкости",
  femaleCandidates.every(
    (item, index) =>
      index === 0 ||
      femaleCandidates[index - 1].genes.rarity >= item.genes.rarity,
  ),
  true,
);
check(
  "беременной самки в списке нет",
  femaleCandidates.some((item) => item.id === 3),
  false,
);
check(
  "самца в списке самки нет",
  femaleCandidates.some((item) => item.id === 1),
  false,
);
check(
  "нейтрала в списке нет",
  femaleCandidates.some((item) => item.id === 11),
  false,
);
check(
  "у отсеянных жаб причина отказа есть, у кандидатов — нет",
  gameState().toads.every(
    (item) =>
      (breeding.getNestSlotRejectReason(item, 0) === null) ===
      femaleCandidates.some((candidate) => candidate.id === item.id),
  ),
  true,
);

console.log("\n[3] Список для слота самца: взрослые самцы");
console.log("─".repeat(60));
reset();
const maleCandidates = breeding.getNestSlotCandidates(1);
checkIds("в списке только подходящие самцы", maleCandidates, "13, 1");
check(
  "все кандидаты — взрослые самцы",
  maleCandidates.every(
    (item) => item.sex === "male" && item.stage === "adult",
  ),
  true,
);
check(
  "самки в списке самца нет",
  maleCandidates.some((item) => item.id === 2),
  false,
);
check(
  "самец из другого репродуктора не предложен",
  maleCandidates.some((item) => item.id === 9),
  false,
);


console.log("\n[4] Почему жабу не позвали в слот");
console.log("─".repeat(60));
reset();
const reason = (id, slot) => breeding.getNestSlotRejectReason(findToad(id), slot);
checkText("самка в слоте самца", reason(2, 1), /Второй слот/);
checkText("самец в слоте самки", reason(1, 0), /Первый слот/);
checkText("головастик", reason(10, 0), /только взрослых/);
checkText("самка со статусом «в походе»", reason(6, 0), /в походе/);
checkText("самка из команды похода", reason(14, 0), /в походе/);
checkText("выбитая самка", reason(5, 0), /Выбитая/);
checkText("больная самка", reason(4, 0), /Больная/);
checkText("больной самец", reason(7, 1), /Больная/);
checkText("беременная самка", reason(3, 0), /вынашивает/);
checkText(
  "самец из другого репродуктора",
  reason(9, 1),
  /уже сидит в репродукторе/,
);
checkText("нейтрал в слот самки", reason(11, 0), /Первый слот/);
checkText("нейтрал в слот самца", reason(11, 1), /Второй слот/);
checkText("слота с таким номером нет", reason(1, 2), /всего два слота/);
check("подходящая самка отказа не получает", reason(2, 0), null);
check("подходящий самец отказа не получает", reason(1, 1), null);

console.log("\n[5] Жаба из репродуктора не предлагается повторно");
console.log("─".repeat(60));
reset();
patchToad(2, { scene_id: NEST });
checkIds(
  "самка уже в репродукторе — в списке её нет",
  breeding.getNestSlotCandidates(0),
  "12",
);
checkText("причина повторного приглашения", reason(2, 0), /уже сидит/);
patchToad(2, { scene_id: OTHER_NEST });
checkIds(
  "самка в другом репродукторе — в списке её нет",
  breeding.getNestSlotCandidates(0),
  "12",
);

console.log("\n[6] Пара из списка: кнопка «Начать ухаживание» готова");
console.log("─".repeat(60));
reset();
notes.length = 0;
patchToad(2, { scene_id: NEST });
patchToad(1, { scene_id: NEST });
const ready = breeding.checkNestCourtship(NEST);
check("пара из списка даёт готовую кнопку", ready.ready, true);
check("в паре самец из списка слота самца", ready.pair?.male.id, 1);
check("в паре самка из списка слота самки", ready.pair?.female.id, 2);
const started = breeding.startNestCourtship(NEST, collect);
check("ухаживание началось", started.started, true);
check("самка ухаживает", Boolean(findToad(2).mating), true);
check("самец ухаживает", Boolean(findToad(1).mating), true);

console.log("\n[7] Больная и выбитая жаба пару не образуют");
console.log("─".repeat(60));
reset();
patchToad(4, { scene_id: NEST });
patchToad(1, { scene_id: NEST });
const sickCheck = breeding.checkNestCourtship(NEST);
check("кнопка не готова: самка больна", sickCheck.ready, false);
checkText("причина — болезнь", sickCheck.message, /Больная/);
check("больную в пару не берут", sickCheck.pair, null);
check(
  "ухаживание с больной не началось",
  breeding.startNestCourtship(NEST, collect).started,
  false,
);

reset();
patchToad(5, { scene_id: NEST });
patchToad(1, { scene_id: NEST });
const downCheck = breeding.checkNestCourtship(NEST);
check("кнопка не готова: самка выбита", downCheck.ready, false);
checkText("причина — выбита", downCheck.message, /Выбитая/);

console.log("\n[8] Общий список жаб: краткая информация и группы «можно взять / не подходят»");
console.log("─".repeat(60));
const list = bundle("src/utils/toad-picker.ts", "toad-picker");

reset();
const rareFemale = findToad(12); // «Редкая самка»: редкость 9.5, сил 100, сытость 100
const sickMale = findToad(7); // «Больной самец»: причина отказа — болезнь

check("значок пола самки", list.getToadSexIcon("female"), "♀");
check("значок пола самца", list.getToadSexIcon("male"), "♂");
check("значок нейтрала и неизвестного пола", list.getToadSexIcon("neuter"), "○");
check("пол словом", list.getToadSexLabel(rareFemale.sex), "самка");
check("стадия взрослой самки", list.getToadStageLabel("adult", "female"), "взрослая");
check("стадия взрослого самца", list.getToadStageLabel("adult", "male"), "взрослый");
check("головастик словом", list.getToadStageLabel("toadpole", "female"), "головастик");
check("редкость строкой", list.getToadRarityLine(rareFemale), "Необычная · 9.5");
check(
  "краткая информация: пол, стадия, силы, сытость",
  list.getToadPickerBrief(rareFemale),
  "самка · взрослая · ⚡100 · 🍽100%",
);
checkText("в краткой информации есть силы", list.getToadPickerBrief(sickMale), /⚡\d+/);
checkText("в краткой информации есть сытость", list.getToadPickerBrief(sickMale), /🍽\d+%/);

/** Те же строки, что строит модалка слота: жаба, её место в списке и причина отказа */
const mapped = list.splitToadPickerCandidates(
  gameState().toads.map((item) => ({
    toad: item,
    rank: item.genes.rarity,
    reason: breeding.getNestSlotRejectReason(item, 0),
  })),
);

checkIds(
  "можно взять — совпадает со списком менеджера (по редкости сверху)",
  mapped.available.map((item) => item.toad),
  ids(breeding.getNestSlotCandidates(0)),
);
check(
  "можно взять + не подходят = все жабы колонии",
  mapped.available.length + mapped.rejected.length,
  gameState().toads.length,
);
check(
  "у каждой отсеянной жабы есть причина",
  mapped.rejected.every((item) => Boolean(item.reason)),
  true,
);
check(
  "отсеянные — по редкости сверху",
  mapped.rejected
    .map((item) => item.rank)
    .every((rank, index, ranks) => index === 0 || ranks[index - 1] >= rank),
  true,
);
checkText(
  "нейтралу список объясняет пол слота",
  mapped.rejected.find((item) => item.toad.id === 11)?.reason,
  /самка/,
);
checkText(
  "больной жабе список называет болезнь",
  list.splitToadPickerCandidates(
    gameState().toads.map((item) => ({
      toad: item,
      rank: item.genes.rarity,
      reason: breeding.getNestSlotRejectReason(item, 0),
    })),
  ).rejected.find((item) => item.toad.id === 4)?.reason,
  /вылечите/,
);
checkText(
  "выбитой жабе список называет причину",
  mapped.rejected.find((item) => item.toad.id === 5)?.reason,
  /подлечите/,
);

console.log("\n" + "═".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   · ${item}`));
  process.exitCode = 1;
} else {
  console.log("✅ Все проверки списка жаб и слотов репродуктора прошли");
}

