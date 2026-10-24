/**
 * Проверка СТАРТА ИГРЫ на реальном коде: `src/backend/boot.ts` + синк из `src/backend/db.ts`.
 *
 * Модули бандлятся через esbuild и запускаются в node: вместо браузера подставляются
 * `window.localStorage`, адрес игры и события окна, а вместо Supabase — заглушки
 * `auth` и `from`. Сети нет: ответы те же, что вернул бы сервер.
 *
 * Проверяем ровно те грабли, из-за которых облачный прогресс «не подтягивался»:
 *   1) в Telegram скрипт `telegram-web-app.js` грузится позже игры: старт ждёт его
 *      и только потом входит — без ожидания игрок получил бы анонимный дубль;
 *   2) вход завершается ДО чтения `game_state` (в журнале сначала verifyOtp,
 *      потом запрос к базе), иначе синк молча пропускался без аккаунта;
 *   3) облачный сейв, сохранённый 2 минуты назад на другом устройстве, применяется
 *      (раньше 3-минутный допуск считал его «свежим» и оставлял старый локальный);
 *   4) локальный сейв, который новее облачного, уходит в облако, а не затирается;
 *   5) сбой чтения облака повторяется и НЕ стирает прогресс: следующий ответ
 *      применяется, а запись в облако до успешного чтения не идёт;
 *   6) когда облако недоступно совсем, старт всё равно завершается (игра на
 *      локальном сейве), а не висит на загрузочном экране.
 *
 * Запуск: node tmp-verify-boot.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const outDir = mkdtempSync(join(tmpdir(), "croak-boot-"));
const root = process.cwd();

/** Ключ сейва: тот же, что пишет `backend/localStorage.ts` (LS_KEY). */
const LS_KEY = "Game_State6";

/** Заглушка браузера: localStorage устройства, адрес игры и события окна. */
const installBrowser = (
  location = { origin: "https://croak.example", hash: "", search: "" },
) => {
  const store = new Map();
  const events = new EventTarget();
  const localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };

  const window = {
    localStorage,
    location,
    setTimeout: (handler, timeout, ...args) =>
      setTimeout(handler, timeout, ...args),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (handler, timeout, ...args) =>
      setInterval(handler, timeout, ...args),
    clearInterval: (id) => clearInterval(id),
    addEventListener: (type, handler) => events.addEventListener(type, handler),
    removeEventListener: (type, handler) =>
      events.removeEventListener(type, handler),
    dispatchEvent: (event) => events.dispatchEvent(event),
    // Нужны только платформе Telegram (её `init` дергает эти методы).
    open: () => {},
    alert: () => {},
    confirm: () => true,
  };

  globalThis.window = window;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });

  return { store, window };
};

