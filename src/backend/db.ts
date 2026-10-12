import { ensureAccount } from "./auth";
import { applyPendingCredits } from "./purchases";
import { Toad } from "../models/Toad";
import { attachIdentity, getGameState, updateGameState } from "./localStorage";
import {
  getAchievementState,
  saveAchievementState,
} from "./achivements-manager";
import { loadColliderState, saveColliderState } from "./collider-manager";
import { getShopState, saveShopState } from "./shop-state";
import { isCloudSyncEnabled, supabase } from "./supabase";

// Клиент Supabase и флаг «облако настроено» переехали в ./supabase (чтобы вход не
// тянул циклический импорт), но исторически импортировались отсюда — оставляем
// реэкспорт, чтобы никого не ломать.
export { isCloudSyncEnabled, supabase };

/**
 * Ключ аккаунта для всех облачных таблиц. `null` означает «облака нет»: креды не
 * заданы или вход не удался — тогда каждая функция молча ничего не делает, и игра
 * спокойно идёт на localStorage.
 *
 * Заодно аккаунт «дошивается» в сейв (`attachIdentity`), чтобы `user.id` в
 * localStorage всегда совпадал с ключом строк в таблицах.
 */
const resolveAccountId = async (): Promise<string | null> => {
  const account = await ensureAccount();

  if (!account) {
    return null;
  }

  attachIdentity(account.id);

  return account.id;
};


export type ToadCollection = {
  rarest_toad: Toad;
  weight_max_toad: Toad;
  weight_min_toad: Toad;
  fertility_max_toad: Toad;
  fertility_min_toad: Toad;
  speed_max_toad: Toad;
  speed_min_toad: Toad;
  hunger_max_toad: Toad;
  hunger_min_toad: Toad;
};

export type LeaderboardItemType = {
  /** Визитка Telegram: `null` у игроков, которые в Telegram не заходили. */
  tg_id: number | null;
  username: string;
  tokens: number;
  total_toads: number;
  total_species: number;
  /** Ключ аккаунта (uuid сессии) — по нему ищется «моя» строка. */
  user_id: string;
  toads_collection: ToadCollection;
};

export const createLeaderbord = async (accountId?: string) => {
  if (!isCloudSyncEnabled) {
    return;
  }

  const id = accountId ?? (await resolveAccountId());
  if (!id) {
    return;
  }

  const { user, toads } = getGameState();
  const ldData = await getLeaderboardByUser(id);

  if (ldData?.data) {
    return;
  }

  const leaderbordData = {
    username: user.username,
    tokens: user.tokens,
    total_toads: toads.length,
    // user_id — ключ аккаунта: работает и в вебе (анонимная сессия), и в Telegram.
    user_id: id,
    // tg_id — только «визитка» для уведомлений бота; в вебе её нет.
    tg_id: user.tg_id,
    total_species: new Set(toads.map((t) => t.type)).size,
    toads_collection: {
      rarest_toad: toads.sort((a, b) => b.genes.rarity - a.genes.rarity)[0],
      weight_max_toad: toads.sort((a, b) => b.genes.weight - a.genes.weight)[0],
      weight_min_toad: toads.sort((a, b) => a.genes.weight - b.genes.weight)[0],
      fertility_max_toad: toads.sort(
        (a, b) => b.genes.fertility - a.genes.fertility
      )[0],
      fertility_min_toad: toads.sort(
        (a, b) => a.genes.fertility - b.genes.fertility
      )[0],
      speed_max_toad: toads.sort((a, b) => b.genes.speed - a.genes.speed)[0],
      speed_min_toad: toads.sort((a, b) => a.genes.speed - b.genes.speed)[0],
      hunger_max_toad: toads.sort(
        (a, b) => b.genes.hungerRate - a.genes.hungerRate
      )[0],
      hunger_min_toad: toads.sort(
        (a, b) => a.genes.hungerRate - b.genes.hungerRate
      )[0],
    },
  };

  const { data, error } = await supabase
    .from("leaderboard")
    .insert([leaderbordData])
    .select();
  console.log("Created leaderboard");

  return { data, error };
};

