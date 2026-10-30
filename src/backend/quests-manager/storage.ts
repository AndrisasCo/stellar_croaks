import { platform } from "../../platform";
import type { QuestEvent } from "./quests-list";

/**
 * СОХРАНЕНИЕ ЖУРНАЛА ЗАДАНИЙ.
 *
 * Здесь лежит только то, что нельзя вывести из сейва игры: какие задания уже
 * открыты, какие выполнены и когда, что игрок забрал, и счётчики событий.
 * Прогресс по ресурсам, жабам и секторам движок считает из `GameState` на лету,
 * поэтому отдельного «счётчика комнат» в сохранении нет — он не может разойтись
 * с игрой.
 *
 * Ключ отдельный от `Game_State6`: журнал не раздувает сейв игры и не участвует
 * в оффлайн-догоне. В облако он уезжает отдельной колонкой `game_state.quests`
 * и сливается монотонно при старте (см. `docs/quest-journal.md`, D2).
 * Хранилище — через платформу, как и у игры.
 */

export const QUEST_JOURNAL_KEY = "quest_journal";
export const QUEST_JOURNAL_VERSION = 1;

/** Момент запуска приложения: по нему считаются минутные триггеры (`type: "time"`). */
export const QUEST_SESSION_STARTED_AT = Date.now();

export interface QuestJournalState {
  version: number;
  /** Задания, чьи триггеры уже сработали (видны в журнале). */
  activated: string[];
  /** Задания, чья цель достигнута, но награда ещё не забрана. */
  completed: string[];
  /** Задания с забранной наградой — архив. */
  claimed: string[];
  /** Накопительные счётчики событий (`toad_fed`, `food_bought`, …). */
  counters: Partial<Record<QuestEvent, number>>;
  activatedAt: Record<string, number>;
  completedAt: Record<string, number>;
  claimedAt: Record<string, number>;
  /** Когда журнал впервые открылся (для будущих «дней в журнале»). */
  firstSeenAt: number;
  /** Последний визит в журнал. */
  lastSeenAt: number;
  /** Сколько раз игрок открывал игру с момента появления журнала. */
  sessions: number;
}

const EVENT_NAMES: QuestEvent[] = [
  "toad_fed",
  "food_bought",
  "lootbox_opened",
  "toad_cured",
  "disease_outbreak",
  "collider_toad_collected",
  "elite_order_completed",
  "toad_bought",
  "toad_sold",
  "toad_dissolved",
];

const uniqueStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.filter((item): item is string => typeof item === "string")),
      )
    : [];

const timestampMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, number>
  >((acc, [key, stamp]) => {
    if (typeof stamp === "number" && Number.isFinite(stamp)) {
      acc[key] = stamp;
    }

    return acc;
  }, {});
};

const counterMap = (value: unknown): Partial<Record<QuestEvent, number>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;

  return EVENT_NAMES.reduce<Partial<Record<QuestEvent, number>>>(
    (acc, event) => {
      const count = source[event];

      if (typeof count === "number" && Number.isFinite(count) && count > 0) {
        acc[event] = Math.floor(count);
      }

      return acc;
    },
    {},
  );
};

const positiveNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

/** Пустое состояние нового журнала. */
export const createQuestJournalState = (now = Date.now()): QuestJournalState => ({
  version: QUEST_JOURNAL_VERSION,
  activated: [],
  completed: [],
  claimed: [],
  counters: {},
  activatedAt: {},
  completedAt: {},
  claimedAt: {},
  firstSeenAt: now,
  lastSeenAt: now,
  sessions: 0,
});


/**
 * Приводит сохранение к текущей версии.
 *
 * Старые/битые записи не должны ломать игру: неизвестные поля отбрасываем,
 * счётчики и списки чистим. `claimed` без `completed` не бывает — награда
 * выдаётся только за выполненное задание.
 */
export const normalizeQuestJournalState = (
  value: unknown,
): QuestJournalState => {
  const base = createQuestJournalState();
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const activated = uniqueStrings(source.activated);
  const completed = uniqueStrings(source.completed);
  const claimed = uniqueStrings(source.claimed).filter((id) =>
    completed.includes(id),
  );

  return {
    version: QUEST_JOURNAL_VERSION,
    activated,
    completed,
    claimed,
    counters: counterMap(source.counters),
    activatedAt: timestampMap(source.activatedAt),
    completedAt: timestampMap(source.completedAt),
    claimedAt: timestampMap(source.claimedAt),
    firstSeenAt: positiveNumber(source.firstSeenAt, base.firstSeenAt),
    lastSeenAt: positiveNumber(source.lastSeenAt, base.lastSeenAt),
    sessions:
      typeof source.sessions === "number" &&
      Number.isFinite(source.sessions) &&
      source.sessions >= 0
        ? Math.floor(source.sessions)
        : 0,
  };
};

/** Объединение двух списков id без дублей. */
const unionIds = (local: string[], cloud: string[]): string[] =>
  Array.from(new Set([...local, ...cloud]));

/**
 * Слияние временных меток. Для `activatedAt`/`completedAt`/`claimedAt` берём
 * минимум: первое реальное событие важнее повторного «клейма» с другого
 * устройства, где журнал начался позже.
 */
const mergeTimestampMaps = (
  local: Record<string, number>,
  cloud: Record<string, number>,
  mode: "min" | "max",
): Record<string, number> => {
  const merged = { ...local };

  Object.entries(cloud).forEach(([id, stamp]) => {
    const current = merged[id];

    merged[id] =
      current === undefined
        ? stamp
        : mode === "min"
          ? Math.min(current, stamp)
          : Math.max(current, stamp);
  });

  return merged;
};

