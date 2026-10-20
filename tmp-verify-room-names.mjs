/**
 * Проверка имён секторов колонии — «у каждой комнаты своё имя с номером» (на РЕАЛЬНОМ коде).
 *
 * У вида, который строится несколько раз, имя — название вида плюс номер экземпляра
 * («Репродуктор #1», «Репродуктор #2»), а у единственного сектора (коллайдер, магазин,
 * диссоциатор) и у ядра номера нет. Скрипт бандлит модули через esbuild и гоняет те же
 * функции, что работают в игре:
 *   1) формула имени (`room-names.ts` → `formatRoomName`): «#номер» только у тех видов,
 *      которые строятся по нескольку раз, название вида — из каталога построек;
 *   2) имена гексов стартовой карты (`resolveColonyRooms`): «Биопод #1» и «Репродуктор #1»
 *      у базовых секторов, «Ядро» без номера, пустые слоты без имени вовсе;
 *   3) постройки продолжают нумерацию своего вида: второй репродуктор — «Репродуктор #2»,
 *      склады — «Склад #1» и «Склад #2» по порядку возведения;
 *   4) единственные секторы номера не получают («Коллайдер»), и второго такого не построить
 *      (`canBuildRoomKind`);
 *   5) имя будущей постройки (`getNextRoomName`) сходится с тем, что она получит на карте;
 *   6) снос освобождает номер: без базового репродуктора первая постройка снова «#1»;
 *   7) у каждого сектора карты имя своё и непустое — по нему игрок отличает один гекс от другого.
 *
 * Запуск: node tmp-verify-room-names.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-names-"));
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

const roomsConfig = bundle("src/components/HexMap/rooms-config.ts", "rooms-config");
const roomNames = bundle("src/components/HexMap/room-names.ts", "room-names");
const colonyBuild = bundle("src/components/HexMap/colony-build.ts", "colony-build");
const constants = bundle("src/utils/constants.tsx", "constants");

const NEST = constants.NEST_ROOM_ID;
/** Виды, которые строятся сколько угодно раз: у них в имени обязан быть номер */
const MULTI = [
  "aviary",
  "breeding",
  "scout",
  "storage",
  "hospital",
  "power",
];
/** Виды в единственном экземпляре: номера у них нет */
const UNIQUE = ["collider", "shop", "dissociator"];
/** Свободные гексы дальнего кольца — на них и ставим проверочные постройки */
const FREE_SLOTS = Array.from({ length: 7 }, (_, index) => `outpost-4-${index}`);

const title = (kind) => roomsConfig.ROOM_BLUEPRINTS[kind].title;
const room = (id, kind, extra = {}) => ({
  id,
  kind,
  builtAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});
const colony = (rooms, demolished = []) => ({ rooms, demolished });
const map = (state) => colonyBuild.resolveColonyRooms(state);
const nameOf = (rooms, id) =>
  rooms.find((item) => item.id === id || item.slotId === id)?.name;

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

// === 1. Формула имени =====================================================
console.log("\n=== 1. Формула имени ===");
MULTI.forEach((kind) => {
  check(
    `«${title(kind)} #2» — номер у вида, который строится много раз`,
    roomNames.formatRoomName(kind, 2),
    `${title(kind)} #2`,
  );
});
UNIQUE.forEach((kind) => {
  check(
    `«${title(kind)}» — единственный сектор без номера`,
    roomNames.formatRoomName(kind, 1),
    title(kind),
  );
});
check(
  "нумерация начинается с первого",
  roomNames.formatRoomName("breeding", 1),
  "Репродуктор #1",
);
check(
  "номер не теряется у большого числа",
  roomNames.formatRoomName("storage", 12),
  "Склад #12",
);
check("коллайдер — единственный", roomNames.isUniqueRoomKind("collider"), true);
check("магазин — единственный", roomNames.isUniqueRoomKind("shop"), true);
check("диссоциатор — единственный", roomNames.isUniqueRoomKind("dissociator"), true);
check("склад — не единственный", roomNames.isUniqueRoomKind("storage"), false);
check("биопод — не единственный", roomNames.isUniqueRoomKind("aviary"), false);
check("название вида берётся из каталога", roomNames.getRoomKindTitle("power"), "Энергосектор");

