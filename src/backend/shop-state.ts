import { Toad } from "../models/Toad";
import { ToadTypes } from "../models/Toad/toad-species";
import { Items } from "../models/user";
import { randomizeToadCharacteristics } from "../utils/randomize-toad-characteristics";
import {
  createScriptedEliteOrder,
  getScriptedEliteOrder,
  SCRIPTED_ELITE_KINDS,
} from "./elite-order-generator";
import type { EliteOrder } from "./elite-order-generator";

// Интерфейс для состояния Торговая Капсулаа
export interface ShopState {
  availableToads: Toad[];
  lastRefresh: number; // timestamp последнего обновления
  nextRefresh: number; // timestamp следующего обновления
  lastRefreshElite: number; // timestamp последнего обновления
  nextRefreshElite: number; // timestamp следующего обновления
  eliteOrders: string[];
  items: Record<string, number>;
}

// Список всех возможных жаб для Торговая Капсулаа
export const ALL_TOADS: Partial<Toad>[] = [
  {
    name: "Зеленая жаба",
    type: ToadTypes.hybrid,
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: 1,
    state: {
      hunger: 30,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#6B8C42"],
      pattern: "smooth",
      weight: 15,
      speed: 1,
      rarity: 1.0,
      hungerRate: 1.0,
      fertility: 1.0,
      personality: null,
    },
  },
  {
    name: "Коричневая жаба",
    type: ToadTypes.hybrid,
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: 1,
    state: {
      hunger: 25,
    },
    pregnancy: null,
    genes: {
      colors: ["#8B4513", "#A0522D"],
      pattern: "smooth",
      weight: 15,
      speed: 1,
      rarity: 1.1,
      hungerRate: 1,
      fertility: 1,
      personality: null,
    },
  },
  {
    name: "Пятнистая жаба",
    type: ToadTypes.camouflage,
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: 1,
    state: {
      hunger: 35,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#4A4A4A"],
      pattern: "spotted",
      weight: 16,
      speed: 1,
      rarity: 1.2,
      hungerRate: 1.1,
      fertility: 1.1,
      personality: null,
    },
  },
  {
    name: "Пятнистая жаба",
    type: ToadTypes.camouflage,
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: 1,
    state: {
      hunger: 35,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#4A4A4A"],
      pattern: "spotted",
      weight: 17,
      speed: 1,
      rarity: 1.2,
      hungerRate: 1.1,
      fertility: 1,
      personality: null,
    },
  },
  {
    name: "Лесная жаба",
    type: ToadTypes.hybrid,
    generation: 1,
    sex: "male",
    stage: "toadpole",
    scene_id: 1,
    state: {
      hunger: 28,
    },
    pregnancy: null,
    genes: {
      colors: ["#4A7C59", "#5D8C42"],
      pattern: "smooth",
      weight: 15,
      speed: 1,
      rarity: 1.05,
      hungerRate: 1,
      fertility: 1.1,
      personality: null,
    },
  },
  {
    name: "Болотная жаба",
    type: ToadTypes.hybrid,
    generation: 1,
    sex: "male",
    stage: "toadpole",
    scene_id: 1,
    state: {
      hunger: 32,
    },
    pregnancy: null,
    genes: {
      colors: ["#6B8C59", "#4A7C42"],
      pattern: "smooth",
      weight: 15,
      speed: 1,
      rarity: 1,
      hungerRate: 1,
      fertility: 0.9,
      personality: null,
    },
  },
  {
    name: "Золотая жаба",
    type: ToadTypes.hybrid,
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: 1,
    state: {
      hunger: 20,
    },
    pregnancy: null,
    genes: {
      colors: ["#FFD700", "#FFEC8B"],
      pattern: "smooth",
      weight: 15,
      speed: 1,
      rarity: 2.0,
      hungerRate: 1,
      fertility: 1,
      personality: null,
    },
  },
  {
    name: "Хрустальная жаба",
    type: ToadTypes.hybrid,
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: 1,
    state: {
      hunger: 15,
    },
    pregnancy: null,
    genes: {
      colors: ["#E6E6FA", "#F0F8FF"],
      pattern: "crystalline",
      weight: 15,
      speed: 1,
      rarity: 3.0,
      hungerRate: 1,
      fertility: 1,
      personality: null,
    },
  },
  {
    name: "Хищная жаба",
    type: ToadTypes.tiger,
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: 1,
    state: {
      hunger: 15,
    },
    pregnancy: null,
    genes: {
      colors: ["#E6E6FA", "#F0F8FF"],
      pattern: "crystalline",
      weight: 15,
      speed: 1,
      rarity: 3.0,
      hungerRate: 1.5,
      fertility: 1.0,
      personality: null,
    },
  },
];

