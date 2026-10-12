import {
  Expedition,
  ExpeditionLoot,
  ExpeditionMember,
  ExpeditionRole,
  ExpeditionStats,
  SectorDef,
  createEmptyLoot,
  DEFAULT_EXPEDITION_STATS,
  getSectorById,
  isSectorUnlocked,
} from "../models/expedition";
import { Toad, ToadStatus } from "../models/Toad";
import { ToadTypes } from "../models/Toad/toad-species";
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
import { fitItemsInStorage } from "./storage";
import {
  EXTRACTION_ASTRO_COST,
  EXPEDITION_BASE_EVENT_CHANCE,
  EXPEDITION_DANGER_CHANCE_PENALTY,
  EXPEDITION_EVENT_PROGRESS_STEP,
  EXPEDITION_GOOD_FINISH_LOOT,
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
  getExpeditionProfitFloor,
  getExpeditionSendCost,
  getExpeditionSuccessChance,
  getHealCost,
  getLootValue,
  getMaxExpeditions,
  getReturnRemainingHours,
  getRolePower,
  getSectorLootFactor,
  getSpeedUpReturnCost,
  getToadHp,
  getToadMaxHp,
  isToadDown,
  rollExpeditionLuck,
} from "./expedition-config";
import {
  ExpeditionEventContext,
  ExpeditionEventMember,
  ExpeditionLootDelta,
  describeLoot,
  pickExpeditionEvent,
} from "./expedition-events";
import { ExpeditionTeamMember, getSectorSuccessFactor } from "./expedition-config";
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

export const getExpeditions = (): Expedition[] => getGameState().expeditions ?? [];

export const getExpeditionStats = (): ExpeditionStats => ({
  ...DEFAULT_EXPEDITION_STATS,
  ...(getGameState().expeditionStats ?? {}),
});

export const getExpeditionById = (id: string): Expedition | undefined =>
  getExpeditions().find((expedition) => expedition.id === id);

/** Поход, в котором участвует жаба (или undefined) */
export const getToadExpedition = (
  toadId: number,
  expeditions: Expedition[] = getExpeditions()
): Expedition | undefined =>
  expeditions.find((expedition) =>
    expedition.team.some((member) => member.toadId === toadId)
  );

/** Жаба сейчас в походе */
export const isToadOnExpedition = (
  toadId: number,
  expeditions: Expedition[] = getExpeditions()
): boolean => Boolean(getToadExpedition(toadId, expeditions));

/** Сколько команд может быть одновременно (Диспетчерская) */
export const getTeamLimit = (): number =>
  getMaxExpeditions(getGameState().user.dispatchLevel ?? 0);

/** Можно ли взять жабу в поход */
export const canSendToad = (
  toad: Toad,
  expeditions: Expedition[] = getExpeditions()
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
  // Пара в гнезде: жаба занята ухаживанием (Часть 3.2)
  if (toad.mating) {
    return { ok: false, reason: "ухаживает в гнезде" };
  }
  if (getIncubatingToadIds().includes(toad.id)) {
    return { ok: false, reason: "в инкубаторе" };
  }
  return { ok: true };
};

/** Прогресс открытия сектора для UI */
export const getSectorUnlockStatus = (
  sector: SectorDef,
  stats: ExpeditionStats = getExpeditionStats()
): { unlocked: boolean; completed: number; required: number } => ({
  unlocked: isSectorUnlocked(sector, stats),
  completed: stats.completed,
  required: sector.unlockExpeditions,
});

// === Отправка команды ===

/**
 * Отправить команду в сектор.
 * Списывает биомассу на снаряжение, помечает жаб `status: "out"` и заводит запись
 * похода. Уходя, жаба освобождает место в комнате (`roomId` сбрасывается): она в
 * походе, а не в ⚡-комнате или «Разведке» — двух мест сразу не бывает. Вернувшись,
 * жаба оказывается в вольере, и её сажают на место заново.
 */
