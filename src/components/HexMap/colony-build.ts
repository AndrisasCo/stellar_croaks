import { Toad } from "../../models/Toad";
import { ColonyRoomKind, ColonyState } from "../../models/colony";
import { hexCoordKey, hexNeighbors } from "./hex-geometry";
import {
  computePowerGrid,
  getSourceCapacity,
  PowerGrid,
  PowerNode,
} from "./colony-power";
import {
  createColonyRoom,
  HEX_ROOMS,
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
 *    гекс колонии (кольца 1–2), ядро в центре занято с начала игры;
 *  - коллайдер, магазин и диссоциатор — единственные в колонии: второй такой не поставить;
 *  - остальные комнаты строятся сколько угодно раз, каждая следующая дороже;
 *  - сразу после постройки комната обесточена — ток появится, когда рядом окажется ядро
 *    или энергокомната ⚡ с кормлёнными жабами.
 *
 * Логика чистая: состояние колонии и жабы приходят аргументами.
 */

/**
 * Требовать ли построенную комнату по соседству, чтобы застроить слот.
 * По дизайну — нет: «на любом гексе можно построить любую комнату». Флаг оставлен,
 * чтобы вернуть старое правило одной строкой (ветка ниже жива и покрыта тестом).
 */
export const BUILD_REQUIRES_NEIGHBOUR = false;

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

/** Карта колонии: базовые комнаты плюс всё, что игрок возвёл сам. */
export const resolveColonyRooms = (colony: ColonyState): RoomConfig[] => {
  const rooms = HEX_ROOMS.map((room) => {
    const built = colony.rooms.find((item) => item.id === room.id);

    // Слот застроили — на карте стоит комната того вида, который выбрал игрок
    return built ? createColonyRoom(room, built.kind) : room;
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
 * Считается на «виртуальной» карте, где комнату уже построили.
 */
export const willBePoweredAfterBuild = (
  slot: RoomConfig,
  kind: ColonyRoomKind,
  colony: ColonyState,
  toadsByRoom: Record<string, Toad[]>,
): boolean => {
  const nextColony: ColonyState = {
    rooms: [...colony.rooms, { id: slot.id, kind, builtAt: "" }],
  };

  return (
    getPowerGrid(resolveColonyRooms(nextColony), toadsByRoom).powered[
      slot.id
    ] === true
  );
};
