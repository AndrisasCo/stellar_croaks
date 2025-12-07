import { Toad, ToadTypes } from "../models/toad";
import { randomizeToadCharacteristics } from "../utils/randomize-toad-characteristics";

// Интерфейс для состояния магазина
export interface ShopState {
  availableToads: Partial<Toad>[];
  lastRefresh: number; // timestamp последнего обновления
  nextRefresh: number; // timestamp следующего обновления
  lastRefreshElite: number; // timestamp последнего обновления
  nextRefreshElite: number; // timestamp следующего обновления
  eliteOrders: string[];
  items: Record<string, number>;
}

// Список всех возможных жаб для магазина
export const ALL_TOADS: Partial<Toad>[] = [
  {
    name: "Зеленая жаба",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 30,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#6B8C42"],
      pattern: "smooth",
      weight: 18,
      speed: 0.4,
      rarity: 1.0,
      hungerRate: 1.0,
      fertility: 1.0,
      personality: null,
    },
  },
  {
    name: "Коричневая жаба",
    type: "common",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 25,
    },
    pregnancy: null,
    genes: {
      colors: ["#8B4513", "#A0522D"],
      pattern: "smooth",
      weight: 15,
      speed: 0.35,
      rarity: 1.1,
      hungerRate: 0.9,
      fertility: 1.2,
      personality: null,
    },
  },
  {
    name: "Пятнистая жаба",
    type: ToadTypes.camouflage,
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 35,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#4A4A4A"],
      pattern: "spotted",
      weight: 17,
      speed: 0.45,
      rarity: 1.2,
      hungerRate: 1.1,
      fertility: 1.3,
      personality: null,
    },
  },
  {
    name: "Пятнистая жаба",
    type: ToadTypes.camouflage,
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 35,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#4A4A4A"],
      pattern: "spotted",
      weight: 17,
      speed: 0.45,
      rarity: 1.2,
      hungerRate: 1.1,
      fertility: 1.3,
      personality: null,
    },
  },
  {
    name: "Лесная жаба",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "toadpole",
    scene_id: null,
    state: {
      hunger: 28,
    },
    pregnancy: null,
    genes: {
      colors: ["#4A7C59", "#5D8C42"],
      pattern: "smooth",
      weight: 20,
      speed: 0.38,
      rarity: 1.05,
      hungerRate: 0.8,
      fertility: 1.1,
      personality: null,
    },
  },
  {
    name: "Болотная жаба",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "toadpole",
    scene_id: null,
    state: {
      hunger: 32,
    },
    pregnancy: null,
    genes: {
      colors: ["#6B8C59", "#4A7C42"],
      pattern: "smooth",
      weight: 11,
      speed: 0.42,
      rarity: 1.08,
      hungerRate: 1.2,
      fertility: 0.9,
      personality: null,
    },
  },
  {
    name: "Золотая жаба",
    type: "rare",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 20,
    },
    pregnancy: null,
    genes: {
      colors: ["#FFD700", "#FFEC8B"],
      pattern: "smooth",
      weight: 12,
      speed: 0.5,
      rarity: 2.0,
      hungerRate: 0.7,
      fertility: 1.5,
      personality: null,
    },
  },
  {
    name: "Хрустальная жаба",
    type: "epic",
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 15,
    },
    pregnancy: null,
    genes: {
      colors: ["#E6E6FA", "#F0F8FF"],
      pattern: "crystalline",
      weight: 10,
      speed: 0.6,
      rarity: 3.0,
      hungerRate: 0.5,
      fertility: 2.0,
      personality: null,
    },
  },
];

// Ключ для localStorage
export const SHOP_STATE_KEY = "toad_shop_state7";
export const REFRESH_COOLDOWN = 3 * 60 * 60 * 1000; // 3 часа в миллисекундах
export const INSTANT_REFRESH_COST = 20; // Стоимость мгновенного обновления
export const INSTANT_REFRESH_ELITE_COST = 50; // Стоимость мгновенного обновления

