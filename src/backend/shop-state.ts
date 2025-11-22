import { Toad } from "../models/toad";
import { randomizeToadCharacteristics } from "../utils/randomize-toad-characteristics";

// Интерфейс для состояния магазина
export interface ShopState {
  availableToads: Partial<Toad>[];
  lastRefresh: number; // timestamp последнего обновления
  nextRefresh: number; // timestamp следующего обновления
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
    type: "common",
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
export const SHOP_STATE_KEY = "toad_shop_state";
export const REFRESH_COOLDOWN = 3 * 60 * 60 * 1000; // 3 часа в миллисекундах
export const INSTANT_REFRESH_COST = 20; // Стоимость мгновенного обновления

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

// Инициализация магазина со случайным набором жаб
export const initializeShop = (): ShopState => {
  const now = Date.now();
  const shuffled = [...ALL_TOADS].sort(() => Math.random() - 0.5);
  const availableToads = shuffled.slice(0, 3).map((toad) => ({
    ...randomizeToadCharacteristics(toad, 0.1),
    id: Math.round(Math.random() * Date.now()),
  }));

  return {
    availableToads,
    lastRefresh: now - REFRESH_COOLDOWN,
    nextRefresh: now,
  };
};
