import { personalities, Toad } from "../models/Toad";
import { ToadTypes } from "../models/Toad/toad-species";
import { getToadHomeId } from "./toad-location";

const getSum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export const calculateRarityBonus = (parentCount: number): number => {
  // Бонус редкости в зависимости от количества родителей
  const bonuses: { [key: number]: number } = {
    2: 0, // Базовый уровень
    3: 15,
    4: 25,
    5: 30,
  };
  return bonuses[parentCount] || 0;
};

export const mixColors = (colors: string[]): string => {
  // Average + random mutation (±20%)
  const mutate = (value: number) => {
    const mutation = Math.random() * 0.4 - 0.2;
    return Math.max(0, Math.min(255, Math.round(value * (1 + mutation))));
  };

  const getColorPartR = (color: string) => parseInt(color.slice(1, 3), 16);
  const getColorPartG = (color: string) => parseInt(color.slice(3, 5), 16);
  const getColorPartB = (color: string) => parseInt(color.slice(5, 7), 16);

  const r = mutate(getSum(colors.map(getColorPartR)) / colors.length);
  const g = mutate(getSum(colors.map(getColorPartG)) / colors.length);
  const b = mutate(getSum(colors.map(getColorPartB)) / colors.length);

  // RGB to HEX
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export const inheritTrait = (parents: number[], multiplier: number): number => {
  const average = getSum(parents) / parents.length;
  if (average > 100) {
    const mutation = Math.random() * 10 - 5; // -5 to +5
    return average + mutation + (multiplier * 10 - 10);
  }
  if (average > 30) {
    const mutation = Math.random() * 0.1 - 0.05; // -10% to +10%
    return average * (1 + mutation) * (0.7 + multiplier * 0.3);
  }
  const mutation = Math.random() * 0.2 - 0.1; // -10% to +10%
  return average * (1 + mutation) * (0.7 + multiplier * 0.3);
};

// макс редкость 1 + 0.9 + 0.5 = 2.4
// макс редкость если есть мутация 12.4
// мин редкость 1 +  -0.5 = 0.5
// мин редкость если есть мутация  10.5
export const calculateRarity = (
  parents: number[],
  mutationChance: boolean
): number => {
  let baseRarity = getSum(parents) / parents.length;
  baseRarity += 1;
  baseRarity += (3 * calculateRarityBonus(parents.length)) / 100;

  // Мутация - шанс на повышенную редкость
  if (mutationChance) {
    return baseRarity + 10 * Math.random(); // Сильнее мутации + 0-10 ед
  }

  // Небольшие вариации
  const variation = Math.random() - 0.5; // -0.5 / + 0.5
  return Math.max(0, baseRarity + variation);
};

export const calculateBreedingTime = (
  rarity: number,
  speedMultiplier: number = 1
): number => {
  // Базовое время: 2 часов для средней редкости (50)
  const baseTime = 60 * 60 * 1000; // 1 часов в миллисекундах
  const rarityFactor = rarity / 50; // Чем выше редкость, тем дольше
  const time = baseTime * rarityFactor;

  return time / speedMultiplier;
};

const getSex = (isCollider: boolean, genesBreakChance: boolean) => {
  if (isCollider && genesBreakChance) {
    // 30% вероятности бесполой жабы
    return "neuter";
  }

  return Math.random() < 0.51 ? "male" : "female";
};

export const assignRandomPersonality = (): string | null => {
  // 90% вероятность назначить личность
  if (Math.random() > 0.9) {
    return null;
  }

  // Получаем все ключи (имена личностей)
  const personalityKeys = Object.keys(personalities);

  // Выбираем случайный ключ
  const randomIndex = Math.floor(Math.random() * personalityKeys.length);

  return personalityKeys[randomIndex];
};

// Функция для проверки родственных связей
const calculateInbreedingLevel = (parents: Toad[]): number => {
  const parent1 = parents[0];
  const parent2 = parents[1];

  // Проверяем, являются ли жабы прямыми родственниками (родитель-ребенок)
  if (
    parent1.parents?.includes(parent2.id) ||
    parent2.parents?.includes(parent1.id)
  ) {
    return 0.8; // Высокий уровень инбридинга
  }

  // Проверяем общих родителей
  const commonParents =
    parent1.parents?.filter((parentId) =>
      parent2.parents?.includes(parentId)
    ) || [];

  if (commonParents.length === 2) {
    return 0.6; // Оба родителя общие (брат-сестра)
  } else if (commonParents.length === 1) {
    return 0.4; // Один общий родитель (полу-брат/сестра)
  }

  return 0; // Нет близкородственных связей
};

// Функция для расчета генетической поломки потомства
const calculateGeneticFault = (
  parents: Toad[],
  isCollider: boolean,
  inbreedingLevel: number
): number => {
  const parentFaults = parents.map((p) => p.state?.genetic_fault || 0);
  const maxParentFault = Math.max(...parentFaults);
  const avgParentFault = getSum(parentFaults) / parentFaults.length;

  if (isCollider) {
    // Коллайдер: берем максимальную поломку и умножаем на коэффициент
    const colliderMultiplier = 1.2;
    const baseFault =
      ((maxParentFault + avgParentFault) / 2) * colliderMultiplier + 7;

    // Добавляем случайную вариацию
    const randomVariation = Math.random() * 5;
    return Math.min(100, baseFault + randomVariation);
  } else {
    // Учитываем инбридинг
    if (inbreedingLevel > 0) {
      // 08 06 04
      const inbreedingPenalty = inbreedingLevel * 10; // Штраф за инбридинг
      return avgParentFault + inbreedingPenalty;
    }
    // Естественное размножение: мягкое сокращение поломки
    const naturalReduction = 0.7; // Уменьшение на 30%
    let baseFault = avgParentFault * naturalReduction;

    // Небольшая случайная вариация
    const randomVariation = (Math.random() - 0.5) * 5; // -2.5 to +2.5
    return Math.max(0, Math.min(100, baseFault + randomVariation));
  }
};

const getType = (parents: Toad[]) => {
  const isType = parents.reduce(
    (_, curr) => curr.type === parents[0].type,
    true
  );

  if (isType) {
    return parents[0].type;
  }

  const breedToad = parents.find(
    (p) => p.type && [ToadTypes.camouflage].includes(p.type)
  );

  if (breedToad) {
    return Math.random() < 0.25 ? breedToad.type : ToadTypes.hybrid;
  }
  return parents.map((p) => p.type)[Math.floor(Math.random() * parents.length)];
};

export const generateChildToad = (
  parents: Toad[],
  isCollider: boolean,
  chances?: {
    mutationChance: boolean;
    genesBreakChance: boolean;
    isMutant: boolean;
  }
): Partial<Toad> => {
  const childColor = mixColors(parents.map((p) => p.genes.colors[0]));
  const childColor2 = mixColors(
    parents.map((p) => p.genes.colors[1]).filter(Boolean)
  );

  // Наследование типа окраски
  const patterns = parents.map((p) => p.genes.pattern);
  const childPattern = patterns[Math.floor(Math.random() * patterns.length)];

  const generation = Math.max(...parents.map((p) => p.generation)) + 1;
  const childRarity = isCollider
    ? calculateRarity(
        parents.map((p) => p.genes.rarity),
        chances?.mutationChance || false
      )
    : (parents[0].genes.rarity + parents[1].genes.rarity) / 2 +
      Math.ceil(Math.random() * 3) / 10;

  const personality = assignRandomPersonality();
  const personalityTrait =
    personalities[personality as keyof typeof personalities];

  const childSize = inheritTrait(
    parents.map((p) => p.genes.weight),
    personalityTrait?.weightMultiplier || 1
  );
  const childSpeed = inheritTrait(
    parents.map((p) => p.genes.speed),
    personalityTrait?.speedMultiplier || 1
  );

  const hungerRate = inheritTrait(
    parents.map((p) => p.genes.hungerRate),
    personality ? personalityTrait.hungerRate : 1
  );

  const fertility = inheritTrait(
    parents.map((p) => p.genes.fertility),
    personality ? personalityTrait.fertility : 1
  );

  // Расчет генетической поломки
  const inbreedingLevel = isCollider
    ? 0
    : calculateInbreedingLevel(parents);
  const geneticFault = Math.round(
    calculateGeneticFault(parents, isCollider, inbreedingLevel)
  );

  return {
    name: `Жаб-${generation}-${Math.floor(Math.random() * 1000)}`,
    type: chances?.isMutant ? ToadTypes.mutant : getType(parents),
    generation,
    parents: parents.map((p) => p.id),
    sex:
      geneticFault === 100
        ? "neuter"
        : getSex(isCollider, chances?.genesBreakChance || false),
    stage: "toadpole",
    // Дом первого родителя — ориентир для потомства: место в биоподе ребёнку выдаст
    // `assignToadsToScenes` (или `createToad`, если его несли в инкубатор коллайдера)
    homeId: getToadHomeId(parents[0]),
    state: {
      hunger: 0,
      genetic_fault: geneticFault, // Округляем до целого числа
    },
    genes: {
      colors: [childColor, childColor2],
      pattern: childPattern,
      weight: Math.round(childSize * 100) / 100,
      speed: Math.round(childSpeed * 100) / 100,
      rarity: childRarity,
      hungerRate,
      fertility,
      personality,
    },
    pregnancy: null,
  };
};
