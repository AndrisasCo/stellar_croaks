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
      reward: {
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
          description:
            "Награда за освоение основ жабьей науки. Кажется, знает о вас больше, чем вы сами",
          is_off: false,
          owner: 0,
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
    },
  },
  // {
  //   id: "market-domination",
  //   title: "💼 Жабный магнат",
  //   description: "Станьте мастером торговли и экономики",
  //   color: "blue",
  //   achievements: [
  //     {
  //       id: "earn-100",
  //       icon: "💵",
  //       name: "Стартовый капитал",
  //       description: "Заработать 100 кваксов",
  //       completed: false,
  //       task: { earn: 100 },
  //     },
  //     {
  //       id: "earn-300",
  //       icon: "💴",
  //       name: "Растущий бизнес",
  //       description: "Заработать 300 кваксов",
  //       completed: false,
  //       task: { earn: 300 },
  //     },
  //     {
  //       id: "earn-1000",
  //       icon: "💶",
  //       name: "Жабный олигарх",
  //       description: "Заработать 1000 кваксов",
  //       completed: false,
  //       task: { earn: 1000 },
  //     },
  //     {
  //       id: "buy-10-toads",
  //       icon: "🐸",
  //       name: "Коллекционер",
  //       description: "Купить 10 жаб",
  //       completed: false,
  //       task: { buyToad: 1000 },
  //     },
  //     {
  //       id: "sell-10-toads",
  //       icon: "📊",
  //       name: "Опытный торговец",
  //       description: "Продать 10 жаб",
  //       completed: false,
  //     },
  //   ],
  //   groupReward: {
  //     icon: "🏆",
  //     name: "Трофей магната",
  //     description: "За освоение торговли",
  //   },
  // },
  // {
  //   id: "genetic-engineer",
  //   title: "🧬 Генный алхимик",
  //   description: "Создайте уникальных жаб с особыми характеристиками",
  //   color: "purple",
  //   achievements: [
  //     {
  //       id: "rarity-3",
  //       icon: "⭐",
  //       name: "Редкий экземпляр",
  //       description: "Вывести жабу редкостью 3+",
  //       completed: false,
  //     },
  //     {
  //       id: "rarity-10",
  //       icon: "🌟🌟",
  //       name: "Легенда галактики",
  //       description: "Вывести жабу редкостью 10+",
  //       completed: false,
  //     },
  //     {
  //       id: "size-30",
  //       icon: "🐋",
  //       name: "Гигантская квакушка",
  //       description: "Вывести жабу размером 30+",
  //       completed: false,
  //     },
  //     {
  //       id: "speed-slow",
  //       icon: "🐌",
  //       name: "Медлительный гурман",
  //       description: "Вывести жабу скоростью 0.2 и меньше",
  //       completed: false,
  //     },
  //     {
  //       id: "speed-fast",
  //       icon: "⚡",
  //       name: "Молниеносный квак",
  //       description: "Вывести жабу скоростью 1+",
  //       completed: false,
  //     },
  //     {
  //       id: "size-small",
  //       icon: "🐁",
  //       name: "Мини-квак",
  //       description: "Вывести жабу размером 8 и меньше",
  //       completed: false,
  //     },
  //   ],
  //   groupReward: {
  //     icon: "🔬",
  //     name: "Диплом генетика",
  //     description: "За мастерство в селекции",
  //   },
  // },
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
  | "first-offspring";
// | "earn-100"
// | "earn-300"
// | "earn-1000"
// | "buy-10-toads"
// | "sell-10-toads"
// | "rarity-3"
// | "rarity-10"
// | "size-30"
// | "speed-slow"
// | "speed-fast"
// | "size-small";

export type DynamicGroupId = "first-steps";
// | "market-domination"
// | "genetic-engineer";

export const completeAchivement = (id: DynamicAchievementId) => {
  const currentState = getAchievementState().completed;
  if (currentState.includes(id)) {
    return;
  }
  updateGameState({ completed: [...currentState, id] });

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

export const claimReward = (id: DynamicGroupId) => {
  const currentState = getAchievementState();
  updateGameState({ rewards: [...currentState.rewards, id] });
};

export const updateGameState = (
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
