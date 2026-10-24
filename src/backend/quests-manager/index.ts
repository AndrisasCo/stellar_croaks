import { updateUser } from "../index";
import { getGameState, GameState } from "../localStorage";
import { normalizeExpeditionStats, SECTORS } from "../../models/expedition";
import { countExpeditionReserveRoles } from "../../utils/expedition-config";
import { isToadSick } from "../../models/disease";
import { Items } from "../../models/user";
import {
  QUESTS,
  QuestDef,
  QuestEvent,
  QuestGoal,
  QuestMetric,
  QuestReward,
  QuestTrigger,
  getQuestById,
} from "./quests-list";
import {
  QUEST_SESSION_STARTED_AT,
  QuestJournalState,
  getQuestJournalState,
  registerQuestJournalSession,
  updateQuestJournalState,
} from "./storage";

/**
 * ДВИЖОК ЖУРНАЛА ЗАДАНИЙ.
 *
 * Каталог (`quests-list.ts`) описывает задания, а этот модуль:
 *  1. считает показатели игры (`getQuestMetrics`);
 *  2. открывает задания по триггерам и отмечает выполненные;
 *  3. отдаёт готовый снимок для HUD и модалки;
 *  4. выдаёт награды по кнопке — автоматически ничего не начисляется.
 *
 * Сохранение — только журнальное состояние (`storage.ts`): открытые/выполненные/
 * забранные задания и счётчики событий. Ресурсы, комнаты и секторы всегда
 * читаются из `GameState`, поэтому прогресс не может «отстать» от игры.
 */

/** Полный набор показателей, по которым могут быть цели и триггеры. */
export type QuestMetrics = Record<QuestMetric, number>;

/** Снимок одного задания для UI. */
export interface QuestJournalEntry {
  quest: QuestDef;
  status: "locked" | "active" | "ready" | "claimed";
  /** Текущее значение цели (для проверки выполнения). */
  value: number;
  /** Значение, которое показывается на полосе прогресса. */
  progress: number;
  target: number;
  percent: number;
  label: string;
  activatedAt?: number;
  completedAt?: number;
  claimedAt?: number;
}

export interface QuestJournalSnapshot {
  entries: QuestJournalEntry[];
  /** Готовые к награде — именно они рисуют бейдж на иконке журнала. */
  ready: QuestJournalEntry[];
  /** Открытые, но ещё не выполненные. */
  active: QuestJournalEntry[];
  claimed: QuestJournalEntry[];
  counts: {
    total: number;
    active: number;
    ready: number;
    claimed: number;
    locked: number;
  };
  metrics: QuestMetrics;
  state: QuestJournalState;
}

