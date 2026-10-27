import type { Toad } from "../models/Toad";
import { HOUR_MS, MINUTE_MS, toTimestamp } from "./date";

/**
 * Беременность жабы: один расчёт срока на все места, где он нужен.
 *
 * Раньше формулу считали трижды и по-разному: тик родов — в часах
 * (`getHoursFromNow`), карточка жабы — в мс, астро-магазин — «остаток пополам».
 * Здесь она одна: тик берёт `isDue`, интерфейс — `progress` и `timeLeft`.
 */

/** Беременность из сейва (поле `Toad.pregnancy` без `null`) */
export type ToadPregnancy = NonNullable<Toad["pregnancy"]>;

/**
 * Момент родов (мс) или `null`, если запись битая.
 *
 * `pregnancyDuration` хранится в часах, `pregnancyStart` — мс; старые сейвы могли
 * положить туда ISO-строку, поэтому дату разбирает `toTimestamp`.
 */
export const getPregnancyDueAt = (
  pregnancy: ToadPregnancy,
): number | null => {
  const startedAt = toTimestamp(pregnancy.pregnancyStart);
  const durationHours = Number(pregnancy.pregnancyDuration);

  if (startedAt == null || !Number.isFinite(durationHours) || durationHours < 0) {
    return null;
  }

  return startedAt + durationHours * HOUR_MS;
};

export interface PregnancyInfo {
  /** Прогресс беременности, 0–100 */
  progress: number;
  /** Минут до родов; 0 — срок уже вышел */
  timeLeft: number;
  /** Срок вышел: пора рожать */
  isDue: boolean;
}

/**
 * Таймер беременности (мс) для тика родов, карточки жабы и ускорения.
 *
 * Битый срок (нет даты или длительности) считается вышедшим: беременность не
 * должна зависнуть навсегда — роды доиграет ближайший тик, а `endPregnancy`
 * поставит детям реальное время (сейчас).
 */
export const getPregnancyInfo = (
  toad: Pick<Toad, "pregnancy">,
  now = Date.now(),
): PregnancyInfo | null => {
  const pregnancy = toad.pregnancy;

  if (!pregnancy?.isPregnant) {
    return null;
  }

  const dueAt = getPregnancyDueAt(pregnancy);

  if (dueAt == null) {
    return { progress: 100, timeLeft: 0, isDue: true };
  }

  const startedAt = toTimestamp(pregnancy.pregnancyStart) ?? now;
  const durationMs = Math.max(0, dueAt - startedAt);
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, dueAt - now);

  return {
    progress:
      durationMs === 0
        ? 100
        : Math.min((elapsedMs / durationMs) * 100, 100),
    timeLeft: Math.ceil(remainingMs / MINUTE_MS),
    isDue: remainingMs === 0,
  };
};
