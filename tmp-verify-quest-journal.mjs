/**
 * Проверка журнала заданий на РЕАЛЬНОМ коде проекта.
 *
 * Скрипт бандлит движок и каталог через esbuild и проверяет:
 *   1) каталог: 37 заданий (16 быстрых, 17 средних, 4 долгих), все цепочки
 *      ссылаются на существующие задания, у каждого есть награда;
 *   2) старт: видны только задания с триггером `always` — два быстрых и
 *      первый сектор магистрали;
 *   3) цепочка: постройка Торговой капсулы закрывает q01 и в том же проходе
 *      открывает q02 (без «перезагрузки» журнала);
 *   4) ручная награда: до выполнения забрать нельзя, после — начисляется один
 *      раз, повторный клик не задваивает ресурсы;
 *   5) события: покупка корма, кормление, лутбокс, болезнь и лечение двигают
 *      нужные задания; «забрать всё» очищает очередь наград;
 *   6) сохранение: журнал лежит отдельным ключом, статусы не теряются после
 *      повторного чтения, а прогресс по комнатам считается из `GameState`;
 *   7) генетика ×2 и пять ролей экспедиционного резерва.
 *
 * Запуск: node tmp-verify-quest-journal.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-quest-journal-"));
const root = process.cwd();

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

// Заглушки браузера: игра и журнал пишут в localStorage и шлют события.
globalThis.CustomEvent ||= class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const store = new Map();
const events = [];
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent: (event) => {
    events.push(event);
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  Telegram: { WebApp: { initDataUnsafe: {} } },
  innerHeight: 800,
  matchMedia: () => ({ matches: true }),
};

// === Модули проекта ===
const gameStorage = bundle("src/backend/localStorage.ts", "local-storage");
const quests = bundle("src/backend/quests-manager/index.ts", "quests");
const journalStorage = bundle(
  "src/backend/quests-manager/storage.ts",
  "quests-storage",
);
const catalog = bundle("src/backend/quests-manager/quests-list.ts", "quests-list");
const expedition = bundle("src/utils/expedition-config.ts", "expedition-config");
const genetics = bundle("src/utils/calculate-genetics.ts", "calculate-genetics");

const GAME_KEY = "Game_State6";
const JOURNAL_KEY = "quest_journal";

const readState = () => gameStorage.getGameState();
const setState = (updater) =>
  gameStorage.updateGameState(updater(readState()));
const snapshot = () => quests.getQuestJournalSnapshot();
const entry = (id) => snapshot().entries.find((item) => item.quest.id === id);
const journal = () =>
  JSON.parse(store.get(JOURNAL_KEY) ?? "null") ?? {
    activated: [],
    completed: [],
    claimed: [],
    counters: {},
  };

console.log("── 1. Каталог заданий ───────────────────────────────────────");
check("всего заданий", catalog.QUESTS.length, 37);
check("быстрых", catalog.QUESTS.filter((q) => q.type === "quick").length, 16);
check("средних", catalog.QUESTS.filter((q) => q.type === "medium").length, 17);
check("долгих", catalog.QUESTS.filter((q) => q.type === "long").length, 4);
check(
  "во всех шести сферах есть задания",
  new Set(catalog.QUESTS.map((q) => q.sphere)).size,
  6,
);

const ids = new Set(catalog.QUESTS.map((q) => q.id));
const chainParents = catalog.QUESTS.filter((q) => q.trigger.type === "chain");
checkTrue(
  "все родители цепочек существуют",
  chainParents.every((q) => ids.has(q.trigger.parentId)),
);
check(
  "все средние задания входят ровно в одну цепочку",
  catalog.QUEST_CHAINS.reduce((sum, chain) => sum + chain.taskIds.length, 0),
  17,
);
checkTrue(
  "у каждого задания есть хотя бы одна награда",
  catalog.QUESTS.every((q) => Object.keys(q.rewards).length > 0),
);

console.log("\n── 2. Чистый старт ──────────────────────────────────────────");
store.clear();
gameStorage.updateGameState(gameStorage.getDefaultGameState());

const start = snapshot();
check("журнал отдельный от сейва игры", store.has(JOURNAL_KEY), true);
check("стартовых заданий открыто", start.counts.active, 3);
check("заданий закрыто", start.counts.locked, 34);
check("q01 открыто", entry("q01-first-sector").status, "active");
check("q04 открыто", entry("q04-first-feed").status, "active");
check("магистраль l01 открыта", entry("l01-first-contour").status, "active");
check("q02 ждёт q01", entry("q02-food-stock").status, "locked");
check(
  "прогресс q01 считается из GameState",
  entry("q01-first-sector").progress,
  0,
);

console.log("\n── 3. Цепочка и первая награда ──────────────────────────────");
setState((state) => ({
  ...state,
  colony: {
    ...state.colony,
    rooms: [
      ...(state.colony?.rooms ?? []),
      {
        id: "shop_1",
        slotId: "slot-north",
        kind: "shop",
        builtAt: new Date().toISOString(),
      },
    ],
  },
}));

check("q01 выполнено постройкой", entry("q01-first-sector").status, "ready");
check("q02 открылось в том же проходе", entry("q02-food-stock").status, "active");
check("q01 прогресс 1/1", entry("q01-first-sector").progress, 1);

const beforeClaim = readState().user.tokens;
const claimed = quests.claimQuestReward("q01-first-sector");
checkTrue("награда q01 получена", claimed.success);
check("кваксы начислены", readState().user.tokens - beforeClaim, 20);
check("q01 ушло в архив", entry("q01-first-sector").status, "claimed");
const repeatClaim = quests.claimQuestReward("q01-first-sector");
check("повторная награда запрещена", repeatClaim.success, false);
check(
  "повторный клик не начислил кваксы",
  readState().user.tokens - beforeClaim,
  20,
);
check(
  "невыполненное задание забрать нельзя",
  quests.claimQuestReward("q02-food-stock").success,
  false,
);
check("неизвестное задание", quests.claimQuestReward("nope").success, false);

console.log("\n── 4. События: корм, кормление, лутбокс, медицина ───────────");
quests.recordQuestEvent("food_bought", 10);
check("q02 закрыто покупкой 10 корма", entry("q02-food-stock").status, "ready");
check("q03 открыто после q02", entry("q03-feed-colony").status, "active");
check("счётчик покупок", snapshot().metrics.foodBought, 10);

quests.recordQuestEvent("toad_fed", 3);
check("q04 закрыто кормлением", entry("q04-first-feed").status, "ready");
check("q03 закрыто тремя жабами", entry("q03-feed-colony").status, "ready");
check("q05 открыто после q03", entry("q05-roof").status, "active");
check("q06 открыто после q03", entry("q06-first-deal").status, "active");
check("q09 открыто после q03", entry("q09-enter-contour").status, "active");

const readyBeforeAll = snapshot().ready.length;
check("наград в очереди", readyBeforeAll, 3);
const allResults = quests.claimAllQuestRewards();
check("забраны все готовые", allResults.filter((r) => r.success).length, 4);
// Награды q02–q04 доводят казну до 150+: второй проход забирает и q06.
check("награды двигают денежный квест", entry("q06-first-deal").status, "claimed");
check("очередь наград пуста", snapshot().ready.length, 0);

quests.recordQuestEvent("lootbox_opened", 1);
check("q07 закрыто лутбоксом", entry("q07-open-lootbox").status, "ready");
check("q14 открыто после q07", entry("q14-first-collection").status, "active");
check("q16 открыто после q07", entry("q16-gene-dust").status, "active");

quests.recordQuestEvent("disease_outbreak", 1);
check("q08 открыто вспышкой", entry("q08-sanitary-day").status, "active");
check("q08 ещё не выполнено", entry("q08-sanitary-day").progress, 0);
quests.recordQuestEvent("toad_cured", 1);
check("q08 закрыто лечением", entry("q08-sanitary-day").status, "ready");
check("q15 открыто после q08", entry("q15-hospital").status, "active");
check("счётчик лечений", snapshot().metrics.curedToads, 1);


console.log("\n── 5. Сохранение и устойчивость ────────────────────────────");
const journalState = journal();
check("версия журнала", journalState.version, 1);
checkTrue("q01 в архиве", journalState.claimed.includes("q01-first-sector"));
checkTrue("q02 в выполненных", journalState.completed.includes("q02-food-stock"));
checkTrue(
  "счётчики событий сохраняются",
  journalState.counters.toad_fed >= 3 &&
    journalState.counters.food_bought >= 10 &&
    journalState.counters.lootbox_opened >= 1 &&
    journalState.counters.toad_cured >= 1,
);

const reopened = snapshot();
check(
  "после повторного чтения q01 остаётся в архиве",
  reopened.entries.find((item) => item.quest.id === "q01-first-sector").status,
  "claimed",
);
check("забрано наград", reopened.counts.claimed, 5);
check("ждут награды", reopened.counts.ready, 2);
check(
  "всего закрыто (ready + claimed)",
  reopened.counts.ready + reopened.counts.claimed,
  7,
);
check("покупка корма не влияет на сейв игры", readState().user.storage.food, 0);
check("ключ игры не перезаписан журналом", store.has(GAME_KEY), true);
checkTrue(
  "событие обновления журнала рассылалось",
  events.some((event) => event.type === quests.QUEST_JOURNAL_UPDATED_EVENT),
);
checkTrue(
  "событие игры тоже было",
  events.some((event) => event.type === "gameStateUpdated"),
);

console.log("\n── 6. Селекция, коллайдер и экспедиционный резерв ──────────");
const withRandom = (value, fn) => {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
};
const round3 = (value) => Math.round(value * 1000) / 1000;

check(
  "качество в коллайдере растёт ×2",
  withRandom(0.5, () => genetics.calculateRarity([1, 2], false)),
  3.5,
);
check(
  "качество в селекции растёт ×2",
  withRandom(0.4, () => genetics.calculateBreedingRarity([1, 2])),
  1.9,
);
check(
  "положительный прирост признака ×2",
  round3(withRandom(0.75, () => genetics.inheritTrait([1, 2], 1))),
  1.65,
);
check(
  "штраф признака не усиливается",
  round3(withRandom(0.25, () => genetics.inheritTrait([1, 2], 1))),
  1.425,
);

const geneticParent = (id) => ({
  id,
  name: `Родитель-${id}`,
  type: "hybrid",
  stage: "adult",
  generation: 1,
  sex: id === 1 ? "male" : "female",
  parents: null,
  scene_id: 1,
  homeId: 1,
  created_at: new Date().toISOString(),
  state: { hunger: 50, genetic_fault: 0 },
  pregnancy: null,
  genes: {
    hungerRate: 1,
    fertility: 1,
    speed: 1,
    weight: 10,
    rarity: 1,
    colors: ["#5D8C59", "#6B8C42"],
    pattern: "smooth",
    personality: null,
  },
});
const geneticParents = [geneticParent(1), geneticParent(2)];

check(
  "коллайдер передаёт удвоенное качество",
  withRandom(0.5, () =>
    genetics.generateChildToad(geneticParents, true).genes.rarity,
  ),
  3,
);
check(
  "репродуктор передаёт удвоенное качество",
  withRandom(0.5, () =>
    genetics.generateChildToad(geneticParents, false).genes.rarity,
  ),
  1.4,
);

const reserveGenes = {
  hungerRate: 1,
  fertility: 1,
  speed: 1,
  weight: 10,
  rarity: 0,
  colors: ["#5D8C59", "#6B8C42"],
  pattern: "smooth",
  personality: null,
};
const reserveToad = (id, genes, overrides = {}) => ({
  id,
  name: `Резерв-${id}`,
  type: "hybrid",
  stage: "adult",
  generation: 2,
  sex: "female",
  parents: [0, 1],
  scene_id: 1,
  homeId: 1,
  created_at: new Date().toISOString(),
  state: { hunger: 50, genetic_fault: 0 },
  pregnancy: null,
  genes: { ...reserveGenes, ...genes },
  ...overrides,
});
const operatorToad = reserveToad(9001, { rarity: 10 });
const scoutToad = reserveToad(9002, { speed: 2 });
const tankToad = reserveToad(9003, { weight: 30 });
const medicToad = reserveToad(9004, { fertility: 2 });
const cookToad = reserveToad(9005, { hungerRate: 2 });
const allRoundToad = reserveToad(9006, {
  rarity: 10,
  speed: 2,
  weight: 30,
  fertility: 2,
  hungerRate: 2,
});
const wildScout = reserveToad(9007, { speed: 2 }, { parents: null });
const reserveRoles = (toad) => expedition.getExpeditionReserveRoles(toad);

check(
  "оператор закрывает роль качества",
  reserveRoles(operatorToad).join(","),
  "hacker",
);
check("скаут закрывает роль скорости", reserveRoles(scoutToad).join(","), "scout");
check("щитоносец закрывает роль размера", reserveRoles(tankToad).join(","), "tank");
check(
  "ремонтник закрывает роль плодовитости",
  reserveRoles(medicToad).join(","),
  "medic",
);
check(
  "повар закрывает роль аппетита",
  reserveRoles(cookToad).join(","),
  "negotiator",
);
check("универсал подходит на пять ролей", reserveRoles(allRoundToad).length, 5);
check(
  "универсал закрывает все пять ролей",
  expedition.countExpeditionReserveRoles([allRoundToad]),
  5,
);
const doubleRoleToad = reserveToad(9008, { rarity: 10, speed: 2 });
check(
  "одна жаба закрывает две роли",
  expedition.countExpeditionReserveRoles([doubleRoleToad]),
  2,
);
check(
  "дикая жаба не попадает в резерв",
  expedition.isExpeditionReserveToad(wildScout),
  false,
);
check(
  "головастик не попадает в резерв",
  expedition.isExpeditionReserveToad({ ...scoutToad, stage: "toadpole" }),
  false,
);

const beforeReserveJournal = journal();
store.set(
  JOURNAL_KEY,
  JSON.stringify({
    ...beforeReserveJournal,
    activated: [
      ...new Set([
        ...beforeReserveJournal.activated,
        "m08-bloodline",
        "m09-genetic-diversity",
      ]),
    ],
    completed: [
      ...new Set([
        ...beforeReserveJournal.completed,
        "m08-bloodline",
        "m09-genetic-diversity",
      ]),
    ],
  }),
);
check(
  "m13a открылось после m09",
  entry("m13a-operator").status,
  "active",
);
check(
  "m13b открылось одновременно с m13a",
  entry("m13b-scout").status,
  "active",
);
check(
  "m13c открылось одновременно с m13a",
  entry("m13c-tank").status,
  "active",
);
check(
  "m13d открылось одновременно с m13a",
  entry("m13d-medic").status,
  "active",
);
check(
  "m13e открылось одновременно с m13a",
  entry("m13e-negotiator").status,
  "active",
);

setState((state) => ({
  ...state,
  toads: [
    ...state.toads,
    operatorToad,
    scoutToad,
    tankToad,
    medicToad,
    wildScout,
  ],
}));
check(
  "четыре роли без повара: прогресс 4",
  snapshot().metrics.expeditionReserveRoles,
  4,
);
check(
  "оператор закрыт отдельной метрикой",
  snapshot().metrics.reserveRoleHacker,
  1,
);
check(
  "скаут закрыт отдельной метрикой",
  snapshot().metrics.reserveRoleScout,
  1,
);
check(
  "щитоносец закрыт отдельной метрикой",
  snapshot().metrics.reserveRoleTank,
  1,
);
check(
  "ремонтник закрыт отдельной метрикой",
  snapshot().metrics.reserveRoleMedic,
  1,
);
check(
  "снабженец пока не закрыт",
  snapshot().metrics.reserveRoleNegotiator,
  0,
);
check("m13a готово к награде", entry("m13a-operator").status, "ready");
check("m13b готово к награде", entry("m13b-scout").status, "ready");
check("m13c готово к награде", entry("m13c-tank").status, "ready");
check("m13d готово к награде", entry("m13d-medic").status, "ready");
check("m13e ждёт снабженца", entry("m13e-negotiator").status, "active");

setState((state) => ({ ...state, toads: [...state.toads, cookToad] }));
check("пять ролей резерва закрыты", snapshot().metrics.expeditionReserveRoles, 5);
check("снабженец закрыт", snapshot().metrics.reserveRoleNegotiator, 1);
check("m13e готово к награде", entry("m13e-negotiator").status, "ready");

const universalJournal = journal();
store.set(
  JOURNAL_KEY,
  JSON.stringify({
    ...universalJournal,
    activated: [
      ...new Set([
        ...universalJournal.activated,
        "m08-bloodline",
        "m09-genetic-diversity",
      ]),
    ].filter((id) => !id.startsWith("m13")),
    completed: [
      ...new Set([
        ...universalJournal.completed,
        "m08-bloodline",
        "m09-genetic-diversity",
      ]),
    ].filter((id) => !id.startsWith("m13")),
  }),
);
setState((state) => ({ ...state, toads: [allRoundToad] }));
check("один универсал закрывает пять ролей", snapshot().metrics.expeditionReserveRoles, 5);
checkTrue(
  "универсал закрывает все пять подзадач",
  [
    "m13a-operator",
    "m13b-scout",
    "m13c-tank",
    "m13d-medic",
    "m13e-negotiator",
  ].every((id) => entry(id).status === "ready"),
);

console.log(
  "\n── 7. Синхронизация журнала между устройствами ─────────────",
);

// Устройство A: награда уже забрана, журнал уходит в облако (game_state.quests).
const cloudJournal = JSON.parse(store.get(JOURNAL_KEY));
checkTrue(
  "устройство A: q01 в облачном архиве",
  cloudJournal.claimed.includes("q01-first-sector"),
);

// Устройство B: тот же аккаунт, но локального журнала ещё нет.
store.delete(JOURNAL_KEY);
check("устройство B: журнал начат с нуля", journal().claimed.length, 0);
check(
  "устройство B: q01 снова готово до синка",
  entry("q01-first-sector").status,
  "ready",
);

// Синк на старте: журнал из облака применяется до первого клика игрока.
journalStorage.mergeCloudQuestJournal(cloudJournal);
check(
  "устройство B: q01 вернулось в архив",
  entry("q01-first-sector").status,
  "claimed",
);
const tokensBeforeCloudClaim = readState().user.tokens;
const cloudClaim = quests.claimQuestReward("q01-first-sector");
check("устройство B: повторная награда запрещена", cloudClaim.success, false);
check(
  "устройство B: кваксы не начислены повторно",
  readState().user.tokens,
  tokensBeforeCloudClaim,
);

// Слияние не зависит от того, чей сейв новее: claimed объединяется.
const localJournal = journalStorage.getQuestJournalState();
const mergedJournal = journalStorage.mergeQuestJournalStates(localJournal, {
  ...cloudJournal,
  completed: [...cloudJournal.completed, "q02-food-stock"],
  claimed: [...cloudJournal.claimed, "q02-food-stock"],
  counters: { ...cloudJournal.counters, food_bought: 999 },
});
checkTrue(
  "слияние сохраняет оба архива",
  ["q01-first-sector", "q02-food-stock"].every((id) =>
    mergedJournal.claimed.includes(id),
  ),
);
check("счётчик берёт максимум", mergedJournal.counters.food_bought, 999);
checkTrue(
  "claimed без completed не проходит",
  !journalStorage
    .mergeQuestJournalStates(localJournal, { claimed: ["no-such-quest"] })
    .claimed.includes("no-such-quest"),
);
check(
  "битый облачный журнал не ломает слияние",
  journalStorage.mergeQuestJournalStates(localJournal, "broken").claimed.length,
  localJournal.claimed.length,
);

// Выход из аккаунта убирает журнал с устройства (в облаке он остаётся).
journalStorage.clearQuestJournalState();
check(
  "выход из аккаунта чистит журнал",
  journalStorage.getQuestJournalState().claimed.length,
  0,
);

console.log("\n────────────────────────────────────────────────────────────");
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.error(`   • ${item}`));
  process.exit(1);
}
console.log("✅ Журнал заданий: все проверки прошли");

