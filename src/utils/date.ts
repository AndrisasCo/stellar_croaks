/**
 * Время игры: всё, что считается от реальных часов, — оффлайн-догон, роды,
 * беременность, рост головастиков.
 *
 * Моменты приходят из сейва в двух видах: число мс (поля, которые пишет игра) и
 * ISO-строка (`created_at`, `lastSaved`, `pregnancyStart` старых сейвов). Разбор
 * даты живёт здесь один, чтобы каждый таймер не трактовал битую дату по-своему.
 */

/** Минута, час и сутки в миллисекундах — единицы всех таймеров игры */
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Игровой тик голода и фермы: 5 минут (интервалы `MainScreen`) */
export const GAME_TICK_MS = 5 * MINUTE_MS;
/** Тот же тик в часах: им меряются `processHunger` и `processProduction` */
export const GAME_TICK_HOURS = GAME_TICK_MS / HOUR_MS;

/**
 * Потолок оффлайн-догона: дольше 90 часов игра время не считает.
 *
 * Защита от сейва, открытого через месяцы: голод, ферма и энергия не должны
 * «списывать» всё отсутствие целиком — иначе колония возвращается мёртвой.
 */
export const MAX_OFFLINE_HOURS = 90;

/**
 * Момент в миллисекундах из `Date`, числа мс или ISO-строки.
 * `null` — даты нет или она битая (в сейв мог попасть мусор).
 */
export const toTimestamp = (
  moment: string | number | Date | null | undefined,
): number | null => {
  if (moment == null) {
    return null;
  }

  const ms =
    moment instanceof Date
      ? moment.getTime()
      : typeof moment === "number"
        ? moment
        : new Date(moment).getTime();

  return Number.isFinite(ms) ? ms : null;
};

/**
 * Сколько часов прошло с момента. Часы устройства, ушедшие назад, не дают
 * отрицательного времени: таймер просто стоит на нуле, а не «отматывается».
 */
export const hoursSince = (
  moment: string | number | Date,
  now = Date.now(),
): number => {
  const at = toTimestamp(moment);

  return at == null ? 0 : Math.max(0, (now - at) / HOUR_MS);
};

export interface OfflineTime {
  /** Часы отсутствия: 0…`MAX_OFFLINE_HOURS`, с точностью до сотых */
  hours: number;
  /**
   * Момент, когда игра закрылась (мс). Роды позже него случились в оффлайне —
   * по этой метке автокормушка ставит новорождённым таймер роста
   * (`utils/auto-feeder.ts`).
   */
  since: number;
}

/**
 * Сколько времени игра была закрыта.
 *
 * `lastSaved` — момент последнего настоящего сейва (игра пишет его при закрытии,
 * см. `backend/cloud-flush.ts`). Метки нет или она битая — считаем, что оффлайна
 * не было: догонять нечего.
 */
export const getOfflineTime = (
  lastSaved?: string | null,
  now = Date.now(),
): OfflineTime => {
  const savedAt = toTimestamp(lastSaved);
  const elapsedMs = savedAt == null ? 0 : Math.max(0, now - savedAt);

  return {
    hours: Math.min(
      Math.floor((elapsedMs / HOUR_MS) * 100) / 100,
      MAX_OFFLINE_HOURS,
    ),
    since: savedAt ?? now,
  };
};
