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

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

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
    setAccount(session?.user ? toAccount(session.user as SessionUser) : null);
  });
};

/**
 * Вход через Telegram: `initData` уходит на сервер, где проверяется подписью бота.
 * Возвращённый одноразовый `token_hash` меняем на сессию — и только после этого у
 * аккаунта появляется доверенный `tg_id`.
 */
const signInWithTelegram = async (initData: string): Promise<Account | null> => {
  const { data, error } = await supabase.functions.invoke<{
    token_hash?: string;
  }>("telegram-auth", { body: { initData } });

  if (error || !data?.token_hash) {
    console.warn(
      "[auth] Telegram-вход недоступен (Edge Function telegram-auth):",
      error ?? "сервер не вернул token_hash"
    );
    return null;
  }

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.token_hash,
  });

  if (verifyError || !verified.session?.user) {
    console.warn(
      "[auth] не удалось обменять token_hash на сессию:",
      verifyError?.message ?? "сессия не создана"
    );
    return null;
  }

  const account = toAccount(verified.session.user as SessionUser);
  setAccount(account);
  console.info(
    `[auth] Вход через Telegram подтверждён: tg_id=${account.tgId ?? "?"}`
  );

  return account;
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
  if (stored) {
    const account = toAccount(stored as SessionUser);

    // Анонимная сессия могла остаться от веб-версии (тот же origin). В Telegram
    // её нужно обменять на подтверждённую личность, иначе tg_id так и не появится.
    if (initData && account.isAnonymous) {
      const viaTelegram = await signInWithTelegram(initData);
      if (viaTelegram) {
        return viaTelegram;
      }
    }

    setAccount(account);
    return account;
  }

  if (initData) {
    const viaTelegram = await signInWithTelegram(initData);
    if (viaTelegram) {
      return viaTelegram;
    }
  }

  // Веб-версия (и Telegram, если вход через бота не удался): анонимная сессия.
  // Уникальный uuid всё равно лучше, чем «никто»: синк и лидерборд работают.
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    console.warn(
      "[auth] анонимный вход недоступен — игра идёт офлайн:",
      error?.message ?? "пользователь не создан"
    );
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
 * @returns аккаунт или `null`, если облако не настроено/недоступно
 */
export const ensureAccount = async (): Promise<Account | null> => {
  if (!isCloudSyncEnabled) {
    return null;
  }

  if (currentAccount) {
    return currentAccount;
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
    const account = session?.user ? toAccount(session.user as SessionUser) : null;
    setAccount(account);
    listener(account);
  });

  return () => data.subscription.unsubscribe();
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

    setAccount(toAccount(data.user as SessionUser));

    return { ok: true, signedIn: true, message: "Аккаунт создан — вы вошли" };
  }

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
