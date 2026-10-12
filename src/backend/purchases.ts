import { getGameState, updateGameState } from "./localStorage";
import { supabase } from "./supabase";

/**
 * ПОКУПКИ ЗА ЗВЁЗДЫ (Telegram Stars).
 *
 * Деньги принимает бот (`bot.js`): только у него есть токен бота и service-role
 * ключ. Бот НЕ трогает сейв игрока — он лишь пишет строку в таблицу `credits`
 * (кто, сколько, за что). Клиент при синхронизации забирает свои необработанные
 * начисления и превращает их в кваксы. Так запись в сейв идёт из одного места
 * (клиента), и гонки «бот перезаписал прогресс» не бывает.
 *
 * Порядок «начислить → отметить» выбран осознанно: если отметить не удалось,
 * повторный синк начислит кваксы ещё раз (редко, в пользу игрока). Обратный
 * порядок терял бы оплаченную покупку — это хуже.
 */

type CreditRow = { id: number; tokens: number | null };

/** Необработанные начисления игрока. */
const fetchPendingCredits = async (accountId: string): Promise<CreditRow[]> => {
  const { data, error } = await supabase
    .from("credits")
    .select("id, tokens")
    .eq("user_id", accountId)
    .is("applied_at", null);

  if (error) {
    console.warn("[purchases] не удалось прочитать начисления:", error.message);
    return [];
  }

  return (data ?? []) as CreditRow[];
};

/**
 * Начисляет кваксы за оплаченные в боте покупки.
 *
 * @param accountId — ключ аккаунта (uuid сессии), он же `user_id` в таблице `credits`
 * @returns сколько кваксов начислено (0 — начислений не было)
 */
export const applyPendingCredits = async (
  accountId: string
): Promise<number> => {
  const credits = await fetchPendingCredits(accountId);

  if (!credits.length) {
    return 0;
  }

  const total = credits.reduce((sum, credit) => sum + (credit.tokens ?? 0), 0);
  const state = getGameState();

  if (total > 0) {
    updateGameState({
      user: { ...state.user, tokens: state.user.tokens + total },
    });
  }

  const { error } = await supabase
    .from("credits")
    .update({ applied_at: new Date().toISOString() })
    .eq("user_id", accountId)
    .in(
      "id",
      credits.map((credit) => credit.id)
    );

  if (error) {
    console.warn(
      "[purchases] начисление не удалось отметить обработанным:",
      error.message
    );
  }

  console.info(
    `[purchases] Начислено ${total} кваксов за ${credits.length} покупок`
  );

  return total;
};
