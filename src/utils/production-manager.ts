import { updateToadsBulkEnergy, updateUser } from "../backend";
import { getGameState } from "../backend/localStorage";
import { completeAchivement } from "../backend/achivements-manager";
import { Toad } from "../models/Toad";
import {
  BIOMASS_TO_TOKENS_RATE,
  UPKEEP_PER_TOAD_HOUR,
  getBiomassRate,
} from "./gamification-config";
import { isToadDown } from "./expedition-config";

/**
 * Часть 3.3 — активная ферма.
 * Жабы, живущие в вольерах, непрерывно вырабатывают биомассу,
 * а их содержание (апкипинг) ежечасно тратит биомассу.
 */

/** Часть 5: выработка раненой жабы (выбитой из строя дома) */
export const INJURED_PRODUCTION_FACTOR = 0.5;

/** Жаба в походе (разведка) — не работает на ферме и не ест биомассу */
const isToadAway = (toad: Toad): boolean => toad.status === "out";

/** Жаба работает в комнате колонии (энергокомната ⚡) — она не на ферме */
const isToadStationed = (toad: Toad): boolean => Boolean(toad.roomId);

/** Множитель выработки по состоянию здоровья жабы (выбитая — 0) */
const getInjuryFactor = (toad: Toad): number => {
  if (isToadDown(toad)) {
    return 0;
  }
  return toad.status === "injured" ? INJURED_PRODUCTION_FACTOR : 1;
};

/**
 * Суммарная выработка биомассы (за час) всеми переданными жабами.
 * Жабы, работающие в энергокомнатах, биомассу не вырабатывают: они дают ток.
 */
export const getSceneProductionRate = (toads: Toad[]): number =>
  toads.reduce(
    (sum, toad) =>
      sum +
      (isToadAway(toad) || isToadStationed(toad)
        ? 0
        : getBiomassRate(toad) * getInjuryFactor(toad)),
    0
  );

/** Расход биомассы на содержание передаваемых жаб (за час) */
export const getUpkeepRate = (toads: Toad[]): number =>
  toads.filter((toad) => !isToadAway(toad) && !isToadStationed(toad)).length *
  UPKEEP_PER_TOAD_HOUR;

/**
 * Начисляет биомассу и вычитает апкипинг за `hoursPassed` часов.
 * Жабы вне вольеров (на складе) не производят и не потребляют.
 * Возвращает разбивку дохода за период (для UI/уведомлений).
 */
export const processProduction = (
  hoursPassed: number
): { gross: number; upkeep: number; net: number } => {
  const state = getGameState();
  // Жабы в походе (Часть 5) дома не работают и не потребляют биомассу,
  // а жабы в энергокомнатах колонии вместо фермы дают ток
  const sceneToads = state.toads.filter(
    (t) => t.scene_id !== null && !isToadAway(t) && !t.roomId
  );

  const gross = getSceneProductionRate(sceneToads) * hoursPassed;
  const upkeep = getUpkeepRate(sceneToads) * hoursPassed;
  const net = gross - upkeep;

  const currentBiomass = state.user.biomass || 0;
  const newBiomass = Math.max(0, currentBiomass + net);

  updateUser({ biomass: Math.round(newBiomass * 100) / 100 });

  // Ачивка «Биофабрика»: сработает один раз, повторные вызовы недорогие
  if (newBiomass >= 100) {
    completeAchivement("biomass-100");
  }

  return { gross, upkeep, net };
};

/** Пассивное восстановление «сил» жаб (energy) за прошедшие часы */
export const processEnergyRegen = (hoursPassed: number): void => {
  if (hoursPassed <= 0) {
    return;
  }
  updateToadsBulkEnergy(hoursPassed, true);
};

/**
 * Обмен всей биомассы на Кваксы (Часть 3.7).
 * Неполная биомасса, которой не хватает на целый Квакс, остаётся на счету.
 */
export const exchangeBiomassForTokens = (): {
  success: boolean;
  tokensGained: number;
} => {
  const state = getGameState();
  const biomass = state.user.biomass || 0;
  const tokensGained = Math.floor(biomass * BIOMASS_TO_TOKENS_RATE);

  if (tokensGained <= 0) {
    return { success: false, tokensGained: 0 };
  }

  const spentBiomass = tokensGained / BIOMASS_TO_TOKENS_RATE;

  updateUser({
    biomass: Math.round((biomass - spentBiomass) * 100) / 100,
    tokens: state.user.tokens + tokensGained,
  });

  return { success: true, tokensGained };
};
