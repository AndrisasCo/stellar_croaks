export interface Toad {
  id: number;
  stage: string; // 'toadpole' | 'adult'
  created_at: string;
  description: string | null;
  generation: number;
  is_off: boolean | null; // продан или уничтожен
  name: string | null;
  owner: number;
  parents: number[] | null;
  scene_id: number | null; //  null это в инвентаре
  sex: string; // 'male' 'female' 'neuter'
  type: string | null; // пока не используется, мб тут будут варианты окраса
  state: {
    hunger: number; // 0 to 100
    // добавить потом болезни, которые дают дебаффы к голоду/цене/размножению + нельзя в коллайдер
  };
  pregnancy: null | {
    isPregnant: boolean;
    pregnancyStart: number;
    pregnancyDuration: number;
    fatherId: number;
    offspringCount: number;
  };
  genes: {
    hungerRate: number;
    fertility: number;
    speed: number;
    weight: number;
    rarity: number;
    colors: string[];
    pattern: string;
    personality: null | string;
  };
}

export const DEFAULT_TOADS: Toad[] = [
  {
    id: 0,
    name: "Дикая жаба 1",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: 1,
    created_at: new Date().toISOString(),
    description: null,
    is_off: false,
    owner: 0, // будет заменено при создании
    parents: null,
    state: {
      hunger: 30,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#6B8C42"],
      pattern: "smooth",
      weight: 20,
      speed: 0.4,
      rarity: 1,
      hungerRate: 1.2,
      fertility: 1.1,
      personality: null,
    },
  },
  {
    id: 1,
    name: "Дикая жаба 2",
    type: "common",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: 1,
    created_at: new Date().toISOString(),
    description: null,
    is_off: false,
    owner: 0, // будет заменено при создании
    parents: null,
    state: {
      hunger: 25,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#6B8C42"],
      pattern: "smooth",
      weight: 24,
      speed: 0.45,
      rarity: 1,
      hungerRate: 1.0,
      fertility: 1.3,
      personality: null,
    },
  },
  {
    id: 2,
    name: "Дикая жаба 3",
    type: "horned",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: 1,
    created_at: new Date().toISOString(),
    description: null,
    is_off: false,
    owner: 0, // будет заменено при создании
    parents: null,
    state: {
      hunger: 40,
    },
    pregnancy: null,
    genes: {
      colors: ["#c75e52", "#4A4A4A"],
      pattern: "horned",
      weight: 14,
      speed: 0.3,
      rarity: 1.2,
      hungerRate: 0.8,
      fertility: 0.9,
      personality: null,
    },
  },
];

