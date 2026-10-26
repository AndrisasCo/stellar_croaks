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
import type { PowerGrid } from "../components/HexMap/colony-power";
import { getRoomToadLists } from "../components/HexMap/room-toad-lists";
import type { RoomConfig } from "../components/HexMap/rooms-config";
import { EMPTY_COLONY } from "../models/colony";
import { Expedition } from "../models/expedition";
import { Toad } from "../models/Toad";
import {
  BIOMASS_TO_TOKENS_RATE,
  UPKEEP_PER_TOAD_HOUR,
  getBiomassRate,
} from "./gamification-config";
import { isToadDown } from "./expedition-config";
import {
  getExpeditions,
  isToadBusyOnExpedition,
} from "./expedition-manager";

/**
 * Часть 3.3 — активная ферма.
 * Жабы, живущие в биоподах, непрерывно вырабатывают биомассу,
 * а их содержание (апкипинг) ежечасно тратит биомассу.
 */

/** Часть 5: выработка раненой жабы (выбитой из строя дома) */
export const INJURED_PRODUCTION_FACTOR = 0.5;

/**
 * Жаба в походе (разведка) — не работает на ферме и не ест биомассу.
 * Проверяем и запись похода, а не только статус: вернувшаяся жаба ещё держит
 * добычу до разбора (`isToadBusyOnExpedition`), поэтому работать раньше времени не должна.
 */
const isToadAway = (toad: Toad, expeditions?: Expedition[]): boolean =>
  isToadBusyOnExpedition(toad, expeditions);

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
  expeditions: Expedition[] = getExpeditions(),
): number =>
  toads.reduce((sum, toad) => {
    const inUnpoweredScene =
      typeof toad.scene_id === "number" &&
      unpoweredSceneIds?.has(toad.scene_id);

    if (isToadAway(toad, expeditions) || inUnpoweredScene) {
      return sum;
    }

    return sum + getBiomassRate(toad) * getInjuryFactor(toad);
  }, 0);

/** Один биопод в разбивке фермы: откуда берётся и куда уходит биомасса. */
export interface BiomassFarmRoomStat {
  /** id гекса биопода (`RoomConfig.id`) — по нему модалка отличает строки. */
  id: string;
  /** id биопода (`Scene.id`), чьи жильцы считаются в этой строке. */
  sceneId: number;
  name: string;
  icon: string;
  /** Есть ли ток: без него жильцы остаются, но биомассу не дают. */
  powered: boolean;
  /** Все жильцы биопода, включая тех, кто в походе. */
  toads: number;
  /** Жильцы, которые работают на ферме сейчас (не в походе). */
  activeToads: number;
  /** Жильцы в походе: не работают и не едят, пока команда не вернётся. */
  awayToads: number;
  /** Выработка биопода в час (0 без тока). */
  gross: number;
  /** Содержание работающих жильцов в час. */
  upkeep: number;
  /** Итог биопода в час: выработка минус содержание. */
  net: number;
}

/** Разбивка фермы биомассы по биоподам — то же, что показывает HUD, но по строкам. */
export interface BiomassFarmStats {
  gross: number;
  upkeep: number;
  net: number;
  /** Все жабы в биоподах, включая ушедших в поход. */
  toads: number;
  /** Жабы, которые сейчас работают на ферме (не в походе). */
  activeToads: number;
  /** Жабы в походе: апкипинг за них не списывается, выработки тоже нет. */
  awayToads: number;
  /** Работающие жильцы обесточенных биоподов: едят, но не производят. */
  unpoweredToads: number;
  rooms: BiomassFarmRoomStat[];
}

/**
 * Ферма биомассы по биоподам: выработка, содержание и итог по каждому гексу.
 *
 * Считаем теми же функциями, что и часовой тик (`getSceneProductionRate` +
 * `UPKEEP_PER_TOAD_HOUR`), и с теми же правилами, что у HUD:
 *  - в ферме участвуют жильцы биоподов: кто сейчас в нём (числовой `scene_id`), и
 *    ушедшие в поход из него (дом `homeId` помнит биопод);
 *  - жабы в походе не работают и не едят;
 *  - обесточенный биопод остаётся жилым: выработки нет, содержание есть.
 *
 * Поэтому сумма строк сходится с числом `🧪/ч` в шапке карты, а модалка объясняет
 * игроку, из чего это число сложилось. Апкипинг здесь — оценка текущего часа, а не
 * бухгалтерия выплат: `processProduction` округляет результат только при записи.
 */
