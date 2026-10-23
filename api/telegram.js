/**
 * Telegram webhook для Vercel Functions.
 *
 * Vercel не держит долгоживущий процесс, поэтому `bot.launch()` (polling) здесь
 * не используется. Telegram сам присылает updates на этот URL, а мы передаём их
 * Telegraf. URL вебхука и секрет задаёт `npm run bot:webhook:set`.
 */
import { timingSafeEqual } from "node:crypto";
import bot from "../bot.js";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

function send(res, status, text) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(text);
}

/** Сравнение без утечки длины/содержимого секрета по времени. */
function secretMatches(header) {
  if (!WEBHOOK_SECRET || typeof header !== "string") return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(WEBHOOK_SECRET);
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

async function readUpdate(req) {
  let body = req.body;

  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") body = JSON.parse(body);
  if (body && typeof body === "object") return body;

  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, "Method Not Allowed");
  }

  if (!WEBHOOK_SECRET) {
    console.error(
      "[api/telegram] TELEGRAM_WEBHOOK_SECRET не задан — запрос отклонён",
    );
    return send(res, 500, "Webhook secret is not configured");
  }

  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
  if (!secretMatches(secret)) {
    return send(res, 401, "Unauthorized");
  }

  let update;
  try {
    update = await readUpdate(req);
  } catch (error) {
    console.error(`[api/telegram] не удалось разобрать update: ${error.message}`);
    return send(res, 400, "Bad Request");
  }

  if (!update || typeof update !== "object") {
    return send(res, 400, "Bad Request");
  }

  try {
    // Telegraf сам завершит res (в том числе при ошибке обработчика).
    await bot.handleUpdate(update, res);
    if (!res.writableEnded) send(res, 200, "OK");
  } catch (error) {
    console.error("[api/telegram] ошибка обработки update:", error);
    send(res, 500, "Internal Server Error");
  }
}
