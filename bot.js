import { Telegraf, Markup } from "telegraf";

const BOT_TOKEN = "8574204632:AAF04BQrKK2d46NAGLk9OyxSiYqqo794qWk";
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  return ctx.reply(
    "🐸 Добро пожаловать в Stellar Croak!\n\nНажмите кнопку ниже чтобы начать играть:",
    keyboard
  );
});

bot.launch();
