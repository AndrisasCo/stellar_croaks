import { Toad } from "../../models/toad";
import { ToadTypes } from "../../models/Toad/toad-species";
import {
  achievementGroups,
  DynamicAchievementId,
  DynamicGroupId,
} from "./achivements-list";

// Интерфейс для состояния магазина
export interface AchivementsState {
  completed: string[];
  rewards: string[];
  counter: Record<string, number>;
  toads_collection?: ToadTypes[];
}

export const STATE_KEY = "achivements";

export const completeAchivement = (id: DynamicAchievementId) => {
  const currentState = getAchievementState().completed;
  if (currentState.includes(id)) {
    return;
  }
  updateAchivementsState({ completed: [...currentState, id] });

  const achivement = achievementGroups
    .flatMap((a) => a.achievements)
    .find((a) => a.id === id);

  const event = new CustomEvent("AchivementCompleted", {
    detail: {
      timestamp: Date.now(),
      name: achivement?.name + " " + achivement?.icon,
    },
  });

  // Отправляем событие
  window.dispatchEvent(event);
};

export const completeAchivementCounter = (
  action: "earn" | "buyToad",
  value: number
) => {
  achievementGroups;
  const currentState = getAchievementState();
  if (!currentState.counter) {
    currentState.counter = {};
    return;
  }

  currentState.counter[action] = currentState.counter[action]
    ? currentState.counter[action] + value
    : value;

  updateAchivementsState({ counter: { ...currentState.counter } });

  const achivements = achievementGroups
    .flatMap((a) => a.achievements)
    .filter((a) => a.taskType === action)
    .filter(
      (a) =>
        currentState.counter[action] &&
        currentState.counter[action] >= (a.taskValue || 0)
    );

  achivements.forEach((achivement) => {
    completeAchivement(achivement.id as DynamicAchievementId);
  });
};

export const claimReward = (id: DynamicGroupId) => {
  const currentState = getAchievementState();
  updateAchivementsState({ rewards: [...currentState.rewards, id] });
};

export const updateAchivementsState = (
  updates: Partial<AchivementsState>
): AchivementsState => {
  const currentState = getAchievementState();
  const newState = { ...currentState, ...updates };

  saveAchievementState(newState);
  return newState;
};

export const getAchievementState = (): AchivementsState => {
  const stored = localStorage.getItem(STATE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  return initializeAchivements();
};

export const saveAchievementState = (state: AchivementsState) => {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
};

export const initializeAchivements = (): AchivementsState => {
  return {
    completed: [],
    rewards: [],
    counter: {},
    toads_collection: [],
  };
};

export const checkGeneticAchievements = (toad: Toad) => {
  const achievements = achievementGroups.find(
    (g) => g.id === "genetic-engineer"
  )?.achievements;

  if (!achievements) {
    return;
  }

  achievements.forEach((achievement) => {
    const conditions = achievement.task;
    let matches = true;

    // Проверяем каждое условие
    if (conditions.rarity) {
      if (
        conditions.rarity.min !== undefined &&
        toad.genes.rarity < conditions.rarity.min
      ) {
        matches = false;
      }
      if (
        conditions.rarity.max !== undefined &&
        toad.genes.rarity > conditions.rarity.max
      ) {
        matches = false;
      }
    }

    if (conditions.weight) {
      if (
        conditions.weight.min !== undefined &&
        toad.genes.weight < conditions.weight.min
      ) {
        matches = false;
      }
      if (
        conditions.weight.max !== undefined &&
        toad.genes.weight > conditions.weight.max
      ) {
        matches = false;
      }
    }

    if (conditions.speed) {
      if (
        conditions.speed.min !== undefined &&
        toad.genes.speed < conditions.speed.min
      ) {
        matches = false;
      }
      if (
        conditions.speed.max !== undefined &&
        toad.genes.speed > conditions.speed.max
      ) {
        matches = false;
      }
    }

    if (conditions.geneticFault && toad.state.genetic_fault !== undefined) {
      if (
        conditions.geneticFault.min !== undefined &&
        toad.state.genetic_fault < conditions.geneticFault.min
      ) {
        matches = false;
      }
      if (
        conditions.geneticFault.max !== undefined &&
        toad.state.genetic_fault > conditions.geneticFault.max
      ) {
        matches = false;
      }
    }

    if (conditions.generation) {
      if (
        conditions.generation.min !== undefined &&
        toad.generation < conditions.generation.min
      ) {
        matches = false;
      }
      if (
        conditions.generation.max !== undefined &&
        toad.generation > conditions.generation.max
      ) {
        matches = false;
      }
    }

    // Если все условия выполнены, добавляем ачивку
    if (matches) {
      completeAchivement(achievement.id);
    }
  });
};

export const addToadToCollection = (toadType: ToadTypes) => {
  const toads_collection = getAchievementState().toads_collection || [];
  if (
    toads_collection.includes(toadType) ||
    !Object.values(ToadTypes).includes(toadType)
  ) {
    return;
  }

  updateAchivementsState({ toads_collection: [...toads_collection, toadType] });
};
