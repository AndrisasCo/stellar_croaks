/**
 * Проверка ВХОДА И РЕГИСТРАЦИИ ПО ПОЧТЕ на РЕАЛЬНОМ коде проекта.
 *
 * Модуль `src/backend/auth.ts` бандлится через esbuild и прогоняется как обычный JS:
 * вместо браузера подставляются `window.localStorage` и `window.location`, а вместо
 * Supabase — заглушки методов `auth`. Сети нет: ответы те же, что вернул бы GoTrue.
 * Проверяем ровно те грабли, из-за которых веб-игрок мог потерять колонию:
 *   1) регистрация при выключенном подтверждении почты сразу даёт сессию: почта
 *      уходит без пробелов, ссылка из письма ведёт в игру, аккаунт обновляется;
 *   2) регистрация при ВКЛЮЧЁННОМ подтверждении не входит, а просит проверить почту
 *      (аккаунт при этом создан) — иначе игрок решил бы, что вход сломан;
 *   3) ошибка сервера (неверный пароль, занятая почта) доходит до игрока дословно;
 *   4) успешный вход поднимает сессию и показывает почту и имя игрока;
 *   5) подписка на смену аккаунта доносит вход/выход до интерфейса и снимается;
 *   6) регистрация из анонимной сессии идёт через updateUser: uuid сохраняется,
 *      почта появляется у того же игрока, второй пользователь не создаётся;
 *   7) если анонимного игрока удалили на сервере (`user_not_found`), мёртвая
 *      сессия сбрасывается, и регистрация проходит обычным signUp, а не падает;
 *   8) выход гасит сессию, УБИРАЕТ локальный сейв прошлого игрока и перезапускает
 *      игру, а неудачный выход не врёт об успехе и не трогает сейв;
 *   9) без настроенного Supabase вход отключён и ничего не падает;
 *  10) в Telegram сбой первого запроса к `telegram-auth` повторяется, а не
 *      превращается в анонимный «дубль» на этом устройстве;
 *  11) сохранённая анонимная сессия в Telegram обменивается на аккаунт по подписи;
 *  12) если Edge Function недоступна, анонимный аккаунт НЕ создаётся: игра идёт
 *      локально, повтор откладывается, старая анонимная сессия не подменяет вход;
 *  13) в обычном браузере (без Telegram) анонимная сессия по-прежнему создаётся;
 *  14) автоматический браузер (headless, краулер, `navigator.webdriver`) не создаёт
 *      анонимную сессию: иначе каждый обход сайта оставлял в базе «лишнего игрока»
 *      (`game_state` + `profiles`), а живой браузер входит как раньше.
 *
 * Запуск: node tmp-verify-auth.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const outDir = mkdtempSync(join(tmpdir(), "croak-auth-"));
const root = process.cwd();

/** Заглушка браузера: localStorage устройства, адрес игры и перезагрузка страницы */
const makeBrowser = () => {
  const store = new Map();
  const reloads = [];
  const localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };

  return {
    store,
    reloads,
    localStorage,
    window: {
      localStorage,
      location: {
        origin: "https://croak.example",
        reload: () => reloads.push("reload"),
      },
      setTimeout: (handler, timeout) => setTimeout(handler, timeout),
    },
  };
};

const browser = makeBrowser();
globalThis.window = browser.window;
globalThis.localStorage = browser.localStorage;

/** Собрать модули проекта в ESM-бандл, чтобы запустить их в node */
const bundleAuth = (name, defines) => {
  const entry = join(outDir, `${name}-entry.ts`);
  const outfile = join(outDir, `${name}.mjs`);

  // В бандл кладём сразу и `auth.ts`, и сам клиент Supabase: тесты подменяют методы
  // клиента, а модуль авторизации должен обращаться к ТОЙ ЖЕ копии клиента.
  writeFileSync(
    entry,
    [
      `export * from "${join(root, "src/backend/auth.ts")}";`,
      `export { supabase, isCloudSyncEnabled } from "${join(root, "src/backend/supabase.ts")}";`,
      `export { isAutomatedBrowser } from "${join(root, "src/backend/automation.ts")}";`,
    ].join("\n")
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
      ...defines,
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] }
  );

  return import(pathToFileURL(outfile).href);
};

