import {
  HUNGER_PER_DAY,
  PRODUCTION_MIN_HUNGER,
} from "./gamification-config";

/** Полная сытость: выше неё жабу не кормят и голод не восстанавливают */
export const HUNGER_MAX = 100;

/**
 * Пороги цвета сытости: от полной к пустой. Один набор на полоску и на значение —
 * иначе карточка жабы и слоты секторов красили бы одну и ту же сытость по-разному.
 */
const HUNGER_TONES = [
  { min: 80, bar: "bg-green-500", text: "text-green-400" },
  { min: 50, bar: "bg-yellow-500", text: "text-yellow-400" },
  { min: PRODUCTION_MIN_HUNGER, bar: "bg-orange-500", text: "text-orange-400" },
  { min: 0, bar: "bg-red-500", text: "text-red-400" },
] as const;

const getHungerTone = (hunger: number) =>
  HUNGER_TONES.find((tone) => hunger >= tone.min) ?? HUNGER_TONES[3];

/**
 * Цвет полоски сытости: зелёный — сыта, жёлтый — скоро захочет есть,
 * оранжевый — держится на рабочем минимуме, красный — ниже него.
 *
 * Энергосектор решает по этой же полоске, даёт ли жаба ток.
 */
export const getHungerBarColor = (hunger: number): string =>
  getHungerTone(hunger).bar;

/** Цвет значения рядом с полоской сытости — те же пороги, что у `getHungerBarColor` */
export const getHungerTextColor = (hunger: number): string =>
  getHungerTone(hunger).text;

/**
 * Сытость после `hoursPassed` часов голодания.
 *
 * Формула вынесена из `state-manager` в чистый модуль: её используют и игровой тик,
 * и интерфейс (прогноз роста головастика), которому не нужен backend.
 *
 * Защита от мусора в сейве: неизвестный аппетит (`hungerRate`) считается обычным,
 * отрицательное время — нулевым, а сытость остаётся в границах 0…`HUNGER_MAX`.
 * Иначе одно битое поле превращалось бы в `NaN` у всей колонии.
 */
export const getHunger = (
  currentHunger: number,
  hungerRate: number,
  hoursPassed: number,
) => {
  const hungerRateValue = Number.isFinite(hungerRate) ? hungerRate : 1;
  const hours = Number.isFinite(hoursPassed) ? Math.max(0, hoursPassed) : 0;
  const hunger =
    (Number.isFinite(currentHunger) ? currentHunger : 0) -
    (hours / 24) * HUNGER_PER_DAY * Math.max(0, hungerRateValue);

  return (
    Math.round(Math.min(HUNGER_MAX, Math.max(0, hunger)) * 10) / 10
  );
};

