import { Toad } from "../../models/Toad";
import { ToadTypes } from "../../models/Toad/toad-species";

/** Тип прогрессивного счётчика достижения (см. `completeAchivementCounter`). */
export type AchievementTaskType =
  | "earn"
  | "buyToad"
  | "lootbox"
  | "dissolve"
  | "expedition";

/** Условия «генетического» достижения (проверяются в `checkGeneticAchievements`). */
export interface AchievementTaskConditions {
  rarity?: { min?: number; max?: number };
  weight?: { min?: number; max?: number };
  speed?: { min?: number; max?: number };
  genetic_fault?: { min?: number; max?: number };
  generation?: { min?: number; max?: number };
}

/** Награда достижения: жаба (объект для `createToad`) или число (например, лутбоксы). */
export interface AchievementReward {
  type: "toad" | "lootbox";
  content: Partial<Toad> | number;
}

/** Групповая награда за выполнение всех достижений группы. */
export interface AchievementGroupReward {
  icon: string;
  name: string;
  description: string;
  reward: AchievementReward[];
}

/**
 * Достижение внутри группы.
 *
 * `completed` оставлен для обратной совместимости и в UI не используется:
 * реальный прогресс хранится в `AchivementsState.completed`. Поэтому поле опционально.
 */
export interface Achievement {
  id: DynamicAchievementId;
  icon: string;
  name: string;
  description: string;
  completed?: boolean;
  /** Для прогрессивных достижений: тип счётчика и целевое значение. */
  taskType?: AchievementTaskType;
  taskValue?: number;
  /** Для генетических достижений: пороги характеристик жабы. */
  task?: AchievementTaskConditions;
}

/** Группа достижений с общей наградой. */
export interface AchievementGroup {
  id: DynamicGroupId;
  title: string;
  description: string;
  color: string;
  achievements: Achievement[];
  groupReward?: AchievementGroupReward;
}

