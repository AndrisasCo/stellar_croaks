/**
 * Проверка ПЛАТФОРМЕННОГО СЛОЯ на РЕАЛЬНОМ коде проекта (без браузера и Telegram).
 *
 * Модуль `src/platform/index.ts` бандлится через esbuild и прогоняется как обычный
 * JS; вместо `window` подставляется заглушка, а вместо Telegram — фейковый WebApp со
 * списком вызванных методов. Проверяем ровно те грабли, из-за которых игра раньше
 * ломалась или теряла игрока:
 *   1) пока Telegram не появился — платформа web; когда объект WebApp подъехал
 *      (скрипт асинхронный), платформа ПЕРЕключается на telegram — без перезагрузки;
 *   2) на старом клиенте нет `disableVerticalSwipes`/`setHeaderColor` — они не
 *      вызываются вообще (а не падают);
 *   3) метод, который есть, но бросает исключение, не роняет приложение;
 *   4) маппинг вибрации, темы, размеров и BackButton — тот, что ждёт игра;
 *   5) `initData` отдаётся сырой строкой (её проверяет сервер), а `tgId`/`username`
 *      берутся из неподписанного initDataUnsafe — только для отображения;
 *   6) в веб-реализации всё «пустое», но ничего не падает.
 *
 * Запуск: node tmp-verify-platform.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-platform-"));
const root = process.cwd();

/** Собрать модуль проекта в CJS, чтобы запустить его в node */
const bundle = (entry, name) => {
  const outfile = join(outDir, `${name}.cjs`);
  execFileSync(
    "npx",
    [
      "esbuild",
      entry,
      "--bundle",
      "--format=cjs",
      "--platform=node",
      "--log-level=error",
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] }
  );

  return require(outfile);
};

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

/** Заглушка браузера: высота, confirm/alert/open и localStorage */
const makeBrowser = (Telegram = null) => {
  const calls = [];
  const store = new Map();

  return {
    calls,
    store,
    window: {
      Telegram,
      innerHeight: 800,
      matchMedia: () => ({ matches: true }),
      open: (url) => calls.push(["window.open", url]),
      confirm: (message) => {
        calls.push(["window.confirm", message]);
        return true;
      },
      alert: (message) => calls.push(["window.alert", message]),
      localStorage: {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, value),
        removeItem: (key) => store.delete(key),
      },
    },
  };
};

/** Фейковый WebApp: запоминает вызовы и умеет «быть старым» */
const makeWebApp = (overrides = {}) => {
  const calls = [];
  const push = (name) => (...args) => {
    calls.push([name, ...args]);
    return app;
  };

  const app = {
    calls,
    initData:
      "auth_date=1800000000&user=%7B%22id%22%3A857360604%7D&hash=deadbeefdeadbeef",
    initDataUnsafe: {
      user: { id: 857360604, first_name: "Алиса", last_name: "Квак", username: "alice" },
    },
    colorScheme: "dark",
    themeParams: { bg_color: "#101010" },
    viewportHeight: 690,
    viewportStableHeight: 712,
    isExpanded: true,
    ready: push("ready"),
    expand: push("expand"),
    enableClosingConfirmation: push("enableClosingConfirmation"),
    disableVerticalSwipes: push("disableVerticalSwipes"),
    setHeaderColor: push("setHeaderColor"),
    openLink: push("openLink"),
    openTelegramLink: push("openTelegramLink"),
    showConfirm: (message, callback) => {
      calls.push(["showConfirm", message]);
      callback(true);
    },
    showAlert: (message, callback) => {
      calls.push(["showAlert", message]);
      callback?.();
    },
    HapticFeedback: {
      impactOccurred: (style) => calls.push(["impactOccurred", style]),
      notificationOccurred: (type) => calls.push(["notificationOccurred", type]),
      selectionChanged: () => calls.push(["selectionChanged"]),
    },
    BackButton: {
      show: () => calls.push(["backButton.show"]),
      hide: () => calls.push(["backButton.hide"]),
      onClick: (handler) => calls.push(["backButton.onClick", handler]),
      offClick: (handler) => calls.push(["backButton.offClick", handler]),
    },
    ...overrides,
  };

  return app;
};

