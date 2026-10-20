import {
  updateToadStateByIds,
  updateToadsByIds,
  updateUser,
} from "../backend";
import { getRoomUpgrades } from "../backend/colony";
import { getGameState } from "../backend/localStorage";
import { Toad } from "../models/Toad";
import { isToadBusyOnExpedition } from "./expedition-manager";
import { PRODUCTION_MIN_HUNGER } from "./gamification-config";

/**
 * Автокормушка — апгрейд жилого сектора (`ColonyState.upgrades`, покупка — `utils/room-upgrades.ts`).
 *
 * Механика: пока на складе есть корм, кормушка сама кормит жаб сектора, когда голод доходит
 * до `AUTO_FEED_HUNGER` (20 %), и списывает корм со склада — один корм на жабу. Апгрейд стоит
 * у сектора, а не у биопода: кормятся и жильцы «Био Пода», и работяги ⚡-энергосектора.
 *
 * Тик идёт сразу после тика голода (оффлайн-догон и игровой цикл, см. `MainScreen`), поэтому
 * видит уже просевший голод. Корм кончился — жабы просто остаются голодными: кормушка ничего
 * не «одалживает», а ждёт пополнения склада.
 */

/**
 * Голод, при котором кормушка кормит жабу, %.
 * Держим равным порогу выработки биомассы (`PRODUCTION_MIN_HUNGER`): именно на нём жаба
 * переходит на голодный минимум (`PRODUCTION_HUNGRY_FACTOR`), поэтому кормушка включается
 * ровно в тот момент, когда жаба начала работать вполсилы, — и возвращает её к полной норме.
 */
export const AUTO_FEED_HUNGER = PRODUCTION_MIN_HUNGER;
/** Сколько корма уходит на одну жабу */
export const AUTO_FEED_COST = 1;

/** Гекс-сектор, у которой может стоять апгрейд (структурно совпадает с `RoomConfig`). */
export interface AutoFeedRoom {
  id: string;
  sceneId?: number | null;
}

export interface AutoFeedResult {
  /** Сколько жаб покормили */
  fed: number;
  /** Сколько корма ушло со склада */
  spent: number;
}

/**
 * Кормит жаб секторов с автокормушкой и списывает корм со склада.
 *
 * `rooms` и `toadsByRoom` передаёт вызывающий: кто живёт в каком секторе, знает карта
 * (`getRoomToadLists`), а не состояние игры — жильцов ищут по их месту в секторе
 * (`scene_id`), а не по дому (`homeId`).
 */
export const processAutoFeeders = (
  rooms: AutoFeedRoom[],
  toadsByRoom: Record<string, Toad[]>,
): AutoFeedResult => {
  const autoFeederRooms = rooms.filter(
    (room) => getRoomUpgrades(room).autoFeeder,
  );

  if (autoFeederRooms.length === 0) {
    return { fed: 0, spent: 0 };
  }

  const state = getGameState();
  const foodOnStack = state.user.storage?.food ?? 0;
  const expeditions = state.expeditions ?? [];
  // Корм кончился — дальше кормить нечем; жабы в походе дома не едят, а вернувшиеся
  // ждут разбора добычи и до него тоже считаются занятыми (`isToadBusyOnExpedition`)
  let foodLeft = Math.floor(foodOnStack);
  const hungry: number[] = [];
  const growthStartIds: number[] = [];

  autoFeederRooms.forEach((room) => {
    (toadsByRoom[room.id] ?? []).forEach((toad) => {
      if (foodLeft <= 0 || isToadBusyOnExpedition(toad, expeditions)) {
        return;
      }

      if (toad.state.hunger > AUTO_FEED_HUNGER) {
        return;
      }

      foodLeft -= AUTO_FEED_COST;
      hungry.push(toad.id);

      // Первое кормление запускает таймер роста головастика.
      if (toad.stage === "toadpole" && toad.growthStartedAt == null) {
        growthStartIds.push(toad.id);
      }
    });
  });

  if (hungry.length === 0) {
    return { fed: 0, spent: 0 };
  }

  const spent = hungry.length * AUTO_FEED_COST;

  updateToadStateByIds(hungry, { hunger: 100 });

  if (growthStartIds.length > 0) {
    updateToadsByIds(growthStartIds, { growthStartedAt: Date.now() });
  }

  updateUser({
    storage: { ...state.user.storage, food: foodOnStack - spent },
  });

  return { fed: hungry.length, spent };
};
