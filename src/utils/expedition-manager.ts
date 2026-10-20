import {
  Expedition,
  ExpeditionLoot,
  ExpeditionMember,
  ExpeditionRole,
  ExpeditionStats,
  SectorDef,
  SECTORS,
  createEmptyLoot,
  getSectorById,
  isSectorUnlocked,
  normalizeExpeditionStats,
} from "../models/expedition";
import { Toad, ToadStatus } from "../models/Toad";
import { ToadTypes } from "../models/Toad/toad-species";
import { getDiseaseIndex } from "../models/disease";
import { Items } from "../models/user";
import { createToads, updateToadById, updateUser } from "../backend";
import { getGameState, updateGameState } from "../backend/localStorage";
import {
  completeAchivement,
  completeAchivementCounter,
} from "../backend/achivements-manager";
import { getIncubatingToadIds } from "./dissolve-manager";
import { getToadDisease, infectToad } from "./disease-manager";
import { generateRandomHexColor } from "./randomize-toad-characteristics";
import { assignToadsToScenes } from "./housing";
import {
  canFitInStorage,
  fitItemsInStorage,
  getStorageCapacityInfo,
} from "./storage";
import { getToadHomeId } from "./toad-location";
import {
  EXTRACTION_ASTRO_COST,
  EXPEDITION_BASE_EVENT_CHANCE,
  EXPEDITION_DANGER_CHANCE_PENALTY,
  EXPEDITION_EVENT_PROGRESS_STEP,
  EXPEDITION_GOOD_FINISH_LOOT,
  EXPEDITION_MAX_COMPANIONS,
  EXPEDITION_MAX_EVENTS_PER_TICK,
  EXPEDITION_MIN_RETURN_HOURS,
  EXPEDITION_RETURN_RATIO,
  EXPEDITION_ROLE_CHANCE_BONUS,
  EXPEDITION_TEAM_SIZE,
  FORCED_EXTRACTION_FEE_PER_TOAD,
  FORCED_LOOT_LOSS,
  TANK_DAMAGE_REDIRECT,
  getDispatchOfficeCost,
  getAwayToadUpdate,
  getContourPassReward,
  getExpeditionProfitFloor,
  getExpeditionSendCost,
  getExpeditionSuccessChance,
  getExpeditionToadEnergyCost,
  getHealCost,
  getLootBiomassValue,
  getLootValue,
  getMaxExpeditions,
  getReturnRemainingHours,
  getRolePower,
  getSectorLootFactor,
  getSpeedUpReturnCost,
  getToadHp,
  getToadMaxHp,
  isToadDown,
  rollExpeditionDisease,
  rollExpeditionLuck,
} from "./expedition-config";
import {
  ExpeditionEventContext,
  ExpeditionEventMember,
  ExpeditionLootDelta,
  describeLoot,
  pickExpeditionEvent,
} from "./expedition-events";
import {
  ExpeditionTeamMember,
  getSectorSuccessFactor,
} from "./expedition-config";
import { getToadEnergy } from "./gamification-config";
import { getHpRegenPerHour, getHospitalRoomIds } from "./hospital";

/**
 * ЧАСТЬ 5. Разведка (походы): отправка команд, события в пути, урон и HP,
 * возврат (в том числе принудительный), добыча и «Диспетчерская».
 *
 * События выводятся из реального времени: `processExpeditions()` можно звать
 * сколько угодно часто (игровой цикл, открытая модалка, старт игры) — каждый
 * вызов лишь «догоняет» те шаги пути, которые уже наступили по часам.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Сколько шагов событий на пути «туда» */
const STEPS_TOTAL = Math.ceil(1 / EXPEDITION_EVENT_PROGRESS_STEP);

export interface ExpeditionActionResult {
  success: boolean;
  message: string;
  expedition?: Expedition;
}

export interface ExpeditionTickResult {
  /** Разыграно событий в этот тик */
  events: number;
  /** Сколько команд вернулось домой */
  arrivals: number;
  /** Сколько жаб выбили из строя */
  downed: number;
}

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// === Чтение состояния ===

export const getExpeditions = (): Expedition[] =>
  getGameState().expeditions ?? [];

/**
 * Поход ещё в работе. Завершённый (`completed`) поход ждёт разбора добычи на вкладке
 * «Походы»: команда уже дома, но жабы ещё заняты и новую команду не ограничивают.
 */
export const isExpeditionActive = (expedition: Expedition): boolean =>
  expedition.phase !== "completed";

/** Активные походы: только они считаются лимитом «Диспетчерской» */
export const getActiveExpeditions = (): Expedition[] =>
  getExpeditions().filter(isExpeditionActive);

export const getExpeditionStats = (): ExpeditionStats =>
  normalizeExpeditionStats(getGameState().expeditionStats);

export const getExpeditionById = (id: string): Expedition | undefined =>
  getExpeditions().find((expedition) => expedition.id === id);

/**
 * Поход ушёл из этой «Разведки»?
 *
 * Сравниваем id гекса, канонический id постройки и старый числовой `Scene.id`:
 * разные сейвы помнят контур по-разному. Сводка «Все походы» использует это, чтобы
 * открыть модалку именно того контура, из которого ушла команда.
 */
export const isExpeditionFromRoom = (
  expedition: Expedition,
  room: { id: string; slotId?: string; sceneId?: number | null },
): boolean => {
  const origin = expedition.originRoomId;

  if (origin == null) {
    return false;
  }

  return (
    origin === room.id || origin === room.slotId || origin === room.sceneId
  );
};

/** Поход, в котором участвует жаба (или undefined) */
export const getToadExpedition = (
  toadId: number,
  expeditions: Expedition[] = getExpeditions(),
): Expedition | undefined =>
  expeditions.find((expedition) =>
    expedition.team.some((member) => member.toadId === toadId),
  );

/** Жаба сейчас в походе */
export const isToadOnExpedition = (
  toadId: number,
  expeditions: Expedition[] = getExpeditions(),
): boolean => Boolean(getToadExpedition(toadId, expeditions));

/**
 * Почему жаба в походе недоступна для обычных действий — одна подпись на весь интерфейс.
 * Жабы возвращаются в колонию не по прибытии, а после разбора добычи (`finishExpedition`),
 * поэтому до этого момента карточка, магазин, Медотсек и карта должны её не трогать.
 */
export const EXPEDITION_TOAD_BUSY_REASON =
  "Жаба в походе: действия станут доступны после её возвращения и разбора добычи.";

/**
 * Жаба занята походом: она либо ещё в пути (`status: "out"`), либо уже вернулась,
 * но команда ждёт разбора добычи (статус снят, а запись похода ещё держит её в команде).
 * Для всех действий «вне похода» проверяем именно это, а не только статус.
 */
export const isToadBusyOnExpedition = (
  toad: Pick<Toad, "id" | "status">,
  expeditions: Expedition[] = getExpeditions(),
): boolean =>
  toad.status === "out" || isToadOnExpedition(toad.id, expeditions);

/** Сколько команд может быть одновременно (Диспетчерская) */
export const getTeamLimit = (): number =>
  getMaxExpeditions(getGameState().user.dispatchLevel ?? 0);

/** Можно ли взять жабу в поход */
export const canSendToad = (
  toad: Toad,
  expeditions: Expedition[] = getExpeditions(),
): { ok: boolean; reason?: string } => {
  if (toad.stage !== "adult") {
    return { ok: false, reason: "ещё головастик" };
  }
  if (isToadOnExpedition(toad.id, expeditions) || toad.status === "out") {
    return { ok: false, reason: "уже в походе" };
  }
  if (isToadDown(toad)) {
    return { ok: false, reason: "выбита из строя (0 HP)" };
  }
  if (toad.pregnancy?.isPregnant) {
    return { ok: false, reason: "вынашивает потомство" };
  }
  // Пара в репродукторе: жаба занята ухаживанием (Часть 3.2)
  if (toad.mating) {
    return { ok: false, reason: "ухаживает в репродукторе" };
  }
  if (getIncubatingToadIds().includes(toad.id)) {
    return { ok: false, reason: "в инкубаторе" };
  }
  return { ok: true };
};

