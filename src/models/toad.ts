import { varyColor } from "../utils/randomize-toad-characteristics";

export interface Toad {
  id: number;
  stage: string; // 'toadpole' | 'adult'
  created_at: string;
  generation: number;
  name: string | null;
  parents: number[] | null; // ?
  scene_id: number | null; //  null это в инвентаре
  sex: string; // 'male' 'female' 'neuter'
  type: string | null; // пока не используется, мб тут будут варианты окраса
  state: {
    hunger: number; // 0 to 100
    genetic_fault?: number; // 0 to 100
    // добавить потом болезни, которые дают дебаффы к голоду/цене/размножению + нельзя в коллайдер
  };
  pregnancy: null | {
    isPregnant: boolean;
    pregnancyStart: number;
    pregnancyDuration: number;
    fatherId: number;
    father: Toad;
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
    parents: null,
    state: {
      hunger: 30,
      genetic_fault: 0,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#6B8C42"],
      pattern: "smooth",
      weight: 22,
      speed: 0.4,
      rarity: 1.2,
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
    parents: null,
    state: {
      hunger: 25,
      genetic_fault: 0,
    },
    pregnancy: null,
    genes: {
      colors: ["#4CAF50", "#8BC34A"],
      pattern: "smooth",
      weight: 18,
      speed: 0.45,
      rarity: 1.3,
      hungerRate: 1.0,
      fertility: 1.4,
      personality: null,
    },
  },
  {
    id: 2,
    name: "Дикая жаба 3",
    type: "common",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: 1,
    created_at: new Date().toISOString(),
    parents: null,
    state: {
      hunger: 40,
      genetic_fault: 0,
    },
    pregnancy: null,
    genes: {
      colors: ["#388E3C", "#66BB6A"],
      pattern: "smooth",
      weight: 20,
      speed: 0.35,
      rarity: 1.1,
      hungerRate: 0.9,
      fertility: 1.3,
      personality: null,
    },
  },
  {
    id: 3,
    name: "Дикая жаба 4",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: 1,
    created_at: new Date().toISOString(),
    parents: null,
    state: {
      hunger: 35,
      genetic_fault: 0,
    },
    pregnancy: null,
    genes: {
      colors: ["#c75e52", "#8B4513"],
      pattern: "smooth",
      weight: 20,
      speed: 0.38,
      rarity: 1.4,
      hungerRate: 1.3,
      fertility: 1.0,
      personality: null,
    },
  },
  {
    id: 4,
    name: "Дикая жаба 5",
    type: "common",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: 1,
    created_at: new Date().toISOString(),
    parents: null,
    state: {
      hunger: 28,
      genetic_fault: 0,
    },
    pregnancy: null,
    genes: {
      colors: ["#689F38", "#9CCC65"],
      pattern: "smooth",
      weight: 16,
      speed: 0.42,
      rarity: 1.5,
      hungerRate: 0.8,
      fertility: 1.5,
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
    description:
      "Спит так много, что иногда его принимают за декоративный камень. С экономической точки зрения - идеальный питомец.",
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
    description:
      "Устраивает вечеринки до рассвета, а на утро не помнит, откуда взялись эти 20 головастиков.",
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
    description:
      "Любит так сильно, что иногда забывает спросить согласия. Родословная растет как на дрожжах.",
  },
  calm: {
    hungerRate: 0.9,
    fertility: 0.9,
    weightMultiplier: 1.0,
    speedMultiplier: 1.0,
    label: "Спокойный",
    description:
      "Единственная жаба, которая не паникует при виде повара с ножом. Возможно, слишком спокойная...",
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
    description:
      "У него в каждом городе есть... ну, ты понял. Алиментов хватит на три поколения вперед.",
  },
  ascetic: {
    hungerRate: 0.5,
    fertility: 0.5,
    weightMultiplier: 0.7,
    speedMultiplier: 1.0,
    label: "Аскет",
    description:
      "Доволен жизнью, даже когда все вокруг жалуются. Раздражает своим позитивом.",
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
    description:
      "Все еще верит, что однажды превратится в принца. Пока желающих целовать не находится...",
  },
  athlete: {
    hungerRate: 1.8,
    fertility: 1.3,
    weightMultiplier: 1.2,
    speedMultiplier: 1.4,
    label: "Атлет",
    description:
      "Прыгает так высоко, что иногда приходится искать его на деревьях. Неудобно, но впечатляюще.",
  },
  philosopher: {
    hungerRate: 0.9,
    fertility: 0.8,
    weightMultiplier: 1.0,
    speedMultiplier: 0.9,
    label: "Философ",
    description: 'Пришёл к выводу, что "я квакаю - значит, существую".',
  },
  adventurer: {
    hungerRate: 1.4,
    fertility: 1.4,
    weightMultiplier: 1.0,
    speedMultiplier: 1.3,
    label: "Искатель приключений",
    description:
      "Уже трижды терялся, дважды попадал в соседний вольер и один раз чуть не стал обедом для цапли.",
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
      "Может убедить кого угодно в чем угодно. Особенно в необходимости продолжения рода.",
  },
  minimalist: {
    hungerRate: 0.6,
    fertility: 0.6,
    weightMultiplier: 0.8,
    speedMultiplier: 1.0,
    label: "Минималист",
    description:
      "Считает, что счастье - в отсутствии лишнего. Включая лишних детей и лишней еды.",
  },
  epicurean: {
    hungerRate: 1.7,
    fertility: 1.0,
    weightMultiplier: 1.3,
    speedMultiplier: 0.9,
    label: "Эпикуреец",
    description: "Наслаждается каждым моментом. Особенно моментом ужина.",
  },
  leader: {
    hungerRate: 1.3,
    fertility: 1.5,
    weightMultiplier: 1.2,
    speedMultiplier: 1.1,
    label: "Лидер",
    description:
      "Уверен, что родился для великих дел. Пока великие дела сводятся к организации очереди к кормушке.",
  },
  follower: {
    hungerRate: 1.0,
    fertility: 0.9,
    weightMultiplier: 0.9,
    speedMultiplier: 1.0,
    label: "Последователь",
    description:
      "Готов следовать за кем угодно. Даже за тем, кто ведет его прямиком в суп.",
  },
  innovator: {
    hungerRate: 1.2,
    fertility: 1.2,
    weightMultiplier: 1.0,
    speedMultiplier: 1.2,
    label: "Новатор",
    description: "Всегда ищет новые способы быть несчастным. Пока нашел 15.",
  },
  traditionalist: {
    hungerRate: 0.9,
    fertility: 0.8,
    weightMultiplier: 1.1,
    speedMultiplier: 0.9,
    label: "Традиционалист",
    description:
      "Придерживается дедовских методов: размножаться по расписанию, болеть по традиции, и умирать как все - от скуки.",
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
  hunter: {
    hungerRate: 1.3,
    fertility: 1.1,
    weightMultiplier: 1.1,
    speedMultiplier: 1.3,
    label: "Охотник",
    description:
      "Ни одна муха не ускользнёт от его цепкого языка. Настоящий профессионал своего дела.",
  },
  mysterious: {
    hungerRate: 0.8,
    fertility: 1.2,
    weightMultiplier: 0.9,
    speedMultiplier: 1.1,
    label: "Загадочный",
    description:
      "Появляется из ниоткуда и исчезает в никуда. Иногда кажется, что он знает больше, чем говорит.",
  },
  wise: {
    hungerRate: 0.7,
    fertility: 0.9,
    weightMultiplier: 1.0,
    speedMultiplier: 0.8,
    label: "Мудрый",
    description:
      "Прошёл через много луж и знает, какая из них самая глубокая. Другие жабы приходят к нему за советом.",
  },
  explorer: {
    hungerRate: 1.4,
    fertility: 1.3,
    weightMultiplier: 0.9,
    speedMultiplier: 1.4,
    label: "Исследователь",
    description:
      "Карта вольера - его настольная книга. Уверен, что за следующим листком скрывается новая жизнь.",
  },
  dominant: {
    hungerRate: 1.5,
    fertility: 1.8,
    weightMultiplier: 1.3,
    speedMultiplier: 1.2,
    label: "Доминантный",
    description:
      "Рождён командовать. Остальные жабы либо подчиняются, либо становятся его обедом.",
  },
  graceful: {
    hungerRate: 0.9,
    fertility: 1.4,
    weightMultiplier: 0.8,
    speedMultiplier: 1.3,
    label: "Грациозный",
    description:
      "Прыгает так изящно, что кажется - он не касается земли, а лишь целует её лапками.",
  },
  imperial: {
    hungerRate: 1.2,
    fertility: 2.0,
    weightMultiplier: 1.4,
    speedMultiplier: 1.1,
    label: "Дворянин",
    description:
      "В его жилах течёт королевская кровь. Обычные жабы кажутся ему простолюдинами.",
  },
  chaotic: {
    hungerRate: 1.8,
    fertility: 2.2,
    weightMultiplier: 1.1,
    speedMultiplier: 1.5,
    label: "Хаотичный",
    description:
      "Живёт по принципу 'что будет - то будет'. Создаёт вокруг себя творческий беспорядок и неожиданные генетические комбинации.",
  },
  lucky: {
    hungerRate: 0.8,
    fertility: 1.7,
    weightMultiplier: 1.0,
    speedMultiplier: 1.1,
    label: "Везунчик",
    description:
      "Родился под счастливой звездой. Даже когда падает - находит монетку. Или партнёра для размножения.",
  },
  cursed: {
    hungerRate: 1.6,
    fertility: 0.3,
    weightMultiplier: 0.7,
    speedMultiplier: 0.6,
    label: "Проклятый",
    description:
      "Кажется, судьба играет с ним в жестокие игры. Но даже проклятия не могут сломить его жабий дух.",
  },
  psychic: {
    hungerRate: 0.9,
    fertility: 1.1,
    weightMultiplier: 0.9,
    speedMultiplier: 0.9,
    label: "Экстрасенс",
    description:
      "Видит то, что другим не дано. Например, будущее содержание своей кормушки. ",
  },
  alchemist: {
    hungerRate: 1.1,
    fertility: 1.3,
    weightMultiplier: 1.0,
    speedMultiplier: 0.8,
    label: "Алхимик",
    description:
      "Превращает обычных комаров в гастрономические шедевры. Ищет философский камень, чтобы превратить камни в еду.",
  },
  bard: {
    hungerRate: 1.0,
    fertility: 1.5,
    weightMultiplier: 0.9,
    speedMultiplier: 1.0,
    label: "Бард",
    description:
      "Его кваканье завораживает. Говорят, под его песни даже водоросли начинают танцевать.",
  },
  berserk: {
    hungerRate: 2.0,
    fertility: 1.9,
    weightMultiplier: 1.5,
    speedMultiplier: 1.6,
    label: "Берсерк",
    description:
      "В бою - неудержим, в любви - неумолим. Лучше не стоять у него на пути во время обеда или брачного сезона.",
  },
  ninja: {
    hungerRate: 1.1,
    fertility: 1.2,
    weightMultiplier: 0.8,
    speedMultiplier: 1.7,
    label: "Ниндзя",
    description:
      "Появляется и исчезает бесшумно. Никто не видел, как он ест, но корм исчезает с пугающей скоростью.",
  },
  samurai: {
    hungerRate: 1.3,
    fertility: 1.4,
    weightMultiplier: 1.2,
    speedMultiplier: 1.2,
    label: "Самурай",
    description:
      "Живёт по кодексу чести. Мух убивает одним ударом языка, никогда не бьёт лежачего комара.",
  },
  vampire: {
    hungerRate: 1.4,
    fertility: 0.5,
    weightMultiplier: 0.9,
    speedMultiplier: 1.3,
    label: "Вампир",
    description:
      "Выходит на охоту только ночью. Пьёт... ну, вообще-то тоже ест мух, но делает это очень драматично.",
  },
  zombie: {
    hungerRate: 0.5,
    fertility: 0.1,
    weightMultiplier: 1.6,
    speedMultiplier: 0.4,
    label: "Зомби",
    description:
      "Медленный, но неутомимый. Кажется, уже должен быть мёртв, но продолжает упорно существовать.",
  },
  robot: {
    hungerRate: 1.0,
    fertility: 0.0,
    weightMultiplier: 1.3,
    speedMultiplier: 1.0,
    label: "Робот",
    description:
      "Бионическая жаба будущего. Не размножается, зато никогда не устаёт квакать с идеальной частотой.",
  },
  ghost: {
    hungerRate: 0.3,
    fertility: 0.8,
    weightMultiplier: 0.5,
    speedMultiplier: 1.8,
    label: "Призрак",
    description:
      "Проходит сквозь стены и исчезает в тумане. Иногда кажется, что его вообще нет, пока он не съест твой обед.",
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
    icon: "🦋",
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
    icon: "☄️",
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
  let basePrice = toad.genes.rarity * 1.5 + 3;

  if (toad.stage !== "adult") {
    basePrice /= 1.5;
  }

  if (toad.sex === "neuter") {
    basePrice /= 3;
  }

  if ((toad.state.genetic_fault || 0) > 25) {
    basePrice *= (100 - (toad.state.genetic_fault || 0)) / 100;
  }

  basePrice += toad.genes.fertility || 1;
  basePrice += toad.state.hunger / 100;
  basePrice -= toad.genes.hungerRate;

  return Math.max(0, Math.round(basePrice));
};

// Функция для получения конфигурации генетической поломки
export const getGeneticFaultConfig = (fault: number | undefined) => {
  const value = fault || 0;

  if (value === 0) {
    return {
      color: "text-green-400",
      bgColor: "bg-green-900/20",
      borderColor: "border-green-500/30",
      icon: "🧬",
      label: "Идеальная",
      description:
        "Безупречная генетическая структура! Эта жаба - эталон селекции. Идеально подходит для разведения чистых линий и получения здорового потомства без риска мутаций.",
    };
  } else if (value <= 25) {
    return {
      color: "text-yellow-400",
      bgColor: "bg-yellow-900/20",
      borderColor: "border-yellow-500/30",
      icon: "🔬",
      label: "Стабильная",
      description:
        "Незначительные генетические вариации. Пара лишних пальцев или необычный окрас - это не баг, а фича! Потомство будет стабильным с минимальным риском мутаций.",
    };
  } else if (value <= 50) {
    return {
      color: "text-orange-400",
      bgColor: "bg-orange-900/20",
      borderColor: "border-orange-500/30",
      icon: "⚠️",
      label: "Нестабильная",
      description:
        "Заметные генетические аномалии. Иногда квакает ультразвуком или отращивает третье веко, но в целом сохраняет жизнеспособность. Потомство может унаследовать нестабильность.",
    };
  } else {
    return {
      color: "text-red-400",
      bgColor: "bg-red-900/20",
      borderColor: "border-red-500/30",
      icon: "💥",
      label: "Критическая",
      description:
        "Серьёзные генетические нарушения! Коллайдер явно перестарался... Возможны спонтанные мутации, изменение характеристик и непредсказуемое потомство или бесплодность. Зато выглядит круто!",
    };
  }
};
// Интерфейс для весов редкости
interface RarityWeight {
  minRarity: number;
  maxRarity: number;
  weight: number;
  name: string;
}

// Веса для разных уровней редкости - теперь 10-20 самая распространенная
const RARITY_WEIGHTS: RarityWeight[] = [
  { minRarity: 1, maxRarity: 5, weight: 49.99, name: "Обычная" },
  { minRarity: 6, maxRarity: 10, weight: 39.9, name: "Необычная" },
  { minRarity: 11, maxRarity: 20, weight: 10, name: "Редкая" },
  { minRarity: 21, maxRarity: 35, weight: 0.1, name: "Эпическая" },
  { minRarity: 36, maxRarity: 50, weight: 0.01, name: "Легендарная" },
];

// База данных уникальных жаб с разной редкостью
const UNIQUE_TOADS_BY_RARITY: { [key: number]: Partial<Toad>[] } = {
  // Редкость 1-5 (Обычные)
  1: [
    {
      name: "Лесной странник",
      type: "common",
      genes: {
        colors: ["#8FBC8F", "#556B2F"], // Темно-зеленый и светло-зеленый
        pattern: "smooth",
        weight: 18,
        speed: 0.3,
        rarity: 2.5,
        hungerRate: 1.2,
        fertility: 0.8,
        personality: "calm",
      },
    },
    {
      name: "Болотный житель",
      type: "common",
      genes: {
        colors: ["#6B8E23", "#9ACD32"], // Оливковый и желто-зеленый
        pattern: "spots",
        weight: 16,
        speed: 0.25,
        rarity: 3.8,
        hungerRate: 1.0,
        fertility: 1.0,
        personality: "lazy",
      },
    },
  ],
  // Редкость 6-10 (Необычные)
  6: [
    {
      name: "Изумрудный прыгун",
      type: "uncommon",
      genes: {
        colors: ["#228B22", "#32CD32"], // Лесной зеленый и лаймовый
        pattern: "stripes",
        weight: 20,
        speed: 0.4,
        rarity: 7.2,
        hungerRate: 1.0,
        fertility: 1.2,
        personality: "active",
      },
    },
    {
      name: "Золотистый охотник",
      type: "uncommon",
      genes: {
        colors: ["#DAA520", "#F0E68C"], // Золотистый и хаки
        pattern: "marbled",
        weight: 17,
        speed: 0.5,
        rarity: 8.5,
        hungerRate: 1.1,
        fertility: 1.1,
        personality: "hunter",
      },
    },
  ],
  // Редкость 11-20 (Редкие) - САМАЯ РАСПРОСТРАНЕННАЯ
  11: [
    {
      name: "Сапфировый призрак",
      type: "rare",
      genes: {
        colors: ["#4682B4", "#87CEEB"], // Стальной синий и небесно-голубой
        pattern: "glowing",
        weight: 19,
        speed: 0.6,
        rarity: 14.5,
        hungerRate: 0.9,
        fertility: 1.4,
        personality: "mysterious",
      },
    },
    {
      name: "Огненный спринтер",
      type: "rare",
      genes: {
        colors: ["#CD5C5C", "#F08080"], // Коралловый и светло-коралловый
        pattern: "flames",
        weight: 16,
        speed: 0.7,
        rarity: 16.8,
        hungerRate: 1.2,
        fertility: 1.3,
        personality: "energetic",
      },
    },
    {
      name: "Аметистовый мудрец",
      type: "rare",
      genes: {
        colors: ["#9370DB", "#D8BFD8"], // Пурпурный и чертополох
        pattern: "crystal",
        weight: 21,
        speed: 0.4,
        rarity: 12.3,
        hungerRate: 0.8,
        fertility: 1.5,
        personality: "wise",
      },
    },
    {
      name: "Изумрудный исследователь",
      type: "rare",
      genes: {
        colors: ["#2E8B57", "#66CDAA"], // Морской зеленый и бирюзовый
        pattern: "swirls",
        weight: 15,
        speed: 0.65,
        rarity: 18.2,
        hungerRate: 1.0,
        fertility: 1.4,
        personality: "explorer",
      },
    },
  ],
  // Редкость 21-35 (Эпические) - ОЧЕНЬ РЕДКИЕ
  21: [
    {
      name: "Драконий воин",
      type: "epic",
      genes: {
        colors: ["#B22222", "#DC143C"], // Кирпичный и малиновый
        pattern: "scales",
        weight: 25,
        speed: 0.7,
        rarity: 28.5,
        hungerRate: 0.7,
        fertility: 1.8,
        personality: "dominant",
      },
    },
    {
      name: "Лунный сильфид",
      type: "epic",
      genes: {
        colors: ["#F5F5F5", "#D3D3D3"], // Белый дым и светло-серый
        pattern: "moonlight",
        weight: 12,
        speed: 0.8,
        rarity: 32.1,
        hungerRate: 0.6,
        fertility: 1.7,
        personality: "graceful",
      },
    },
    {
      name: "Вихревой скакун",
      type: "epic",
      genes: {
        colors: ["#20B2AA", "#48D1CC"], // Светло-морской и бирюзовый
        pattern: "vortex",
        weight: 14,
        speed: 0.9,
        rarity: 25.8,
        hungerRate: 1.1,
        fertility: 1.6,
        personality: "berserk",
      },
    },
  ],
  // Редкость 36-50 (Легендарные) - СУПЕР РЕДКИЕ
  36: [
    {
      name: "Звездный император",
      type: "legendary",
      genes: {
        colors: ["#4B0082", "#8A2BE2"], // Индиго и сине-фиолетовый
        pattern: "galaxy",
        weight: 30,
        speed: 0.75,
        rarity: 42.7,
        hungerRate: 0.5,
        fertility: 2.2,
        personality: "imperial",
      },
    },
    {
      name: "Хаос-прыгун",
      type: "legendary",
      genes: {
        colors: ["#2F4F4F", "#708090"], // Темный грифельно-серый и грифельно-серый
        pattern: "chaos",
        weight: 20,
        speed: 1.0,
        rarity: 47.9,
        hungerRate: 1.3,
        fertility: 2.5,
        personality: "chaotic",
      },
    },
    {
      name: "Феникс-возрожденец",
      type: "legendary",
      genes: {
        colors: ["#FF8C00", "#FFA500"], // Темно-оранжевый и оранжевый
        pattern: "phoenix",
        weight: 22,
        speed: 0.85,
        rarity: 45.2,
        hungerRate: 0.6,
        fertility: 2.8,
        personality: "lucky",
      },
    },
  ],
};
// Функция для выбора редкости на основе весов
const getRandomRarity = (): number => {
  const totalWeight = RARITY_WEIGHTS.reduce(
    (sum, item) => sum + item.weight,
    0
  );
  let random = Math.random() * totalWeight;

  for (const rarity of RARITY_WEIGHTS) {
    if (random < rarity.weight) {
      // Линейное распределение внутри группы редкости
      return (
        rarity.minRarity + Math.random() * (rarity.maxRarity - rarity.minRarity)
      );
    }
    random -= rarity.weight;
  }

  return 12; // fallback в среднюю редкость
};

// Функция для получения типа на основе редкости
const getTypeByRarity = (rarity: number): string => {
  if (rarity >= 36) return "legendary";
  if (rarity >= 21) return "epic";
  if (rarity >= 11) return "rare";
  if (rarity >= 6) return "uncommon";
  return "common";
};

// Функция для поиска подходящего шаблона жабы по редкости
const findToadTemplate = (rarity: number): Partial<Toad> => {
  const roundedRarity = Math.floor(rarity);

  // Ищем ближайшую доступную группу редкости
  for (let r = roundedRarity; r >= 1; r--) {
    if (UNIQUE_TOADS_BY_RARITY[r] && UNIQUE_TOADS_BY_RARITY[r].length > 0) {
      const templates = UNIQUE_TOADS_BY_RARITY[r];
      return templates[Math.floor(Math.random() * templates.length)]!;
    }
  }

  // Fallback - редкая жаба (самая распространенная)
  return UNIQUE_TOADS_BY_RARITY[11]![0]!;
};

// Основная функция генерации жабы из лутбокса
export const generateLootboxToad = (): Toad => {
  const rarity = getRandomRarity();
  const type = getTypeByRarity(rarity);
  const template = findToadTemplate(rarity);

  // Генерация уникального ID
  const id = Date.now() + Math.floor(Math.random() * 1000);

  // Случайный пол
  const sex = Math.random() > 0.5 ? "male" : "female";

  // Базовые характеристики
  const baseToad: Toad = {
    id,
    name:
      template.name || `Таинственная жаба ${Math.floor(Math.random() * 1000)}`,
    type,
    generation: 1,
    sex,
    stage: "adult",
    scene_id: null,
    created_at: new Date().toISOString(),
    parents: null,
    state: {
      hunger: 30 + Math.floor(Math.random() * 20),
      genetic_fault: 0,
    },
    pregnancy: null,
    genes: {
      colors: template.genes?.colors
        ? [
            varyColor(template.genes?.colors[0]),
            varyColor(template.genes?.colors[1]),
          ]
        : ["#5D8C59", "#6B8C42"],
      pattern: template.genes?.pattern || "smooth",
      weight: template.genes?.weight || 18 + Math.floor(Math.random() * 8),
      speed: template.genes?.speed || 0.3 + Math.random() * 0.4,
      rarity: template.genes?.rarity || rarity,
      hungerRate: template.genes?.hungerRate || 0.8 + Math.random() * 0.6,
      fertility: template.genes?.fertility || 0.8 + Math.random() * 0.8,
      personality: template.genes?.personality || null,
    },
  };

  return baseToad;
};

// Дополнительная функция для получения информации о шансах (для UI)
export const getLootboxRarityChances = () => {
  const totalWeight = RARITY_WEIGHTS.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  return RARITY_WEIGHTS.map((rarity) => ({
    name: rarity.name,
    chance: ((rarity.weight / totalWeight) * 100).toFixed(1) + "%",
    minRarity: Math.floor(rarity.minRarity),
    maxRarity: Math.floor(rarity.maxRarity),
    description: getRarityDescription(rarity.name),
  }));
};

// Функция для описания редкости
const getRarityDescription = (rarityName: string): string => {
  switch (rarityName) {
    case "Обычная":
      return "Базовые жабы, отличный старт";
    case "Необычная":
      return "Улучшенные характеристики, хороший прогресс";
    case "Редкая":
      return "Самые распространенные в лутбоксах - отличный баланс";
    case "Эпическая":
      return "Мощные жабы с уникальными способностями";
    case "Легендарная":
      return "Невероятно редкие - большая удача!";
    default:
      return "Особая жаба";
  }
};