const browser = makeBrowser(null);
globalThis.window = browser.window;

// Модуль берём ПОСЛЕ подстановки window: читает он лениво, но так тест ближе к браузеру
const {
  createTelegramPlatform,
  createWebPlatform,
  detectPlatformName,
  getPlatform,
  platform,
} = bundle("src/platform/index.ts", "platform");

const called = (calls, name) => calls.some(([call]) => call === name);
const argOf = (calls, name) => calls.find(([call]) => call === name)?.[1];

/** Ловим предупреждения платформы: «не поддерживается» — норма, «упал» — нет */
const catchWarnings = (run) => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));

  try {
    run();
  } finally {
    console.warn = original;
  }

  return warnings;
};

// 1. Ленивый выбор платформы и переключение, когда Telegram подъехал
check("без Telegram платформа — web", detectPlatformName(), "web");
check("getPlatform() отдаёт веб-реализацию", getPlatform().name, "web");

const app = makeWebApp();
browser.window.Telegram = { WebApp: makeWebApp({ initData: "" }) };

check(
  "WebApp с пустым initData — всё ещё браузер",
  detectPlatformName(),
  "web"
);

browser.window.Telegram = { WebApp: app };

check("Telegram появился — платформа переключилась", getPlatform().name, "telegram");
check("фасад platform тоже переключился", platform.name, "telegram");

// 2. init(): приветствие клиента без исключений
const telegram = createTelegramPlatform(() => app);
telegram.init();
check("ready вызван", called(app.calls, "ready"), true);
check("expand вызван", called(app.calls, "expand"), true);
check("подтверждение закрытия включено", called(app.calls, "enableClosingConfirmation"), true);
check("свайпы вниз выключены", called(app.calls, "disableVerticalSwipes"), true);
check("шапка перекрашена в фон игры", argOf(app.calls, "setHeaderColor"), "#070c14");

// 3. Старый клиент: методов нет — их не вызывают вовсе
const oldApp = makeWebApp();
delete oldApp.disableVerticalSwipes;
delete oldApp.setHeaderColor;
const oldPlatform = createTelegramPlatform(() => oldApp);
const oldWarnings = catchWarnings(() => oldPlatform.init());
check(
  "на старом клиенте disableVerticalSwipes не вызван",
  called(oldApp.calls, "disableVerticalSwipes"),
  false
);
check("на старом клиенте setHeaderColor не вызван", called(oldApp.calls, "setHeaderColor"), false);
check("и приложение не ругалось на отсутствие методов", oldWarnings.length, 0);

// 4. Метод есть, но бросает — игра не падает
const brokenApp = makeWebApp({
  expand: () => {
    throw new Error("клиент сломался");
  },
});
const brokenPlatform = createTelegramPlatform(() => brokenApp);
const brokenWarnings = catchWarnings(() => brokenPlatform.init());
check("падение expand поймано", brokenWarnings.some((line) => line.includes("expand")), true);
check("после падения expand дошло до ready", called(brokenApp.calls, "ready"), true);

// 5. Вибрация: три разных маппинга
const hapticCalls = [];
const hapticApp = makeWebApp();
hapticApp.HapticFeedback = {
  impactOccurred: (style) => hapticCalls.push(["impactOccurred", style]),
  notificationOccurred: (type) => hapticCalls.push(["notificationOccurred", type]),
  selectionChanged: () => hapticCalls.push(["selectionChanged"]),
};
const hapticPlatform = createTelegramPlatform(() => hapticApp);
hapticPlatform.haptic("light");
hapticPlatform.haptic("success");
hapticPlatform.haptic("selection");
check(
  "лёгкая вибрация — impact, успех — notification, выбор — selection",
  JSON.stringify(hapticCalls),
  JSON.stringify([
    ["impactOccurred", "light"],
    ["notificationOccurred", "success"],
    ["selectionChanged"],
  ])
);

