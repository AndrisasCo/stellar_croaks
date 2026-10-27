/**
 * Проверка привязки похода к контуру («Разведке»), из которого ушла команда.
 *
 * Раньше поход помнил только числовой `Scene.id`, которого у контура карты нет:
 * вкладка «Поход» не понимала, чей это поход, а после разбора добычи жабы могли
 * вернуться в первую попавшуюся «Разведку». Теперь `startExpedition` получает
 * `originRoomId` (id гекса), сохраняет его и возвращает команду именно туда.
 *
 * Проверяем на РЕАЛЬНОМ коде:
 *   1) `originRoomId` переживает сохранение и чтение сейва;
 *   2) жаба уходит из сектора: `scene_id` перестаёт быть гексом «Разведки»
 *      (миграция возвращает её в биопод), а `status` помечает её в походе;
 *   3) `isExpeditionFromRoom` узнаёт контур по id гекса, id постройки и старому
 *      числовому `Scene.id`, а чужой контур и пустой origin — нет;
 *   4) после разбора добычи команда возвращается в исходный контур, даже если
 *      в колонии несколько «Разведок» и исходная не первая в списке;
 *   5) первая вкладка показывает поход только в своём контуре, а миграция привязывает
 *      старые походы без контура к первой «Разведке», оставляя вторую свободной;
 *   6) из второй «Разведки» уходит вторая команда без Диспетчерской, а повторный
 *      поход из уже занятого контура не отправляется.
 *
 * Запуск: node tmp-verify-expedition-origin.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-origin-"));
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

const LS_KEY = "Game_State6";

/** Жаба, которая сидит в первой «Разведке» и готова идти в поход */
const toad = (id = 1) => ({
  id,
  name: `Жаба ${id}`,
  stage: "adult",
  generation: 1,
  sex: "female",
  type: "hybrid",
  scene_id: "slot-a",
  homeId: 1,
  created_at: new Date().toISOString(),
  parents: null,
  state: { hunger: 100 },
  pregnancy: null,
  status: "ok",
  energy: 100,
  hp: 100,
  maxHp: 100,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 60,
    speed: 1.5,
    rarity: 20,
    hungerRate: 1.5,
    fertility: 3,
    personality: null,
  },
});

const makeState = (patch = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 50,
    astro_quax: 10,
    biomass: 100,
    storage: { food: 100, contourPass: 0 },
  },
  scenes: [{ id: 1, name: "Био Под", capacity: 2, created_at: "" }],
  toads: [toad()],
  // Чужая «Разведка» стоит первой: возврат «в первую» был бы виден сразу
  colony: {
    rooms: [
      { id: "scout_2", slotId: "slot-b", kind: "scout", builtAt: "" },
      { id: "scout_1", slotId: "slot-a", kind: "scout", builtAt: "" },
    ],
  },
  expeditions: [],
  expeditionStats: {
    completed: 0,
    bestDepth: 0,
    downed: 0,
    unlockedSectors: [],
  },
  lastSaved: "",
  createdAt: "",
  ...patch,
});

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const models = bundle("src/models/expedition.ts", "models-expedition");
const manager = bundle("src/utils/expedition-manager.ts", "expedition-manager");
const gameStorage = bundle("src/backend/localStorage.ts", "game-storage");

