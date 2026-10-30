import { updateUser } from "../backend";
import { getGameState } from "../backend/localStorage";
import { Items } from "../models/user";

/**
 * Генная пыль ✨ — материал коллайдера и товар рынка.
 *
 * В коллайдере пыль работает как множитель качества: до 10 пылинок за одно
 * смешивание, каждая добавляет +1% к итоговому качеству (редкости) гибрида.
 * Остаток пыли всегда можно продать на «Космическом рынке» по фиксированному
 * курсу — 1 штука = 5 Кваксов.
 */

/** Сколько Кваксов даёт одна проданная пылинка */
export const GENE_DUST_SELL_PRICE = 5;
/** Сколько пыли можно всыпать в один запуск коллайдера */
export const GENE_DUST_MAX_PER_MIX = 10;

/** Сколько генной пыли лежит на складе (отрицательные и дробные значения не считаем) */
export const getGeneDustCount = (
  storage: Partial<Record<Items, number>> = getGameState().user.storage,
): number => Math.max(0, Math.floor(storage[Items.geneDust] ?? 0));

/**
 * Бонус к качеству в процентах: 0…10.
 * Ползунок не даёт выйти за лимит, но расчёт защищён и от прямого вызова.
 */
export const getGeneDustBonusPercent = (amount: number): number =>
  Math.min(GENE_DUST_MAX_PER_MIX, Math.max(0, Math.floor(amount)));

/** Множитель качества гибрида: 1.00 … 1.10 */
export const getGeneDustRarityMultiplier = (amount: number): number =>
  1 + getGeneDustBonusPercent(amount) / 100;

/** Итоговое качество гибрида после добавления пыли (с округлением до сотых) */
export const applyGeneDustToRarity = (rarity: number, amount: number): number =>
  Math.round(
    Math.max(0, rarity) * getGeneDustRarityMultiplier(amount) * 100,
  ) / 100;

/** Сколько Кваксов принесёт продажа этого количества пыли */
export const getGeneDustSellTokens = (amount: number): number =>
  Math.max(0, Math.floor(amount)) * GENE_DUST_SELL_PRICE;

export interface GeneDustSpendResult {
  success: boolean;
  spent: number;
}

/**
 * Списывает генную пыль со склада (расход коллайдера).
 * Возвращает, сколько реально удалось списать: остаток ограничен запасом.
 */
export const spendGeneDust = (amount: number): GeneDustSpendResult => {
  const state = getGameState();
  const available = getGeneDustCount(state.user.storage);
  const spent = Math.min(Math.max(0, Math.floor(amount)), available);

  if (spent <= 0) {
    return { success: false, spent: 0 };
  }

  updateUser({
    storage: {
      ...state.user.storage,
      [Items.geneDust]: available - spent,
    },
  });

  return { success: true, spent };
};

export interface GeneDustSellResult {
  success: boolean;
  sold: number;
  tokensGained: number;
}

/**
 * Продаёт генную пыль по курсу 5 Кваксов за штуку.
 *
 * Продать можно только то, что лежит на складе: запрос больше запаса
 * урезается до остатка, нулевая продажа не проходит.
 */
export const sellGeneDust = (amount: number): GeneDustSellResult => {
  const state = getGameState();
  const available = getGeneDustCount(state.user.storage);
  const sold = Math.min(Math.max(0, Math.floor(amount)), available);

  if (sold <= 0) {
    return { success: false, sold: 0, tokensGained: 0 };
  }

  const tokensGained = getGeneDustSellTokens(sold);

  updateUser({
    tokens: state.user.tokens + tokensGained,
    storage: {
      ...state.user.storage,
      [Items.geneDust]: available - sold,
    },
  });

  return { success: true, sold, tokensGained };
};
