/**
 * Запуск сайта и Telegram-бота одним процессом — только для одного сервера/VPS.
 *
 * На Vercel этот скрипт не используется: там статический билд, а бот должен жить
 * отдельным долгоживущим процессом. Не запускайте два экземпляра бота: Telegram
 * разрешает только один polling и второй получит 409 Conflict.
 *
 * `npm run start:all` — сайт + бот (если задан BOT_TOKEN).
 * `START_BOT=0 npm run start:all` — только сайт.
 */
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Map();
let shuttingDown = false;
let exitCode = 0;
let forceKillTimer = null;

const log = (message) => console.log(`[start] ${message}`);

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;

  if (children.size === 0) {
    process.exit(exitCode);
  }

  log("останавливаю сайт и бота…");
  for (const child of children.values()) {
    child.kill("SIGTERM");
  }

  // Если кто-то не завершился сам (например, завис в polling), добиваем.
  forceKillTimer = setTimeout(() => {
    for (const child of children.values()) {
      child.kill("SIGKILL");
    }
    process.exit(exitCode);
  }, 5000);
}

function start(name, args, { critical }) {
  const child = spawn(npm, args, { stdio: "inherit", env: process.env });
  children.set(name, child);

  child.on("error", (error) => {
    console.error(`[start] не удалось запустить ${name}: ${error.message}`);
    if (critical) shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(name);

    if (shuttingDown) {
      if (children.size === 0) {
        if (forceKillTimer) clearTimeout(forceKillTimer);
        process.exit(exitCode);
      }
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    if (critical) {
      console.error(`[start] ${name} завершился (${reason}) — останавливаю остальные`);
      shutdown(code ?? 1);
      return;
    }

    // Бот не критичен для сайта: если он упал, сайт продолжает работать.
    console.error(`[start] ${name} завершился (${reason}); сайт продолжает работать`);
    if (children.size === 0) process.exit(0);
  });

  return child;
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

start("web", ["run", "preview"], { critical: true });

const startBot = process.env.START_BOT !== "0";
if (!startBot) {
  log("START_BOT=0 — запускаю только сайт");
} else if (!process.env.BOT_TOKEN) {
  log("BOT_TOKEN не задан — запускаю только сайт (бот пропущен)");
} else {
  start("bot", ["run", "bot"], { critical: false });
}