/** Прогресс открытия сектора для UI */
export const getSectorUnlockStatus = (
  sector: SectorDef,
  stats: ExpeditionStats = getExpeditionStats(),
): { unlocked: boolean; available: number; required: number } => ({
  unlocked: isSectorUnlocked(sector, stats),
  available: Math.max(
    0,
    Math.floor(getGameState().user.storage?.[Items.contourPass] ?? 0),
  ),
  required: sector.unlockCost,
});

/**
 * Открыть следующий сектор КОНТУРа за пропуска со склада.
 * Пропуска — расходуемый ресурс: списываются один раз, сектор остаётся открытым
 * навсегда (в `expeditionStats.unlockedSectors`).
 */
export const unlockSector = (sectorId: number): ExpeditionActionResult => {
  const sector = getSectorById(sectorId);

  if (sector.starter) {
    return { success: false, message: "Стартовый сектор уже открыт" };
  }

  const stats = getExpeditionStats();
  if (isSectorUnlocked(sector, stats)) {
    return { success: false, message: `Сектор «${sector.name}» уже открыт` };
  }

  // КОНТУР открывается по порядку: нельзя перепрыгнуть закрытый сектор,
  // даже если пропусков хватает на несколько уровней вперёд.
  const sectorIndex = SECTORS.findIndex((item) => item.id === sector.id);
  const previous = sectorIndex > 0 ? SECTORS[sectorIndex - 1] : undefined;

  if (previous && !isSectorUnlocked(previous, stats)) {
    return {
      success: false,
      message: `Сначала откройте «${previous.name}»`,
    };
  }

  const state = getGameState();
  const available = Math.max(
    0,
    Math.floor(state.user.storage?.[Items.contourPass] ?? 0),
  );

  if (available < sector.unlockCost) {
    return {
      success: false,
      message: `Для открытия нужно ${sector.unlockCost} 🎫 пропуск(ов) КОНТУРа (сейчас ${available})`,
    };
  }

  const unlockedSectors = [...(stats.unlockedSectors ?? []), sector.id];

  updateGameState({
    expeditionStats: { ...stats, unlockedSectors },
    user: {
      ...state.user,
      storage: {
        ...state.user.storage,
        [Items.contourPass]: available - sector.unlockCost,
      },
    },
  });

  return {
    success: true,
    message: `Сектор «${sector.name}» открыт за ${sector.unlockCost} 🎫`,
  };
};

// === Отправка команды ===

/**
 * Отправить команду в сектор.
 * Списывает биомассу на снаряжение, помечает жаб `status: "out"` и заводит запись
 * похода. Уходя, жаба освобождает место в секторе (`scene_id` снова становится
 * биоподом): она в походе, а не в ⚡-секторе или «Разведке» — двух мест сразу не бывает.
 * После разбора добычи жаба возвращается в «Разведку», откуда ушла команда
 * (`originRoomId`).
 */
export const startExpedition = (
  sectorId: number,
  members: ExpeditionMember[],
  /** Контур («Разведка»), из которого ушла команда: сюда жабы вернутся после похода */
  originRoomId?: number | string,
): ExpeditionActionResult => {
  const state = getGameState();
  const sector = getSectorById(sectorId);
  const stats = getExpeditionStats();

  if (!isSectorUnlocked(sector, stats)) {
    return {
      success: false,
      message: `Сектор закрыт: откройте его за ${sector.unlockCost} 🎫 пропуск(ов) КОНТУРа`,
    };
  }

  if (members.length === 0) {
    return { success: false, message: "Нужна хотя бы одна жаба" };
  }

  if (members.length > EXPEDITION_TEAM_SIZE) {
    return {
      success: false,
      message: `В команде максимум ${EXPEDITION_TEAM_SIZE} жаб`,
    };
  }

  const expeditions = getExpeditions();
  const limit = getTeamLimit();
  const activeCount = expeditions.filter(isExpeditionActive).length;
  if (activeCount >= limit) {
    return {
      success: false,
      message:
        limit === 1
          ? "Команда уже в походе. Постройте «Диспетчерскую» для второй."
          : `Все ${limit} команды уже в походах`,
    };
  }

  const seen = new Set<number>();
  const team: ExpeditionMember[] = [];
  const toads: Toad[] = [];
  /** Та же команда, но с самими жабами — для расчёта шанса удачного завершения */
  const successMembers: ExpeditionTeamMember[] = [];

  for (const member of members) {
    if (seen.has(member.toadId)) {
      return { success: false, message: "Одна жаба не может взять две роли" };
    }
    seen.add(member.toadId);

    const toad = state.toads.find((item) => item.id === member.toadId);
    if (!toad) {
      return { success: false, message: "Жаба не найдена" };
    }

    const check = canSendToad(toad, expeditions);
    if (!check.ok) {
      return { success: false, message: `${toad.name}: ${check.reason}` };
    }

    team.push({ toadId: member.toadId, role: member.role });
    toads.push(toad);
    successMembers.push({ role: member.role, toad });
  }

  const cost = getExpeditionSendCost(sector, team.length);
  if ((state.user.biomass || 0) < cost) {
    return {
      success: false,
      message: `На снаряжение нужно ${cost} 🧪 (сейчас ${Math.floor(
        state.user.biomass || 0,
      )})`,
    };
  }

  /**
   * Силы: снаряжение оплачивает склад, а путь — сама жаба. Если хоть одной не хватает
   * сил на сектор, поход не отправляем: иначе игрок терял бы добычу и HP, не увидев,
   * почему команда вышла «пустой». Сколько именно нужно, показывает модалка разведки.
   */
  const energyCost = getExpeditionToadEnergyCost(sector);
  const tired = toads.find((toad) => getToadEnergy(toad) < energyCost);
  if (tired) {
    return {
      success: false,
      message: `${tired.name}: не хватает сил — нужно ${energyCost} ⚡ (сейчас ${Math.round(
        getToadEnergy(tired),
      )})`,
    };
  }

  const now = Date.now();

  updateUser({
    biomass: Math.round(((state.user.biomass || 0) - cost) * 100) / 100,
  });

  // Уход в поход освобождает место: жаба в походе, а не в секторе, спрайт скрыт.
  // Заодно списываем силы: у каждой своя цена по глубине сектора.
  toads.forEach((toad) => {
    updateToadById(
      toad.id,
      {
        // Для контура карты (`room.id`) `scene_id` остаётся пустым: жаба в походе,
        // а не в секторе. Старый числовой `Scene.id` сохраняем как раньше.
        ...getAwayToadUpdate(
          toad,
          typeof originRoomId === "number" ? originRoomId : undefined,
        ),
        energy: Math.max(0, getToadEnergy(toad) - energyCost),
      },
      true,
    );
  });

  const expedition: Expedition = {
    id: makeId("exp"),
    sectorId: sector.id,
    team,
    startedAt: now,
    phase: "outbound",
    progress: 0,
    resolvedSteps: 0,
    // Шанс удачного завершения считаем на старте (роли, сложность сектора и удача):
    // каждая занятая роль даёт +20%, сила роли и глубина сектора множат вклад.
    successChance: getExpeditionSuccessChance(
      successMembers,
      sector,
      rollExpeditionLuck(),
    ),
    originRoomId: originRoomId || undefined,
    loot: createEmptyLoot(),
    log: [],
  };

  pushLog(expedition, {
    role: "system",
    kind: "info",
    text: `команда из ${team.length} жаб ушла в «${sector.name}» − снаряжение ${cost} 🧪, силы −${energyCost} ⚡ на жабу`,
  });

  pushLog(expedition, {
    role: "system",
    kind: "info",
    text: `шанс вернуться с удачей: ${Math.round(
      (expedition.successChance ?? 0) * 100,
    )}% (каждая роль даёт +20%, сложность сектора ×${getSectorSuccessFactor(
      sector,
    ).toFixed(2)})`,
  });

  updateGameState({ expeditions: [...expeditions, expedition] }, true);
  completeAchivement("first-expedition");

  return {
    success: true,
    message: `Команда ушла в «${sector.name}». Путь туда: ${sector.durationHours} ч`,
    expedition,
  };
};

