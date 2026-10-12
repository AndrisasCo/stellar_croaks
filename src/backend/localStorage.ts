import { DEFAULT_SCENE, Scene } from "../models/scene";
import { DEFAULT_TOADS, Toad } from "../models/Toad";
import { Items, User } from "../models/user";
import { Expedition, ExpeditionStats } from "../models/expedition";
import { ColonyState, EMPTY_COLONY } from "../models/colony";
import { platform } from "../platform";

// Интерфейс для всего состояния игры
export interface GameState {
  user: User;
  scenes: Scene[];
  toads: Toad[];
  /** Построенные комнаты колонии (гексагональная карта). */
  colony?: ColonyState;
  /** Активные походы (разведка, Часть 5) */
  expeditions?: Expedition[];
  /** Статистика разведки: открытие секторов и ачивки */
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
      tokens: 50,

      astro_quax: 0,
      biomass: 0,
      // Стартовая колония: корм есть, остальные полки пустые (склад предметов, Часть 3.7)
      storage: Object.values(Items).reduce(
        (acc, key) => ({ ...acc, [key]: key === Items.food ? 100 : 0 }),
        {} as Record<Items, number>
      ),
    },
    scenes: [DEFAULT_SCENE],
    toads: DEFAULT_TOADS,
    colony: EMPTY_COLONY,
    expeditions: [],
    expeditionStats: { completed: 0, bestDepth: 0, downed: 0 },
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
 * Склад жаб отменён: у каждой жабы всегда есть вольер.
 * Старые сейвы держали лишних жаб «на складе» (`scene_id: null`) — при загрузке
 * расселяем их по вольерам по порядку; если мест не хватило, жабы остаются жить
 * в переполненном вольере до постройки нового (потерять жаб нельзя).
 */
function migrateGameState(state: GameState): GameState {
  if (!state.toads?.length || !state.scenes?.length) {
    return state;
  }

  const homeless = state.toads.filter(
    (toad) => !state.scenes.some((scene) => scene.id === toad.scene_id)
  );

  if (homeless.length === 0) {
    return state;
  }

  const free = new Map<number, number>(
    state.scenes.map((scene) => [
      scene.id,
      Math.max(
        0,
        scene.capacity -
          state.toads.filter((toad) => toad.scene_id === scene.id).length
      ),
    ])
  );
  const fallbackSceneId = state.scenes[0].id;
  let index = 0;

  const toads = state.toads.map((toad) => {
    if (state.scenes.some((scene) => scene.id === toad.scene_id)) {
      return toad;
    }

    const scene = state.scenes.find((candidate) => (free.get(candidate.id) ?? 0) > 0);

    if (!scene) {
      return { ...toad, scene_id: fallbackSceneId };
    }

    free.set(scene.id, (free.get(scene.id) ?? 1) - 1);
    index += 1;

    return { ...toad, scene_id: scene.id };
  });

  console.info(`Склад жаб закрыт: ${index} жаб переехали в вольеры`);

  return { ...state, toads };
}

// Сохранение всего состояния
export const saveGameState = (state: GameState, syntetic: boolean): void => {
  try {
    const stateToSave = {
      ...state,
      // не обновляем время, если событие было вызвано gameLoop
      lastSaved: syntetic ? state.lastSaved : new Date().toISOString(),
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
  syntetic = false
): GameState => {
  const currentState = getGameState();
  const newState = { ...currentState, ...updates };

  saveGameState(newState, syntetic);
  return newState;
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

  return updateGameState({ user });
};
