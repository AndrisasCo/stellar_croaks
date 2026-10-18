import { HOURS_TO_GROW_UP, Toad } from "../models/Toad";
import { getHunger } from "./hunger";

/**
 * Состояние роста головастика.
 *
 * Таймер роста запускает первое кормление (`growthStartedAt`) и длится
 * `HOURS_TO_GROW_UP` часов. Новорождённый появляется с `hunger: 0`, поэтому
 * без кормления отсчёт вообще не начинается. Если головастик проголодался уже
 * во время роста, запаса сытости может не хватить до конца — тогда `hungry` = true,
 * и его нужно покормить, иначе он не повзрослеет.
 */
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

export const getToadGrowthInfo = (
  toad: Toad | null | undefined,
  now = Date.now()
): ToadGrowthInfo | null => {
  if (!toad || toad.stage !== "toadpole") {
    return null;
  }

  const durationMs = HOURS_TO_GROW_UP * 60 * 60 * 1000;
  const startedAt =
    typeof toad.growthStartedAt === "number" ? toad.growthStartedAt : null;
  const elapsedMs = startedAt == null ? 0 : now - startedAt;
  const hungerAfterGrowth = getHunger(
    toad.state?.hunger ?? 0,
    toad.genes?.hungerRate ?? 1,
    HOURS_TO_GROW_UP
  );

  return {
    progress:
      startedAt == null
        ? 0
        : Math.min((elapsedMs / durationMs) * 100, 100),
    timeLeft:
      startedAt == null
        ? HOURS_TO_GROW_UP * 60
        : Math.max(Math.ceil((durationMs - elapsedMs) / 60000), 0),
    isDue: startedAt != null && elapsedMs >= durationMs,
    hungerAfterGrowth,
    hungry: hungerAfterGrowth <= 0,
    notStarted: startedAt == null,
  };
};
