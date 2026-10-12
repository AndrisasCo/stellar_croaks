import { deviceStorage } from "./device-storage";
import type {
  HapticStyle,
  Platform,
  PlatformIdentity,
  PlatformTheme,
  PlatformViewport,
} from "./types";

/** Объект Telegram WebApp — как он объявлен в src/utils/types.d.ts. */
export type TelegramWebApp = Window["Telegram"]["WebApp"];

/** Откуда брать WebApp. Вынесено в аргумент, чтобы платформу можно было проверить в node. */
export type WebAppResolver = () => TelegramWebApp | null | undefined;

/**
 * Читаем `window.Telegram.WebApp` в момент вызова.
 *
 * Скрипт `telegram-web-app.js` подключается асинхронно и появляется не сразу, поэтому
 * держать объект в переменной на этапе импорта модуля нельзя (`window.Telegram`
 * в этот момент ещё undefined). Ровно из-за этого раньше навсегда терялся `tg_id`.
 */
const defaultWebAppResolver: WebAppResolver = () => {
  try {
    return window.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
};

/**
 * Метод Telegram может отсутствовать в старом клиенте (например,
 * `disableVerticalSwipes` появился только в Bot API 7.7) — на старом iOS-клиенте
 * вызов такого метода бросает исключение и роняет игру. Поэтому каждый вызов идёт
 * через `safe`: ошибка логируется, приложение продолжает работать.
 */
const safe = <T>(label: string, call: () => T): T | undefined => {
  try {
    return call();
  } catch (error) {
    console.warn(`⚠️ Telegram.${label} не сработал`, error);
    return undefined;
  }
};

const hasMethod = (target: unknown, method: string): boolean =>
  Boolean(target && typeof (target as Record<string, unknown>)[method] === "function");

/**
 * Платформа Telegram Mini App.
 *
 * @param getWebApp — откуда читать WebApp (по умолчанию `window.Telegram.WebApp`).
 *   Параметр существует для тестов: подставив фейк, можно проверить маппинг
 *   методов без настоящего клиента Telegram.
 */
export const createTelegramPlatform = (
  getWebApp: WebAppResolver = defaultWebAppResolver,
): Platform => ({
  name: "telegram",

  init() {
    const app = getWebApp();
    if (!app) {
      return;
    }

    safe("ready", () => app.ready());
    safe("expand", () => app.expand());
    // Закрытие мини-аппа подтверждается свайпом вниз: без этого игрок случайно
    // смахивает игру вместо панорамирования карты.
    safe("enableClosingConfirmation", () => app.enableClosingConfirmation());
    // Свайп вниз у верхнего края не должен сворачивать мини-апп — этот жест нужен карте.
    if (hasMethod(app, "disableVerticalSwipes")) {
      safe("disableVerticalSwipes", () => app.disableVerticalSwipes());
    }
    // Шапка клиента в цвет фона игры (#070c14), чтобы Telegram не «светил» белой полосой.
    if (hasMethod(app, "setHeaderColor")) {
      safe("setHeaderColor", () => app.setHeaderColor("#070c14"));
    }
  },

  haptic(style: HapticStyle) {
    const feedback = getWebApp()?.HapticFeedback;
    if (!feedback) {
      return;
    }

    if (style === "selection") {
      safe("selectionChanged", () => feedback.selectionChanged());
      return;
    }

    if (style === "success" || style === "warning" || style === "error") {
      safe("notificationOccurred", () => feedback.notificationOccurred(style));
      return;
    }

    safe("impactOccurred", () => feedback.impactOccurred(style));
  },

  identity(): PlatformIdentity {
    const app = getWebApp();
    if (!app) {
      return { tgId: null, username: null, initData: null };
    }

    const user = safe("initDataUnsafe", () => app.initDataUnsafe)?.user;
    const fullName = [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      tgId: user?.id ?? null,
      username: fullName || user?.username || null,
      initData: safe("initData", () => app.initData) || null,
    };
  },

  storage: deviceStorage,

  theme(): PlatformTheme {
    const app = getWebApp();

    return {
      colorScheme: app?.colorScheme === "dark" ? "dark" : "light",
      bgColor: safe("themeParams", () => app?.themeParams?.bg_color) ?? null,
    };
  },

  viewport(): PlatformViewport {
    const app = getWebApp();
    // В Telegram высота меняется при «тяге» шторки, поэтому нижние элементы вёрстки
    // стоит привязывать к stableHeight. Вне Telegram берём window.
    const height = app?.viewportHeight ?? window.innerHeight;

    return {
      height,
      stableHeight: app?.viewportStableHeight ?? height,
      isExpanded: Boolean(app?.isExpanded),
    };
  },

  openLink(url: string) {
    const app = getWebApp();

    if (!app) {
      window.open(url, "_blank", "noopener");
      return;
    }

    // Ссылки на Telegram (t.me) открываются внутри клиента — игрок не выпадает из игры.
    if (
      /^https:\/\/(t\.me|telegram\.me)\//i.test(url) &&
      hasMethod(app, "openTelegramLink")
    ) {
      safe("openTelegramLink", () => app.openTelegramLink(url));
      return;
    }

    safe("openLink", () => app.openLink(url));
  },

  confirm(message: string): Promise<boolean> {
    const app = getWebApp();

    if (!app || !hasMethod(app, "showConfirm")) {
      return Promise.resolve(window.confirm(message));
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };

      try {
        app.showConfirm(message, done);
      } catch (error) {
        console.warn("⚠️ Telegram.showConfirm не сработал", error);
        done(window.confirm(message));
      }
    });
  },

  alert(message: string): Promise<void> {
    const app = getWebApp();

    if (!app || !hasMethod(app, "showAlert")) {
      window.alert(message);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      try {
        app.showAlert(message, () => resolve());
      } catch (error) {
        console.warn("⚠️ Telegram.showAlert не сработал", error);
        window.alert(message);
        resolve();
      }
    });
  },

  backButton(handler: () => void) {
    const button = getWebApp()?.BackButton;

    if (!button) {
      return () => {};
    }

    safe("BackButton.show", () => button.show());
    safe("BackButton.onClick", () => button.onClick(handler));

    return () => {
      safe("BackButton.offClick", () => button.offClick(handler));
      safe("BackButton.hide", () => button.hide());
    };
  },
});
