import { DEFAULT_SCENE, Scene } from "../models/scene";
import { DEFAULT_TOADS, Toad } from "../models/Toad";
import { Items, User } from "../models/user";
import {
  Expedition,
  ExpeditionStats,
  DEFAULT_EXPEDITION_STATS,
} from "../models/expedition";
import { ColonyState, EMPTY_COLONY } from "../models/colony";
import { platform } from "../platform";
import { NEST_ROOM_ID } from "../utils/constants";
import { HUNGER_MAX } from "../utils/hunger";
import { toTimestamp } from "../utils/date";

// Интерфейс для всего состояния игры
export interface GameState {
  user: User;
  scenes: Scene[];
  toads: Toad[];
  colony?: ColonyState;
  expeditions?: Expedition[];
  /**
   * Разобранные походы: последние завершённые задания с журналами.
   * Держим отдельно от `expeditions`, чтобы карточки не блокировали отправку
   * новой команды, но игрок мог перечитать логи прошедшего похода.
   */
  expeditionArchive?: Expedition[];
  expeditionStats?: ExpeditionStats;
  lastSaved: string;
  createdAt: string;
}

const LS_KEY = "Game_State6";

/**
 * Доступ к сохранению идёт через платформу: в обеих реализациях это localStorage
 * устройства (src/platform/device-storage.ts), но теперь ядро игры не знает, где
 * именно лежит сейв — путь к общему хранилищу (Telegram CloudStorage) открыт.
 */
const storage = platform.storage;