export interface ClaimQuestResult {
  success: boolean;
  message: string;
  quest?: QuestDef;
  rewards?: QuestReward;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const countRooms = (state: GameState, kind: string): number =>
  (state.colony?.rooms ?? []).filter((room) => room.kind === kind).length;

const storageAmount = (state: GameState, item: Items): number =>
  Number(state.user.storage?.[item] ?? 0);

const uniqueSpecies = (state: GameState): number =>
  new Set(
    state.toads
      .map((toad) => toad.type)
      .filter((type): type is NonNullable<typeof type> => Boolean(type)),
  ).size;

/**
 * Считает все показатели за один проход по сейву. Функция чистая относительно
 * игры: ничего не пишет и не меняет `GameState`.
 */
export const getQuestMetrics = (
  state: GameState = getGameState(),
): QuestMetrics => {
  const stats = normalizeExpeditionStats(state.expeditionStats);
  const journal = getQuestJournalState();
  const createdAt = Date.parse(state.createdAt);

  return {
    toads: state.toads.length,
    adultToads: state.toads.filter((toad) => toad.stage === "adult").length,
    toadSpecies: uniqueSpecies(state),
    generation2Plus: state.toads.filter((toad) => toad.generation >= 2).length,
    toadsWithParents: state.toads.filter(
      (toad) => Array.isArray(toad.parents) && toad.parents.length > 0,
    ).length,
    expeditionReserveRoles: countExpeditionReserveRoles(state.toads),
    rooms: (state.colony?.rooms ?? []).length,
    aviaryRooms: countRooms(state, "aviary"),
    breedingRooms: countRooms(state, "breeding"),
    colliderRooms: countRooms(state, "collider"),
    scoutRooms: countRooms(state, "scout"),
    shopRooms: countRooms(state, "shop"),
    hospitalRooms: countRooms(state, "hospital"),
    powerRooms: countRooms(state, "power"),
    storageRooms: countRooms(state, "storage"),
    tokens: Number(state.user.tokens ?? 0),
    astroQuax: Number(state.user.astro_quax ?? 0),
    food: storageAmount(state, Items.food),
    lootboxes: storageAmount(state, Items.lootbox),
    geneDust: storageAmount(state, Items.geneDust),
    contourPass: storageAmount(state, Items.contourPass),
    completedSectors: (stats.completedSectors ?? []).length,
    unlockedSectors: (stats.unlockedSectors ?? []).length,
    lastSectorCompleted: (stats.completedSectors ?? []).includes(
      SECTORS[SECTORS.length - 1]?.id ?? -1,
    )
      ? 1
      : 0,
    completedExpeditions: stats.completed,
    bestDepth: stats.bestDepth,
    playDays:
      Number.isFinite(createdAt) && createdAt > 0
        ? Math.floor((Date.now() - createdAt) / DAY_MS)
        : 0,
    sessions: journal.sessions,
    sickToads: state.toads.filter(isToadSick).length,
    fedToads: journal.counters.toad_fed ?? 0,
    foodBought: journal.counters.food_bought ?? 0,
    lootboxOpened: journal.counters.lootbox_opened ?? 0,
    curedToads: journal.counters.toad_cured ?? 0,
    diseaseOutbreaks: journal.counters.disease_outbreak ?? 0,
  };
};

/**
 * Проверяет триггер. `completed` — уже выполненные задания: цепочка открывает
 * следующее задание только после выполнения предыдущего, а не после получения
 * награды, иначе игрок мог бы «застрять» на незабранном подарке.
 */
export const isQuestTriggerMet = (
  trigger: QuestTrigger,
  metrics: QuestMetrics,
  completed: readonly string[],
): boolean => {
  switch (trigger.type) {
    case "always":
      return true;
    case "chain":
      return completed.includes(trigger.parentId);
    case "metric":
      return metrics[trigger.metric] >= trigger.value;
    case "event": {
      const journal = getQuestJournalState();

      return (journal.counters[trigger.event] ?? 0) >= (trigger.value ?? 1);
    }
    case "time": {
      const daysMet =
        trigger.days === undefined || metrics.playDays >= trigger.days;
      const minutesMet =
        trigger.minutes === undefined ||
        Date.now() - QUEST_SESSION_STARTED_AT >= trigger.minutes * MINUTE_MS;

      return daysMet && minutesMet;
    }
    case "all":
      return trigger.triggers.every((part) =>
        isQuestTriggerMet(part, metrics, completed),
      );
    default:
      return false;
  }
};

/** Достигнута ли цель задания. */
const isGoalMet = (goal: QuestGoal, metrics: QuestMetrics): boolean =>
  metrics[goal.metric] >= goal.target;

const progressOf = (
  goal: QuestGoal,
  metrics: QuestMetrics,
): { progress: number; target: number } => {
  const target = Math.max(1, goal.progressTarget ?? goal.target);
  const raw = metrics[goal.progressMetric ?? goal.metric] ?? 0;

  return { progress: Math.min(Math.max(0, raw), target), target };
};

/** События, которые движок рассылает после изменения журнала. */
export const QUEST_JOURNAL_UPDATED_EVENT = "questJournalUpdated";

const dispatchJournalUpdated = (detail: {
  activated: string[];
  completed: string[];
}) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(QUEST_JOURNAL_UPDATED_EVENT, { detail }),
  );
};

