export enum ToadTypes {
  hybrid = "hybrid", // базовая жаба
  camouflage = "camouflage", // покупка | лутбокс 39.9
  mutant = "mutant", // 10% шанс получить в коллайдере
  turtle = "turtle", // задание: первый гибрид
  tiger = "tiger", // покупка | лутбокс 39.9
  stone = "stone", // лутбокс 10
  crystall = "crystall", // лутбокс 10
  crystallPink = "crystall_pink", // лутбокс 10
  forest = "forest", // лутбокс 10
  leopard = "leopard", // лутбокс 10

  topaz = "topaz", // задание: 12 покупок жаб
  mutantNeonBlue = "mutant_neon_blue", // задание: качество 25+
  mutantNeon = "mutant_neon", // задание: совершенный геном

  dragon = "dragon", // лутбокс 1
  fire = "fire", // лутбокс 1
  zebra = "zebra", // лутбокс 1

  cosmos = "cosmos", // лутбокс 0.1
  phoenix = "phoenix", // лутбокс 0.1
  chaos = "chaos", // лутбокс 0.1
  diamond = "diamond", // задание: 100 лутбоксов

  money = "money",
}

export const toadTypeMap: Record<ToadTypes, string> = {
  [ToadTypes.camouflage]: "Пятнистая",
  [ToadTypes.hybrid]: "Смешанная",
  [ToadTypes.tiger]: "Тигровая",
  [ToadTypes.mutant]: "Мутант",
  [ToadTypes.money]: "Денежная",
  [ToadTypes.stone]: "Каменная",
  [ToadTypes.chaos]: "Хаос",
  [ToadTypes.crystall]: "Кристальная",
  [ToadTypes.crystallPink]: "Розовая кристальная",
  [ToadTypes.forest]: "Лесная",
  [ToadTypes.dragon]: "Дракон",
  [ToadTypes.leopard]: "Леопардовая",
  [ToadTypes.fire]: "Огненная",
  [ToadTypes.zebra]: "Зебровая",
  [ToadTypes.turtle]: "Черепаховая",
  [ToadTypes.cosmos]: "Космическая",
  [ToadTypes.topaz]: "Топаз",
  [ToadTypes.phoenix]: "Феникс",
  [ToadTypes.mutantNeonBlue]: "Мутант Светящийся",
  [ToadTypes.mutantNeon]: "Мутант Светящийся",
  [ToadTypes.diamond]: "Алмазная",
};

/**
 * Жабы, которых можно красить пигментами: обычная (hybrid, в интерфейсе —
 * «Смешанная») и пятнистая (camouflage). У остальных видов окрас зашит в
 * спрайт, поэтому genes.colors на них не влияет — им нельзя менять цвет и
 * нельзя выдавать заказы на окрас.
 */
export const COLORABLE_TOAD_TYPES: readonly ToadTypes[] = [
  ToadTypes.hybrid,
  ToadTypes.camouflage,
];

export const isColorableToadType = (
  type: ToadTypes | null | undefined,
): boolean =>
  type !== null && type !== undefined && COLORABLE_TOAD_TYPES.includes(type);

// Тип для способа получения
export type ToadObtainedBy =
  | "start" // Начальная жаба
  | "quest" // Награда за задание журнала
  | "shop" // Торговая Капсула
  | "lootbox" // Лутбокс (общий)
  | "collider" // Случайно из коллайдера
  | "recipe" // По рецепту в коллайдере
  | "unknown"; // Полностью неизвестный вид

// Уровень шанса в лутбоксе (упрощенный)
export type LootboxChanceLevel =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythical";

export interface ToadSpeciesConfig {
  id: string;
  type: ToadTypes;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  desc: string;
  obtainedBy: ToadObtainedBy;

  // Опциональные поля для конкретики
  lootboxChanceLevel?: LootboxChanceLevel; // Уровень редкости в лутбоксе
  recipeHint?: string; // Подсказка к рецепту
  questId?: string; // ID задания, за которое даётся жаба

  // Для отображения в журнале
  hidden?: boolean; // true = совсем не показывать до получения
}

