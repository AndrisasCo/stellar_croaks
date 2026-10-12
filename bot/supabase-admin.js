/**
 * Доступ бота к Supabase.
 *
 * Бот — единственный, у кого есть service-role ключ: он обходит RLS, а значит
 * может и начислить покупку, и разослать уведомление. Поэтому здесь только три
 * операции, каждая из которых объяснима:
 *
 *  - `findUserIdByTgId` — кто этот игрок в облаке. Связку `tg_id → user_id` пишет
 *    Edge Function `telegram-auth` при каждом входе в игру;
 *  - `enqueueCredit` — положить покупку в очередь начисления (клиент заберёт её
 *    сам при синхронизации, см. src/backend/purchases.ts);
 *  - `listTgIds` — кому вообще можно писать (для рассылки).
 */
import { createClient } from "@supabase/supabase-js";

export const createAdminClient = (url, serviceRoleKey) =>
  createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Аккаунт игрока по его Telegram id. `null` — игрок ещё не открывал игру. */
export const findUserIdByTgId = async (admin, tgId) => {
  const { data, error } = await admin
    .from("players")
    .select("user_id")
    .eq("tg_id", tgId)
    .maybeSingle();

  if (error) {
    console.error("[bot] не удалось найти игрока:", error.message);
    return null;
  }

  return data?.user_id ?? null;
};

/**
 * Очередь начислений.
 *
 * @returns "created" — запись появилась; "duplicate" — этот платёж уже обработан
 *   (Telegram умеет повторять вебхук); "error" — что-то сломалось, нужен лог.
 */
export const enqueueCredit = async (admin, row) => {
  const { error } = await admin.from("credits").insert(row);

  if (!error) {
    return "created";
  }

  // 23505 = unique_violation (дубль telegram_payment_charge_id)
  if (error.code === "23505") {
    return "duplicate";
  }

  console.error("[bot] не удалось начислить покупку:", error.message);

  return "error";
};

/** Telegram-id всех известных игроков — для уведомлений. */
export const listTgIds = async (admin, limit = 500) => {
  const { data, error } = await admin
    .from("players")
    .select("tg_id")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[bot] не удалось прочитать игроков:", error.message);
    return [];
  }

  return (data ?? []).map((row) => row.tg_id);
};
