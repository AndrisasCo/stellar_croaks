/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Размеры шрифтов берём из CSS-переменных (см. src/index.css).
      // Значения переменных на мобильной версии = дефолтам Tailwind, а на
      // desktop-брейкпоинте чуть увеличиваются — при этом лейаут (отступы,
      // ширины, gap и т.д.) остаётся прежним, растёт только текст.
      fontSize: {
        // микро-подписи (бейджи, подписи в модалках)
        "3xs": "var(--fs-3xs)", // 9px → 10px
        "2xs": "var(--fs-2xs)", // 10px → 11px
        "1xs": "var(--fs-1xs)", // 11px → 12px
        xs: ["var(--fs-xs)", { lineHeight: "var(--lh-xs)" }], // 12 → 13px
        sm: ["var(--fs-sm)", { lineHeight: "var(--lh-sm)" }], // 14 → 15px
        base: ["var(--fs-base)", { lineHeight: "var(--lh-base)" }], // 16 → 17px
        lg: ["var(--fs-lg)", { lineHeight: "var(--lh-lg)" }], // 18 → 19px
        xl: ["var(--fs-xl)", { lineHeight: "var(--lh-xl)" }], // 20 → 21px
        "2xl": ["var(--fs-2xl)", { lineHeight: "var(--lh-2xl)" }], // 24 → 25px
        "3xl": ["var(--fs-3xl)", { lineHeight: "var(--lh-3xl)" }], // 30 → 31px
        "4xl": ["var(--fs-4xl)", { lineHeight: "var(--lh-4xl)" }], // 36 → 38px
        "5xl": ["var(--fs-5xl)", { lineHeight: "var(--lh-5xl)" }], // 48 → 50px
      },
    },
  },
  plugins: [],
};
