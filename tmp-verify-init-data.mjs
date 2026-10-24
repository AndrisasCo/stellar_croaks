/**
 * Проверка СЕРВЕРНОЙ ВЕРИФИКАЦИИ `initData` на РЕАЛЬНОМ коде проекта (без Telegram).
 *
 * Модуль `supabase/functions/_shared/telegram-init-data.ts` бандлится через esbuild и
 * прогоняется как обычный JS. Подпись для тестов считается НЕЗАВИСИМО — через
 * node:crypto (`createHmac`), то есть другой библиотекой, чем WebCrypto внутри модуля:
 * если алгоритм в модуле неверен, тест это поймает, а не подтвердит сам себя.
 *
 * Проверяем то, из-за чего вход в игру мог бы «прощать» подделку:
 *   1) правильная подпись и свежий auth_date проходят, id игрока достаётся;
 *   2) чужой токен бота не проходит (HMAC не сходится);
 *   3) подменённый user (например, чужой tg_id) не проходит — hash покрывает поля;
 *   4) отсутствие hash и просроченный auth_date отклоняются;
 *   5) поле `signature` (Bot API 8.0) принимается в обоих видах: живой клиент
 *      подписывает данные ВМЕСТЕ с `signature`, старые/иные — без него;
 *   6) data_check_string собирается по алфавиту и не содержит `hash`.
 *
 * Запуск: node tmp-verify-init-data.mjs
 */
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-init-data-"));
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
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );

  return require(outfile);
};

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const {
  buildDataCheckString,
  buildDataCheckStrings,
  computeInitDataHash,
  getInitDataDisplayName,
  verifyInitData,
} = bundle(
  "supabase/functions/_shared/telegram-init-data.ts",
  "telegram-init-data"
);

const BOT_TOKEN = "123456789:AAExampleTokenForTestsOnly_notReal";
const NOW = 1_800_000_000;

/** Копия «телеграмной» арифметики на node:crypto — независимая от WebCrypto модуля */
const telegramHash = (botToken, dataCheckString) => {
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();

  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
};

/**
 * Собирает initData так, как это делает Telegram: `hash` в строку проверки не входит.
 *
 * `signatureInHash` — правило для поля `signature` (Bot API 8.0): живой мини-апп
 * подписывает данные вместе с ним, часть клиентов — без. `userJson` позволяет
 * подсунуть `user` ровно в том виде, в каком его присылает Telegram (с `\/` в URL).
 */
const makeInitData = ({
  user,
  authDate = NOW,
  extra = {},
  token = BOT_TOKEN,
  signatureInHash = false,
  userJson,
}) => {
  const params = {
    auth_date: String(authDate),
    query_id: "AAHdF6IQAAAAAN0Xoha",
    user: userJson ?? JSON.stringify(user),
    ...extra,
  };

  const dataCheckString = Object.keys(params)
    .filter(
      (key) =>
        key !== "hash" && (signatureInHash || key !== "signature")
    )
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");

  return new URLSearchParams({
    ...params,
    hash: telegramHash(token, dataCheckString),
  }).toString();
};

const user = {
  id: 857360604,
  first_name: "Алиса",
  last_name: "Квак",
  username: "alice",
};

