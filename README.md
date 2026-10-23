# Stellar Croak

Колония жаб на орбите: Vite + React + PixiJS, облако на Supabase, Telegram Mini App
и браузерная версия с одной и той же игровой логикой.

- Прод: **https://stellar-croaks.vercel.app**
- Локально: `npm run dev` (Vite подскажет адрес, обычно http://localhost:5173)
- Сборка: `npm run build`, предпросмотр: `npm run preview`
- Бот: `npm run bot` (нужны `BOT_TOKEN` и `APP_URL`, см. `.env.example`)
- Если у части игроков внизу чата осталась старая кнопка со ссылкой на прежний
  домен: `npm run bot:reset-keyboards` (снимает «залипшую» reply-клавиатуру у всех
  известных игроков; `-- --dry-run` — только посмотреть список).
- Бот на Vercel: webhook `/api/telegram`; настройка —
  [`supabase/README.md`](supabase/README.md), раздел «Бот на Vercel».
- Всё на одном сервере/VPS: `npm run build && npm run start:all` (сайт + бот;
  `START_BOT=0` — только сайт). На Vercel `start:all` не используется: сайт там
  статический, а бот работает через webhook `/api/telegram`.

Вход и схема Supabase, деплой `telegram-auth` и настройка URL описаны в
[`supabase/README.md`](supabase/README.md).
