import {
  updateToadStateByIds,
  updateUser,
} from "../backend";
import { getRoomUpgrades } from "../backend/colony";
import { getGameState } from "../backend/localStorage";
import { recordQuestEvent } from "../backend/quests-manager";
import { Toad } from "../models/Toad";
import { toTimestamp } from "./date";
import { isToadBusyOnExpedition } from "./expedition-manager";
import { PRODUCTION_MIN_HUNGER } from "./gamification-config";
import { isUpgradeActive } from "./room-upgrades";
import { getGrowthStartedAt, startToadGrowth } from "./toad-growth";

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

export interface AutoFeedOptions {
  /**
   * Момент последнего сейва (когда игра закрылась). Головастик с `created_at`
   * позже него родился в оффлайне: кормушка накормила бы его сразу после родов,
   * поэтому таймер роста ставим на время рождения, а не на вход в игру.
   * Игровой тик это поле не передаёт — там рост стартует с момента кормления.
   */
  newbornSince?: number | null;
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
  options: AutoFeedOptions = {},
): AutoFeedResult => {
  // Выключенная автокормушка остаётся купленной, но не кормит: переключатель живёт
  // в тех же `RoomUpgrades` (`utils/room-upgrades.ts` → `isUpgradeActive`).
  const autoFeederRooms = rooms.filter((room) =>
    isUpgradeActive(getRoomUpgrades(room), "autoFeeder"),
  );

  if (autoFeederRooms.length === 0) {
    return { fed: 0, spent: 0 };
  }

  const state = getGameState();
  const foodOnStack = state.user.storage?.food ?? 0;
  const expeditions = state.expeditions ?? [];
  const now = Date.now();
  // Корм кончился — дальше кормить нечем; жабы в походе дома не едят, а вернувшиеся
  // ждут разбора добычи и до него тоже считаются занятыми (`isToadBusyOnExpedition`)
  let foodLeft = Math.floor(foodOnStack);
  const hungry: number[] = [];
  /** Когда запускать таймер роста: время рождения (оффлайн-роды) → id головастиков */
  const growthStarts = new Map<number, number[]>();

  autoFeederRooms.forEach((room) => {
    (toadsByRoom[room.id] ?? []).forEach((toad) => {
      if (foodLeft <= 0 || isToadBusyOnExpedition(toad, expeditions)) {
        return;
      }

      if ((toad.state?.hunger ?? 0) > AUTO_FEED_HUNGER) {
        return;
      }

      foodLeft -= AUTO_FEED_COST;
      hungry.push(toad.id);

      // Первое кормление запускает таймер роста головастика (`utils/toad-growth.ts`).
      if (toad.stage === "toadpole" && getGrowthStartedAt(toad) == null) {
        const bornAt = toTimestamp(toad.created_at);
        // Роды пришлись на оффлайн-окно (`endPregnancy` пишет в `created_at`
        // реальное время родов): кормушка накормила бы головастика сразу, поэтому
        // он растёт с рождения. Голодающий головастик из прошлой сессии получает
        // таймер от этого кормления — корм появился у игрока только сейчас.
        const startedAt =
          bornAt != null &&
          options.newbornSince != null &&
          bornAt >= options.newbornSince &&
          bornAt <= now
            ? bornAt
            : now;
        const ids = growthStarts.get(startedAt) ?? [];

        ids.push(toad.id);
        growthStarts.set(startedAt, ids);
      }
    });
  });

  if (hungry.length === 0) {
    return { fed: 0, spent: 0 };
  }

  const spent = hungry.length * AUTO_FEED_COST;

  updateToadStateByIds(hungry, { hunger: 100 });

  growthStarts.forEach((ids, startedAt) => startToadGrowth(ids, startedAt));

  updateUser({
    storage: { ...state.user.storage, food: foodOnStack - spent },
  });

  // Кормушка реально накормила жаб, значит это тот же прогресс, что и ручное
  // кормление: журнал не должен «не замечать» целый апгрейд.
  recordQuestEvent("toad_fed", hungry.length);

  return { fed: hungry.length, spent };
};
