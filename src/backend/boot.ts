/**
 * СТАРТ ИГРЫ (boot).
 *
 * Один вход в игру вместо «кто первый позвал syncGameState()»: платформа → вход
 * → чтение прогресса из облака. Пока пайплайн не закончился, на экране висит
 * загрузка, поэтому карта никогда не показывается на старом сейве.
 *
 * Раньше синк жил в `initGame` после первого рендера и гонялся с авторизацией:
 * если `initData` ещё не появился (или сессия не успела встать), `syncGameState`
 * тихо выходил — игра стартовала локально, а прогресс из облака «терялся».
 * Теперь вход завершается ДО чтения облака, а провал виден в `BootResult`.
 */
import { detectPlatformName, getPlatform, type PlatformName } from "../platform";
import { ensureAccount, type Account } from "./auth";
import { syncGameState } from "./db";
import { isCloudSyncEnabled } from "./supabase";

/** Шаг загрузки: что именно сейчас происходит. */
export type BootStage = "platform" | "auth" | "sync";

export type BootResult = {
  /** Платформа, на которой запущена игра (после ожидания Telegram WebApp). */
  platform: PlatformName;
  /** Облако настроено в этой сборке. */
  cloud: boolean;
  /** Вход выполнен: у прогресса есть аккаунт. */
  online: boolean;
  /** Прогресс сверен с облаком. `false` — играем на локальном сейве. */
  synced: boolean;
};

/** Сколько ждём `telegram-web-app.js`, если страница явно открыта в Telegram. */
const PLATFORM_WAIT_MS = 3000;
const PLATFORM_POLL_MS = 100;

/** Вход на загрузке: две попытки, чтобы моргнувшая сеть не стоила прогресса. */
const AUTH_ATTEMPTS = 2;
const AUTH_RETRY_MS = 1000;

/** Чтение прогресса: три попытки с нарастающей паузой. */
const SYNC_ATTEMPTS = 3;
const SYNC_RETRY_MS = 700;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

/** Скрипт Telegram загрузился (в обычном браузере он тоже создаёт WebApp). */
const telegramScriptLoaded = (): boolean => {
  try {
    return Boolean(window.Telegram?.WebApp);
  } catch {
    return false;
  }
};

/**
 * Страница открыта внутри Telegram, но скрипт `telegram-web-app.js` ещё не
 * выполнился: Mini App всегда приходит со ссылкой вида `#tgWebAppData=...`,
 * а старые клиенты пользуются `TelegramWebviewProxy`.
 *
 * В таком случае ждать стоит: без `initData` вход уйдёт в анонимную сессию, и
 * прогресс Telegram-игрока не подтянется.
 */
const insideTelegramShell = (): boolean => {
  try {
    if ("TelegramWebviewProxy" in window) {
      return true;
    }

    const { hash, search } = window.location;

    return /tgWebApp(?:Data|Version|Platform|StartParam)=/.test(
      `${hash}${search}`,
    );
  } catch {
    return false;
  }
};

/**
 * Ждёт платформу и здоровается с ней (`ready`, `expand`).
 *
 * В вебе и в готовом Telegram это мгновенно. Ожидание включается только когда
 * скрипта нет, но страница явно запущена внутри Telegram, — иначе блокировка
 * CDN `telegram.org` задерживала бы старт веб-версии.
 */
export const waitForPlatform = async (): Promise<PlatformName> => {
  if (detectPlatformName() === "telegram") {
    getPlatform().init();

    return "telegram";
  }

  // WebApp есть, а initData пуст — это обычный браузер (или Mini App без подписи).
  // Ждать нечего: платформа уже определилась как web.
  if (telegramScriptLoaded() || !insideTelegramShell()) {
    getPlatform().init();

    return "web";
  }

  const deadline = Date.now() + PLATFORM_WAIT_MS;

  while (Date.now() < deadline && !telegramScriptLoaded()) {
    await delay(PLATFORM_POLL_MS);
  }

  getPlatform().init();

  return detectPlatformName();
};

/**
 * Вход. Повторяем попытку принудительно (`force`), потому что загрузочный экран
 * — последнее место, где это уместно: игрок ещё ничего не делает, а без аккаунта
 * облачный прогресс не прочитать.
 */
const login = async (): Promise<Account | null> => {
  if (!isCloudSyncEnabled) {
    return null;
  }

  for (let attempt = 1; attempt <= AUTH_ATTEMPTS; attempt += 1) {
    const account = await ensureAccount({ force: attempt > 1 });

    if (account) {
      return account;
    }

    if (attempt < AUTH_ATTEMPTS) {
      console.warn(`[boot] вход не удался (попытка ${attempt}) — повторяем`);
      await delay(AUTH_RETRY_MS);
    }
  }

  console.warn("[boot] вход не выполнен — играем на локальном сейве");

  return null;
};

/** Чтение прогресса с повторами: сеть на старте часто ещё «просыпается». */
const loadProgress = async (): Promise<boolean> => {
  for (let attempt = 1; attempt <= SYNC_ATTEMPTS; attempt += 1) {
    const outcome = await syncGameState();

    if (outcome.synced) {
      return true;
    }

    if (!outcome.retryable) {
      return false;
    }

    if (attempt < SYNC_ATTEMPTS) {
      console.warn(
        `[boot] прогресс не получен (попытка ${attempt}) — повторяем`,
      );
      await delay(SYNC_RETRY_MS * attempt);
    }
  }

  console.warn("[boot] прогресс не получен — играем на локальном сейве");

  return false;
};

export type BootListener = (stage: BootStage) => void;

const listeners = new Set<BootListener>();
let stage: BootStage = "platform";
let bootPromise: Promise<BootResult> | null = null;

const setStage = (next: BootStage) => {
  stage = next;
  listeners.forEach((listener) => listener(next));
};

const runBoot = async (): Promise<BootResult> => {
  setStage("platform");
  const platformName = await waitForPlatform();

  setStage("auth");
  const account = await login();

  let synced = false;

  if (account) {
    setStage("sync");
    synced = await loadProgress();
  }

  const result: BootResult = {
    platform: platformName,
    cloud: isCloudSyncEnabled,
    online: Boolean(account),
    synced,
  };

  console.info("[boot] готово:", result);

  return result;
};

/**
 * Запускает (или возвращает уже запущенный) старт игры.
 *
 * Промис один на страницу: React в StrictMode монтирует эффекты дважды, и без
 * кэша игрок получал бы два параллельных входа и два чтения прогресса. Экран
 * загрузки подписывается на шаги через `onStage` и отписывается сам, когда
 * промис завершился.
 */
export const bootGame = async (
  onStage?: BootListener,
): Promise<BootResult> => {
  if (onStage) {
    listeners.add(onStage);
  }

  if (!bootPromise) {
    bootPromise = runBoot().catch((error) => {
      // Загрузка не должна «залипнуть» из-за неожиданного исключения: игра
      // стартует на локальном сейве, а причина остаётся в консоли.
      console.error("[boot] старт сорвался:", error);

      return {
        platform: detectPlatformName(),
        cloud: isCloudSyncEnabled,
        online: false,
        synced: false,
      } satisfies BootResult;
    });
  }

  try {
    return await bootPromise;
  } finally {
    if (onStage) {
      listeners.delete(onStage);
    }
  }
};
