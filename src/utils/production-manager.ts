import { updateToadsBulkEnergy, updateUser } from "../backend";
import { getGameState } from "../backend/localStorage";
import {
  completeAchivement,
  completeAchivementCounter,
} from "../backend/achivements-manager";
import {
  getPowerGrid,
  getUnpoweredAviarySceneIds,
  resolveColonyRooms,
} from "../components/HexMap/colony-build";
import { getRoomToadLists } from "../components/HexMap/room-toad-lists";
import { EMPTY_COLONY } from "../models/colony";
import { Toad } from "../models/Toad";
import {
  BIOMASS_TO_TOKENS_RATE,
  UPKEEP_PER_TOAD_HOUR,
  getBiomassRate,
} from "./gamification-config";
import { isToadDown } from "./expedition-config";

/**
 * Часть 3.3 — активная ферма.
 * Жабы, живущие в биоподах, непрерывно вырабатывают биомассу,
 * а их содержание (апкипинг) ежечасно тратит биомассу.
 */

/** Часть 5: выработка раненой жабы (выбитой из строя дома) */
export const INJURED_PRODUCTION_FACTOR = 0.5;

/** Жаба в походе (разведка) — не работает на ферме и не ест биомассу */
const isToadAway = (toad: Toad): boolean => toad.status === "out";

/** Множитель выработки по состоянию здоровья жабы (выбитая — 0) */
const getInjuryFactor = (toad: Toad): number => {
  if (isToadDown(toad)) {
    return 0;
  }
  return toad.status === "injured" ? INJURED_PRODUCTION_FACTOR : 1;
};

/**
 * Суммарная выработка биомассы (за час) всеми переданными жабами.
 * Жабы, живущие в секторах колонии (⚡-сектор, «Разведка»), биомассу не вырабатывают.
 * Жильцы обесточенного биопода тоже стоят без выработки — их сцены приходят набором
 * `unpoweredSceneIds`, чтобы HUD и тик фермы считали одинаково.
 */
export const getSceneProductionRate = (
  toads: Toad[],
  unpoweredSceneIds?: ReadonlySet<number>,
): number =>
  toads.reduce((sum, toad) => {
    const inUnpoweredScene =
      typeof toad.scene_id === "number" &&
      unpoweredSceneIds?.has(toad.scene_id);

    if (isToadAway(toad) || inUnpoweredScene) {
      return sum;
    }

    return sum + getBiomassRate(toad) * getInjuryFactor(toad);
  }, 0);

/**
 * Начисляет биомассу и вычитает апкипинг за `hoursPassed` часов.
 * Возвращает разбивку дохода за период (для UI/уведомлений).
 */
export const processProduction = (
  hoursPassed: number,
): { gross: number; upkeep: number; net: number } => {
  const state = getGameState();

  const sceneToads = state.toads.filter((t) => !isToadAway(t));

  // Обесточенный биопод остаётся жилым, но биомассу не производит. Содержание жаб
  // при этом не исчезает: они по-прежнему едят, поэтому upkeep считаем по всем жильцам.
  const rooms = resolveColonyRooms(state.colony ?? EMPTY_COLONY, state.scenes);
  const toadsByRoom = getRoomToadLists(rooms, state.toads);
  const powerGrid = getPowerGrid(rooms, toadsByRoom);
  const unpoweredSceneIds = getUnpoweredAviarySceneIds(rooms, powerGrid);

  const gross =
    getSceneProductionRate(sceneToads, unpoweredSceneIds) * hoursPassed;
  const upkeep = sceneToads.length * UPKEEP_PER_TOAD_HOUR * hoursPassed;
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
 * Обмен биомассы на Кваксы (Часть 3.7).
 *
 * Ползунок в «Космическом рынке» продаёт **часть** биомассы, поэтому количество
 * приходит аргументом (`amount`): без него обменивается вся биомасса — как было
 * кнопкой «Обменять». Неполный Квакс не берётся: например, при курсе 2 🧪 = 1 🔷
 * из 5 🧪 уйдёт только 4 🧪, а 1 🧪 останется на счету (`getBiomassExchangeSpent`).
 */

/** Сколько Кваксов даст обмен этой биомассы (неполный Квакс остаётся на счету) */
export const getBiomassExchangeTokens = (biomassAmount: number): number =>
  Math.max(0, Math.floor(Math.max(0, biomassAmount) * BIOMASS_TO_TOKENS_RATE));

/** Сколько биомассы реально уйдёт за эти Кваксы: остаток, не дотянувший до Квакса, остаётся */
export const getBiomassExchangeSpent = (tokensGained: number): number =>
  Math.max(0, tokensGained) / BIOMASS_TO_TOKENS_RATE;

export const exchangeBiomassForTokens = (
  /** Сколько биомассы продать: не больше той, что есть (без аргумента — вся) */
  amount?: number,
): {
  success: boolean;
  tokensGained: number;
  biomassSpent: number;
} => {
  const state = getGameState();
  const biomass = state.user.biomass || 0;
  const requested = Math.max(0, Math.min(amount ?? biomass, biomass));
  const tokensGained = getBiomassExchangeTokens(requested);

  if (tokensGained <= 0) {
    return { success: false, tokensGained: 0, biomassSpent: 0 };
  }

  const biomassSpent = getBiomassExchangeSpent(tokensGained);

  updateUser({
    biomass: Math.round((biomass - biomassSpent) * 100) / 100,
    tokens: state.user.tokens + tokensGained,
  });

  // Обмен биомассы — такой же заработок, как продажа жаб: без этого счётчик «earn»
  // обходил целый экономический цикл и достижения торговой группы копились неравномерно.
  completeAchivementCounter("earn", tokensGained);

  return { success: true, tokensGained, biomassSpent };
};
