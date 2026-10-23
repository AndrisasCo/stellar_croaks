/**
 * Автоматическое развёртывание схемы Supabase.
 *
 * Зачем: `supabase/schema.sql` — единственный источник правды о таблицах, RLS и
 * правах. Раньше его нужно было вручную вставлять в SQL Editor; теперь достаточно
 * `npm run db:push`, и скрипт:
 *   1. применяет schema.sql целиком (скрипт идемпотентный — можно запускать сколько
 *      угодно раз, в том числе на уже существующей базе);
 *   2. проверяет, что все четыре таблицы на месте;
 *   3. включает Anonymous sign-ins и Email provider — без них клиент не получит
 *      сессию, и облако молча выключится (см. supabase/README.md).
 *
 * Как ходим в базу (первый доступный способ):
 *   - Management API + `SUPABASE_ACCESS_TOKEN` (Personal Access Token, `sbp_...`) —
 *     ничего устанавливать не нужно, это основной путь;
 *   - напрямую через `psql` + `SUPABASE_DB_URL` — если PAT нет, а psql установлен.
 *
 * Публичный ключ (`VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`) для
 * DDL не подходит: он даёт доступ к данным по RLS, но не к Management API.
 *
 * Запуск: npm run db:push (Node сам подхватывает .env).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCHEMA_PATH = join(ROOT, "supabase", "schema.sql");

const PROJECT_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const DB_URL = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "";
const PUBLIC_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  "";

/** Таблицы, которые создаёт schema.sql. По ним же проверяем результат. */
const TABLES = ["game_state", "leaderboard", "credits", "players"];

const VERIFY_SQL = `
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (${TABLES.map((table) => `'${table}'`).join(", ")})
order by table_name;
`;

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

/** `https://<ref>.supabase.co` → `<ref>`. Явный SUPABASE_PROJECT_REF важнее. */
const projectRefFromUrl = (value) => {
  if (!value) {
    return "";
  }

  try {
    const host = new URL(value).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);

    return match ? match[1] : "";
  } catch {
    return "";
  }
};

const projectRef = process.env.SUPABASE_PROJECT_REF || projectRefFromUrl(PROJECT_URL);

/** Запрос к Management API. Токен — только в заголовке и никогда в логах. */
const apiRequest = async (path, { method = "GET", body } = {}) => {
  const response = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Не JSON — оставляем текст как есть, он попадёт в сообщение об ошибке.
  }

  if (!response.ok) {
    const detail =
      typeof data === "string"
        ? data
        : data?.message ?? data?.error ?? JSON.stringify(data);

    throw new Error(`${method} ${path} → ${response.status}: ${detail}`);
  }

  return data;
};

/** Management API отдаёт строки массивом; на всякий случай понимаем и обёртки. */
const rowsOf = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.result)) {
    return data.result;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const tableNamesOf = (rows) =>
  rows
    .map((row) => row?.table_name ?? row?.tableName ?? "")
    .filter(Boolean)
    .sort();

const assertTables = (names) => {
  const missing = TABLES.filter((table) => !names.includes(table));

  if (missing.length) {
    fail(`после применения схемы не найдены таблицы: ${missing.join(", ")}`);
  }

  console.log(`✅ Таблицы на месте: ${names.join(", ")}`);
};

/** Основной путь: Management API (нужен только PAT). */
const applyViaManagementApi = async () => {
  console.log(`→ Management API, проект ${projectRef}`);

  await apiRequest(`/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    body: { query: schema },
  });

  const rows = await apiRequest(`/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    body: { query: VERIFY_SQL },
  });

  return tableNamesOf(rowsOf(rows));
};

/**
 * Включаем обязательные для игры провайдеры Auth. Ошибку не считаем фатальной:
 * таблицы уже созданы, а настройку можно повторить руками в Dashboard.
 */
