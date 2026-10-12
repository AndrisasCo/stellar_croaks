/**
 * Проверка роста карты колонии на РЕАЛЬНОМ коде проекта (без запуска игры).
 *
 * Карта растёт не кольцами, а фронтом застройки: у новой комнаты открываются ВСЕ её соседние
 * гексы — и те, что лежат дальше от ядра, и те, что стоят вбок по её же кольцу (внутрь
 * открывать нечего: кольца 0–2 открыты с начала игры). Скрипт бандлит модули
 * через esbuild и прогоняет их как обычный JS — проверяются те же формулы, что работают в игре:
 *   1) начальная карта — радиус 2 (ядро, вольер, гнездо, слоты 1–2 колец);
 *   2) id слотов второго кольца остались `outpost-N` (старые сейвы не теряют постройки),
 *      третьего — `outpost-3-N`;
 *   3) новая комната открывает все свои соседние гексы и только вокруг себя: целого кольца
 *      не открывается, а у краевых гексов кольца 2 боковые соседи уже открыты базой;
 *   4) фронты соседних комнат пересекаются — вторая комната добавляет меньше гексов;
 *   5) застройка внутреннего кольца и чужой id карту не двигают, а своя постройка из сейва
 *      остаётся на карте и открывает свои гексы;
 *   6) цепочка растёт до шестого кольца и там останавливается: за предел карты гексов нет;
 *   7) медовая сетка территории обступает колонию по её форме: клеток внутри колонии нет,
 *      каждая клетка граничит с гексом колонии;
 *   8) камера: габариты карты растут, обзорный зум уменьшается, приближенный не зависит.
 *
 * Запуск: node tmp-verify-colony-growth.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-growth-"));
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

const roomsConfig = bundle(
  "src/components/HexMap/rooms-config.ts",
  "rooms-config",
);
const colonyBuild = bundle(
  "src/components/HexMap/colony-build.ts",
  "colony-build",
);
const geometry = bundle(
  "src/components/HexMap/hex-geometry.ts",
  "hex-geometry",
);
const honeycomb = bundle("src/components/HexMap/hex-honeycomb.ts", "honeycomb");
const zoom = bundle("src/components/HexMap/hex-zoom.ts", "zoom");

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const checkTrue = (label, value) => check(label, Boolean(value), true);

const colonyWith = (...rooms) => ({ rooms });
const roomsOf = (colony) => colonyBuild.resolveColonyRooms(colony);
const coordKeys = (rooms) => rooms.map((room) => `${room.coord.q}:${room.coord.r}`);
const keysOf = (coords) => coords.map((coord) => `${coord.q}:${coord.r}`);
const ringRooms = (rooms, ring) =>
  rooms.filter((room) => roomsConfig.getRoomRing(room) === ring);
const idsAtRing = (rooms, ring) =>
  ringRooms(rooms, ring)
    .map((room) => room.id)
    .sort();

/** Координаты соседей гекса, лежащих на кольцо дальше — тот самый фронт застройки */
const outwardCoords = (room) => {
  const ring = roomsConfig.getRoomRing(room);

  return geometry
    .hexNeighbors(room.coord)
    .filter(
      (coord) => geometry.hexDistance(coord, { q: 0, r: 0 }) === ring + 1,
    );
};

const outwardKeys = (room) => new Set(keysOf(outwardCoords(room)));

console.log("── 1. Начальная карта колонии ─────────────────────────────");
const startRooms = roomsOf(colonyWith());

check(
  "гексов на старте (ядро + 2 комнаты + слоты 1–2 колец)",
  startRooms.length,
  19,
);
check(
  "дальнее кольцо стартовой карты",
  roomsConfig.getRoomsRadius(startRooms),
  roomsConfig.BASE_COLONY_RADIUS,
);
check(
  "свободных слотов под застройку на старте",
  colonyBuild.getBuildableSlots(startRooms).length,
  16,
);
checkTrue(
  "ядро и базовые комнаты на карте",
  ["core", "aviary", "breeding"].every((id) =>
    startRooms.some((room) => room.id === id),
  ),
);

