import type { ColonyState } from "../models/colony";
import type { Toad } from "../models/Toad";
import { getToadEnergy, getToadMaxEnergy } from "./gamification-config";
import { getHospitalRoomIds, isToadInHospital } from "./hospital";
import { isToadInEnclosure } from "./toad-location";

/**
 * Силы жаб: где и как быстро они восстанавливаются.
 *
 * Правила:
 *  - силы идут только в биоподе или Медотсеке (лазарете). В репродукторе,
 *    ⚡-секторе, «Разведке» и других секторах колонии восстановления нет;
 *  - в походе силы не восстанавливаются;
 *  - при сытости 0 (`Toad.state.hunger`) восстановление останавливается;
 *  - минимум — `ENERGY_REGEN_BASE_PER_HOUR` в час при сытости 1. Дальше скорость
 *    линейно растёт до ×`ENERGY_REGEN_MAX_HUNGER_MULTIPLIER` при сытости 100;
 *  - аппетит (`genes.hungerRate`) множит скорость: прожорливая жаба восстанавливается
 *    пропорционально быстрее, но и голодает быстрее.
 *
 * Модуль чистый: колония и жаба приходят аргументами, поэтому правила проверяются
 * без запуска игры и без записи в сохранение.
 */

/** Базовая скорость восстановления сил в час при сытости 1 */
export const ENERGY_REGEN_BASE_PER_HOUR = 3;
/** С этой сытости восстановление уже идёт (0 — жаба голодна и не отдыхает) */
export const ENERGY_REGEN_MIN_HUNGER = 1;
/** Во сколько раз быстрее силы идут при сытости 100 относительно сытости 1 */
export const ENERGY_REGEN_MAX_HUNGER_MULTIPLIER = 2;

/** Где жаба восстанавливает силы: биопод, Медотсек или нигде */
export type EnergyRegenPlace = "biopod" | "hospital" | null;

/** id секторов колонии указанного вида (по id гекса, как в `Toad.scene_id`) */
const getRoomIds = (
  colony: ColonyState | null | undefined,
  kind: "aviary" | "hospital",
): string[] =>
  (colony?.rooms ?? [])
    .filter((room) => room.kind === kind)
    .map((room) => room.slotId ?? room.id);

/**
 * Место восстановления сил.
 *
 * Числовой `scene_id` — биопод. Строковый — сектор колонии: из них силы даёт
 * только Медотсек. Строковый id биопода оставлен для старых сейвов, где гекс-биопод
 * мог записаться как сектор.
 */
export const getToadEnergyRegenPlace = (
  toad: Toad,
  colony?: ColonyState | null,
): EnergyRegenPlace => {
  if (toad.status === "out") {
    return null;
  }

  if (isToadInEnclosure(toad)) {
    return "biopod";
  }

  if (isToadInHospital(toad, getHospitalRoomIds(colony))) {
    return "hospital";
  }

  if (
    typeof toad.scene_id === "string" &&
    getRoomIds(colony, "aviary").includes(toad.scene_id)
  ) {
    return "biopod";
  }

  return null;
};

/**
 * Множитель скорости по сытости: 0 при сытости 0, 1 при сытости 1,
 * `ENERGY_REGEN_MAX_HUNGER_MULTIPLIER` при 100. Между ними — линейный рост.
 */
export const getEnergyHungerMultiplier = (hunger: number): number => {
  if (!Number.isFinite(hunger) || hunger < ENERGY_REGEN_MIN_HUNGER) {
    return 0;
  }

  const satiety = Math.min(100, Math.max(ENERGY_REGEN_MIN_HUNGER, hunger));
  const progress =
    (satiety - ENERGY_REGEN_MIN_HUNGER) / (100 - ENERGY_REGEN_MIN_HUNGER);

  return 1 + progress * (ENERGY_REGEN_MAX_HUNGER_MULTIPLIER - 1);
};

/**
 * Сколько сил в час получает жаба прямо сейчас.
 *
 * Возвращает 0, если жаба не в биоподе/Медотсеке, в походе или голодна.
 */
export const getEnergyRegenPerHour = (
  toad: Toad,
  colony?: ColonyState | null,
): number => {
  if (!getToadEnergyRegenPlace(toad, colony)) {
    return 0;
  }

  const hungerMultiplier = getEnergyHungerMultiplier(toad.state?.hunger ?? 0);

  if (hungerMultiplier <= 0) {
    return 0;
  }

  const appetite = Math.max(0, toad.genes?.hungerRate ?? 1);

  return ENERGY_REGEN_BASE_PER_HOUR * hungerMultiplier * appetite;
};

/**
 * Новый запас сил после `hoursPassed` часов отдыха.
 *
 * `null` — жаба не отдыхает (не подходящее место, поход, голод) или уже полна:
 * вызывающему не нужно перезаписывать жабу. В остальных случаях запас обрезается
 * по максимуму качества (`getToadMaxEnergy`).
 */
export const getToadEnergyAfterRegen = (
  toad: Toad,
  colony: ColonyState | null | undefined,
  hoursPassed: number,
): number | null => {
  if (hoursPassed <= 0) {
    return null;
  }

  const rate = getEnergyRegenPerHour(toad, colony);

  if (rate <= 0) {
    return null;
  }

  const maxEnergy = getToadMaxEnergy(toad);
  const energy = getToadEnergy(toad);

  if (energy >= maxEnergy) {
    return null;
  }

  return (
    Math.round(Math.min(maxEnergy, energy + rate * hoursPassed) * 1000) / 1000
  );
};

/** Жаба после тика отдыха: та же жаба, если восстанавливаться нечему */
export const regenToadEnergy = (
  toad: Toad,
  colony: ColonyState | null | undefined,
  hoursPassed: number,
): Toad => {
  const energy = getToadEnergyAfterRegen(toad, colony, hoursPassed);

  return energy === null ? toad : { ...toad, energy };
};
