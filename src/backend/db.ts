import { ensureAccount, updateAccountUsername } from "./auth";
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
  /** Имя из `profiles`: оно принадлежит аккаунту, а не строке лидерборда. */
  username: string;
  tokens: number;
  total_toads: number;
  total_species: number;
  /** Ключ аккаунта (uuid сессии) — по нему ищется «моя» строка. */
  user_id: string;
  toads_collection: ToadCollection;
};

/** Сколько игроков показываем на одной странице лидерборда. */
export const LEADERBOARD_PAGE_SIZE = 10;

/**
 * Вкладки лидерборда: каждая сортирует игроков по своему параметру.
 *
 * Тип живёт здесь, а не в модалке: по нему выбирается серверная сортировка, и
 * клиент с базой не должны разъезжаться в наборе вкладок.
 */
export type LeaderboardTabType =
  | "rarity" // Самая редкая жаба
  | "weight_max" // Самая большая жаба (макс вес)
  | "weight_min" // Самая маленькая жаба (мин вес)
  | "fertility_max" // Самая плодовитая жаба (макс фертильность)
  | "fertility_min" // Самая стерильная жаба (мин фертильность)
  | "speed_max" // Самая быстрая жаба (макс скорость)
  | "speed_min" // Самая медленная жаба (мин скорость)
  | "hunger_max" // Самая прожорливая жаба (макс голод)
  | "hunger_min" // Самая неголодная жаба (мин голод)
  | "tokens" // Богатство (кваксы)
  | "species"; // Разнообразие видов

/** Страница витрины: строки + сколько всего игроков на вкладке. */
export type LeaderboardPage = {
  rows: LeaderboardItemType[];
  total: number;
  /** Номер страницы с нуля. */
  page: number;
  pageCount: number;
};

type LeaderboardRow = Omit<LeaderboardItemType, "username">;

type LeaderboardSort = {
  /**
   * Колонка PostgREST: обычная (`tokens`) или путь внутрь jsonb
   * (`toads_collection->rarest_toad->genes->rarity`). PostgREST понимает такие
   * пути и в `order`, и в фильтрах, а jsonb-числа сравнивает как числа.
   */
  column: string;
  /** `true` — от меньшего к большему (вкладки «самые маленькие/медленные»). */
  ascending: boolean;
  /** Поле снапшота: строки без этой жабы в рейтинг вкладки не попадают. */
  field?: keyof ToadCollection;
};

const toadPath = (field: keyof ToadCollection, gene: string): string =>
  `toads_collection->${field}->genes->${gene}`;

const LEADERBOARD_SORTS: Record<LeaderboardTabType, LeaderboardSort> = {
  rarity: {
    column: toadPath("rarest_toad", "rarity"),
    ascending: false,
    field: "rarest_toad",
  },
  weight_max: {
    column: toadPath("weight_max_toad", "weight"),
    ascending: false,
    field: "weight_max_toad",
  },
  weight_min: {
    column: toadPath("weight_min_toad", "weight"),
    ascending: true,
    field: "weight_min_toad",
  },
  fertility_max: {
    column: toadPath("fertility_max_toad", "fertility"),
    ascending: false,
    field: "fertility_max_toad",
  },
  fertility_min: {
    column: toadPath("fertility_min_toad", "fertility"),
    ascending: true,
    field: "fertility_min_toad",
  },
  speed_max: {
    column: toadPath("speed_max_toad", "speed"),
    ascending: false,
    field: "speed_max_toad",
  },
  speed_min: {
    column: toadPath("speed_min_toad", "speed"),
    ascending: true,
    field: "speed_min_toad",
  },
  hunger_max: {
    column: toadPath("hunger_max_toad", "hungerRate"),
    ascending: false,
    field: "hunger_max_toad",
  },
  hunger_min: {
    column: toadPath("hunger_min_toad", "hungerRate"),
    ascending: true,
    field: "hunger_min_toad",
  },
  tokens: { column: "tokens", ascending: false },
  species: { column: "total_species", ascending: false },
};

