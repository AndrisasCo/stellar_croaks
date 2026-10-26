import {
  HUNGER_PER_DAY,
  PRODUCTION_MIN_HUNGER,
} from "./gamification-config";

/**
 * Цвет полоски сытости: зелёный — сыта, жёлтый — скоро захочет есть,
 * оранжевый — держится на рабочем минимуме, красный — ниже него.
 *
 * Один на карточку жабы и слоты секторов: энергосектор решает по этой же
 * полоске, даёт ли жаба ток.
 */
export const getHungerBarColor = (hunger: number): string =>
  hunger >= 80
    ? "bg-green-500"
    : hunger >= 50
      ? "bg-yellow-500"
      : hunger >= PRODUCTION_MIN_HUNGER
        ? "bg-orange-500"
        : "bg-red-500";

/** Цвет значения рядом с полоской сытости — те же пороги, что у `getHungerBarColor` */
export const getHungerTextColor = (hunger: number): string =>
  hunger >= 80
    ? "text-green-400"
    : hunger >= 50
      ? "text-yellow-400"
      : hunger >= PRODUCTION_MIN_HUNGER
        ? "text-orange-400"
        : "text-red-400";

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
