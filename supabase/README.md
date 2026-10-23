# Supabase: что нужно сделать один раз

Всё, что не может делать клиент: проверка подписи Telegram, политики доступа и
приём денег живут здесь. Клиент про эти файлы знает только то, что описано в
`src/backend/auth.ts` и `src/backend/purchases.ts`.

## Быстрый старт

```bash
# 1. В .env уже должны быть VITE_SUPABASE_URL и публичный ключ
#    (VITE_SUPABASE_PUBLISHABLE_KEY или старое имя VITE_SUPABASE_ANON_KEY).

# 2. Один раз добавить Personal Access Token (sbp_...) из
#    https://supabase.com/dashboard/account/tokens
#    SUPABASE_ACCESS_TOKEN=sbp_...

npm run db:push   # таблицы + RLS + Anonymous sign-ins + Email provider
npm run dev       # клиент создаст сессию и включит облачный синк
```

Публичный ключ не может создавать таблицы — ему для этого не хватает прав. Именно
поэтому для разовой настройки нужен PAT (или строка подключения Postgres, см. ниже).

## 1. Схема и RLS — одной командой

Добавьте в `.env` Personal Access Token (Dashboard → **Account** → **Access Tokens**,
начинается с `sbp_`) и выполните:

```bash
npm run db:push
```

`scripts/db-push.mjs` применит `supabase/schema.sql` целиком, проверит, что все
таблицы созданы, и включит обязательные провайдеры Auth. Вставлять SQL в редактор
руками не нужно; повторный запуск безопасен — скрипт идемпотентный.

Публичный ключ (`VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`) для
создания таблиц не подходит: это ключ доступа к данным, а не к управлению проектом.
Если PAT нет, можно указать строку подключения Postgres — тогда скрипт применит
схему через `psql`:

```bash
# .env
SUPABASE_DB_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres
```

Что получится:

| таблица | кто читает | кто пишет |
| --- | --- | --- |
| `game_state` | только владелец строки | только владелец (`content`, `achievements`, `collider`, `shop`, `tg_id`) |
| `leaderboard` | все | каждый — только свою строку |
| `credits` | только владелец | бот (service-role); клиент может лишь проставить `applied_at` |
| `players` | никто из клиентов | Edge Function и бот (service-role) |

**Anonymous sign-ins** и **Email provider** скрипт включает сам (через Management API).
Без анонимного входа веб-версия (и Telegram, пока функция не задеплоена) останется
без сессии, и облако молча выключится. Если запускали схему через `psql` и PAT не
использовали, включите вручную: Authentication → Sign In / Providers →
*Allow anonymous sign-ins* и *Email*.

Email нужен для входа и регистрации в браузере (модалка «Аккаунт» в меню игры,
`src/backend/auth.ts` → `signUpWithEmail`/`signInWithEmail`). Пароли проверяет сам
GoTrue, нам остаётся только показывать его ответ.

Там же — *Confirm email*. Выключено (по умолчанию): регистрация сразу отдаёт сессию,
и игрок попадает в игру. Включено: аккаунт создаётся, но игрок сначала подтверждает
почту по ссылке из письма — игра ему об этом честно скажет и в аккаунт не пустит.

Регистрация вызывается уже из анонимной сессии (в вебе она создаётся на старте),
поэтому GoTrue не заводит второго пользователя, а превращает анонимного в постоянного —
вместе с его колонией, покупками и строкой в лидерборде.

## 2. Секреты функции `telegram-auth`

```bash
supabase secrets set BOT_TOKEN=123456789:AA... SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase functions deploy telegram-auth
```

Без `BOT_TOKEN` функция отвечает `server_not_configured`, и клиент тихо падает
обратно в анонимную сессию — игра работает, но `tg_id` остаётся неподтверждённым.

## 3. Проверка до деплоя

Алгоритм подписи проверяется без сети и без Supabase:

```bash
node tmp-verify-init-data.mjs
```

Скрипт считает подпись независимо, через `node:crypto`, и проверяет, что чужой
токен, подменённый `tg_id`, просроченный `auth_date` и строка без `hash` отклоняются.

Вход и регистрация по почте проверяются так же — без браузера и без сети:

```bash
npm run verify:auth
```

Скрипт подменяет методы клиента Supabase и проверяет, что регистрация, подтверждение
почты, ошибки сервера, выход из аккаунта (включая пропавшую сеть) и выключенное
облако ведут себя так, как ждёт игра.

## 4. Секреты бота

Бот (`bot.js`) ходит в Supabase service-role ключом и принимает Stars:

```bash
BOT_TOKEN=123456789:AA...
APP_URL=https://stellar.hookhub.ru     # ссылка на игру для кнопки web_app
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Запуск: `npm run bot` (значения подхватываются из `.env`).