export const startExpedition = (
  sectorId: number,
  members: ExpeditionMember[]
): ExpeditionActionResult => {
  const state = getGameState();
  const sector = getSectorById(sectorId);
  const stats = getExpeditionStats();

  if (!isSectorUnlocked(sector, stats)) {
    return {
      success: false,
      message: `Сектор закрыт: завершите ${sector.unlockExpeditions} походов`,
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
  if (expeditions.length >= limit) {
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
        state.user.biomass || 0
      )})`,
    };
  }

  const now = Date.now();

  updateUser({
    biomass: Math.round(((state.user.biomass || 0) - cost) * 100) / 100,
  });

  // Уход в поход освобождает место: жаба в походе, а не в комнате, спрайт скрыт
  toads.forEach((toad) => {
    updateToadById(toad.id, getAwayToadUpdate(toad), true);
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
      rollExpeditionLuck()
    ),
    loot: createEmptyLoot(),
    log: [],
  };

  pushLog(expedition, {
    role: "system",
    kind: "info",
    text: `команда из ${team.length} жаб ушла в «${sector.name}» − снаряжение ${cost} 🧪`,
  });

  pushLog(expedition, {
    role: "system",
    kind: "info",
    text: `шанс вернуться с удачей: ${Math.round(
      (expedition.successChance ?? 0) * 100
    )}% (каждая роль даёт +20%, сложность сектора ×${getSectorSuccessFactor(
      sector
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
  forced: boolean
): void => {
  const progress = Math.max(expedition.progress, getExpeditionProgress(expedition, now));
  const traveledHours = Math.max(0.05, progress * sector.durationHours);

  expedition.progress = progress;
  expedition.phase = "returning";
  expedition.returnStartedAt = now;
  expedition.returnHours = Math.max(
    EXPEDITION_MIN_RETURN_HOURS,
    Math.round(traveledHours * EXPEDITION_RETURN_RATIO * 100) / 100
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
  if (expedition.phase === "returning") {
    return { success: false, message: "Команда уже возвращается" };
  }

  startReturn(expedition, getSectorById(expedition.sectorId), Date.now(), false);
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

  expedition.returnStartedAt = returnStartedAt + remainingMs / 2;
  expedition.speedups = (expedition.speedups || 0) + 1;

  pushLog(expedition, {
    role: "system",
    kind: "info",
    text: `подкупили проводника за ${cost} 🧪 — путь домой вдвое короче`,
  });

  updateUser({
    biomass: Math.round(((state.user.biomass || 0) - cost) * 100) / 100,
  });
  updateGameState({ expeditions: [...expeditions] }, true);

  return { success: true, message: `Возврат ускорен за ${cost} 🧪`, expedition };
};

/** «Экстренный маяк»: моментально вытащить команду за Астро-кваксы */
export const extractExpedition = (
  id: string,
  addNotification?: (notification: any) => void
): ExpeditionActionResult => {
  const state = getGameState();
  const expedition = getExpeditionById(id);

  if (!expedition) {
    return { success: false, message: "Поход не найден" };
  }

  const astro = state.user.astro_quax || 0;
  if (astro < EXTRACTION_ASTRO_COST) {
    return {
      success: false,
      message: `Маяк стоит ${EXTRACTION_ASTRO_COST} 💎 (сейчас ${astro})`,
    };
  }

  updateUser({ astro_quax: astro - EXTRACTION_ASTRO_COST });
  const summary = applyArrival(expedition, { instant: true });

  addNotification?.({
    type: "success",
    content: `🚁 Экстренный маяк: команда дома. ${summary}`,
  });

  return { success: true, message: "Команда эвакуирована маяком" };
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
  onDowned?: (name: string) => void
): { ctx: ExpeditionEventContext; roles: ExpeditionRole[] } => {
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
      (member) => member.toadId !== tank?.toadId
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
    return toad ? getToadDisease(toad)?.name ?? "кибер-болезнь" : null;
  };

  /** Шанс успеха = база + сила роли − опасность сектора, с поправкой на раны */
  const check = (
    member: ExpeditionEventMember,
    baseChance = EXPEDITION_BASE_EVENT_CHANCE
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
        0.95
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
    log: (entry) => pushLog(expedition, entry),
    rng,
  };

  return { ctx, roles: aliveMembers().map((member) => member.role) };
};

/** Один шаг пути: тянем случайное событие и разыгрываем его */
const runExpeditionStep = (
  expedition: Expedition,
  sector: SectorDef,
  runtime: TeamRuntime,
  onDowned?: (name: string) => void
): ExpeditionEventContext => {
  const { ctx, roles } = buildEventContext(
    expedition,
    sector,
    runtime,
    Math.random,
    onDowned
  );
  pickExpeditionEvent(roles).run(ctx);
  return ctx;
};

/** Сколько шагов событий уже «наступило» по часам */
const getStepsDue = (
  expedition: Expedition,
  sector: SectorDef,
  now: number
): number => {
  const totalMs = sector.durationHours * HOUR_MS;
  const elapsed = Math.max(0, now - expedition.startedAt);

  if (elapsed >= totalMs) {
    return STEPS_TOTAL;
  }

  return Math.min(
    STEPS_TOTAL,
    Math.floor(elapsed / (totalMs * EXPEDITION_EVENT_PROGRESS_STEP)) + 1
  );
};

/**
 * Прогон всех активных походов: разыгрывает наступившие события, отправляет
 * команды домой и выдаёт добычу. Идемпотентно — можно звать хоть каждый кадр.
 */
export const processExpeditions = (
  addNotification?: (notification: any) => void
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
          (member) => (runtime.hp.get(member.toadId) ?? 0) > 0
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
          expedition.resolvedSteps * EXPEDITION_EVENT_PROGRESS_STEP
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
          startReturn(expedition, sector, now, false);
          dirty = true;
        }
      }
    }

    if (expedition.phase === "returning") {
      const eta =
        (expedition.returnStartedAt || now) +
        (expedition.returnHours || 0) * HOUR_MS;

      if (now >= eta) {
        const summary = applyArrival(expedition);
        result.arrivals += 1;
        dirty = true;
        addNotification?.({ type: "success", content: `🏠 ${summary}` });
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
      rarity: Math.round((1 + sector.depth * 0.8 + Math.random() * 2) * 10) / 10,
      hungerRate: Math.round((0.6 + Math.random() * 0.9) * 100) / 100,
      fertility:
        Math.round((0.7 + Math.random() * (0.6 + sector.depth * 0.15)) * 100) /
        100,
      personality:
        personalities[Math.floor(Math.random() * personalities.length)],
    },
  }));

  // Склада жаб больше нет: образец живёт только в вольере. Сколько мест — столько жаб,
  // остальные образцы остаются в секторе (о них скажет отчёт похода).
  const { assigned, rejected } = assignToadsToScenes(data);

  if (rejected > 0) {
    console.info(`Образцы из «${sector.name}»: ${rejected} остались в секторе — нет мест`);
  }

  if (assigned.length === 0) {
    return [];
  }

  return createToads(assigned, true);
};

