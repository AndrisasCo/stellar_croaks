import { Telegraf, Markup } from "telegraf";

const BOT_TOKEN = "8574204632:AAF04BQrKK2d46NAGLk9OyxSiYqqo794qWk";
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  const keyboard = Markup.keyboard([
    Markup.button.webApp(
      "🎮 Открыть  Stellar Croak",
      "https://berniece-techiest-gary.ngrok-free.dev"
    ),
  ]).resize();

  return ctx.reply(
    "🐸 Добро пожаловать в Stellar Croak!\n\nНажмите кнопку ниже чтобы начать играть:",
    keyboard
  );
});

bot.launch();
console.log("Bot started!");