// === 2. Стартовая карта ===================================================
console.log("\n=== 2. Стартовая карта ===");
const start = map(colony([]));
check("базовый биопод — «Биопод #1»", nameOf(start, "aviary"), "Биопод #1");
check("базовый репродуктор — «Репродуктор #1»", nameOf(start, NEST), "Репродуктор #1");
check("ядро — без номера", nameOf(start, "core"), "Ядро");
const startSlots = start.filter((item) => item.kind === "empty");
check("пустые слоты на карте есть", startSlots.length > 0, true);
check(
  "у пустых слотов имени нет",
  startSlots.every((item) => item.name === ""),
  true,
);
check(
  "у каждого сектора имя своё",
  new Set(start.filter((item) => item.kind !== "empty").map((item) => item.name)).size,
  start.filter((item) => item.kind !== "empty").length,
);
check("всего секторов на старте", start.filter((item) => item.kind !== "empty").length, 3);

// === 2.1 Инкубатор из старого сейва =======================================
console.log("\n=== 2.1 Инкубатор из старого сейва ===");
const legacy = map(colony([room("slot-north", "incubator")]));
const legacyHex = legacy.find((item) => item.id === "slot-north");
check("гекс старого инкубатора остался на карте", Boolean(legacyHex), true);
check("инкубатор стал свободным слотом", legacyHex?.kind, "empty");
check("у свободного слота нет имени", legacyHex?.name, "");
check(
  "слот старого инкубатора можно застроить заново",
  legacyHex ? colonyBuild.canBuildOnSlot(legacyHex, legacy) : false,
  true,
);

// === 3. Нумерация построек ================================================
console.log("\n=== 3. Нумерация построек ===");
const builtState = colony([
  room("slot-north", "breeding"),
  room("slot-south", "storage"),
  room("slot-south-west", "storage"),
]);
const built = map(builtState);
check("второй репродуктор — «Репродуктор #2»", nameOf(built, "slot-north"), "Репродуктор #2");
check("первый склад — «Склад #1»", nameOf(built, "slot-south"), "Склад #1");
check("второй склад — «Склад #2»", nameOf(built, "slot-south-west"), "Склад #2");
check("базовый репродуктор остаётся первым", nameOf(built, NEST), "Репродуктор #1");
check("биопод нумерацию складов не трогает", nameOf(built, "aviary"), "Биопод #1");
check(
  "порядок постройки в сейве задаёт номер",
  nameOf(
    map(
      colony([
        room("slot-south", "storage", { builtAt: "2026-02-01T00:00:00.000Z" }),
        room("slot-north", "storage", { builtAt: "2026-03-01T00:00:00.000Z" }),
      ]),
    ),
    "slot-south",
  ),
  "Склад #1",
);
check(
  "дальняя постройка держит свой номер",
  nameOf(
    map(
      colony([
        room(FREE_SLOTS[0], "storage", { builtAt: "2026-02-01T00:00:00.000Z" }),
        room("slot-south", "storage", { builtAt: "2026-03-01T00:00:00.000Z" }),
      ]),
    ),
    FREE_SLOTS[0],
  ),
  "Склад #1",
);
check(
  "и ближняя к ядру получает следующий",
  nameOf(
    map(
      colony([
        room(FREE_SLOTS[0], "storage", { builtAt: "2026-02-01T00:00:00.000Z" }),
        room("slot-south", "storage", { builtAt: "2026-03-01T00:00:00.000Z" }),
      ]),
    ),
    "slot-south",
  ),
  "Склад #2",
);
check(
  "новый биопод — «Биопод #2»",
  nameOf(map(colony([room(FREE_SLOTS[0], "aviary")])), FREE_SLOTS[0]),
  "Биопод #2",
);

