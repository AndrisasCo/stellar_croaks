import { platform } from "../platform";
import { clearGameState } from "./localStorage";
import { clearOfflineEvents } from "../utils/offline-events";
import { isCloudSyncEnabled, supabase } from "./supabase";

/**
 * АВТОРИЗАЦИЯ ИГРОКА.
 *
 * Ключ аккаунта — пользователь Supabase Auth (`auth.uid()`), а не `tg_id`. Поэтому
 * одна и та же игра работает и в Telegram, и в вебе:
 *  - Telegram: мини-апп отдаёт подписанный `initData`, его проверяет Edge Function
 *    `telegram-auth` (HMAC по токену бота) и выдаёт сессию. Подделать `tg_id` нельзя;
 *  - веб: `signInAnonymously()` — сессия без личности, но со своим uuid. Достаточно,
 *    чтобы синк и лидерборд принадлежали конкретному устройству, а позже к этому
 *    аккаунту можно привязать любой вход (почта + пароль, см. ниже).
 *
 * Без настроенного Supabase (`isCloudSyncEnabled === false`) аккаунта нет вовсе, и
 * облачные функции молчат — игра идёт полностью локально.
 */

export interface Account {
  /** uuid сессии. Это же значение хранится в `user.id` сейва игры. */
  id: string;
  /** Почта зарегистрированного аккаунта (веб-вход). У анонимной сессии `null`. */
  email: string | null;
  /** id Telegram — «визитка» для уведомлений из бота. В вебе `null`. */
  tgId: number | null;
  username: string | null;
  /** Анонимная сессия (веб-версия): личность не подтверждена, но uuid стабилен. */
  isAnonymous: boolean;
}

type SessionUser = {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
};

let currentAccount: Account | null = null;
/** Общий in-flight промис: параллельные вызовы не создают несколько сессий. */
let pendingAccount: Promise<Account | null> | null = null;

/**
 * Сколько раз пробуем войти через Telegram за один запуск.
 *
 * Вебвью Telegram на старте бывает «холодным»: первый запрос к Edge Function может
 * уйти в никуда (нет сети, функция ещё поднимается). Раньше такой сбой молча
 * превращался в `signInAnonymously()`, и каждое новое устройство получало СВОЙ
 * аккаунт — на лидерборде появлялись «Алиса Павлова» и «Алиса Павлова 1».
 */
const TELEGRAM_AUTH_ATTEMPTS = 3;

/** Пауза перед повтором: 0.4 с, затем 0.8 с — сеть успевает очнуться. */
const TELEGRAM_AUTH_RETRY_MS = 400;

/**
 * Пауза между неудачными попытками входа целиком (`initAuth`).
 *
 * Если сервер недоступен, игрок продолжает играть локально, а вход повторяется не
 * на каждое сохранение, а раз в 15 секунд — иначе каждая операция с облаком била бы
 * в недоступную функцию.
 */
const AUTH_RETRY_COOLDOWN_MS = 15_000;

/** До какого времени вход не повторяем (после неудачной попытки). */
let nextAuthAttemptAt = 0;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Постоянный ли аккаунт: почта/пароль или любая другая подтверждённая личность.
 * У анонимной сессии почты нет, а `is_anonymous` в свежих GoTrue равен `true`.
 * Отсутствие флага считаем анонимностью только при пустой почте — так старые
 * сессии без поля `is_anonymous` не мешают входу через Telegram.
 */
const isPermanentAccount = (user: SessionUser): boolean =>
  user.is_anonymous === false || Boolean(user.email);

/**
 * Аккаунт из пользователя сессии. `tg_id` и имя записаны Edge Function в
 * `user_metadata` — это данные, прошедшие проверку подписи, а не `initDataUnsafe`.
 */
const toAccount = (user: SessionUser): Account => {
  const identity = platform.identity();

  return {
    id: user.id,
    email: readString(user.email),
    tgId: readNumber(user.user_metadata?.tg_id),
    username: readString(user.user_metadata?.username) ?? identity.username,
    isAnonymous: Boolean(user.is_anonymous),
  };
};

const setAccount = (account: Account | null): void => {
  currentAccount = account;
};

let authListenerAttached = false;

/**
 * Аккаунт для интерфейса и синка из пользователя сессии.
 *
 * В Telegram анонимную сессию не отдаём: настоящий аккаунт там выдаёт
 * `telegram-auth` по подписи. Иначе событие `INITIAL_SESSION` со старым анонимным
 * uuid снова сделало бы его текущим — и `ensureAccount` вернул бы «дубль», даже
 * когда вход через Telegram не удался.
 */
const accountFromSession = (user: SessionUser | undefined): Account | null => {
  if (!user) {
    return null;
  }

  const account = toAccount(user);

  return account.isAnonymous && platform.identity().initData ? null : account;
};