export const personalities = {
  sleepy: {
    hungerRate: 0.6,
    fertility: 0.2,
    weightMultiplier: 1.1,
    speedMultiplier: 0.7,
    label: "Соня",
    description: "Спит больше, чем бодрствует. Икринки видит только во сне.",
  },
  glutton: {
    hungerRate: 1.9,
    fertility: 0.8,
    weightMultiplier: 1.4,
    speedMultiplier: 0.8,
    label: "Обжора",
    description: "Съест всё, включая твои надежды на прибыль от продажи.",
  },
  energetic: {
    hungerRate: 1.4,
    fertility: 1.3,
    weightMultiplier: 0.9,
    speedMultiplier: 1.3,
    label: "Энергичный",
    description: "Прыгает так быстро, что иногда забывает, зачем прыгал.",
  },
  romantic: {
    hungerRate: 0.9,
    fertility: 1.8,
    weightMultiplier: 1.0,
    speedMultiplier: 1.1,
    label: "Романтик",
    description: "Верит, что любовь найдется даже в самом грязном пруду.",
  },
  hermit: {
    hungerRate: 0.7,
    fertility: 0.3,
    weightMultiplier: 0.8,
    speedMultiplier: 0.9,
    label: "Отшельник",
    description: "Предпочитает одиночество и тихие вечера с комарами.",
  },
  partyAnimal: {
    hungerRate: 1.3,
    fertility: 1.6,
    weightMultiplier: 1.0,
    speedMultiplier: 1.2,
    label: "Тусовщик",
    description: "Знает всех жаб в округе... в прямом смысле слова.",
  },
  picky: {
    hungerRate: 0.8,
    fertility: 0.4,
    weightMultiplier: 0.9,
    speedMultiplier: 1.0,
    label: "Привередливый",
    description: "Мухи не той степени свежести? Прости, не голоден.",
  },
  passionate: {
    hungerRate: 1.1,
    fertility: 1.9,
    weightMultiplier: 1.1,
    speedMultiplier: 1.1,
    label: "Страстный",
    description: "Любовь - это когда ты производишь 50 икринок за раз.",
  },
  calm: {
    hungerRate: 0.9,
    fertility: 0.9,
    weightMultiplier: 1.0,
    speedMultiplier: 1.0,
    label: "Спокойный",
    description:
      "Ничего не происходит, и это прекрасно. До следующего кормления.",
  },
  hyperactive: {
    hungerRate: 1.7,
    fertility: 1.2,
    weightMultiplier: 0.8,
    speedMultiplier: 1.4,
    label: "Гиперактивный",
    description: "Прыгает даже во сне. Соседи по вольеру его ненавидят.",
  },
  shy: {
    hungerRate: 0.8,
    fertility: 0.6,
    weightMultiplier: 0.9,
    speedMultiplier: 0.9,
    label: "Стеснительный",
    description:
      "Краснеет при виде противоположного пола. Если бы мог краснеть.",
  },
  bold: {
    hungerRate: 1.2,
    fertility: 1.4,
    weightMultiplier: 1.2,
    speedMultiplier: 1.1,
    label: "Смелый",
    description: "Первым проверяет, съедобен ли новый вид грибов.",
  },
  gourmet: {
    hungerRate: 1.5,
    fertility: 0.7,
    weightMultiplier: 1.3,
    speedMultiplier: 0.8,
    label: "Гурман",
    description: "Различает 15 оттенков вкуса у обычного комара.",
  },
  playboy: {
    hungerRate: 1.0,
    fertility: 1.7,
    weightMultiplier: 1.0,
    speedMultiplier: 1.2,
    label: "Жаб-плэйбой",
    description: "В каждом новом вольере оставляет по потомку. На память.",
  },
  ascetic: {
    hungerRate: 0.5,
    fertility: 0.5,
    weightMultiplier: 0.7,
    speedMultiplier: 1.0,
    label: "Аскет",
    description: "Доволен малым. Очень малым. Почти голодной смертью.",
  },
  socialite: {
    hungerRate: 1.1,
    fertility: 1.5,
    weightMultiplier: 1.1,
    speedMultiplier: 1.1,
    label: "Светская жаба",
    description: "Знает все сплетни вольера. И несколько из соседнего.",
  },
  workaholic: {
    hungerRate: 1.6,
    fertility: 1.1,
    weightMultiplier: 1.0,
    speedMultiplier: 1.0,
    label: "Трудоголик",
    description: "Даже квакает по расписанию. Очень раздражает.",
  },
  dreamer: {
    hungerRate: 0.7,
    fertility: 1.0,
    weightMultiplier: 0.9,
    speedMultiplier: 0.8,
    label: "Мечтатель",
    description: "Верит, что однажды научится летать. Бедняга.",
  },
  athlete: {
    hungerRate: 1.8,
    fertility: 1.3,
    weightMultiplier: 1.2,
    speedMultiplier: 1.4,
    label: "Атлет",
    description:
      "Мог бы прыгнуть выше крыши, если бы понимал, что такое крыша.",
  },
  philosopher: {
    hungerRate: 0.9,
    fertility: 0.8,
    weightMultiplier: 1.0,
    speedMultiplier: 0.9,
    label: "Философ",
    description: 'Часто спрашивает: "Быть или не быть?" перед каждой мухой.',
  },
  adventurer: {
    hungerRate: 1.4,
    fertility: 1.4,
    weightMultiplier: 1.0,
    speedMultiplier: 1.3,
    label: "Искатель приключений",
    description: "Уже исследовал под камнем. Теперь мечтает о другом камне.",
  },
  homebody: {
    hungerRate: 0.8,
    fertility: 0.7,
    weightMultiplier: 1.1,
    speedMultiplier: 0.8,
    label: "Домосед",
    description: "Лучший друг - его собственная тень. И иногда кормушка.",
  },
  charmer: {
    hungerRate: 1.0,
    fertility: 1.9,
    weightMultiplier: 1.0,
    speedMultiplier: 1.1,
    label: "Обаятельный",
    description:
      "Может убедить кого угодно в чём угодно. Кроме голодного хищника.",
  },
  minimalist: {
    hungerRate: 0.6,
    fertility: 0.6,
    weightMultiplier: 0.8,
    speedMultiplier: 1.0,
    label: "Минималист",
    description: "Живёт по принципу: чем меньше, тем лучше. Кроме икринок.",
  },
  epicurean: {
    hungerRate: 1.7,
    fertility: 1.0,
    weightMultiplier: 1.3,
    speedMultiplier: 0.9,
    label: "Эпикуреец",
    description: "Наслаждается каждым моментом. Особенно моментом поедания.",
  },
  leader: {
    hungerRate: 1.3,
    fertility: 1.5,
    weightMultiplier: 1.2,
    speedMultiplier: 1.1,
    label: "Лидер",
    description: "Всегда первый у кормушки. И последний уходит.",
  },
  follower: {
    hungerRate: 1.0,
    fertility: 0.9,
    weightMultiplier: 0.9,
    speedMultiplier: 1.0,
    label: "Последователь",
    description: "Делает то, что делают все. Даже если все прыгают в кипяток.",
  },
  innovator: {
    hungerRate: 1.2,
    fertility: 1.2,
    weightMultiplier: 1.0,
    speedMultiplier: 1.2,
    label: "Новатор",
    description: "Пытается изобрести новый способ квакания. Пока безуспешно.",
  },
  traditionalist: {
    hungerRate: 0.9,
    fertility: 0.8,
    weightMultiplier: 1.1,
    speedMultiplier: 0.9,
    label: "Традиционалист",
    description: "Квакает так, как квакали его предки. Очень скучно.",
  },
  freeSpirit: {
    hungerRate: 1.1,
    fertility: 1.6,
    weightMultiplier: 0.9,
    speedMultiplier: 1.2,
    label: "Свободный дух",
    description:
      "Живёт по своим правилам. В основном, правилам вседозволенности.",
  },
};