/** Настроенное облако (как в проде: значения Vite инлайнит из .env) */
const CLOUD_ENV = [
  `--define:import.meta.env=${JSON.stringify({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    // Новое имя публичного ключа Supabase — основное для клиента.
    VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  })}`,
];

/** Старое имя ключа (`anon`) должно продолжать работать — это путь миграции. */
const LEGACY_ENV = [
  `--define:import.meta.env=${JSON.stringify({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
  })}`,
];

/** Облако не настроено: env пустой — вход должен быть выключен */
const OFFLINE_ENV = ["--define:import.meta.env={}"];

const auth = await bundleAuth("auth-online", CLOUD_ENV);
const legacy = await bundleAuth("auth-legacy", LEGACY_ENV);
const offline = await bundleAuth("auth-offline", OFFLINE_ENV);

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(
      `${label}: получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`
    );
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

// ---------------------------------------------------------------------------
// Заглушки Supabase: записываем вызовы и отвечаем так, как ответил бы GoTrue
// ---------------------------------------------------------------------------
const calls = [];
let listener = null;
let unsubscribes = 0;
let signUpResponse = { data: { user: null, session: null }, error: null };
let updateUserResponse = { data: { user: null }, error: null };
let refreshResponse = { data: { session: null, user: null }, error: null };
let signInResponse = { data: { user: null, session: null }, error: null };
let signOutResponse = { error: null };

/** Пользователь Supabase: id уходит в `user.id` сейва, почта — в интерфейс */
const makeUser = (overrides = {}) => ({
  id: "b3f1c0de-0000-4000-8000-000000000001",
  email: "alice@example.com",
  is_anonymous: false,
  user_metadata: {},
  ...overrides,
});

auth.supabase.auth.signUp = async (credentials) => {
  calls.push(["signUp", credentials]);
  return signUpResponse;
};

auth.supabase.auth.updateUser = async (attributes, options) => {
  calls.push(["updateUser", attributes, options]);
  return updateUserResponse;
};

auth.supabase.auth.refreshSession = async () => {
  calls.push(["refreshSession"]);
  return refreshResponse;
};

auth.supabase.auth.signInWithPassword = async (credentials) => {
  calls.push(["signInWithPassword", credentials]);
  return signInResponse;
};

auth.supabase.auth.signOut = async (...args) => {
  calls.push(["signOut", ...args]);
  return signOutResponse;
};

auth.supabase.auth.onAuthStateChange = (callback) => {
  listener = callback;

  return {
    data: {
      subscription: {
        unsubscribe: () => {
          unsubscribes += 1;
        },
      },
    },
  };
};

// 1. Регистрация с выключенным подтверждением почты: сессия выдаётся сразу
const alice = makeUser({ email: "alice@example.com" });
signUpResponse = {
  data: { user: alice, session: { user: alice, access_token: "token" } },
  error: null,
};

const created = await auth.signUpWithEmail("  alice@example.com  ", "secret1");
check("регистрация принята", created.ok, true);
check("после регистрации игрок вошёл", created.signedIn, true);
check("почта ушла без пробелов", calls[0][1].email, "alice@example.com");
check("пароль ушёл на сервер", calls[0][1].password, "secret1");
check(
  "ссылка из письма ведёт в игру",
  calls[0][1].options.emailRedirectTo,
  "https://croak.example"
);
check("аккаунт обновился почтой", auth.getAccount()?.email, "alice@example.com");
check("аккаунт больше не анонимный", auth.getAccount()?.isAnonymous, false);
check("id аккаунта — из сессии", auth.getAccount()?.id, alice.id);

// 2. Регистрация с ВКЛЮЧЁННЫМ подтверждением почты: аккаунт есть, сессии нет
signUpResponse = {
  data: { user: makeUser({ email: "bob@example.com" }), session: null },
  error: null,
};

const pending = await auth.signUpWithEmail("bob@example.com", "secret1");
check("подтверждение почты: без сессии", pending.ok && !pending.signedIn, true);
check(
  "подтверждение почты: игроку сказано проверить письмо",
  /Подтвердите/.test(pending.message),
  true
);