// Инициализация состояния по умолчанию
export const getDefaultGameState = (): GameState => {
  const identity = platform.identity();
  const localId = `user_${Date.now()}`;

  return {
    user: {
      // Локальный id до первого входа в облако. Настоящий ключ аккаунта (uuid
      // сессии) подставляет attachIdentity, когда сессия появится.
      id: localId,
      username: identity.username || localId,
      // В Telegram id есть сразу — это «визитка» для бота; вне Telegram его нет.
      tg_id: identity.tgId,
      // Стартовый капитал обучения: хватает на первый корм (60 🔷) и КОНТУР (25 🔷).
      tokens: 100,

      astro_quax: 0,
      biomass: 50,
      // Стартовая колония: корма нет — первый корм игрок покупает в Торговой капсуле
      // по заданию обучения (склад предметов, Часть 3.7). Мушка и червь нужны
      // обучению: ими игрок сразу ускоряет беременность и рост головастика.
      storage: {
        ...Object.values(Items).reduce(
          (acc, key) => ({ ...acc, [key]: 0 }),
          {} as Record<Items, number>,
        ),
        [Items.sparkleFlys]: 1,
        [Items.worms]: 1,
      },
    },
    scenes: [DEFAULT_SCENE],
    toads: DEFAULT_TOADS,
    colony: EMPTY_COLONY,
    expeditions: [],
    expeditionArchive: [],
    expeditionStats: {
      ...DEFAULT_EXPEDITION_STATS,
      completedSectors: [],
      unlockedSectors: [],
    },
    lastSaved: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
};

// Получение текущего состояния
export const getGameState = (): GameState => {
  try {
    const stored = storage.get(LS_KEY);
    if (stored) {
      const parsed: GameState = JSON.parse(stored);
      const migrated = migrateGameState(parsed);

      if (migrated !== parsed) {
        storage.set(LS_KEY, JSON.stringify(migrated));
      }

      return migrated;
    }

    // Если нет сохраненного состояния, создаем новое
    const defaultState = getDefaultGameState();
    storage.set(LS_KEY, JSON.stringify(defaultState));
    return defaultState;
  } catch (error) {
    console.error("Error loading game state:", error);
    return getDefaultGameState();
  }
};
/**
 * Есть ли на устройстве сейв. В отличие от `getGameState` ничего не создаёт:
 * благодаря этому досыл при закрытии не воскрешает сейв, стёртый выходом из
 * аккаунта (`clearGameState`).
 */
export const hasGameState = (): boolean => {
  try {
    return Boolean(storage.get(LS_KEY));
  } catch {
    return false;
  }
};


type LegacyToad = Toad & { roomId?: string | null };

/**
 * id места жабы в старом сейве. До перехода на `scene_id` сектор колонии хранился
 * в `roomId`; у гекса `breeding` это был литерал `"breeding"`, а карта зовёт его
 * постоянным `NEST_ROOM_ID` — даже когда Репродуктор уже построен игроком.
 */
const normalizeLegacyRoomId = (roomId: string): string =>
  roomId === "breeding" ? NEST_ROOM_ID : roomId;

const getLegacyRoomId = (toad: LegacyToad): string | null =>
  typeof toad.roomId === "string" ? normalizeLegacyRoomId(toad.roomId) : null;

/** Поля жабы, которые ушли из игры: сейчас это только устаревшее ухаживание */
type LegacyToadFields = { mating?: unknown };

/** Что поправить в жабе при загрузке (`dropMating` — удалить поле, а не записать `null`) */
type ToadPatches = Partial<Toad> & { dropMating?: boolean };

/**
 * Что в жабе из старого сейва не по текущим правилам (`null` — всё в порядке).
 *
 * Миграции живут здесь, а не в игровом тике: тик идёт раз в минуту, и «доигрывание»
 * старых состояний в нём было вечным — код старых механик оставался в игре навсегда.
 */
const collectToadPatches = (
  toad: Toad & LegacyToadFields,
  now: number,
): ToadPatches | null => {
  const patches: ToadPatches = {};
  let touched = false;

  // 1. Ухаживание 15–30 минут: родов «по таймеру ухаживания» больше нет, пару
  //    заводит кнопка в репродукторе. Старая запись только занимает жабу.
  if ("mating" in toad) {
    patches.dropMating = true;
    touched = true;
  }

  // 2. Сытость: битая или вне 0…100. Жаба без `state` (очень старый сейв) получает
  //    голодного головастика — покормить её можно как обычно.
  const hunger = toad.state?.hunger;
  const normalizedHunger = Number.isFinite(hunger)
    ? Math.min(HUNGER_MAX, Math.max(0, hunger as number))
    : 0;

  if (!toad.state || normalizedHunger !== hunger) {
    patches.state = { ...(toad.state ?? {}), hunger: normalizedHunger };
    touched = true;
  }

  // 3. Таймер роста головастика. Раньше его запускал тик, теперь — первое кормление:
  //    сытому головастику из старого сейва ставим метку на загрузку (его уже кормили),
  //    а голодному — нет, его покормят кормушка или игрок.
  if (toad.stage === "toadpole") {
    const startedAt = toTimestamp(toad.growthStartedAt ?? null);

    if (startedAt != null) {
      if (startedAt !== toad.growthStartedAt) {
        patches.growthStartedAt = startedAt;
        touched = true;
      }
    } else if (toad.growthStartedAt != null) {
      patches.growthStartedAt = null;
      touched = true;
    } else if (normalizedHunger > 0) {
      patches.growthStartedAt = now;
      touched = true;
    }
  }

  // 4. Срок беременности: ISO-строка старого сейва → мс. Битая запись получает
  //    нулевой срок, чтобы ближайший тик родил, а не оставил жабу беременной навсегда.
  const pregnancy = toad.pregnancy;

  if (pregnancy && !pregnancy.isPregnant) {
    patches.pregnancy = null;
    touched = true;
  } else if (pregnancy) {
    const startedAt = toTimestamp(pregnancy.pregnancyStart);
    const duration = Number(pregnancy.pregnancyDuration);

    if (startedAt == null || !Number.isFinite(duration) || duration < 0) {
      patches.pregnancy = {
        ...pregnancy,
        pregnancyStart: now,
        pregnancyDuration: 0,
      };
      touched = true;
    } else if (
      startedAt !== pregnancy.pregnancyStart ||
      duration !== pregnancy.pregnancyDuration
    ) {
      patches.pregnancy = {
        ...pregnancy,
        pregnancyStart: startedAt,
        pregnancyDuration: duration,
      };
      touched = true;
    }
  }

  return touched ? patches : null;
};

/** Перенести поля жабы из старого сейва; без изменений возвращает тот же объект */
function migrateToadFields(state: GameState): GameState {
  if (!state.toads?.length) {
    return state;
  }

  const now = Date.now();
  let changed = false;
  let droppedMating = 0;
  let startedGrowth = 0;

  const toads = state.toads.map((toad) => {
    const patches = collectToadPatches(toad, now);

    if (!patches) {
      return toad;
    }

    changed = true;

    if (patches.dropMating) {
      droppedMating += 1;
    }

    if (patches.growthStartedAt != null && toad.growthStartedAt == null) {
      startedGrowth += 1;
    }

    const { dropMating, ...fields } = patches;
    const next = { ...toad, ...fields } as Toad & LegacyToadFields;

    if (dropMating) {
      delete next.mating;
    }

    return next as Toad;
  });

  if (!changed) {
    return state;
  }

  if (droppedMating > 0) {
    console.info(
      `[localStorage] Устаревшее ухаживание снято: ${droppedMating} жаб`,
    );
  }

  if (startedGrowth > 0) {
    console.info(
      `[localStorage] Рост головастиков из старого сейва запущен: ${startedGrowth}`,
    );
  }

  return { ...state, toads };
}

/**
 * Приведение старых сейвов к правилу «у жабы одно место» (`utils/toad-location.ts`):
 *
 *  1. **Дом (`homeId`)**: раньше `scene_id` был домом жабы — он не менялся, пока жаба
 *     работала в секторе колонии. Теперь `scene_id` — это место, где жаба **сейчас**
 *     (число — биопод, строка — сектор колонии), а дом переехал в `homeId`: переносим
 *     его из старого `scene_id`, если поля ещё нет.
 *  2. **Место**: старая жаба в секторе (`roomId`) теперь сидит в нём через `scene_id`.
 *     Если `roomId` нет, `scene_id` остаётся её биоподом.
 *  3. **Склад жаб отменён**: у каждой жабы всегда есть биопод. Старые сейвы держали лишних
 *     жаб «на складе» (пустой биопод и никакого сектора) — расселяем их по биоподам по
 *     порядку; если мест не хватило, жабы остаются жить в переполненном биоподе до
 *     постройки нового (потерять жаб нельзя).
 *  4. **Дом не теряется**: даже жаба в секторе должна помнить биопод (`homeId`) — если
 *     старого дома нет в сейве, подбираем свободный (или первый) биопод. Место в секторе
 *     при этом не меняется.
 */
function migrateToadPlaces(state: GameState): GameState {
  if (!state.toads?.length || !state.scenes?.length) {
    return state;
  }

  let changed = false;
  const sceneIds = new Set(state.scenes.map((scene) => scene.id));
  const isValidScene = (id: unknown): id is number =>
    typeof id === "number" && sceneIds.has(id);

  // 1–2. Дом и место: числовой `scene_id` — биопод, строка — сектор колонии
  let toads = state.toads.map((toad) => {
    const legacy = toad as LegacyToad;
    const legacyRoomId = getLegacyRoomId(legacy);
    // Дом не выбрасываем, если он указывает на существующий биопод: у жабы в секторе
    // `homeId` мог быть проставлен раньше, а старый `scene_id` при этом уже стал местом.
    const homeId = isValidScene(toad.homeId)
      ? toad.homeId
      : isValidScene(toad.scene_id)
        ? toad.scene_id
        : null;
    const sceneId: number | string | null =
      legacyRoomId ??
      (typeof toad.scene_id === "string"
        ? normalizeLegacyRoomId(toad.scene_id)
        : isValidScene(toad.scene_id)
          ? toad.scene_id
          : null);

    if (
      homeId === toad.homeId &&
      sceneId === toad.scene_id &&
      legacy.roomId === undefined
    ) {
      return toad;
    }

    const { roomId: _legacyRoomId, ...rest } = legacy;
    changed = true;

    return { ...rest, homeId, scene_id: sceneId } as Toad;
  });

  // 3–4. Жабы без места или без дома: биопод не помнит их ни местом, ни домом
  const lostPlace = (toad: Toad): boolean =>
    typeof toad.scene_id === "string" ? false : !isValidScene(toad.scene_id);
  const lostHome = (toad: Toad): boolean => !isValidScene(toad.homeId);

  if (toads.some((toad) => lostPlace(toad) || lostHome(toad))) {
    const free = new Map<number, number>(
      state.scenes.map((scene) => [
        scene.id,
        Math.max(
          0,
          scene.capacity -
            toads.filter(
              (toad) =>
                isValidScene(toad.scene_id) && toad.scene_id === scene.id,
            ).length,
        ),
      ]),
    );
    const fallbackSceneId = state.scenes[0].id;
    let moved = 0;
    let homed = 0;

    toads = toads.map((toad) => {
      if (!lostPlace(toad) && !lostHome(toad)) {
        return toad;
      }

      // Жаба уже в секторе: место не трогаем, только возвращаем ей дом, чтобы
      // «Домой» знал, куда её вести. Место дома не бронируется (как и в игре).
      if (!lostPlace(toad)) {
        const home =
          state.scenes.find(
            (scene) =>
              scene.id === toad.homeId && (free.get(scene.id) ?? 0) > 0,
          ) ?? state.scenes.find((scene) => (free.get(scene.id) ?? 0) > 0);

        homed += 1;

        return { ...toad, homeId: home?.id ?? fallbackSceneId };
      }

      // Места нет: сначала пробуем дом жабы (если он ещё существует), потом любой
      // свободный биопод, в крайнем случае — первый (переполненный, но не потерянный).
      const scene =
        state.scenes.find(
          (candidate) =>
            isValidScene(toad.homeId) &&
            candidate.id === toad.homeId &&
            (free.get(candidate.id) ?? 0) > 0,
        ) ??
        state.scenes.find((candidate) => (free.get(candidate.id) ?? 0) > 0);
      const sceneId = scene?.id ?? fallbackSceneId;

      if (scene) {
        free.set(scene.id, (free.get(scene.id) ?? 1) - 1);
      }

      moved += 1;

      return { ...toad, scene_id: sceneId, homeId: sceneId };
    });

    changed = true;

    if (moved > 0) {
      console.info(`Склад жаб закрыт: ${moved} жаб переехали в биоподы`);
    }

    if (homed > 0) {
      console.info(`Дом восстановлен: ${homed} жаб в секторах`);
    }
  }

  // 5. Старые походы не помнили «Разведку»: раньше вместо id гекса передавался
  //    `sceneId`, а у «Разведки» его нет. Привязываем такие походы к первой
  //    «Разведке», чтобы карточка жила только в одном контуре и не блокировала
  //    отправку второй команды из другой «Разведки». Если контуров несколько,
  //    точный исходник уже не восстановить — берём первую «Разведку» в списке.
  const expeditions = state.expeditions ?? [];
  const scoutRooms =
    state.colony?.rooms?.filter((room) => room.kind === "scout") ?? [];

  if (
    scoutRooms.length > 0 &&
    expeditions.some((expedition) => expedition.originRoomId == null)
  ) {
    const originRoomId = scoutRooms[0].id;

    return {
      ...state,
      toads,
      expeditions: expeditions.map((expedition) =>
        expedition.originRoomId == null
          ? { ...expedition, originRoomId }
          : expedition,
      ),
    };
  }

  return changed ? { ...state, toads } : state;
}

/**
 * Все миграции сейва при загрузке: сначала поля жабы (устаревшие механики),
 * затем места (дом, сектор, склад). Порядок важен — расселение в
 * `migrateToadPlaces` опирается на актуальные `scene_id`/`homeId`.
 */
function migrateGameState(state: GameState): GameState {
  return migrateToadPlaces(migrateToadFields(state));
}

// Сохранение всего состояния
/** `keepLastSaved` — служебная запись: `lastSaved` не двигается, оффлайн не «съедается» */
export const saveGameState = (
  state: GameState,
  keepLastSaved: boolean,
): void => {
  try {
    const stateToSave = {
      ...state,
      // не обновляем время, если событие было вызвано gameLoop
      lastSaved: keepLastSaved ? state.lastSaved : new Date().toISOString(),
    };
    storage.set(LS_KEY, JSON.stringify(stateToSave));

    const event = new CustomEvent("gameStateUpdated", {
      detail: {
        timestamp: Date.now(),
        source: "game",
      },
    });

    // Отправляем событие
    window.dispatchEvent(event);
  } catch (error) {
    console.error("Error saving game state:", error);
  }
};

// Обновление состояния (частичное)
export const updateGameState = (
  updates: Partial<GameState>,
  keepLastSaved = false,
): GameState => {
  const currentState = getGameState();
  const newState = { ...currentState, ...updates };

  saveGameState(newState, keepLastSaved);
  return newState;
};

/**
 * Убирает сейв с устройства.
 *
 * Нужен при смене аккаунта (выход из веб-аккаунта): в браузере сейв один на всех,
 * и без очистки прогресс прошлого игрока «переехал» бы в новую сессию. При
 * следующем входе он вернётся из облака (`backend/db.ts` → `mergeGameState`).
 */
export const clearGameState = (): void => {
  storage.remove(LS_KEY);
};

/**
 * Приводит «визитку» аккаунта в соответствие с окружением.
 *
 * Раньше аккаунт держался на `tg_id`, который терялся, если состояние создавалось
 * до готовности WebApp, — облачный синк и лидерборд молча пропускались. Теперь
 * личность собирается из двух независимых источников:
 *  - `accountId` — uuid сессии Supabase (проверенный сервером `initData` либо
 *    анонимная сессия веб-версии). Это ключ аккаунта во всех облачных таблицах;
 *  - платформа — `tg_id` и имя для отображения (в вебе их нет, и это нормально).
 *
 * @returns актуальное состояние после возможного обновления
 */
export const attachIdentity = (accountId?: string | null): GameState => {
  const state = getGameState();
  const identity = platform.identity();
  const user = { ...state.user };
  const changes: string[] = [];

  // 1. Ключ аккаунта: uuid сессии вместо локального `user_<timestamp>`.
  if (accountId && user.id !== accountId) {
    user.id = accountId;
    changes.push(`id=${accountId}`);
  }

  // 2. Визитка Telegram. Чужой tg_id не перезаписываем, чтобы не «склеить» аккаунты.
  if (identity.tgId && !user.tg_id) {
    user.tg_id = identity.tgId;
    changes.push(`tg_id=${identity.tgId}`);
  }

  // 3. Имя: автогенерённое `user_…` меняем на имя из Telegram; выбранное игроком не трогаем.
  if (identity.username && user.username?.startsWith("user_")) {
    user.username = identity.username;
    changes.push(`username=${identity.username}`);
  }

  if (!changes.length) {
    return state;
  }

  console.info(`[localStorage] Аккаунт обновлён: ${changes.join(", ")}`);

  // `keepLastSaved = true`: привязка аккаунта — не игровой прогресс. Иначе `lastSaved`
  // обновлялся бы прямо перед синком (`backend/db.ts` → `resolveAccountId`), и
  // локальный сейв всегда выглядел бы новее облачного: прогресс, сохранённый на
  // другом устройстве, не применялся бы никогда.
  return updateGameState({ user }, true);
};
