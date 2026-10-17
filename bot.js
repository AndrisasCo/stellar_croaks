import { Markup, Telegraf } from "telegraf";
import {
  TOKEN_PACKS,
  buildCreditRow,
  decodePayload,
  describePack,
  encodePayload,
  findPack,
  validatePacks,
} from "./bot/stars.js";
import {
  createAdminClient,
  enqueueCredit,
  findUserIdByTgId,
} from "./bot/supabase-admin.js";

// ---------------------------------------------------------------------------
// Конфигурация. Секреты не в коде: `npm run bot` подхватывает .env через
// `node --env-file-if-exists=.env` (шаблон — .env.example).
// ---------------------------------------------------------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
/** Адрес игры (https!) для кнопки web_app — из бота это единственный вход в мини-апп. */
const APP_URL = process.env.APP_URL ?? process.env.VITE_APP_URL ?? "";
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!BOT_TOKEN) {
  console.error(
    "Ошибка: не задан BOT_TOKEN.\n" +
      "Добавьте строку `BOT_TOKEN=...` в файл .env (см. .env.example) или запустите:\n" +
      "  BOT_TOKEN=123456:ABC npm run bot",
  );
  process.exit(1);
}

if (!APP_URL) {
  console.warn(
    "[bot] APP_URL не задан: кнопки «Играть» не будет, и мини-апп из бота не открыть.\n" +
      "      Добавьте в .env строку вида APP_URL=https://your-game.example",
  );
}

try {
  validatePacks();
} catch (error) {
  console.error(`[bot] прайс наборов некорректен: ${error.message}`);
  process.exit(1);
}

// Без service-role ключа бот работает как витрина: открывает игру, но покупки и
// уведомления отключены. Это честнее, чем молча терять оплаченные звёзды.
const admin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;

if (!admin) {
  console.warn(
    "[bot] нет SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — покупки за звёзды и уведомления отключены",
  );
}

const bot = new Telegraf(BOT_TOKEN);

/** Кнопка «Играть» — вход в мини-апп прямо из чата. */
const playKeyboard = () =>
  APP_URL
    ? Markup.inlineKeyboard([[Markup.button.webApp("🎮 Играть", APP_URL)]])
    : undefined;

const GREETING =
  "🐸 Stellar Croak — колония жаб на орбите.\n\n" +
  "Разводите жаб, стройте сектора, летайте в разведку — прогресс сохраняется " +
  "и в Telegram, и в браузере.";

const sendGreeting = (ctx) => ctx.reply(GREETING, playKeyboard());

bot.start(sendGreeting);
bot.command("play", sendGreeting);

bot.command("help", (ctx) =>
  ctx.reply(
    [
      "Что умеет бот:",
      "/play — открыть игру",
      "/buy — пополнить кваксы за Telegram Stars",
      "",
      "Кваксы начисляются сами при следующем входе в игру.",
    ].join("\n"),
    playKeyboard(),
  ),
);

/** Магазин звёзд. Пакеты — из bot/stars.js (один прайс на бота и на тесты). */
const shopKeyboard = () =>
  Markup.inlineKeyboard(
    TOKEN_PACKS.map((pack) => [
      Markup.button.callback(describePack(pack), `buy:${pack.id}`),
    ]),
  );

bot.command("buy", (ctx) =>
  ctx.reply(
    "скажи спасибо разработчику за Telegram Stars ⭐  - получи набор Кваксов",
    shopKeyboard(),
  ),
);

/**
 * Покупка набора: считаем инвойс только по id набора из наших данных (см. bot/stars.js).
 * Игрока проверяем ДО оплаты: без связки tg_id → user_id звёзды ушли бы «в никуда».
 */
bot.action(/^buy:(.+)$/, async (ctx) => {
  const pack = findPack(ctx.match[1]);

  await ctx.answerCbQuery();

  if (!pack) {
    return ctx.reply("Набор не найден — список обновлён, смотрите /buy");
  }

  if (!admin) {
    return ctx.reply(
      "Оплата пока не настроена (нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  const userId = await findUserIdByTgId(admin, ctx.from.id);

  if (!userId) {
    return ctx.reply(
      "Сначала откройте игру кнопкой «Играть» — иначе не получится начислить покупку.",
      playKeyboard(),
    );
  }

  return ctx.replyWithInvoice({
    title: pack.title,
    description: pack.description,
    payload: encodePayload(pack.id),
    // Для XTR (Stars) платёжный провайдер не нужен — Telegram берёт оплату сам.
    provider_token: "",
    currency: "XTR",
    prices: [{ label: pack.title, amount: pack.stars }],
  });
});

/** Telegram спрашивает разрешение до списания звёзд — отвечаем быстро. */
bot.on("pre_checkout_query", async (ctx) => {
  const packId = decodePayload(ctx.preCheckoutQuery.invoice_payload);
  const userId = admin ? await findUserIdByTgId(admin, ctx.from?.id) : null;

  if (!packId || !userId) {
    return ctx.answerPreCheckoutQuery(
      false,
      "Откройте игру кнопкой «Играть» и повторите покупку — иначе мы не сможем начислить кваксы.",
    );
  }

  return ctx.answerPreCheckoutQuery(true);
});

/**
 * Оплата прошла. Сейв игрока бот не трогает: он кладёт начисление в очередь
 * (`credits`), а клиент забирает его при следующем синке — так прогресс не может
 * быть перезаписан двумя писателями (см. src/backend/purchases.ts).
 */
bot.on("successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;
  const packId = decodePayload(payment.invoice_payload);
  const pack = packId ? findPack(packId) : null;
  const userId = admin ? await findUserIdByTgId(admin, ctx.from.id) : null;

  if (!admin || !pack || !userId) {
    console.error(
      `[bot] оплата без начисления: tg_id=${ctx.from.id} payload=${payment.invoice_payload}`,
    );
    return ctx.reply(
      "Платёж принят, но начислить автоматически не вышло — напишите нам, разберёмся.",
    );
  }

  const result = await enqueueCredit(
    admin,
    buildCreditRow({
      pack,
      userId,
      chargeId: payment.telegram_payment_charge_id,
    }),
  );

  const answers = {
    created: `⭐ Оплачено ${payment.total_amount} звёзд. ${pack.tokens} кваксов ждут в игре — заходите, они начислятся сами.`,
    duplicate: "Эта покупка уже начислена раньше — второй раз не списываем.",
    error: "Платёж принят, но начислить не вышло — напишите нам, разберёмся.",
  };

  return ctx.reply(answers[result] ?? answers.error, playKeyboard());
});

/** Любая ошибка обработчика не должна ронять бота (иначе покупки теряются молча). */
bot.catch((error, ctx) => {
  console.error(`[bot] ошибка на апдейте "${ctx.updateType}":`, error);
});

bot.launch().then(() => console.log("🐸 Stellar Croak bot запущен"));

// Корректно останавливаем бота по сигналам завершения, чтобы не оставлять висящий polling.
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
