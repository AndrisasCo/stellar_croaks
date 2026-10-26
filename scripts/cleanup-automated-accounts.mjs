/**
 * ЧИСТКА «ЛИШНИХ ИГРОКОВ»: анонимные аккаунты, которые создали боты.
 *
 * Зачем: веб-версия создаёт анонимную сессию на старте, поэтому каждый обход
 * сайта краулером (`HeadlessChrome`, `Reflectionbot`, SEO-боты) оставлял в базе
 * игрока: строку в `auth.users`, а если бот успевал дожить до первого синка —
 * ещё `game_state`, `profiles` и `leaderboard` с ником `user_<timestamp>`.
 * Клиент таких браузеров больше не пускает (`src/backend/automation.ts`), а этот
 * скрипт убирает то, что уже накопилось.
 *
 * Кого удаляем: ТОЛЬКО анонимные аккаунты, у которых ВСЕ сессии — ботовые
 * (`auth.sessions.user_agent` совпал с шаблоном). Если с аккаунта хоть раз играли
 * живым браузером или вошли в Telegram, он остаётся. Удаление `auth.users`
 * каскадом уносит `game_state`, `profiles`, `leaderboard`, `credits` и сессии
 * (у всех FK `on delete cascade`), поэтому вручную чистить таблицы не нужно.
 *
 * Аккаунты, у которых сессии уже истекли и удалены из `auth.sessions`, скрипт не
 * найдёт: ботовость определяется по журналу сессий, а не по имени игрока.
 *
 * Запуск (нужен `SUPABASE_ACCESS_TOKEN`, как у `db:push`):
 *   npm run db:cleanup-automated            # только показать список (dry-run)
 *   npm run db:cleanup-automated -- --delete
 */
const PROJECT_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";

const projectRefFromUrl = (url) => {
  try {
    return new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
};

const projectRef =
  process.env.SUPABASE_PROJECT_REF || projectRefFromUrl(PROJECT_URL);

/**
 * Тот же список, что `AUTOMATION_USER_AGENT` в `src/backend/automation.ts`.
 * Здесь он текстом: SQL не умеет импортировать TypeScript. Меняя один, поправьте
 * второй — иначе клиент и чистка разъедутся.
 */
const AUTOMATION_PATTERN =
  "(HeadlessChrome|Reflectionbot|Chrome-Lighthouse|Lighthouse|PageSpeed|Googlebot|Google-InspectionTool|AdsBot-Google|bingbot|BingPreview|YandexBot|DuckDuckBot|Baiduspider|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|Bytespider|Applebot|facebookexternalhit|Twitterbot|Slackbot|Discordbot|TelegramBot)";

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

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

const query = async (sql) => {
  const data = await apiRequest(`/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    body: { query: sql },
  });

  return rowsOf(data);
};

/**
 * Аккаунты, все сессии которых — автоматика. `bool_and` важен: если с аккаунта
 * хоть раз заходил живой браузер (или Telegram), строка в выборку не попадёт.
 */
const AUTOMATED_ACCOUNTS_SQL = `
with automated as (
  select s.user_id
  from auth.sessions s
  group by s.user_id
  having bool_and(coalesce(s.user_agent, '') ~* '${AUTOMATION_PATTERN}')
)
select u.id as user_id,
       u.created_at,
       (select p.username from public.profiles p where p.user_id = u.id) as username,
       exists (select 1 from public.game_state g where g.user_id = u.id) as has_save,
       exists (select 1 from public.leaderboard l where l.user_id = u.id) as has_leaderboard,
       (select min(s.user_agent) from auth.sessions s where s.user_id = u.id) as user_agent
from auth.users u
join automated a on a.user_id = u.id
where u.is_anonymous
order by u.created_at;
`;

const DELETE_AUTOMATED_ACCOUNTS_SQL = `
with automated as (
  select s.user_id
  from auth.sessions s
  group by s.user_id
  having bool_and(coalesce(s.user_agent, '') ~* '${AUTOMATION_PATTERN}')
)
delete from auth.users u
using automated a
where u.id = a.user_id
  and u.is_anonymous
returning u.id;
`;

const COUNTS_SQL = `
select (select count(*) from auth.users)::int as users,
       (select count(*) from public.game_state)::int as saves,
       (select count(*) from public.profiles)::int as profiles,
       (select count(*) from public.leaderboard)::int as leaderboard;
`;

const showCounts = async (title) => {
  const [counts] = await query(COUNTS_SQL);

  console.log(
    `${title}: пользователей ${counts.users}, сейвов ${counts.saves}, ` +
      `профилей ${counts.profiles}, строк лидерборда ${counts.leaderboard}`,
  );
};

const main = async () => {
  const shouldDelete = process.argv.includes("--delete");

  if (!ACCESS_TOKEN) {
    fail(
      "нет SUPABASE_ACCESS_TOKEN — добавьте Personal Access Token (sbp_...) в .env " +
        "(Dashboard → Account → Access Tokens)",
    );
  }

  if (!projectRef) {
    fail(
      "не удалось определить проект: заполните VITE_SUPABASE_URL или SUPABASE_PROJECT_REF",
    );
  }

  console.log(`→ Management API, проект ${projectRef}`);
  await showCounts("Сейчас");

  const accounts = await query(AUTOMATED_ACCOUNTS_SQL);

  if (!accounts.length) {
    console.log("✅ Аккаунтов, созданных автоматическими браузерами, нет");

    return;
  }

  console.table(
    accounts.map((account) => ({
      user_id: account.user_id,
      username: account.username ?? "—",
      save: account.has_save ? "да" : "—",
      leaderboard: account.has_leaderboard ? "да" : "—",
      created_at: account.created_at,
      user_agent: (account.user_agent ?? "?").slice(0, 60),
    })),
  );

  const withSave = accounts.filter((account) => account.has_save).length;

  console.log(
    `\nНайдено ${accounts.length} аккаунтов автоматических браузеров, ` +
      `из них с сохранением: ${withSave}`,
  );

  if (!shouldDelete) {
    console.log(
      "Ничего не удалено: это проверка. Повторите с флагом --delete, чтобы убрать их.",
    );

    return;
  }

  console.log("\nУдаляем аккаунты и всё, что на них ссылается (каскадом)…");

  const deleted = await query(DELETE_AUTOMATED_ACCOUNTS_SQL);

  console.log(`✅ Удалено аккаунтов: ${deleted.length}`);
  await showCounts("Стало");
};

try {
  await main();
} catch (error) {
  fail(error?.message ?? "неизвестная ошибка");
}