// Функции для работы с localStorage
export const getShopState = (): ShopState => {
  const stored = localStorage.getItem(SHOP_STATE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  // Инициализация нового состояния магазина
  return initializeShop();
};

export const saveShopState = (state: ShopState) => {
  localStorage.setItem(SHOP_STATE_KEY, JSON.stringify(state));
};
export const initialItemsAmount = {
  lootbox: 1,
  battery: 2,
  food: 5,
  worms: 10,
  sparkleFlys: 10,
};
// Инициализация магазина со случайным набором жаб
export const initializeShop = (): ShopState => {
  const now = Date.now();

  return {
    availableToads: getNewToads(),
    lastRefresh: now - REFRESH_COOLDOWN,
    nextRefresh: now,
    lastRefreshElite: now - REFRESH_COOLDOWN * 8,
    nextRefreshElite: now,
    eliteOrders: getNewElite(),
    items: { ...initialItemsAmount },
  };
};

export const getNewToads = () => {
  const shuffled = [...ALL_TOADS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((toad) => ({
    ...randomizeToadCharacteristics(toad, 0.1),
    id: Math.round(Math.random() * Date.now()),
  }));
};

export const getNewElite = () => {
  const shuffled = [...eliteOrders].sort(() => Math.random() - 0.5);
  return shuffled.map((e) => e.id).slice(0, 3);
};

const BASE_PRICE = 3; // Базовая стоимость = 5 токенов

export const eliteOrders = [
  {
    id: "elite_1",
    title: "Нежный гигант",
    description: "Жаба размером более 35 с характером Романтик",
    requirement: (toad: Toad) =>
      toad.genes.weight > 35 && toad.genes.personality === "romantic",
    reward: BASE_PRICE * 18, // 90 токенов (очень редкое сочетание)
    difficulty: "extreme",
  },
  {
    id: "elite_2",
    title: "Поэт болотных глубин",
    description: "Жаба с характером Мечтатель",
    requirement: (toad: Toad) => toad.genes.personality === "dreamer",
    reward: BASE_PRICE * 4, // 20 токенов (редкий характер)
    difficulty: "medium",
  },
  {
    id: "elite_3",
    title: "Загадка бездны",
    description: "Жаба с полом Бесполый",
    requirement: (toad: Toad) => toad.sex === "neuter",
    reward: BASE_PRICE * 5, // 25 токенов
    difficulty: "extreme",
  },
  {
    id: "elite_4",
    title: "Вихрь судьбы",
    description: "Жаба со скоростью более 2",
    requirement: (toad: Toad) => toad.genes.speed > 2,
    reward: BASE_PRICE * 14, // 70 токенов (очень редкий)
    difficulty: "hard",
  },
  {
    id: "elite_5",
    title: "Исполин рассвета",
    description: "Жаба редкостью 7 и больше размером более 40",
    requirement: (toad: Toad) =>
      toad.genes.weight > 40 && toad.genes.rarity >= 7,
    reward: BASE_PRICE * 32, // 160 токенов (почти невозможно)
    difficulty: "extreme",
  },
  {
    id: "elite_6",
    title: "Вечный странник",
    description: "Жаба с полом Бесполый и редкостью 7+",
    requirement: (toad: Toad) =>
      toad.sex === "neuter" && toad.genes.rarity >= 7,
    reward: BASE_PRICE * 8, // 40 токенов
    difficulty: "extreme",
  },
  {
    id: "elite_7",
    title: "Безумный гений",
    description: "Жаба с характером Новатор или Энергичный и редкостью 6+",
    requirement: (toad: Toad) =>
      (toad.genes.personality === "innovator" ||
        toad.genes.personality === "energetic") &&
      toad.genes.rarity >= 6,
    reward: BASE_PRICE * 13, // 65 токенов (сложное сочетание)
    difficulty: "hard",
  },
  {
    id: "elite_8",
    title: "Идеальный баланс",
    description: "Жаба с размером 12-16, скоростью 0.6-0.8 и фертильностью 3+",
    requirement: (toad: Toad) =>
      toad.genes.weight >= 12 &&
      toad.genes.weight <= 16 &&
      toad.genes.speed >= 0.6 &&
      toad.genes.speed <= 0.8 &&
      toad.genes.fertility >= 3,
    reward: BASE_PRICE * 11, // 55 токенов (сбалансированная сложность)
    difficulty: "medium",
  },
  {
    id: "elite_9",
    title: "Наследник легенд",
    description: "Головастик 8+ поколения с редкостью 6+",
    requirement: (toad: Toad) =>
      toad.stage === "toadpole" &&
      toad.generation >= 8 &&
      toad.genes.rarity >= 6,
    reward: BASE_PRICE * 15, // 75 токенов (сложный для головастика)
    difficulty: "hard",
  },
  {
    id: "elite_10",
    title: "Ненасытный титан",
    description: "Жаба с характером Обжора и размером более 25",
    requirement: (toad: Toad) =>
      toad.genes.personality === "glutton" && toad.genes.weight > 25,
    reward: BASE_PRICE * 9, // 45 токенов (редкое сочетание)
    difficulty: "medium",
  },
  {
    id: "elite_11",
    title: "Вечный карнавал",
    description: "Жаба 10+ поколения с характером Тусовщик",
    requirement: (toad: Toad) =>
      toad.generation >= 10 && toad.genes.personality === "partyAnimal",
    reward: BASE_PRICE * 14, // 70 токенов (очень редкий)
    difficulty: "hard",
  },
  {
    id: "elite_12",
    title: "Аскеза желаний",
    description: "Жаба с характером Аскет и фертильностью более 3",
    requirement: (toad: Toad) =>
      toad.genes.personality === "ascetic" && toad.genes.fertility > 3,
    reward: BASE_PRICE * 17, // 85 токенов (парадоксальное сочетание)
    difficulty: "hard",
  },
  {
    id: "elite_13",
    title: "Повелитель иллюзий",
    description: "Жаба с характером Лидер и редкостью 5+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "leader" && toad.genes.rarity >= 5,
    reward: BASE_PRICE * 12, // 60 токенов (сложное сочетание)
    difficulty: "medium",
  },
  {
    id: "elite_14",
    title: "Мыслитель в движении",
    description: "Жаба с характером Философ и скоростью менее 0.5",
    requirement: (toad: Toad) =>
      toad.genes.personality === "philosopher" && toad.genes.speed < 0.5,
    reward: BASE_PRICE * 8, // 40 токенов (средняя сложность)
    difficulty: "medium",
  },
  {
    id: "elite_15",
    title: "Одержимость плотью",
    description: "Жаба с характером Страстный и фертильностью более 4",
    requirement: (toad: Toad) =>
      toad.genes.personality === "passionate" && toad.genes.fertility > 4,
    reward: BASE_PRICE * 19, // 95 токенов (очень редкое)
    difficulty: "hard",
  },
  {
    id: "elite_16",
    title: "Болотная дива",
    description: "Самка с характером Светская жаба и редкостью 6+",
    requirement: (toad: Toad) =>
      toad.sex === "female" &&
      toad.genes.personality === "socialite" &&
      toad.genes.rarity >= 6,
    reward: BASE_PRICE * 13, // 65 токенов (сложное сочетание)
    difficulty: "medium",
  },
  {
    id: "elite_17",
    title: "Грёзы реальности",
    description: "Жаба с характером Мечтатель и беременностью",
    requirement: (toad: Toad) =>
      toad.genes.personality === "dreamer" && toad.pregnancy?.isPregnant,
    reward: BASE_PRICE * 11, // 55 токенов (средняя сложность)
    difficulty: "medium",
  },
  {
    id: "elite_18",
    title: "Особый вкус",
    description: "Жаба с характером Гурман и голодом менее 20%",
    requirement: (toad: Toad) =>
      toad.genes.personality === "gourmet" && toad.state.hunger < 20,
    reward: BASE_PRICE * 15, // 75 токенов (сложное условие)
    difficulty: "hard",
  },
  {
    id: "elite_19",
    title: "Умудренный жизнью в неволе",
    description: "Жаба с характером Свободный дух и возрастом более 3 дней",
    requirement: (toad: Toad) =>
      toad.genes.personality === "freeSpirit" &&
      Date.now() - new Date(toad.created_at).getTime() >
        3 * 24 * 60 * 60 * 1000,
    reward: BASE_PRICE * 10,
    difficulty: "medium",
  },
  {
    id: "elite_20",
    title: "Ритм вечности",
    description: "Жаба с характером Трудоголик и поколением 7+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "workaholic" && toad.generation >= 7,
    reward: BASE_PRICE * 16, // 80 токенов (редкое сочетание)
    difficulty: "hard",
  },
  {
    id: "elite_21",
    title: "Тень былой славы",
    description: "Жаба с характером Обаятельный и поколением 9+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "charmer" && toad.generation >= 9,
    reward: BASE_PRICE * 18, // 90 токенов (очень редкое)
    difficulty: "hard",
  },
  {
    id: "elite_22",
    title: "Молчание мудреца",
    description: "Жаба с характером Отшельник и редкостью 8+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "hermit" && toad.genes.rarity >= 8,
    reward: BASE_PRICE * 22, // 110 токенов (экстремально редкое)
    difficulty: "extreme",
  },
  {
    id: "elite_23",
    title: "Он видел все",
    description: "Жаба возрастом более 10 дней",
    requirement: (toad: Toad) =>
      Date.now() - new Date(toad.created_at).getTime() >
      10 * 24 * 60 * 60 * 1000,
    reward: BASE_PRICE * 20,
    difficulty: "extreme",
  },
  {
    id: "elite_24",
    title: "Причуды эволюции",
    description:
      "Жаба с незначительными генетическими отклонениями (уровень мутации 15-35)",
    requirement: (toad: Toad) =>
      toad.state.genetic_fault !== undefined &&
      toad.state.genetic_fault >= 15 &&
      toad.state.genetic_fault <= 35,
    reward: BASE_PRICE * 7, // 35 токенов
    difficulty: "medium",
  },
  {
    id: "elite_25",
    title: "Продукт распада",
    description:
      "Жаба с серьезными генетическими повреждениями (уровень мутации 50+) и редкостью 5+",
    requirement: (toad: Toad) =>
      toad.state.genetic_fault !== undefined &&
      toad.state.genetic_fault >= 50 &&
      toad.genes.rarity >= 5,
    reward: BASE_PRICE * 16, // 80 токенов (редкое и опасное сочетание)
    difficulty: "hard",
  },
  {
    id: "elite_26",
    title: "Искаженная натура",
    description:
      "Жаба-мутант (уровень мутации 80+) с характером Отшельник или Аскет",
    requirement: (toad: Toad) =>
      toad.state.genetic_fault !== undefined &&
      toad.state.genetic_fault >= 80 &&
      (toad.genes.personality === "hermit" ||
        toad.genes.personality === "ascetic"),
    reward: BASE_PRICE * 25, // 125 токенов (экстремально редкий мутант)
    difficulty: "extreme",
  },
];