// 3. Ошибка сервера доходит до игрока дословно
signInResponse = {
  data: { user: null, session: null },
  error: { message: "Invalid login credentials" },
};

const failed = await auth.signInWithEmail("bob@example.com", "wrong-pass");
check("ошибка входа не выдаётся за успех", failed.ok, false);
check("текст ошибки сервера дошёл", failed.message, "Invalid login credentials");

// 4. Успешный вход: сессия встаёт, почта и имя видны интерфейсу
const carol = makeUser({
  id: "b3f1c0de-0000-4000-8000-000000000002",
  email: "carol@example.com",
  user_metadata: { username: "Кэрол" },
});
signInResponse = {
  data: { user: carol, session: { user: carol, access_token: "token" } },
  error: null,
};

const entered = await auth.signInWithEmail("carol@example.com", "secret1");
check("вход принят", entered.ok && entered.signedIn, true);
check("в аккаунте почта вошедшего", auth.getAccount()?.email, "carol@example.com");
check("имя из метаданных сохранено", auth.getAccount()?.username, "Кэрол");

// 5. Подписка на смену аккаунта: вход и выход доходят до интерфейса, отписка работает
const seen = [];
const unsubscribe = auth.subscribeAccount((account) => seen.push(account));

listener("SIGNED_IN", { user: makeUser({ email: "dave@example.com" }) });
check("подписчик увидел вход", seen[0]?.email, "dave@example.com");

listener("SIGNED_OUT", null);
check("подписчик увидел выход", seen[1], null);

unsubscribe();
check("отписка дошла до Supabase", unsubscribes, 1);

// 6. Регистрация из АНОНИМНОЙ сессии: updateUser сохраняет тот же uuid, а не создаёт
//    второго пользователя (иначе колония, лидерборд и кредиты остались бы на старом).
const anonId = "b3f1c0de-0000-4000-8000-000000000003";
const anonUser = makeUser({ id: anonId, email: null, is_anonymous: true });
const unsubscribeAnon = auth.subscribeAccount(() => {});

listener("SIGNED_IN", { user: anonUser });
check("анонимная сессия установлена", auth.getAccount()?.isAnonymous, true);

const signUpCallsBefore = calls.filter(([name]) => name === "signUp").length;
const permanentUser = makeUser({
  id: anonId,
  email: "eve@example.com",
  is_anonymous: false,
});
updateUserResponse = { data: { user: permanentUser }, error: null };
refreshResponse = {
  data: { session: { user: permanentUser }, user: permanentUser },
  error: null,
};

const converted = await auth.signUpWithEmail("  eve@example.com  ", "secret1");
const updateCall = calls.find(([name]) => name === "updateUser");
check("анонимная регистрация идёт через updateUser", Boolean(updateCall), true);
check(
  "updateUser получил почту без пробелов",
  updateCall?.[1]?.email,
  "eve@example.com"
);
check("updateUser получил пароль", updateCall?.[1]?.password, "secret1");
check(
  "updateUser сохранил ссылку возврата",
  updateCall?.[2]?.emailRedirectTo,
  "https://croak.example"
);
check(
  "после updateUser сессия обновлена (JWT больше не анонимный)",
  calls.some(([name]) => name === "refreshSession"),
  true
);
check("анонимный стал постоянным", converted.ok && converted.signedIn, true);
check("uuid аккаунта не изменился", auth.getAccount()?.id, anonId);
check("почта появилась в аккаунте", auth.getAccount()?.email, "eve@example.com");
check(
  "второй пользователь не создавался",
  calls.filter(([name]) => name === "signUp").length,
  signUpCallsBefore
);

// 6a. Если подтверждение почты всё-таки включили, игрок остаётся анонимным и ждёт письмо.
listener("SIGNED_IN", { user: anonUser });
updateUserResponse = {
  data: {
    user: makeUser({ id: anonId, email: null, is_anonymous: true }),
  },
  error: null,
};

