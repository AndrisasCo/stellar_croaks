import { Toad } from ".";
import { varyColor } from "../../utils/randomize-toad-characteristics";
import { ToadTypes } from "./toad-species";

export enum LootboxRarity {
  legendary = "legendary",
  epic = "epic",
  rare = "rare",
  uncommon = "uncommon",
  common = "common",
}

// База данных уникальных жаб с разной Качеством
export const UNIQUE_TOADS_BY_RARITY: Record<LootboxRarity, Partial<Toad>[]> = {
  // Качество 1-5 (Обычные)
  [LootboxRarity.common]: [
    {
      name: "Лесной странник",
      type: ToadTypes.camouflage,
      genes: {
        colors: ["#8FBC8F", "#556B2F"], // Темно-зеленый и светло-зеленый
        pattern: "smooth",
        weight: 18,
        speed: 0.8,
        rarity: 2.5,
        hungerRate: 1.2,
        fertility: 0.8,
        personality: "calm",
      },
    },
    {
      name: "Болотный житель",
      type: ToadTypes.hybrid,
      genes: {
        colors: ["#6B8E23", "#9ACD32"], // Оливковый и желто-зеленый
        pattern: "spots",
        weight: 16,
        speed: 0.95,
        rarity: 3.8,
        hungerRate: 1.0,
        fertility: 1.0,
        personality: "sleepy",
      },
    },
  ],
  // Качество 6-10 (Необычные)
  [LootboxRarity.uncommon]: [
    {
      name: "Изумрудный прыгун",
      type: ToadTypes.camouflage,
      genes: {
        colors: ["#228B22", "#32CD32"], // Лесной зеленый и лаймовый
        pattern: "stripes",
        weight: 20,
        speed: 1.4,
        rarity: 5,
        hungerRate: 1.0,
        fertility: 1.2,
        personality: "hyperactive",
      },
    },
    {
      name: "Золотистый охотник",
      type: ToadTypes.tiger,
      genes: {
        colors: ["#DAA520", "#F0E68C"], // Золотистый и хаки
        pattern: "marbled",
        weight: 17,
        speed: 1,
        rarity: 5,
        hungerRate: 1.1,
        fertility: 1.1,
        personality: "hunter",
      },
    },
  ],
  // Качество 11-20 (Редкие) - САМАЯ РАСПРОСТРАНЕННАЯ
  [LootboxRarity.rare]: [
    {
      name: "Саванна",
      type: ToadTypes.leopard,
      genes: {
        colors: ["#4682B4", "#87CEEB"], // Стальной синий и небесно-голубой
        pattern: "glowing",
        weight: 15,
        speed: 1.6,
        rarity: 5,
        hungerRate: 0.9,
        fertility: 1.4,
        personality: "mysterious",
      },
    },
    {
      name: "Сапфировый призрак",
      type: ToadTypes.crystall,
      genes: {
        colors: ["#4682B4", "#87CEEB"], // Стальной синий и небесно-голубой
        pattern: "glowing",
        weight: 19,
        speed: 0.6,
        rarity: 5,
        hungerRate: 0.9,
        fertility: 1.4,
        personality: "mysterious",
      },
    },
    {
      name: "Камнелап",
      type: ToadTypes.stone,
      genes: {
        colors: ["#CD5C5C", "#F08080"], // Коралловый и светло-коралловый
        pattern: "flames",
        weight: 16,
        speed: 0.7,
        rarity: 5,
        hungerRate: 1.2,
        fertility: 1.3,
        personality: "energetic",
      },
    },
    {
      name: "Аметистовый мудрец",
      type: ToadTypes.crystallPink,
      genes: {
        colors: ["#9370DB", "#D8BFD8"], // Пурпурный и чертополох
        pattern: "crystal",
        weight: 21,
        speed: 0.74,
        rarity: 5,
        hungerRate: 0.8,
        fertility: 1.5,
        personality: "wise",
      },
    },
    {
      name: "Леший",
      type: ToadTypes.forest,
      genes: {
        colors: ["#2E8B57", "#66CDAA"], // Морской зеленый и бирюзовый
        pattern: "swirls",
        weight: 15,
        speed: 1.15,
        rarity: 5,
        hungerRate: 1.0,
        fertility: 1.4,
        personality: "explorer",
      },
    },
  ],
  // Качество 21-35 (Эпические) - ОЧЕНЬ РЕДКИЕ
  [LootboxRarity.epic]: [
    {
      name: "Кваккон",
      type: ToadTypes.dragon,
      genes: {
        colors: ["#B22222", "#DC143C"], // Кирпичный и малиновый
        pattern: "scales",
        weight: 25,
        speed: 0.7,
        rarity: 5,
        hungerRate: 0.7,
        fertility: 1.8,
        personality: "dominant",
      },
    },
    {
      name: "Монохром",
      type: ToadTypes.zebra,
      genes: {
        colors: ["#F5F5F5", "#D3D3D3"], // Белый дым и светло-серый
        pattern: "moonlight",
        weight: 12,
        speed: 0.8,
        rarity: 5,
        hungerRate: 0.6,
        fertility: 1.7,
        personality: "graceful",
      },
    },
    {
      name: "Игнис",
      type: ToadTypes.fire,
      genes: {
        colors: ["#20B2AA", "#48D1CC"], // Светло-морской и бирюзовый
        pattern: "vortex",
        weight: 14,
        speed: 0.9,
        rarity: 5,
        hungerRate: 1.1,
        fertility: 1.6,
        personality: "berserk",
      },
    },
  ],
  // Качество 36-50 (Легендарные) - СУПЕР РЕДКИЕ
  [LootboxRarity.legendary]: [
    {
      name: "Галактрон",
      type: ToadTypes.cosmos,
      genes: {
        colors: ["#4B0082", "#8A2BE2"], // Индиго и сине-фиолетовый
        pattern: "galaxy",
        weight: 30,
        speed: 0.75,
        rarity: 5,
        hungerRate: 0.5,
        fertility: 2.2,
        personality: "imperial",
      },
    },
    {
      name: "Хаос-прыгун",
      type: ToadTypes.chaos,
      genes: {
        colors: ["#2F4F4F", "#708090"], // Темный грифельно-серый и грифельно-серый
        pattern: "chaos",
        weight: 20,
        speed: 1.0,
        rarity: 5,
        hungerRate: 1.3,
        fertility: 2.5,
        personality: "chaotic",
      },
    },
    {
      name: "Белгарион",
      type: ToadTypes.phoenix,
      genes: {
        colors: ["#FF8C00", "#FFA500"], // Темно-оранжевый и оранжевый
        pattern: ToadTypes.phoenix,
        weight: 22,
        speed: 0.85,
        rarity: 5,
        hungerRate: 0.9,
        fertility: 2.8,
        personality: "lucky",
      },
    },
  ],
};

