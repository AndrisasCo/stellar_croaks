/**
 * Проверка прайса и payload покупок за Telegram Stars (на РЕАЛЬНОМ коде бота).
 *
 * Модуль `bot/stars.js` — чистый JS: ни Telegraf, ни Supabase, поэтому проверяется
 * напрямую, без сборщика. Проверяем то, из-за чего покупка могла бы стать дырой:
 *   1) прайс валиден: id уникальны, звёзды и кваксы — положительные целые;
 *   2) payload «туда-обратно»: каждый набор опознаётся, чужая строка — нет
 *      (иначе подделанный payload начислил бы любой набор);
 *   3) строка начисления собирается из НАШЕГО прайса, а не из данных Telegram;
 *   4) крупный набор не хуже мелкого по курсу (обещание «выгоднее» в описании);
 *   5) telegram_payment_charge_id попадает в строку как есть — по нему дубликаты
 *      отсекаются на стороне базы.
 *
 * Запуск: node tmp-verify-stars.mjs
 */
import {
  TOKEN_PACKS,
  buildCreditRow,
  decodePayload,
  describePack,
  encodePayload,
  findPack,
  tokensPerStar,
  validatePacks,
} from "./bot/stars.js";

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

// 1. Прайс
try {
  check("validatePacks() прошёл и вернул число наборов", validatePacks(), TOKEN_PACKS.length);
} catch (error) {
  failures.push(`validatePacks() бросил: ${error.message}`);
  console.log(`❌ validatePacks(): ${error.message}`);
}

check(
  "id наборов уникальны",
  new Set(TOKEN_PACKS.map((pack) => pack.id)).size,
  TOKEN_PACKS.length,
);
check(
  "звёзды и кваксы — положительные целые",
  TOKEN_PACKS.every(
    (pack) =>
      Number.isInteger(pack.stars) &&
      Number.isInteger(pack.tokens) &&
      pack.stars > 0 &&
      pack.tokens > 0,
  ),
  true,
);

// 2. Payload туда-обратно
check(
  "каждый набор опознаётся по своему payload",
  TOKEN_PACKS.every((pack) => decodePayload(encodePayload(pack.id)) === pack.id),
  true,
);
check("мусор вместо payload не проходит", decodePayload("стань мне 5000 кваксов"), null);
check("пустой payload не проходит", decodePayload(""), null);
check("незнакомый набор не проходит", decodePayload("croak:мне-все-кваксы"), null);
check("чужой префикс не проходит", decodePayload("other:handful"), null);
check("payload без префикса не проходит", decodePayload("handful"), null);
check("findPack на незнакомый id — null", findPack("нет-такого"), null);

// 3. Строка начисления берётся из прайса, а не из запроса
const pack = TOKEN_PACKS[0];
const row = buildCreditRow({
  pack,
  userId: "0e8a1a3e-0000-4000-8000-000000000001",
  chargeId: "tg-charge-1",
});
check("в начислении наш набор кваксов", row.tokens, pack.tokens);
check("в начислении наши звёзды", row.stars, pack.stars);
check("начисление привязано к аккаунту", row.user_id, "0e8a1a3e-0000-4000-8000-000000000001");
check("начисление помечено нашим payload", row.payload, encodePayload(pack.id));
check("id платежа Telegram доехал целиком", row.telegram_payment_charge_id, "tg-charge-1");
check(
  "чужие поля в начисление не просачиваются",
  Object.keys(row).sort().join(","),
  "payload,stars,telegram_payment_charge_id,tokens,user_id",
);

// 4. Экономика: крупнее набор — не хуже курс
const rates = TOKEN_PACKS.map(tokensPerStar);
check(
  "курс не падает с размером набора",
  rates.every((rate, index) => index === 0 || rate >= rates[index - 1]),
  true,
);
check(
  "последний набор — самый выгодный",
  Math.max(...rates),
  rates[rates.length - 1],
);

// 5. Подпись кнопки читаема
check(
  "подпись кнопки показывает и кваксы, и звёзды",
  describePack(pack),
  `${pack.tokens} кваксов · ${pack.stars} ⭐`,
);

console.log(
  failures.length === 0
    ? `\n✅ Покупки за звёзды: все проверки пройдены (${TOKEN_PACKS.length} набора)`
    : `\n❌ Покупки за звёзды: провалов ${failures.length}\n${failures.join("\n")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