const pendingConvert = await auth.signUpWithEmail("eve2@example.com", "secret1");
check(
  "подтверждение почты: без входа после регистрации",
  pendingConvert.ok && !pendingConvert.signedIn,
  true
);
check(
  "подтверждение почты: игроку сказано проверить письмо",
  /Подтвердите/.test(pendingConvert.message),
  true
);

// 6b. Ошибка updateUser (например, почта занята) доходит до игрока.
listener("SIGNED_IN", { user: anonUser });
updateUserResponse = {
  data: { user: null },
  error: { message: "User already registered" },
};

const failedConvert = await auth.signUpWithEmail("eve@example.com", "secret1");
check("ошибка регистрации не выдаётся за успех", failedConvert.ok, false);
check(
  "ошибка сервера при регистрации дошла дословно",
  failedConvert.message,
  "User already registered"
);
check(
  "обычная ошибка не считается мёртвой сессией",
  calls.some(([name]) => name === "signOut"),
  false
);

// 6c. Анонимного игрока удалили на сервере, а JWT остался в браузере: GoTrue
//     отвечает `user_not_found` («User from sub claim in JWT does not exist»).
//     Регистрация не должна падать: мёртвая сессия убирается локально, аккаунт
//     создаётся обычным signUp, а локальная колония привяжется к новому uuid.
listener("SIGNED_IN", { user: anonUser });
updateUserResponse = {
  data: { user: null },
  error: {
    code: "user_not_found",
    message: "User from sub claim in JWT does not exist",
  },
};

const frank = makeUser({
  id: "b3f1c0de-0000-4000-8000-000000000004",
  email: "frank@example.com",
});
signUpResponse = {
  data: { user: frank, session: { user: frank, access_token: "token" } },
  error: null,
};
const signUpsBeforeDead = calls.filter(([name]) => name === "signUp").length;

const recovered = await auth.signUpWithEmail("frank@example.com", "secret1");
check("удалённый игрок не блокирует регистрацию", recovered.ok, true);
check("после восстановления игрок вошёл", recovered.signedIn, true);
check(
  "мёртвая сессия убрана только на этом устройстве",
  calls.filter(([name]) => name === "signOut").at(-1)?.[1]?.scope,
  "local"
);
check(
  "регистрация продолжилась обычным signUp",
  calls.filter(([name]) => name === "signUp").length,
  signUpsBeforeDead + 1
);
check(
  "signUp получил ту же почту без пробелов",
  calls.filter(([name]) => name === "signUp").at(-1)?.[1]?.email,
  "frank@example.com"
);
check("новый аккаунт заменил удалённый", auth.getAccount()?.id, frank.id);
check("новый аккаунт не анонимный", auth.getAccount()?.isAnonymous, false);

// 6d. Аккаунт создан, но сессию обновить не удалось: не врём про вход и просим
//     войти заново — иначе после перезагрузки игрок снова оказался бы гостем.
listener("SIGNED_IN", { user: anonUser });
updateUserResponse = {
  data: {
    user: makeUser({
      id: anonId,
      email: "eve3@example.com",
      is_anonymous: false,
    }),
  },
  error: null,
};
refreshResponse = {
  data: { session: null, user: null },
  error: { message: "network down" },
};

const unrefreshed = await auth.signUpWithEmail("eve3@example.com", "secret1");
check(
  "без свежей сессии вход не обещан",
  unrefreshed.ok && !unrefreshed.signedIn,
  true
);
check(
  "игроку предложено войти заново",
  /Войдите/.test(unrefreshed.message),
  true
);
check(
  "аккаунт остался прежним анонимным",
  auth.getAccount()?.isAnonymous,
  true
);

unsubscribeAnon();
listener("SIGNED_OUT", null);
// ---------------------------------------------------------------------------
// ВХОД ЧЕРЕЗ TELEGRAM: сбой вебвью не должен создавать «дубль» аккаунта
//
// Прод-сценарий: второй девайс открыл мини-апп, запрос к Edge Function не дошёл,
// ошибка молча превращалась в signInAnonymously() — и на лидерборде появлялись
// «Алиса Павлова» и «Алиса Павлова 1» с разными uuid.
// ---------------------------------------------------------------------------
const tgUser = makeUser({
  id: "211bdfe0-0d46-4f20-8976-563668a76365",
  email: "tg-857360604@telegram.local",
  is_anonymous: false,
  user_metadata: { tg_id: 857360604, username: "Алиса Павлова" },
});

