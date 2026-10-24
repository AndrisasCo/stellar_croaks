/**
 * ПРОВЕРКА ПОДПИСИ `initData` (Telegram Mini App).
 *
 * Единственный источник доверия о том, кто именно играет: `initDataUnsafe` на клиенте
 * подделывается одной строкой в консоли, а подпись `hash` проверить может только тот,
 * у кого есть токен бота. Поэтому проверка живёт на сервере (Edge Function
 * `telegram-auth`), а этот модуль вынесен отдельно: он чистый (только WebCrypto),
 * поэтому его прогоняет и Deno на сервере, и node в тесте
 * `tmp-verify-init-data.mjs` — алгоритм проверяется на настоящих векторах.
 *
 * Алгоритм (Bot API, «Validating data received via the Mini App»):
 *   1) secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 *   2) hash       = HMAC_SHA256(key = secret_key,     data = data_check_string)
 *   3) data_check_string — все пары `key=value` кроме `hash`, отсортированные по
 *      key и склеенные через "\n".
 *
 * Про `signature` (Bot API 8.0, отдельная Ed25519-подпись) договорённости нет:
 * часть клиентов Telegram кладёт это поле в HMAC-строку, часть — нет. Настоящий
 * `initData` из мини-аппа приходит с `signature`, и hash сходится ТОЛЬКО если он
 * входит в строку проверки, поэтому проверяем оба варианта (см.
 * `buildDataCheckStrings`). Пропускать поле целиком — значит ловить `bad_hash`
 * на живых клиентах; включать всегда — ломать те, что подписывают без него.
 */

const encoder = new TextEncoder();

const hmacSha256 = async (
  key: Uint8Array,
  message: string
): Promise<Uint8Array> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message)
  );

  return new Uint8Array(signature);
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Сравнение подписей без «раннего выхода» — иначе по времени ответа можно подбирать hash. */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
};

/** Поля, которые не участвуют в `data_check_string` ни в одном варианте. */
const SKIPPED_FIELDS = ["hash"];

/** Поле Bot API 8.0, вокруг которого у клиентов Telegram нет единого правила. */
const SIGNATURE_FIELD = "signature";

/** Строка проверки: `key=value`, отсортированные по key, через "\n". */
const joinSorted = (params: Record<string, string>, skip: string[]): string =>
  Object.keys(params)
    .filter((key) => !skip.includes(key))
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");

/** Классическая строка проверки — без `hash` и `signature`. */
export const buildDataCheckString = (params: Record<string, string>): string =>
  joinSorted(params, [...SKIPPED_FIELDS, SIGNATURE_FIELD]);

/**
 * Все строки проверки, которые встречаются у настоящих клиентов.
 *
 * Живой `initData` из мини-аппа содержит `signature` и подписан ВМЕСТЕ с ним —
 * hash сходится, только если поле попало в строку. Старые/иные клиенты
 * подписывают без него. Поэтому принимаем оба варианта: подделка всё равно не
 * пройдёт (она не может дать валидный hash ни для одной строки).
 */
export const buildDataCheckStrings = (
  params: Record<string, string>
): string[] => {
  const variants = [buildDataCheckString(params)];

  if (SIGNATURE_FIELD in params) {
    variants.push(joinSorted(params, SKIPPED_FIELDS));
  }

  return variants;
};

/** Ожидаемая подпись `hash` для строки проверки (hex). */
export const computeInitDataHash = async (
  botToken: string,
  dataCheckString: string
): Promise<string> => {
  const secretKey = await hmacSha256(encoder.encode("WebAppData"), botToken);

  return toHex(await hmacSha256(secretKey, dataCheckString));
};

export interface InitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: InitDataUser;
  /** Когда выдан initData (unix, секунды). */
  authDate: number;
  queryId: string | null;
  startParam: string | null;
}

export type VerifyInitDataResult =
  | { ok: true; data: VerifiedInitData }
  | { ok: false; reason: VerifyFailureReason };

export type VerifyFailureReason =
  | "empty"
  | "missing_hash"
  | "bad_hash"
  | "expired"
  | "no_user";

export interface VerifyInitDataOptions {
  /** Сколько живёт initData. У Telegram — 24 часа. */
  maxAgeSeconds?: number;
  /** Текущее время (unix, секунды). Параметр для тестов. */
  nowSeconds?: number;
}

const parseUser = (raw: string | null): InitDataUser | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as InitDataUser;

    return typeof parsed?.id === "number" ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Проверяет `initData` подписью бота.
 *
 * @param initData — сырая строка `Telegram.WebApp.initData`
 * @param botToken — токен бота (только серверный секрет)
 */
export const verifyInitData = async (
  initData: string,
  botToken: string,
  options: VerifyInitDataOptions = {}
): Promise<VerifyInitDataResult> => {
  if (!initData || !botToken) {
    return { ok: false, reason: "empty" };
  }

  const maxAgeSeconds = options.maxAgeSeconds ?? 24 * 60 * 60;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    return { ok: false, reason: "missing_hash" };
  }

  const dataCheckStrings = buildDataCheckStrings(
    Object.fromEntries(params.entries())
  );
  const targetHash = hash.toLowerCase();
  let matched = false;

  for (const dataCheckString of dataCheckStrings) {
    const expected = await computeInitDataHash(botToken, dataCheckString);

    if (timingSafeEqual(expected, targetHash)) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDate = Number(params.get("auth_date") ?? 0);

  if (!authDate || nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, reason: "expired" };
  }

  const user = parseUser(params.get("user"));

  if (!user) {
    return { ok: false, reason: "no_user" };
  }

  return {
    ok: true,
    data: {
      user,
      authDate,
      queryId: params.get("query_id"),
      startParam: params.get("start_param"),
    },
  };
};

/** Отображаемое имя игрока из данных Telegram. */
export const getInitDataDisplayName = (user: InitDataUser): string =>
  [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || user.username?.trim() || `player_${user.id}`;
