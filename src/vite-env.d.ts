/// <reference types="vite/client" />

/**
 * Типизация публичных переменных окружения Vite.
 *
 * Значения `VITE_*` инлайнятся в бандл на этапе сборки (`import.meta.env.*`).
 * Никогда не кладите сюда секреты, которые нельзя показывать в браузере
 * (anon-ключ Supabase — публичный по дизайну, но RLS обязателен).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