(async () => {
  // 1. Честный вход
  const valid = await verifyInitData(makeInitData({ user }), BOT_TOKEN, {
    nowSeconds: NOW,
  });
  check("честный initData принят", valid.ok, true);
  check(
    "из подписи достали tg_id",
    valid.ok ? valid.data.user.id : null,
    user.id
  );
  check(
    "имя игрока собрано из first_name/last_name",
    valid.ok ? getInitDataDisplayName(valid.data.user) : null,
    "Алиса Квак"
  );

  // 2. Чужой токен бота
  const wrongToken = await verifyInitData(
    makeInitData({ user }),
    "999999:другой-токен",
    { nowSeconds: NOW }
  );
  check("чужой токен бота отклонён", wrongToken.ok, false);
  check("причина — неверная подпись", wrongToken.reason, "bad_hash");

  // 3. Подмена пользователя в готовой строке (самая частая атака)
  const forged = makeInitData({ user }).replace(
    encodeURIComponent('"id":857360604'),
    encodeURIComponent('"id":1')
  );
  const forgedResult = await verifyInitData(forged, BOT_TOKEN, {
    nowSeconds: NOW,
  });
  check("подменённый tg_id отклонён", forgedResult.ok, false);
  check("причина — неверная подпись", forgedResult.reason, "bad_hash");

  // 4. Отсутствующая подпись и просроченный auth_date
  const noHash = new URLSearchParams({
    auth_date: String(NOW),
    user: JSON.stringify(user),
  }).toString();
  const noHashResult = await verifyInitData(noHash, BOT_TOKEN, {
    nowSeconds: NOW,
  });
  check("initData без hash отклонён", noHashResult.reason, "missing_hash");

  const stale = await verifyInitData(
    makeInitData({ user, authDate: NOW - 60 * 60 * 25 }),
    BOT_TOKEN,
    { nowSeconds: NOW }
  );
  check("просроченный initData (25 ч) отклонён", stale.reason, "expired");

  const fresh = await verifyInitData(
    makeInitData({ user, authDate: NOW - 60 * 60 * 23 }),
    BOT_TOKEN,
    { nowSeconds: NOW }
  );
  check("initData возрастом 23 ч ещё годится", fresh.ok, true);

  // 5. Bot API 8.0: `signature`. Живой мини-апп подписывает данные ВМЕСТЕ с ним
  //    (так пришёл реальный initData из Telegram), часть клиентов — без него.
  const signature =
    "qOaD7jZ2xKzmKLFZZroI_OISjRFOmPmk2PYEVILdrlO-ikVVJquI9OGlUHtl-BrbkEpuRXXOWK2b4XmfNOZjAQ";
  const liveUserJson =
    '{"id":857360604,"first_name":"Алиса","last_name":"Павлова","username":"pavlova_alisa","language_code":"ru","allows_write_to_pm":true,"photo_url":"https:\\/\\/t.me\\/i\\/userpic\\/320\\/Kcl6ZpGNZ3YU6_swhDOFCDyd3G55fBDmtcicrMfTz-Y.svg"}';
  const liveExtras = {
    chat_instance: "8842000271892048179",
    chat_type: "sender",
    signature,
  };
  const liveShape = makeInitData({
    user,
    extra: liveExtras,
    signatureInHash: true,
    userJson: liveUserJson,
  });
  const liveResult = await verifyInitData(liveShape, BOT_TOKEN, {
    nowSeconds: NOW,
  });
  check("живой initData (signature в подписи) принят", liveResult.ok, true);
  check(
    "из живого initData достали tg_id",
    liveResult.ok ? liveResult.data.user.id : null,
    857360604
  );

  const legacySignature = makeInitData({
    user,
    extra: liveExtras,
    userJson: liveUserJson,
  });
  const legacyResult = await verifyInitData(legacySignature, BOT_TOKEN, {
    nowSeconds: NOW,
  });
  check("initData с signature вне подписи принят", legacyResult.ok, true);

  const forgedLive = liveShape.replace(
    encodeURIComponent('"id":857360604'),
    encodeURIComponent('"id":1')
  );
  check(
    "подмена tg_id в живом initData отклонена",
    (await verifyInitData(forgedLive, BOT_TOKEN, { nowSeconds: NOW })).reason,
    "bad_hash"
  );

  check(
    "строк проверки две, когда есть signature",
    [buildDataCheckStrings({ auth_date: "1", signature: "s" }).length,
     buildDataCheckStrings({ auth_date: "1" }).length].join("/"),
    "2/1"
  );

  // 6. Строка проверки: только алфавитный порядок и без hash/signature
  const checkString = buildDataCheckString({
    user: JSON.stringify(user),
    auth_date: "1",
    hash: "deadbeef",
    signature: "beefdead",
  });
  check(
    "data_check_string отсортирован и без hash/signature",
    checkString,
    `auth_date=1\nuser=${JSON.stringify(user)}`
  );
  check(
    "computeInitDataHash сходится с независимым node:crypto",
    await computeInitDataHash(
      BOT_TOKEN,
      buildDataCheckString({ auth_date: "1", user: JSON.stringify(user) })
    ),
    telegramHash(BOT_TOKEN, `auth_date=1\nuser=${JSON.stringify(user)}`)
  );

  console.log(
    failures.length === 0
      ? "\n✅ Проверка initData: все проверки пройдены"
      : `\n❌ Проверка initData: провалов ${failures.length}\n${failures.join(
          "\n"
        )}`
  );
  process.exit(failures.length === 0 ? 0 : 1);
})();
