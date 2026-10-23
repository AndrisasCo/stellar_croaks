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

npm run db:push   # таблицы + RLS + Anonymous sign-ins + Email + автоподтверждение
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
таблицы созданы и права выданы правильно, и включит обязательные провайдеры Auth.
Заодно он выставляет `site_url` и Redirect URLs из `APP_URL` (см. `.env`), чтобы
ссылки из писем возвращали игрока в игру, а не на localhost. Вставлять SQL в
редактор руками не нужно; повторный запуск безопасен — скрипт идемпотентный.

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

**Anonymous sign-ins**, **Email provider** и **автоподтверждение почты**
(`mailer_autoconfirm`) скрипт включает сам (через Management API). Без анонимного
входа веб-версия (и Telegram, пока функция не задеплоена) останется без сессии, и
облако молча выключится. Если запускали схему через `psql` и PAT не использовали,
включите вручную: Authentication → Sign In / Providers → *Allow anonymous sign-ins*
и *Email*.

Email нужен для входа и регистрации в браузере (модалка «Аккаунт» в меню игры,
`src/backend/auth.ts` → `signUpWithEmail`/`signInWithEmail`). Пароли проверяет сам
GoTrue, нам остаётся только показывать его ответ.

**Confirm email выключен намеренно.** Своего SMTP у проекта нет, а встроенный
отправитель жёстко лимитирован: с включённым подтверждением регистрация заканчивалась
бы аккаунтом без сессии, а письмо могло не дойти. С `mailer_autoconfirm = true` игрок
входит сразу. Цена — почта не проверяется. Если нужна настоящая верификация:
настройте SMTP (Authentication → Emails), верните `mailer_autoconfirm: false` и
добавьте адреса игры в Redirect URLs.

Куда вернуть игрока после письма, задаёт `emailRedirectTo` (текущий origin), а
Supabase сверяет его со списком Redirect URLs. `npm run db:push` прописывает туда
`http://localhost:5173/**`, `http://localhost:4173/**` и `APP_URL` игры
(`https://stellar-croaks.vercel.app/**`); `site_url` — основной адрес игры.
Если домен переехал, поменяйте `APP_URL` и повторите `db:push` (или поправьте
Authentication → URL Configuration вручную).

Регистрация вызывается уже из анонимной сессии (в вебе она создаётся на старте),
поэтому идёт через `auth.updateUser()`, а не `signUp()`: GoTrue сохраняет того же
пользователя, и колония, покупки и строка лидерборда остаются на месте. Голый
`signUp()` создал бы второй аккаунт с новым uuid.

## 2. Секреты функции `telegram-auth`

```bash
npx supabase secrets set BOT_TOKEN=123456789:AA... --project-ref <ref>
npx supabase functions deploy telegram-auth --project-ref <ref>
```

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` платформа передаёт функции сама, задавать
их не нужно (CLI всё равно отказывается сохранять секреты с префиксом `SUPABASE_`).
`BOT_TOKEN` — единственный секрет, который добавляем вручную.

`supabase/config.toml` уже выключает для этой функции платформенную проверку JWT
(`verify_jwt = false`): клиент зовёт её до появления сессии, а публичный ключ
(`sb_publishable_...`) — не JWT. Саму подпись `initData` функция проверяет через
`BOT_TOKEN`.

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

Скрипт подменяет методы клиента Supabase и проверяет, что регистрация (в том числе
превращение анонимного игрока в постоянного через `updateUser` с сохранением uuid),
подтверждение почты, ошибки сервера, вход, выход (включая пропавшую сеть) и
выключенное облако ведут себя так, как ждёт игра.

## 4. Секреты бота

Бот (`bot.js`) ходит в Supabase service-role ключом и принимает Stars:

```bash
BOT_TOKEN=123456789:AA...
APP_URL=https://stellar-croaks.vercel.app  # ссылка на игру для кнопки web_app
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Запуск: `npm run bot` (значения подхватываются из `.env`).

Без `APP_URL` и `SUPABASE_SERVICE_ROLE_KEY` бот всё равно стартует, но работает
как витрина: `/start`, `/help` и `/buy` отвечают, однако кнопки «Играть» нет, а
покупка отвечает «Оплата пока не настроена». Для продажи звёзд нужны оба значения,
таблица `players` (её наполняет задеплоенная `telegram-auth`) и запущенный бот.

## 5. Прод-адрес и Telegram

Прод живёт на Vercel: **https://stellar-croaks.vercel.app**. Этот адрес записан в
`APP_URL`, поэтому `npm run db:push` сам поддерживает `site_url` и Redirect URLs в
актуальном состоянии. При старте бот ставит кнопку меню на `APP_URL` — после смены
домена достаточно перезапустить его, и игроки не останутся на мёртвой ссылке.

Отдельно есть **Main Mini App** — ссылка вида `https://t.me/bioblobbot?startapp`.
Её адрес хранится только в BotFather (Bot Settings → Main Mini App) и через Bot API
не меняется: при переезде домена обновите его там вручную. Кнопка меню и Main Mini
App должны вести на один и тот же `https://stellar-croaks.vercel.app/`, иначе часть
игроков попадёт на старый домен.

Важно про определение платформы: `telegram-web-app.js` создаёт
`window.Telegram.WebApp` и в обычном браузере, поэтому одного наличия объекта мало.
Telegram-ом игра считает окружение только при непустом `initData`; иначе это веб:
показывается пункт «Аккаунт» и создаётся анонимная сессия Supabase
(см. `src/platform/index.ts`).