/** Заглушки Supabase + Telegram WebApp для отдельной копии модуля auth. */
const makeTelegramBundle = async (name, initData) => {
  const bundle = await bundleAuth(name, CLOUD_ENV);
  const state = {
    calls: [],
    invokes: 0,
    session: { data: { session: null }, error: null },
    anonymous: { data: { user: null }, error: null },
    verify: { data: { user: tgUser, session: { user: tgUser } }, error: null },
    invoke: () => ({ data: { token_hash: "token" }, error: null }),
  };

  globalThis.window.Telegram = {
    WebApp: {
      initData,
      initDataUnsafe: {
        user: { id: 857360604, first_name: "Алиса", last_name: "Павлова" },
      },
      platform: "ios",
    },
  };

  bundle.supabase.auth.onAuthStateChange = (callback) => {
    state.listener = callback;
    return { data: { subscription: { unsubscribe: () => {} } } };
  };
  bundle.supabase.auth.getSession = async () => state.session;
  bundle.supabase.auth.signInAnonymously = async () => {
    state.calls.push("anonymously");
    return state.anonymous;
  };
  bundle.supabase.auth.verifyOtp = async () => {
    state.calls.push("verifyOtp");
    return state.verify;
  };
  // `functions` в SupabaseClient — геттер, который каждый раз создаёт новый клиент,
  // поэтому подменяем свойство целиком (своё поле перекрывает геттер прототипа).
  Object.defineProperty(bundle.supabase, "functions", {
    configurable: true,
    value: {
      invoke: async () => {
        state.invokes += 1;
        state.calls.push("invoke");
        return state.invoke(state.invokes);
      },
    },
  });

  return { bundle, state };
};

// 9. Первая попытка упала (сеть/холодный старт функции), вторая удалась:
//    вход всё равно через Telegram — без анонимного аккаунта.
const retryBundle = await makeTelegramBundle("auth-tg-retry", "query_id=1&hash=ok");
retryBundle.state.invoke = (attempt) =>
  attempt === 1
    ? { data: null, error: { message: "Failed to fetch" } }
    : { data: { token_hash: "token-2" }, error: null };

const retried = await retryBundle.bundle.ensureAccount();
check("Telegram: сбой первой попытки не создаёт анонима", retryBundle.state.calls.includes("anonymously"), false);
check("Telegram: повтор вернул аккаунт из Telegram", retried?.id, tgUser.id);
check("Telegram: аккаунт не анонимный", retried?.isAnonymous, false);
check("Telegram: tg_id пришёл из метаданных", retried?.tgId, 857360604);
check("Telegram: запросов к функции было два", retryBundle.state.invokes, 2);

// 10. Анонимная сессия уже лежит на устройстве (второй запуск): её меняем на
//     Telegram-аккаунт, а не тянем дальше как «дубль».
const storedBundle = await makeTelegramBundle("auth-tg-stored", "query_id=2&hash=ok");
storedBundle.state.session = { data: { session: { user: anonUser } }, error: null };

const upgraded = await storedBundle.bundle.ensureAccount();
check("Telegram: анонимная сессия обменяна на аккаунт", upgraded?.id, tgUser.id);
check("Telegram: старый uuid не сохранён", upgraded?.id === anonId, false);

// 11. Сервер недоступен: анонимный дубль НЕ создаётся, игра идёт локально, а
//     повтор откладывается (иначе каждый синк бил бы в мёртвую функцию).
const downBundle = await makeTelegramBundle("auth-tg-down", "query_id=3&hash=ok");
downBundle.state.invoke = () => ({ data: null, error: { message: "Failed to fetch" } });

const down = await downBundle.bundle.ensureAccount();
check("Telegram недоступен: анонимный дубль не создан", downBundle.state.calls.includes("anonymously"), false);
check("Telegram недоступен: аккаунта нет (игра локальная)", down, null);
check("Telegram недоступен: все три попытки сделаны", downBundle.state.invokes, 3);