/**
 * Один раз подписываемся на события Supabase Auth: токен обновляется сам, а наш
 * `currentAccount` должен следовать за сессией (иначе после refresh останется
 * протухший аккаунт).
 */
const attachAuthListener = (): void => {
  if (authListenerAttached) {
    return;
  }

  authListenerAttached = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    setAccount(accountFromSession(session?.user as SessionUser | undefined));
  });
};

/**
 * Одноразовый `token_hash` от Edge Function `telegram-auth`.
 *
 * `null` означает «попытка не удалась» — вызывающий решает, повторять ли её. Сеть
 * вебвью может порвать запрос уже после отправки, поэтому ловим и исключения.
 */
const requestTelegramToken = async (initData: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke<{
      token_hash?: string;
    }>("telegram-auth", { body: { initData } });

    if (!error && data?.token_hash) {
      return data.token_hash;
    }

    console.warn(
      "[auth] Telegram-вход недоступен (Edge Function telegram-auth):",
      error ?? "сервер не вернул token_hash"
    );
  } catch (error) {
    console.warn("[auth] Telegram-вход не дошёл до сервера:", error);
  }

  return null;
};

/**
 * Вход через Telegram: `initData` уходит на сервер, где проверяется подписью бота.
 * Возвращённый одноразовый `token_hash` меняем на сессию — и только после этого у
 * аккаунта появляется доверенный `tg_id`.
 *
 * Попыток несколько: сбой сети в вебвью не должен стоить игроку отдельного аккаунта.
 * Токен при каждом повторе выдаётся заново — прошлый мог сгореть вместе с запросом.
 */
const signInWithTelegram = async (initData: string): Promise<Account | null> => {
  for (let attempt = 1; attempt <= TELEGRAM_AUTH_ATTEMPTS; attempt += 1) {
    const tokenHash = await requestTelegramToken(initData);

    if (tokenHash) {
      const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: tokenHash,
      });

      if (!verifyError && verified.session?.user) {
        const account = toAccount(verified.session.user as SessionUser);
        setAccount(account);
        console.info(
          `[auth] Вход через Telegram подтверждён: tg_id=${account.tgId ?? "?"}`
        );

        return account;
      }

      console.warn(
        "[auth] не удалось обменять token_hash на сессию:",
        verifyError?.message ?? "сессия не создана"
      );
    }

    if (attempt < TELEGRAM_AUTH_ATTEMPTS) {
      await delay(TELEGRAM_AUTH_RETRY_MS * attempt);
    }
  }

  return null;
};

const initAuth = async (): Promise<Account | null> => {
  attachAuthListener();

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    console.warn("[auth] не удалось прочитать сессию:", sessionError.message);
  }

  // Подписанная строка есть только в Telegram — там и берём доверенную личность.
  // Читаем её ДО проверки сохранённой сессии: в мини-аппе она главнее.
  const { initData } = platform.identity();

  const stored = sessionData?.session?.user;

  // Постоянный аккаунт (почта) не трогаем: игрок сам выбрал его в вебе, и смена
  // uuid в Telegram забрала бы у него колонию. Анонимную сессию — наоборот,
  // обмениваем на подтверждённую личность.
  if (stored && isPermanentAccount(stored as SessionUser)) {
    const account = toAccount(stored as SessionUser);
    setAccount(account);
    return account;
  }

  if (initData) {
    const viaTelegram = await signInWithTelegram(initData);

    if (viaTelegram) {
      return viaTelegram;
    }

    // Анонимную сессию здесь НЕ создаём: именно она превращалась в дубль
    // («Алиса Павлова 1») на каждом новом устройстве, потому что ключ аккаунта —
    // uuid сессии, а не tg_id. Игрок продолжит играть локально, а вход повторим
    // при следующем обращении к облаку — уже с тем же uuid, что и на других
    // устройствах (его выдаёт `telegram-auth` по `tg_id`).
    console.warn(
      "[auth] Telegram-вход не удался — играем локально, повторим без анонимного дубля"
    );
    nextAuthAttemptAt = Date.now() + AUTH_RETRY_COOLDOWN_MS;

    return null;
  }

  if (stored) {
    const account = toAccount(stored as SessionUser);
    setAccount(account);
    return account;
  }

  // Веб-версия (и Telegram, если игра открыта не как мини-апп): анонимная сессия.
  // Уникальный uuid всё равно лучше, чем «никто»: синк и лидерборд работают.
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    console.warn(
      "[auth] анонимный вход недоступен — игра идёт офлайн:",
      error?.message ?? "пользователь не создан"
    );
    nextAuthAttemptAt = Date.now() + AUTH_RETRY_COOLDOWN_MS;

    return null;
  }

  const account = toAccount(data.user as SessionUser);
  setAccount(account);
  console.info("[auth] Создана анонимная сессия");

  return account;
};