/** Ген, по которому вкладка сравнивает жаб (нужен для подсчёта своего места). */
const LEADERBOARD_GENES: Record<LeaderboardTabType, keyof Toad["genes"] | null> =
  {
    rarity: "rarity",
    weight_max: "weight",
    weight_min: "weight",
    fertility_max: "fertility",
    fertility_min: "fertility",
    speed_max: "speed",
    speed_min: "speed",
    hunger_max: "hungerRate",
    hunger_min: "hungerRate",
    tokens: null,
    species: null,
  };

/**
 * Колонки витрины. `username` сюда не входит: имя читается из `profiles` и
 * подставляется в строку уже на клиенте — так переименование видно сразу.
 */
const LEADERBOARD_SELECT =
  "user_id, tg_id, tokens, total_toads, total_species, toads_collection";

/** Что показать, если профиль игрока ещё не создан (старые строки). */
const UNNAMED_PLAYER = "Игрок";

/**
 * Снапшот «лучших жаб» для витрины.
 *
 * Девять номинаций — по одной жабе на параметр: больше лидерборду не нужно, а
 * полный список жаб игрока только раздувал бы строку. Массив не сортируем на
 * месте: `toads` — это сейв игры, и его порядок не должен меняться от захода в
 * лидерборд.
 */
const buildToadsCollection = (toads: Toad[]): ToadCollection => {
  const bestBy = (compare: (a: Toad, b: Toad) => number): Toad =>
    [...toads].sort(compare)[0];

  return {
    rarest_toad: bestBy((a, b) => b.genes.rarity - a.genes.rarity),
    weight_max_toad: bestBy((a, b) => b.genes.weight - a.genes.weight),
    weight_min_toad: bestBy((a, b) => a.genes.weight - b.genes.weight),
    fertility_max_toad: bestBy((a, b) => b.genes.fertility - a.genes.fertility),
    fertility_min_toad: bestBy((a, b) => a.genes.fertility - b.genes.fertility),
    speed_max_toad: bestBy((a, b) => b.genes.speed - a.genes.speed),
    speed_min_toad: bestBy((a, b) => a.genes.speed - b.genes.speed),
    hunger_max_toad: bestBy((a, b) => b.genes.hungerRate - a.genes.hungerRate),
    hunger_min_toad: bestBy((a, b) => a.genes.hungerRate - b.genes.hungerRate),
  };
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

  // Имени здесь нет: оно живёт в `profiles` и меняется настройками, не витриной.
  const leaderbordData = {
    tokens: user.tokens,
    total_toads: toads.length,
    // user_id — ключ аккаунта: работает и в вебе (анонимная сессия), и в Telegram.
    user_id: id,
    // tg_id — только «визитка» для уведомлений бота; в вебе её нет.
    tg_id: user.tg_id,
    total_species: new Set(toads.map((t) => t.type)).size,
    toads_collection: buildToadsCollection(toads),
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
    tokens: user.tokens,
    total_toads: toads.length,
    // Визитку Telegram обновляем вместе со строкой: по ней бот находит игрока,
    // чтобы прислать уведомление.
    tg_id: user.tg_id,
    total_species: getAchievementState().toads_collection?.length || 0,
    toads_collection: buildToadsCollection(toads),
  };

  await supabase.from("leaderboard").update(leaderbordData).eq("user_id", id);

  console.log("Updated leaderboard");
};

/**
 * Одна страница лидерборда.
 *
 * Сортировка и лимит — на сервере: витрина не должна тянуть всю таблицу со
 * снапшотами жаб, а «топ-10» обязан считаться по всем игрокам, а не по тем, кто
 * случайно попал в выборку. Имена подтягиваются из `profiles` отдельным
 * запросом: в `leaderboard` их больше нет, но переименование видно сразу.
 */
