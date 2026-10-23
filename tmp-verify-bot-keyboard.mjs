/**
 * Проверка сброса «залипшей» reply-клавиатуры (на РЕАЛЬНОМ bot.js).
 *
 * Telegram хранит reply-клавиатуру на клиенте: старая версия бота присылала нижнюю
 * кнопку с жёстко зашитым `https://stellar-croak.netlify.app`, и новые сообщения её
 * не заменяют. Поэтому перед приветствием бот обязан отправить `remove_keyboard`
 * (служебное сообщение сразу удаляется), и только потом — сообщение с inline-кнопкой
 * на актуальный `APP_URL`.
 *
 * Проверяем ровно это, не завязываясь на сеть: `bot.js` импортируется в
 * webhook-режиме (polling не стартует), а запросы к Telegram уходят на локальный
 * HTTP-сервер-заглушку, который записывает методы и payload.
 *
 *   1) /start, /play и /help: remove_keyboard → deleteMessage → ответ с web_app;
 *   2) /buy: та же чистка перед витриной наборов;
 *   3) ни в одном исходящем сообщении нет старого домена.
 *
 * Запуск: node tmp-verify-bot-keyboard.mjs
 */
import http from "node:http";

process.env.BOT_TOKEN = "123456:verify-bot-keyboard";
process.env.APP_URL = "https://stellar-croaks.vercel.app";
// Webhook-режим: bot.launch() не вызывается, меню-кнопку на старте не трогаем.
process.env.VERCEL = "1";
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const APP_URL = process.env.APP_URL;
const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${JSON.stringify(actual)}`);
};

/** Заглушка Bot API: запоминает вызовы и отвечает минимально валидным JSON. */
const calls = [];
const server = http.createServer((req, res) => {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    const method = new URL(req.url, "http://127.0.0.1").pathname
      .split("/")
      .pop();
    const payload = body ? JSON.parse(body) : {};
    const result =
      method === "sendMessage"
        ? {
            message_id: 1000 + calls.length,
            date: 0,
            chat: { id: payload.chat_id, type: "private" },
            text: payload.text ?? "",
          }
        : true;

    calls.push({ method, payload, result });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, result }));
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const { default: bot } = await import("./bot.js");

bot.telegram.options.apiRoot = `http://127.0.0.1:${port}`;
// Без getMe: иначе первый update потратит вызов на инициализацию botInfo.
bot.botInfo = { id: 1, is_bot: true, first_name: "Stellar Croak", username: "bioblobbot" };

let updateId = 0;
const commandUpdate = (text) => ({
  update_id: ++updateId,
  message: {
    message_id: 500 + updateId,
    date: 0,
    chat: { id: 42, type: "private" },
    from: { id: 42, is_bot: false, first_name: "Tester" },
    text,
    entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }],
  },
});

/** Один сценарий: /команда должна сначала снять клавиатуру, потом ответить. */
const runCommand = async (command, expectedText, { playButton = true } = {}) => {
  calls.length = 0;
  await bot.handleUpdate(commandUpdate(command));

  const [cleanup, removal, answer] = calls;

  check(`${command}: первым идёт снятие клавиатуры`, cleanup?.method, "sendMessage");
  check(
    `${command}: в нём remove_keyboard`,
    cleanup?.payload?.reply_markup?.remove_keyboard,
    true,
  );
  check(`${command}: служебное сообщение удаляется`, removal?.method, "deleteMessage");
  check(
    `${command}: удаляется именно оно`,
    removal?.payload?.message_id,
    cleanup?.result?.message_id,
  );
  check(`${command}: третьим — ответ игроку`, answer?.method, "sendMessage");
  check(
    `${command}: текст ответа на месте`,
    typeof answer?.payload?.text === "string" &&
      answer.payload.text.includes(expectedText),
    true,
  );

  if (playButton) {
    check(
      `${command}: кнопка ведёт на актуальный APP_URL`,
      answer?.payload?.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app?.url,
      APP_URL,
    );
  } else {
    check(
      `${command}: кнопки покупки на месте`,
      Array.isArray(answer?.payload?.reply_markup?.inline_keyboard) &&
        answer.payload.reply_markup.inline_keyboard.length > 0,
      true,
    );
  }

  check(
    `${command}: в ответе нет старого домена`,
    JSON.stringify(answer?.payload ?? {}).includes("netlify"),
    false,
  );
};

await runCommand("/start", "Stellar Croak");
await runCommand("/play", "Stellar Croak");
await runCommand("/help", "Что умеет бот");
await runCommand("/buy", "Telegram Stars", { playButton: false });

server.close();

if (failures.length) {
  console.error(`\n❌ Провалено проверок: ${failures.length}`);
  for (const failure of failures) console.error(`   • ${failure}`);
  process.exit(1);
}

console.log("\n🎉 Старая reply-клавиатура снимается, кнопки ведут на актуальный адрес");
