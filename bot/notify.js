/**
 * УВЕДОМЛЕНИЯ ОТ БОТА (CLI).
 *
 * Игрок сидит в Telegram — значит сообщение о том, что «роды готовы» или «вышло
 * обновление», доходит до него без push-инфраструктуры и без согласий. Это и есть
 * та выгода Telegram, ради которой его держат в проекте.
 *
 * Запуск:
 *   npm run notify -- 857360604 "Жабы готовы рожать!"
 *   npm run notify -- --all "Обновление: ферма биомассы"
 *
 * Почему отдельный скрипт, а не cron внутри игры: события считает клиент (он знает
 * игровое время игрока), а отправляет бот — серверу для этого нужен только tg_id
 * из таблицы players. Автоматическую рассылку по расписанию можно повесить поверх
 * этого же скрипта (cron/pm2), не меняя игру.
 */
import { Telegraf } from "telegraf";
import { createAdminClient, listTgIds } from "./supabase-admin.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const usage = () => {
  console.error(
    [
      "Как пользоваться:",
      '  npm run notify -- <tg_id> "текст сообщения"',
      '  npm run notify -- --all "текст сообщения"',
      "",
      "Нужны BOT_TOKEN и (для --all) SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY в .env.",
    ].join("\n"),
  );
};

const main = async () => {
  const [target, ...rest] = process.argv.slice(2);
  const text = rest.join(" ").trim();

  if (!BOT_TOKEN || !target || !text) {
    usage();
    process.exit(1);
  }

  const bot = new Telegraf(BOT_TOKEN);

  if (target !== "--all") {
    const chatId = Number(target);

    if (!Number.isFinite(chatId)) {
      console.error(`Не похоже на tg_id: "${target}"`);
      process.exit(1);
    }

    await bot.telegram.sendMessage(chatId, text);
    console.log(`✅ Отправлено в ${chatId}`);
    return;
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Для рассылки нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env");
    process.exit(1);
  }

  const players = await listTgIds(createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY));

  if (!players.length) {
    console.log("ℹ️ Игроков пока нет — рассылать некому");
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const tgId of players) {
    try {
      await bot.telegram.sendMessage(tgId, text);
      sent += 1;
    } catch (error) {
      // Заблокировавшие бота или удалённые аккаунты — обычное дело, не считаем это провалом рассылки.
      failed += 1;
      console.warn(`⚠️ ${tgId}: ${error.description ?? error.message}`);
    }
  }

  console.log(`✅ Рассылка завершена: доставлено ${sent}, не доставлено ${failed}`);
};

main().catch((error) => {
  console.error("❌ Рассылка упала:", error);
  process.exit(1);
});