const failures = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures.push(
      `${label}: получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`,
    );
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${JSON.stringify(actual)}`);
};

const reset = (state) => {
  store.clear();
  store.set(LS_KEY, JSON.stringify(state));
};
const saved = () => JSON.parse(store.get(LS_KEY));
const savedExpedition = () => saved().expeditions[0];
const savedToad = () => saved().toads.find((item) => item.id === 1);

/** События похода случайны: фиксируем rng, чтобы проверка была воспроизводимой */
const realRandom = Math.random;
Math.random = () => 0.99;

const SECTOR = models.SECTORS[0];

console.log("\n[1] Старт похода запоминает контур и уводит жабу из сектора");
console.log("─".repeat(60));
reset(makeState());

const started = manager.startExpedition(
  SECTOR.id,
  [{ toadId: 1, role: "scout" }],
  "scout_1",
);

check("поход отправлен", started.success, true);
check(
  "originRoomId пережил сохранение",
  savedExpedition().originRoomId,
  "scout_1",
);
check("жаба помечена в походе", savedToad().status, "out");
// Числовой `scene_id` — биопод: миграция возвращает туда жабу, а не оставляет в гексе
check("жаба больше не сидит в «Разведке»", savedToad().scene_id, 1);

console.log("\n[2] isExpeditionFromRoom узнаёт свой контур");
console.log("─".repeat(60));
const expedition = savedExpedition();
check(
  "по id гекса",
  manager.isExpeditionFromRoom(expedition, {
    id: "scout_1",
    slotId: "slot-a",
  }),
  true,
);
check(
  "старый числовой Scene.id",
  manager.isExpeditionFromRoom(
    { ...expedition, originRoomId: 42 },
    { id: "scout_1", sceneId: 42 },
  ),
  true,
);
check(
  "чужая «Разведка»",
  manager.isExpeditionFromRoom(expedition, {
    id: "scout_2",
    slotId: "slot-b",
  }),
  false,
);
check(
  "сейв без origin",
  manager.isExpeditionFromRoom(
    { ...expedition, originRoomId: undefined },
    { id: "scout_1", slotId: "slot-a" },
  ),
  false,
);

console.log("\n[2b] Первая вкладка показывает только поход своего контура");
console.log("─".repeat(60));
const legacyExpedition = { ...expedition, id: "legacy", originRoomId: undefined };
const otherRoomExpedition = { ...expedition, id: "foreign", originRoomId: "scout_2" };

check(
  "свой контур видит только свой поход",
  manager
    .getRoomExpeditions(
      [expedition, legacyExpedition, otherRoomExpedition],
      { id: "scout_1", slotId: "slot-a" },
    )
    .map((item) => item.id),
  [expedition.id],
);
check(
  "другая «Разведка» видит только свой поход",
  manager
    .getRoomExpeditions(
      [expedition, legacyExpedition, otherRoomExpedition],
      { id: "scout_2", slotId: "slot-b" },
    )
    .map((item) => item.id),
  [otherRoomExpedition.id],
);
check(
  "поход без контура не показывается в чужой «Разведке»",
  manager
    .getRoomExpeditions(
      [expedition, legacyExpedition, otherRoomExpedition],
      { id: "scout_3" },
    )
    .map((item) => item.id),
  [],
);

console.log("\n[3] Разбор добычи возвращает команду в исходный контур");
console.log("─".repeat(60));
const expeditionId = expedition.id;
const extracted = manager.extractExpedition(expeditionId);
check("поход завершён экстренным маяком", extracted.success, true);

const finished = manager.finishExpedition(expeditionId, "biomass");
check("добыча разобрана", finished.success, true);
check("жаба вернулась в свою «Разведку»", savedToad().scene_id, "slot-a");
check("поход убран из сейва", saved().expeditions.length, 0);

const finishedAgain = manager.finishExpedition(expeditionId, "biomass");
check("повторный разбор отклонён", finishedAgain.success, false);

console.log("\n[4] Числовой origin старого сейва тоже возвращает домой");
console.log("─".repeat(60));
reset(
  makeState({
    colony: {
      rooms: [
        { id: "scout_2", slotId: "slot-b", kind: "scout", builtAt: "" },
        {
          id: "scout_1",
          slotId: "slot-a",
          kind: "scout",
          builtAt: "",
          sceneId: 42,
        },
      ],
    },
  }),
);

const legacyStarted = manager.startExpedition(
  SECTOR.id,
  [{ toadId: 1, role: "scout" }],
  42,
);
check("старый поход отправлен", legacyStarted.success, true);
check("числовой origin сохранён", savedExpedition().originRoomId, 42);

const legacyId = savedExpedition().id;
manager.extractExpedition(legacyId);
manager.finishExpedition(legacyId, "biomass");
check("жаба вернулась по Scene.id", savedToad().scene_id, "slot-a");
check("разобранный поход ушёл в архив", saved().expeditionArchive?.length, 1);
check(
  "в архиве сохранился журнал похода",
  saved().expeditionArchive?.[0].id === legacyId &&
    saved().expeditionArchive?.[0].log.length > 0,
  true,
);

console.log("\n[5] Миграция привязывает старый поход к первой «Разведке»");
console.log("─".repeat(60));
reset(
  makeState({
    colony: {
      rooms: [
        { id: "scout_1", slotId: "slot-a", kind: "scout", builtAt: "" },
      ],
    },
    expeditions: [{ ...legacyExpedition, id: "legacy-one" }],
  }),
);
const migrated = gameStorage.getGameState();
check("старый поход получил контур", migrated.expeditions[0].originRoomId, "scout_1");
check(
  "привязка сохранилась в сейв",
  saved().expeditions[0].originRoomId,
  "scout_1",
);

reset(
  makeState({
    expeditions: [{ ...legacyExpedition, id: "legacy-many" }],
  }),
);
const notMigrated = gameStorage.getGameState();
check(
  "при двух «Разведках» старый поход уходит в первую",
  notMigrated.expeditions[0].originRoomId,
  "scout_2",
);
check(
  "вторая «Разведка» свободна от старого похода",
  manager
    .getRoomExpeditions(notMigrated.expeditions, {
      id: "scout_1",
      slotId: "slot-a",
    })
    .map((item) => item.id),
  [],
);

console.log("\n[6] Из второй «Разведки» можно отправить ещё одну команду");
console.log("─".repeat(60));
const twoTeamsBase = makeState();
reset({
  ...twoTeamsBase,
  toads: [
    toad(1),
    { ...toad(2), scene_id: "slot-b" },
    { ...toad(3), scene_id: "slot-a" },
  ],
});

const firstTeam = manager.startExpedition(
  SECTOR.id,
  [{ toadId: 1, role: "scout" }],
  "scout_1",
);
const secondTeam = manager.startExpedition(
  SECTOR.id,
  [{ toadId: 2, role: "scout" }],
  "scout_2",
);
check("первая команда ушла из scout_1", firstTeam.success, true);
check("вторая команда ушла из scout_2", secondTeam.success, true);
check(
  "в «Разведках» два разных похода",
  manager
    .getRoomExpeditions(saved().expeditions, { id: "scout_1" })
    .map((item) => item.originRoomId),
  ["scout_1"],
);
check(
  "вторая «Разведка» не видит первый поход",
  manager
    .getRoomExpeditions(saved().expeditions, { id: "scout_2" })
    .map((item) => item.originRoomId),
  ["scout_2"],
);

const duplicateTeam = manager.startExpedition(
  SECTOR.id,
  [{ toadId: 3, role: "scout" }],
  "scout_1",
);
check(
  "из занятого контура второй поход не уходит",
  duplicateTeam.success,
  false,
);

console.log("\n[6b] Завершённый поход тоже держит контур");
console.log("─".repeat(60));
const completedState = saved();
reset({
  ...completedState,
  expeditions: completedState.expeditions.map((expedition) =>
    expedition.originRoomId === "scout_1"
      ? { ...expedition, phase: "completed" }
      : expedition,
  ),
});
const afterCompleted = manager.startExpedition(
  SECTOR.id,
  [{ toadId: 3, role: "scout" }],
  "scout_1",
);
check(
  "после завершения похода нужен разбор добычи",
  afterCompleted.success,
  false,
);

Math.random = realRandom;

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.log(`   • ${failure}`));
  process.exitCode = 1;
} else {
  console.log("✅ Поход помнит свой контур и возвращает команду туда же");
}