/**
 * Команда дома: выдаёт «рюкзак» в валюту и склад, снимает статусы, копит
 * статистику и удаляет поход из активных. Возвращает текст отчёта.
 */
const applyArrival = (
  expedition: Expedition,
  options: { instant?: boolean } = {}
): string => {
  const state = getGameState();
  const sector = getSectorById(expedition.sectorId);
  const forced = Boolean(expedition.forced);
  const lossFactor = forced ? FORCED_LOOT_LOSS : 0;

  // 0. Удачное завершение (Часть 5.4): каждая роль команды дала шанс, бросок — за нас.
  // Удача умножает добычу и добавляет шансы на образец и Астро-кваксы.
  const successChance = expedition.successChance ?? 0;
  const goodFinish = !forced && Math.random() < Math.min(1, successChance);
  const finishFactor = goodFinish ? EXPEDITION_GOOD_FINISH_LOOT : 1;

  // 0.1 Норма «поход выгоднее фермы»: считаем, сколько те же жабы наработали бы
  // дома за время отсутствия (путь туда + обратно) и добираем добычу до нормы.
  const awayHours =
    (Date.now() - expedition.startedAt) / HOUR_MS +
    (expedition.returnHours ?? 0);
  const teamToads = state.toads.filter((toad) =>
    expedition.team.some((member) => member.toadId === toad.id)
  );
  const profitFloor = getExpeditionProfitFloor(
    teamToads,
    awayHours,
    getExpeditionSendCost(sector, expedition.team.length)
  );
  const lootValue = getLootValue(expedition.loot);
  const floorTopUp = Math.max(0, profitFloor - lootValue * finishFactor);

  // 1. Добыча: при экстренной эвакуации половина остаётся в секторе
  const biomass = Math.max(
    0,
    Math.round(expedition.loot.biomass * (1 - lossFactor) * finishFactor)
  );
  const tokens = Math.max(
    0,
    Math.round(
      expedition.loot.tokens * (1 - lossFactor) * finishFactor + floorTopUp
    )
  );
  const astro = Math.max(
    0,
    Math.round(expedition.loot.astro_quax * (1 - lossFactor) * finishFactor)
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

  // 2. Плата за принудительную эвакуацию (маяк — уже оплачен Астро-кваксами)
  const fee =
    forced && !options.instant
      ? FORCED_EXTRACTION_FEE_PER_TOAD * expedition.team.length
      : 0;
  const walletBiomass = Math.max(0, (state.user.biomass || 0) + biomass);
  const paidFee = Math.min(fee, walletBiomass);

  // 3. Валюта и склад: склад предметов ограничен постройками «Склад», поэтому
  //    излишки, которые не влезли на полки, остаются в секторе.
  const storage = { ...state.user.storage };
  const acceptedItems = fitItemsInStorage(storage, items);
  Object.entries(acceptedItems).forEach(([item, amount]) => {
    const key = item as Items;
    storage[key] = (storage[key] || 0) + (amount || 0);
  });

  const lostItems = Object.entries(items).reduce(
    (sum, [item, amount]) =>
      sum + Math.max(0, (amount || 0) - (acceptedItems[item as Items] || 0)),
    0
  );

  if (lostItems > 0) {
    pushLog(expedition, {
      role: "system",
      kind: "bad",
      text: `на складе не нашлось места: ${lostItems} предмет(ов) осталось в секторе`,
    });
  }

  updateUser({
    biomass: walletBiomass - paidFee,
    tokens: (state.user.tokens || 0) + tokens,
    astro_quax: (state.user.astro_quax || 0) + astro,
    storage,
  });

  // 4. Образцы вырастают в жаб
  const samples = createSampleToads(expedition.loot.samples, sector);

  // 5. Статусы команды: 0 HP — «injured», остальные — «ok»
  let downedNow = 0;
  const fresh = getGameState();
  expedition.team.forEach((member) => {
    const toad = fresh.toads.find((item) => item.id === member.toadId);
    if (!toad) {
      return;
    }
    const maxHp = getToadMaxHp(toad);
    const hp = Math.max(0, Math.round(getToadHp(toad) * 100) / 100);

    if (hp <= 0) {
      downedNow += 1;
    }

    updateToadById(
      member.toadId,
      { hp, maxHp, status: hp > 0 ? "ok" : "injured" },
      true
    );
  });

  // 6. Статистика, ачивки и удаление похода
  const stats = getExpeditionStats();
  updateGameState(
    {
      expeditionStats: {
        completed: stats.completed + 1,
        bestDepth: Math.max(stats.bestDepth, sector.depth),
        downed: stats.downed + downedNow,
      },
      expeditions: getExpeditions().filter((item) => item.id !== expedition.id),
    },
    true
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
    biomass,
    tokens,
    astro_quax: astro,
    items,
    sample: samples.length,
  });
  let summary = goodFinish
    ? `Удачный поход в «${sector.name}»: ${lootText || "пусто, зато живые"}`
    : `Команда вернулась из «${sector.name}»: ${
        lootText || "пусто, зато живые"
      }`;

  if (goodFinish) {
    pushLog(expedition, {
      role: "system",
      kind: "good",
      text: `роли сложились (шанс ${Math.round(
        successChance * 100
      )}%): добыча ×${EXPEDITION_GOOD_FINISH_LOOT}`,
    });
  }
  if (floorTopUp > 0) {
    pushLog(expedition, {
      role: "system",
      kind: "info",
      text: `на обратном пути команда добрала норму: +${Math.round(
        floorTopUp
      )} 🔷 (поход всегда выгоднее фермы)`,
    });
    summary += `. Добор до нормы: +${Math.round(floorTopUp)} 🔷`;
  }
  if (lostItems > 0) {
    summary += `. ${lostItems} предмет(ов) не влезли на склад — постройте «Склад»`;
  }

  if (forced && lossFactor > 0) {
    summary += `. Половина добычи осталась в секторе (−${Math.round(
      expedition.loot.biomass - biomass
    )} 🧪, −${Math.round(expedition.loot.tokens - tokens)} 🔷)`;
  }
  if (paidFee > 0) {
    summary += `. Эвакуация обошлась в ${paidFee} 🧪`;
  }
  if (downedNow > 0) {
    summary += `. Выбитых жаб: ${downedNow} — ждут лечения за Кваксы`;
  }
  if (samples.length > 0) {
    summary += `. В инвентаре новые образцы: ${samples
      .map((toad) => toad.name)
      .join(", ")}`;
  }

  pushLog(expedition, {
    role: "system",
    kind: forced ? "bad" : "good",
    text: summary,
  });

  return summary;
};

