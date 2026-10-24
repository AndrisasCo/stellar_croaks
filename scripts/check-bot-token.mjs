/**
 * Проверка связки «токен бота ↔ секрет Edge Function `telegram-auth`».
 *
 * `npm run bot:check`
 *
 * Зачем: после замены бота (удалили старого, завели нового) вход в мини-апп
 * ломается с `bad_hash`, если BOT_TOKEN остался старым хотя бы в одном месте:
 *   • `.env` — нужен локальному боту (`npm run bot`, `npm run bot:webhook:set`);
 *   • секрет Supabase — именно им функция проверяет подпись `initData`;
 *   • Vercel — там живёт webhook `/api/telegram`, ему нужен тот же токен.
 *
 * Скрипт ничего не создаёт и не меняет: подписывает ПРОСРОЧЕННЫЙ `initData`
 * (auth_date — трое суток назад). Если секрет совпадает, функция отвечает
 * `expired` (подпись сошлась, просто данные старые); если нет — `bad_hash`.
 * Аккаунт при такой проверке не заводится: до создания пользователя дело не доходит.
 */
import crypto from "node:crypto";

const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";

const projectUrl = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(projectUrl)?.[1] ??
  "";

const FUNCTION_URL =
  process.env.TELEGRAM_AUTH_URL ??
  (projectUrl ? `${projectUrl}/functions/v1/telegram-auth` : "");

let failed = false;

const check = (label, ok, details = "") => {
  if (!ok) {
    failed = true;
  }
  console.log(`${ok ? "✅" : "❌"} ${label}${details ? `: ${details}` : ""}`);
};

const callTelegram = async (method) => {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
  );
  const data = await response.json().catch(() => null);

  return {
    status: response.status,
    ok: Boolean(data?.ok),
    result: data?.result,
    description: data?.description,
  };
};

/** Тот же алгоритм, что в supabase/functions/_shared/telegram-init-data.ts. */
const signInitData = (botToken, params) => {
  const dataCheckString = Object.keys(params)
    .filter((key) => key !== "hash" && key !== "signature")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return (
    Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&") + `&hash=${hash}`
  );
};

const main = async () => {
  if (!BOT_TOKEN) {
    console.error("❌ не задан BOT_TOKEN — добавьте его в .env (см. .env.example)");
    process.exit(1);
  }

  console.log(
    `[bot:check] токен длиной ${BOT_TOKEN.length}, id ${BOT_TOKEN.split(":")[0]}`
  );

  // 1) Токен живой? После удаления бота его токен отвечает 401 Unauthorized.
  const me = await callTelegram("getMe");
  check(
    "токен бота действителен",
    me.ok,
    me.ok
      ? `@${me.result.username} (${me.result.first_name}), main mini app: ${me.result.has_main_web_app ? "да" : "нет"}`
      : (me.description ?? `HTTP ${me.status}`)
  );

  if (!me.ok) {
    console.log(
      "\nТокен отозван: бот удалён или токен перевыпущен в @BotFather.\n" +
        "Возьмите актуальный: @BotFather → /mybots → ваш бот → API Token."
    );
    process.exit(1);
  }

  // 2) Что настроено на стороне Telegram. Кнопка меню и webhook живут на боте,
  //    поэтому после замены бота их нужно ставить заново.
  const menu = await callTelegram("getChatMenuButton");
  const menuUrl = menu.result?.web_app?.url ?? null;
  check(
    "кнопка меню ведёт в игру",
    Boolean(menuUrl),
    menuUrl ?? "не настроена — npm run bot:webhook:set"
  );

  const webhook = await callTelegram("getWebhookInfo");
  check(
    "webhook установлен",
    Boolean(webhook.result?.url),
    webhook.result?.url ?? "не установлен — npm run bot:webhook:set"
  );

  if ((webhook.result?.pending_update_count ?? 0) > 0) {
    console.log(
      `ℹ️ в очереди ${webhook.result.pending_update_count} обновлений — если висят, ` +
        "проверьте, что TELEGRAM_WEBHOOK_SECRET в Vercel совпадает с тем, что ставил bot:webhook:set"
    );
  }

  if (!FUNCTION_URL) {
    console.log(
      "⚠️ не задан VITE_SUPABASE_URL — пропускаю проверку секрета Edge Function"
    );
  } else {
    // 3) Главная проверка: подпись протухшего initData нашим токеном.
    const initData = signInitData(BOT_TOKEN, {
      auth_date: String(Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60),
      query_id: "AAHdF6IQAAAAAN0Xoha",
      user: JSON.stringify({ id: 999999999, first_name: "CheckBotToken" }),
    });

    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    const body = await response.text();
    const reason = (() => {
      try {
        return JSON.parse(body)?.error ?? null;
      } catch {
        return null;
      }
    })();

    check(
      "секрет BOT_TOKEN в Supabase совпадает с .env",
      reason === "expired",
      reason === "expired"
        ? "подпись сошлась (ответ expired — это ожидаемо)"
        : `ответ функции: ${reason ?? body}`
    );

    if (reason === "bad_hash") {
      console.log(
        "\nСекрет Supabase не совпадает с локальным токеном — функция проверяет\n" +
          "подпись своей копией. Обновите секрет (передеплой не нужен, функция\n" +
          "перезапустится сама):\n" +
          "  npx supabase secrets set BOT_TOKEN=<токен из .env> --project-ref " +
          (projectRef || "<ref>")
      );
    }
  }

  // 4) Если есть PAT — сверим секрет ещё и по дайджесту Management API
  //    (значения секретов API отдаёт только хэшем).
  if (ACCESS_TOKEN && projectRef) {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );

    if (response.ok) {
      const secrets = await response.json();
      const remote = secrets.find((item) => item.name === "BOT_TOKEN")?.value;
      const local = crypto.createHash("sha256").update(BOT_TOKEN).digest("hex");

      check(
        "Management API видит тот же BOT_TOKEN",
        remote === local,
        remote ? "дайджест совпадает" : "секрета BOT_TOKEN в проекте нет"
      );
    } else {
      console.log(
        `ℹ️ Management API недоступен (HTTP ${response.status}) — пропускаю`
      );
    }
  }

  console.log(
    failed
      ? "\n❌ Есть расхождения — см. подсказки выше."
      : "\n✅ Токен, кнопка меню, webhook и секрет Edge Function согласованы."
  );
  process.exit(failed ? 1 : 0);
};

await main();