export interface RefreshQuestJournalOptions {
  /** Снимок игры: нужен проверкам, чтобы не перечитывать localStorage. */
  state?: GameState;
  /** Рассылать `questJournalUpdated` (по умолчанию да). */
  dispatch?: boolean;
}

/**
 * Открывает задания по триггерам и отмечает выполненные.
 *
 * Проходы повторяются, пока есть изменения: задание-цепочка открывается после
 * выполнения родителя, а выполниться может в том же обновлении — например,
 * игрок купил корм и сразу получил задание «купите корм». Максимум проходов
 * ограничен числом заданий, поэтому зациклиться невозможно.
 */
export const refreshQuestJournal = (
  options: RefreshQuestJournalOptions = {},
): QuestJournalState => {
  const journal = registerQuestJournalSession();
  const game = options.state ?? getGameState();
  const metrics = getQuestMetrics(game);
  const now = Date.now();

  const activated = [...journal.activated];
  const completed = [...journal.completed];
  const activatedAt = { ...journal.activatedAt };
  const completedAt = { ...journal.completedAt };
  const newActivated: string[] = [];
  const newCompleted: string[] = [];

  for (let pass = 0; pass < QUESTS.length + 1; pass += 1) {
    let changed = false;

    for (const quest of QUESTS) {
      if (
        !activated.includes(quest.id) &&
        isQuestTriggerMet(quest.trigger, metrics, completed)
      ) {
        activated.push(quest.id);
        activatedAt[quest.id] = now;
        newActivated.push(quest.id);
        changed = true;
      }
    }

    for (const quest of QUESTS) {
      if (
        activated.includes(quest.id) &&
        !completed.includes(quest.id) &&
        isGoalMet(quest.goal, metrics)
      ) {
        completed.push(quest.id);
        completedAt[quest.id] = now;
        newCompleted.push(quest.id);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  const next =
    newActivated.length || newCompleted.length
      ? updateQuestJournalState({
          activated,
          completed,
          activatedAt,
          completedAt,
        })
      : journal;

  if (
    options.dispatch !== false &&
    (newActivated.length > 0 || newCompleted.length > 0)
  ) {
    dispatchJournalUpdated({
      activated: newActivated,
      completed: newCompleted,
    });
  }

  return next;
};

/** Итоговый снимок для журнала: статусы, прогресс и бейдж. */
export const getQuestJournalSnapshot = (): QuestJournalSnapshot => {
  const state = refreshQuestJournal();
  const metrics = getQuestMetrics();
  const entries: QuestJournalEntry[] = QUESTS.map((quest) => {
    const status: QuestJournalEntry["status"] = state.claimed.includes(quest.id)
      ? "claimed"
      : state.completed.includes(quest.id)
        ? "ready"
        : state.activated.includes(quest.id)
          ? "active"
          : "locked";
    const { progress, target } = progressOf(quest.goal, metrics);
    const value = metrics[quest.goal.metric] ?? 0;
    const percent =
      status === "claimed" || status === "ready"
        ? 100
        : Math.round((Math.min(progress, target) / target) * 100);

    return {
      quest,
      status,
      value,
      progress,
      target,
      percent,
      label: quest.goal.label,
      activatedAt: state.activatedAt[quest.id],
      completedAt: state.completedAt[quest.id],
      claimedAt: state.claimedAt[quest.id],
    };
  });

  const ready = entries.filter((entry) => entry.status === "ready");
  const active = entries.filter((entry) => entry.status === "active");
  const claimed = entries.filter((entry) => entry.status === "claimed");

  return {
    entries,
    ready,
    active,
    claimed,
    counts: {
      total: entries.length,
      active: active.length,
      ready: ready.length,
      claimed: claimed.length,
      locked: entries.filter((entry) => entry.status === "locked").length,
    },
    metrics,
    state,
  };
};

/** Сообщает журналу о событии игры и сразу пересчитывает прогресс. */
export const recordQuestEvent = (event: QuestEvent, amount = 1): number => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return getQuestJournalState().counters[event] ?? 0;
  }

  const journal = getQuestJournalState();
  const next = (journal.counters[event] ?? 0) + Math.floor(amount);

  // Счётчик пишем отдельно, затем refresh открывает событийные задания: они
  // должны активироваться уже с новым значением, даже если цель закрыта.
  updateQuestJournalState({
    counters: { ...journal.counters, [event]: next },
  });
  refreshQuestJournal();

  return next;
};

const rewardText = (rewards: QuestReward): string => {
  const parts: string[] = [];

  if (rewards.tokens) {
    parts.push(`${rewards.tokens} 🔷`);
  }
  if (rewards.astroQuax) {
    parts.push(`${rewards.astroQuax} 💎`);
  }
  if (rewards.lootboxes) {
    parts.push(`${rewards.lootboxes} 📦`);
  }

  return parts.length > 0 ? parts.join(", ") : "без награды";
};

/**
 * Ручное получение награды. Награда не начисляется сама: даже выполненное
 * задание ждёт игрока в журнале, а `claimed` фиксируется отдельно от `completed`.
 *
 * Сначала начисляем ресурсы и только потом помечаем задание забранным: если
 * запись журнала не сохранится, игрок увидит задание снова, но не потеряет
 * награду. Двойной клик безопасен — второй вызов увидит `claimed`.
 */
export const claimQuestReward = (questId: string): ClaimQuestResult => {
  const quest = getQuestById(questId);

  if (!quest) {
    return { success: false, message: "Задание не найдено" };
  }

  const journal = refreshQuestJournal();
  const isClaimed = journal.claimed.includes(quest.id);
  const isCompleted = journal.completed.includes(quest.id);

  if (isClaimed) {
    return { success: false, message: "Награда уже получена", quest };
  }

  if (!isCompleted) {
    return { success: false, message: "Задание ещё не выполнено", quest };
  }

  const state = getGameState();
  const rewards = quest.rewards ?? {};
  const storage = { ...state.user.storage };

  if (rewards.lootboxes) {
    storage[Items.lootbox] =
      Number(storage[Items.lootbox] ?? 0) + rewards.lootboxes;
  }

  updateUser({
    tokens: Number(state.user.tokens ?? 0) + (rewards.tokens ?? 0),
    astro_quax: Number(state.user.astro_quax ?? 0) + (rewards.astroQuax ?? 0),
    storage,
  });

  updateQuestJournalState({
    claimed: [...journal.claimed, quest.id],
    claimedAt: { ...journal.claimedAt, [quest.id]: Date.now() },
  });
  dispatchJournalUpdated({ activated: [], completed: [] });

  return {
    success: true,
    message: `Награда получена: ${rewardText(rewards)}`,
    quest,
    rewards,
  };
};

/**
 * Забрать всё готовое одной кнопкой.
 *
 * Награда за одно задание может закрыть следующее (например, Кваксы за быстрые
 * задания добивают «Первую сделку»). Поэтому проход повторяется, пока очередь
 * `ready` не опустеет: иначе игрок нажал бы «Забрать всё» и сразу увидел бы
 * новую готовую награду. `attempted` страхует от бесконечного цикла.
 */
export const claimAllQuestRewards = (): ClaimQuestResult[] => {
  const results: ClaimQuestResult[] = [];
  const attempted = new Set<string>();

  for (let pass = 0; pass <= QUESTS.length; pass += 1) {
    const ready = getQuestJournalSnapshot().ready.filter(
      (entry) => !attempted.has(entry.quest.id),
    );

    if (ready.length === 0) {
      break;
    }

    for (const entry of ready) {
      attempted.add(entry.quest.id);
      results.push(claimQuestReward(entry.quest.id));
    }
  }

  return results;
};


