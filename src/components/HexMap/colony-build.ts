import { Toad } from "../../models/Toad";
import { ColonyRoomKind, ColonyState } from "../../models/colony";
import { Scene } from "../../models/scene";
import { hexCoordKey, hexNeighbors } from "./hex-geometry";
import {
  computePowerGrid,
  getSourceCapacity,
  PowerGrid,
  PowerNode,
} from "./colony-power";
import {
  createColonyRoom,
  getUnlockedRooms,
  isBuiltRoom,
  ROOM_BLUEPRINT_ORDER,
  ROOM_BLUEPRINTS,
  RoomConfig,
} from "./rooms-config";

/**
 * Постройки колонии: что можно возвести, сколько это стоит и как выглядит карта после застройки.
 *
 * Правила застройки:
 *  - вид комнаты к гексу не привязан: любую комнату можно поставить на любой свободный
 *    гекс колонии, ядро в центре занято с начала игры; карта растёт фронтом — у новой
 *    постройки открываются все шесть соседних гексов (см. `getUnlockedRooms`);
 *  - слот под застройку стоит только рядом с построенной комнатой (`BUILD_REQUIRES_NEIGHBOUR`):
 *    так его открывает фронт застройки, и гексов «в пустоте» на карте не бывает;
 *  - коллайдер, магазин и диссоциатор — единственные в колонии: второй такой не поставить;
 *  - остальные комнаты строятся сколько угодно раз, каждая следующая дороже;
 *  - сразу после постройки комната обесточена — ток появится, когда рядом окажется ядро
 *    или энергокомната ⚡ с кормлёнными жабами (самой ⚡ внешнее питание не нужно:
 *    её ток — собственные жабы).
 *
 * Логика чистая: состояние колонии и жабы приходят аргументами.
 */

/**
 * Требовать ли построенную комнату по соседству, чтобы застроить слот.
 *
 * Правило включено: слот под застройку стоит только рядом с построенной комнатой — так его
 * открывает фронт застройки (`rooms-config.ts` → `getUnlockedRooms`), поэтому проверка лишь
 * страхует карту: чужой сейв или будущая правка базовых гексов не сделают из открытого гекса
 * «слот в пустоте», по которому нельзя строить.
 */
export const BUILD_REQUIRES_NEIGHBOUR = true;

export interface BuildOption {
  kind: ColonyRoomKind;
  title: string;
  icon: string;
  description: string;
  /** Комната строится в единственном экземпляре — второй такой в колонии не будет. */
  unique: boolean;
  /** Цена в Кваксах с учётом уже построенных комнат этого вида. */
  getCost: (colony: ColonyState) => number;
}

/** Сколько комнат этого вида игрок уже построил. */
export const getBuiltRoomsCount = (
  colony: ColonyState,
  kind: ColonyRoomKind,
): number => colony.rooms.filter((room) => room.kind === kind).length;

/** Стоит ли в колонии хотя бы одна комната этого вида. */
export const isRoomKindBuilt = (
  colony: ColonyState,
  kind: ColonyRoomKind,
): boolean => getBuiltRoomsCount(colony, kind) > 0;

/**
 * Цена комнаты: первая — по базовой цене черновика, каждая следующая дороже в `costGrowth` раз.
 * У единственных комнат рост равен 1, поэтому цена у них всегда базовая.
 */
export const getRoomCost = (
  colony: ColonyState,
  kind: ColonyRoomKind,
): number => {
  const blueprint = ROOM_BLUEPRINTS[kind];

  return Math.round(
    blueprint.baseCost *
      Math.pow(blueprint.costGrowth, getBuiltRoomsCount(colony, kind)),
  );
};

/** Можно ли строить комнату этого вида: единственную — только пока её в колонии нет. */
export const canBuildRoomKind = (
  colony: ColonyState,
  kind: ColonyRoomKind,
): boolean => !ROOM_BLUEPRINTS[kind].unique || !isRoomKindBuilt(colony, kind);