export const getPersonalityMultipliers = (personality: string | null) => {
  if (!personality) return { weightMultiplier: 1.0, speedMultiplier: 1.0 };
  const person = personalities[personality as keyof typeof personalities];
  return {
    weightMultiplier: person?.weightMultiplier || 1.0,
    speedMultiplier: person?.speedMultiplier || 1.0,
  };
};

// Вспомогательная функция для получения лейбла
export const getPersonalityLabel = (personality: string | null): string => {
  if (!personality) return "Не определен";
  return (
    personalities[personality as keyof typeof personalities]?.label ||
    "Неизвестно"
  );
};

// Функция для получения описания
export const getPersonalityDescription = (
  personality: string | null
): string => {
  if (!personality) return "Характер ещё не проявился... или его просто нет.";
  return (
    personalities[personality as keyof typeof personalities]?.description ||
    "Загадочная натура."
  );
};

export const RARITY_GROUPS_TRESHOLD = {
  common: 0, // Обычные - базовые жабы, часто встречаются
  uncommon: 3, // Необычные - улучшенные характеристики
  rare: 10, // Редкие - уникальные цвета/узоры
  epic: 30, // Эпические - особые способности
  legendary: 50, // Легендарные - уникальные экземпляры
};

export const RARITY_CONFIG = {
  common: {
    label: "Обычная",
    color: "text-green-400",
    bgColor:
      " from-green-500/10 to-emerald-500/10 border border-green-500/30 hover:border-green-400/50 ",
    borderColor: "border-green-500/50",
    priceMultiplier: 1.0,
    icon: "🌿",
    treshold: RARITY_GROUPS_TRESHOLD.common,
  },
  uncommon: {
    label: "Необычная",
    color: "text-blue-400",
    bgColor:
      "from-blue-500/10 to-cyan-500/10 border border-blue-500/30 hover:border-blue-400/50",
    borderColor: "border-blue-500/50",
    priceMultiplier: 2.0,
    icon: "🔷",
    treshold: RARITY_GROUPS_TRESHOLD.uncommon,
  },
  rare: {
    label: "Редкая",
    color: "text-purple-400",
    bgColor:
      "from-purple-500/10 to-pink-500/10  border border-purple-500/30 hover:border-purple-400/50",

    borderColor: "border-purple-500/50",
    priceMultiplier: 5.0,
    icon: "⭐",
    treshold: RARITY_GROUPS_TRESHOLD.rare,
  },
  epic: {
    label: "Эпическая",
    color: "text-orange-400",
    bgColor:
      "from-orange-500/10 to-red-500/10 border border-orange-500/30 hover:border-orange-400/50",
    borderColor: "border-orange-500/50",
    priceMultiplier: 15.0,
    icon: "⚡",
    treshold: RARITY_GROUPS_TRESHOLD.epic,
  },
  legendary: {
    label: "Легендарная",
    color: "text-yellow-400",
    bgColor:
      "from-yellow-500/10 to-orange-500/10 border-yellow-500/30 hover:border-yellow-400/50",
    borderColor: "border-yellow-500/50",
    priceMultiplier: 50.0,
    icon: "👑",
    treshold: RARITY_GROUPS_TRESHOLD.legendary,
  },
};

export const getPregnancyDuration = () => Math.floor(Math.random() * 5); // 0 - 0.5 часов реальных

export const HOURS_TO_GROW_UP = 2;

// Функции для работы с редкостью
export const getRarityGroup = (rarity: number): keyof typeof RARITY_CONFIG => {
  if (rarity >= RARITY_CONFIG.legendary.treshold) return "legendary";
  if (rarity >= RARITY_CONFIG.epic.treshold) return "epic";
  if (rarity >= RARITY_CONFIG.rare.treshold) return "rare";
  if (rarity >= RARITY_CONFIG.uncommon.treshold) return "uncommon";
  return "common";
};

export const getRarityConfig = (rarity: number) => {
  const group = getRarityGroup(rarity);
  return RARITY_CONFIG[group];
};

export const calculateSellPrice = (toad: Toad): number => {
  const rarityConfig = getRarityConfig(toad.genes.rarity);
  let basePrice = 10 * rarityConfig.priceMultiplier;

  if (toad.stage !== "adult") {
    basePrice /= 1.5;
  }

  if (toad.sex === "neuter") {
    basePrice /= 3;
  }

  basePrice *= toad.genes?.fertility || 1;
  basePrice *= 1 - toad.state?.hunger / 200;
  basePrice *= 1 - (toad.genes?.hungerRate - 1) * 0.2;

  return Math.max(1, Math.round(basePrice));
};