// === Управление походом ===

/** Внутренний старт обратного пути (отзыв или выбитая команда) */
const startReturn = (
  expedition: Expedition,
  sector: SectorDef,
  now: number,
  forced: boolean,
): void => {
  const progress = Math.max(
    expedition.progress,
    getExpeditionProgress(expedition, now),
  );
  const traveledHours = Math.max(0.05, progress * sector.durationHours);

  expedition.progress = progress;
  expedition.phase = "returning";
  expedition.returnStartedAt = now;
  expedition.returnHours = Math.max(
    EXPEDITION_MIN_RETURN_HOURS,
    Math.round(traveledHours * EXPEDITION_RETURN_RATIO * 100) / 100,
  );
  expedition.forced = forced;

  pushLog(expedition, {
    role: "system",
    kind: forced ? "bad" : "info",
    text: forced
      ? `вся команда выбита — экстренная эвакуация, назад ${expedition.returnHours} ч`
      : `развернулись к дому: назад ${expedition.returnHours} ч`,
  });
};

/** Отозвать команду: возврат с текущей точки (половина пройденного пути) */
export const withdrawExpedition = (id: string): ExpeditionActionResult => {
  const expeditions = getExpeditions();
  const expedition = expeditions.find((item) => item.id === id);

  if (!expedition) {
    return { success: false, message: "Поход не найден" };
  }
  if (expedition.phase === "completed") {
    return {
      success: false,
      message: "Поход уже завершён — заберите добычу на вкладке «Походы»",
    };
  }
  if (expedition.phase === "returning") {
    return { success: false, message: "Команда уже возвращается" };
  }

  startReturn(
    expedition,
    getSectorById(expedition.sectorId),
    Date.now(),
    false,
  );
  updateGameState({ expeditions: [...expeditions] }, true);

  return {
    success: true,
    message: `Команда развернулась: назад ${expedition.returnHours} ч`,
    expedition,
  };
};

/** Ускорить возврат за биомассу (остаток пути делится пополам) */
export const speedUpReturn = (id: string): ExpeditionActionResult => {
  const state = getGameState();
  const expeditions = getExpeditions();
  const expedition = expeditions.find((item) => item.id === id);

  if (!expedition) {
    return { success: false, message: "Поход не найден" };
  }
  if (expedition.phase !== "returning") {
    return { success: false, message: "Команда ещё идёт вглубь сектора" };
  }

  const now = Date.now();
  const cost = getSpeedUpReturnCost(expedition, now);
  if (cost <= 0) {
    return { success: false, message: "Команда уже дома" };
  }
  if ((state.user.biomass || 0) < cost) {
    return { success: false, message: `Нужно ${cost} 🧪 для ускорения` };
  }

  const returnStartedAt = expedition.returnStartedAt || now;
  const remainingMs =
    returnStartedAt + (expedition.returnHours || 0) * HOUR_MS - now;

  expedition.returnStartedAt = returnStartedAt - remainingMs / 2;
  expedition.speedups = (expedition.speedups || 0) + 1;

  console.log({ expedition });

  pushLog(expedition, {
    role: "system",
    kind: "info",
    text: `подкупили проводника за ${cost} 🧪 — путь домой вдвое короче`,
  });

  updateUser({
    biomass: Math.round(((state.user.biomass || 0) - cost) * 100) / 100,
  });
  updateGameState({ expeditions: [...expeditions] }, true);

  return {
    success: true,
    message: `Возврат ускорен за ${cost} 🧪`,
    expedition,
  };
};

/** «Экстренный маяк»: моментально вытащить команду за Астро-кваксы */
export const extractExpedition = (
  id: string,
  addNotification?: (notification: any) => void,
): ExpeditionActionResult => {
  // Перед маяком «догоняем» поход: в рюкзаке и логе должно быть всё, что команда
  // успела добыть к этому моменту, — иначе маяк забирал бы её с устаревшей добычей.
  processExpeditions(addNotification);

  const state = getGameState();
  const expedition = getExpeditionById(id);

  if (!expedition) {
    return { success: false, message: "Поход не найден" };
  }
  if (expedition.phase === "completed") {
    return {
      success: true,
      message: "Команда уже дома — добыча ждёт разбора на вкладке «Походы»",
    };
  }

  const astro = state.user.astro_quax || 0;
  if (astro < EXTRACTION_ASTRO_COST) {
    return {
      success: false,
      message: `Маяк стоит ${EXTRACTION_ASTRO_COST} 💎 (сейчас ${astro})`,
    };
  }

  updateUser({ astro_quax: astro - EXTRACTION_ASTRO_COST });
  const summary = completeArrival(expedition, { instant: true });

  addNotification?.({
    type: "success",
    content: `🚁 Экстренный маяк: команда дома. ${summary}`,
  });

  return {
    success: true,
    message: "Команда эвакуирована маяком — добыча ждёт разбора в «Походах»",
  };
};

/** Мгновенное лечение жабы за Кваксы (Часть 2) */
export const healToad = (toadId: number): ExpeditionActionResult => {
  const state = getGameState();
  const toad = state.toads.find((item) => item.id === toadId);

  if (!toad) {
    return { success: false, message: "Жаба не найдена" };
  }
  if (isToadOnExpedition(toadId)) {
    return { success: false, message: "Жаба ещё в походе — лечить будем дома" };
  }

  const maxHp = getToadMaxHp(toad);
  const cost = getHealCost(toad);
  if (cost <= 0) {
    return { success: false, message: "Жаба и так в форме" };
  }
  if ((state.user.tokens || 0) < cost) {
    return { success: false, message: `Нужно ${cost} 🔷 на лечение` };
  }

  updateUser({ tokens: state.user.tokens - cost });
  updateToadById(toadId, { hp: maxHp, maxHp, status: "ok" }, true);

  return { success: true, message: `${toad.name} вылечена за ${cost} 🔷` };
};

/** Построить «Диспетчерскую»: +1 команда разведки за Кваксы */
export const buyDispatchOffice = (): ExpeditionActionResult => {
  const state = getGameState();
  const level = state.user.dispatchLevel ?? 0;
  const cost = getDispatchOfficeCost(level);

  if (cost === null) {
    return { success: false, message: "Больше команд не бывает" };
  }
  if ((state.user.tokens || 0) < cost) {
    return { success: false, message: `Диспетчерская стоит ${cost} 🔷` };
  }

  updateUser({ tokens: state.user.tokens - cost, dispatchLevel: level + 1 });

  return {
    success: true,
    message: `Диспетчерская построена: команд в разведке ${getTeamLimit()}`,
  };
};

// === Чат похода и рантайм команды ===

interface ExpeditionLogInput {
  role?: ExpeditionRole | "system";
  member?: ExpeditionEventMember;
  text: string;
  kind?: "good" | "bad" | "info";
  hpDelta?: number;
}

