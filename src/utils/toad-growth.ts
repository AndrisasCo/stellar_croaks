import { HOURS_TO_GROW_UP } from "./gamification-config";
import { HOUR_MS, MINUTE_MS, toTimestamp } from "./date";
import { getHunger } from "./hunger";
import { updateToadsByIds } from "../backend";
import type { Toad } from "../models/Toad";

/**
 * Рост головастика.
 *
 * Таймер роста запускает **первое кормление** (`growthStartedAt`): новорождённый
 * появляется с `hunger: 0`, поэтому без кормления отсчёт вообще не начинается.
 * Дальше рост идёт по реальным часам и длится `HOURS_TO_GROW_UP`. Если запаса
 * сытости не хватает до конца, головастик «замирает» (`hungry`): его нужно
 * покормить, иначе он не повзрослеет.
 */

/** Сколько длится рост от первого кормления */
export const GROWTH_DURATION_MS = HOURS_TO_GROW_UP * HOUR_MS;

/**
 * Когда начался рост (мс) или `null`, если головастика ещё не кормили.
 * Битую метку старых сейвов считаем отсутствующей: таймер запустит кормление.
 */
export const getGrowthStartedAt = (
  toad: Pick<Toad, "growthStartedAt">,
): number | null => toTimestamp(toad.growthStartedAt ?? null);

export interface ToadGrowthInfo {
  /** Прогресс таймера роста, 0–100 */
  progress: number;
  /** Минут до конца роста; 0 — таймер уже вышел */
  timeLeft: number;
  /** Таймер роста вышел: головастик готов повзрослеть */
  isDue: boolean;
  /** Сколько сытости останется к концу роста */
  hungerAfterGrowth: number;
  /** Сытости не хватит: без кормления рост не завершится */
  hungry: boolean;
  /** Таймер ещё не запущен: головастика ещё не кормили */
  notStarted: boolean;
}

/**
 * Состояние роста головастика на момент `now`.
 *
 * Сытость считается только на **оставшиеся** часы роста: сколько головастик уже
 * прорастил, тот голод уже в его `state.hunger`. Раньше здесь брались все
 * `HOURS_TO_GROW_UP` — и почти выросший головастик выглядел голодным, а
 * предупреждение «покормите» появлялось на ровном месте.
 */
export const getToadGrowthInfo = (
  toad: Toad | null | undefined,
  now = Date.now(),
): ToadGrowthInfo | null => {
  if (!toad || toad.stage !== "toadpole") {
    return null;
  }

  const startedAt = getGrowthStartedAt(toad);
  const elapsedMs = startedAt == null ? 0 : Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, GROWTH_DURATION_MS - elapsedMs);
  const hungerAfterGrowth = getHunger(
    toad.state?.hunger ?? 0,
    toad.genes?.hungerRate ?? 1,
    remainingMs / HOUR_MS,
  );

  return {
    progress:
      startedAt == null
        ? 0
        : Math.min((elapsedMs / GROWTH_DURATION_MS) * 100, 100),
    timeLeft: Math.ceil(remainingMs / MINUTE_MS),
    isDue: startedAt != null && remainingMs === 0,
    hungerAfterGrowth,
    hungry: hungerAfterGrowth <= 0,
    notStarted: startedAt == null,
  };
};

/**
 * Кого покормили — тому и старт роста: головастики, у которых таймера ещё нет.
 * Одно правило и для ручного кормления, и для автокормушки.
 */
export const getGrowthStartIds = (toads: Toad[]): number[] =>
  toads
    .filter(
      (toad) => toad.stage === "toadpole" && getGrowthStartedAt(toad) == null,
    )
    .map((toad) => toad.id);

/**
 * Записать старт роста. `startedAt` — момент кормления; у головастика, которого
 * накормила автокормушка сразу после оффлайн-родов, это время рождения, а не
 * входа в игру (`utils/auto-feeder.ts`).
 */
export const startToadGrowth = (
  toadIds: number[],
  startedAt = Date.now(),
  keepLastSaved = false,
): void => {
  if (toadIds.length === 0) {
    return;
  }

  updateToadsByIds(toadIds, { growthStartedAt: startedAt }, keepLastSaved);
};