console.log("\n── 2. Совместимость сейвов ────────────────────────────────");
check(
  "id слотов второго кольца — прежние (outpost-N)",
  idsAtRing(startRooms, 2).length === 12 &&
    idsAtRing(startRooms, 2).includes("outpost-11"),
  true,
);
checkTrue(
  "каталог знает слоты третьего кольца",
  Boolean(roomsConfig.HEX_ROOM_BY_ID["outpost-3-0"]),
);
const savedAviary = roomsOf(
  colonyWith({ id: "outpost-5", kind: "aviary", builtAt: "" }),
);
check(
  "старая постройка из сейва стоит на своём гексе",
  savedAviary.find((room) => room.id === "outpost-5").kind,
  "aviary",
);
check(
  "у углового гекса кольца три соседа наружу",
  outwardCoords(roomsConfig.HEX_ROOM_BY_ID["outpost-0"]).length,
  3,
);
check(
  "у срединного гекса кольца два соседа наружу",
  outwardCoords(roomsConfig.HEX_ROOM_BY_ID["outpost-5"]).length,
  2,
);
check(
  "постройка из сейва открыла оба своих гекса",
  savedAviary.length,
  startRooms.length + 2,
);

console.log("\n── 3. Комната на краю открывает три гекса ─────────────────");
const edgeColony = colonyWith({ id: "outpost-0", kind: "storage", builtAt: "" });
const edgeRooms = roomsOf(edgeColony);
const builtEdge = edgeRooms.find((room) => room.id === "outpost-0");
const openedKeys = new Set(coordKeys(ringRooms(edgeRooms, 3)));

check("гексов после постройки на краю", edgeRooms.length, 19 + 3);
check("новых гексов за одну комнату", edgeRooms.length - startRooms.length, 3);
check(
  "слотов под застройку: было 16, минус занятый, плюс три",
  colonyBuild.getBuildableSlots(edgeRooms).length,
  16 - 1 + 3,
);
check("из 18 слотов третьего кольца открыто три", idsAtRing(edgeRooms, 3).length, 3);
checkTrue(
  "одна комната открывает не больше трёх гексов (для любого гекса карты)",
  roomsConfig.ALL_HEX_ROOMS.filter(
    (room) => roomsConfig.getRoomRing(room) > 0,
  ).every((room) => outwardCoords(room).length <= 3),
);
checkTrue(
  "и не меньше двух — наружу из кольца всегда есть куда расти",
  roomsConfig.ALL_HEX_ROOMS.filter(
    (room) =>
      roomsConfig.getRoomRing(room) > 0 &&
      roomsConfig.getRoomRing(room) < roomsConfig.MAX_COLONY_RADIUS,
  ).every((room) => outwardCoords(room).length >= 2),
);
checkTrue(
  "все новые гексы — соседи постройки",
  keysOf(outwardCoords(builtEdge)).every((key) => openedKeys.has(key)),
);
checkTrue(
  "новые гексы свободны и доступны под застройку",
  ringRooms(edgeRooms, 3).every(
    (room) =>
      !roomsConfig.isBuiltRoom(room) &&
      colonyBuild.canBuildOnSlot(room, edgeRooms),
  ),
);
checkTrue(
  "построенная комната больше не слот",
  !colonyBuild.canBuildOnSlot(builtEdge, edgeRooms),
);
const farRingThreeSlot = roomsConfig.ALL_HEX_ROOMS.find(
  (room) =>
    roomsConfig.getRoomRing(room) === 3 &&
    !openedKeys.has(`${room.coord.q}:${room.coord.r}`),
);
checkTrue(
  "слот на другой стороне кольца не открылся",
  Boolean(farRingThreeSlot) &&
    !edgeRooms.some((room) => room.id === farRingThreeSlot.id),
);
checkTrue(
  "id и координаты гексов уникальны",
  new Set(edgeRooms.map((room) => room.id)).size === edgeRooms.length &&
    new Set(coordKeys(edgeRooms)).size === edgeRooms.length,
);