/** Строка в чат похода (список держим компактным) */
const pushLog = (expedition: Expedition, input: ExpeditionLogInput): void => {
  expedition.log.push({
    id: makeId("log"),
    at: Date.now(),
    role: input.member?.role ?? input.role ?? "system",
    toadId: input.member?.toadId,
    toadName: input.member?.toad.name ?? undefined,
    text: input.text,
    kind: input.kind ?? "info",
    hpDelta: input.hpDelta,
  });

  if (expedition.log.length > 60) {
    expedition.log.splice(0, expedition.log.length - 60);
  }
};

/** HP команды в рамках текущего тика (чтобы не дёргать стор на каждый чих) */
interface TeamRuntime {
  hp: Map<number, number>;
  maxHp: Map<number, number>;
  toads: Map<number, Toad>;
  downed: number[];
}

const buildRuntime = (expedition: Expedition, toads: Toad[]): TeamRuntime => {
  const runtime: TeamRuntime = {
    hp: new Map(),
    maxHp: new Map(),
    toads: new Map(),
    downed: [],
  };

  expedition.team.forEach((member) => {
    const toad = toads.find((item) => item.id === member.toadId);
    if (!toad) {
      return;
    }
    runtime.toads.set(member.toadId, toad);
    runtime.hp.set(member.toadId, getToadHp(toad));
    runtime.maxHp.set(member.toadId, getToadMaxHp(toad));
  });

  return runtime;
};

const persistHp = (toadId: number, hp: number, maxHp: number): void => {
  updateToadById(toadId, { hp: Math.round(hp * 100) / 100, maxHp }, true);
};

/** Собирает контекст события: живые жабы, проверки, урон, лечение, добыча и чат */
const buildEventContext = (
  expedition: Expedition,
  sector: SectorDef,
  runtime: TeamRuntime,
  rng: () => number,
  onDowned?: (name: string) => void,
): ExpeditionEventContext => {
  const aliveMembers = (): ExpeditionEventMember[] =>
    expedition.team
      .filter((member) => (runtime.hp.get(member.toadId) ?? 0) > 0)
      .map((member) => ({
        toadId: member.toadId,
        role: member.role,
        toad: runtime.toads.get(member.toadId) as Toad,
      }));

  const byRole = (role: ExpeditionRole): ExpeditionEventMember | null =>
    aliveMembers().find((member) => member.role === role) ?? null;

  /** Урон конкретной жабе; на нуле — жаба выбита до конца похода */
  const damage = (member: ExpeditionEventMember, amount: number): number => {
    const current = runtime.hp.get(member.toadId) ?? 0;
    const dealt = Math.min(Math.max(0, Math.round(amount)), current);
    const next = current - dealt;

    runtime.hp.set(member.toadId, next);
    persistHp(member.toadId, next, runtime.maxHp.get(member.toadId) ?? 0);

    if (next <= 0 && current > 0) {
      runtime.downed.push(member.toadId);
      pushLog(expedition, {
        role: "system",
        kind: "bad",
        text: `${member.toad.name} выбита из строя (0 HP) — до конца похода не встанет`,
      });
      onDowned?.(member.toad.name || "Жаба");
    }

    return dealt;
  };

  const heal = (member: ExpeditionEventMember, amount: number): number => {
    const current = runtime.hp.get(member.toadId) ?? 0;
    const maxHp = runtime.maxHp.get(member.toadId) ?? 0;
    const next = Math.min(maxHp, current + Math.max(0, Math.round(amount)));
    const healed = Math.round((next - current) * 100) / 100;

    if (healed > 0) {
      runtime.hp.set(member.toadId, next);
      persistHp(member.toadId, next, maxHp);
    }

    return healed;
  };

  /** Урон по всей команде: щитоносец забирает львиную долю */
  const teamDamage = (amount: number): { total: number; absorbed: number } => {
    const tank = byRole("tank");
    const total = Math.max(0, Math.round(amount));
    const absorbed = tank
      ? Math.min(total, Math.round(total * TANK_DAMAGE_REDIRECT))
      : 0;
    let dealtTotal = 0;

    if (tank) {
      dealtTotal += damage(tank, absorbed);
    }

    const rest = total - absorbed;
    const others = aliveMembers().filter(
      (member) => member.toadId !== tank?.toadId,
    );

    if (others.length > 0 && rest > 0) {
      const share = Math.max(1, Math.round(rest / others.length));
      others.forEach((member) => {
        dealtTotal += damage(member, share);
      });
    } else if (tank && rest > 0) {
      dealtTotal += damage(tank, rest);
    }

    return { total: dealtTotal, absorbed };
  };

  /** Добыча за событие копится в «рюкзак» похода */
  const loot = (delta: ExpeditionLootDelta): void => {
    expedition.loot.biomass += delta.biomass || 0;
    expedition.loot.tokens += delta.tokens || 0;
    expedition.loot.astro_quax += delta.astro_quax || 0;
    expedition.loot.samples += delta.sample || 0;

    Object.entries(delta.items || {}).forEach(([item, amount]) => {
      if (!amount) {
        return;
      }
      const key = item as Items;
      expedition.loot.items[key] = (expedition.loot.items[key] || 0) + amount;
    });
  };

  /** Кибер-болезнь прилетает жабе прямо в рейде (лечить — дома) */
  const infect = (member: ExpeditionEventMember): string | null => {
    if (!infectToad(member.toadId)) {
      return null;
    }
    const toad = getGameState().toads.find((item) => item.id === member.toadId);
    return toad ? (getToadDisease(toad)?.name ?? "кибер-болезнь") : null;
  };

  /**
   * Попутчик из события: пока просто копится в походе. Жабу нельзя поселить
   * сразу — команда в пути, а место в биоподе проверяется только на возврате
   * (`completeArrival`).
   */
  const join = (toad: Partial<Toad>): boolean => {
    const companions = expedition.companions ?? [];
    if (companions.length >= EXPEDITION_MAX_COMPANIONS) {
      return false;
    }

    expedition.companions = [...companions, toad];
    return true;
  };

  /** Шанс успеха = база + сила роли − опасность сектора, с поправкой на раны */
  const check = (
    member: ExpeditionEventMember,
    baseChance = EXPEDITION_BASE_EVENT_CHANCE,
  ): boolean => {
    const toad = runtime.toads.get(member.toadId) as Toad;
    const maxHp = runtime.maxHp.get(member.toadId) || 1;
    const hpRatio = clamp((runtime.hp.get(member.toadId) ?? 0) / maxHp, 0, 1);
    const chance =
      clamp(
        baseChance +
          getRolePower(toad, member.role) * EXPEDITION_ROLE_CHANCE_BONUS -
          (sector.dangerMultiplier - 1) * EXPEDITION_DANGER_CHANCE_PENALTY,
        0.05,
        0.95,
      ) *
      (0.6 + 0.4 * hpRatio);

    return rng() < chance;
  };

  const ctx: ExpeditionEventContext = {
    expedition,
    sector,
    alive: aliveMembers(),
    byRole,
    randomMember: () => {
      const alive = aliveMembers();
      return alive.length > 0 ? alive[Math.floor(rng() * alive.length)] : null;
    },
    check,
    damage,
    teamDamage,
    heal,
    loot,
    infect,
    join,
    log: (entry) => pushLog(expedition, entry),
    rng,
  };

  return ctx;
};

/** Один шаг пути: тянем случайное событие и разыгрываем его */
const runExpeditionStep = (
  expedition: Expedition,
  sector: SectorDef,
  runtime: TeamRuntime,
  onDowned?: (name: string) => void,
): ExpeditionEventContext => {
  const ctx = buildEventContext(
    expedition,
    sector,
    runtime,
    Math.random,
    onDowned,
  );
  pickExpeditionEvent(Math.random, ctx).run(ctx);
  return ctx;
};

