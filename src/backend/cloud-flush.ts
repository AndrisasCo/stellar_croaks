/**
 * СОХРАНЕНИЕ ПРИ ЗАКРЫТИИ ИГРЫ.
 *
 * localStorage пишется на каждое изменение игры (`backend/localStorage.ts`), а
 * облако до сих пор обновлялось только таймером раз в 3 минуты
 * (`components/MainScreen` → `updateGameStateDB`). Если игрок закрывал Mini App
 * между тиками, на другом устройстве он видел прогресс трёхминутной давности.
 *
 * Модуль досылает сейв, когда вкладку прячут или закрывают:
 *  - `visibilitychange` → `hidden` — главный сигнал в Telegram: webview сначала
 *    прячется (на iOS/Android он в этот момент ещё жив), и только потом может
 *    быть уничтожен;
 *  - `pagehide` — закрытие вкладки и уход со страницы в браузере.
 *
 * `beforeunload` намеренно не используется: асинхронный запрос из него браузер
 * вправе отменить, а в мобильном webview событие часто не приходит вовсе.
 *
 * Запрос здесь обычный, без `keepalive`: у `keepalive` лимит тела 64 КБ, а сейв —
 * это весь jsonb с жабами, сценами и колонией. Если сеть не успела, прогресс не
 * теряется: локальный `lastSaved` новее облачного, и следующий старт дошлёт сейв
 * (`backend/db.ts` → `mergeGameState`).
 *
 * После выхода из аккаунта сейв с устройства стёрт (`clearGameState`), поэтому
 * досыл проверяет его наличие и ничего не «воскрешает».
 */
import { getGameState, hasGameState, saveGameState } from "./localStorage";
import { isCloudSyncEnabled } from "./supabase";
import { updateGameStateDB } from "./db";

/** `visibilitychange` и `pagehide` приходят парой: второй запрос в этом окне лишний. */
const MIN_FLUSH_INTERVAL_MS = 2_000;

/** Что вернула отправка: `error` — облако запрос не приняло. */
type PushResult = { error?: unknown } | null | undefined;

export type CloudFlushOptions = {
  /**
   * Можно ли писать в облако. До успешного чтения сейва — нельзя: иначе
   * локальный прогресс затрёт более свежий с другого устройства.
   */
  isReady: () => boolean;
  /** Текущее время в мс — подменяется в проверках. */
  now?: () => number;
  /** Отправка сейва — подменяется в проверках. */
  push?: () => Promise<PushResult>;
};

/** Отправка уже идёт: параллельный PATCH мог бы лечь в базу раньше свежего. */
let flushInFlight: Promise<boolean> | null = null;
let lastFlushAt = 0;

const errorText = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown };

    if (typeof message === "string" && message) {
      return message;
    }
  }

  return "неизвестная ошибка";
};

/**
 * Сохраняет игру на устройство и досылает её в облако.
 *
 * `saveGameState(..., false)` двигает `lastSaved` на момент выхода: следующий
 * старт считает оффлайн-время от закрытия, а не от последнего действия игрока —
 * иначе часы, проведённые в скрытой вкладке, прокручивались бы дважды.
 *
 * @returns `true`, если облако приняло сейв
 */
export const flushGameState = async (
  options: CloudFlushOptions
): Promise<boolean> => {
  // `hasGameState` — защита от выхода из аккаунта: `signOutAccount` стирает сейв
  // и перезагружает страницу, а `pagehide` успел бы записать дефолтный сейв
  // обратно и отправить его в облако.
  if (!isCloudSyncEnabled || !options.isReady() || !hasGameState()) {
    return false;
  }

  if (flushInFlight) {
    return flushInFlight;
  }

  const now = options.now?.() ?? Date.now();

  if (now - lastFlushAt < MIN_FLUSH_INTERVAL_MS) {
    return false;
  }

  lastFlushAt = now;
  saveGameState(getGameState(), false);

  const push = options.push ?? (() => updateGameStateDB());

  flushInFlight = (async () => {
    try {
      const result = await push();
      const error = result?.error ?? null;

      if (error) {
        console.warn(
          "[cloud-flush] сейв при закрытии не ушёл:",
          errorText(error)
        );

        return false;
      }

      return true;
    } catch (error) {
      console.warn(
        "[cloud-flush] сейв при закрытии не ушёл:",
        errorText(error)
      );

      return false;
    } finally {
      flushInFlight = null;
    }
  })();

  return flushInFlight;
};

/**
 * Подписывается на скрытие и закрытие вкладки.
 *
 * @returns функция отписки — её зовёт `useEffect` при размонтировании
 */
export const attachCloudFlush = (options: CloudFlushOptions): (() => void) => {
  const flush = () => {
    void flushGameState(options);
  };

  const handleVisibility = () => {
    // `hidden`, а не любое изменение: при возврате во вкладку писать нечего.
    if (document.visibilityState === "hidden") {
      flush();
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", flush);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pagehide", flush);
  };
};
