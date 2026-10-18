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
import { TOADS_FED_EVENT } from "../utils/narrator";
import { getFeedCost } from "../utils/feeding";
import { pickSceneForNewToad } from "../utils/housing";
import { getToadHomeId } from "../utils/toad-location";

interface ToadContextType {
  /**
   * Все жабы колонии. «Своих» жаб экран берёт сам: гекс биопода — по `scene_id`,
   */
  allToads: Toad[];
  selectedToad: Toad | null;
  colliderState: ColliderState | ExtendedColliderState;
  selectToad: (toadId: number) => void;
  clearSelection: () => void;
  updateBreeding: (child: Toad) => void;
  startBreeding: (child: Toad) => void;
  collectChild: (slotId: number) => void;
  setSlotReady: (slotId: number) => void;
  /** Биоподы колонии: по ним гексы карты находят своих жильцов (`RoomConfig.sceneId`). */
  ownedScenes: Scene[];
  account: User;
  handleFeedToads: (toadsId: number[]) => void;
}

const ToadContext = createContext<ToadContextType | undefined>(undefined);

interface ToadProviderProps {
  children: ReactNode;
}

export const ToadProvider: React.FC<ToadProviderProps> = ({ children }) => {
  const { addNotification } = useNotifications();
  const {
    user: account,
    scenes: ownedScenes,
    toads: allToads,
  } = useGameState();

  const [selectedToadId, setSelectedToadId] = useState<number | null>(null);
  // Карточку жабы можно открыть с любого гекса: ищем выбранную жабу среди всех жаб
  const selectedToad = allToads.find((t) => t.id === selectedToadId) || null;

  // В провайдере добавляем состояние коллайдера с загрузкой из localStorage
  const [colliderState, setColliderState] =
    useState<ColliderState>(loadColliderState());

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
      colliderState.speedMultiplier,
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
          : slot,
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

    // Склада жаб больше нет: гибрид переезжает в биопод. Если места нет — колба
    // остаётся в инкубаторе, а игроку нужно построить биопод на карте колонии.
    // Ориентир — дом родителя (`homeId`): в коллайдере ребёнок рождается не у матери в биоподе.
    const scene = pickSceneForNewToad(getToadHomeId(slot.child));

    if (!scene) {
      addNotification({
        type: "danger",
        content: `Все биоподы полны: постройте «Биопод» на гексе карты — ${slot.child.name} подождёт в инкубаторе.`,
      });
      return;
    }

    createToad({ ...slot.child, scene_id: scene.id });

    addNotification({
      type: "success",
      content: `Гибрид ${slot.child.name} помещен в ${scene.name}`,
    });

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
            : s,
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
            : s,
        ),
      };
    });
  };

  const handleFeedToads = (toadsId: number[]) => {
    const fedToads = allToads.filter((toad) => toadsId.includes(toad.id));
    // Один корм на жабу (см. `getFeedCost`): автокормушка кормит сама, но корм не экономит
    const newFood = (account.storage?.food || 0) - getFeedCost(fedToads);

    if (newFood < 0) {
      addNotification({
        type: "warn",
        content: `Недостаточно корма на складе! Не хватает: ${Math.abs(
          newFood,
        )}`,
      });
      return;
    }
    updateToadStateByIds(toadsId, { hunger: 100 });
    // Головастик рождается с hunger: 0, и именно первое кормление запускает
    // его таймер роста (см. `utils/toad-growth.ts`). Уже начатый рост не сбрасываем.
    const growthStartIds = fedToads
      .filter(
        (toad) => toad.stage === "toadpole" && toad.growthStartedAt == null,
      )
      .map((toad) => toad.id);

    if (growthStartIds.length > 0) {
      updateToadsByIds(growthStartIds, { growthStartedAt: Date.now() });
    }

    updateUser({
      storage: { ...account.storage, food: newFood },
    });

    // Рассказчик первого запуска ждёт именно ручное кормление всей колонии:
    // состояние жабы обновляется здесь, поэтому событие отправляем после записи.
    window.dispatchEvent(
      new CustomEvent(TOADS_FED_EVENT, {
        detail: { toadIds: fedToads.map((toad) => toad.id) },
      }),
    );
  };

  const value: ToadContextType = {
    updateBreeding,
    handleFeedToads,
    allToads,
    setSlotReady,
    startBreeding,
    collectChild,
    selectedToad,
    selectToad,
    clearSelection,
    colliderState,
    ownedScenes,
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
