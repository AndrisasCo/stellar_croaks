import { Toad } from "../models/Toad";
import { ColliderState } from "../models/types";

interface ColliderSlot {
  id: string;
  parent1?: Toad | null;
  parent2?: Toad | null;
  child: Toad | null;
  startTime: number | null;
  duration: number;
  isReady: boolean;
}

// Расширяем существующий ColliderState если нужно
export interface ExtendedColliderState {
  slots: ColliderSlot[];
  maxSlots: number;
  speedMultiplier: number;
}

// Ключи для localStorage
const COLLIDER_STATE_KEY = "toadColliderState";

/**
 * Занят ли инкубатор: коллайдер смешивает только одну пару за раз, пока гибрида
 * не забрали в биопод. Проверка нужна и до старта смешивания, и внутри
 * `startBreeding` — иначе при занятой колбе родители исчезнут без ребёнка.
 */
export const hasIncubatingChild = (state: {
  slots: Array<{ child: Toad | null }>;
}): boolean => state.slots.some((slot) => Boolean(slot.child));

// Начальное состояние коллайдера
export const initialColliderState: ColliderState = {
  slots: [
    {
      id: 1,
      child: null,
      startTime: null,
      duration: 0,
      isReady: false,
    },
  ],
  maxSlots: 1,
  speedMultiplier: 1,
};

export const saveColliderState = (state: ColliderState) => {
  try {
    localStorage.setItem(COLLIDER_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving collider state to localStorage:", error);
  }
};

/** Убирает состояние коллайдера при смене аккаунта. */
export const clearColliderState = (): void => {
  try {
    localStorage.removeItem(COLLIDER_STATE_KEY);
  } catch (error) {
    console.error("Error clearing collider state from localStorage:", error);
  }
};

export const loadColliderState = (): ColliderState => {
  try {
    const saved = localStorage.getItem(COLLIDER_STATE_KEY);
    return saved ? JSON.parse(saved) : initialColliderState;
  } catch (error) {
    console.error("Error loading collider state from localStorage:", error);
    return initialColliderState;
  }
};
