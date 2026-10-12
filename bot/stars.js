/**
 * ПРАЙС И PAYLOAD ПОКУПОК ЗА TELEGRAM STARS.
 *
 * Здесь только арифметика покупки — ни Telegraf, ни Supabase. Поэтому модуль
 * проверяется в node без сети (см. tmp-verify-stars.mjs), а бот и тест используют
 * один и тот же код: если прайс поедет, тест это заметит.
 *
 * Важная деталь про payload: в нём лежит ТОЛЬКО id набора. Количество кваксов бот
 * берёт из этой таблицы, а не из строки от Telegram, иначе «оплатил 50 звёзд —
 * получил 5000 кваксов» стало бы вопросом правки payload на клиенте.
 *
 * Валюту XTR (Stars) Telegram принимает с пустым `provider_token` — платёжный
 * провайдер для звёзд не нужен.
 */

/** Наборы кваксов. Чем крупнее набор, тем выгоднее курс — это единственная «скидка». */
export const TOKEN_PACKS = [
  {
    id: "handful",
    stars: 50,
    tokens: 250,
    title: "Горсть кваксов",
    description: "250 кваксов: корм, лутбокс и немного на постройку",
  },
  {
    id: "pouch",
    stars: 150,
    tokens: 900,
    title: "Мешочек кваксов",
    description: "900 кваксов — курс выгоднее на 20%",
  },
  {
    id: "crate",
    stars: 500,
    tokens: 3500,
    title: "Ящик кваксов",
    description: "3500 кваксов — самый выгодный курс",
  },
];

const PAYLOAD_PREFIX = "croak";

/** Найти набор по id. */
export const findPack = (packId) => TOKEN_PACKS.find((pack) => pack.id === packId) ?? null;

/** payload для Telegram: `croak:<packId>` (Telegram вернёт его в successful_payment). */
export const encodePayload = (packId) => `${PAYLOAD_PREFIX}:${packId}`;

/** Разобрать payload. Незнакомый набор — `null` (тогда покупку не начисляем). */
export const decodePayload = (payload) => {
  const [prefix, packId] = String(payload ?? "").split(":");

  return prefix === PAYLOAD_PREFIX ? findPack(packId)?.id ?? null : null;
};

/** Сколько кваксов за звезду — для проверки «крупный набор выгоднее». */
export const tokensPerStar = (pack) => pack.tokens / pack.stars;

/** Подпись кнопки набора: «250 кваксов · 50 ⭐». */
export const describePack = (pack) => `${pack.tokens} кваксов · ${pack.stars} ⭐`;

/**
 * Строка начисления для таблицы `credits`.
 *
 * Клиент заберёт её при синхронизации и превратит в кваксы (src/backend/purchases.ts).
 * `telegram_payment_charge_id` уникален: повторный вебхук от Telegram не начислит
 * покупку второй раз.
 */
export const buildCreditRow = ({ pack, userId, chargeId }) => ({
  user_id: userId,
  tokens: pack.tokens,
  stars: pack.stars,
  payload: encodePayload(pack.id),
  telegram_payment_charge_id: chargeId,
});

/**
 * Проверка прайса. Вызывается на старте бота: лучше упасть сразу, чем продать
 * «0 кваксов за 50 звёзд».
 */
export const validatePacks = () => {
  const ids = new Set();

  for (const pack of TOKEN_PACKS) {
    if (ids.has(pack.id)) {
      throw new Error(`Набор "${pack.id}" объявлен дважды`);
    }

    ids.add(pack.id);

    if (!(pack.stars > 0) || !(pack.tokens > 0)) {
      throw new Error(`Набор "${pack.id}" продаётся бесплатно или отдаёт кваксы ни за что`);
    }
  }

  return TOKEN_PACKS.length;
};