/**
 * Гарантирует наличие аккаунта. Пока идёт вход, все вызовы ждут один и тот же
 * промис, поэтому «двойной вход» на старте игры невозможен.
 *
 * После неудачи вход не повторяется на каждый запрос: `AUTH_RETRY_COOLDOWN_MS`
 * даёт серверу паузу, а игрок всё это время спокойно играет локально.
 *
 * @returns аккаунт или `null`, если облако не настроено/недоступно
 */
export const ensureAccount = async (): Promise<Account | null> => {
  if (!isCloudSyncEnabled) {
    return null;
  }

  if (currentAccount) {
    return currentAccount;
  }

  if (Date.now() < nextAuthAttemptAt) {
    return null;
  }

  if (!pendingAccount) {
    pendingAccount = initAuth().finally(() => {
      pendingAccount = null;
    });
  }

  return pendingAccount;
};

// ---------------------------------------------------------------------------
// ВХОД И РЕГИСТРАЦИЯ ПО ПОЧТЕ (веб-версия)
//
// В Telegram личность подтверждает подпись `initData`, а в браузере подтверждать
// нечего — поэтому там игрок заводит аккаунт сам: почта + пароль. Ключ аккаунта
// остаётся прежним (`auth.uid()`), поэтому синк, лидерборд и покупки работают
// одинаково в обеих версиях.
//
// Регистрация из анонимной сессии (в вебе она создаётся на старте) идёт через
// `updateUser`, а не `signUp`: GoTrue создал бы ВТОРОГО пользователя с новым uuid,
// и колония, лидерборд и покупки остались бы на старом. `updateUser` превращает
// текущего анонимного игрока в постоянного, сохраняя `auth.uid()`.
// Если в проекте включено подтверждение почты, сервер вернёт пользователя без
// постоянной сессии — тогда игрока ждёт письмо (см. supabase/README.md).
// ---------------------------------------------------------------------------

export interface AuthResult {
  /** Запрос принят сервером. */
  ok: boolean;
  /** Сессия создана прямо сейчас — игру можно перезапускать под новым аккаунтом. */
  signedIn: boolean;
  /** Текст для игрока: успех и ошибка читаются одинаково (`message`). */
  message: string;
}

/** Итог выхода из аккаунта. */
export interface SignOutResult {
  ok: boolean;
  message: string;
}

/** Минимум полей ошибки Supabase Auth, который нужен для распознавания причины. */
type AuthErrorLike = {
  code?: string | null;
  message?: string | null;
};

/**
 * Сессия ссылается на пользователя, которого на сервере уже нет.
 *
 * GoTrue достаёт `sub` из JWT и, не найдя такого игрока, отвечает
 * `403 user_not_found` («User from sub claim in JWT does not exist»). Так бывает
 * после удаления аккаунта в Supabase (чистка тестовых игроков, сброс проекта):
 * токен остаётся в браузере, но обновить такого пользователя уже нельзя.
 *
 * `session_not_found`/«Auth session missing» — тот же тупик с другой стороны:
 * аккаунт в памяти есть, а сессии в хранилище нет.
 */
const isDeadSessionError = (error: AuthErrorLike | null): boolean => {
  if (!error) {
    return false;
  }

  if (error.code === "user_not_found" || error.code === "session_not_found") {
    return true;
  }

  return /user from sub claim in jwt does not exist|auth session missing/i.test(
    error.message ?? ""
  );
};

/**
 * Забывает сессию удалённого игрока, чтобы регистрация не упиралась в неё снова.
 *
 * `scope: "local"` чистит только это устройство и не отзывает токены остальных.
 * Даже если сервер ответит 403 `user_not_found`, supabase-js считает такой выход
 * успешным и всё равно удаляет сессию из localStorage.
 */
const discardDeadSession = async (): Promise<void> => {
  setAccount(null);

  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.warn(
      "[auth] не удалось убрать сессию удалённого игрока:",
      error.message
    );
  }
};

/** Текущий аккаунт сессии, без ожидания входа (для интерфейса). */
export const getAccount = (): Account | null => currentAccount;

/**
 * Подписка на смену аккаунта: вход, выход, обновление токена. Возвращает функцию
 * отписки. Нужна интерфейсу (модалка «Аккаунт»), чтобы кнопки следовали за сессией.
 */
export const subscribeAccount = (
  listener: (account: Account | null) => void
): (() => void) => {
  if (!isCloudSyncEnabled) {
    listener(null);
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const account = accountFromSession(session?.user as SessionUser | undefined);
    setAccount(account);
    listener(account);
  });

  return () => data.subscription.unsubscribe();
};

