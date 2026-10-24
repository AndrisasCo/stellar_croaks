import { Toad } from "../models/Toad";

/**
 * Слегка рандомизирует характеристики жабы
 * @param toad - исходная жаба
 * @param variation - сила вариации (по умолчанию 0.1 = 10%)
 * @returns жаба с рандомизированными характеристиками
 */

export const generateRandomHexColor = () => {
  // Функция для генерации случайного числа в диапазоне
  const getRandomInRange = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  // Генерируем RGB компоненты
  // Ограничиваем диапазон, чтобы избежать слишком тёмных (< 50)
  // и слишком светлых (> 220) значений
  const r = getRandomInRange(50, 220);
  const g = getRandomInRange(50, 220);
  const b = getRandomInRange(50, 220);

  // Преобразуем в hex
  const toHex = (value: number) => value.toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const varyColor = (color: string): string => {
  if (!color.startsWith("#")) return color;

  // Преобразуем HEX в RGB
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Слегка изменяем каждый канал
  const varyChannel = (channel: number) => {
    const change = Math.floor((Math.random() * 2 - 1) * 30); // -30 до +30
    return Math.max(0, Math.min(255, channel + change));
  };

  const newR = varyChannel(r);
  const newG = varyChannel(g);
  const newB = varyChannel(b);

  return `#${newR.toString(16).padStart(2, "0")}${newG
    .toString(16)
    .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
};
export const randomizeToadCharacteristics = (
  toad: Partial<Toad>,
  variation: number = 0.1
): Partial<Toad> => {
  // Функция для легкого изменения числа
  const varyNumber = (value: number, min?: number, max?: number): number => {
    const change = (Math.random() * 2 - 1) * variation; // -variation до +variation
    let newValue = value * (1 + change);

    // Ограничиваем минимальное и максимальное значение если указаны
    if (min !== undefined) newValue = Math.max(min, newValue);
    if (max !== undefined) newValue = Math.min(max, newValue);

    return Number(newValue.toFixed(2));
  };

  // Функция для легкого изменения цвета

  // Случайный пол (если не указан)
  const randomSex = toad.sex || (Math.random() > 0.5 ? "male" : "female");

  // Клонируем жабу чтобы не мутировать оригинал
  const randomizedToad: Partial<Toad> = {
    ...toad,
    sex: randomSex,
    state: {
      ...toad.state,
      hunger: toad.state?.hunger ? varyNumber(toad.state.hunger, 10, 50) : 30,
    },
    genes: toad.genes
      ? {
          ...toad.genes,
          colors: toad.genes.colors?.map(varyColor) || ["#5D8C59", "#6B8C42"],
          weight: toad.genes.weight ? varyNumber(toad.genes.weight, 5, 30) : 15,
          speed: toad.genes.speed
            ? varyNumber(toad.genes.speed, 0.2, 1.0)
            : 0.4,
          rarity: toad.genes.rarity ? varyNumber(toad.genes.rarity) : 1.0,
          hungerRate: toad.genes.hungerRate
            ? varyNumber(toad.genes.hungerRate, 0.3, 2.0)
            : 1.0,
          fertility: toad.genes.fertility
            ? varyNumber(toad.genes.fertility, 0.5, 3.0)
            : 1.0,
        }
      : {
          colors: ["#5D8C59", "#6B8C42"],
          pattern: "smooth",
          weight: 15,
          speed: 1.0,
          rarity: 1.0,
          hungerRate: 1.0,
          fertility: 1.0,
          personality: null,
        },
  };

  return randomizedToad;
};

// Альтернативная версия с более простой рандомизацией (если нужен еще более легкий рандом)
export const lightlyRandomizeToad = (toad: Partial<Toad>): Partial<Toad> => {
  const lightlyVary = (value: number, min?: number, max?: number): number => {
    const change = Math.random() * 0.1 - 0.05; // всего ±5%
    let newValue = value * (1 + change);

    if (min !== undefined) newValue = Math.max(min, newValue);
    if (max !== undefined) newValue = Math.min(max, newValue);

    return Number(newValue.toFixed(2));
  };

  return {
    ...toad,
    state: toad.state
      ? {
          ...toad.state,
          hunger: toad.state.hunger
            ? lightlyVary(toad.state.hunger, 15, 45)
            : 30,
        }
      : undefined,
    genes: toad.genes
      ? {
          ...toad.genes,
          weight: toad.genes.weight
            ? lightlyVary(toad.genes.weight, 8, 25)
            : 15,
          speed: toad.genes.speed
            ? lightlyVary(toad.genes.speed, 0.3, 0.8)
            : 0.4,
          rarity: toad.genes.rarity
            ? lightlyVary(toad.genes.rarity, 0.8, 1.5)
            : 1.0,
          hungerRate: toad.genes.hungerRate
            ? lightlyVary(toad.genes.hungerRate, 0.5, 1.5)
            : 1.0,
          fertility: toad.genes.fertility
            ? lightlyVary(toad.genes.fertility, 0.7, 1.8)
            : 1.0,
        }
      : undefined,
  };
};