const enableAuthProviders = async () => {
  try {
    await apiRequest(`/v1/projects/${projectRef}/config/auth`, {
      method: "PATCH",
      body: {
        external_anonymous_users_enabled: true,
        external_email_enabled: true,
      },
    });

    console.log("✅ Auth: анонимный вход и email-провайдер включены");
  } catch (error) {
    console.warn(
      `⚠️  Auth не настроен автоматически: ${
        error instanceof Error ? error.message : error
      }`
    );
    console.warn(
      "   Включите вручную: Authentication → Sign In / Providers → " +
        "Allow anonymous sign-ins и Email."
    );
  }
};

/** Запасной путь: psql и строка подключения Postgres. */
const applyViaPsql = () => {
  console.log("→ psql, строка подключения из SUPABASE_DB_URL");

  const applied = spawnSync(
    "psql",
    [DB_URL, "-v", "ON_ERROR_STOP=1", "-f", SCHEMA_PATH],
    { stdio: "inherit" }
  );

  if (applied.error) {
    fail(
      `psql не запустился (${applied.error.message}). Установите PostgreSQL-клиент ` +
        "или используйте SUPABASE_ACCESS_TOKEN."
    );
  }

  if (applied.status !== 0) {
    fail("psql завершился с ошибкой — схема не применена (см. вывод выше)");
  }

  const verified = spawnSync("psql", [DB_URL, "-tA", "-c", VERIFY_SQL], {
    encoding: "utf8",
  });

  if (verified.error || verified.status !== 0) {
    fail(
      `не удалось проверить таблицы через psql: ${
        verified.error?.message ?? verified.stderr?.trim() ?? "неизвестная ошибка"
      }`
    );
  }

  return verified.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
};

const schema = readFileSync(SCHEMA_PATH, "utf8");

const main = async () => {
  if (!schema.trim()) {
    fail(`файл ${SCHEMA_PATH} пуст`);
  }

  if (ACCESS_TOKEN && !projectRef) {
    fail(
      "не удалось определить проект: задайте SUPABASE_URL / VITE_SUPABASE_URL " +
        "вида https://<ref>.supabase.co или SUPABASE_PROJECT_REF."
    );
  }

  if (!ACCESS_TOKEN && !DB_URL) {
    console.error(
      "❌ Нечего применять: нужен SUPABASE_ACCESS_TOKEN (PAT, `sbp_...`) " +
        "или SUPABASE_DB_URL (строка подключения Postgres)."
    );
    console.error("");
    console.error("   PAT: https://supabase.com/dashboard/account/tokens");
    console.error("   Dashboard → Project Settings → Database → Connection string");
    console.error("");
    if (PUBLIC_KEY) {
      console.error(
        "   Публичный ключ (publishable/anon) уже задан, но для создания таблиц он " +
          "не подходит: это ключ данных, а не управления проектом."
      );
    }
    process.exit(1);
  }

  const tableNames = ACCESS_TOKEN ? await applyViaManagementApi() : applyViaPsql();

  assertTables(tableNames);

  if (ACCESS_TOKEN) {
    await enableAuthProviders();
  }

  console.log("");
  console.log("Готово. Дальше:");
  console.log(
    "  1. npm run dev — клиент создаст анонимную сессию и включит облачный синк."
  );
  console.log(
    "  2. Service-role ключ (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) нужен только " +
      "боту: покупки за звёзды и рассылки."
  );
  console.log(
    "  3. Вход через Telegram включает Edge Function telegram-auth: " +
      "supabase functions deploy telegram-auth (см. supabase/README.md)."
  );
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`❌ ${message}`);

  if (/\b(401|403)\b/.test(message)) {
    console.error(
      "   Проверьте SUPABASE_ACCESS_TOKEN: нужен Personal Access Token (sbp_...), " +
        "созданный на https://supabase.com/dashboard/account/tokens."
    );
  }

  if (/fetch failed|ENOTFOUND|ECONN|ETIMEDOUT/i.test(message)) {
    console.error("   Похоже, нет сети или недоступен api.supabase.com.");
  }

  process.exit(1);
});