/** Счётчики только растут: переключение устройств не откатывает прогресс. */
const mergeCounters = (
  local: Partial<Record<QuestEvent, number>>,
  cloud: Partial<Record<QuestEvent, number>>,
): Partial<Record<QuestEvent, number>> =>
  EVENT_NAMES.reduce<Partial<Record<QuestEvent, number>>>((acc, event) => {
    const count = Math.max(local[event] ?? 0, cloud[event] ?? 0);

    if (count > 0) {
      acc[event] = count;
    }

    return acc;
  }, {});

/**
 * Сливает журнал устройства с журналом из облака.
 *
 * Слияние монотонное, а не «побеждает более свежий сейв»: `claimed` и
 * `completed` объединяются, счётчики берут максимум. Иначе устройство со старым
 * локальным сейвом затёрло бы облачный архив, и награду можно было бы получить
 * повторно (`docs/quest-journal.md`, D2).
 *
 * Облачное значение приходит из jsonb и может быть чем угодно: его прогоняет
 * `normalizeQuestJournalState`, поэтому битые данные не ломают игру.
 */
export const mergeQuestJournalStates = (
  local: QuestJournalState,
  cloud: unknown,
): QuestJournalState => {
  const cloudState = normalizeQuestJournalState(cloud);
  const completed = unionIds(local.completed, cloudState.completed);
  const claimed = unionIds(local.claimed, cloudState.claimed).filter((id) =>
    completed.includes(id),
  );

  return normalizeQuestJournalState({
    version: QUEST_JOURNAL_VERSION,
    activated: unionIds(local.activated, cloudState.activated),
    completed,
    claimed,
    counters: mergeCounters(local.counters, cloudState.counters),
    activatedAt: mergeTimestampMaps(
      local.activatedAt,
      cloudState.activatedAt,
      "min",
    ),
    completedAt: mergeTimestampMaps(
      local.completedAt,
      cloudState.completedAt,
      "min",
    ),
    claimedAt: mergeTimestampMaps(local.claimedAt, cloudState.claimedAt, "min"),
    firstSeenAt: Math.min(local.firstSeenAt, cloudState.firstSeenAt),
    lastSeenAt: Math.max(local.lastSeenAt, cloudState.lastSeenAt),
    sessions: Math.max(local.sessions, cloudState.sessions),
  });
};

/** Применяет журнал из облака к локальному и сохраняет результат. */
export const mergeCloudQuestJournal = (cloud: unknown): QuestJournalState =>
  saveQuestJournalState(mergeQuestJournalStates(getQuestJournalState(), cloud));

/**
 * Стирает журнал с устройства при выходе из аккаунта.
 *
 * Сам журнал не теряется: он уже в облаке аккаунта и вернётся при следующем
 * входе. Без очистки следующий игрок на этом браузере унаследовал бы чужой
 * архив наград и счётчики событий.
 */
export const clearQuestJournalState = (): void => {
  platform.storage.remove(QUEST_JOURNAL_KEY);
};

/** Читает состояние журнала. Битое сохранение заменяется чистым. */
export const getQuestJournalState = (): QuestJournalState => {
  const stored = platform.storage.get(QUEST_JOURNAL_KEY);

  if (!stored) {
    return createQuestJournalState();
  }

  try {
    return normalizeQuestJournalState(JSON.parse(stored));
  } catch (error) {
    console.warn("[quests] не удалось прочитать журнал заданий", error);
    return createQuestJournalState();
  }
};

export const saveQuestJournalState = (
  state: QuestJournalState,
): QuestJournalState => {
  const normalized = normalizeQuestJournalState(state);

  platform.storage.set(QUEST_JOURNAL_KEY, JSON.stringify(normalized));

  return normalized;
};

/**
 * Обновление частями: списки, счётчики и временные метки сливаются. Так
 * вызывающему не нужно читать и пересобирать всё состояние целиком.
 */
export const updateQuestJournalState = (
  updates: Partial<QuestJournalState>,
): QuestJournalState => {
  const current = getQuestJournalState();
  const merged: QuestJournalState = {
    ...current,
    ...updates,
    activated: Array.from(
      new Set([...(updates.activated ?? current.activated)]),
    ),
    completed: Array.from(
      new Set([...(updates.completed ?? current.completed)]),
    ),
    claimed: Array.from(new Set([...(updates.claimed ?? current.claimed)])),
    counters: { ...current.counters, ...(updates.counters ?? {}) },
    activatedAt: { ...current.activatedAt, ...(updates.activatedAt ?? {}) },
    completedAt: { ...current.completedAt, ...(updates.completedAt ?? {}) },
    claimedAt: { ...current.claimedAt, ...(updates.claimedAt ?? {}) },
  };

  return saveQuestJournalState(merged);
};

let sessionRegistered = false;

/**
 * Отмечает запуск игры один раз за загрузку модуля. `sessions` нужен для
 * будущих заданий «заходите N раз» и для статистики журнала; в сейв игры
 * это поле не попадает.
 */
export const registerQuestJournalSession = (): QuestJournalState => {
  if (sessionRegistered) {
    return getQuestJournalState();
  }

  sessionRegistered = true;

  const state = getQuestJournalState();
  const now = Date.now();

  return updateQuestJournalState({
    sessions: state.sessions + 1,
    firstSeenAt: state.firstSeenAt || now,
    lastSeenAt: now,
  });
};