/**
 * Гарантия «неудачных» открытий. Счётчик хранится в localStorage: раньше он жил
 * в переменной модуля и обнулялся при каждой перезагрузке — жалость не работала
 * (аудит P2). Сюда же убран лишний console.log.
 */
const PITY_KEY = "toad_lootbox_pity";

const readPity = (): number => {
  const stored = Number(localStorage.getItem(PITY_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
};

const writePity = (value: number): void => {
  localStorage.setItem(PITY_KEY, String(value));
};

/**
 * Базовые шансы редкостей в процентах (сумма — 100).
 *
 * Редкий тир поднят с 12% до 22%. Необычные специально оставлены выше редких
 * (33% против 22%): гарантии по счётчику добавляют редким ~5–6 п.п., и при
 * равных базовых шансах редкие выпадали бы чаще необычных — это ломало
 * привычную иерархию редкости.
 */
export const LOOTBOX_RARITY_CHANCES: Record<LootboxRarity, number> = {
  [LootboxRarity.legendary]: 0.5,
  [LootboxRarity.epic]: 2.5,
  [LootboxRarity.rare]: 22,
  [LootboxRarity.uncommon]: 33,
  [LootboxRarity.common]: 42,
};

/** Порядок розыгрыша: от самого редкого тира к обычному */
const LOOTBOX_ROLL_ORDER: LootboxRarity[] = [
  LootboxRarity.legendary,
  LootboxRarity.epic,
  LootboxRarity.rare,
  LootboxRarity.uncommon,
  LootboxRarity.common,
];

/** Редкость по базовым шансам, без учёта гарантий */
const rollLootboxRarity = (): LootboxRarity => {
  const percent = Math.random() * 100; // [0, 100)
  let cumulative = 0;

  for (const rarity of LOOTBOX_ROLL_ORDER) {
    cumulative += LOOTBOX_RARITY_CHANCES[rarity];
    if (percent < cumulative) {
      return rarity;
    }
  }

  // Страховка на случай, если шансы в таблице перестанут давать ровно 100%
  return LootboxRarity.common;
};

const getToadRarity = (): LootboxRarity => {
  const pityCounter = readPity() + 1;
  writePity(pityCounter);

  if (pityCounter >= 50) {
    writePity(0);
    return LootboxRarity.epic;
  }

  // Гарантированная редкая не позже 10-й попытки без эпической/легендарной
  if (pityCounter % 10 === 0) {
    return LootboxRarity.rare;
  }

  const rarity = rollLootboxRarity();

  // Эпическая или легендарная — сбрасываем счётчик неудач
  if (rarity === LootboxRarity.epic || rarity === LootboxRarity.legendary) {
    writePity(0);
  }

  return rarity;
};

/**
 * Качество гена по тиру лутбокса. В шаблонах у всех жаб стоял `rarity: 5`, поэтому
 * «легендарная» жаба не отличалась Качеством от обычной (аудит P2): теперь тир коробки
 * видно и в характеристиках, с небольшим разбросом.
 */
const TIER_GENE_RARITY: Record<LootboxRarity, number> = {
  [LootboxRarity.common]: 3,
  [LootboxRarity.uncommon]: 5,
  [LootboxRarity.rare]: 8,
  [LootboxRarity.epic]: 11,
  [LootboxRarity.legendary]: 15,
};

const findToadTemplate = (rarity: LootboxRarity) => {
  const group = UNIQUE_TOADS_BY_RARITY[rarity];
  const roll = Math.floor(Math.random() * group.length);

  return group[roll];
};

// Основная функция генерации жабы из лутбокса
/**
 * Жаба из лутбокса. Биопод (`sceneId`) жабе назначает вызывающий код: склада жаб нет,
 * поэтому открывающий обязан найти свободное место (см. `utils/housing.ts`).
 * Место в биоподе и дом жабы (`homeId`) сверит `createToad` при создании.
 */
export const generateLootboxToad = (
  sceneId = 1,
): {
  baseToad: Toad;
  rarity: LootboxRarity;
} => {
  const rarity = getToadRarity();
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
    type: template.type as ToadTypes,
    generation: 1,
    sex,
    stage: "adult",
    scene_id: sceneId,
    homeId: sceneId,
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
      rarity:
        Math.round(
          TIER_GENE_RARITY[rarity] * (0.9 + Math.random() * 0.2) * 10,
        ) / 10,
      hungerRate: template.genes?.hungerRate || 0.8 + Math.random() * 0.6,
      fertility: template.genes?.fertility || 0.8 + Math.random() * 0.8,
      personality: template.genes?.personality || null,
    },
  };

  return { baseToad, rarity };
};
