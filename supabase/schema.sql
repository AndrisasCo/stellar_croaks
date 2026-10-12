-- ============================================================================
-- Stellar Croak: схема Supabase.
--
-- Приложение ещё не в проде, поэтому файл — не история миграций, а актуальный
-- срез: целиком выполняется в Supabase → SQL Editor. Позже его можно разрезать
-- на миграции (`supabase migration new ...`) без изменения логики клиента.
--
-- Ключ аккаунта везде — `user_id` (uuid из Supabase Auth): одна и та же игра
-- работает и в Telegram (сессия после проверки initData), и в вебе (анонимная
-- сессия). `tg_id` — только «визитка» для уведомлений бота, у веб-игрока её нет.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. game_state — сейв игрока
-- ---------------------------------------------------------------------------
create table if not exists public.game_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tg_id bigint,
  content jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '{}'::jsonb,
  collider jsonb not null default '{}'::jsonb,
  -- Магазин синхронизировался только в коде: без колонки update/insert падали.
  shop jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Один игрок Telegram = один аккаунт, значит и один tg_id на строку.
create unique index if not exists game_state_tg_id_key
  on public.game_state (tg_id)
  where tg_id is not null;

-- ---------------------------------------------------------------------------
-- 2. leaderboard — витрина достижений (пишется каждой игрой, читается всеми)
-- ---------------------------------------------------------------------------
create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tg_id bigint,
  username text not null default '',
  tokens integer not null default 0,
  total_toads integer not null default 0,
  total_species integer not null default 0,
  toads_collection jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_tokens_idx
  on public.leaderboard (tokens desc);

-- ---------------------------------------------------------------------------
-- 3. credits — покупки за Telegram Stars (пишет только бот, читает клиент)
-- ---------------------------------------------------------------------------
create table if not exists public.credits (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tokens integer not null check (tokens > 0),
  stars integer not null default 0,
  payload text,
  -- Idempotency-ключ Telegram: повторный вебхук не начислит покупку дважды.
  telegram_payment_charge_id text unique,
  -- Когда клиент «обналичил» начисление в сейв (см. src/backend/purchases.ts).
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists credits_pending_idx
  on public.credits (user_id)
  where applied_at is null;

-- ---------------------------------------------------------------------------
-- 4. players — связка tg_id → user_id для бота (наполняет Edge Function)
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  tg_id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null default '',
  language_code text,
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- 5. RLS: без политик таблицы недоступны никому, кроме service-role.
--
-- Игрок входит анонимно или через Telegram — в обоих случаях он получает роль
-- `authenticated`, поэтому «анонимный» игрок в вебе ничем не хуже: он видит
-- ровно свою строку, потому что сравниваем с `auth.uid()`.
-- ---------------------------------------------------------------------------
alter table public.game_state enable row level security;
alter table public.leaderboard enable row level security;
alter table public.credits enable row level security;
alter table public.players enable row level security;

-- game_state: свой сейв — единственный видимый и единственный изменяемый.
drop policy if exists game_state_select_own on public.game_state;
create policy game_state_select_own on public.game_state
  for select using (auth.uid() = user_id);

drop policy if exists game_state_insert_own on public.game_state;
create policy game_state_insert_own on public.game_state
  for insert with check (auth.uid() = user_id);

drop policy if exists game_state_update_own on public.game_state;
create policy game_state_update_own on public.game_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists game_state_delete_own on public.game_state;
create policy game_state_delete_own on public.game_state
  for delete using (auth.uid() = user_id);

-- leaderboard: читают все (это витрина), пишет каждый только свою строку.
drop policy if exists leaderboard_select_all on public.leaderboard;
create policy leaderboard_select_all on public.leaderboard
  for select using (true);

drop policy if exists leaderboard_insert_own on public.leaderboard;
create policy leaderboard_insert_own on public.leaderboard
  for insert with check (auth.uid() = user_id);

drop policy if exists leaderboard_update_own on public.leaderboard;
create policy leaderboard_update_own on public.leaderboard
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- credits: игрок видит свои начисления и вправе отметить их обработанными.
-- Политики на создание нет вовсе: деньги принимает только бот, который ходит
-- service-role ключом (он обходит RLS).
drop policy if exists credits_select_own on public.credits;
create policy credits_select_own on public.credits
  for select using (auth.uid() = user_id);

drop policy if exists credits_mark_applied on public.credits;
create policy credits_mark_applied on public.credits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- players: игроку там делать нечего — это внутренняя связка для бота.
-- Политик нет: значит ни select, ни insert через anon/authenticated не пройдут.


-- ---------------------------------------------------------------------------
-- 6. Права. RLS ограничивает строки, GRANT — операции и колонки.
--
-- Про колонки: политика определяет, какие СТРОКИ видит игрок, но не какие поля он
-- вправе менять. Поэтому `update` выдаём не на таблицу целиком, а на конкретные
-- колонки — иначе игрок мог бы нарисовать себе кваксы в `credits` или подменить
-- `user_id` в лидерборде.
-- ---------------------------------------------------------------------------
revoke all on public.game_state, public.leaderboard, public.credits, public.players
  from anon;

grant select, insert, delete on public.game_state to authenticated;
grant update (content, achievements, collider, shop, tg_id, updated_at)
  on public.game_state to authenticated;

grant select on public.leaderboard to authenticated;
grant insert (user_id, tg_id, username, tokens, total_toads, total_species,
              toads_collection)
  on public.leaderboard to authenticated;
grant update (tg_id, username, tokens, total_toads, total_species,
              toads_collection, updated_at)
  on public.leaderboard to authenticated;

grant select on public.credits to authenticated;
grant update (applied_at) on public.credits to authenticated;

-- Бот и Edge Function работают service-role ключом: им доступно всё.
grant all on public.game_state, public.leaderboard, public.credits, public.players
  to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- 7. Если таблицы уже создавались вручную (до этого файла) — дотягиваем их.
-- Для свежей базы безвредно: всё с `if not exists`.
-- ---------------------------------------------------------------------------
alter table public.game_state
  add column if not exists shop jsonb not null default '{}'::jsonb;
alter table public.game_state add column if not exists tg_id bigint;
alter table public.game_state add column if not exists user_id uuid;
alter table public.leaderboard add column if not exists tg_id bigint;
alter table public.leaderboard add column if not exists user_id uuid;