export const updateLeaderbord = async (accountId?: string) => {
  if (!isCloudSyncEnabled) {
    return;
  }

  const id = accountId ?? (await resolveAccountId());
  if (!id) {
    return;
  }

  const { user, toads } = getGameState();
  const ldData = await getLeaderboardByUser(id);

  if (!ldData?.data) {
    console.log("Created Leaderboard");

    await createLeaderbord(id);
    return;
  }

  const leaderbordData = {
    username: user.username,
    tokens: user.tokens,
    total_toads: toads.length,
    // Визитку Telegram обновляем вместе со строкой: по ней бот находит игрока,
    // чтобы прислать уведомление.
    tg_id: user.tg_id,
    total_species: getAchievementState().toads_collection?.length || 0,
    toads_collection: {
      rarest_toad: toads.sort((a, b) => b.genes.rarity - a.genes.rarity)[0],
      weight_max_toad: toads.sort((a, b) => b.genes.weight - a.genes.weight)[0],
      weight_min_toad: toads.sort((a, b) => a.genes.weight - b.genes.weight)[0],
      fertility_max_toad: toads.sort(
        (a, b) => b.genes.fertility - a.genes.fertility
      )[0],
      fertility_min_toad: toads.sort(
        (a, b) => a.genes.fertility - b.genes.fertility
      )[0],
      speed_max_toad: toads.sort((a, b) => b.genes.speed - a.genes.speed)[0],
      speed_min_toad: toads.sort((a, b) => a.genes.speed - b.genes.speed)[0],
      hunger_max_toad: toads.sort(
        (a, b) => b.genes.hungerRate - a.genes.hungerRate
      )[0],
      hunger_min_toad: toads.sort(
        (a, b) => a.genes.hungerRate - b.genes.hungerRate
      )[0],
    },
  };

  await supabase.from("leaderboard").update(leaderbordData).eq("user_id", id);

  console.log("Updated leaderboard");
};

export const getAllLeaderboards = async () => {
  if (!isCloudSyncEnabled) {
    return [];
  }

  await updateLeaderbord();
  const { data } = await supabase.from("leaderboard").select();

  return data;
};

/**
 * Строка лидерборда аккаунта.
 *
 * Раньше строка искалась по `tg_id`: веб-игрок (или любой, чей `tg_id` не успел
 * появиться) не мог ни создать, ни обновить свою запись — поиск всегда «не находил».
 * Теперь ключ — `user_id`, один и тот же в вебе и в Telegram.
 */
export const getLeaderboardByUser = async (accountId: string) => {
  if (!isCloudSyncEnabled) {
    return;
  }

  const data = await supabase
    .from("leaderboard")
    .select()
    .eq("user_id", accountId)
    .maybeSingle();

  return data;
};

export const createGameStateDB = async (accountId?: string) => {
  if (!isCloudSyncEnabled) {
    return;
  }

  const id = accountId ?? (await resolveAccountId());
  if (!id) {
    return;
  }

  const { user } = getGameState();

  const gameData = {
    // user_id — ключ аккаунта (uuid сессии); tg_id — только визитка для бота.
    user_id: id,
    tg_id: user.tg_id,
    content: getGameState(),
    achievements: getAchievementState(),
    collider: loadColliderState(),
    // Состояние магазина раньше не синхронизировалось вовсе: ассортимент и
    // кулдауны обновлений терялись при смене устройства. Колонка `shop` (jsonb).
    shop: getShopState(),
  };

  const { data, error } = await supabase
    .from("game_state")
    .insert([gameData])
    .select();

  console.log("Created game state!");

  return { data, error };
};