/** Собрать `boot.ts` + `localStorage.ts` в один ESM-бандл, чтобы запустить в node. */
const bundleBoot = (name) => {
  const entry = join(outDir, `${name}-entry.ts`);
  const outfile = join(outDir, `${name}.mjs`);

  writeFileSync(
    entry,
    [
      `export * from "${join(root, "src/backend/boot.ts")}";`,
      `export * from "${join(root, "src/backend/localStorage.ts")}";`,
      `export { getAccount } from "${join(root, "src/backend/auth.ts")}";`,
      `export { supabase } from "${join(root, "src/backend/supabase.ts")}";`,
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


/** Ответ заглушки: значение может быть функцией (считается в момент запроса). */
const pickResponse = (response, query) =>
  typeof response === "function" ? response(query) : response;

/**
 * Очередь ответов: массив отдаётся по одному, последний повторяется.
 * Так проверяются повторы после сбоя (`read: [ошибка, успех]`).
 */
const nextResponse = (responses) =>
  Array.isArray(responses)
    ? responses.length > 1
      ? responses.shift()
      : responses[0]
    : responses;

/** Что вернуть на запрос к `game_state` / `profiles` / `credits`. */
const respond = (state, query) => {
  const operation = query.ops[0]?.[0] ?? "select";

  if (query.table === "game_state") {
    const key =
      operation === "insert"
        ? "insert"
        : operation === "update"
          ? "update"
          : "read";

    return pickResponse(nextResponse(state.gameState[key]), query);
  }

  if (query.table === "profiles") {
    state.profiles.push(query.ops[0]?.[1]);

    return { error: null };
  }

  if (query.table === "credits") {
    return operation === "update"
      ? { error: null }
      : { data: state.credits, error: null };
  }

  return { data: null, error: null };
};

/**
 * Подменяет методы Supabase у бандла: `auth` отвечает как GoTrue, `from` собирает
 * цепочку `select().eq().maybeSingle()` и считает её обычным промисом.
 */
const stubSupabase = (bundle, state) => {
  const client = bundle.supabase;

  client.auth.onAuthStateChange = (callback) => {
    state.authListener = callback;

    return { data: { subscription: { unsubscribe: () => {} } } };
  };
  client.auth.getSession = async () => {
    state.authCalls.push("getSession");

    return state.session;
  };
  client.auth.signInAnonymously = async () => {
    state.authCalls.push("signInAnonymously");

    return state.anonymous;
  };
  client.auth.verifyOtp = async () => {
    state.authCalls.push("verifyOtp");
    state.sequence.push("auth");

    return state.verify;
  };
  client.auth.signOut = async () => ({ error: null });
  client.auth.refreshSession = async () => ({
    data: { session: null, user: null },
    error: null,
  });
  client.auth.updateUser = async () => ({ data: { user: null }, error: null });

  // `functions` в SupabaseClient — геттер, который каждый раз создаёт новый клиент,
  // поэтому подменяем свойство целиком (своё поле перекрывает геттер прототипа).
  Object.defineProperty(client, "functions", {
    configurable: true,
    value: {
      invoke: async () => {
        state.authCalls.push("invoke");

        return state.invoke();
      },
    },
  });

  client.from = (table) => {
    const ops = [];
    let builder;

    const run = () => {
      const query = { table, ops: ops.slice() };

      state.queries.push(query);
      state.sequence.push(`${table}:${query.ops[0]?.[0] ?? "?"}`);

      return respond(state, query);
    };

    builder = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") {
            return (resolve, reject) =>
              Promise.resolve().then(run).then(resolve, reject);
          }

          return (...args) => {
            ops.push([property, ...args]);

            return builder;
          };
        },
      },
    );

    return builder;
  };
};

/** Игрок из Telegram: uuid выдаёт Edge Function `telegram-auth` по подписи. */
const TG_ID = 857360604;
const tgUser = {
  id: "211bdfe0-0d46-4f20-8976-563668a76365",
  email: `tg-${TG_ID}@telegram.local`,
  is_anonymous: false,
  user_metadata: { tg_id: TG_ID, username: "Алиса Павлова" },
  app_metadata: {},
};

/** Анонимная сессия веб-версии: свой uuid на каждое устройство. */
const anonUser = {
  id: "b3f1c0de-0000-4000-8000-000000000009",
  email: null,
  is_anonymous: true,
  user_metadata: {},
  app_metadata: {},
};

/** Объект, который создаёт `telegram-web-app.js` внутри Mini App. */
const makeTelegramWebApp = () => ({
  initData: `query_id=AAF&user=%7B%22id%22%3A${TG_ID}%7D&auth_date=1&hash=signature`,
  initDataUnsafe: {
    user: { id: TG_ID, first_name: "Алиса", last_name: "Павлова" },
  },
  platform: "ios",
  colorScheme: "dark",
  themeParams: { bg_color: "#070c14" },
  viewportHeight: 800,
  viewportStableHeight: 800,
  isExpanded: true,
  ready() {},
  expand() {},
  enableClosingConfirmation() {},
  disableVerticalSwipes() {},
  setHeaderColor() {},
  HapticFeedback: {
    selectionChanged() {},
    impactOccurred() {},
    notificationOccurred() {},
  },
});

const minutesAgo = (minutes) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

