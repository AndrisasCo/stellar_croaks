/**
 * Массовый сброс «залипших» reply-клавиатур.
 *
 * Reply-клавиатура живёт на клиенте: однажды присланная, она остаётся внизу чата,
 * пока бот не пришлёт `remove_keyboard`. Старая версия бота ставила туда кнопку с
 * жёстко зашитым `https://stellar-croak.netlify.app` — такие игроки попадают на
 * мёртвый домен, хотя кнопка меню и inline-кнопки уже ведут на актуальный
 * `APP_URL`. Игрок сам снимет клавиатуру, только если нажмёт «Старт» (это делает
 * `bot.js`), а этот скрипт чистит её у всех известных игроков сразу.
 *
 * Запуск:
 *   npm run bot:reset-keyboards            # снять клавиатуру у всех игроков
 *   npm run bot:reset-keyboards -- --dry-run  # только показать список
 *
 * Нужны BOT_TOKEN, SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.
 * Служебное сообщение с `remove_keyboard` сразу удаляется, поэтому в чате ничего
 * не остаётся. Webhook/polling бота этот скрипт не трогает — можно запускать при
 * работающем боте.
 */
import { Telegraf } from "telegraf";
import { createAdminClient, listTgIds } from "../bot/supabase-admin.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

const usage = () => {
  console.error(
    [
      "Нужны BOT_TOKEN, SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env (см. .env.example).",
      "Запуск: npm run bot:reset-keyboards [-- --dry-run]",
    ].join("\n"),
  );
};

const main = async () => {
  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    usage();
    process.exit(1);
  }

  const bot = new Telegraf(BOT_TOKEN);
  const players = (
    await listTgIds(createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY))
  ).filter(Boolean);

  if (!players.length) {
    console.log("ℹ️ Игроков пока нет — сбрасывать нечего");
    return;
  }

  console.log(
    `[keyboards] игроков в базе: ${players.length}${DRY_RUN ? " (dry-run)" : ""}`,
  );

  let cleared = 0;
  let failed = 0;

  for (const tgId of players) {
    if (DRY_RUN) {
      console.log(`  ${tgId} — клавиатура была бы снята`);
      continue;
    }

    try {
      const sent = await bot.telegram.sendMessage(tgId, "Обновляю кнопки…", {
        reply_markup: { remove_keyboard: true },
      });
      await bot.telegram.deleteMessage(tgId, sent.message_id);
      cleared += 1;
    } catch (error) {
      // Заблокировавшие бота и удалённые аккаунты — обычное дело.
      failed += 1;
      console.warn(`⚠️ ${tgId}: ${error.description ?? error.message}`);
    }
  }

  if (DRY_RUN) {
    console.log("[keyboards] dry-run: ничего не отправлено");
    return;
  }

  console.log(
    `✅ Клавиатуры сброшены: ${cleared}, не доставлено: ${failed}`,
  );
};

main().catch((error) => {
  console.error("❌ Сброс клавиатур упал:", error);
  process.exit(1);
});