/**
 * Цена следующей комнаты того же вида ПОСЛЕ сноса этой — то, что игрок увидит в окне
 * подтверждения.
 *
 * Цена считается по числу построенных (`getRoomCost`), поэтому снос возвращает её на шаг
 * назад: у комнат с ростом цены следующая такая станет дешевле ровно на этот шаг. У базовых
 * комнат (вольер и гнездо стоят с начала игры и в счёте построенных не участвуют) и у
 * единственных (рост = 1) цена не меняется — вернётся та же.
 */
export const getRoomCostAfterDemolish = (
  colony: ColonyState,
  room: { id: string; kind: ColonyRoomKind },
): number =>
  getRoomCost(
    { ...colony, rooms: colony.rooms.filter((item) => item.id !== room.id) },
    room.kind,
  );

/**
 * Почему комнату нельзя снести прямо сейчас (`null` — можно).
 *
 * Правила сноса:
 *  - **ядро не сносят** — это сердце колонии, карта держится на нём;
 *  - **пустой гекс сносить нечего**;
 *  - **жаб не выселяют силой**: комната с жабами внутри (или жильцами своего вольера) ждёт,
 *    пока игрок сам перенесёт их — дом жабы не должен пропадать из-под неё.
 *
 * Жабы комнаты приходят аргументом (тот же список, что карта рисует на гексе,
 * `HexMap/room-toad-lists.ts` → `getRoomToadLists`): правило «в комнате есть жабы» должно
 * сходиться с тем, что игрок видит на гексе.
 */
export const getRoomDemolishIssue = (
  room: RoomConfig,
  roomToads: Toad[],
): string | null => {
  if (room.kind === "core") {
    return "Ядро — сердце колонии: его не сносят.";
  }

  if (!isBuiltRoom(room)) {
    return "На этом гексе ничего не построено.";
  }

  if (roomToads.length > 0) {
    return `В комнате ${roomToads.length} 🐸 — сначала переселите их в вольер.`;
  }

  return null;
};

/** Можно ли снести комнату сейчас: причина найдена — нельзя (`getRoomDemolishIssue`). */
export const canDemolishRoom = (room: RoomConfig, roomToads: Toad[]): boolean =>
  getRoomDemolishIssue(room, roomToads) === null;

/** Каталог построек для меню застройки (порядок карточек — ROOM_BLUEPRINT_ORDER). */
export const BUILD_OPTIONS: BuildOption[] = ROOM_BLUEPRINT_ORDER.map((kind) => {
  const blueprint = ROOM_BLUEPRINTS[kind];

  return {
    kind,
    title: blueprint.title,
    icon: blueprint.icon,
    description: blueprint.description,
    unique: blueprint.unique,
    getCost: (colony: ColonyState) => getRoomCost(colony, kind),
  };
});

/**
 * Карта колонии: базовые комнаты плюс всё, что игрок возвёл сам.
 *
 * Открытые гексы считает `getUnlockedRooms`: к базовой карте добавляется фронт застройки —
 * все шесть соседних гексов у каждой постройки. Поэтому застройка расширяет карту не
 * кольцом, а локально, вокруг новой комнаты, и медовая сетка территории обступает колонию
 * по её форме (см. `HexMapCanvas` → `drawBackdrop`).
 *
 * Снесённые комнаты (`ColonyState.demolished`) остаются на карте свободными слотами:
 * у клетки пропадает комната, но не гекс — снос не сжимает открытую территорию
 * (`getUnlockedRooms`).
 */
export const resolveColonyRooms = (
  colony: ColonyState,
  scenes: Scene[] = [],
): RoomConfig[] => {
  /**
   * Вольеры карты: постройка-вольер помнит свой вольер (`ColonyRoomState.sceneId`),
   * а базовому гексу «Вольер» достаётся вольер, который не заняла ни одна постройка, —
   * так у каждого гекса-вольера есть свой `Scene` и он показывает своих жильцов.
   * Мирные вызовы (прогноз тока, проверки) сцены не передают — тогда вольеры стоят без
   * вольера: их жильцы не рисуются, но и не мешают (ток от вольера не зависит).
   */
  const claimedScenes = new Set(
    colony.rooms
      .map((room) => room.sceneId)
      .filter((sceneId): sceneId is number => sceneId !== undefined),
  );
  const freeScene = scenes.find((scene) => !claimedScenes.has(scene.id));
  const rooms = getUnlockedRooms(colony.rooms, colony.demolished).map((room) => {
    const built = colony.rooms.find((item) => item.id === room.id);

    // Слот застроили — на карте стоит комната того вида, который выбрал игрок
    if (!built) {
      // Базовый гекс «Вольер»: его вольер — свободный `Scene` (сейвы строек помнят свои)
      return room.kind === "aviary" && freeScene
        ? { ...room, sceneId: freeScene.id }
        : room;
    }

    return createColonyRoom(room, built.kind, built.sceneId);
  });

  // Свободные гексы, доступные под застройку, помечаем плюсом — их видно на карте
  return rooms.map((room) =>
    canBuildOnSlot(room, rooms) ? { ...room, icon: room.icon || "+" } : room,
  );
};