const downAgain = await downBundle.bundle.ensureAccount();
check("Telegram недоступен: повтор отложен по таймауту", downBundle.state.invokes, 3);
check("Telegram недоступен: повтор тоже без анонима", downBundle.state.calls.includes("anonymously"), false);
check("Telegram недоступен: повтор вернул null", downAgain, null);

// Событие INITIAL_SESSION со старой анонимной сессией не должно «оживить» дубль:
// иначе ensureAccount() вернул бы её как обычный аккаунт, и синк снова пошёл бы
// в отдельный uuid на каждом устройстве.
downBundle.state.listener("INITIAL_SESSION", { user: anonUser });
check(
  "Telegram недоступен: старая анонимная сессия не стала аккаунтом",
  downBundle.bundle.getAccount(),
  null
);

// 12. Веб без Telegram: анонимная сессия по-прежнему создаётся — там дубля нет,
//     ключ аккаунта и есть это устройство.
delete globalThis.window.Telegram;
const webBundle = await bundleAuth("auth-web-anon", CLOUD_ENV);
const webAnon = makeUser({
  id: "b3f1c0de-0000-4000-8000-000000000009",
  email: null,
  is_anonymous: true,
});
const webCalls = [];
webBundle.supabase.auth.onAuthStateChange = () => ({
  data: { subscription: { unsubscribe: () => {} } },
});
webBundle.supabase.auth.getSession = async () => ({ data: { session: null }, error: null });
webBundle.supabase.auth.signInAnonymously = async () => {
  webCalls.push("anonymously");
  return { data: { user: webAnon }, error: null };
};

const webAccount = await webBundle.ensureAccount();
check("Веб: анонимная сессия создана", webCalls.length, 1);
check("Веб: аккаунт анонимный", webAccount?.isAnonymous, true);

// 13. Автоматический браузер (headless-скриншотер, краулер, webdriver): анонимную
//     сессию НЕ создаём. Иначе каждый обход сайта заводил «лишнего игрока» —
//     строку `game_state` и профиль `user_<timestamp>`; в проде так и появились
//     сохранения от HeadlessChrome и Reflectionbot. Обычный браузер входит как
//     раньше — проверка не должна отключать облако живым игрокам.
const botBundle = await bundleAuth("auth-bot", CLOUD_ENV);
const botCalls = [];
botBundle.supabase.auth.onAuthStateChange = () => ({
  data: { subscription: { unsubscribe: () => {} } },
});
botBundle.supabase.auth.getSession = async () => ({ data: { session: null }, error: null });
botBundle.supabase.auth.signInAnonymously = async () => {
  botCalls.push("anonymously");
  return { data: { user: webAnon }, error: null };
};

/** Подставить браузеру признаки автоматизации (как их видит `automation.ts`). */
const probeBrowser = (probe) => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: probe,
  });
};

probeBrowser({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.0 Safari/537.36",
});
check("headless: аккаунта нет", await botBundle.ensureAccount(), null);
check("headless: анонимная сессия не создана", botCalls.length, 0);

probeBrowser({
  userAgent:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Reflectionbot/1.0; +https://reflection.ai/bot) Chrome/151.0.0.0 Safari/537.36",
});
check("краулер: аккаунта нет", await botBundle.ensureAccount(), null);
check("краулер: анонимная сессия не создана", botCalls.length, 0);

probeBrowser({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  webdriver: true,
});
check("webdriver (Playwright/Selenium): аккаунта нет", await botBundle.ensureAccount(), null);
check("webdriver (Playwright/Selenium): сессия не создана", botCalls.length, 0);

probeBrowser({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  webdriver: false,
});
const humanAccount = await botBundle.ensureAccount();
check("обычный браузер: анонимная сессия создана", botCalls.length, 1);
check("обычный браузер: аккаунт анонимный", humanAccount?.isAnonymous, true);

