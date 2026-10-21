import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  countUnreadOfflineEvents,
  createOfflineEvent,
  loadOfflineEvents,
  markOfflineEventsRead,
  MAX_OFFLINE_EVENTS,
  saveOfflineEvents,
} from "../utils/offline-events";
import type {
  OfflineEvent,
  OfflineEventInput,
} from "../utils/offline-events";

interface OfflineEventsContextType {
  events: OfflineEvent[];
  unreadCount: number;
  addOfflineEvents: (events: OfflineEventInput[]) => void;
  markAllRead: () => void;
}

const OfflineEventsContext = createContext<
  OfflineEventsContextType | undefined
>(undefined);

export const useOfflineEvents = () => {
  const context = useContext(OfflineEventsContext);

  if (!context) {
    throw new Error(
      "useOfflineEvents must be used within OfflineEventsProvider",
    );
  }

  return context;
};

/**
 * Журнал событий отсутствия.
 *
 * Провайдер держит список в состоянии и зеркалит его в localStorage: модалка
 * открывается через `ModalProvider` отдельным порталом, поэтому общий контекст
 * нужен и HUD-кнопке, и самой модалке. Прочитанность хранится на событиях
 * (`readAt`), а не отдельным счётчиком, — после перезагрузки кнопка (!) не
 * снова становится акцентной.
 */
export const OfflineEventsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [events, setEvents] = useState<OfflineEvent[]>(loadOfflineEvents);

  const addOfflineEvents = useCallback((inputs: OfflineEventInput[]) => {
    const fresh = inputs
      .filter((input) => input.content?.trim())
      .map(createOfflineEvent);

    if (fresh.length === 0) {
      return;
    }

    setEvents((prev) => {
      // Свежие события сверху: журнал читается как «что случилось последним»
      const next = [...fresh, ...prev].slice(0, MAX_OFFLINE_EVENTS);
      saveOfflineEvents(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setEvents((prev) => {
      if (countUnreadOfflineEvents(prev) === 0) {
        return prev;
      }

      const next = markOfflineEventsRead(prev);
      saveOfflineEvents(next);
      return next;
    });
  }, []);

  const unreadCount = useMemo(
    () => countUnreadOfflineEvents(events),
    [events],
  );

  return (
    <OfflineEventsContext.Provider
      value={{ events, unreadCount, addOfflineEvents, markAllRead }}
    >
      {children}
    </OfflineEventsContext.Provider>
  );
};
