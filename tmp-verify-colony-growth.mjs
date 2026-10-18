/**
 * Проверка роста карты колонии на РЕАЛЬНОМ коде проекта (без запуска игры).
 *
 * Правило карты одно: **слот под застройку стоит только рядом с построенной комнатой**.
 * Фронт застройки ведут все комнаты — и базовые (ядро, вольер, гнездо), и возведённые игроком:
 * у новой комнаты открываются ВСЕ её соседние гексы — и наружу, и вбок по её же кольцу.
 * Скрипт бандлит модули через esbuild и прогоняет их как обычный JS — проверяются те же
 * формулы, что работают в игре:
 *   1) стартовая карта — ядро, вольер, гнездо и слоты вокруг них (13 гексов, 10 слотов):
 *      слотов без комнаты рядом на ней нет, дальние слоты кольца 2 закрыты;
 *   2) id слотов второго кольца остались `outpost-N` (старые сейвы не теряют постройки),
 *      третьего — `outpost-3-N`;
 *   3) новая комната открывает все свои соседние гексы и только вокруг себя: целого кольца
 *      не открывается, а часть соседей вбок уже открыта фронтом соседних комнат;
 *   4) фронты соседних комнат пересекаются — вторая комната добавляет меньше гексов;
 *   5) застройка слота, чужой id и постройка без соседей из сейва: своя постройка остаётся
 *      на карте и открывает свои гексы, правило «слот касается комнаты» держится и там;
 *   6) цепочка растёт до шестого кольца и там останавливается: за предел карты гексов нет;
 *   7) медовая сетка территории обступает колонию по её форме: клеток внутри колонии нет,
 *      каждая клетка граничит с гексом колонии;
 *   8) камера: габариты карты растут, обзорный вид вписывает в экран ВСЮ карту — и стартовую,
 *      и выросшую вместе с новыми гексами фронта (узкий телефон и широкий экран), а приближенный
 *      зум от размера карты не зависит (см. `hex-zoom.ts` → `getOverviewView`);
 *   9) снос комнаты (`ColonyState.demolished`): гекс остаётся на карте свободным слотом, карта
 *      не сжимается, снесённая базовая комната (гнездо) тоже показывается слотом, на месте
 *      снесённого строят заново, а правила сноса и цена следующей такой комнаты считаются
 *      реальными функциями (`getRoomDemolishIssue`, `getRoomCostAfterDemolish`).
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

/** Координаты построенных комнат карты: ядро, вольер, гнездо и постройки игрока. */
const builtCoordsOf = (rooms) =>
  new Set(
    rooms
      .filter((room) => roomsConfig.isBuiltRoom(room))
      .map((room) => `${room.coord.q}:${room.coord.r}`),
  );

/**
 * Слоты, у которых рядом нет ни одной построенной комнаты. По правилу карты таких быть не
 * должно: слот открывается только фронтом застройки — то есть вплотную к комнате.
 */
const lonelySlots = (rooms) => {
  const built = builtCoordsOf(rooms);

  return rooms.filter(
    (room) =>
      !roomsConfig.isBuiltRoom(room) &&
      !geometry
        .hexNeighbors(room.coord)
        .some((coord) => built.has(`${coord.q}:${coord.r}`)),
  );
};

check(
  "гексов на старте (ядро, вольер, гнездо и слоты вокруг них)",
  startRooms.length,
  13,
);
check(
  "дальнее кольцо стартовой карты",
  roomsConfig.getRoomsRadius(startRooms),
  roomsConfig.BASE_COLONY_RADIUS,
);
check(
  "свободных слотов под застройку на старте",
  colonyBuild.getBuildableSlots(startRooms).length,
  10,
);
checkTrue(
  "ядро и базовые комнаты на карте",
  ["core", "aviary", "breeding"].every((slotId) =>
    startRooms.some((room) => room.slotId === slotId),
  ),
);
check(
  "слотов без построенной комнаты рядом — ни одного",
  lonelySlots(startRooms).length,
  0,
);
check(
  "слоты кольца 2 стоят только у вольера и гнезда",
  idsAtRing(startRooms, 2).join(","),
  "outpost-10,outpost-11,outpost-3,outpost-4,outpost-5,outpost-9",
);
checkTrue(
  "дальние слоты кольца 2 (без комнат рядом) закрыты на старте",
  [
    "outpost-0",
    "outpost-1",
    "outpost-2",
    "outpost-6",
    "outpost-7",
    "outpost-8",
  ].every((id) => !startRooms.some((room) => room.id === id)),
);