export const getLeaderboardPage = async (
  tab: LeaderboardTabType,
  page = 0,
): Promise<LeaderboardPage> => {
  const empty: LeaderboardPage = {
    rows: [],
    total: 0,
    page: 0,
    pageCount: 1,
  };

  if (!isCloudSyncEnabled) {
    return empty;
  }

  const sort = LEADERBOARD_SORTS[tab];
  const safePage = Math.max(0, Math.floor(page));
  const from = safePage * LEADERBOARD_PAGE_SIZE;

  let query = supabase
    .from("leaderboard")
    .select(LEADERBOARD_SELECT, { count: "exact" });

  // Игрок без нужной жабы (или без кваксов) на вкладке не ранжируется: иначе в
  // топ попадали бы пустые строки.
  if (sort.field) {
    query = query.not(`toads_collection->${sort.field}`, "is", null);
  }
  if (tab === "tokens") {
    query = query.gt("tokens", 0);
  }
  if (tab === "species") {
    query = query.gt("total_species", 0);
  }

  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    // Равные значения не должны «прыгать» между страницами: добиваем сортировку
    // стабильным ключом.
    .order("user_id", { ascending: true })
    .range(from, from + LEADERBOARD_PAGE_SIZE - 1);

  if (error) {
    // Номер страницы мог «пережить» уменьшение таблицы: на offset за концом
    // PostgREST отвечает PGRST103 («Requested range not satisfiable»). Тогда
    // показываем начало — интерфейс выровняется по `page` из ответа.
    if (safePage > 0 && error.code === "PGRST103") {
      return getLeaderboardPage(tab, 0);
    }

    console.warn("[db] лидерборд недоступен:", error.message);

    return empty;
  }

  const rows = (data ?? []) as LeaderboardRow[];
  const names = await getProfileNames(rows.map((row) => row.user_id));
  const total = count ?? rows.length;

  return {
    rows: rows.map((row) => ({
      ...row,
      username: names.get(row.user_id) ?? UNNAMED_PLAYER,
    })),
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE)),
  };
};

/** Имена игроков из `profiles` — одним запросом на всю страницу. */
const getProfileNames = async (
  userIds: string[],
): Promise<Map<string, string>> => {
  if (!userIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in("user_id", userIds);

  if (error) {
    console.warn("[db] не удалось прочитать профили игроков:", error.message);

    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [row.user_id as string, row.username as string]),
  );
};

/**
 * Значение, по которому строка сортируется на вкладке.
 *
 * Нужен только для подсчёта своего места: список уже отсортирован сервером.
 */
const readSortValue = (
  row: LeaderboardRow,
  tab: LeaderboardTabType,
): number | null => {
  if (tab === "tokens") {
    return row.tokens ?? 0;
  }

  if (tab === "species") {
    return row.total_species ?? 0;
  }

  const field = LEADERBOARD_SORTS[tab].field;
  const gene = LEADERBOARD_GENES[tab];
  const toad = field ? row.toads_collection?.[field] : undefined;

  if (!toad || !gene) {
    return null;
  }

  const value = toad.genes?.[gene];

  return typeof value === "number" ? value : null;
};

/**
 * Место игрока на вкладке (с единицы) или `null`, если он ещё не ранжируется.
 *
 * Страница показывает только 10 строк, поэтому своё место считаем отдельным
 * запросом: сколько игроков строго лучше меня, столько и мест впереди.
 */
