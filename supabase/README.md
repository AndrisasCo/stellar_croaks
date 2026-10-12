# Supabase: что нужно сделать один раз

Всё, что не может делать клиент: проверка подписи Telegram, политики доступа и
приём денег живут здесь. Клиент про эти файлы знает только то, что описано в
`src/backend/auth.ts` и `src/backend/purchases.ts`.

## 1. Схема и RLS

Supabase → **SQL Editor** → выполнить `supabase/schema.sql` целиком.
Скрипт идемпотентный: свежая база и уже потрёпанная тестовая приходят к одному виду.

Что получится:

| таблица | кто читает | кто пишет |
| --- | --- | --- |
| `game_state` | только владелец строки | только владелец (`content`, `achievements`, `collider`, `shop`, `tg_id`) |
| `leaderboard` | все | каждый — только свою строку |
| `credits` | только владелец | бот (service-role); клиент может лишь проставить `applied_at` |
| `players` | никто из клиентов | Edge Function и бот (service-role) |

**Anonymous sign-ins** обязан быть включён: Supabase → Authentication → Sign In /
Providers → *Allow anonymous sign-ins*. Иначе веб-версия (и Telegram, если функция
ещё не задеплоена) останется без сессии, и облако молча выключится.

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

## 4. Секреты бота

Бот (`bot.js`) ходит в Supabase service-role ключом и принимает Stars:

```bash
BOT_TOKEN=123456789:AA...
APP_URL=https://stellar.hookhub.ru     # ссылка на игру для кнопки web_app
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Запуск: `npm run bot` (значения подхватываются из `.env`).