console.log("\n── 2. Совместимость сейвов ────────────────────────────────");
check(
  "id слотов второго кольца — прежние (outpost-N)",
  idsAtRing(roomsConfig.ALL_HEX_ROOMS, 2).length === 12 &&
    idsAtRing(roomsConfig.ALL_HEX_ROOMS, 2).includes("outpost-11"),
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
  "постройка из сейва открыла три соседних гекса",
  savedAviary.length,
  startRooms.length + 3,
);
check(
  "у постройки из сейва тоже нет слотов без комнаты рядом",
  lonelySlots(savedAviary).length,
  0,
);

console.log("\n── 3. Комната на краю открывает пять гексов ───────────────");
const edgeColony = colonyWith({ id: "outpost-0", kind: "storage", builtAt: "" });
const edgeRooms = roomsOf(edgeColony);
const builtEdge = edgeRooms.find((room) => room.id === "outpost-0");
const openedKeys = new Set(coordKeys(ringRooms(edgeRooms, 3)));

check("гексов после постройки на краю", edgeRooms.length, 13 + 5);
check(
  "новых гексов за одну комнату (её гекс, боковой слот и три наружу)",
  edgeRooms.length - startRooms.length,
  5,
);
check(
  "слотов под застройку: было 10, плюс четыре новых слота",
  colonyBuild.getBuildableSlots(edgeRooms).length,
  14,
);
check("из 18 слотов третьего кольца открыто три", idsAtRing(edgeRooms, 3).length, 3);
check(
  "слотов без построенной комнаты рядом — ни одного",
  lonelySlots(edgeRooms).length,
  0,
);
checkTrue(
  "каждый открытый слот доступен под застройку (правило BUILD_REQUIRES_NEIGHBOUR)",
  edgeRooms
    .filter((room) => !roomsConfig.isBuiltRoom(room))
    .every((room) => colonyBuild.canBuildOnSlot(room, edgeRooms)),
);
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
check("гексов после двух соседних комнат", pairRooms.length, 20);
check(
  "вторая комната добавила два гекса вместо пяти",
  pairRooms.length - edgeRooms.length,
  2,
);
checkTrue(
  "за вторую комнату гексов меньше, чем за первую",
  pairRooms.length - edgeRooms.length <
    edgeRooms.length - startRooms.length,
);
check(
  "у пары соседних комнат тоже нет слотов без комнаты рядом",
  lonelySlots(pairRooms).length,
  0,
);