export const getLeaderboardRank = async (
  tab: LeaderboardTabType,
): Promise<number | null> => {
  if (!isCloudSyncEnabled) {
    return null;
  }

  const id = await resolveAccountId();
  if (!id) {
    return null;
  }

  const response = await getLeaderboardByUser(id);
  const myRow = response?.data as LeaderboardRow | null | undefined;

  if (!myRow) {
    return null;
  }

  const value = readSortValue(myRow, tab);
  if (value === null) {
    return null;
  }

  const sort = LEADERBOARD_SORTS[tab];

  let query = supabase
    .from("leaderboard")
    .select("user_id", { count: "exact", head: true });

  if (sort.field) {
    query = query.not(`toads_collection->${sort.field}`, "is", null);
  }

  const { count, error } = await query.filter(
    sort.column,
    sort.ascending ? "lt" : "gt",
    value,
  );

  if (error) {
    console.warn("[db] не удалось посчитать место в лидерборде:", error.message);

    return null;
  }

  return (count ?? 0) + 1;
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

/** Сколько символов разрешено в имени игрока. */
export const PLAYER_NAME_MIN_LENGTH = 2;
export const PLAYER_NAME_MAX_LENGTH = 15;
/** В `profiles` запас побольше: имя из Telegram бывает длиннее клиентского. */
const PROFILE_NAME_MAX_LENGTH = 32;

export type SavePlayerNameResult = {
  ok: boolean;
  message: string;
};

/**
 * Переименование игрока.
 *
 * Имя принадлежит аккаунту: пишем его в сейв (его синкает облако), в `profiles`
 * (оттуда его читает лидерборд) и в `user_metadata` (запасной источник для входа
 * на другом устройстве). Иначе после перезагрузки вернулся бы старый ник.
 */
export const savePlayerName = async (
  value: string,
): Promise<SavePlayerNameResult> => {
  const username = value.trim();

  if (
    username.length < PLAYER_NAME_MIN_LENGTH ||
    username.length > PLAYER_NAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      message: `Имя должно быть от ${PLAYER_NAME_MIN_LENGTH} до ${PLAYER_NAME_MAX_LENGTH} символов`,
    };
  }

  const { user } = getGameState();
  updateGameState({ user: { ...user, username } });

  if (!isCloudSyncEnabled) {
    return { ok: true, message: "Имя сохранено на этом устройстве" };
  }

  const id = await resolveAccountId();

  if (!id) {
    return {
      ok: true,
      message: "Имя сохранено. Облако недоступно — синхронизируем позже",
    };
  }

  const profile = {
    user_id: id,
    username: username.slice(0, PROFILE_NAME_MAX_LENGTH),
    updated_at: new Date().toISOString(),
  };

  // Обычный `upsert` тут не годится: PostgREST обновляет в конфликте все
  // присланные колонки, включая `user_id`, а его менять нельзя (колоночный grant
  // в schema.sql). Поэтому сначала «вставить, если профиля ещё нет» (DO NOTHING
  // требует только INSERT), затем обновить имя — это уже разрешённая колонка.
  const { error: ensureError } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "user_id", ignoreDuplicates: true });

  if (ensureError) {
    console.warn(
      "[db] не удалось создать профиль игрока:",
      ensureError.message,
    );

    return { ok: false, message: "Имя сохранено локально, но не в облаке" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: profile.username, updated_at: profile.updated_at })
    .eq("user_id", id);

  if (error) {
    console.warn("[db] не удалось сохранить имя в профиле:", error.message);

    return { ok: false, message: "Имя сохранено локально, но не в облаке" };
  }

  // Ошибку метаданных не считаем провалом: имя уже в сейве и в профиле.
  await updateAccountUsername(username);

  return { ok: true, message: "Имя обновлено" };
};

/** Последний профиль, отправленный в облако из этого запуска. */
let syncedProfile: string | null = null;

/**
 * Заводит профиль аккаунта, если его ещё нет.
 *
 * Имя для лидерборда берётся из `profiles`, поэтому профиль нужен каждому игроку,
 * даже если он ни разу не открывал настройки. `ignoreDuplicates` важен: строка
 * могла уже появиться (вход в Telegram или переименование на другом устройстве),
 * и перетирать выбранный ник старым сейвом нельзя.
 */
const ensureProfile = async (accountId: string): Promise<void> => {
  const { user } = getGameState();
  const username = user.username?.trim() ?? "";

  if (!username) {
    return;
  }

  const key = `${accountId}:${username}`;
  if (syncedProfile === key) {
    return;
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: accountId,
      username: username.slice(0, PROFILE_NAME_MAX_LENGTH),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );

  if (error) {
    console.warn("[db] не удалось создать профиль игрока:", error.message);

    return;
  }

  syncedProfile = key;
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

  // Профиль с именем нужен лидерборду: строка витрины ссылается на аккаунт, а
  // имя читается отдельно. Заводим его до того, как игрок откроет витрину.
  await ensureProfile(accountId);

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
    `last saved ls: ${currentGS.lastSaved}, last saved db: ${gameStateStored.content.lastSaved}`,
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