// Ключ для localStorage
export const SHOP_STATE_KEY = "toad_shop_state9";
export const REFRESH_COOLDOWN = 3 * 60 * 60 * 1000; // 3 часа в миллисекундах
/** Витрина элитных заказов обновляется реже рынка — раз в сутки */
export const ELITE_REFRESH_COOLDOWN = 24 * 60 * 60 * 1000;
/** Мгновенное обновление рынка: цена в Кваксах 🔷 */
export const INSTANT_REFRESH_COST = 50;
/** Кулдаун после платного обновления рынка — чтобы обновления не фармили бесконечно */
export const INSTANT_REFRESH_COOLDOWN = 30 * 60 * 1000;
/** Мгновенная витрина элитных заказов: цена в Кваксах 🔷 */
export const INSTANT_REFRESH_ELITE_COST = 150;
/** Кулдаун после платного обновления витрины заказов */
export const INSTANT_REFRESH_ELITE_COOLDOWN = 60 * 60 * 1000;

// Функции для работы с localStorage
export const getShopState = (): ShopState => {
  const stored = localStorage.getItem(SHOP_STATE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  // Инициализация нового состояния Торговая Капсулаа
  return initializeShop();
};

export const saveShopState = (state: ShopState) => {
  localStorage.setItem(SHOP_STATE_KEY, JSON.stringify(state));
};
export const initialItemsAmount = {
  lootbox: 10,
  battery: 2,
  food: 5,
  worms: 10,
  sparkleFlys: 10,
  [Items.pigmentUnstable]: 5,
};
// Инициализация Торговая Капсулаа со случайным набором жаб
export const initializeShop = (): ShopState => {
  const now = Date.now();

  return {
    availableToads: getNewToads(),
    lastRefresh: now - REFRESH_COOLDOWN,
    nextRefresh: now,
    // Витрина заказов стартует с полным кулдауном: раньше nextRefreshElite = now давал
    // бесплатное «первое» обновление витрины при каждом заходе (балансный баг P2).
    lastRefreshElite: now - ELITE_REFRESH_COOLDOWN,
    nextRefreshElite: now + ELITE_REFRESH_COOLDOWN,
    eliteOrders: getNewElite(),
    items: { ...initialItemsAmount },
  };
};

export const getNewToads = (): Toad[] => {
  const shuffled = [...ALL_TOADS].sort(() => Math.random() - 0.5);
  // ALL_TOADS — полные шаблоны жаб, randomizeToadCharacteristics меняет только
  // характеристики, поэтому витрина всегда получает целых жаб с новым id.
  return shuffled.slice(0, 3).map((toad) => ({
    ...randomizeToadCharacteristics(toad, 0.1),
    id: Math.round(Math.random() * Date.now()),
  })) as Toad[];
};

/** Сколько заказов показывает витрина за одно обновление */
export const ELITE_ORDERS_PER_REFRESH = 5;

const shuffle = <T>(items: readonly T[]): T[] => {
  const result = [...items];

  // Фишер–Йетс: в отличие от sort(() => Math.random() - 0.5) не смещает вероятности.
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
};

/**
 * Резолвит id заказа с витрины: сначала ищет кураторский заказ, затем —
 * скриптованный. Скриптованные параметры закодированы в id, поэтому после
 * перезагрузки заказ восстанавливается без хранения замыканий в localStorage.
 */
export const getEliteOrderById = (id: string): EliteOrder | undefined =>
  eliteOrders.find((order) => order.id === id) ??
  getScriptedEliteOrder(id) ??
  undefined;

export const getNewElite = (): string[] => {
  // Каждое обновление гарантирует по одному заказу каждого сценария: характер,
  // окрас и порог характеристики. Остаток витрины добираем кураторскими заказами,
  // чтобы редкие ручные условия тоже продолжали попадаться.
  const scripted = SCRIPTED_ELITE_KINDS.map(
    (kind) => createScriptedEliteOrder(kind).id,
  );
  const curatedSlots = Math.max(0, ELITE_ORDERS_PER_REFRESH - scripted.length);
  const curated = shuffle(eliteOrders)
    .slice(0, curatedSlots)
    .map((order) => order.id);

  return shuffle([...scripted, ...curated]).slice(0, ELITE_ORDERS_PER_REFRESH);
};

/**
 * Награды элитных заказов — в Астро-кваксах 💎, а не в Кваксах.
 *
 * Шкала оптимизирована под цену лутбокса (10 💎) и поток астро из походов
 * (~0,7–2 💎 за рейд): простое ожидание и лотерейные характеры платят 5–30 💎,
 * самые редкие комбинации гена и характера — 100–150 💎. Раньше здесь были суммы
 * до 800 💎: одна сдача окупала десятки лутбоксов и делала разведку бессмысленной.
 * Внутри шкалы сохранён принцип «награда ↔ сложность»: чистое ожидание
 * (10 дней возраста) стоит дёшево, селекционная редкость — дорого.
 */

export const eliteOrders: EliteOrder[] = [
  {
    id: "elite_1",
    title: "Нежный гигант",
    description: "Жаба весом более 35 с характером Романтик",
    requirement: (toad: Toad) =>
      toad.genes.weight > 35 && toad.genes.personality === "romantic",
    reward: 100, // размер 35+ И характер Романтик: почти недостижимая мечта селекции
    difficulty: "extreme",
  },
  {
    id: "elite_2",
    title: "Поэт болотных глубин",
    description: "Жаба с характером Мечтатель",
    requirement: (toad: Toad) => toad.genes.personality === "dreamer",
    reward: 20, // характер Мечтатель: личность приходит лотереей из коллидера
    difficulty: "medium",
  },
  {
    id: "elite_3",
    title: "Загадка бездны",
    description: "Жаба с полом Бесполый",
    requirement: (toad: Toad) => toad.sex === "neuter",
    reward: 15, // бесполый: редкий результат мутации
    difficulty: "extreme",
  },
  {
    id: "elite_4",
    title: "Вихрь судьбы",
    description: "Жаба со скоростью более 2",
    requirement: (toad: Toad) => toad.genes.speed > 2,
    reward: 150, // скорость 2+: почти не бывает, гены скорости упираются в 1.0
    difficulty: "hard",
  },
  {
    id: "elite_5",
    title: "Исполин рассвета",
    description: "Жаба Качеством 7 и больше весом более 40",
    requirement: (toad: Toad) =>
      toad.genes.weight > 40 && toad.genes.rarity >= 7,
    reward: 150, // масса 40+ И Качество 7+: экстремальная селекция
    difficulty: "extreme",
  },
  {
    id: "elite_6",
    title: "Вечный странник",
    description: "Жаба с полом Бесполый и Качеством 7+",
    requirement: (toad: Toad) =>
      toad.sex === "neuter" && toad.genes.rarity >= 7,
    reward: 30, // бесполый И Качество 7+
    difficulty: "extreme",
  },
  {
    id: "elite_7",
    title: "Безумный гений",
    description: "Жаба с характером Новатор или Энергичный и Качеством 6+",
    requirement: (toad: Toad) =>
      (toad.genes.personality === "innovator" ||
        toad.genes.personality === "energetic") &&
      toad.genes.rarity >= 6,
    reward: 40, // Новатор или Энергичный И Качество 6+
    difficulty: "hard",
  },
  {
    id: "elite_8",
    title: "Идеальный баланс",
    description: "Жаба с весом 12-16, скоростью 0.6-0.8 и фертильностью 3+",
    requirement: (toad: Toad) =>
      toad.genes.weight >= 12 &&
      toad.genes.weight <= 16 &&
      toad.genes.speed >= 0.6 &&
      toad.genes.speed <= 0.8 &&
      toad.genes.fertility >= 3,
    reward: 30, // масса 12-16, скорость 0.6-0.8, плодовитость 3+: узкий коридор
    difficulty: "medium",
  },
  {
    id: "elite_9",
    title: "Наследник легенд",
    description: "Головастик 8+ поколения с Качеством 6+",
    requirement: (toad: Toad) =>
      toad.stage === "toadpole" &&
      toad.generation >= 8 &&
      toad.genes.rarity >= 6,
    reward: 10, // головастик 8+ поколения: головастиком он бывает всего час
    difficulty: "hard",
  },
  {
    id: "elite_10",
    title: "Ненасытный титан",
    description: "Жаба с характером Обжора и весом более 25",
    requirement: (toad: Toad) =>
      toad.genes.personality === "glutton" && toad.genes.weight > 25,
    reward: 20, // Обжора И масса 25+: две линии селекции сразу
    difficulty: "medium",
  },
  {
    id: "elite_11",
    title: "Вечный карнавал",
    description: "Жаба 10+ поколения с характером Тусовщик",
    requirement: (toad: Toad) =>
      toad.generation >= 10 && toad.genes.personality === "partyAnimal",
    reward: 40, // 10+ поколение И Тусовщик
    difficulty: "hard",
  },
  {
    id: "elite_12",
    title: "Аскеза желаний",
    description: "Жаба с характером Аскет и фертильностью более 3",
    requirement: (toad: Toad) =>
      toad.genes.personality === "ascetic" && toad.genes.fertility > 3,
    reward: 150, // Аскет И плодовитость 3+: характер и ген тянут в разные стороны
    difficulty: "hard",
  },
  {
    id: "elite_13",
    title: "Повелитель иллюзий",
    description: "Жаба с характером Лидер и Качеством 5+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "leader" && toad.genes.rarity >= 5,
    reward: 25, // Лидер И Качество 5+
    difficulty: "medium",
  },
  {
    id: "elite_14",
    title: "Мыслитель в движении",
    description: "Жаба с характером Философ и скоростью менее 0.5",
    requirement: (toad: Toad) =>
      toad.genes.personality === "philosopher" && toad.genes.speed < 0.5,
    reward: 20, // Философ И скорость меньше 0.5
    difficulty: "medium",
  },
  {
    id: "elite_15",
    title: "Одержимость плотью",
    description: "Жаба с характером Страстный и фертильностью более 4",
    requirement: (toad: Toad) =>
      toad.genes.personality === "passionate" && toad.genes.fertility > 4,
    reward: 150, // Страстный И плодовитость 4+: почти невозможно
    difficulty: "hard",
  },
  {
    id: "elite_16",
    title: "Болотная дива",
    description: "Самка с характером Светская жаба и Качеством 6+",
    requirement: (toad: Toad) =>
      toad.sex === "female" &&
      toad.genes.personality === "socialite" &&
      toad.genes.rarity >= 6,
    reward: 30, // самка, Светская жаба, Качество 6+
    difficulty: "medium",
  },
  {
    id: "elite_17",
    title: "Грёзы реальности",
    description: "Жаба с характером Мечтатель и беременностью",
    requirement: (toad: Toad) =>
      toad.genes.personality === "dreamer" &&
      Boolean(toad.pregnancy?.isPregnant),
    reward: 20, // Мечтатель и беременна: заказ под окно в 10 минут
    difficulty: "medium",
  },
  {
    id: "elite_18",
    title: "Особый вкус",
    description: "Жаба с характером Гурман и голодом менее 20%",
    requirement: (toad: Toad) =>
      toad.genes.personality === "gourmet" && toad.state.hunger < 20,
    reward: 15, // Гурман и голод менее 20%: покормить — потерять заказ
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
    reward: 5, // Свободный дух и возраст 3+ дня: чистое ожидание
    difficulty: "medium",
  },
  {
    id: "elite_20",
    title: "Ритм вечности",
    description: "Жаба с характером Трудоголик и поколением 7+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "workaholic" && toad.generation >= 7,
    reward: 35, // Трудоголик И 7+ поколение
    difficulty: "hard",
  },
  {
    id: "elite_21",
    title: "Тень былой славы",
    description: "Жаба с характером Обаятельный и поколением 9+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "charmer" && toad.generation >= 9,
    reward: 35, // Обаятельный И 9+ поколение
    difficulty: "hard",
  },
  {
    id: "elite_22",
    title: "Молчание мудреца",
    description: "Жаба с характером Отшельник и Качеством 8+",
    requirement: (toad: Toad) =>
      toad.genes.personality === "hermit" && toad.genes.rarity >= 8,
    reward: 45, // Отшельник И Качество 8+
    difficulty: "extreme",
  },
  {
    id: "elite_23",
    title: "Он видел все",
    description: "Жаба возрастом более 10 дней",
    requirement: (toad: Toad) =>
      Date.now() - new Date(toad.created_at).getTime() >
      10 * 24 * 60 * 60 * 1000,
    reward: 5, // возраст 10+ дней: ждать долго, но делать ничего не надо
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
    reward: 5, // мутация 15-35: побочный продукт коллидера
    difficulty: "medium",
  },
  {
    id: "elite_25",
    title: "Продукт распада",
    description:
      "Жаба с серьезными генетическими повреждениями (уровень мутации 50+) и Качеством 5+",
    requirement: (toad: Toad) =>
      toad.state.genetic_fault !== undefined &&
      toad.state.genetic_fault >= 50 &&
      toad.genes.rarity >= 5,
    reward: 10, // мутация 50+ И Качество 5+
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
    reward: 50, // мутант 80+ с характером Отшельник или Аскет
    difficulty: "extreme",
  },
];
