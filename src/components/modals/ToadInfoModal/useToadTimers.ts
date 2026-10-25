import { getToadGrowthInfo } from "../../../utils/toad-growth";

export const useToadTimers = (toad: any) => {
  const calculateAge = () => {
    const diff = Date.now() - new Date(toad.created_at).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getPregnancyInfo = () => {
    if (!toad.pregnancy?.isPregnant) return null;
    const duration = toad.pregnancy.pregnancyDuration * 3600000;
    const elapsed = Date.now() - toad.pregnancy.pregnancyStart;
    return {
      progress: Math.min((elapsed / duration) * 100, 100),
      timeLeft: Math.max(Math.ceil((duration - elapsed) / 60000), 0),
    };
  };

  /**
   * Устаревшее ухаживание из старого сейва (Часть 3.2): таймера 15–30 минут больше нет,
   * первый тик `processBreeding` сразу даёт беременность, поэтому отсчёт — только
   * совместимость со старыми сохранениями.
   */
  const getMatingInfo = () => {
    if (!toad.mating) return null;
    const { startedAt, startAt } = toad.mating;
    const duration = Math.max(1, startAt - startedAt);
    const elapsed = Date.now() - startedAt;
    return {
      progress: Math.min((elapsed / duration) * 100, 100),
      timeLeft: Math.max(Math.ceil((startAt - Date.now()) / 60000), 0),
    };
  };

  // Рост без ускорений: бонусы биопода («ускоренный рост») — легаси и удалён.
  // `hungry` подсказывает, что головастика сначала нужно покормить.
  const getGrowthInfo = () => getToadGrowthInfo(toad);

  return {
    age: calculateAge(),
    pregnancy: getPregnancyInfo(),
    mating: getMatingInfo(),
    growth: getGrowthInfo(),
  };
};
