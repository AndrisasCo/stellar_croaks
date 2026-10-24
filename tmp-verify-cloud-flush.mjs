/**
 * Проверка СОХРАНЕНИЯ ПРИ ЗАКРЫТИИ ИГРЫ на реальном коде: `src/backend/cloud-flush.ts`
 * + сейв из `src/backend/localStorage.ts`.
 *
 * Модули бандлятся через esbuild и запускаются в node: вместо браузера подставляются
 * `window.localStorage`, `document.visibilityState` и шина событий. Сети нет — отправку
 * в облако заменяет счётчик `push`.
 *
 * Проверяем ровно те грабли, из-за которых досыл мог бы испортить прогресс:
 *   1) вкладку скрыли — сейв ушёл в облако, а `lastSaved` сдвинулся на момент выхода
 *      (иначе оффлайн-догон на старте прокрутил бы скрытые часы дважды);
 *   2) возврат во вкладку (`visible`) ничего не пишет;
 *   3) `visibilitychange` и `pagehide` приходят парой — запрос в облако один;
 *   4) пока облако не прочитано на старте (`isReady === false`), записи нет;
 *   5) ошибка отправки не ломает игру и не блокирует следующий досыл;
 *   6) после отписки события больше не пишут в облако;
 *   7) сейв, стёртый выходом из аккаунта, не воскрешается при закрытии.
 *
 * Запуск: node tmp-verify-cloud-flush.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const outDir = mkdtempSync(join(tmpdir(), "croak-flush-"));
const root = process.cwd();

/** Ключ сейва: тот же, что пишет `backend/localStorage.ts` (LS_KEY). */
const LS_KEY = "Game_State6";

/** Время «прошлой сессии»: после досыла `lastSaved` обязан сдвинуться. */
const SEED_LAST_SAVED = "2020-01-01T00:00:00.000Z";

/**
 * Заглушка браузера: localStorage, окно и `document` со своим свойством
 * `visibilityState` (его выставляет проверка перед событием).
 */
const installBrowser = () => {
  const store = new Map();
  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();

  const localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };

  const window = {
    localStorage,
    location: { origin: "https://croak.example", hash: "", search: "" },
    setTimeout: (handler, timeout, ...args) =>
      setTimeout(handler, timeout, ...args),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (handler, timeout, ...args) =>
      setInterval(handler, timeout, ...args),
    clearInterval: (id) => clearInterval(id),
    addEventListener: (type, handler) =>
      windowEvents.addEventListener(type, handler),
    removeEventListener: (type, handler) =>
      windowEvents.removeEventListener(type, handler),
    dispatchEvent: (event) => windowEvents.dispatchEvent(event),
    open: () => {},
    alert: () => {},
    confirm: () => true,
  };

  const document = {
    visibilityState: "visible",
    addEventListener: (type, handler) =>
      documentEvents.addEventListener(type, handler),
    removeEventListener: (type, handler) =>
      documentEvents.removeEventListener(type, handler),
    dispatchEvent: (event) => documentEvents.dispatchEvent(event),
  };

  globalThis.window = window;
  globalThis.document = document;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });

  return { store, window, document };
};

