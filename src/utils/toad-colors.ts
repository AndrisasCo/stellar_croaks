import type { Toad } from "../models/Toad";

/**
 * Приблизительные группы окраса жаб.
 *
 * Цвет жабы хранится как HEX-строка (`genes.colors[0]`), а игроку и заказам нужны
 * человеческие группы вроде «красная» или «болотная». Точное совпадение HEX здесь
 * бесполезно: потомство смешивает цвета и мутирует, поэтому один и тот же «красный»
 * у разных жаб отличается на десятки единиц RGB. Классифицируем по HSL-диапазонам —
 * этого достаточно, чтобы под заказ на красный окрас попадала целая группа оттенков.
 */
export type ToadColorGroup =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "white"
  | "gray"
  | "black";

export interface ToadColorGroupConfig {
  id: ToadColorGroup;
  /** Название для интерфейса: «Красный», «Зелёный» и т.д. */
  label: string;
  /** Образец цвета для маркера заказа */
  sample: string;
  /** Базовая награда за заказ: редкие/сложные окрасы стоят дороже */
  reward: number;
}

/**
 * Конфиг групп окраса. Порядок не важен — классификация идёт по HSL-правилам ниже.
 * Награды держим рядом с цветом: заказ на белого/чёрного сложнее, чем на красного,
 * которого можно получить обычным красным пигментом.
 */
export const TOAD_COLOR_GROUPS: ToadColorGroupConfig[] = [
  { id: "red", label: "Красный", sample: "#D14B3F", reward: 20 },
  { id: "orange", label: "Оранжевый", sample: "#E8832E", reward: 25 },
  { id: "yellow", label: "Жёлтый", sample: "#E8CF3B", reward: 20 },
  { id: "green", label: "Зелёный", sample: "#5D8C59", reward: 15 },
  { id: "cyan", label: "Голубой", sample: "#3FB8C4", reward: 25 },
  { id: "blue", label: "Синий", sample: "#4056C7", reward: 20 },
  { id: "purple", label: "Фиолетовый", sample: "#8253C7", reward: 25 },
  { id: "pink", label: "Розовый", sample: "#D95FA8", reward: 30 },
  { id: "brown", label: "Коричневый", sample: "#8B4513", reward: 20 },
  { id: "white", label: "Белый", sample: "#F2F2F7", reward: 35 },
  { id: "gray", label: "Серый", sample: "#8A8A8A", reward: 30 },
  { id: "black", label: "Чёрный", sample: "#1A1A1A", reward: 40 },
];

export const TOAD_COLOR_GROUP_BY_ID = TOAD_COLOR_GROUPS.reduce(
  (groups, group) => {
    groups[group.id] = group;
    return groups;
  },
  {} as Record<ToadColorGroup, ToadColorGroupConfig>
);

export const TOAD_COLOR_GROUP_IDS = TOAD_COLOR_GROUPS.map(
  (group) => group.id
);

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  /** Тон, 0–360 */
  h: number;
  /** Насыщенность, 0–1 */
  s: number;
  /** Светлота, 0–1 */
  l: number;
}

/** Разбирает `#RGB`, `#RRGGBB` (регистр не важен). Невалидный цвет → null. */
export const parseHexColor = (color: string | null | undefined): RgbColor | null => {
  if (!color) {
    return null;
  }

  const normalized = color.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

/** RGB → HSL. Нужен только для приблизительной группировки окраса. */
export const rgbToHsl = ({ r, g, b }: RgbColor): HslColor => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }

    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return { h: hue, s: saturation, l: lightness };
};

/**
 * Приблизительная группа окраса по HSL.
 *
 * Границы специально не совпадают с «идеальными» секторами: коричневый — это тёмный
 * оранжевый, поэтому его выносим отдельно; почти белые и почти чёрные оттенки
 * относим к white/black независимо от тона, иначе разбелённый пигмент считался бы
 * насыщенным цветом. Остальные оттенки попадают в соседнюю группу по тону.
 */
export const getColorGroupFromHex = (
  color: string | null | undefined
): ToadColorGroup | null => {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return null;
  }

  const { h, s, l } = rgbToHsl(rgb);

  if (l <= 0.14) {
    return "black";
  }
  // Почти белый цвет может иметь высокую HSL-насыщенность: у #F0F8FF каналы
  // отличаются всего на 15 единиц, но формула даёт s = 1. Поэтому очень светлые
  // оттенки ловим по светлоте, а не только по насыщенности.
  if (l >= 0.94 || (l >= 0.9 && s <= 0.35)) {
    return "white";
  }
  if (s <= 0.1) {
    return "gray";
  }

  // Коричневый: тёмный оранжево-жёлтый. Светлые оттенки того же тона — уже orange.
  if (h >= 15 && h < 50 && l < 0.44) {
    return "brown";
  }

  if (h < 15 || h >= 345) {
    return "red";
  }
  if (h < 40) {
    return "orange";
  }
  if (h < 68) {
    return "yellow";
  }
  if (h < 165) {
    return "green";
  }
  if (h < 195) {
    return "cyan";
  }
  if (h < 255) {
    return "blue";
  }
  if (h < 295) {
    return "purple";
  }
  return "pink";
};

/** Основной (первый) цвет жабы — именно им её тонирует канвас. */
export const getToadColorGroup = (toad: Toad): ToadColorGroup | null =>
  getColorGroupFromHex(toad.genes?.colors?.[0]);

/** Подходит ли жаба под группу окраса (приблизительно, по основному цвету). */
export const toadMatchesColorGroup = (
  toad: Toad,
  group: ToadColorGroup
): boolean => getToadColorGroup(toad) === group;

/** Подпись группы для интерфейса. */
export const getToadColorGroupLabel = (group: ToadColorGroup): string =>
  TOAD_COLOR_GROUP_BY_ID[group]?.label ?? "Неизвестный";