// === 4. Единственные секторы ==============================================
console.log("\n=== 4. Единственные секторы ===");
const uniqueState = colony([
  room("slot-north", "collider"),
  room("outpost-0", "shop"),
  room("slot-south", "dissociator"),
]);
const uniqueMap = map(uniqueState);
check("коллайдер — без номера", nameOf(uniqueMap, "slot-north"), "Коллайдер");
check("торговая капсула — без номера", nameOf(uniqueMap, "outpost-0"), "Торговая капсула");
check("диссоциатор — без номера", nameOf(uniqueMap, "slot-south"), "Диссоциатор");
check(
  "второй коллайдер построить нельзя",
  colonyBuild.canBuildRoomKind(uniqueState, "collider"),
  false,
);
check("второй магазин построить нельзя", colonyBuild.canBuildRoomKind(uniqueState, "shop"), false);
check(
  "второй диссоциатор построить нельзя",
  colonyBuild.canBuildRoomKind(uniqueState, "dissociator"),
  false,
);
check("склады строить можно", colonyBuild.canBuildRoomKind(uniqueState, "storage"), true);
check(
  "коллайдер на карте один",
  uniqueMap.filter((item) => item.kind === "collider").length,
  1,
);

// === 5. Имя будущей постройки =============================================
console.log("\n=== 5. Имя будущей постройки ===");
MULTI.forEach((kind, index) => {
  const next = roomNames.getNextRoomName(built, kind);
  const slotId = FREE_SLOTS[index];
  const after = map(colony([...builtState.rooms, room(slotId, kind)]));

  check(
    `«${title(kind)}»: имя до постройки сходится с именем постройки`,
    nameOf(after, slotId),
    next,
  );
});
check(
  "следующий репродуктор — «#3»",
  roomNames.getNextRoomName(built, "breeding"),
  "Репродуктор #3",
);
check("следующий склад — «#3»", roomNames.getNextRoomName(built, "storage"), "Склад #3");
check("следующий биопод — «#2»", roomNames.getNextRoomName(built, "aviary"), "Биопод #2");


// === 6. Снос освобождает номер ============================================
console.log("\n=== 6. Снос освобождает номер ===");
const withoutNest = map(colony([], [NEST]));
check("снесённый репродуктор — пустой слот", nameOf(withoutNest, "breeding"), "");
const rebuiltNest = map(colony([room("slot-north", "breeding")], [NEST]));
check("без базы постройка снова «#1»", nameOf(rebuiltNest, "slot-north"), "Репродуктор #1");
const rebuiltSecond = map(
  colony([room("slot-north", "breeding"), room("slot-south", "breeding")], [NEST]),
);
check("и следующая за ней — «#2»", nameOf(rebuiltSecond, "slot-south"), "Репродуктор #2");
check(
  "снос репродуктора биопод не сбивает",
  nameOf(map(colony([], [NEST])), "aviary"),
  "Биопод #1",
);
check(
  "снесённый биопод отдаёт номер первому построенному",
  nameOf(map(colony([room("slot-south", "aviary")], ["aviary"])), "slot-south"),
  "Биопод #1",
);

// === 7. Имена уникальны ===================================================
console.log("\n=== 7. Имена уникальны ===");
const crowded = map(
  colony([
    room(FREE_SLOTS[0], "aviary"),
    room(FREE_SLOTS[1], "breeding"),
    room(FREE_SLOTS[2], "storage"),
    room(FREE_SLOTS[3], "storage"),
    room(FREE_SLOTS[4], "hospital"),
    room(FREE_SLOTS[5], "power"),
    room(FREE_SLOTS[6], "collider"),
    room("slot-north", "scout"),
    room("outpost-0", "shop"),
  ]),
);
const crowdedNames = crowded.filter((item) => item.kind !== "empty").map((item) => item.name);
check("имена всех секторов уникальны", new Set(crowdedNames).size, crowdedNames.length);
check(
  "у каждого сектора имя непустое",
  crowdedNames.every((name) => typeof name === "string" && name.length > 0),
  true,
);
check("секторов на карте", crowdedNames.length, 12);
check(
  "соседние склады различаются именем",
  nameOf(crowded, FREE_SLOTS[2]) !== nameOf(crowded, FREE_SLOTS[3]),
  true,
);
check(
  "имена соседних складов",
  `${nameOf(crowded, FREE_SLOTS[2])} / ${nameOf(crowded, FREE_SLOTS[3])}`,
  "Склад #1 / Склад #2",
);

console.log("\n" + "=".repeat(60));
if (failures.length > 0) {
  console.log(`❌ ИМЕНА СЕКТОРОВ: провалено проверок — ${failures.length}`);
  failures.forEach((line) => console.log(`   • ${line}`));
  process.exit(1);
}
console.log("✅ Имена секторов: все проверки прошли");
