/**
 * Переключение Telegram-бота между polling и webhook.
 *
 * `npm run bot:webhook:set` — включить webhook на Vercel и обновить кнопку меню.
 * `npm run bot:webhook:delete` — вернуться к polling (локально/VPS).
 *
 * После setWebhook старый polling-процесс получит 409 Conflict — его нужно
 * остановить. Одновременно polling и webhook работать не могут.
 */
const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = (process.env.APP_URL ?? "").replace(/\/+$/, "");
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
const REMOVE = process.argv.includes("--delete");

if (!BOT_TOKEN) {
  console.error("[webhook] не задан BOT_TOKEN (см. .env.example)");
  process.exit(1);
}

const api = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function call(method, payload = {}) {
  const response = await fetch(`${api}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.description ?? `${method}: HTTP ${response.status}`,
    );
  }

  return data.result;
}

async function main() {
  if (REMOVE) {
    await call("deleteWebhook", { drop_pending_updates: true });
    console.log("[webhook] удалён — бот снова может работать через polling");
  } else {
    if (!APP_URL) {
      throw new Error("не задан APP_URL — некуда ставить webhook");
    }
    if (!APP_URL.startsWith("https://")) {
      throw new Error("APP_URL должен начинаться с https:// (требование Telegram)");
    }
    if (!WEBHOOK_SECRET) {
      throw new Error(
        "не задан TELEGRAM_WEBHOOK_SECRET — сгенерируйте: openssl rand -hex 32",
      );
    }

    const url = `${APP_URL}/api/telegram`;

    // drop_pending_updates: при переключении с polling не тащим старую очередь.
    await call("setWebhook", {
      url,
      secret_token: WEBHOOK_SECRET,
      drop_pending_updates: true,
    });
    await call("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "🎮 Играть",
        web_app: { url: `${APP_URL}/` },
      },
    });

    console.log(`[webhook] установлен: ${url}`);
    console.log(`[webhook] кнопка меню: ${APP_URL}/`);
  }

  const info = await call("getWebhookInfo");
  console.log(
    JSON.stringify(
      {
        url: info.url,
        pending_update_count: info.pending_update_count,
        last_error_date: info.last_error_date,
        last_error_message: info.last_error_message,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`[webhook] ошибка: ${error.message}`);
  process.exitCode = 1;
});