export const achievementGroups: AchievementGroup[] = [
  {
    id: "first-steps2",
    title: "🫡 Первые шаги жабовода",
    description: "Освойте базовые механики игры",
    color: "green",
    achievements: [
      // {
      //   id: "feed-all",
      //   icon: "🍽️",
      //   name: "Шведский стол",
      //   description: "Покормить всех жаб одновременно",
      //   completed: false,
      // },
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
        description: "Купить дополнительный биопод",
        completed: false,
      },
      {
        id: "buy-food",
        icon: "🛍️",
        name: "Запас провизии",
        description: "Купить корм в Торговой капсуле",
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
            type: ToadTypes.turtle,
            generation: 0,
            sex: "male",
            stage: "adult",
            scene_id: 1,
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
              speed: 0.3,
              rarity: 5,
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
    id: "market-domination2",
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
        description: "Заработать 300 кваксов",
        completed: false,
        taskType: "earn",
        taskValue: 300,
      },
      {
        id: "earn-1000",
        icon: "💶",
        name: "Жабный олигарх",
        description: "Заработать 1 000 кваксов",
        completed: false,
        taskType: "earn",
        taskValue: 1000,
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
            type: ToadTypes.topaz,
            generation: 0,
            sex: "male",
            stage: "adult",
            scene_id: 1,
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
              rarity: 5, // Легендарная редкость
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
        task: { genetic_fault: { min: 80 } },
      },
      {
        id: "perfect-genome",
        icon: "🔬",
        name: "Совершенный геном",
        description: "Вывести жабу с генетикой 0 и поколением 10",
        completed: false,
        task: { genetic_fault: { max: 0.9 }, generation: { min: 10 } },
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
            type: ToadTypes.mutantNeonBlue,
            generation: 0,
            sex: "neuter",
            stage: "adult",
            scene_id: 1,
            created_at: new Date().toISOString(),
            parents: null,
            pregnancy: null,
            state: {
              hunger: 100,
              genetic_fault: 50, // Контролируемые мутации
            },
            genes: {
              colors: ["#00CED1", "#E6E6FA", "#F0E68C"], // бирюзовый, лавандовый, хаки
              pattern: "fractal_geometric",
              weight: 20,
              speed: 1.2,
              rarity: 5,
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
            type: ToadTypes.forest,
            generation: 0,
            sex: "female",
            stage: "adult",
            scene_id: 1,
            created_at: new Date().toISOString(),
            parents: null,
            pregnancy: null,
            state: {
              hunger: 100,
              genetic_fault: 65,
            },
            genes: {
              colors: ["#228B22", "#90EE90", "#006400"], // лесная зелень, светло-зеленый, темно-зеленый
              pattern: "stripes",
              weight: 28,
              speed: 0.3, // Очень медленная из-за паразита
              rarity: 5,
              hungerRate: 1.8,
              fertility: 0,
              personality: "calm", // Спокойный
            },
          },
        },
      ],
    },
  },
  {
    id: "biocampus-farm",
    title: "🏭 Хозяин биокупола",
    description: "Освойте ферму, Репродуктор и Диссоциатор лаборатории",
    color: "purple",
    achievements: [
      {
        id: "first-manual-breed",
        icon: "🥚",
        name: "Репродуктор в деле",
        description: "Запустить первое размножение вручную в «Репродукторе»",
        completed: false,
      },
      {
        id: "biomass-100",
        icon: "🧪",
        name: "Биофабрика",
        description: "Накопить 100 биомассы на ферме",
        completed: false,
      },
      {
        id: "quarantine-cure",
        icon: "🛡️",
        name: "Санитарный день",
        description: "Провести карантин и вылечить заражённых жаб",
        completed: false,
      },
      {
        id: "first-dissolve",
        icon: "♻️",
        name: "Первый разбор",
        description: "Переработать жабу в биомассу в «Диссоциаторе»",
        completed: false,
      },
      {
        id: "dissolve-10",
        icon: "⚗️",
        name: "Биоконвейер",
        description: "Переработать 10 жаб в биомассу",
        taskType: "dissolve",
        taskValue: 10,
      },
    ],
    groupReward: {
      icon: "🏭",
      name: "Биокуратор Квак",
      description: "Награда за освоение фермы и Диссоциатора",
      reward: [
        { type: "lootbox", content: 3 },
        {
          type: "toad",
          content: {
            id: Math.round(Date.now() * Math.random()),
            name: "Биокуратор Квак",
            type: ToadTypes.crystall,
            generation: 0,
            sex: "female",
            stage: "adult",
            scene_id: 1,
            created_at: new Date().toISOString(),
            parents: null,
            pregnancy: null,
            state: {
              hunger: 100,
              genetic_fault: 0, // Чистый геном фермера
            },
            genes: {
              colors: ["#7FFF00", "#00CED1", "#2E8B57"], // лайм, бирюзовый, морской
              pattern: "holographic",
              weight: 24,
              speed: 1.1,
              rarity: 5,
              hungerRate: 0.6, // Экономная в содержании
              fertility: 1.4,
              personality: "workaholic", // Трудоголик
            },
          },
        },
      ],
    },
  },
  {
    id: "lootbox-champion",
    title: "Искатель сокровищ",
    description: "Откройте 100 лутбоксов и станьте мастером удачи",
    color: "yellow",
    achievements: [
      {
        id: "open-100-lootboxes",
        icon: "🎁",
        name: "Открытие лутбоксов",
        description: "Проверьте ваше везение",
        taskType: "lootbox",
        taskValue: 100,
      },
    ],
    groupReward: {
      icon: "💍",
      name: "Кольцо удачи",
      description: "Какой же камень украсит это кольцо?",
      reward: [
        {
          type: "toad",
          content: {
            id: Math.round(Date.now() * Math.random()),
            name: "Брилиантовый везунчик",
            type: ToadTypes.diamond,
            generation: 0,
            sex: "female",
            stage: "adult",
            scene_id: 1,
            created_at: new Date().toISOString(),
            parents: null,
            state: {
              hunger: 100,
            },
            pregnancy: null,
            genes: {
              colors: ["#4B0082"],
              pattern: "holographic",
              weight: 18,
              speed: 1,
              rarity: 5,
              hungerRate: 1,
              fertility: 0.5,
              personality: "lucky",
            },
          },
        },
        { type: "lootbox", content: 11 },
      ],
    },
  },
  {
    id: "perimeter-scouts",
    title: "🧭 Разведчики Периметра",
    description:
      "Собирайте команды жаб, ходите в походы и тащите домой чужое добро",
    color: "blue",
    achievements: [
      {
        id: "first-expedition",
        icon: "🎒",
        name: "Первый рейд",
        description: "Отправить команду жаб в поход за Периметр",
        completed: false,
      },
      {
        id: "expedition-10",
        icon: "🚁",
        name: "Полевой отряд",
        description: "Завершить 10 походов",
        taskType: "expedition",
        taskValue: 10,
      },
      {
        id: "expedition-50",
        icon: "🗺️",
        name: "Хозяин Периметра",
        description: "Завершить 50 походов",
        taskType: "expedition",
        taskValue: 50,
      },
      {
        id: "sector-depth-3",
        icon: "🏚️",
        name: "Станция «Периметр-3»",
        description: "Вернуться из сектора глубины 3 или глубже",
        completed: false,
      },
      {
        id: "sector-depth-6",
        icon: "☢️",
        name: "Реактор «Квак-7»",
        description: "Вернуться живыми из сектора глубины 6 или глубже",
        completed: false,
      },
    ],
    groupReward: {
      icon: "🧭",
      name: "Проводник Периметра",
      description: "Награда за освоение дальних секторов",
      reward: [
        { type: "lootbox", content: 3 },
        {
          type: "toad",
          content: {
            id: Math.round(Date.now() * Math.random()),
            name: "Проводник Периметра",
            type: ToadTypes.forest,
            generation: 0,
            sex: "female",
            stage: "adult",
            scene_id: 1,
            created_at: new Date().toISOString(),
            parents: null,
            pregnancy: null,
            state: {
              hunger: 100,
              genetic_fault: 0,
            },
            genes: {
              colors: ["#556B2F", "#2E8B57", "#8FBC8F"],
              pattern: "striped",
              weight: 26,
              speed: 1.45,
              rarity: 6,
              hungerRate: 0.7,
              fertility: 1.6,
              personality: "adventurer",
            },
          },
        },
      ],
    },
  },
];

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
  | "buy-12-toads"
  | "rarity-3"
  | "rarity-10"
  | "size-30"
  | "speed-slow"
  | "speed-fast"
  | "size-small"
  | "mutant-chaos"
  | "perfect-genome"
  | "first-manual-breed"
  | "biomass-100"
  | "quarantine-cure"
  | "first-dissolve"
  | "dissolve-10"
  | "open-100-lootboxes"
  | "first-expedition"
  | "expedition-10"
  | "expedition-50"
  | "sector-depth-3"
  | "sector-depth-6";

export type DynamicGroupId =
  | "first-steps2"
  | "market-domination2"
  | "genetic-engineer"
  | "biocampus-farm"
  | "lootbox-champion"
  | "perimeter-scouts";