// Telegram WebView — не бот, хотя в UA есть слово Telegram: шаблон ищет
// «TelegramBot» (боты-обходчики), а не «Telegram-Android» (живой мини-апп).
check(
  "Telegram WebView не считается ботом",
  botBundle.isAutomatedBrowser({
    userAgent:
      "Mozilla/5.0 (Linux; Android 16; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8059.43 Mobile Safari/537.36 Telegram-Android/13.1.1 (Samsung SM-F956B; Android 16; SDK 36; HIGH)",
  }),
  false
);
check(
  "поисковые краулеры отсекаются",
  botBundle.isAutomatedBrowser({
    userAgent: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  }) &&
    botBundle.isAutomatedBrowser({
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    }),
  true
);

delete globalThis.navigator;



// 7. Выход: сессия погашена, сейв прошлого игрока убран, игра перезапущена
// Ключ тот же, что пишет `backend/localStorage.ts` (LS_KEY).
const LS_KEY = "Game_State6";
const ACCOUNT_LOCAL_KEYS = [
  // Витрина, коллайдер и гарантии лутбоксов принадлежат аккаунту.
  "toad_shop_state9",
  "toad_elite_claims",
  "toadColliderState",
  "toad_lootbox_pity",
  "Stellar_Croak_Narrator_v1",
  "tutorial_read",
];
browser.store.set(LS_KEY, JSON.stringify({ user: { userId: "old-player" } }));
ACCOUNT_LOCAL_KEYS.forEach((key) => browser.store.set(key, "{}"));

await auth.signOutAccount();
check("выход ушёл в Supabase", calls.some(([name]) => name === "signOut"), true);
check("аккаунт сброшен", auth.getAccount(), null);
check("сейв прошлого игрока убран", browser.store.has(LS_KEY), false);
check(
  "витрина прошлого игрока убрана",
  browser.store.has("toad_shop_state9"),
  false
);
check(
  "журнал элитных заказов прошлого игрока убран",
  browser.store.has("toad_elite_claims"),
  false
);
check(
  "коллайдер прошлого игрока убран",
  browser.store.has("toadColliderState"),
  false
);
check(
  "гарантии лутбоксов прошлого игрока сброшены",
  browser.store.has("toad_lootbox_pity"),
  false
);
check(
  "прогресс обучения прошлого игрока убран",
  browser.store.has("Stellar_Croak_Narrator_v1"),
  false
);
check(
  "старая метка обучения убрана",
  browser.store.has("tutorial_read"),
  false
);
check("игра перезапущена", browser.reloads.length, 1);

// 7. Если выход не удался (например, пропала сеть), сессия остаётся в силе: сейв
//    НЕ трогаем и игру не перезапускаем — иначе игрок вернулся бы в тот же аккаунт,
//    но уже без локального прогресса (supabase-js при ошибке сессию не удаляет).
signOutResponse = { error: { message: "network down" } };
browser.store.set(LS_KEY, "{}");

const failedSignOut = await auth.signOutAccount();
check("неудачный выход не выдаётся за успех", failedSignOut.ok, false);
check("неудачный выход: сейв на месте", browser.store.has(LS_KEY), true);
check("неудачный выход: без перезагрузки", browser.reloads.length, 1);
check(
  "неудачный выход: игроку предложено повторить",
  /Не удалось выйти/.test(failedSignOut.message),
  true
);

// 8. Облако не настроено: вход выключен, но ничего не падает
check("без env облако выключено", offline.isCloudSyncEnabled, false);
check("новое имя ключа (publishable) включает облако", auth.isCloudSyncEnabled, true);
check(
  "старое имя ключа (anon) тоже включает облако",
  legacy.isCloudSyncEnabled,
  true
);

const noCloud = await offline.signInWithEmail("alice@example.com", "secret1");
check("без env вход не проходит", noCloud.ok, false);
check("без env названа причина", /Облако/.test(noCloud.message), true);

const seenOffline = [];
const unsubscribeOffline = offline.subscribeAccount((account) =>
  seenOffline.push(account)
);
check("без env подписчик сразу получает «нет аккаунта»", seenOffline.length, 1);
check("без env аккаунта нет", seenOffline[0], null);
unsubscribeOffline();

console.log(
  failures.length === 0
    ? "\n✅ Вход по почте: все проверки пройдены"
    : `\n❌ Вход по почте: провалов ${failures.length}\n${failures.join("\n")}`
);
process.exit(failures.length === 0 ? 0 : 1);
