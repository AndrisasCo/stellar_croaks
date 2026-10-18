import { HUNGER_PER_DAY } from "./gamification-config";

/**
 * Сытость после `hoursPassed` часов голодания.
 *
 * Формула вынесена из `state-manager` в чистый модуль: её используют и игровой тик,
 * и интерфейс (прогноз роста головастика), которому не нужен backend.
 */
export const getHunger = (
  currentHunger: number,
  hungerRate: number,
  hoursPassed: number
) => {
  return (
    Math.round(
      Math.max(
        0,
        (currentHunger -
          (hoursPassed / 24) * HUNGER_PER_DAY * Math.max(0, hungerRate)) *
          10
      )
    ) / 10
  );
};
