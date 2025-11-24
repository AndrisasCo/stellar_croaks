import { personalities, Toad } from "../models/toad";
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

export const inheritTrait = (
  parents: number[],
  multiplier?: number
): number => {
  let average = getSum(parents) / parents.length;
  const mutation = Math.random() * 0.3 - 0.15; // -10% to +10%
  average *= 1 + mutation;

  if (multiplier) {
    return average * (0.7 + 0.3 * multiplier); // влияние мультиплайра
  }
  return average;
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

export const generateChildToad = (
  parents: Toad[],
  isCollider: boolean,
  chances?: { mutationChance: boolean; genesBreakChance: boolean }
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
    personalityTrait?.weightMultiplier
  );
  const childSpeed = inheritTrait(
    parents.map((p) => p.genes.speed),
    personalityTrait?.speedMultiplier
  );

  const hungerRate = inheritTrait(
    parents.map((p) => p.genes.hungerRate),
    personalityTrait.hungerRate
  );
  const fertility = inheritTrait(
    parents.map((p) => p.genes.fertility),
    personalityTrait.fertility
  );

  return {
    name: `Жаб-${generation}-${Math.floor(Math.random() * 1000)}`,
    type: "hybrid",
    description: isCollider
      ? `Гибридное поколение ${generation}. Унаследовал черты родителей.`
      : "Родился путем скрещивания",
    generation,
    parents: parents.map((p) => p.id),
    sex: getSex(isCollider, chances?.genesBreakChance || false),
    stage: "toadpole",
    scene_id: parents[0].scene_id,
    state: {
      hunger: 0,
    },
    genes: {
      colors: [childColor, childColor2],
      pattern: childPattern,
      weight: Math.round(childSize * 10) / 10,
      speed: Math.round(childSpeed * 100) / 100,
      rarity: childRarity,
      hungerRate,
      fertility,
      personality,
    },
    pregnancy: null,
    owner: parents[0].owner,
  };
};
