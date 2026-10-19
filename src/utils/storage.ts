import { getGameState } from "../backend/localStorage";
import { Items } from "../models/user";

/**
 * Склад предметов (Часть 3.7). Жаб на складе больше нет: у каждой жабы есть биопод
 * (`homeId` — дом жабы, см. `utils/toad-location.ts`), а склад — это только полки под
 * предметы: корм, батарейки, пигменты, пыль, мушки, черви и лутбоксы.
 *
 * Вместимость склада растёт постройками «Склад» на гексагональной карте колонии:
 * каждая даёт `STORAGE_CAPACITY_PER_ROOM` единиц сверх базовой вместимости колонии.
 */

/** Базовая вместимость склада — есть у колонии с самого начала игры */
export const BASE_STORAGE_CAPACITY = 100;
/** Прибавка к вместимости за каждую построенный сектор «Склад» */
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
}

/** Сколько секторов «Склад» построено на карте колонии */
export const getStorageRoomCount = (): number =>
  (getGameState().colony?.rooms ?? []).filter((room) => room.kind === "storage")
    .length;

/** Полная вместимость склада: базовая плюс полки построенных складов */
export const getStorageCapacity = (): number =>
  BASE_STORAGE_CAPACITY +
  getStorageRoomCount() * STORAGE_CAPACITY_PER_ROOM;

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
