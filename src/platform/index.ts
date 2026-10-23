/**
 * Точка входа платформенного слоя.
 *
 * Выбор платформы — ЛЕНИВЫЙ и переоценивается при каждом обращении: скрипт
 * `telegram-web-app.js` грузится асинхронно, и первые кадры игры проходят до того,
 * как `window.Telegram` появится. Если бы платформа выбиралась один раз при импорте
 * модуля, игра навсегда осталась бы «веб-версией» внутри Telegram (та же болезнь,
 * из-за которой раньше терялся `tg_id`).
 *
 * `platform` — стабильный объект-фасад: импортируется один раз, а внутри всегда
 * обращается к актуальной реализации.
 */
import { createTelegramPlatform, type TelegramWebApp } from "./telegram";
import { createWebPlatform } from "./web";
import type { Platform, PlatformName } from "./types";

export * from "./types";
export { createTelegramPlatform, createWebPlatform };
export type { TelegramWebApp };

/**
 * Есть ли в окружении объект Telegram WebApp.
 *
 * Важно: `telegram-web-app.js` создаёт `window.Telegram.WebApp` и в обычном
 * браузере — с пустым `initData`. Если считать такой объект Telegram-ом, веб-игрок
 * теряет пункт «Аккаунт» (он показывается только в браузере), а `platform.identity()`
 * пытается «войти» без подписи. Настоящий Mini App всегда присылает непустой
 * `initData`; только тогда платформа — telegram.
 */
export const detectTelegramWebApp = (): TelegramWebApp | null => {
  try {
    const app = window.Telegram?.WebApp;
    return app && app.initData ? app : null;
  } catch {
    // window.Telegram недоступен — например, игра открыта не в Telegram
    return null;
  }
};

export const detectPlatformName = (): PlatformName =>
  detectTelegramWebApp() ? "telegram" : "web";

let cached: Platform | null = null;
let cachedName: PlatformName | null = null;

/**
 * Актуальная платформа. Пока Telegram не появился — веб-версия; как только объект
 * WebApp стал доступен, реализация переключается на Telegram (и дальше кэшируется).
 */
export const getPlatform = (): Platform => {
  const name = detectPlatformName();

  if (!cached || cachedName !== name) {
    cached = name === "telegram" ? createTelegramPlatform() : createWebPlatform();
    cachedName = name;
  }

  return cached;
};

/** Фасад: один импорт на весь проект, всегда актуальная реализация. */
export const platform: Platform = {
  get name() {
    return getPlatform().name;
  },
  init: () => getPlatform().init(),
  haptic: (style) => getPlatform().haptic(style),
  identity: () => getPlatform().identity(),
  get storage() {
    return getPlatform().storage;
  },
  theme: () => getPlatform().theme(),
  viewport: () => getPlatform().viewport(),
  openLink: (url) => getPlatform().openLink(url),
  confirm: (message) => getPlatform().confirm(message),
  alert: (message) => getPlatform().alert(message),
  backButton: (handler) => getPlatform().backButton(handler),
};
