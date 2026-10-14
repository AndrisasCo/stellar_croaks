import { HOURS_TO_GROW_UP } from "../../../models/Toad";

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
   * Ухаживание в репродукторе (Часть 3.2): беременность стартует не сразу — через
   * 15–30 минут после спаривания, поэтому показываем отдельный отсчёт.
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

  const getGrowthInfo = () => {
    if (toad.stage !== "toadpole") return null;
    // Рост без ускорений: бонус биопода «ускоренный рост» — легаси и удалён
    const duration = HOURS_TO_GROW_UP * 3600000;
    const elapsed = Date.now() - new Date(toad.created_at).getTime();
    return {
      progress: Math.min((elapsed / duration) * 100, 100),
      timeLeft: Math.max(Math.ceil((duration - elapsed) / 60000), 0),
    };
  };

  return {
    age: calculateAge(),
    pregnancy: getPregnancyInfo(),
    mating: getMatingInfo(),
    growth: getGrowthInfo(),
  };
};