console.log("\n── 5. Что карту не двигает ────────────────────────────────");
check(
  "застройка слота первого кольца открывает два соседних слота",
  roomsOf(colonyWith({ id: "slot-north", kind: "shop", builtAt: "" })).length,
  13 + 2,
);
check("чужой id из сейва", roomsOf(colonyWith({ id: "nope", kind: "shop", builtAt: "" })).length, 13);
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
  13 + 1 + 4,
);
check("слотов под застройку у неё", idsAtRing(orphanRooms, 4).length, 2);
check(
  "у одинокой дальней комнаты нет слотов без комнаты рядом",
  lonelySlots(orphanRooms).length,
  0,
);
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
  28,
);
checkTrue(
  "цепочка открыла больше, чем комнат в ней самой",
  chainRooms.length > 13 + chain.length,
);
check(
  "у цепочки нет слотов без комнаты рядом",
  lonelySlots(chainRooms).length,
  0,
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
// рядом с самой комнатой — она сама, один внутренний (кольцо 5) и два боковых (кольцо 6).
check(
  "на предельном кольце открываются только гексы рядом с комнатой",
  topRooms.length,
  13 + 1 + 3,
);
check(
  "у комнаты на предельном кольце нет слотов без комнаты рядом",
  lonelySlots(topRooms).length,
  0,
);
checkTrue(
  "в каталоге нет гексов дальше предела",
  roomsConfig.ALL_HEX_ROOMS.every(
    (room) => roomsConfig.getRoomRing(room) <= roomsConfig.MAX_COLONY_RADIUS,
  ),
);

// Застроены все кольца до пятого: шестое кольцо открыто только вокруг построек — правило
// «слот касается комнаты» проверяем и на большой карте, а не только на нескольких гексах.
const filledRooms = roomsOf(
  colonyWith(
    ...roomsConfig.ALL_HEX_ROOMS.filter(
      (room) => roomsConfig.getRoomRing(room) <= 5,
    ).map((room) => ({ id: room.id, kind: "storage", builtAt: "" })),
  ),
);
check(
  "застроены кольца 0–5: открылась вся карта",
  filledRooms.length,
  roomsConfig.ALL_HEX_ROOMS.length,
);
check(
  "на большой карте слотов без комнаты рядом нет",
  lonelySlots(filledRooms).length,
  0,
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

check("клеток сетки на старте", frameStart.length, 16);
checkTrue(
  "сетка не заходит на гексы колонии",
  keysOf(frameStart).every((key) => !startKeys.has(key)),
);
checkTrue("каждая клетка граничит с колонией", frameStart.every(touchedByColony));

const frameEdge = honeycomb.getHoneycombCoords(
  edgeRooms.map((room) => room.coord),
);
const edgeKeys = new Set(coordKeys(edgeRooms));

check("клеток сетки вокруг выросшей колонии", frameEdge.length, 19);
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

/**
 * Обзорный вид обязан показывать всю колонию — и стартовую, и только что выросшую.
 * Гекс считается видимым, когда в кадр попадает он сам (центр ± полуразмеры), а не только
 * его центр: иначе у края экрана висела бы половина клетки.
 */
const SCREENS = [
  [360, 640],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 640],
  [1280, 800],
  [1920, 1080],
];

const hexFitsView = (room, view) => {
  const center = geometry.axialToPixel(room.coord, geometry.HEX_SIZE);
  const halfWidth = geometry.hexWidth(geometry.HEX_SIZE) / 2;
  const halfHeight = geometry.hexHeight(geometry.HEX_SIZE) / 2;

  return (
    center.x - halfWidth >= view.visible.minX &&
    center.x + halfWidth <= view.visible.maxX &&
    center.y - halfHeight >= view.visible.minY &&
    center.y + halfHeight <= view.visible.maxY
  );
};

/** Видна ли каждая комната карты целиком: камера считается по всей карте `rooms`. */
const wholeMapVisible = (rooms, [width, height]) =>
  rooms.every((room) =>
    hexFitsView(room, zoom.getOverviewView(width, height, rooms)),
  );

/** Видны ли гексы `subset` целиком, если камера наведена на всю карту `rooms`. */
const partVisible = (rooms, subset, [width, height]) => {
  const view = zoom.getOverviewView(width, height, rooms);

  return subset.every((room) => hexFitsView(room, view));
};

checkTrue(
  "обзорный зум не крупнее зума вписывания (FIT_ZOOM и пол MIN_SCALE не поднимают его)",
  SCREENS.every(
    ([width, height]) =>
      zoom.getZoomLevels(width, height, edgeRooms).overview <=
      zoom.getFitScale(width, height, edgeRooms) + 1e-9,
  ),
);
checkTrue(
  "на любом экране обзорный вид показывает стартовую карту целиком",
  SCREENS.every((screen) => wholeMapVisible(startRooms, screen)),
);
checkTrue(
  "и карту после постройки — новые гексы фронта в кадре",
  SCREENS.every((screen) => wholeMapVisible(edgeRooms, screen)),
);
check(
  "гексов, открытых постройкой на краю",
  ringRooms(edgeRooms, 3).length,
  3,
);
checkTrue(
  "все три новых гекса целиком на экране (широкий экран и телефон)",
  [
    [1280, 800],
    [390, 844],
  ].every((screen) => partVisible(edgeRooms, ringRooms(edgeRooms, 3), screen)),
);
checkTrue(
  "карта, дошедшая до предела (кольца 3–6), тоже влезает целиком",
  SCREENS.every((screen) => wholeMapVisible(chainRooms, screen)),
);
checkTrue(
  "минимальный зум позволяет вписать и всю карту (127 гексов)",
  SCREENS.every(
    ([width, height]) =>
      zoom.getFitScale(width, height, roomsConfig.ALL_HEX_ROOMS) >=
      zoom.MIN_SCALE,
  ),
);
checkTrue(
  "приближенный вид крупнее обзорного на любом экране",
  SCREENS.every(([width, height]) => {
    const levels = zoom.getZoomLevels(width, height, edgeRooms);

    return levels.detail > levels.overview;
  }),
);

console.log("\n── 9. Снос комнаты землю не отбирает ──────────────────────");
/** Застроенный слот: берём первый, который карта готова принять (рядом с ним есть комната) */
const buildable = colonyBuild.getBuildableSlots(startRooms);
const farmSlot = buildable[0];
const builtFarm = colonyWith({
  id: farmSlot.id,
  kind: "storage",
  builtAt: new Date().toISOString(),
});
const farmRooms = roomsOf(builtFarm);
checkTrue("слот застроен: карта выросла", farmRooms.length > startRooms.length);

/** Тот же слот, но комнату снесли: постройки нет, а гекс помечен снесённым */
const clearedRooms = roomsOf({ rooms: [], demolished: [farmSlot.id] });
const clearedSlot = clearedRooms.find((room) => room.id === farmSlot.id);
checkTrue("гекс снесённой комнаты остался на карте", clearedSlot !== undefined);
check("снесённый гекс — свободный слот", clearedSlot && clearedSlot.kind, "empty");
check("слот без действий: застраивается заново", clearedSlot?.actions.length, 0);
check(
  "гексов после сноса столько же",
  coordKeys(clearedRooms).sort().join("|"),
  coordKeys(farmRooms).sort().join("|"),
);
checkTrue(
  "снесённая комната помнит свой id",
  builtFarm.rooms[0].id === farmSlot.id,
);

/** Базовые комнаты: снос гнезда оставляет гекс, ядро не трогается вовсе */
const clearedBase = roomsOf({ rooms: [], demolished: ["breeding"] });
check(
  "снесённое базовое гнездо показывается слотом",
  clearedBase.find((room) => room.id === "breeding")?.kind,
  "empty",
);
check(
  "ядро остаётся ядром",
  clearedBase.find((room) => room.slotId === "core")?.kind,
  "core",
);
check(
  "на снесённый гекс строят заново",
  roomsOf({
    rooms: [{ id: "breeding", kind: "breeding", builtAt: "" }],
    demolished: ["breeding"],
  }).find((room) => room.id === "breeding")?.kind,
  "breeding",
);

console.log("\n── 9b. Правила сноса и цена ───────────────────────────────");
const coreRoom = startRooms.find((room) => room.kind === "core");
const nestRoom = startRooms.find((room) => room.slotId === "breeding");
const emptyRoom = startRooms.find((room) => room.kind === "empty");
const toadStub = { id: 1, name: "жаба" };

checkTrue("ядро снести нельзя", !colonyBuild.canDemolishRoom(coreRoom, []));
checkTrue(
  "причина по ядру — сердце колонии",
  colonyBuild.getRoomDemolishIssue(coreRoom, []).includes("Ядро"),
);
checkTrue("пустое гнездо снести можно", colonyBuild.canDemolishRoom(nestRoom, []));
checkTrue("жаба в комнате запрещает снос", !colonyBuild.canDemolishRoom(nestRoom, [toadStub]));
check(
  "причина называет число жаб",
  colonyBuild.getRoomDemolishIssue(nestRoom, [toadStub]),
  "В секторе 1 🐸 — сначала переселите их в биопод.",
);
checkTrue(
  "у пустого гекса сносить нечего",
  colonyBuild.getRoomDemolishIssue(emptyRoom, []).includes("ничего не построено"),
);

/** Цена: считается по числу построенных, поэтому снос делает шаг назад */
const oneStorage = colonyWith({ id: farmSlot.id, kind: "storage", builtAt: "" });
const twoStorages = colonyWith(
  { id: farmSlot.id, kind: "storage", builtAt: "" },
  { id: buildable[1].id, kind: "storage", builtAt: "" },
);
const colliderRoom = { id: farmSlot.id, kind: "collider", builtAt: "" };

checkTrue(
  "вторая комната того же вида дороже",
  colonyBuild.getRoomCost(twoStorages, "storage") >
    colonyBuild.getRoomCost(oneStorage, "storage"),
);
check(
  "снос возвращает цену на шаг назад",
  colonyBuild.getRoomCostAfterDemolish(twoStorages, twoStorages.rooms[0]),
  colonyBuild.getRoomCost(oneStorage, "storage"),
);
check(
  "у единственной комнаты цена не меняется",
  colonyBuild.getRoomCostAfterDemolish(
    colonyWith(colliderRoom),
    colliderRoom,
  ),
  colonyBuild.getRoomCost(colonyWith(colliderRoom), "collider"),
);

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   • ${item}`));
  process.exit(1);
}

console.log("✅ Все проверки роста карты прошли");