console.log("\n── 4. Соседние комнаты делят фронт ───────────────────────");
const pairRooms = roomsOf(
  colonyWith(
    { id: "outpost-0", kind: "storage", builtAt: "" },
    { id: "outpost-1", kind: "hospital", builtAt: "" },
  ),
);
const clumpOf = (id) => outwardKeys(pairRooms.find((room) => room.id === id));
const clumpA = clumpOf("outpost-0");
const clumpB = clumpOf("outpost-1");
const shared = [...clumpA].filter((key) => clumpB.has(key));
const union = new Set([...clumpA, ...clumpB]);

check("соседние комнаты делят один гекс фронта", shared.length, 1);
check("объединённый фронт — четыре гекса", union.size, 4);
check("гексов после двух соседних комнат", pairRooms.length, 19 + 4);
check(
  "вторая комната добавила один гекс вместо трёх",
  pairRooms.length - edgeRooms.length,
  1,
);
checkTrue(
  "за вторую комнату гексов меньше, чем за угловую",
  pairRooms.length - edgeRooms.length <
    edgeRooms.length - startRooms.length,
);

console.log("\n── 5. Что карту не двигает ────────────────────────────────");
check(
  "застройка внутреннего слота (кольцо 1)",
  roomsOf(colonyWith({ id: "slot-north", kind: "shop", builtAt: "" })).length,
  19,
);
check("чужой id из сейва", roomsOf(colonyWith({ id: "nope", kind: "shop", builtAt: "" })).length, 19);
checkTrue(
  "слота с чужим id в каталоге нет",
  roomsConfig.HEX_ROOM_BY_ID["nope"] === undefined,
);
const orphanRooms = roomsOf(
  colonyWith({ id: "outpost-3-5", kind: "shop", builtAt: "" }),
);
checkTrue(
  "постройка без разросшихся соседей остаётся на карте",
  orphanRooms.some(
    (room) => room.id === "outpost-3-5" && room.kind === "shop",
  ),
);
check(
  "она открыла и внешние гексы, и боковые",
  orphanRooms.length,
  19 + 1 + 4,
);
check("слотов под застройку у неё", idsAtRing(orphanRooms, 4).length, 2);
console.log("\n── 6. Цепочка до предела карты ────────────────────────────");
/** Дорожка наружу: каждая следующая комната стоит на гексе, открытом предыдущей */
const chain = [{ id: "outpost-0", kind: "storage", builtAt: "" }];
let walker = roomsConfig.HEX_ROOM_BY_ID["outpost-0"];

for (let ring = 3; ring <= roomsConfig.MAX_COLONY_RADIUS; ring += 1) {
  const next = outwardCoords(walker)[0];
  const slot = roomsConfig.HEX_ROOM_BY_COORD[`${next.q}:${next.r}`];

  if (!slot) {
    break;
  }

  chain.push({ id: slot.id, kind: "storage", builtAt: "" });
  walker = slot;
}

const chainRooms = roomsOf(colonyWith(...chain));

