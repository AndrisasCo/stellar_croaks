/**
 * EDGE FUNCTION `telegram-auth` — вход в игру через Telegram Mini App.
 *
 * Зачем: клиент не может сам доказать, что он — это он. `initDataUnsafe` (и `tg_id`
 * в нём) подделывается одной строкой в консоли, поэтому доверенную личность выдаёт
 * только сервер, у которого есть токен бота.
 *
 * Что делает за один запрос:
 *   1) проверяет подпись `initData` (HMAC-SHA256, см. _shared/telegram-init-data.ts);
 *   2) находит или создаёт аккаунт в Supabase Auth — email `tg-<id>@telegram.local`,
 *      чтобы один игрок Telegram всегда получал один и тот же uuid;
 *   3) запоминает связку `tg_id → user_id` в таблице `players` (по ней бот находит
 *      игрока, чтобы начислить покупку или прислать уведомление);
 *   4) возвращает одноразовый `token_hash` — клиент обменяет его на сессию
 *      (`supabase.auth.verifyOtp({ type: 'magiclink', token_hash })`).
 *
 * Секреты (в Supabase → Edge Functions → Secrets):
 *   BOT_TOKEN                  — токен бота у @BotFather;
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role ключ (обход RLS);
 *   SUPABASE_URL               — задан в проекте автоматически.
 *
 * Деплой: supabase functions deploy telegram-auth
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  getInitDataDisplayName,
  verifyInitData,
} from "../_shared/telegram-init-data.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Аккаунт по email Telegram-пользователя: один tg_id — один uuid. */
const telegramEmail = (tgId: number): string => `tg-${tgId}@telegram.local`;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      "[telegram-auth] не заданы секреты: BOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
    return json({ error: "server_not_configured" }, 500);
  }

  let initData = "";

  try {
    const body = (await request.json()) as { initData?: unknown };
    initData = String(body?.initData ?? "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const result = await verifyInitData(initData, BOT_TOKEN);

  if (!result.ok) {
    console.warn(`[telegram-auth] initData отклонён: ${result.reason}`);
    return json({ error: result.reason }, 401);
  }

  const { user } = result.data;
  const email = telegramEmail(user.id);
  const username = getInitDataDisplayName(user);
  const metadata = {
    tg_id: user.id,
    username,
    platform: "telegram",
  };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Аккаунт. Повторный вход — это норма: createUser вернёт «уже зарегистрирован».
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    });

  if (createError && createError.code !== "email_exists") {
    console.error("[telegram-auth] не удалось создать аккаунт:", createError);
    return json({ error: "user_create_failed" }, 500);
  }

  // 2) Одноразовый token_hash. generateLink заодно создаёт аккаунт, если createUser
  //    не успел (или пользователь пришёл впервые именно сюда).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: metadata },
  });

  if (linkError || !link?.properties?.hashed_token) {
    console.error("[telegram-auth] не удалось выдать token_hash:", linkError);
    return json({ error: "link_failed" }, 500);
  }

  const userId = created?.user?.id ?? link.user?.id;

  if (!userId) {
    console.error("[telegram-auth] аккаунт без id — странно, но лучше отказ");
    return json({ error: "no_user_id" }, 500);
  }

  // 3) Связка для бота: по tg_id находит аккаунт, чтобы начислить покупку.
  const { error: playerError } = await admin.from("players").upsert(
    {
      tg_id: user.id,
      user_id: userId,
      username,
      language_code: user.language_code ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tg_id" }
  );

  if (playerError) {
    // Не отказ: игрок войдёт, просто бот не сможет его найти до следующего входа.
    console.error("[telegram-auth] не удалось записать игрока:", playerError);
  }

  console.info(
    `[telegram-auth] Вход: tg_id=${user.id} user_id=${userId} (${username})`
  );

  return json({ token_hash: link.properties.hashed_token, user_id: userId });
});