/** Сколько шагов событий уже «наступило» по часам */
const getStepsDue = (
  expedition: Expedition,
  sector: SectorDef,
  now: number,
): number => {
  const totalMs = sector.durationHours * HOUR_MS;
  const elapsed = Math.max(0, now - expedition.startedAt);

  if (elapsed >= totalMs) {
    return STEPS_TOTAL;
  }

  return Math.min(
    STEPS_TOTAL,
    Math.floor(elapsed / (totalMs * EXPEDITION_EVENT_PROGRESS_STEP)) + 1,
  );
};

/**
 * Прогон всех активных походов: разыгрывает наступившие события, отправляет
 * команды домой и выдаёт добычу. Идемпотентно — можно звать хоть каждый кадр.
 */
export const processExpeditions = (
  addNotification?: (notification: any) => void,
): ExpeditionTickResult => {
  const state = getGameState();
  const expeditions = state.expeditions ?? [];
  const result: ExpeditionTickResult = { events: 0, arrivals: 0, downed: 0 };

  if (expeditions.length === 0) {
    return result;
  }

  const now = Date.now();
  const remaining: Expedition[] = [];
  let dirty = false;

  expeditions.forEach((expedition) => {
    // Завершённый поход ждёт решения игрока: события не идут, команда занята,
    // но лимит команд «Диспетчерской» он больше не занимает (`getActiveExpeditions`).
    if (!isExpeditionActive(expedition)) {
      remaining.push(expedition);
      return;
    }

    const sector = getSectorById(expedition.sectorId);

    if (expedition.phase === "outbound") {
      const stepsDue = getStepsDue(expedition, sector, now);
      const runtime = buildRuntime(expedition, state.toads);
      let resolvedNow = 0;

      while (
        expedition.resolvedSteps < stepsDue &&
        resolvedNow < EXPEDITION_MAX_EVENTS_PER_TICK &&
        expedition.phase === "outbound"
      ) {
        runExpeditionStep(expedition, sector, runtime, (name) => {
          result.downed += 1;
          addNotification?.({
            type: "danger",
            content: `🩸 ${name} выбита из строя в «${sector.name}»`,
          });
        });

        expedition.resolvedSteps += 1;
        resolvedNow += 1;
        result.events += 1;
        dirty = true;

        const anyAlive = expedition.team.some(
          (member) => (runtime.hp.get(member.toadId) ?? 0) > 0,
        );

        if (!anyAlive) {
          startReturn(expedition, sector, now, true);
          addNotification?.({
            type: "danger",
            content: `🚨 Команда в «${sector.name}» выбита — экстренная эвакуация`,
          });
          break;
        }
      }

      if (expedition.phase === "outbound") {
        const stepProgress = Math.min(
          1,
          expedition.resolvedSteps * EXPEDITION_EVENT_PROGRESS_STEP,
        );

        if (stepProgress !== expedition.progress) {
          expedition.progress = stepProgress;
          dirty = true;
        }

        const arrived =
          expedition.resolvedSteps >= STEPS_TOTAL &&
          now - expedition.startedAt >= sector.durationHours * HOUR_MS;

        if (arrived) {
          expedition.progress = 1;
          // Только дошедшая до сектора команда имеет шанс на удачу: если её
          // отозвали или вытащили маяком с середины пути, поход уже не успешный.
          expedition.reachedSector = true;
          // Поход идёт по часам, а не по тикам: если игрок был оффлайн, команда
          // развернулась в момент прибытия в сектор, а не в момент, когда игра
          // «догнала» поход. Иначе обратный путь стартовал бы только после входа
          // в игру и всё оффлайн-время сгорало бы.
          const arrivedAt =
            expedition.startedAt + sector.durationHours * HOUR_MS;
          startReturn(expedition, sector, Math.min(now, arrivedAt), false);
          dirty = true;
        }
      }
    }

    if (expedition.phase === "returning") {
      const eta =
        (expedition.returnStartedAt || now) +
        (expedition.returnHours || 0) * HOUR_MS;

      if (now >= eta) {
        const summary = completeArrival(expedition);
        result.arrivals += 1;
        dirty = true;
        addNotification?.({ type: "success", content: `🏠 ${summary}` });
        remaining.push(expedition);
        return;
      }
    }

    remaining.push(expedition);
  });

  if (dirty) {
    updateGameState({ expeditions: remaining }, true);
  }

  return result;
};

// === Возврат домой ===

/** Образцы из сектора превращаются в живых жаб (не больше трёх за поход) */
const createSampleToads = (count: number, sector: SectorDef): Toad[] => {
  const total = Math.min(Math.max(0, Math.floor(count)), 3);
  if (total === 0) {
    return [];
  }

  const patterns = ["smooth", "striped", "spotted"];
  const personalities = ["calm", "workaholic", "adventurer"];

  const data = Array.from({ length: total }, () => ({
    name: `Образец «${sector.name}»`,
    type: ToadTypes.camouflage,
    generation: 0,
    sex: Math.random() > 0.5 ? "male" : "female",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: {
      hunger: 100,
      genetic_fault: Math.round(Math.random() * Math.min(40, sector.depth * 4)),
    },
    genes: {
      colors: [
        generateRandomHexColor(),
        generateRandomHexColor(),
        generateRandomHexColor(),
      ],
      pattern: patterns[Math.floor(Math.random() * patterns.length)],
      weight: Math.round(10 + Math.random() * (4 + sector.depth * 3)),
      speed:
        Math.round((0.5 + Math.random() * (0.3 + sector.depth * 0.12)) * 100) /
        100,
      rarity:
        Math.round((1 + sector.depth * 0.8 + Math.random() * 2) * 10) / 10,
      hungerRate: Math.round((0.6 + Math.random() * 0.9) * 100) / 100,
      fertility:
        Math.round((0.7 + Math.random() * (0.6 + sector.depth * 0.15)) * 100) /
        100,
      personality:
        personalities[Math.floor(Math.random() * personalities.length)],
    },
  }));

  // Склада жаб больше нет: образец живёт только в биоподе. Сколько мест — столько жаб,
  // остальные образцы остаются в секторе (о них скажет отчёт похода).
  const { assigned, rejected } = assignToadsToScenes(data);

  if (rejected > 0) {
    console.info(
      `Образцы из «${sector.name}»: ${rejected} остались в секторе — нет мест`,
    );
  }

  if (assigned.length === 0) {
    return [];
  }

  return createToads(assigned, true);
};

/**
 * Итоговая добыча завершённого похода и его исход. Чистый расчёт: состояние
 * игрока не меняется — валюту/предметы выдаёт только `finishExpedition`.
 */
interface ArrivalLoot {
  success: boolean;
  loot: ExpeditionLoot;
  /** Сколько Кваксов добрано до нормы «поход выгоднее фермы» */
  floorTopUp: number;
  /** Вся плата за принудительную эвакуацию (кошелёк + рюкзак) */
  paidFee: number;
  /** Часть платы, которую удалось списать из кошелька сразу */
  walletFee: number;
}

/**
 * Считает итог похода: удачу, добычу с множителями и плату за эвакуацию.
 * `instant` (экстренный маяк) отключает множитель удачи и добор до нормы:
 * команда забирает ровно то, что уже добыла. Ничего не записывает в сохранение —
 * вызывающий сам решает, когда выдавать лут.
 */
