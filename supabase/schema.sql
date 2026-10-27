-- ============================================================================
-- Stellar Croak: схема Supabase.
--
-- Файл — не история миграций, а актуальный срез: применяется одной командой
-- `npm run db:push` (см. supabase/README.md). Позже его можно разрезать на
-- миграции (`supabase migration new ...`) без изменения логики клиента.
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
  -- Торговая Капсула синхронизировался только в коде: без колонки update/insert падали.
  shop jsonb not null default '{}'::jsonb,
  -- Журнал заданий: забранные награды обязаны переживать смену устройства, иначе
  -- одно и то же задание можно закрыть повторно (см. docs/quest-journal.md, D2).
  quests jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Колонки, появившиеся после первых релизов. Дотягиваем их ДО индексов и
-- грантов ниже: `grant update (column)` и индекс на несуществующую колонку
-- падают, и тогда схема не применится к уже существующей базе.
alter table public.game_state
  add column if not exists shop jsonb not null default '{}'::jsonb;
alter table public.game_state
  add column if not exists quests jsonb not null default '{}'::jsonb;
alter table public.game_state add column if not exists tg_id bigint;

-- Один игрок Telegram = один аккаунт, значит и один tg_id на строку.
create unique index if not exists game_state_tg_id_key
  on public.game_state (tg_id)
  where tg_id is not null;

-- ---------------------------------------------------------------------------
-- 2. leaderboard — витрина достижений (пишется каждой игрой, читается всеми)
--
-- Имени здесь нет: оно принадлежит аккаунту (см. `profiles`), а строка хранит
-- только ссылку `user_id`. Иначе переименование в настройках не долетало бы до
-- уже записанных строк, и на лидерборде висели бы старые ники.
-- ---------------------------------------------------------------------------
create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tg_id bigint,
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
-- 5. profiles — имя игрока, привязанное к аккаунту
--
-- Имя живёт рядом с аккаунтом (`auth.users.id`), а не в строке лидерборда:
-- переименование в настройках сразу меняет ник во всех витринах. Читают профиль
-- все (это нужно лидерборду), менять может только владелец.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 32 — запас над клиентским лимитом (15): имя из Telegram бывает длиннее.
  username text not null check (char_length(username) between 1 and 32),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- 6. RLS: без политик таблицы недоступны никому, кроме service-role.
--
-- Игрок входит анонимно или через Telegram — в обоих случаях он получает роль
-- `authenticated`, поэтому «анонимный» игрок в вебе ничем не хуже: он видит
-- ровно свою строку, потому что сравниваем с `auth.uid()`.
-- ---------------------------------------------------------------------------
alter table public.game_state enable row level security;
alter table public.leaderboard enable row level security;
alter table public.credits enable row level security;
alter table public.players enable row level security;
alter table public.profiles enable row level security;

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

-- profiles: имя видят все (оно нужно лидерборду), меняет — только владелец.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 7. Права. RLS ограничивает строки, GRANT — операции и колонки.
--
-- Про колонки: политика определяет, какие СТРОКИ видит игрок, но не какие поля он
-- вправе менять. Поэтому `update` выдаём не на таблицу целиком, а на конкретные
-- колонки — иначе игрок мог бы нарисовать себе кваксы в `credits` или подменить
-- `user_id` в лидерборде.
--
-- ВАЖНО: Supabase по умолчанию выдаёт anon и authenticated ALL на новые таблицы
-- public. Пока это право не отозвано, колоночные grant'ы ниже ничего не
-- ограничивают: табличный UPDATE разрешит менять и `credits.tokens`. Поэтому
-- отзываем у обеих ролей всё, а затем выдаём ровно нужное.
-- ---------------------------------------------------------------------------
revoke all on public.game_state, public.leaderboard, public.credits, public.players,
  public.profiles
  from anon, authenticated;

grant select, insert, delete on public.game_state to authenticated;
grant update (content, achievements, collider, shop, quests, tg_id, updated_at)
  on public.game_state to authenticated;

grant select on public.leaderboard to authenticated;
grant insert (user_id, tg_id, tokens, total_toads, total_species,
              toads_collection)
  on public.leaderboard to authenticated;
grant update (tg_id, tokens, total_toads, total_species,
              toads_collection, updated_at)
  on public.leaderboard to authenticated;

grant select on public.credits to authenticated;
grant update (applied_at) on public.credits to authenticated;

-- profiles: имя читают все (лидерборд), пишет каждый только своё.
grant select on public.profiles to authenticated;
grant insert (user_id, username, updated_at) on public.profiles to authenticated;
grant update (username, updated_at) on public.profiles to authenticated;

-- Бот и Edge Function работают service-role ключом: им доступно всё.
grant all on public.game_state, public.leaderboard, public.credits, public.players,
  public.profiles
  to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- 8. Если таблицы уже создавались вручную (до этого файла) — дотягиваем их.
-- Для свежей базы безвредно: всё с `if not exists`.
-- ---------------------------------------------------------------------------
alter table public.game_state add column if not exists user_id uuid;
alter table public.leaderboard add column if not exists tg_id bigint;
alter table public.leaderboard add column if not exists user_id uuid;

-- Имя больше не дублируется в лидерборде: переносим ники из старой колонки в
-- `profiles`, затем колонку убираем. Блок идемпотентный: на свежей базе колонки
-- нет, и запрос просто пропускается.
do $migrate$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leaderboard'
      and column_name = 'username'
  ) then
    execute $copy$
      insert into public.profiles (user_id, username)
      select l.user_id, left(btrim(l.username), 32)
      from public.leaderboard l
      -- Строки без аккаунта (старый лидерборд жил на tg_id) пропускаем: у них нет
      -- user_id, а внешний ключ `profiles` смотрит в auth.users.
      join auth.users u on u.id = l.user_id
      where nullif(btrim(l.username), '') is not null
      on conflict (user_id) do nothing
    $copy$;

    execute 'alter table public.leaderboard drop column username';
  end if;
end
$migrate$;

-- Игроки, которые ещё не заходили после обновления, но уже есть в Auth: имя из
-- Telegram лежит в `user_metadata`, оттуда и заводим профиль (существующий ник
-- не перетираем — его мог выбрать сам игрок).
insert into public.profiles (user_id, username)
select u.id, left(btrim(u.raw_user_meta_data ->> 'username'), 32)
from auth.users u
where nullif(btrim(coalesce(u.raw_user_meta_data ->> 'username', '')), '') is not null
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. PostgREST кэширует схему. После DDL просим перечитать её, иначе REST может
-- ещё какое-то время отвечать «Could not find the table ... in the schema cache».
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