export const TOAD_SPECIES_CONFIG: ToadSpeciesConfig[] = [
  // --- COMMON (База / Туториал / Обычный Коллайдер) ---
  {
    id: "toad_hybrid",
    type: ToadTypes.hybrid,
    name: toadTypeMap[ToadTypes.hybrid],
    rarity: "common",
    desc: "Основа всей популяции. Надежная и неприхотливая.",
    obtainedBy: "start",
  },
  {
    id: "toad_camouflage",
    type: ToadTypes.camouflage,
    name: toadTypeMap[ToadTypes.camouflage],
    rarity: "common",
    desc: "Пятнистая вариация самой обыкновенной жабы.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "common",
  },
  {
    id: "toad_mutant",
    type: ToadTypes.mutant,
    name: toadTypeMap[ToadTypes.mutant],
    rarity: "common",
    desc: "Результат смелых экспериментов в коллайдере.",
    obtainedBy: "collider",
  },
  {
    id: "toad_tiger",
    type: ToadTypes.tiger,
    name: toadTypeMap[ToadTypes.tiger],
    rarity: "common",
    desc: "Полосатая хищница джунглей.",
    obtainedBy: "shop",
  },

  // --- RARE (Торговая Капсула / Лутбоксы / Награды за задания) ---
  {
    id: "toad_turtle",
    type: ToadTypes.turtle,
    name: toadTypeMap[ToadTypes.turtle],
    rarity: "rare",
    desc: "Медленная, мудрая и очень любит клубнику.",
    obtainedBy: "quest",
    questId: "q19-first-hybrid",
  },

  {
    id: "toad_stone",
    type: ToadTypes.stone,
    name: toadTypeMap[ToadTypes.stone],
    rarity: "rare",
    desc: "Крепкая, как скала. Не любит плавать.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "rare",
  },
  {
    id: "toad_crystall",
    type: ToadTypes.crystall,
    name: toadTypeMap[ToadTypes.crystall],
    rarity: "rare",
    desc: "Отражает свет и мысли окружающих.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "rare",
  },
  {
    id: "toad_crystall_pink",
    type: ToadTypes.crystallPink,
    name: toadTypeMap[ToadTypes.crystallPink],
    rarity: "rare",
    desc: "Яркая вариация редкого минерала.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "rare",
  },
  {
    id: "toad_forest",
    type: ToadTypes.forest,
    name: toadTypeMap[ToadTypes.forest],
    rarity: "rare",
    desc: "Дух чащи, пахнет хвоей и мхом.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "rare",
  },
  {
    id: "toad_leopard",
    type: ToadTypes.leopard,
    name: toadTypeMap[ToadTypes.leopard],
    rarity: "rare",
    desc: "Быстрая, пятнистая и очень грациозная.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "rare",
  },

  // --- EPIC (Награды за сложные задания) ---
  {
    id: "toad_topaz",
    type: ToadTypes.topaz,
    name: toadTypeMap[ToadTypes.topaz],
    rarity: "epic",
    desc: "Драгоценность, рожденная в тяжелом труде.",
    obtainedBy: "quest",
    questId: "m19-toad-trader",
  },
  {
    id: "toad_mutant_neon",
    type: ToadTypes.mutantNeon,
    name: toadTypeMap[ToadTypes.mutantNeon],
    rarity: "epic",
    desc: "Сияет радиацией и успехом.",
    obtainedBy: "quest",
    questId: "m24-perfect-genome",
  },
  {
    id: "toad_mutant_neon_blue",
    type: ToadTypes.mutantNeonBlue,
    name: toadTypeMap[ToadTypes.mutantNeonBlue],
    rarity: "epic",
    desc: "Холодное свечение генетического гения.",
    obtainedBy: "quest",
    questId: "m20-legendary-25",
  },

  {
    id: "toad_dragon",
    type: ToadTypes.dragon,
    name: toadTypeMap[ToadTypes.dragon],
    rarity: "epic",
    desc: "Древняя сила, пробужденная ото сна.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "epic",
  },
  {
    id: "toad_fire",
    type: ToadTypes.fire,
    name: toadTypeMap[ToadTypes.fire],
    rarity: "epic",
    desc: "Горячая штучка. Осторожно, обжигает!",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "epic",
  },
  {
    id: "toad_zebra",
    type: ToadTypes.zebra,
    name: toadTypeMap[ToadTypes.zebra],
    rarity: "epic",
    desc: "Уникальный черно-белый узор природы.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "epic",
  },

  // --- LEGENDARY (Лутбоксы высокой редкости) ---

  {
    id: "toad_cosmos",
    type: ToadTypes.cosmos,
    name: toadTypeMap[ToadTypes.cosmos],
    rarity: "legendary",
    desc: "В ее глазах отражается бесконечность вселенной.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "legendary",
  },
  {
    id: "toad_phoenix",
    type: ToadTypes.phoenix,
    name: toadTypeMap[ToadTypes.phoenix],
    rarity: "legendary",
    desc: "Возрождается из пепла после каждой переработки.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "legendary",
  },
  {
    id: "toad_chaos",
    type: ToadTypes.chaos,
    name: toadTypeMap[ToadTypes.chaos],
    rarity: "legendary",
    desc: "Чистая энтропия и непредсказуемость.",
    obtainedBy: "lootbox",
    lootboxChanceLevel: "legendary",
  },
  {
    id: "toad_diamond",
    type: ToadTypes.diamond,
    name: toadTypeMap[ToadTypes.diamond],
    rarity: "legendary",
    desc: "Самая редкая и ценная из всех жаб.",
    obtainedBy: "quest",
    questId: "m27-lootbox-100",
  },
  // {
  //   id: "toad_money",
  //   type: ToadTypes.money,
  //   name: toadTypeMap[ToadTypes.money],
  //   rarity: "legendary",
  //   desc: "Мифический символ абсолютного богатства.",
  //   obtainedBy: "unknown",
  //   hidden: true, // Секретная жаба, не показывать до получения
  // },
];

// Хелперы
export const getToadConfigByType = (
  type: ToadTypes,
): ToadSpeciesConfig | undefined => {
  return TOAD_SPECIES_CONFIG.find((toad) => toad.type === type);
};

export const getToadConfigById = (
  id: string,
): ToadSpeciesConfig | undefined => {
  return TOAD_SPECIES_CONFIG.find((toad) => toad.id === id);
};

// Функция для отображения подсказки по уровню шанса
export const getLootboxHint = (chanceLevel?: LootboxChanceLevel): string => {
  if (!chanceLevel) return "";

  const hints: Record<LootboxChanceLevel, string> = {
    common: "Часто встречается",
    rare: "Редкая находка",
    epic: "Очень редкая",
    legendary: "Невероятно редкая",
    mythical: "Легендарная Качество",
  };

  return hints[chanceLevel];
};

// Фильтр для отображения в журнале (скрываем полностью скрытых жаб)
export const getVisibleToads = (discoveredTypes: ToadTypes[]) => {
  return TOAD_SPECIES_CONFIG.filter((toad) => {
    // Если жаба скрыта и еще не получена - не показываем
    if (toad.hidden && !discoveredTypes.includes(toad.type)) {
      return false;
    }
    return true;
  });
};