// === Регенерация HP дома (Часть 2) ===

/**
 * Пассивное восстановление HP у жаб, которые не в походе, и снятие «залипших»
 * статусов после рейда. Возвращает число жаб, которых подлечили.
 *
 * Скорость зависит от места: на койке лазарета HP идёт в разы быстрее, чем дома
 * (`getHpRegenPerHour` из `utils/hospital.ts`) — без лазарета раны затягиваются
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
        (hp + getHpRegenPerHour(toad, hospitalIds) * hoursPassed) * 100
      ) / 100
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
  now = Date.now()
): number => {
  if (expedition.phase === "returning") {
    return 1;
  }

  const sector = getSectorById(expedition.sectorId);
  return clamp((now - expedition.startedAt) / (sector.durationHours * HOUR_MS), 0, 1);
};

/** Сколько миллисекунд осталось до прибытия (в сектор или домой) */
export const getExpeditionEtaMs = (
  expedition: Expedition,
  now = Date.now()
): number => {
  const sector = getSectorById(expedition.sectorId);

  if (expedition.phase === "outbound") {
    return Math.max(
      0,
      expedition.startedAt + sector.durationHours * HOUR_MS - now
    );
  }

  return getReturnRemainingHours(expedition, now) * HOUR_MS;
};

/** Прогресс обратного пути 0..1 */
export const getReturnProgress = (
  expedition: Expedition,
  now = Date.now()
): number => {
  if (expedition.phase !== "returning" || !expedition.returnHours) {
    return 0;
  }

  return clamp(
    1 - getReturnRemainingHours(expedition, now) / expedition.returnHours,
    0,
    1
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
    expedition.team.map((member) => member.toadId)
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