/** Положить в localStorage сейв «с другого устройства» с нужным временем. */
const seedLocalSave = (bundle, { tokens, lastSaved, createdAt }) => {
  const current = bundle.getGameState();

  bundle.updateGameState(
    {
      user: { ...current.user, tokens },
      lastSaved,
      ...(createdAt ? { createdAt } : {}),
    },
    true,
  );
};

/** Строка `game_state`, как её вернул бы сервер. */
const makeCloudRow = (bundle, { tokens, lastSaved, createdAt }) => ({
  created_at: createdAt,
  content: {
    ...bundle.getGameState(),
    user: { ...bundle.getGameState().user, tokens },
    lastSaved,
  },
  achievements: {},
  collider: {},
  shop: {},
});

/**
 * Один прогон старта на свежей копии модулей: свой localStorage, свой Supabase.
 * `seed` готовит локальный сейв, `beforeBoot` — окружение (например, поздний
 * `window.Telegram`), `read`/`insert`/`update` — ответы базы.
 */
const startHarness = async (name, options = {}) => {
  const browser = installBrowser(options.location);
  const bundle = await bundleBoot(name);

  const state = {
    authCalls: [],
    queries: [],
    profiles: [],
    sequence: [],
    session: { data: { session: null }, error: null },
    anonymous: {
      data: { user: options.anonymousUser ?? anonUser },
      error: null,
    },
    verify: { data: { user: options.tgUser ?? null, session: null }, error: null },
    invoke:
      options.invoke ??
      (() => ({ data: { token_hash: "token-hash" }, error: null })),
    gameState: {
      read: options.read ?? { data: null, error: null },
      insert: options.insert ?? { data: [], error: null },
      update: options.update ?? { data: [], error: null },
    },
    credits: options.credits ?? [],
  };

  if (state.verify.data.user) {
    state.verify.data.session = { user: state.verify.data.user };
  }

  stubSupabase(bundle, state);

  if (options.seed) {
    options.seed(bundle);
  }
  if (options.beforeBoot) {
    options.beforeBoot();
  }

  const stages = [];
  const startedAt = Date.now();
  const result = await bundle.bootGame((stage) => stages.push(stage));

  return {
    ...browser,
    bundle,
    state,
    result,
    stages,
    elapsed: Date.now() - startedAt,
  };
};

// ---------------------------------------------------------------------------
// 1. TELEGRAM: скрипт WebApp грузится позже, чем начинается игра
//
// Прод-сценарий: мини-апп открылся, `telegram-web-app.js` ещё не выполнился.
// Без ожидания `initData` пуст, вход уходил в `signInAnonymously` — и на другом
// устройстве появлялся «дубль» с другим uuid, а прогресс не подтягивался.
// ---------------------------------------------------------------------------
console.log("\n— 1. Telegram: WebApp появился позже старта —");
const telegramRun = await startHarness("boot-telegram-late", {
  location: {
    origin: "https://croak.example",
    hash: "#tgWebAppData=query_id%3DAAF&tgWebAppVersion=8.0&tgWebAppPlatform=ios",
    search: "",
  },
  tgUser,
  beforeBoot: () => {
    setTimeout(() => {
      globalThis.window.Telegram = { WebApp: makeTelegramWebApp() };
    }, 250);
  },
});

check("старт дождался Telegram", telegramRun.result.platform, "telegram");
check(
  "шаги загрузки по порядку",
  telegramRun.stages.join(" → "),
  "platform → auth → sync",
);
check(
  "вход ушёл в Edge Function",
  telegramRun.state.authCalls.includes("invoke"),
  true,
);
check(
  "сессия подтверждена подписью",
  telegramRun.state.authCalls.includes("verifyOtp"),
  true,
);
check(
  "анонимный дубль не создан",
  telegramRun.state.authCalls.includes("signInAnonymously"),
  false,
);

