/**
 * АВТОМАТИЧЕСКИЕ БРАУЗЕРЫ: краулеры, headless-скриншотеры, SEO-боты.
 *
 * Веб-версия на старте создаёт анонимную сессию Supabase, а первый синк заводит
 * строки `game_state` и `profiles` (ник `user_<timestamp>`). Живому игроку это и
 * нужно, а вот бот, который просто исполняет JS страницы, оставлял после себя
 * «лишнего игрока». В проде так и появились строки от `HeadlessChrome/141`
 * (скриншотер: два сохранения за секунду) и `Reflectionbot`.
 *
 * Поэтому ДО входа спрашиваем, живой ли браузер. Список нарочно узкий — только
 * явные признаки автоматизации, чтобы не отключить облако настоящему игроку:
 * обычный Chrome/Safari, Telegram WebView и мобильные браузеры под шаблон не
 * попадают.
 */

/**
 * Признаки ботов в `navigator.userAgent` (регистр не важен).
 *
 * `HeadlessChrome` — Puppeteer/Playwright и скриншотеры; `Reflectionbot` — бот,
 * который уже оставил в базе сохранение; остальные — поисковые и соцсети,
 * которые исполняют JS при обходе страницы.
 */
const AUTOMATION_USER_AGENT =
  /(?:HeadlessChrome|Reflectionbot|Chrome-Lighthouse|Lighthouse|PageSpeed|Googlebot|Google-InspectionTool|AdsBot-Google|bingbot|BingPreview|YandexBot|DuckDuckBot|Baiduspider|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|Bytespider|Applebot|facebookexternalhit|Twitterbot|Slackbot|Discordbot|TelegramBot)/i;

/** Что именно проверяем в браузере. Вынесено в тип, чтобы тесты подставляли своё. */
export type BrowserProbe = {
  /** `navigator.userAgent`; вне браузера (node) его может не быть. */
  userAgent?: string;
  /** `navigator.webdriver`: `true` у Playwright, Puppeteer и Selenium. */
  webdriver?: boolean;
};

/** Признаки текущего браузера. В node `navigator` нет — тогда признаков нет. */
const readBrowserProbe = (): BrowserProbe => {
  if (typeof navigator === "undefined") {
    return {};
  }

  return {
    userAgent: navigator.userAgent,
    webdriver: navigator.webdriver === true,
  };
};

/**
 * `true` — страницу открыла автоматика, а не человек: облако ей не нужно.
 *
 * Проверка стоит в двух местах: `boot.ts` (не тратить попытки входа) и
 * `ensureAccount` (любое обращение к облаку). Достаточно одного «нет» аккаунта,
 * чтобы `game_state`, `profiles` и `leaderboard` остались нетронутыми: все
 * записи в них начинаются с `resolveAccountId()`.
 */
export const isAutomatedBrowser = (
  probe: BrowserProbe = readBrowserProbe(),
): boolean => {
  if (probe.webdriver === true) {
    return true;
  }

  return AUTOMATION_USER_AGENT.test(probe.userAgent ?? "");
};