/** Можно ли застроить слот: свободный гекс колонии (ядро и постройки заняты). */
export const canBuildOnSlot = (
  slot: RoomConfig,
  rooms: RoomConfig[],
): boolean => {
  if (isBuiltRoom(slot)) {
    return false;
  }

  if (!BUILD_REQUIRES_NEIGHBOUR) {
    return true;
  }

  const builtCoords = new Set(
    rooms.filter(isBuiltRoom).map((room) => hexCoordKey(room.coord)),
  );

  return hexNeighbors(slot.coord).some((coord) =>
    builtCoords.has(hexCoordKey(coord)),
  );
};

/** Слоты, доступные под застройку (свободные гексы колонии). */
export const getBuildableSlots = (rooms: RoomConfig[]): RoomConfig[] =>
  rooms.filter((room) => canBuildOnSlot(room, rooms));

/** Узлы энергосети: каждая построенная комната со своей мощностью. */
export const getPowerNodes = (
  rooms: RoomConfig[],
  toadsByRoom: Record<string, Toad[]>,
): PowerNode[] =>
  rooms.filter(isBuiltRoom).map((room) => ({
    id: room.id,
    coord: room.coord,
    kind: room.kind,
    capacity: getSourceCapacity(room.kind, toadsByRoom[room.id] ?? []),
  }));

/** Энергосеть колонии: у каждой построенной комнаты видно, есть ли ток. */
export const getPowerGrid = (
  rooms: RoomConfig[],
  toadsByRoom: Record<string, Toad[]>,
): PowerGrid => computePowerGrid(getPowerNodes(rooms, toadsByRoom));

/** Есть ли в комнате ток (непостроенным слотам ток не нужен). */
export const isRoomPowered = (room: RoomConfig, grid: PowerGrid): boolean =>
  !isBuiltRoom(room) || grid.powered[room.id] === true;

/** Сколько единиц тока даёт комната соседям прямо сейчас. */
export const getRoomPowerOutput = (room: RoomConfig, toads: Toad[]): number =>
  getSourceCapacity(room.kind, toads);

/** Комната карты, стоящая рядом с указанной (соседи по гексам). */
export const getRoomNeighbours = (
  room: RoomConfig,
  rooms: RoomConfig[],
): RoomConfig[] => {
  const neighbours = new Set(
    hexNeighbors(room.coord).map((coord) => hexCoordKey(coord)),
  );

  return rooms.filter(
    (candidate) =>
      candidate.id !== room.id && neighbours.has(hexCoordKey(candidate.coord)),
  );
};

/**
 * Прогноз для меню застройки: будет ли ток у комнаты сразу после постройки.
 * Считается на «виртуальной» карте, где комнату уже построили. Гекс мог быть снесён раньше
 * (`demolished`) — застройка снимает с него метку сноса, как и настоящая постройка
 * (`backend/colony.ts` → `buildColonyRoom`): иначе виртуальная карта считала бы его пустым.
 */
export const willBePoweredAfterBuild = (
  slot: RoomConfig,
  kind: ColonyRoomKind,
  colony: ColonyState,
  toadsByRoom: Record<string, Toad[]>,
): boolean => {
  const nextColony: ColonyState = {
    ...colony,
    rooms: [...colony.rooms, { id: slot.id, kind, builtAt: "" }],
    demolished: colony.demolished?.filter((id) => id !== slot.id),
  };

  return (
    getPowerGrid(resolveColonyRooms(nextColony), toadsByRoom).powered[
      slot.id
    ] === true
  );
};