const buildArrivalLoot = (
  expedition: Expedition,
  state: ReturnType<typeof getGameState>,
  options: { instant?: boolean },
): ArrivalLoot => {
  const sector = getSectorById(expedition.sectorId);
  const forced = Boolean(expedition.forced);
  const lossFactor = forced ? FORCED_LOOT_LOSS : 0;
  const instant = Boolean(options.instant);
  /**
   * Успех возможен только после того, как команда дошла до сектора и начала
   * обратный путь. `reachedSector` появился позже старых сейвов: для них
   * смотрим, начался ли возврат уже после прибытия в сектор.
   */
  const reachedSector =
    expedition.reachedSector ??
    (expedition.phase === "returning" &&
      Boolean(expedition.returnStartedAt) &&
      (expedition.returnStartedAt ?? 0) - expedition.startedAt >=
        sector.durationHours * HOUR_MS);

  // 0. Удачное завершение (Часть 5.4): каждая роль команды дала шанс, бросок — за нас.
  // Удача умножает добычу и добавляет шансы на образец и Астро-кваксы.
  // Успех невозможен без прибытия в сектор; маяк же не пересчитывает добычу,
  // поэтому даже при удачном броске множитель к ней не применяется.
  const successChance = expedition.successChance ?? 0;
  const success =
    !forced &&
    reachedSector &&
    Math.random() < Math.min(1, successChance);
  const finishFactor =
    !instant && success ? EXPEDITION_GOOD_FINISH_LOOT : 1;

  // 0.1 Норма «поход выгоднее фермы»: считаем, сколько те же жабы наработали бы
  // дома за время отсутствия (путь туда + обратно) и добираем добычу до нормы.
  // При немедленном завершении добора нет: игрок забирает только добытое.
  const awayHours =
    (Date.now() - expedition.startedAt) / HOUR_MS +
    (expedition.returnHours ?? 0);
  const teamToads = state.toads.filter((toad) =>
    expedition.team.some((member) => member.toadId === toad.id),
  );
  const profitFloor = getExpeditionProfitFloor(
    teamToads,
    awayHours,
    getExpeditionSendCost(sector, expedition.team.length),
  );
  const lootValue = getLootValue(expedition.loot);
  const floorTopUp = instant
    ? 0
    : Math.max(0, profitFloor - lootValue * finishFactor);

  // 1. Добыча: при экстренной эвакуации половина остаётся в секторе
  const biomass = Math.max(
    0,
    Math.round(expedition.loot.biomass * (1 - lossFactor) * finishFactor),
  );
  const tokens = Math.max(
    0,
    Math.round(
      expedition.loot.tokens * (1 - lossFactor) * finishFactor + floorTopUp,
    ),
  );
  const astro = Math.max(
    0,
    Math.round(expedition.loot.astro_quax * (1 - lossFactor) * finishFactor),
  );
  const items: Partial<Record<Items, number>> = {};

  Object.entries(expedition.loot.items).forEach(([item, amount]) => {
    const kept = forced
      ? Math.floor((amount || 0) * (1 - lossFactor))
      : amount || 0;
    if (kept > 0) {
      items[item as Items] = kept;
    }
  });

  // 2. Плата за принудительную эвакуацию (маяк — уже оплачен Астро-кваксами).
  // Сначала списываем из кошелька, недостающее — из добычи похода.
  const fee =
    forced && !options.instant
      ? FORCED_EXTRACTION_FEE_PER_TOAD * expedition.team.length
      : 0;
  const wallet = Math.max(0, state.user.biomass || 0);
  const walletFee = Math.min(fee, wallet);
  const lootFee = Math.min(fee - walletFee, biomass);

  return {
    success,
    loot: {
      biomass: Math.max(0, Math.round((biomass - lootFee) * 100) / 100),
      tokens,
      astro_quax: astro,
      items,
      samples: Math.max(0, Math.floor(expedition.loot.samples || 0)),
    },
    floorTopUp,
    paidFee: Math.round((walletFee + lootFee) * 100) / 100,
    walletFee,
  };
};

/**
 * Команда дома: фиксирует итог похода, снимает статусы и копит статистику.
 * Добыча остаётся в рюкзаке похода (`phase: "completed"`) — её разбирают
 * кнопками «Завершить» / «Превратить в биомассу» на вкладке «Походы».
 */
const completeArrival = (
  expedition: Expedition,
  options: { instant?: boolean } = {},
): string => {
  const state = getGameState();
  const sector = getSectorById(expedition.sectorId);
  const forced = Boolean(expedition.forced);
  const rawBiomass = expedition.loot.biomass;
  const rawTokens = expedition.loot.tokens;
  const arrival = buildArrivalLoot(expedition, state, options);
  const samplesCount = arrival.loot.samples;
  /** Пропуска КОНТУРа начисляем сразу при возврате команды, а не при разборе добычи */
  const contourPasses = getContourPassReward(sector);
  /**
   * Попутчики, присоединившиеся в пути. Дома их ждёт биопод: если места нет,
   * жаба не создаётся (склада жаб нет), а отчёт честно скажет об этом.
   */
  const pendingCompanions = expedition.companions ?? [];
  const companionPlacement = assignToadsToScenes(pendingCompanions);
  const companions = companionPlacement.assigned;
  expedition.companions = [];

  expedition.loot = arrival.loot;
  expedition.success = arrival.success;
  expedition.phase = "completed";
  expedition.completedAt = Date.now();
  expedition.progress = 1;

  if (arrival.walletFee > 0) {
    updateUser({
      biomass:
        Math.round(
          Math.max(0, (state.user.biomass || 0) - arrival.walletFee) * 100,
        ) / 100,
    });
  }

  // Статусы команды: 0 HP — «injured», остальные — «ok». Место в секторе
  // вернёт `finishExpedition`, когда игрок разберёт добычу.
  let downedNow = 0;
  const fresh = getGameState();
  const teamIds = new Set(expedition.team.map((member) => member.toadId));
  /**
   * Базовый риск похода: даже без события с плесенью команда может принести
   * болезнь домой. Бросок делается один раз на возврат, среди живых и здоровых
   * участников (`rollExpeditionDisease`).
   */
  const returningDisease = rollExpeditionDisease(
    fresh.toads.filter((toad) => teamIds.has(toad.id)),
  );
  const diseaseUntil = returningDisease
    ? Date.now() + returningDisease.disease.durationHours * HOUR_MS
    : 0;
  const toads = fresh.toads.map((toad) => {
    if (!teamIds.has(toad.id)) {
      return toad;
    }

    const maxHp = getToadMaxHp(toad);
    const hp = Math.max(0, Math.round(getToadHp(toad) * 100) / 100);
    const status: ToadStatus = hp > 0 ? "ok" : "injured";

    if (hp <= 0) {
      downedNow += 1;
    }

    if (returningDisease?.toad.id === toad.id) {
      return {
        ...toad,
        hp,
        maxHp,
        status,
        state: {
          ...toad.state,
          diseaseId: getDiseaseIndex(returningDisease.disease.id),
          diseaseUntil,
        },
      };
    }

    return { ...toad, hp, maxHp, status };
  });

  // Статистика и ачивки считаются при возврате — поход уже завершён, даже если
  // игрок ещё не нажал «Завершить». Сам поход остаётся в сохранении, чтобы
  // карточка с добычей дождалась решения игрока.
  const stats = getExpeditionStats();
  const expeditions = getExpeditions().map((item) =>
    item.id === expedition.id ? expedition : item,
  );

  completeAchivementCounter("expedition", 1);
  if (sector.depth >= 3) {
    completeAchivement("sector-depth-3");
  }
  if (sector.depth >= 6) {
    completeAchivement("sector-depth-6");
  }

  // 7. Отчёт для уведомления и чата похода
  const lootText = describeLoot({
    biomass: arrival.loot.biomass,
    tokens: arrival.loot.tokens,
    astro_quax: arrival.loot.astro_quax,
    items: arrival.loot.items,
    sample: samplesCount,
  });
  let summary = forced
    ? `Команда выбита в «${sector.name}» и вернулась на маяке: ${
        lootText || "пусто, зато живые"
      }`
    : options.instant
      ? `Экстренный маяк забрал команду из «${sector.name}»: ${
          lootText || "пусто, зато живые"
        }`
      : arrival.success
        ? `Удачный поход в «${sector.name}»: ${lootText || "пусто, зато живые"}`
        : `Поход в «${sector.name}» сложился неудачно: ${
            lootText || "пусто, зато живые"
          }`;

  if (arrival.success && !options.instant) {
    pushLog(expedition, {
      role: "system",
      kind: "good",
      text: `роли сложились (шанс ${Math.round(
        (expedition.successChance ?? 0) * 100,
      )}%): добыча ×${EXPEDITION_GOOD_FINISH_LOOT}`,
    });
  }
  if (arrival.floorTopUp > 0) {
    pushLog(expedition, {
      role: "system",
      kind: "info",
      text: `на обратном пути команда добрала норму: +${Math.round(
        arrival.floorTopUp,
      )} 🔷 (поход всегда выгоднее фермы)`,
    });
    summary += `. Добор до нормы: +${Math.round(arrival.floorTopUp)} 🔷`;
  }
  if (forced && FORCED_LOOT_LOSS > 0) {
    summary += `. Половина добычи осталась в секторе (−${Math.round(
      rawBiomass * FORCED_LOOT_LOSS,
    )} 🧪, −${Math.round(rawTokens * FORCED_LOOT_LOSS)} 🔷)`;
  }
  if (arrival.paidFee > 0) {
    summary += `. Эвакуация обошлась в ${arrival.paidFee} 🧪`;
  }
  if (downedNow > 0) {
    summary += `. Выбитых жаб: ${downedNow} — ждут лечения за Кваксы`;
  }
  if (returningDisease) {
    const { toad, disease } = returningDisease;
    pushLog(expedition, {
      role: "system",
      kind: "bad",
      text: `🦠 на обратном пути ${toad.name} подхватила «${disease.name}» — лечить дома, в Медотсеке или курсом за Кваксы`,
    });
    summary += `. 🦠 ${toad.name} принесла из похода «${disease.name}»`;
  }
  if (samplesCount > 0) {
    summary += `. В рюкзаке ${samplesCount} образц(ов) — при разборе добычи они поселятся в биоподах`;
  }
  if (pendingCompanions.length > 0) {
    if (companions.length > 0) {
      summary += `. 🐸 Попутчик(и) уже в биоподе: ${companions
        .map((toad) => `«${toad.name}»`)
        .join(", ")}`;
    }
    if (companionPlacement.rejected > 0) {
      summary += `. 🐸 ${companionPlacement.rejected} попутчик(ов) не поместилось в биопод — постройте новый`;
    }
  }
  summary += `. Пропуск(ов) КОНТУРа на складе: +${contourPasses} 🎫`;
  summary += `. Добыча ждёт разбора на вкладке «Походы»`;

  pushLog(expedition, {
    role: "system",
    kind: forced ? "bad" : arrival.success ? "good" : "info",
    text: summary,
  });

  const storedPasses = Math.max(
    0,
    Math.floor(fresh.user.storage?.[Items.contourPass] ?? 0),
  );

  updateGameState(
    {
      toads,
      expeditionStats: {
        ...stats,
        completed: stats.completed + 1,
        bestDepth: Math.max(stats.bestDepth, sector.depth),
        downed: stats.downed + downedNow,
      },
      expeditions,
      user: {
        ...fresh.user,
        storage: {
          ...fresh.user.storage,
          [Items.contourPass]: storedPasses + contourPasses,
        },
      },
    },
    true,
  );

  // Попутчиков создаём после записи статусов команды: `createToads` сам
  // разложит их по биоподам и запишет в сохранение, не затирая команду.
  if (companions.length > 0) {
    createToads(companions, true);
  }

  return summary;
};