export const getBiomassFarmStats = (
  rooms: RoomConfig[],
  toads: Toad[],
  powerGrid: PowerGrid,
  expeditions: Expedition[] = getExpeditions(),
): BiomassFarmStats => {
  const unpoweredSceneIds = getUnpoweredAviarySceneIds(rooms, powerGrid);
  const roomStats = rooms
    .filter(
      (room): room is RoomConfig & { sceneId: number } =>
        room.kind === "aviary" && room.sceneId != null,
    )
    .map((room): BiomassFarmRoomStat => {
      const residents = toads.filter(
        (toad) => toad.scene_id === room.sceneId,
      );
      const residentIds = new Set(residents.map((toad) => toad.id));
      // В походе место в биоподе свободно (`scene_id` пуст), но дом жаба помнит:
      // такие жильцы возвращаются сюда и в списке биопода стоят отдельной плашкой.
      const awayResidents = toads.filter(
        (toad) =>
          !residentIds.has(toad.id) &&
          toad.homeId === room.sceneId &&
          isToadAway(toad, expeditions),
      );
      const activeToads = residents.filter(
        (toad) => !isToadAway(toad, expeditions),
      );
      const powered = !unpoweredSceneIds.has(room.sceneId);
      const gross = powered
        ? getSceneProductionRate(activeToads, unpoweredSceneIds, expeditions)
        : 0;
      const upkeep = activeToads.length * UPKEEP_PER_TOAD_HOUR;

      return {
        id: room.id,
        sceneId: room.sceneId,
        name: room.name,
        icon: room.icon,
        powered,
        toads: residents.length + awayResidents.length,
        activeToads: activeToads.length,
        awayToads:
          residents.length - activeToads.length + awayResidents.length,
        gross,
        upkeep,
        net: gross - upkeep,
      };
    });

  const totals = roomStats.reduce(
    (sum, room) => ({
      gross: sum.gross + room.gross,
      upkeep: sum.upkeep + room.upkeep,
      net: sum.net + room.net,
      toads: sum.toads + room.toads,
      activeToads: sum.activeToads + room.activeToads,
      awayToads: sum.awayToads + room.awayToads,
      unpoweredToads:
        sum.unpoweredToads + (room.powered ? 0 : room.activeToads),
    }),
    {
      gross: 0,
      upkeep: 0,
      net: 0,
      toads: 0,
      activeToads: 0,
      awayToads: 0,
      unpoweredToads: 0,
    },
  );

  return { ...totals, rooms: roomStats };
};

/**
 * Начисляет биомассу и вычитает апкипинг за `hoursPassed` часов.
 * Возвращает разбивку дохода за период (для UI/уведомлений).
 */
export const processProduction = (
  hoursPassed: number,
): { gross: number; upkeep: number; net: number } => {
  const state = getGameState();
  const expeditions = state.expeditions ?? [];

  const sceneToads = state.toads.filter(
    (toad) => !isToadAway(toad, expeditions),
  );

  // Обесточенный биопод остаётся жилым, но биомассу не производит. Содержание жаб
  // при этом не исчезает: они по-прежнему едят, поэтому upkeep считаем по всем жильцам.
  const rooms = resolveColonyRooms(state.colony ?? EMPTY_COLONY, state.scenes);
  const toadsByRoom = getRoomToadLists(rooms, state.toads);
  const powerGrid = getPowerGrid(rooms, toadsByRoom, expeditions);
  const unpoweredSceneIds = getUnpoweredAviarySceneIds(rooms, powerGrid);

  const gross =
    getSceneProductionRate(sceneToads, unpoweredSceneIds, expeditions) *
    hoursPassed;
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
