import { Toad } from "../models/toad";

// Интерфейс для состояния магазина
export interface AchivementsState {
  completed: string[];
  rewards: string[];
  counter: Record<string, number>;
}

export const STATE_KEY = "achivements";

export const achievementGroups = [
  {
    id: "first-steps",
    title: "🫡 Первые шаги жабовода",
    description: "Освойте базовые механики игры",
    color: "green",
    achievements: [
      {
        id: "feed-all",
        icon: "🍽️",
        name: "Шведский стол",
        description: "Покормить всех жаб одновременно",
        completed: false,
      },
      {
        id: "feed-one",
        icon: "🍎",
        name: "Завтрак для чемпиона",
        description: "Покормить одну жабу",
        completed: false,
      },
      {
        id: "buy-toad",
        icon: "🛒",
        name: "Пополнение семейства",
        description: "Купить первую жабу",
        completed: false,
      },
      {
        id: "sell-toad",
        icon: "💰",
        name: "Первая сделка",
        description: "Продать первую жабу",
        completed: false,
      },
      {
        id: "buy-enclosure",
        icon: "🏠",
        name: "Недвижимость",
        description: "Купить дополнительный вольер",
        completed: false,
      },
      {
        id: "buy-food",
        icon: "🛍️",
        name: "Запас провизии",
        description: "Купить корм в магазине",
        completed: false,
      },
      {
        id: "read-tutorial",
        icon: "📚",
        name: "Эрудит",
        description: "Прочитать обучение",
        completed: false,
      },
      {
        id: "collider-hybrid",
        icon: "⚡",
        name: "Безумный ученый",
        description: "Вывести гибрида в коллайдере",
        completed: false,
      },
      {
        id: "first-offspring",
        icon: "🥚",
        name: "Молодой родитель",
        description: "Получить первое потомство",
        completed: false,
      },
    ],
    groupReward: {
      icon: "🎖️",
      name: "Значок новичка",
      description: "За выполнение всех первых шагов",
      reward: [
        {
          type: "toad",
          content: {
            id: Math.round(Date.now() * Math.random()),
            name: "Профессор Пузырь",
            type: "tutorial_reward",
            generation: 0,
            sex: "male",
            stage: "adult",
            scene_id: null,
            created_at: new Date().toISOString(),
            parents: null,
            state: {
              hunger: 100,
            },
            pregnancy: null,
            genes: {
              colors: ["#4B0082", "#32CD32", "#FFD700"], // индиго, лайм, золотой
              pattern: "holographic",
              weight: 15,
              speed: 2.0,
              rarity: 10,
              hungerRate: 0.5,
              fertility: 1,
              personality: "energetic",
            },
          },
        },
      ],
    },
  },
  {
    id: "market-domination",
    title: "💼 Жабный магнат",
    description: "Станьте мастером торговли и экономики",
    color: "blue",
    achievements: [
      {
        id: "earn-100",
        icon: "💵",
        name: "Стартовый капитал",
        description: "Заработать 100 кваксов",
        completed: false,
        taskType: "earn",
        taskValue: 100,
      },
      {
        id: "earn-300",
        icon: "💴",
        name: "Растущий бизнес",
        description: "Заработать 1 000 кваксов",
        completed: false,
        taskType: "earn",
        taskValue: 300,
      },
      {
        id: "earn-1000",
        icon: "💶",
        name: "Жабный олигарх",
        description: "Заработать 10 000 кваксов",
        completed: false,
        taskType: "earn",
        taskValue: 10000,
      },
      {
        id: "buy-12-toads",
        icon: "🐸",
        name: "Коллекционер",
        description: "Купить 12 жаб",
        completed: false,
        taskType: "buyToad",
        taskValue: 12,
      },
    ],
    groupReward: {
      icon: "👑",
      name: "Королевский инвестор",
      description: "Награда за экономическое господство",
      reward: [
        { type: "lootbox", content: 5 },
        {
          type: "toad",
          content: {
            id: Math.round(Date.now() * Math.random()),
            name: "Барон Квак-Ротшильд",
            type: "market_reward",
            generation: 0,
            sex: "male",
            stage: "adult",
            scene_id: null,
            created_at: new Date().toISOString(),
            parents: null,
            state: {
              hunger: 100,
            },
            pregnancy: null,
            genes: {
              colors: ["#FFD700", "#C0C0C0", "#000000"], // золото, серебро, черный
              pattern: "imperial_stripes", // императорские полосы
              weight: 22.5,
              speed: 0.8,
              rarity: 25, // Легендарная редкость
              hungerRate: 0.3, // Ест мало
              fertility: 0.5,
              personality: "imperial",
            },
          },
        },
      ],
    },
  },
  {
    id: "genetic-engineer",
    title: "🧬 Генный алхимик",
    description: "Создайте уникальных жаб с особыми характеристиками",
    color: "purple",
    achievements: [
      {
        id: "rarity-3",
        icon: "⭐",
        name: "Редкий экземпляр",
        description: "Вывести жабу редкостью 12+",
        completed: false,
        task: { rarity: { min: 12 } },
      },
      {
        id: "rarity-10",
        icon: "🌟🌟",
        name: "Легенда галактики",
        description: "Вывести жабу редкостью 25+",
        completed: false,
        task: { rarity: { min: 25 } },
      },
      {
        id: "size-30",
        icon: "🐋",
        name: "Гигантская квакушка",
        description: "Вывести жабу размером 30+",
        completed: false,
        task: { weight: { min: 30 } },
      },
      {
        id: "speed-slow",
        icon: "🐌",
        name: "Медлительный гурман",
        description: "Вывести жабу скоростью 0.2 и меньше",
        completed: false,
        task: { speed: { max: 0.2 } },
      },
      {
        id: "speed-fast",
        icon: "⚡",
        name: "Молниеносный квак",
        description: "Вывести жабу скоростью 2.5+",
        completed: false,
        task: { speed: { min: 2.5 } },
      },
      {
        id: "size-small",
        icon: "🐁",
        name: "Мини-квак",
        description: "Вывести жабу размером 8 и меньше",
        completed: false,
        task: { weight: { max: 8 } },
      },
      // Новые ачивки с генетическими мутациями
      {
        id: "mutant-chaos",
        icon: "🧬",
        name: "Хаос в ДНК",
        description: "Вывести жабу с поломками ДНК 80+",
        completed: false,
        task: { geneticFault: { min: 80 } },
      },
      {
        id: "perfect-genome",
        icon: "🔬",
        name: "Совершенный геном",
        description: "Вывести жабу с генетикой 0 и поколением 10",
        completed: false,
        task: { geneticFault: { max: 10 }, generation: { min: 0 } },
      },
    ],
    groupReward: {
      icon: "🔬",
      name: "Диплом генетика",
      description: "За мастерство в селекции",
      reward: [
        {
          type: "toad",
          content: {
            id: Math.round(Date.now() * Math.random()),
            name: "Рекомбинант Идеальный",
            type: "designed_organism",
            generation: 0,
            sex: "neuter",
            stage: "adult",
            state: {
              hunger: 100,
              genetic_fault: 50, // Контролируемые мутации
            },
            genes: {
              colors: ["#00CED1", "#E6E6FA", "#F0E68C"], // бирюзовый, лавандовый, хаки
              pattern: "fractal_geometric",
              weight: 20,
              speed: 1.2,
              rarity: 20,
              hungerRate: 0.7, // Экономичный метаболизм
              fertility: 1.5,
              personality: "innovator", // Новатор
            },
          },
        },
        {
          type: "toad",
          content: {
            id: Math.round(Date.now() * Math.random()),
            name: "Симбионт Стабильный",
            type: "symbiotic_host",
            generation: 0,
            sex: "female",
            stage: "adult",
            state: {
              hunger: 100,
              genetic_fault: 65,
            },
            genes: {
              colors: ["#228B22", "#90EE90", "#006400"], // лесная зелень, светло-зеленый, темно-зеленый
              weight: 28,
              speed: 0.3, // Очень медленная из-за паразита
              rarity: 25,
              hungerRate: 1.8,
              fertility: 0,
              personality: "calm", // Спокойный
            },
          },
        },
      ],
    },
  },
];

// Динамические типы для ID
export type DynamicAchievementId =
  | "feed-all"
  | "feed-one"
  | "buy-toad"
  | "sell-toad"
  | "buy-enclosure"
  | "buy-food"
  | "read-tutorial"
  | "collider-hybrid"
  | "first-offspring"
  | "earn-100"
  | "earn-300"
  | "earn-1000"
  | "buy-10-toads"
  | "sell-10-toads"
  | "rarity-3"
  | "rarity-10"
  | "size-30"
  | "speed-slow"
  | "speed-fast"
  | "size-small";

export type DynamicGroupId =
  | "first-steps"
  | "market-domination"
  | "genetic-engineer";

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

  return initializeShop();
};

export const saveAchievementState = (state: AchivementsState) => {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
};

export const initializeShop = (): AchivementsState => {
  return {
    completed: [],
    rewards: [],
    counter: {},
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
