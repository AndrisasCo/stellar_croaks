import { Toad } from "../../models/Toad";
import { ToadTypes } from "../../models/Toad/toad-species";
import {
  achievementGroups,
  AchievementTaskType,
  DynamicAchievementId,
  DynamicGroupId,
} from "./achivements-list";

// Интерфейс для состояния Торговая Капсулаа
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
  action: AchievementTaskType,
  value: number,
) => {
  const currentState = getAchievementState();
  if (!currentState.counter) {
    currentState.counter = {};
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
        currentState.counter[action] >= (a.taskValue || 0),
    );

  achivements.forEach((achivement) => {
    completeAchivement(achivement.id);
  });
};

/**
 * Отмечает награду группы как полученную.
 *
 * @returns `true`, если награда была выдана впервые; `false` — если её уже
 * забирали. Проверка внутри функции, а не только на кнопке: быстрый двойной
 * клик и повторный вызов из другого места не должны выдать жабу/лутбоксы дважды.
 */
export const claimReward = (id: DynamicGroupId): boolean => {
  const currentState = getAchievementState();
  const rewards = currentState.rewards ?? [];

  if (rewards.includes(id)) {
    return false;
  }

  updateAchivementsState({ rewards: [...rewards, id] });

  return true;
};

export const updateAchivementsState = (
  updates: Partial<AchivementsState>,
): AchivementsState => {
  const currentState = getAchievementState();
  const newState = { ...currentState, ...updates };

  saveAchievementState(newState);
  return newState;
};

export const getAchievementState = (): AchivementsState => {
  try {
    const stored = localStorage.getItem(STATE_KEY);

    if (stored) {
      // Нормализация заодно чинит сейвы старого формата и не даёт битому JSON
      // уронить загрузку: достижения сливаются с облаком ещё до старта игры.
      return normalizeAchievementState(JSON.parse(stored));
    }
  } catch (error) {
    console.warn("[achievements] не удалось прочитать сейв:", error);
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

/** Списки достижений и наград — журналы: объединяем без дублей. */
const uniqueStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.filter((item): item is string => typeof item === "string")),
      )
    : [];

/** Счётчики только растут; нечисловой мусор из старого сейва отбрасываем. */
const numericCounters = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, number>
  >((counters, [key, count]) => {
    if (typeof count === "number" && Number.isFinite(count)) {
      counters[key] = count;
    }

    return counters;
  }, {});
};

/**
 * Приводит состояние достижений к предсказуемому виду.
 *
 * Облако и localStorage могут хранить сейв старого формата: без `counter`,
 * с `null` вместо массива или с мусором после ручной правки. Слияние не должно
 * падать из-за такого сейва — иначе вход в игру сломается на ровном месте.
 */
export const normalizeAchievementState = (value: unknown): AchivementsState => {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    completed: uniqueStrings(source.completed),
    rewards: uniqueStrings(source.rewards),
    counter: numericCounters(source.counter),
    // Незнакомые виды жаб не выбрасываем: их мог записать клиент новой версии,
    // а откат на старую не должен стирать прогресс галереи.
    toads_collection: uniqueStrings(source.toads_collection) as ToadTypes[],
  };
};

/**
 * Монотонное слияние достижений устройства и облака.
 *
 * `completed` и `rewards` — журналы: награда за группу выдаётся один раз и не
 * должна «разблокироваться» на устройстве со старым сейвом. Поэтому списки
 * объединяются, а счётчики берут максимум: прогресс не откатывается назад.
 * Обычный last-write-wins здесь опасен — офлайн-устройство с более новым
 * `lastSaved` могло бы стереть чужие забранные награды и открыть их повторно.
 */
export const mergeAchievementStates = (
  local: AchivementsState,
  cloud: unknown,
): AchivementsState => {
  const localState = normalizeAchievementState(local);
  const cloudState = normalizeAchievementState(cloud);
  const counter = { ...localState.counter };

  Object.entries(cloudState.counter).forEach(([key, value]) => {
    counter[key] = Math.max(counter[key] ?? 0, value);
  });

  return {
    completed: Array.from(
      new Set([...localState.completed, ...cloudState.completed]),
    ),
    rewards: Array.from(new Set([...localState.rewards, ...cloudState.rewards])),
    counter,
    toads_collection: Array.from(
      new Set([
        ...(localState.toads_collection ?? []),
        ...(cloudState.toads_collection ?? []),
      ]),
    ),
  };
};

/**
 * Применяет облачные достижения к локальным. Возвращает объединённое состояние,
 * которое уже записано в localStorage (его же отправит следующий cloud-flush).
 */
export const mergeCloudAchievements = (cloud: unknown): AchivementsState => {
  const merged = mergeAchievementStates(getAchievementState(), cloud);

  saveAchievementState(merged);

  return merged;
};

/** Убирает достижения с устройства при смене аккаунта. */
export const clearAchievementState = (): void => {
  localStorage.removeItem(STATE_KEY);
};

export const checkGeneticAchievements = (toad: Toad) => {
  const achievements = achievementGroups.find(
    (g) => g.id === "genetic-engineer",
  )?.achievements;

  if (!achievements) {
    return;
  }

  achievements.forEach((achievement) => {
    const conditions = achievement.task;

    // Прогрессивные/дефолтные ачивки не несут `task` — генетические проверки к ним не применимы.
    if (!conditions) {
      return;
    }

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

    if (conditions.genetic_fault) {
      if (toad.state.genetic_fault === undefined) {
        matches = false;
      } else {
        if (
          conditions.genetic_fault.min !== undefined &&
          toad.state.genetic_fault < conditions.genetic_fault.min
        ) {
          matches = false;
        }
        if (
          conditions.genetic_fault.max !== undefined &&
          toad.state.genetic_fault > conditions.genetic_fault.max
        ) {
          matches = false;
        }
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