export const updateGameStateDB = async (accountId?: string) => {
  if (!isCloudSyncEnabled) {
    return;
  }

  const id = accountId ?? (await resolveAccountId());
  if (!id) {
    return;
  }

  const { user } = getGameState();

  const allState = {
    ...getGameState(),
  };

  const { data, error } = await supabase
    .from("game_state")
    .update({
      content: allState,
      // Визитку Telegram держим свежей: по ней бот находит игрока для уведомлений.
      tg_id: user.tg_id,
      achievements: getAchievementState(),
      collider: loadColliderState(),
      shop: getShopState(),
    })
    .eq("user_id", id)
    .select();

  console.log("updated GameState");
  return { data, error };
};

export const getGameStateDB = async (accountId?: string) => {
  if (!isCloudSyncEnabled) {
    return;
  }

  const id = accountId ?? (await resolveAccountId());
  if (!id) {
    return;
  }

  const { data, error } = await supabase
    .from("game_state")
    .select()
    .eq("user_id", id)
    .maybeSingle();

  console.log("get GameState");

  return { data, error };
};

export const syncGameState = async () => {
  if (!isCloudSyncEnabled) {
    return;
  }

  // Аккаунт (uuid сессии) появляется один раз на старте: вход через Telegram либо
  // анонимная сессия веб-версии. Раньше здесь «дошивался» tg_id, и без него синк
  // молча пропускался — веб-версия не могла синхронизироваться вовсе.
  const accountId = await resolveAccountId();

  if (!accountId) {
    return;
  }

  await mergeGameState(accountId);

  // Покупки за звёзды бот кладёт мимо сейва (см. purchases.ts) — забираем их
  // последними, чтобы они не «перетёрлись» пришедшим из облака состоянием.
  await applyPendingCredits(accountId);
};

/** Сливает локальный сейв с облачным по времени последнего сохранения. */
const mergeGameState = async (accountId: string) => {
  const currentGS = getGameState();

  const data = await getGameStateDB(accountId);

  if (data?.error) {
    return;
  }

  if (!data?.data) {
    await createGameStateDB(accountId);

    return;
  }

  const gameStateStored = data.data;

  const accountCreated = currentGS.createdAt
    ? new Date(currentGS.createdAt).getTime()
    : Date.now();

  // аккаунт создался в лс, но он уже есть в бд
  if (new Date(gameStateStored.created_at).getTime() < accountCreated) {
    // перезаписываем игру через дб
    updateGameState({
      ...gameStateStored.content,
      createdAt: gameStateStored.created_at,
    });
    if (Object.keys(gameStateStored.achievements).length) {
      saveAchievementState(gameStateStored.achievements);
    }
    if (Object.keys(gameStateStored.collider).length) {
      saveColliderState(gameStateStored.collider);
      window.dispatchEvent(new Event("colliderChanged"));
    }
    if (gameStateStored.shop && Object.keys(gameStateStored.shop).length) {
      saveShopState(gameStateStored.shop);
    }
    console.log("sync GameState");

    return;
  }

  // смотрим какое сохранение более свежее
  const lastVisitLs = new Date(currentGS.lastSaved).getTime();
  const lastVisitDb = new Date(gameStateStored.content.lastSaved).getTime();

  console.log(
    `last saved ls: ${currentGS.lastSaved}, last saved db: ${gameStateStored.content.lastSaved}`
  );

  // последний синк меньше чем 3 минуты - много багов у пользователй, может какие-то тормоза мешают
  if (Math.abs(lastVisitLs - lastVisitDb) < 1000 * 60 * 3) {
    console.log("sync Data is fresh");
    return;
  }

  if (lastVisitLs > lastVisitDb) {
    console.log("sync GameState db");
    await updateGameStateDB(accountId);
    return;
  }

  console.log("sync GameState ls");
  updateGameState({
    ...gameStateStored.content,
  });

  if (Object.keys(gameStateStored.achievements).length) {
    saveAchievementState(gameStateStored.achievements);
  }
  if (Object.keys(gameStateStored.collider).length) {
    saveColliderState(gameStateStored.collider);
    window.dispatchEvent(new Event("colliderChanged"));
  }
  if (gameStateStored.shop && Object.keys(gameStateStored.shop).length) {
    saveShopState(gameStateStored.shop);
  }
};