// 6. Личность: сырой initData наверх, id и имя — для отображения
check("tgId из initDataUnsafe", telegram.identity().tgId, 857360604);
check("имя собрано из first_name/last_name", telegram.identity().username, "Алиса Квак");
check(
  "initData отдаётся сырой строкой",
  telegram.identity().initData.startsWith("auth_date="),
  true
);

const silentApp = makeWebApp({ initData: "", initDataUnsafe: {} });
check("без initData — null", createTelegramPlatform(() => silentApp).identity().initData, null);
check("без user — tgId null", createTelegramPlatform(() => silentApp).identity().tgId, null);

// 7. Тема и размеры
check("тема тёмная", telegram.theme().colorScheme, "dark");
check("цвет клиента отдан", telegram.theme().bgColor, "#101010");
check("высота из WebApp, а не из window", telegram.viewport().height, 690);
check("стабильная высота отдельно", telegram.viewport().stableHeight, 712);
check("развёрнуто", telegram.viewport().isExpanded, true);

// 8. BackButton: подписка и снятие
let backPresses = 0;
const offBack = telegram.backButton(() => {
  backPresses += 1;
});
argOf(app.calls, "backButton.onClick")();
offBack();
check("нажатие «назад» дошло до обработчика", backPresses, 1);
check("кнопка показана", called(app.calls, "backButton.show"), true);
check("обработчик снят", called(app.calls, "backButton.offClick"), true);
check("кнопка спрятана после снятия", called(app.calls, "backButton.hide"), true);

// 9. Подтверждение: через Telegram, а без него — через window.confirm
const confirmed = await telegram.confirm("Бросить жабу?");
check("Telegram-подтверждение отдаёт ответ", confirmed, true);
check("вопрос ушёл в showConfirm", argOf(app.calls, "showConfirm"), "Бросить жабу?");

const noPopupApp = makeWebApp({ showConfirm: undefined });
const noPopupConfirmed = await createTelegramPlatform(() => noPopupApp).confirm("Точно?");
check(
  "без showConfirm спрашиваем у браузера",
  browser.calls.some(([name]) => name === "window.confirm"),
  true
);
check("ответ браузера дошёл", noPopupConfirmed, true);

// 10. Ссылки: t.me — внутрь клиента, остальное — наружу
telegram.openLink("https://t.me/stellar_croak");
telegram.openLink("https://docs.example/game");
check("t.me открывается внутри Telegram", called(app.calls, "openTelegramLink"), true);
check("обычная ссылка — через openLink", called(app.calls, "openLink"), true);

// 11. Веб-реализация: пусто, но не падает
const webPlatform = createWebPlatform();
webPlatform.init();
webPlatform.haptic("light");
check("веб-реализация называется web", webPlatform.name, "web");
check("в вебе нет личности Telegram", webPlatform.identity().tgId, null);
check("в вебе высота берётся из window", webPlatform.viewport().height, 800);
check("в вебе тема уважает системную", webPlatform.theme().colorScheme, "dark");
await webPlatform.alert("просто сообщение");
check("веб-alert ушёл в браузер", browser.calls.some(([name]) => name === "window.alert"), true);

// 12. Хранилище: обе реализации работают с localStorage устройства
platform.storage.set("probe", "ok");
check("значение записано", platform.storage.get("probe"), "ok");
platform.storage.remove("probe");
check("значение удалено", platform.storage.get("probe"), null);

console.log(
  failures.length === 0
    ? "\n✅ Платформенный слой: все проверки пройдены"
    : `\n❌ Платформенный слой: провалов ${failures.length}\n${failures.join("\n")}`
);
process.exit(failures.length === 0 ? 0 : 1);