const authAt = telegramRun.state.sequence.indexOf("auth");
const readAt = telegramRun.state.sequence.indexOf("game_state:select");
check(
  "сначала вход, потом чтение прогресса",
  authAt >= 0 && readAt > authAt,
  true,
);
check("tg_id попал в сейв", telegramRun.bundle.getGameState().user.tg_id, TG_ID);
check("сейв записан на устройство", telegramRun.store.has(LS_KEY), true);
check("профиль для лидерборда создан", telegramRun.state.profiles.length, 1);
check(
  "ключ сейва = uuid аккаунта",
  telegramRun.bundle.getGameState().user.id,
  tgUser.id,
);
check("ждали именно скрипт Telegram", telegramRun.elapsed >= 250, true);
check("прогресс сверен", telegramRun.result.synced, true);

// ---------------------------------------------------------------------------
// 2. ОБЛАКО НОВЕЕ НА 2 МИНУТЫ
//
// Главная причина «синк не сработал»: допуск в 3 минуты считал такой сейв
// свежим и оставлял старый локальный. Теперь облако применяется.
// ---------------------------------------------------------------------------
console.log("\n— 2. Облачный сейв новее на 2 минуты —");
let cloudNewerBundle;
const cloudNewer = await startHarness("boot-cloud-newer", {
  seed: (bundle) => {
    cloudNewerBundle = bundle;
    seedLocalSave(bundle, {
      tokens: 111,
      lastSaved: minutesAgo(5),
      createdAt: minutesAgo(60),
    });
  },
  read: () => ({
    data: makeCloudRow(cloudNewerBundle, {
      tokens: 999,
      lastSaved: minutesAgo(3),
      createdAt: minutesAgo(30),
    }),
    error: null,
  }),
});

check("прогресс сверен", cloudNewer.result.synced, true);
check(
  "применён облачный сейв",
  cloudNewer.bundle.getGameState().user.tokens,
  999,
);
check(
  "локальный сейв не отправлен в облако",
  cloudNewer.state.queries.some(
    (query) => query.table === "game_state" && query.ops[0]?.[0] === "update",
  ),
  false,
);

// ---------------------------------------------------------------------------
// 3. ЛОКАЛЬНЫЙ СЕЙВ НОВЕЕ
// Старое правило «локальный новее — пишем в облако» должно сохраниться.
// ---------------------------------------------------------------------------
console.log("\n— 3. Локальный сейв новее облачного —");
let localNewerBundle;
const localNewer = await startHarness("boot-local-newer", {
  seed: (bundle) => {
    localNewerBundle = bundle;
    seedLocalSave(bundle, {
      tokens: 555,
      lastSaved: new Date().toISOString(),
      createdAt: minutesAgo(90),
    });
  },
  read: () => ({
    data: makeCloudRow(localNewerBundle, {
      tokens: 1,
      lastSaved: minutesAgo(120),
      createdAt: minutesAgo(30),
    }),
    error: null,
  }),
});

check("прогресс сверен", localNewer.result.synced, true);
check(
  "локальный сейв не затёрт",
  localNewer.bundle.getGameState().user.tokens,
  555,
);
const localUpload = localNewer.state.queries.find(
  (query) => query.table === "game_state" && query.ops[0]?.[0] === "update",
);
check("локальный сейв ушёл в облако", Boolean(localUpload), true);
check(
  "в облако ушли именно локальные кваксы",
  localUpload?.ops[0]?.[1]?.content?.user?.tokens,
  555,
);


// ---------------------------------------------------------------------------
// 4. СБОЙ ЧТЕНИЯ ОБЛАКА — повтор, а не потеря прогресса
//
// Первый ответ — сеть отвалилась. Старт обязан повторить чтение, а не
// «создать» новый сейв в облаке поверх старого.
// ---------------------------------------------------------------------------
console.log("\n— 4. Сбой чтения облака: повтор —");
const retried = await startHarness("boot-retry", {
  seed: (bundle) =>
    seedLocalSave(bundle, {
      tokens: 321,
      lastSaved: minutesAgo(10),
      createdAt: minutesAgo(60),
    }),
  read: [
    { data: null, error: { message: "network down" } },
    { data: null, error: null },
  ],
});

