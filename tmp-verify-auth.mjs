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
 *   7) выход гасит сессию, УБИРАЕТ локальный сейв прошлого игрока и перезапускает
 *      игру, а неудачный выход не врёт об успехе и не трогает сейв;
 *   8) без настроенного Supabase вход отключён и ничего не падает.
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

auth.supabase.auth.signOut = async () => {
  calls.push(["signOut"]);
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

// 6c. Аккаунт создан, но сессию обновить не удалось: не врём про вход и просим
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

// 7. Выход: сессия погашена, сейв прошлого игрока убран, игра перезапущена
// Ключ тот же, что пишет `backend/localStorage.ts` (LS_KEY).
const LS_KEY = "Game_State6";
browser.store.set(LS_KEY, JSON.stringify({ user: { userId: "old-player" } }));

await auth.signOutAccount();
check("выход ушёл в Supabase", calls.some(([name]) => name === "signOut"), true);
check("аккаунт сброшен", auth.getAccount(), null);
check("сейв прошлого игрока убран", browser.store.has(LS_KEY), false);
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
