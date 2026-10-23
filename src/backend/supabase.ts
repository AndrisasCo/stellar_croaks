import { createClient } from "@supabase/supabase-js";

/**
 * Клиент Supabase и признак того, что облако вообще настроено.
 *
 * Вынесено из `db.ts` отдельным модулем, чтобы слой авторизации (`auth.ts`) не тянул
 * циклический импорт через localStorage. Секретов в коде нет: значения приходят из
 * `.env`, а Vite инлайнит их в бандл на этапе сборки (шаблон — в `.env.example`).
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
/**
 * Публичный ключ проекта. Supabase выдаёт его под именем `publishable`
 * (`sb_publishable_...`), но старые проекты и документация зовут тот же ключ `anon`.
 * `supabase-js` работает с обоими одинаково, поэтому принимаем любое имя.
 */
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Заданы ли креды Supabase. Без них облачный синк, лидерборд и вход отключены —
 * игра продолжает работать на localStorage в офлайне.
 */
export const isCloudSyncEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isCloudSyncEnabled) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (или " +
      "VITE_SUPABASE_ANON_KEY) не заданы — облачная синхронизация, лидерборд и вход " +
      "отключены. Добавьте их в .env (см. .env.example)."
  );
}

// Клиент создаём всегда, чтобы импорт модуля не падал без env; при выключенном
// синке запросы не уходят (см. guard `isCloudSyncEnabled` в каждой функции).
export const supabase = createClient<any>(
  SUPABASE_URL || "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY || "public-anon-key"
);