const readCalls = retried.state.queries.filter(
  (query) => query.table === "game_state" && query.ops[0]?.[0] === "select",
).length;
check("прогресс сверен со второй попытки", retried.result.synced, true);
check("чтение повторили", readCalls, 2);
check(
  "сначала успешное чтение, только потом запись",
  retried.state.sequence.lastIndexOf("game_state:select") <
    retried.state.sequence.indexOf("game_state:insert"),
  true,
);
check("пауза перед повтором выдержана", retried.elapsed >= 700, true);

// ---------------------------------------------------------------------------
// 5. ОБЛАКО НЕДОСТУПНО ЦЕЛИКОМ
//
// Игра не должна «залипнуть» на загрузке: локальный сейв остаётся, а результат
// честно говорит, что синка не было (по нему MainScreen повторит позже).
// ---------------------------------------------------------------------------
console.log("\n— 5. Облако недоступно: игра стартует локально —");
const offlineRun = await startHarness("boot-offline", {
  seed: (bundle) =>
    seedLocalSave(bundle, {
      tokens: 77,
      lastSaved: minutesAgo(10),
      createdAt: minutesAgo(60),
    }),
  read: () => ({ data: null, error: { message: "network down" } }),
});

const offlineReads = offlineRun.state.queries.filter(
  (query) => query.table === "game_state" && query.ops[0]?.[0] === "select",
).length;
check("старт завершился без синка", offlineRun.result.synced, false);
check("вход при этом выполнен", offlineRun.result.online, true);
check("все три попытки чтения сделаны", offlineReads, 3);
check(
  "локальный сейв на месте",
  offlineRun.bundle.getGameState().user.tokens,
  77,
);
check(
  "в облако ничего не записали",
  offlineRun.state.queries.some(
    (query) => query.table === "game_state" && query.ops[0]?.[0] !== "select",
  ),
  false,
);
check("старт занял время трёх попыток", offlineRun.elapsed >= 2100, true);

// Повторный вызов (StrictMode монтирует эффект дважды) не должен запускать
// второй вход и второе чтение прогресса: промис кэширован на страницу.
const queriesBefore = offlineRun.state.queries.length;
const again = await offlineRun.bundle.bootGame();
check(
  "повторный bootGame не дублирует запросы",
  offlineRun.state.queries.length,
  queriesBefore,
);
check("повторный bootGame вернул тот же итог", again.synced, false);

// ---------------------------------------------------------------------------
// 6. НОВОЕ УСТРОЙСТВО (или очищенный кэш)
//
// Локального сейва нет — создаётся дефолтный с «сейчас». Облачная строка
// создана раньше, поэтому её прогресс обязан победить, даже если `lastSaved`
// в облаке старее: иначе игрок на новом устройстве начал бы с нуля.
// ---------------------------------------------------------------------------
console.log("\n— 6. Новое устройство: прогресс приходит из облака —");
const cloudCreatedAt = minutesAgo(120);
let newDeviceBundle;
const newDevice = await startHarness("boot-new-device", {
  seed: (bundle) => {
    newDeviceBundle = bundle;
  },
  read: () => ({
    data: makeCloudRow(newDeviceBundle, {
      tokens: 4242,
      lastSaved: minutesAgo(60),
      createdAt: cloudCreatedAt,
    }),
    error: null,
  }),
});

check("прогресс сверен", newDevice.result.synced, true);
check(
  "новое устройство получило облачный прогресс",
  newDevice.bundle.getGameState().user.tokens,
  4242,
);
check(
  "возраст аккаунта взят из облака",
  newDevice.bundle.getGameState().createdAt,
  cloudCreatedAt,
);
check(
  "облако не перезаписано дефолтным сейвом",
  newDevice.state.queries.some(
    (query) => query.table === "game_state" && query.ops[0]?.[0] !== "select",
  ),
  false,
);

// ---------------------------------------------------------------------------
console.log(
  failures.length
    ? `\n❌ Проверок не прошло: ${failures.length}\n${failures.join("\n")}`
    : "\n✅ Все проверки старта игры прошли",
);

if (failures.length) {
  process.exitCode = 1;
}
