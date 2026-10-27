/**
 * Автоматическое развёртывание схемы Supabase.
 *
 * Зачем: `supabase/schema.sql` — единственный источник правды о таблицах, RLS и
 * правах. Раньше его нужно было вручную вставлять в SQL Editor; теперь достаточно
 * `npm run db:push`, и скрипт:
 *   1. применяет schema.sql целиком (скрипт идемпотентный — можно запускать сколько
 *      угодно раз, в том числе на уже существующей базе);
 *   2. проверяет, что все четыре таблицы на месте;
 *   3. включает Anonymous sign-ins, Email provider и автоподтверждение почты —
 *      без них клиент не получит сессию, и облако молча выключится
 *      (см. supabase/README.md).
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

/**
 * Публичный адрес игры. Auth использует его как `site_url` (ссылки из писем) и
 * включает в список разрешённых возвратов. Без APP_URL настройки не трогаем:
 * вдруг проект уже настроен руками, а скрипт запускают только ради схемы.
 */
const SITE_URL = (
  process.env.APP_URL ??
  process.env.VITE_APP_URL ??
  ""
).replace(/\/+$/, "");

/** Локальные адреса Vite: нужны, чтобы вход работал и на `npm run dev`. */
const LOCAL_REDIRECT_URLS = [
  "http://localhost:3000",
  "http://localhost:3000/**",
  "http://localhost:5173",
  "http://localhost:5173/**",
  "http://localhost:4173",
  "http://localhost:4173/**",
];

/** Таблицы, которые создаёт schema.sql. По ним же проверяем результат. */
const TABLES = ["game_state", "leaderboard", "credits", "players", "profiles"];

const VERIFY_SQL = `
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (${TABLES.map((table) => `'${table}'`).join(", ")})
order by table_name;
`;

/**
 * Проверка не только таблиц, но и прав. Supabase по умолчанию выдаёт
 * `authenticated` ALL на новые таблицы public, поэтому одного `revoke ... from anon`
 * мало: без отзыва у authenticated остаётся табличный UPDATE, и игрок может
 * дописать себе `credits.tokens` в обход колоночного grant'а.
 *
 * Запрос возвращает строки ТОЛЬКО при нарушениях (пустой результат — всё хорошо).
 */
const VERIFY_GRANTS_SQL = `
select 'authenticated может менять credits.tokens' as problem
where has_column_privilege('authenticated', 'public.credits', 'tokens', 'UPDATE')
   or has_table_privilege('authenticated', 'public.credits', 'UPDATE')
union all
select 'authenticated не может отметить credits.applied_at'
where not has_column_privilege('authenticated', 'public.credits', 'applied_at', 'UPDATE')
union all
select 'authenticated имеет доступ к players'
where has_table_privilege('authenticated', 'public.players', 'SELECT')
   or has_table_privilege('authenticated', 'public.players', 'INSERT')
   or has_table_privilege('authenticated', 'public.players', 'UPDATE')
   or has_table_privilege('authenticated', 'public.players', 'DELETE')
union all
select 'authenticated может менять game_state.user_id'
where has_column_privilege('authenticated', 'public.game_state', 'user_id', 'UPDATE')
union all
select 'в game_state нет колонки quests: примените schema.sql'
where not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'game_state'
    and column_name = 'quests'
)
union all
select 'authenticated не может писать game_state.quests'
where not coalesce(
  has_column_privilege('authenticated', 'public.game_state', 'quests', 'UPDATE'),
  false
)
union all
select 'authenticated может менять leaderboard.user_id'
where has_column_privilege('authenticated', 'public.leaderboard', 'user_id', 'UPDATE')
union all
select 'service_role не может писать credits'
where not has_table_privilege('service_role', 'public.credits', 'INSERT')
union all
select 'authenticated не видит имена игроков'
where not has_table_privilege('authenticated', 'public.profiles', 'SELECT')
union all
select 'authenticated не может менять profiles.username'
where not has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE')
union all
select 'authenticated может менять profiles.user_id'
where has_column_privilege('authenticated', 'public.profiles', 'user_id', 'UPDATE');
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

const assertGrants = (problems) => {
  if (problems.length) {
    fail(`права настроены неверно:\n  - ${problems.join("\n  - ")}`);
  }

  console.log(
    "✅ Права: клиент не может менять токены и ключи, players закрыт для клиента"
  );
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
        // Своего SMTP у игры нет: с включённым подтверждением почты GoTrue создаёт
        // аккаунт без сессии, а письмо не доходит (у встроенного отправителя жёсткий
        // лимит). Autoconfirm выдаёт сессию сразу — регистрация работает из коробки.
        // Включая подтверждение позже, настройте SMTP и верните false.
        mailer_autoconfirm: true,
        // Регистрация в браузере возвращает игрока на текущий origin (emailRedirectTo),
        // а Supabase пускает только адреса из списка. localhost — для разработки,
        // APP_URL — прод. Без APP_URL не перезаписываем то, что настроено в Dashboard.
        ...(SITE_URL
          ? {
              site_url: SITE_URL,
              uri_allow_list: [...LOCAL_REDIRECT_URLS, SITE_URL, `${SITE_URL}/**`].join(
                ","
              ),
            }
          : {}),
      },
    });

    console.log(
      SITE_URL
        ? `✅ Auth: анонимный вход, email и автоподтверждение включены; возврат разрешён на ${SITE_URL}`
        : "✅ Auth: анонимный вход, email и автоподтверждение включены"
    );
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

/** Проверяем гранты тем же способом, которым применяли схему. */
const verifyGrants = async () => {
  if (ACCESS_TOKEN) {
    const rows = await apiRequest(`/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      body: { query: VERIFY_GRANTS_SQL },
    });

    return rowsOf(rows)
      .map((row) => row?.problem)
      .filter(Boolean);
  }

  const verified = spawnSync("psql", [DB_URL, "-tA", "-c", VERIFY_GRANTS_SQL], {
    encoding: "utf8",
  });

  if (verified.error || verified.status !== 0) {
    fail(
      `не удалось проверить права через psql: ${
        verified.error?.message ?? verified.stderr?.trim() ?? "неизвестная ошибка"
      }`
    );
  }

  return verified.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
  assertGrants(await verifyGrants());

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