/**
 * Хватает ли места на складе под предметы завершённого похода.
 * Кнопка «Завершить» в модалке разведки блокируется по этому ответу: лут,
 * который не влезет, игроку не показывают как «потерянный» — он ждёт склада.
 */
export const getExpeditionStorageCheck = (
  expedition: Expedition,
): { ok: boolean; needed: number; free: number } => {
  const needed = Object.values(expedition.loot.items ?? {}).reduce(
    (sum, amount) => sum + Math.max(0, Math.floor(amount || 0)),
    0,
  );
  const { free } = getStorageCapacityInfo();

  return {
    ok: canFitInStorage(getGameState().user.storage, expedition.loot.items),
    needed,
    free,
  };
};

/** Сколько биомассы даст переработка всей добычи похода */
export const getExpeditionBiomassValue = (expedition: Expedition): number =>
  getLootBiomassValue(expedition.loot);

/**
 * Возвращает команду в «Разведку», из которой она ушла (`originRoomId`).
 * Если исходного сектора уже нет, берём первую построенную «Разведку»; когда
 * разведки нет вовсе (или места в ней не хватило) — жабы расходятся по биоподам.
 */
const returnTeamToScout = (
  expedition: Expedition,
): { rejoined: number; home: number } => {
  const state = getGameState();
  const teamIds = new Set(expedition.team.map((member) => member.toadId));
  const scoutRooms = (state.colony?.rooms ?? []).filter(
    (room) => room.kind === "scout",
  );
  const target =
    scoutRooms.find((room) => isExpeditionFromRoom(expedition, room)) ??
    scoutRooms[0] ??
    null;
  /** Карта адресует «Разведку» по гексу: `Toad.scene_id` хранит именно этот id. */
  const targetRoomId = target ? (target.slotId ?? target.id) : null;
  /** Старый сейв мог помнить канонический id — при подсчёте мест принимаем оба. */
  const targetRoomIds =
    target === null ? null : new Set([target.id, target.slotId ?? target.id]);

  let used =
    targetRoomIds === null
      ? 0
      : state.toads.filter(
          (toad) =>
            typeof toad.scene_id === "string" &&
            targetRoomIds.has(toad.scene_id) &&
            !teamIds.has(toad.id),
        ).length;
  let rejoined = 0;
  let home = 0;

  const toads = state.toads.map((toad) => {
    if (!teamIds.has(toad.id)) {
      return toad;
    }

    const maxHp = getToadMaxHp(toad);
    const hp = Math.max(0, Math.round(getToadHp(toad) * 100) / 100);
    const status: ToadStatus = hp > 0 ? "ok" : "injured";
    const canRejoin = targetRoomId !== null && used < EXPEDITION_TEAM_SIZE;

    if (canRejoin) {
      used += 1;
      rejoined += 1;

      return {
        ...toad,
        hp,
        maxHp,
        status,
        scene_id: targetRoomId,
      };
    }

    home += 1;

    return {
      ...toad,
      hp,
      maxHp,
      status,
      scene_id: getToadHomeId(toad),
    };
  });

  updateGameState({ toads }, true);

  return { rejoined, home };
};

export type ExpeditionFinishMode = "storage" | "biomass";

export interface ExpeditionFinishResult extends ExpeditionActionResult {
  /** Сколько биомассы начислено при переработке лута */
  biomassGained?: number;
  /** Сколько жаб вернулось в «Разведку» */
  returnedToScout?: number;
}

/**
 * Разобрать добычу завершённого похода:
 *
 * - `storage` — предметы на склад, биомасса/Кваксы/Астро-кваксы в кошелёк,
 *   образцы вырастают в жаб в биоподах. Если на складе нет места на все
 *   предметы, действие не проходит (кнопка «Завершить» заблокирована);
 * - `biomass` — весь лут, включая предметы и образцы, перерабатывается в
 *   биомассу по курсу рынка (см. `getLootBiomassValue`).
 *
 * После любого варианта команда возвращается в «Разведку», а карточка
 * завершённого похода исчезает с вкладки «Походы».
 */
