import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Toad } from "../models/toad";
import { calculateBreedingTime } from "../utils/calculate-genetics";
import { ColliderState } from "../models/types";
import { Scene } from "../models/scene";
import {
  createToad,
  updateToadById,
  updateToadsByIds,
  updateUser,
} from "../backend";
import { useGameState } from "../hooks/use-game-state";
import { User } from "../models/user";
import { useNotifications } from "../hooks/use-notification";

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
interface ExtendedColliderState {
  slots: ColliderSlot[];
  maxSlots: number;
  speedMultiplier: number;
}

interface ToadContextType {
  toads: Toad[];
  allToads: Toad[];
  selectedToad: Toad | null;
  colliderState: ColliderState | ExtendedColliderState;
  selectToad: (toadId: number) => void;
  updateToad: (id: number, updates: Partial<Toad>) => void;
  clearSelection: () => void;
  startBreeding: (child: Toad) => void;
  collectChild: (slotId: number) => void;
  setSlotReady: (slotId: number) => void; // Исправлен тип на string
  setCurrentSceneId: (id: number) => void;
  currentScene: Scene;
  ownedScenes: Scene[];
  currentSceneIndex: number;
  account: User;
  handleFeedToads: (toadsId: number[]) => void; // Добавлен отсутствующий метод
}

const ToadContext = createContext<ToadContextType | undefined>(undefined);

interface ToadProviderProps {
  children: ReactNode;
}

// Ключи для localStorage
const COLLIDER_STATE_KEY = "toadColliderState";

// Функции для работы с localStorage
const saveColliderState = (state: ColliderState) => {
  try {
    localStorage.setItem(COLLIDER_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving collider state to localStorage:", error);
  }
};

const loadColliderState = (): ColliderState | null => {
  try {
    const saved = localStorage.getItem(COLLIDER_STATE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Error loading collider state from localStorage:", error);
    return null;
  }
};

// Начальное состояние коллайдера
const initialColliderState: ColliderState = {
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

export const ToadProvider: React.FC<ToadProviderProps> = ({ children }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const { addNotification } = useNotifications();
  const {
    user: account,
    scenes: ownedScenes,
    toads: allToadsRaw,
  } = useGameState();

  const allToads = allToadsRaw.filter((t) => !t.is_off);

  const currentScene = ownedScenes[currentSceneIndex];

  const toads =
    currentScene && allToads
      ? allToads
          .sort((a, b) => b.genes.rarity - a.genes.rarity)
          .filter((t) => t.scene_id === currentScene.id)
      : [];

  const [selectedToadId, setSelectedToadId] = useState<number | null>(null);
  const selectedToad = toads.find((t) => t.id === selectedToadId) || null;

  // В провайдере добавляем состояние коллайдера с загрузкой из localStorage
  const [colliderState, setColliderState] = useState<ColliderState>(() => {
    const savedState = loadColliderState();
    return savedState || initialColliderState;
  });

  // Сохраняем состояние коллайдера в localStorage при изменении
  useEffect(() => {
    saveColliderState(colliderState);
  }, [colliderState]);

  const startBreeding = (child: Toad) => {
    const duration = calculateBreedingTime(
      child.genes.rarity,
      colliderState.speedMultiplier
    );
    setColliderState((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) =>
        slot.child === null
          ? {
              ...slot,
              child,
              startTime: Date.now(),
              duration,
              isReady: false,
            }
          : slot
      ),
    }));
  };

  const selectToad = (toadId: number) => {
    setSelectedToadId(toadId);
  };

  const updateToad = async (id: number, updates: Partial<Toad>) => {
    updateToadById(id, updates);

    if (selectedToadId?.id === id) {
      setSelectedToadId((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const clearSelection = () => {
    setSelectedToadId(null);
  };

  const collectChild = (slotId: number) => {
    setColliderState((prev) => {
      const slot = prev.slots.find((s) => s.id === slotId);

      if (slot?.child) {
        const allToadsOnScene = toads.length + 1;

        if (currentScene.capacity < allToadsOnScene) {
          slot.child.scene_id = null;
          addNotification({
            type: "warn",
            content: "Превышена вместимость вольера, гибрид помещен на склад.",
          });
        }

        createToad(slot.child);
      }

      return {
        ...prev,
        slots: prev.slots.map((s) =>
          s.id === slotId
            ? {
                id: s.id,
                parent1: null,
                parent2: null,
                child: null,
                startTime: null,
                duration: 0,
                isReady: false,
              }
            : s
        ),
      };
    });
  };

  const setSlotReady = (slotId: number) => {
    setColliderState((prev) => {
      return {
        ...prev,
        slots: prev.slots.map((s) =>
          s.id === slotId
            ? {
                ...s,
                isReady: true,
              }
            : s
        ),
      };
    });
  };

  const handleFeedToads = async (toadsId: number[]) => {
    const newFood = (account.storage?.food || 0) - toadsId.length;
    if (newFood < 0) {
      addNotification({
        type: "warn",
        content: "Недостаточно корма на складе!",
      });
      return;
    }
    updateToadsByIds(toadsId, { state: { hunger: 100 } });
    updateUser({
      storage: { food: newFood },
    });
  };

  const value: ToadContextType = {
    handleFeedToads,
    setCurrentSceneId: setCurrentSceneIndex,
    currentScene,
    toads,
    allToads,
    setSlotReady,
    startBreeding,
    collectChild,
    selectedToad,
    selectToad,
    updateToad,
    clearSelection,
    colliderState,
    ownedScenes,
    currentSceneIndex,
    account,
  };

  return <ToadContext.Provider value={value}>{children}</ToadContext.Provider>;
};

// Хук для использования контекста
export const useToads = () => {
  const context = useContext(ToadContext);
  if (context === undefined) {
    throw new Error("useToads must be used within a ToadProvider");
  }
  return context;
};
