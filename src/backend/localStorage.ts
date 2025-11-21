import { createScene, createToads, updateUser } from ".";
import { DEFAULT_SCENE, Scene } from "../models/scene";
import { DEFAULT_TOADS, Toad } from "../models/toad";
import { User } from "../models/user";
import { createLeaderbord } from "./db";

// Интерфейс для всего состояния игры
export interface GameState {
  user: User;
  scenes: Scene[];
  toads: Toad[];
  lastSaved: string;
}

const LS_KEY = "Game_State4";

const getWAData = () => {
  try {
    return window.Telegram.WebApp.initDataUnsafe;
  } catch (e) {
    // ignore
    return {} as any;
  }
};

export const webAppData = getWAData();
// Инициализация состояния по умолчанию
const getDefaultGameState = (): GameState => {
  return {
    user: {
      id: `user_${Date.now()}`,
      username: webAppData.user?.id
        ? `${webAppData.user?.first_name} ${webAppData.user?.last_name}`
        : `user_${Date.now()}`,
      tg_id: webAppData.user?.id || 0,
      tokens: 50,
      astro_quax: 0,
      storage: {
        food: 100,
      },
    },
    scenes: [DEFAULT_SCENE],
    toads: DEFAULT_TOADS,
    lastSaved: new Date().toISOString(),
  };
};

// Получение текущего состояния
export const getGameState = (): GameState => {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    // Если нет сохраненного состояния, создаем новое
    const defaultState = getDefaultGameState();
    localStorage.setItem(LS_KEY, JSON.stringify(defaultState));
    createLeaderbord();

    return defaultState;
  } catch (error) {
    console.error("Error loading game state:", error);
    return getDefaultGameState();
  }
};

// Сохранение всего состояния
export const saveGameState = (state: GameState): void => {
  try {
    const stateToSave = {
      ...state,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(stateToSave));
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
export const updateGameState = (updates: Partial<GameState>): GameState => {
  const currentState = getGameState();
  const newState = { ...currentState, ...updates };

  saveGameState(newState);
  return newState;
};
