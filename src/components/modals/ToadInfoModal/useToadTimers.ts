import { HOURS_TO_GROW_UP } from "../../../models/Toad";
import { getBoostByScene } from "../../../models/scene";

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

  const getGrowthInfo = () => {
    if (toad.stage !== "toadpole") return null;
    const boost = getBoostByScene(toad.scene_id, "grow");
    const duration = (HOURS_TO_GROW_UP / boost) * 3600000;
    const elapsed = Date.now() - new Date(toad.created_at).getTime();
    return {
      progress: Math.min((elapsed / duration) * 100, 100),
      timeLeft: Math.max(Math.ceil((duration - elapsed) / 60000), 0),
    };
  };

  return {
    age: calculateAge(),
    pregnancy: getPregnancyInfo(),
    growth: getGrowthInfo(),
  };
};