/** Собрать `cloud-flush.ts` + `localStorage.ts` в один ESM-бандл для node. */
const bundleCloudFlush = () => {
  const entry = join(outDir, "cloud-flush-entry.ts");
  const outfile = join(outDir, "cloud-flush.mjs");

  writeFileSync(
    entry,
    [
      `export * from "${join(root, "src/backend/cloud-flush.ts")}";`,
      `export * from "${join(root, "src/backend/localStorage.ts")}";`,
      `export { isCloudSyncEnabled } from "${join(root, "src/backend/supabase.ts")}";`,
    ].join("\n"),
  );

  execFileSync(
    "npx",
    [
      "esbuild",
      entry,
      "--bundle",
      "--format=esm",
      "--platform=node",
      "--log-level=error",
      // Как в проде: значения Vite инлайнит из .env.
      `--define:import.meta.env=${JSON.stringify({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      })}`,
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );

  return import(pathToFileURL(outfile).href);
};

const failures = [];
const check = (label, actual, expected) => {
  const ok =
    typeof expected === "function" ? expected(actual) : actual === expected;

  if (!ok) {
    failures.push(
      `${label}: получили ${JSON.stringify(actual)}, ждали ${expected}`,
    );
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

/**
 * Часы проверки. Модуль помнит время последнего досыла, поэтому сценарии идут по
 * возрастающей: иначе окно `MIN_FLUSH_INTERVAL_MS` съело бы следующий запрос.
 */
let clock = Date.now() + 60_000;
const advance = (ms = 60_000) => {
  clock += ms;

  return clock;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const readLocalSave = (store) => JSON.parse(store.get(LS_KEY));
const readLastSaved = (store) => readLocalSave(store).lastSaved;

/** Свежий браузер + сейв «прошлой сессии» с известным числом кваксов. */
const prepare = (bundle, tokens = 777) => {
  const browser = installBrowser();
  const state = {
    ...bundle.getDefaultGameState(),
    lastSaved: SEED_LAST_SAVED,
  };

  state.user = { ...state.user, tokens };
  browser.store.set(LS_KEY, JSON.stringify(state));

  return browser;
};

// Модуль читает `window` уже на импорте (`platform.storage`), поэтому браузер
// подставляем до загрузки бандла.
installBrowser();
const bundle = await bundleCloudFlush();

check("облако включено в проверке", bundle.isCloudSyncEnabled, true);

// ---------------------------------------------------------------------------
// 1. ВКЛАДКУ СКРЫЛИ (Telegram Mini App)
//
// Главный сценарий: игрок закрывает мини-апп, webview прячется. До этой правки
// прогресс последних минут оставался только на устройстве — другое устройство
// видело сейв трёхминутной давности.
// ---------------------------------------------------------------------------
console.log("\n— 1. Вкладку скрыли —");
const first = prepare(bundle);
const firstPushes = [];
let pushedTokens = null;
const detachFirst = bundle.attachCloudFlush({
  isReady: () => true,
  now: () => clock,
  push: async () => {
    const saved = readLocalSave(first.store);

    pushedTokens = saved.user.tokens;
    firstPushes.push(saved.lastSaved);

    return { error: null };
  },
});

first.document.visibilityState = "visible";
first.document.dispatchEvent(new Event("visibilitychange"));
await settle();
check("возврат во вкладку не пишет в облако", firstPushes.length, 0);

first.document.visibilityState = "hidden";
first.document.dispatchEvent(new Event("visibilitychange"));
await settle();
check("скрытие вкладки отправило сейв", firstPushes.length, 1);
check("в облако ушёл актуальный сейв", pushedTokens, 777);
check(
  "lastSaved сдвинулся на момент выхода",
  readLastSaved(first.store) !== SEED_LAST_SAVED,
  true,
);
check(
  "в облако ушёл именно новый lastSaved",
  firstPushes[0],
  readLastSaved(first.store),
);
detachFirst();

// ---------------------------------------------------------------------------
// 2. ЗАКРЫТИЕ ВКЛАДКИ: visibilitychange + pagehide
//
// Браузер присылает оба события подряд. Второй полный PATCH того же сейва не
// нужен: окно `MIN_FLUSH_INTERVAL_MS` гасит дубль.
// ---------------------------------------------------------------------------
console.log("\n— 2. visibilitychange + pagehide —");
advance();
const second = prepare(bundle);
let secondPushes = 0;
const detachSecond = bundle.attachCloudFlush({
  isReady: () => true,
  now: () => clock,
  push: async () => {
    secondPushes += 1;

    return { error: null };
  },
});

second.document.visibilityState = "hidden";
second.document.dispatchEvent(new Event("visibilitychange"));
second.window.dispatchEvent(new Event("pagehide"));
await settle();
check("пара событий даёт один запрос", secondPushes, 1);
detachSecond();

// ---------------------------------------------------------------------------
// 3. ТОЛЬКО pagehide (закрытие вкладки в браузере)
// ---------------------------------------------------------------------------
console.log("\n— 3. Закрытие вкладки —");
advance();
const third = prepare(bundle);
let thirdPushes = 0;
const detachThird = bundle.attachCloudFlush({
  isReady: () => true,
  now: () => clock,
  push: async () => {
    thirdPushes += 1;

    return { error: null };
  },
});

third.window.dispatchEvent(new Event("pagehide"));
await settle();
check("pagehide отправил сейв", thirdPushes, 1);
check(
  "lastSaved обновлён и здесь",
  readLastSaved(third.store) !== SEED_LAST_SAVED,
  true,
);
detachThird();

// ---------------------------------------------------------------------------
// 4. ОБЛАКО ЕЩЁ НЕ ПРОЧИТАНО
//
// До успешного слияния на старте писать нельзя: локальный (возможно, старый)
// сейв затёр бы прогресс с другого устройства. Проверяем, что не двигается даже
// локальное время сохранения.
// ---------------------------------------------------------------------------
console.log("\n— 4. Облако не прочитано —");
advance();
const fourth = prepare(bundle);
let fourthPushes = 0;
const detachFourth = bundle.attachCloudFlush({
  isReady: () => false,
  now: () => clock,
  push: async () => {
    fourthPushes += 1;

    return { error: null };
  },
});

fourth.document.visibilityState = "hidden";
fourth.document.dispatchEvent(new Event("visibilitychange"));
fourth.window.dispatchEvent(new Event("pagehide"));
await settle();
check("без готового облака запросов нет", fourthPushes, 0);
check("lastSaved не тронут", readLastSaved(fourth.store), SEED_LAST_SAVED);
detachFourth();

// ---------------------------------------------------------------------------
// 5. ОШИБКА ОТПРАВКИ
//
// Сеть/RLS могут отказать в самый неподходящий момент. Игра не должна падать, а
// следующий досыл обязан пройти: иначе один сбой заблокировал бы сохранение до
// перезапуска.
// ---------------------------------------------------------------------------
console.log("\n— 5. Ошибка отправки —");
advance();
const fifth = prepare(bundle);
const fifthPushes = [];
let failNext = true;
const warnings = [];
const originalWarn = console.warn;

console.warn = (...args) => {
  warnings.push(args.join(" "));
};

const detachFifth = bundle.attachCloudFlush({
  isReady: () => true,
  now: () => clock,
  push: async () => {
    fifthPushes.push(clock);

    return failNext ? { error: { message: "RLS denied" } } : { error: null };
  },
});

fifth.document.visibilityState = "hidden";
fifth.document.dispatchEvent(new Event("visibilitychange"));
await settle();
check("первый досыл упал", fifthPushes.length, 1);
check(
  "ошибка отправки видна в логах",
  warnings.some((line) => line.includes("RLS denied")),
  true,
);

failNext = false;
advance(5_000);
fifth.document.dispatchEvent(new Event("visibilitychange"));
await settle();
check("после ошибки следующий досыл проходит", fifthPushes.length, 2);
console.warn = originalWarn;
detachFifth();

// ---------------------------------------------------------------------------
// 6. ПОСЛЕ ОТПИСКИ
//
// Эффект MainScreen пересоздаётся (StrictMode, размонтирование) — старые
// слушатели не должны слать сейвы от имени закрытой сессии.
// ---------------------------------------------------------------------------
console.log("\n— 6. После отписки —");
advance();
const sixth = prepare(bundle);
let sixthPushes = 0;
const detachSixth = bundle.attachCloudFlush({
  isReady: () => true,
  now: () => clock,
  push: async () => {
    sixthPushes += 1;

    return { error: null };
  },
});

detachSixth();
sixth.document.visibilityState = "hidden";
sixth.document.dispatchEvent(new Event("visibilitychange"));
sixth.window.dispatchEvent(new Event("pagehide"));
await settle();
check("отписанный слушатель не пишет", sixthPushes, 0);

// ---------------------------------------------------------------------------
// 7. ВЫХОД ИЗ АККАУНТА
//
// `signOutAccount` стирает сейв и перезагружает страницу. Досыл по `pagehide`
// обязан промолчать: иначе дефолтный сейв вернулся бы на устройство и ушёл в
// облако уже без аккаунта.
// ---------------------------------------------------------------------------
console.log("\n— 7. Сейв очищен выходом —");
advance();
const seventh = prepare(bundle);

seventh.store.delete(LS_KEY);
let seventhPushes = 0;
const detachSeventh = bundle.attachCloudFlush({
  isReady: () => true,
  now: () => clock,
  push: async () => {
    seventhPushes += 1;

    return { error: null };
  },
});

seventh.document.visibilityState = "hidden";
seventh.document.dispatchEvent(new Event("visibilitychange"));
seventh.window.dispatchEvent(new Event("pagehide"));
await settle();
check("после выхода запросов нет", seventhPushes, 0);
check("сейв не воскрешён", seventh.store.has(LS_KEY), false);
detachSeventh();

// ---------------------------------------------------------------------------
console.log(
  failures.length
    ? `\n❌ Проверок не прошло: ${failures.length}\n${failures.join("\n")}`
    : "\n✅ Все проверки сохранения при закрытии прошли",
);

// Node держит открытым порт загрузчика бандла (в браузере его нет), поэтому
// завершаем проверку явно — иначе `npm run verify` завис бы на этом шаге.
process.exit(failures.length ? 1 : 0);

