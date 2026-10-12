import type { PlatformStorage } from "./types";

/**
 * Хранилище текущего устройства. Обе платформы используют localStorage браузера —
 * разница только в том, что в Telegram рядом есть ещё CloudStorage (общий для
 * устройств), но он не нужен: кросс-девайс синк игры уже делает Supabase.
 *
 * Доступ обёрнут в try/catch: в приватном режиме Safari localStorage может бросить
 * исключение прямо на обращении, и игра не должна из-за этого падать.
 */
export const deviceStorage: PlatformStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[platform] не удалось сохранить ключ "${key}"`, error);
    }
  },

  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[platform] не удалось удалить ключ "${key}"`, error);
    }
  },
};
