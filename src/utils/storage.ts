import { getGameState } from "../backend/localStorage";
import { Items } from "../models/user";

/**
 * Склад предметов (Часть 3.7). Жаб на складе больше нет: у каждой жабы есть вольер
 * (`scene_id`), а склад — это только полки под предметы: корм, батарейки, пигменты,
 * пыль, мушки, черви и лутбоксы.
 *
 * Вместимость склада растёт постройками «Склад» на гексагональной карте колонии:
 * каждая даёт `STORAGE_CAPACITY_PER_ROOM` единиц сверх базовой вместимости колонии.
 */

/** Базовая вместимость склада — есть у колонии с самого начала игры */
export const BASE_STORAGE_CAPACITY = 100;
/** Прибавка к вместимости за каждую построенную комнату «Склад» */
export const STORAGE_CAPACITY_PER_ROOM = 300;

/** Шкала вместимости склада для интерфейса */
export interface StorageCapacity {
  /** Сколько единиц предметов уже лежит на складе */
  used: number;
  /** Сколько всего влезает */
  capacity: number;
  /** Сколько ещё влезет */
  free: number;
  /** Сколько комнат «Склад» построено в колонии */
  rooms: number;
}

/** Сколько комнат «Склад» построено на карте колонии */
export const getStorageRoomCount = (): number =>
  (getGameState().colony?.rooms ?? []).filter((room) => room.kind === "storage")
    .length;

/** Полная вместимость склада: базовая плюс полки построенных складов */
export const getStorageCapacity = (): number =>
  BASE_STORAGE_CAPACITY +
  getStorageRoomCount() * STORAGE_CAPACITY_PER_ROOM;

/** Сколько единиц предметов лежит на складе (считаем по всем видам предметов) */
export const getStorageUsed = (
  storage: Partial<Record<Items, number>> = {},
): number =>
  Object.values(Items).reduce(
    (sum, key) => sum + Math.max(0, Math.floor(storage[key] ?? 0)),
    0,
  );

/** Шкала склада: занято, вместимость, свободно и число построенных складов */
export const getStorageCapacityInfo = (
  storage: Partial<Record<Items, number>> = getGameState().user.storage,
): StorageCapacity => {
  const capacity = getStorageCapacity();
  const used = getStorageUsed(storage);

  return {
    used,
    capacity,
    free: Math.max(0, capacity - used),
    rooms: getStorageRoomCount(),
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

    if (wanted === 0 || free <= 0) {
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
  const wanted = Object.values(delta).reduce(
    (sum, amount) => sum + Math.max(0, Math.floor(amount || 0)),
    0,
  );

  return wanted <= getStorageCapacityInfo(storage).free;
};
