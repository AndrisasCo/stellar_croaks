import { getGameState } from "../backend/localStorage";
import {
  getPowerGrid,
  resolveColonyRooms,
} from "../components/HexMap/colony-build";
import { getRoomToadLists } from "../components/HexMap/room-toad-lists";
import { EMPTY_COLONY } from "../models/colony";
import { Items } from "../models/user";

/**
 * Склад предметов (Часть 3.7). Жаб на складе больше нет: у каждой жабы есть биопод
 * (`homeId` — дом жабы, см. `utils/toad-location.ts`), а склад — это только полки под
 * предметы: корм, батарейки, пигменты, генная пыль, мушки, черви и лутбоксы.
 *
 * Вместимость склада растёт постройками «Склад» на гексагональной карте колонии:
 * каждая даёт `STORAGE_CAPACITY_PER_ROOM` единиц сверх базовой вместимости колонии.
 * Бонус даёт только склад под током: обесточенная постройка остаётся на карте, но полок
 * не добавляет (энергосеть считается теми же формулами, что и карта, — `colony-build.ts`).
 */

/** Базовая вместимость склада — есть у колонии с самого начала игры */
export const BASE_STORAGE_CAPACITY = 100;
/** Прибавка к вместимости за каждый построенный сектор «Склад» под током */
export const STORAGE_CAPACITY_PER_ROOM = 300;

/**
 * Цифровые ресурсы: лежат на складе, но полки не занимают.
 *
 * Пропуск КОНТУРа выдаётся автоматически за каждый завершённый поход, поэтому
 * он не должен упираться в переполненный склад и отнимать место у обычной добычи.
 */
const STORAGE_CAPACITY_EXEMPT: ReadonlySet<Items> = new Set([Items.contourPass]);

/** Шкала вместимости склада для интерфейса */
export interface StorageCapacity {
  /** Сколько единиц предметов уже лежит на складе */
  used: number;
  /** Сколько всего влезает */
  capacity: number;
  /** Сколько ещё влезет */
  free: number;
  /** Сколько секторов «Склад» построено в колонии */
  rooms: number;
  /** Сколько из них под током — только эти склады дают полки */
  poweredRooms: number;
  /** Сколько складов обесточено и бонуса к хранению не даёт */
  unpoweredRooms: number;
}

/** Сколько секторов «Склад» построено на карте колонии */
export const getStorageRoomCount = (): number =>
  (getGameState().colony?.rooms ?? []).filter((room) => room.kind === "storage")
    .length;

/**
 * Сколько складов реально дают полки: постройка стоит и под током.
 *
 * Энергосеть собираем теми же чистыми формулами, что и карта колонии
 * (`colony-build.ts` → `resolveColonyRooms`, `getPowerGrid`), поэтому бонус к хранению
 * сходится с тем, что игрок видит на гексах: обесточенный склад не работает.
 */
export const getPoweredStorageRoomCount = (): number => {
  const state = getGameState();
  const colony = state.colony?.rooms ? state.colony : EMPTY_COLONY;

  // Складов нет — энергосеть не собираем: это самый частый случай в начале игры.
  if (!colony.rooms.some((room) => room.kind === "storage")) {
    return 0;
  }

  const rooms = resolveColonyRooms(colony, state.scenes);
  const toadsByRoom = getRoomToadLists(rooms, state.toads);
  const powerGrid = getPowerGrid(rooms, toadsByRoom, state.expeditions ?? []);

  return rooms.filter(
    (room) => room.kind === "storage" && powerGrid.powered[room.id] === true,
  ).length;
};

/** Полная вместимость склада: базовая плюс полки складов под током */
export const getStorageCapacity = (): number =>
  BASE_STORAGE_CAPACITY +
  getPoweredStorageRoomCount() * STORAGE_CAPACITY_PER_ROOM;

/** Сколько единиц предметов лежит на складе (цифровые пропуска полки не занимают) */
export const getStorageUsed = (
  storage: Partial<Record<Items, number>> = {},
): number =>
  Object.values(Items).reduce(
    (sum, key) =>
      STORAGE_CAPACITY_EXEMPT.has(key)
        ? sum
        : sum + Math.max(0, Math.floor(storage[key] ?? 0)),
    0,
  );

/**
 * Шкала склада: занято, вместимость, свободно, а также сколько складов построено,
 * сколько из них под током и сколько обесточено.
 */
export const getStorageCapacityInfo = (
  storage: Partial<Record<Items, number>> = getGameState().user.storage,
): StorageCapacity => {
  const rooms = getStorageRoomCount();
  const poweredRooms = getPoweredStorageRoomCount();
  const capacity =
    BASE_STORAGE_CAPACITY + poweredRooms * STORAGE_CAPACITY_PER_ROOM;
  const used = getStorageUsed(storage);

  return {
    used,
    capacity,
    free: Math.max(0, capacity - used),
    rooms,
    poweredRooms,
    unpoweredRooms: Math.max(0, rooms - poweredRooms),
  };
};

/**
 * Сколько предметов из пачки реально влезет на склад.
 * Возвращает только те ключи, для которых нашлось место: остальное игрок теряет
 * (добыча/покупка обрезается), поэтому вызывающий код обязан сказать об этом игроку.
 */
export const fitItemsInStorage = (
  storage: Partial<Record<Items, number>>,
  delta: Partial<Record<Items, number>>,
): Partial<Record<Items, number>> => {
  let free = getStorageCapacityInfo(storage).free;
  const accepted: Partial<Record<Items, number>> = {};

  Object.entries(delta).forEach(([key, amount]) => {
    const wanted = Math.max(0, Math.floor(amount || 0));

    if (wanted === 0) {
      return;
    }

    // Цифровой ресурс не занимает полку: он всегда помещается целиком.
    if (STORAGE_CAPACITY_EXEMPT.has(key as Items)) {
      accepted[key as Items] = wanted;
      return;
    }

    if (free <= 0) {
      return;
    }

    const stored = Math.min(wanted, free);
    accepted[key as Items] = stored;
    free -= stored;
  });

  return accepted;
};

/** Хватает ли на складе места на всю пачку предметов */
export const canFitInStorage = (
  storage: Partial<Record<Items, number>>,
  delta: Partial<Record<Items, number>>,
): boolean => {
  const wanted = Object.entries(delta).reduce(
    (sum, [key, amount]) =>
      STORAGE_CAPACITY_EXEMPT.has(key as Items)
        ? sum
        : sum + Math.max(0, Math.floor(amount || 0)),
    0,
  );

  return wanted <= getStorageCapacityInfo(storage).free;
};