check(
  "цепочка дошла до предельного кольца",
  roomsConfig.getRoomsRadius(chainRooms),
  roomsConfig.MAX_COLONY_RADIUS,
);
check("комнат в цепочке (край + кольца 3–6)", chain.length, 5);
check(
  "гексов у цепочки: база, комнаты цепочки и объединённый фронт",
  chainRooms.length,
  32,
);
checkTrue(
  "цепочка открыла больше, чем комнат в ней самой",
  chainRooms.length > 19 + chain.length,
);
const chainTail = roomsConfig.HEX_ROOM_BY_ID[chain[chain.length - 1].id];
check(
  "последняя комната цепочки — на предельном кольце",
  roomsConfig.getRoomRing(chainTail),
  roomsConfig.MAX_COLONY_RADIUS,
);
checkTrue(
  "у неё фронта наружу уже нет",
  outwardCoords(chainTail).every(
    (coord) => !roomsConfig.HEX_ROOM_BY_COORD[`${coord.q}:${coord.r}`],
  ),
);
check(
  "за предел карты гексов нет",
  chainRooms.every(
    (room) => roomsConfig.getRoomRing(room) <= roomsConfig.MAX_COLONY_RADIUS,
  ),
  true,
);
const topRooms = roomsOf(
  colonyWith({ id: "outpost-6-0", kind: "shop", builtAt: "" }),
);
// Кольцо 6 — предел карты: соседей дальше в каталоге нет, поэтому открываются только гексы
// рядом с самой комнатой — один внутренний (кольцо 5) и два боковых (кольцо 6).
check(
  "на предельном кольце открываются только гексы рядом с комнатой",
  topRooms.length,
  19 + 1 + 3,
);
checkTrue(
  "в каталоге нет гексов дальше предела",
  roomsConfig.ALL_HEX_ROOMS.every(
    (room) => roomsConfig.getRoomRing(room) <= roomsConfig.MAX_COLONY_RADIUS,
  ),
);

console.log("\n── 7. Медовая сетка обступает колонию ─────────────────────");
const frameStart = honeycomb.getHoneycombCoords(
  startRooms.map((room) => room.coord),
);
const startKeys = new Set(coordKeys(startRooms));
const touchedByColony = (coord) =>
  geometry
    .hexNeighbors(coord)
    .some((neighbour) => startKeys.has(`${neighbour.q}:${neighbour.r}`));

check("клеток сетки на старте (кольцо 3)", frameStart.length, 18);
checkTrue(
  "сетка не заходит на гексы колонии",
  keysOf(frameStart).every((key) => !startKeys.has(key)),
);
checkTrue("каждая клетка граничит с колонией", frameStart.every(touchedByColony));

const frameEdge = honeycomb.getHoneycombCoords(
  edgeRooms.map((room) => room.coord),
);
const edgeKeys = new Set(coordKeys(edgeRooms));

check("клеток сетки вокруг выросшей колонии", frameEdge.length, 20);
checkTrue(
  "сетка не заходит и на новые гексы",
  keysOf(frameEdge).every((key) => !edgeKeys.has(key)),
);
checkTrue(
  "каждая клетка граничит с выросшей колонией",
  frameEdge.every((coord) =>
    geometry
      .hexNeighbors(coord)
      .some((neighbour) => edgeKeys.has(`${neighbour.q}:${neighbour.r}`)),
  ),
);
check(
  "клетки сетки не повторяются",
  new Set(keysOf(frameEdge)).size,
  frameEdge.length,
);
check(
  "два слоя сетки уходят дальше первого",
  honeycomb
    .getHoneycombCoords(startRooms.map((room) => room.coord), 2)
    .length > frameStart.length,
  true,
);

console.log("\n── 8. Камера и зум следят за картой ───────────────────────");
const boundsStart = zoom.getMapBounds(startRooms);
const boundsGrown = zoom.getMapBounds(edgeRooms);
const levelsStart = zoom.getZoomLevels(390, 800, startRooms);
const levelsGrown = zoom.getZoomLevels(390, 800, edgeRooms);
const levelsBig = zoom.getZoomLevels(390, 800, chainRooms);

checkTrue(
  "габариты карты выросли",
  boundsGrown.width > boundsStart.width ||
    boundsGrown.height > boundsStart.height,
);
checkTrue(
  "обзорный зум не крупнее стартового",
  levelsGrown.overview <= levelsStart.overview,
);
checkTrue(
  "на дальней карте обзорный зум уменьшился (вся карта на экране)",
  levelsBig.overview < levelsStart.overview,
);
check(
  "приближенный зум от размера карты не зависит",
  levelsBig.detail,
  levelsStart.detail,
);
checkTrue("порог видов пересчитан", levelsBig.threshold < levelsStart.threshold);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   • ${item}`));
  process.exit(1);
}

console.log("✅ Все проверки роста карты прошли");



