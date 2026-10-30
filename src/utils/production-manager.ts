import { updateToadsBulkEnergy, updateUser } from "../backend";
import { getGameState } from "../backend/localStorage";
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
import { isToadInEnclosure } from "./toad-location";

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
 *
 * Работают на ферме только жильцы биоподов: у них числовой `scene_id`. Жабы в секторах
 * колонии (лазарет, репродуктор, ⚡-сектор, «Разведка») биомассу не вырабатывают, хотя
 * содержание с них берут — поэтому строковый `scene_id` здесь отсеивается.
 * Жильцы обесточенного биопода тоже стоят без выработки — их сцены приходят набором
 * `unpoweredSceneIds`, чтобы HUD и тик фермы считали одинаково.
 */
export const getSceneProductionRate = (
  toads: Toad[],
  unpoweredSceneIds?: ReadonlySet<number>,
  expeditions: Expedition[] = getExpeditions(),
): number =>
  toads.reduce((sum, toad) => {
    // Жаба в секторе колонии: место есть, но ферме она не помогает
    if (!isToadInEnclosure(toad)) {
      return sum;
    }

    const inUnpoweredScene = unpoweredSceneIds?.has(toad.scene_id);

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

/**
 * Сектор колонии, который биомассу не даёт, но его жабы её едят: лазарет, репродуктор,
 * ⚡-энергосектор, «Разведка» и остальные не-биоподы. Нужен, чтобы игрок видел, куда
 * уходит содержание помимо фермы.
 */
export interface BiomassUpkeepRoomStat {
  /** id гекса (`RoomConfig.id`) — по нему модалка отличает строки. */
  id: string;
  name: string;
  icon: string;
  /** Жабы сектора, которые не в походе и поэтому едят. */
  toads: number;
  /** Содержание этих жаб в час. */
  upkeep: number;
}

/** Разбивка фермы биомассы по биоподам — то же, что показывает HUD, но по строкам. */
export interface BiomassFarmStats {
  /** Выработка биоподов в час (жабы в секторах колонии не производят). */
  gross: number;
  /**
   * Содержание **всех** жаб колонии в час, кроме ушедших в поход: ферма, лазарет,
   * репродуктор, ⚡-сектор, «Разведка» и остальные гексы.
   */
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
  /**
   * Жабы в других секторах колонии: они не работают на ферме, но содержание с них
   * берут (`serviceRooms` раскладывает это число по гексам).
   */
  serviceToads: number;
  /**
   * Жабы вне гексов карты (старые сейвы, потерянный дом): числового биопода у них нет,
   * но пока они не в походе — они тоже едят.
   */
  unplacedToads: number;
  /** Строки биоподов: выработка, содержание жильцов и итог по каждому. */
  rooms: BiomassFarmRoomStat[];
  /** Строки остальных секторов — только содержание: выработки там нет. */
  serviceRooms: BiomassUpkeepRoomStat[];
}

/**
 * Ферма биомассы по биоподам: выработка, содержание и итог по каждому гексу.
 *
 * Считаем теми же функциями, что и часовой тик (`getSceneProductionRate` +
 * `UPKEEP_PER_TOAD_HOUR`), и с теми же правилами, что у HUD:
 *  - вырабатывают только жильцы биоподов: кто сейчас в нём (числовой `scene_id`), и
 *    ушедшие в поход из него (дом `homeId` помнит биопод);
 *  - жабы в секторах колонии (лазарет, репродуктор, ⚡, «Разведка») биомассу не дают,
 *    но содержание с них берут — так же, как и с жаб без гекса;
 *  - жабы в походе не работают и не едят;
 *  - обесточенный биопод остаётся жилым: выработки нет, содержание есть.
 *
 * Поэтому `upkeep` — это все не ушедшие в поход жабы колонии, а не только ферма.
 * Разбивка показывает, откуда он сложился: строки биоподов (`rooms`), строки остальных
 * секторов (`serviceRooms`) и жабы вне гексов (`unplacedToads`). Сумма `gross` сходится
 * с числом `🧪/ч` в шапке карты. Апкипинг здесь — оценка текущего часа, а не
 * бухгалтерия выплат: `processProduction` округляет результат только при записи.
 */
export const getBiomassFarmStats = (
  rooms: RoomConfig[],
  toads: Toad[],
  powerGrid: PowerGrid,
  expeditions: Expedition[] = getExpeditions(),
): BiomassFarmStats => {
  const unpoweredSceneIds = getUnpoweredAviarySceneIds(rooms, powerGrid);
  /** Жабы, с которых берут содержание: все, кто не в походе */
  const upkeepToads = toads.filter(
    (toad) => !isToadAway(toad, expeditions),
  );
  const aviarySceneIds = new Set(
    rooms
      .filter((room) => room.kind === "aviary" && room.sceneId != null)
      .map((room) => room.sceneId as number),
  );

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

  /**
   * Остальные секторы: жабы там биомассу не вырабатывают, но едят. Место жабы в
   * секторе колонии — строковый `scene_id`; принимаем и id гекса, и канонический id
   * постройки, как это делает карта (`room-toad-lists.ts`).
   */
  const servedToadIds = new Set<number>();
  const serviceRoomStats = rooms
    .filter(
      (room) =>
        room.kind !== "aviary" &&
        room.kind !== "core" &&
        room.kind !== "empty",
    )
    .map((room): BiomassUpkeepRoomStat => {
      const residents = upkeepToads.filter(
        (toad) =>
          toad.scene_id === room.id || toad.scene_id === room.slotId,
      );

      residents.forEach((toad) => servedToadIds.add(toad.id));

      return {
        id: room.id,
        name: room.name,
        icon: room.icon,
        toads: residents.length,
        upkeep: residents.length * UPKEEP_PER_TOAD_HOUR,
      };
    })
    .filter((room) => room.toads > 0);

  /** Жабы на ферме: числовой `scene_id`, который принадлежит гексу-биоподу */
  const farmToadIds = new Set(
    upkeepToads
      .filter(
        (toad) =>
          isToadInEnclosure(toad) && aviarySceneIds.has(toad.scene_id),
      )
      .map((toad) => toad.id),
  );
  const unplacedToads = upkeepToads.filter(
    (toad) => !farmToadIds.has(toad.id) && !servedToadIds.has(toad.id),
  );

  const gross = roomStats.reduce((sum, room) => sum + room.gross, 0);
  const upkeep = upkeepToads.length * UPKEEP_PER_TOAD_HOUR;
  const totals = roomStats.reduce(
    (sum, room) => ({
      toads: sum.toads + room.toads,
      activeToads: sum.activeToads + room.activeToads,
      awayToads: sum.awayToads + room.awayToads,
      unpoweredToads:
        sum.unpoweredToads + (room.powered ? 0 : room.activeToads),
    }),
    {
      toads: 0,
      activeToads: 0,
      awayToads: 0,
      unpoweredToads: 0,
    },
  );

  return {
    gross,
    upkeep,
    net: gross - upkeep,
    ...totals,
    serviceToads: servedToadIds.size,
    unplacedToads: unplacedToads.length,
    rooms: roomStats,
    serviceRooms: serviceRoomStats,
  };
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

  /**
   * Содержание берут все жабы колонии, кроме ушедших в поход: и жильцы биоподов,
   * и те, кто работает в лазарете, репродукторе, ⚡-секторе или «Разведке».
   * Выработку же `getSceneProductionRate` оставляет только жильцам биоподов —
   * место в секторе колонии ферме не помогает, а корм там всё равно нужен.
   */
  const upkeepToads = state.toads.filter(
    (toad) => !isToadAway(toad, expeditions),
  );

  // Обесточенный биопод остаётся жилым, но биомассу не производит. Содержание жаб
  // при этом не исчезает: они по-прежнему едят, поэтому upkeep считаем по всем.
  const rooms = resolveColonyRooms(state.colony ?? EMPTY_COLONY, state.scenes);
  const toadsByRoom = getRoomToadLists(rooms, state.toads);
  const powerGrid = getPowerGrid(rooms, toadsByRoom, expeditions);
  const unpoweredSceneIds = getUnpoweredAviarySceneIds(rooms, powerGrid);

  const gross =
    getSceneProductionRate(upkeepToads, unpoweredSceneIds, expeditions) *
    hoursPassed;
  const upkeep = upkeepToads.length * UPKEEP_PER_TOAD_HOUR * hoursPassed;
  const net = gross - upkeep;

  const currentBiomass = state.user.biomass || 0;
  const newBiomass = Math.max(0, currentBiomass + net);

  updateUser({ biomass: Math.round(newBiomass * 100) / 100 });

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

  return { success: true, tokensGained, biomassSpent };
};
