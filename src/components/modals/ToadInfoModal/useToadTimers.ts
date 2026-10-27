import { DAY_MS, toTimestamp } from "../../../utils/date";
import { getPregnancyInfo } from "../../../utils/pregnancy";
import { getToadGrowthInfo } from "../../../utils/toad-growth";

/**
 * Таймеры карточки жабы: возраст, беременность и рост головастика.
 *
 * Формулы берутся из общих модулей (`utils/pregnancy.ts`, `utils/toad-growth.ts`),
 * а не считаются здесь заново: иначе карточка и игровой тик показывали бы разное
 * время до родов и до взросления.
 */
export const useToadTimers = (toad: any) => {
  const now = Date.now();

  /** Возраст в полных днях от `created_at` */
  const getAgeInDays = () => {
    const bornAt = toTimestamp(toad.created_at);

    return bornAt == null
      ? 0
      : Math.max(0, Math.floor((now - bornAt) / DAY_MS));
  };

  return {
    age: getAgeInDays(),
    pregnancy: getPregnancyInfo(toad, now),
    // `hungry` подсказывает, что головастика сначала нужно покормить
    growth: getToadGrowthInfo(toad, now),
  };
};
