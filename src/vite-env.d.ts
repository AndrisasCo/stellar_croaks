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
  /** Новое имя публичного ключа Supabase (`sb_publishable_...`). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Старое имя того же публичного ключа (`anon`) — поддерживается для совместимости. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