/** Обычная регистрация почтой: новый пользователь и, без подтверждения, сессия. */
const registerEmailAccount = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    // Куда вернуть игрока после подтверждения почты — на ту же страницу игры.
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) {
    return { ok: false, signedIn: false, message: error.message };
  }

  if (!data.session) {
    // В проекте включено подтверждение почты: аккаунт есть, сессии ещё нет.
    return {
      ok: true,
      signedIn: false,
      message: "Аккаунт создан. Подтвердите почту и войдите.",
    };
  }

  setAccount(toAccount(data.user as SessionUser));

  return { ok: true, signedIn: true, message: "Аккаунт создан — вы вошли" };
};

/** Регистрация по почте. Из анонимной сессии делает постоянный аккаунт. */
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  if (!isCloudSyncEnabled) {
    return {
      ok: false,
      signedIn: false,
      message: "Облако не настроено: вход недоступен",
    };
  }

  const current = getAccount();

  // Анонимного игрока превращаем в постоянного НА МЕСТЕ: `auth.uid()` сохраняется,
  // а вместе с ним — сейв, строка лидерборда и уже купленные кредиты.
  if (current?.isAnonymous) {
    const { data, error } = await supabase.auth.updateUser(
      { email: email.trim(), password },
      // Куда вернуть игрока после подтверждения почты (если оно включено).
      { emailRedirectTo: window.location.origin }
    );

    if (error || !data.user) {
      // Анонимного игрока могли удалить на сервере (чистка тестовых аккаунтов,
      // сброс проекта), а JWT остался в браузере. Тогда `updateUser` навсегда
      // отвечает `user_not_found`; сбрасываем мёртвую сессию и регистрируем
      // обычным `signUp`. Локальная колония никуда не денется: при следующем
      // синке `attachIdentity` привяжет её к новому uuid.
      if (isDeadSessionError(error)) {
        await discardDeadSession();
        return registerEmailAccount(email, password);
      }

      return {
        ok: false,
        signedIn: false,
        message: error?.message ?? "Не удалось создать аккаунт",
      };
    }

    if (data.user.is_anonymous) {
      // Подтверждение почты включено: до перехода по ссылке игрок остаётся анонимным.
      return {
        ok: true,
        signedIn: false,
        message: "Аккаунт создан. Подтвердите почту и войдите.",
      };
    }

    // updateUser меняет пользователя на сервере, но НЕ переписывает текущий JWT:
    // в нём остаётся is_anonymous = true. Без refresh после перезагрузки
    // getSession() вернул бы анонимного игрока, и интерфейс снова показал бы
    // «гостя». refreshSession() выдаёт токен уже постоянного пользователя.
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();

    if (refreshError || !refreshed.session?.user) {
      console.warn(
        "[auth] аккаунт создан, но сессия не обновилась:",
        refreshError?.message ?? "нет сессии"
      );
      return {
        ok: true,
        signedIn: false,
        message: "Аккаунт создан. Войдите с почтой и паролем.",
      };
    }

    setAccount(toAccount(refreshed.session.user as SessionUser));

    return { ok: true, signedIn: true, message: "Аккаунт создан — вы вошли" };
  }

  return registerEmailAccount(email, password);
};

/** Вход по почте и паролю. */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  if (!isCloudSyncEnabled) {
    return {
      ok: false,
      signedIn: false,
      message: "Облако не настроено: вход недоступен",
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.session?.user) {
    return {
      ok: false,
      signedIn: false,
      message: error?.message ?? "Не удалось войти",
    };
  }

  setAccount(toAccount(data.session.user as SessionUser));

  return { ok: true, signedIn: true, message: "Вы вошли" };
};

/**
 * Выход из аккаунта: гасим сессию, убираем с устройства прогресс прошлого игрока
 * (он вернётся из облака при следующем входе) и перезапускаем игру — так проще
 * всего не оставить в памяти чужие жабы и таймеры.
 *
 * Сейв чистится ТОЛЬКО после успешного выхода. `supabase-js` при ошибке сети оставляет
 * локальную сессию на месте, и если бы мы всё равно стёрли сейв и перезагрузились,
 * игрок вернулся бы в тот же аккаунт, но уже без локального прогресса.
 */
export const signOutAccount = async (): Promise<SignOutResult> => {
  if (isCloudSyncEnabled) {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn("[auth] выход из аккаунта не удался:", error.message);

      return {
        ok: false,
        message: "Не удалось выйти. Проверьте связь и попробуйте ещё раз",
      };
    }
  }

  setAccount(null);
  clearGameState();
  // Журнал отсутствия принадлежит аккаунту: следующий игрок не должен видеть чужие события
  clearOfflineEvents();
  window.location.reload();

  return { ok: true, message: "Вы вышли" };
};
