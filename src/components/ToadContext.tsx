import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Toad } from "../models/Toad";
import { calculateBreedingTime } from "../utils/calculate-genetics";
import { ColliderState } from "../models/types";
import { Scene } from "../models/scene";
import {
  createToad,
  updateToadsByIds,
  updateToadStateByIds,
  updateUser,
} from "../backend";
import { useGameState } from "../hooks/use-game-state";
import { User } from "../models/user";
import { useNotifications } from "../hooks/use-notification";
import {
  ExtendedColliderState,
  loadColliderState,
  saveColliderState,
} from "../backend/collider-manager";
import { MAX_STORED_TOADS } from "../utils/constants";

interface ToadContextType {
  toads: Toad[];
  allToads: Toad[];
  selectedToad: Toad | null;
  colliderState: ColliderState | ExtendedColliderState;
  selectToad: (toadId: number) => void;
  clearSelection: () => void;
  updateBreeding: (child: Toad) => void;
  startBreeding: (child: Toad) => void;
  collectChild: (slotId: number) => void;
  setSlotReady: (slotId: number) => void;
  setCurrentSceneId: (id: number) => void;
  currentScene: Scene;
  ownedScenes: Scene[];
  currentSceneIndex: number;
  account: User;
  handleFeedToads: (toadsId: number[]) => void;
}

const ToadContext = createContext<ToadContextType | undefined>(undefined);

interface ToadProviderProps {
  children: ReactNode;
}

export const ToadProvider: React.FC<ToadProviderProps> = ({ children }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const { addNotification } = useNotifications();
  const {
    user: account,
    scenes: ownedScenes,
    toads: allToads,
  } = useGameState();

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
  const [colliderState, setColliderState] = useState<ColliderState>(
    loadColliderState()
  );

  // Сохраняем состояние коллайдера в localStorage при изменении
  useEffect(() => {
    console.log("colliderChanged");

    const updateCollider = () => setColliderState(loadColliderState());

    window.addEventListener("colliderChanged", updateCollider);

    saveColliderState(colliderState);

    return () => {
      window.removeEventListener("colliderChanged", updateCollider);
    };
  }, [JSON.stringify(colliderState)]);

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

  const updateBreeding = (child: Toad) => {
    const slots = [...colliderState.slots];

    const currentSlotIndex = slots.findIndex((s) => s.child?.id === child.id);

    if (currentSlotIndex === -1) {
      return;
    }

    slots[currentSlotIndex] = { ...slots[currentSlotIndex], child };

    setColliderState((prev) => ({
      ...prev,
      slots,
    }));
  };

  const selectToad = (toadId: number) => {
    setSelectedToadId(toadId);
  };

  const clearSelection = () => {
    setSelectedToadId(null);
  };

  const collectChild = (slotId: number) => {
    const slot = colliderState.slots.find((s) => s.id === slotId);

    if (!slot?.child) {
      return;
    }

    const currentSceneIdToCollect = slot?.child.scene_id;
    const currentSceneToCollect = ownedScenes.find(
      (s) => s.id === currentSceneIdToCollect
    );

    const allToadsAtStorage =
      allToads.filter((t) => t.scene_id === null).length + 1;

    const allToadsOnScene =
      allToads.filter((t) => t.scene_id === currentSceneIdToCollect).length + 1;

    if (
      !currentSceneToCollect ||
      currentSceneToCollect.capacity < allToadsOnScene
    ) {
      if (allToadsAtStorage > MAX_STORED_TOADS) {
        addNotification({
          type: "danger",
          content: `Все хранилища переполнены`,
        });
        return;
      }

      addNotification({
        type: "warn",
        content: `Превышена вместимость вольера, гибрид ${slot.child.name} помещен на склад.`,
      });
      createToad({ ...slot.child, scene_id: null });
    } else {
      createToad(slot.child);

      addNotification({
        type: "success",
        content: `Гибрид ${slot.child.name} помещен в ${currentSceneToCollect?.name}`,
      });
    }

    setColliderState((prev) => {
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
        content: `Недостаточно корма на складе! Не хватает: ${Math.abs(
          newFood
        )}`,
      });
      return;
    }
    updateToadStateByIds(toadsId, { hunger: 100 });
    updateUser({
      storage: { ...account.storage, food: newFood },
    });
  };

  const value: ToadContextType = {
    updateBreeding,
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