export const finishExpedition = (
  id: string,
  mode: ExpeditionFinishMode,
): ExpeditionFinishResult => {
  const state = getGameState();
  const expedition = (state.expeditions ?? []).find((item) => item.id === id);

  if (!expedition) {
    return { success: false, message: "Поход не найден" };
  }
  if (expedition.phase !== "completed") {
    return { success: false, message: "Поход ещё не завершён" };
  }

  const sector = getSectorById(expedition.sectorId);
  let message = "";
  let biomassGained: number | undefined;

  if (mode === "storage") {
    const check = getExpeditionStorageCheck(expedition);
    if (!check.ok) {
      return {
        success: false,
        message: `На складе нет места: нужно ${check.needed}, свободно ${check.free} — постройте «Склад» или переработайте лут в биомассу`,
      };
    }

    const storage = { ...state.user.storage };
    const accepted = fitItemsInStorage(storage, expedition.loot.items);
    let acceptedCount = 0;

    Object.entries(accepted).forEach(([item, amount]) => {
      const key = item as Items;
      storage[key] = (storage[key] || 0) + (amount || 0);
      acceptedCount += amount || 0;
    });

    const requestedSamples = Math.min(expedition.loot.samples, 3);
    const samples =
      requestedSamples > 0 ? createSampleToads(requestedSamples, sector) : [];

    updateUser({
      biomass:
        Math.round(
          ((state.user.biomass || 0) + expedition.loot.biomass) * 100,
        ) / 100,
      tokens: (state.user.tokens || 0) + expedition.loot.tokens,
      astro_quax: (state.user.astro_quax || 0) + expedition.loot.astro_quax,
      storage,
    });

    const lootText = describeLoot({
      biomass: expedition.loot.biomass,
      tokens: expedition.loot.tokens,
      astro_quax: expedition.loot.astro_quax,
      items: accepted,
      sample: samples.length,
    });
    message = `Добыча со склада: ${lootText || "пусто, зато живые"}`;

    if (acceptedCount < check.needed) {
      message += `. ${check.needed - acceptedCount} предмет(ов) не влезли на склад`;
    }
    if (samples.length < requestedSamples) {
      message += `. ${requestedSamples - samples.length} образц(ов) осталось в секторе — нет мест в биоподах`;
    }
  } else if (mode === "biomass") {
    biomassGained = getLootBiomassValue(expedition.loot);
    updateUser({
      biomass:
        Math.round(((state.user.biomass || 0) + biomassGained) * 100) / 100,
    });
    message = `Лут с «${sector.name}» переработан в ${biomassGained} 🧪`;
  } else {
    return { success: false, message: "Неизвестный способ разбора добычи" };
  }

  const returned = returnTeamToScout(expedition);
  const remaining = getExpeditions().filter(
    (item) => item.id !== expedition.id,
  );
  updateGameState({ expeditions: remaining }, true);

  if (returned.rejoined > 0) {
    message += `. Жабы вернулись в «Разведку»: ${returned.rejoined}`;
  }
  if (returned.home > 0) {
    message += `. В биоподы вернулись: ${returned.home}`;
  }

  return {
    success: true,
    message,
    expedition,
    biomassGained,
    returnedToScout: returned.rejoined,
  };
};

// === Регенерация HP дома (Часть 2) ===

/**
 * Пассивное восстановление HP у жаб, которые не в походе, и снятие «залипших»
 * статусов после рейда. Возвращает число жаб, которых подлечили.
 *
 * Скорость зависит от места: на койке Медотсека HP идёт в разы быстрее, чем дома
 * (`getHpRegenPerHour` из `utils/hospital.ts`) — без Медотсека раны затягиваются
 * очень медленно.
 */
export const processHpRegen = (hoursPassed: number): number => {
  if (!Number.isFinite(hoursPassed) || hoursPassed <= 0) {
    return 0;
  }

  const state = getGameState();
  const expeditions = state.expeditions ?? [];
  const hospitalIds = getHospitalRoomIds(state.colony);
  let touched = 0;

  const toads = state.toads.map((toad) => {
    if (isToadOnExpedition(toad.id, expeditions)) {
      return toad;
    }

    const maxHp = getToadMaxHp(toad);
    const hp = getToadHp(toad);
    const nextHp = Math.min(
      maxHp,
      Math.round(
        (hp + getHpRegenPerHour(toad, hospitalIds) * hoursPassed) * 100,
      ) / 100,
    );
    const nextStatus: ToadStatus = nextHp > 0 ? "ok" : "injured";

    if (nextHp === hp && toad.status === nextStatus && toad.maxHp === maxHp) {
      return toad;
    }

    touched += 1;
    return { ...toad, hp: nextHp, maxHp, status: nextStatus };
  });

  if (touched === 0) {
    return 0;
  }

  updateGameState({ toads }, true);
  return touched;
};

// === UI-хелперы ===

/** Прогресс похода 0..1 по реальному времени */
export const getExpeditionProgress = (
  expedition: Expedition,
  now = Date.now(),
): number => {
  if (expedition.phase === "completed") {
    return 1;
  }

  if (expedition.phase === "returning") {
    return 1;
  }

  const sector = getSectorById(expedition.sectorId);
  return clamp(
    (now - expedition.startedAt) / (sector.durationHours * HOUR_MS),
    0,
    1,
  );
};

/** Сколько миллисекунд осталось до прибытия (в сектор или домой) */
export const getExpeditionEtaMs = (
  expedition: Expedition,
  now = Date.now(),
): number => {
  if (expedition.phase === "completed") {
    return 0;
  }

  const sector = getSectorById(expedition.sectorId);

  if (expedition.phase === "outbound") {
    return Math.max(
      0,
      expedition.startedAt + sector.durationHours * HOUR_MS - now,
    );
  }

  return getReturnRemainingHours(expedition, now) * HOUR_MS;
};

/** Прогресс обратного пути 0..1 */
export const getReturnProgress = (
  expedition: Expedition,
  now = Date.now(),
): number => {
  if (expedition.phase !== "returning" || !expedition.returnHours) {
    return 0;
  }

  return clamp(
    1 - getReturnRemainingHours(expedition, now) / expedition.returnHours,
    0,
    1,
  );
};

/** Состояние команды похода: HP, бары и «выбитые» жабы — для модалки */
export const getExpeditionTeamStatus = (expedition: Expedition) => {
  const state = getGameState();

  return expedition.team.map((member) => {
    const toad = state.toads.find((item) => item.id === member.toadId);
    const maxHp = toad ? getToadMaxHp(toad) : 0;
    const hp = toad ? Math.max(0, Math.round(getToadHp(toad))) : 0;

    return {
      member,
      toad,
      hp,
      maxHp,
      down: hp <= 0,
      ratio: maxHp > 0 ? hp / maxHp : 0,
    };
  });
};

/** Жабы, которых можно отправить в поход (взрослые, здоровые, не занятые) */
export const getAvailableToads = (): Toad[] => {
  const state = getGameState();
  const expeditions = state.expeditions ?? [];

  return state.toads.filter((toad) => canSendToad(toad, expeditions).ok);
};

/** ID всех жаб, которые сейчас в походах */
export const getActiveExpeditionToadIds = (): number[] =>
  getExpeditions().flatMap((expedition) =>
    expedition.team.map((member) => member.toadId),
  );

/** Добыча «в рюкзаке» одной строкой — для карточек активного похода */
export const getExpeditionLootSummary = (expedition: Expedition): string =>
  describeLoot({
    biomass: expedition.loot.biomass,
    tokens: expedition.loot.tokens,
    astro_quax: expedition.loot.astro_quax,
    items: expedition.loot.items,
    sample: expedition.loot.samples,
  }) || "пока пусто";
