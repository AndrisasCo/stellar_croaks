import { platform } from "../platform";
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
 *    аккаунту можно привязать любой вход.
 *
 * Без настроенного Supabase (`isCloudSyncEnabled === false`) аккаунта нет вовсе, и
 * облачные функции молчат — игра идёт полностью локально.
 */

export interface Account {
  /** uuid сессии. Это же значение хранится в `user.id` сейва игры. */
  id: string;
  /** id Telegram — «визитка» для уведомлений из бота. В вебе `null`. */
  tgId: number | null;
  username: string | null;
  /** Анонимная сессия (веб-версия): личность не подтверждена, но uuid стабилен. */
  isAnonymous: boolean;
}

type SessionUser = {
  id: string;
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

  const stored = sessionData?.session?.user;
  if (stored) {
    const account = toAccount(stored as SessionUser);
    setAccount(account);
    return account;
  }

  // Подписанная строка есть только в Telegram — там и берём доверенную личность.
  const { initData } = platform.identity();
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
