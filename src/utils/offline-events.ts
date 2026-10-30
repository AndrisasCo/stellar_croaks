import { platform } from "../platform";

/**
 * События, которые произошли, пока игрок был оффлайн.
 *
 * Обычные уведомления живут несколько секунд внизу экрана и исчезают. Для событий
 * отсутствия этого мало: игрок мог вернуться через несколько часов и пропустить,
 * что родились головастики, вернулась команда или сработал кибер-риск. Поэтому
 * такие события храним отдельно и показываем в модалке «События колонии».
 *
 * Запись живёт на устройстве (как и остальные локальные состояния игры) и
 * переживает перезагрузку. `readAt` — момент, когда игрок открыл список: пока
 * его нет, кнопка (!) в HUD акцентная.
 */

export type OfflineEventType = "warn" | "success" | "danger" | "info";

export interface OfflineEvent {
  id: string;
  /** Когда событие попало в журнал (момент входа в игру / оффлайн-догона) */
  at: number;
  type: OfflineEventType;
  content: string;
  /** Момент прочтения; отсутствует, пока событие не прочитано */
  readAt?: number;
}

export interface OfflineEventInput {
  type?: OfflineEventType;
  content: string;
}

export const OFFLINE_EVENTS_STORAGE_KEY = "Stellar_Croak_Offline_Events_v1";

/** Больше пятидесяти записей журнал не держит: старые события вытесняются новыми. */
export const MAX_OFFLINE_EVENTS = 50;

/**
 * Сколько записей показывает журнал.
 *
 * В хранилище история длиннее (до `MAX_OFFLINE_EVENTS`), но в модалке список не
 * должен растягиваться на сотни строк: показываем последние двадцать событий.
 * Исключение — непрочитанные: их не срезаем никогда, иначе игрок не увидит, что
 * случилось, пока его не было.
 */
export const OFFLINE_EVENTS_VISIBLE_LIMIT = 20;

const OFFLINE_EVENT_TYPES: OfflineEventType[] = [
  "warn",
  "success",
  "danger",
  "info",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** В хранилище мог попасть мусор или запись старого формата — такие записи пропускаем. */
const isOfflineEvent = (value: unknown): value is OfflineEvent => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.at === "number" &&
    typeof value.content === "string" &&
    OFFLINE_EVENT_TYPES.includes(value.type as OfflineEventType) &&
    (value.readAt === undefined || typeof value.readAt === "number")
  );
};

/** Чтение журнала: битые записи не должны ломать загрузку игры. */
export const loadOfflineEvents = (): OfflineEvent[] => {
  try {
    const raw = platform.storage.get(OFFLINE_EVENTS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isOfflineEvent).slice(0, MAX_OFFLINE_EVENTS);
  } catch (error) {
    console.warn("[offline-events] не удалось прочитать журнал", error);
    return [];
  }
};

export const saveOfflineEvents = (events: OfflineEvent[]): void => {
  try {
    platform.storage.set(
      OFFLINE_EVENTS_STORAGE_KEY,
      JSON.stringify(events.slice(0, MAX_OFFLINE_EVENTS)),
    );
  } catch (error) {
    console.warn("[offline-events] не удалось сохранить журнал", error);
  }
};

const makeOfflineEventId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/** Событие из уведомления менеджера (оффлайн-догон). */
export const createOfflineEvent = ({
  type = "info",
  content,
}: OfflineEventInput): OfflineEvent => ({
  id: makeOfflineEventId(),
  at: Date.now(),
  type,
  content,
});

export const countUnreadOfflineEvents = (events: OfflineEvent[]): number =>
  events.reduce((count, event) => (event.readAt ? count : count + 1), 0);

/**
 * Что показывать в модалке журнала.
 *
 * Последние `limit` событий видны всегда, более старые записи прячем, чтобы список
 * не разрастался. Непрочитанные не срезаем ни при каком раскладе — ни живые
 * (`readAt` ещё не стоит), ни те, что были непрочитанными в момент открытия
 * модалки (`pinnedIds`). Второе важно: модалка отмечает журнал прочитанным сразу,
 * и по одному `readAt` лимит уже не отличил бы новое от старого.
 */
export const selectVisibleOfflineEvents = (
  events: OfflineEvent[],
  pinnedIds: ReadonlySet<string> = new Set<string>(),
  limit: number = OFFLINE_EVENTS_VISIBLE_LIMIT,
): OfflineEvent[] => {
  const ordered = [...events].sort((a, b) => b.at - a.at);

  return ordered.filter(
    (event, index) => index < limit || !event.readAt || pinnedIds.has(event.id),
  );
};

/** Пометить весь журнал прочитанным: кнопка (!) перестаёт быть акцентной. */
export const markOfflineEventsRead = (
  events: OfflineEvent[],
  readAt = Date.now(),
): OfflineEvent[] =>
  events.map((event) => (event.readAt ? event : { ...event, readAt }));

export const clearOfflineEvents = (): void => {
  platform.storage.remove(OFFLINE_EVENTS_STORAGE_KEY);
};

/** Время события для карточки в модалке: сегодня — без даты, иначе с датой. */
export const formatOfflineEventTime = (at: number): string => {
  if (!Number.isFinite(at)) {
    return "";
  }

  const date = new Date(at);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  return date.toLocaleString("ru-RU", {
    ...(sameDay ? {} : { day: "2-digit", month: "2-digit" }),
    hour: "2-digit",
    minute: "2-digit",
  });
};
