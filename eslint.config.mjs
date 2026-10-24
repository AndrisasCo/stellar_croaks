import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * ESLint для Vite + React + TypeScript.
 *
 * Раньше здесь лежал конфиг от шаблона Next (`eslint-config-next`), хотя проект
 * собирается Vite: зависимостей Next в `package.json` нет, поэтому `npm run lint`
 * просто не запускался. Теперь правила те же, что у официального шаблона
 * `vite react-ts`, плюс отдельный блок для Node-скриптов (бот, проверки, конфиги).
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".agent-cache/**",
      "public/**",
      "design-src/**",
      "supabase/**",
    ],
  },

  // Игра: браузер, React, TypeScript.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Неиспользуемые импорты и переменные — ошибка: именно они копятся при
      // рефакторинге (`tsc` в этом проекте их не ловит, noUnusedLocals выключен).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
      // `any` остаётся там, где приходят ответы Supabase/Telegram без типов.
      "@typescript-eslint/no-explicit-any": "off",
      // Пустые `catch {}` — осознанный приём: недоступный API не должен ломать игру.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Проверку HMR-границ делает сам Vite, шум от не-компонентных экспортов не нужен.
      "react-refresh/only-export-components": "off",
    },
  },

  // Node-скрипты: бот, серверные функции, проверки в `tmp-verify-*`, конфиги.
  {
    files: [
      "bot/**/*.js",
      "bot.js",
      "api/**/*.js",
      "scripts/**/*.mjs",
      "tmp-*.mjs",
      "*.config.{js,mjs}",
      "tailwind.config.js",
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);

