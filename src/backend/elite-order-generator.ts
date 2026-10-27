import { personalities } from "../models/Toad";
import type { Toad } from "../models/Toad";
import { DAY_MS } from "../utils/date";
import { isColorableToadType } from "../models/Toad/toad-species";
import {
  TOAD_COLOR_GROUP_BY_ID,
  TOAD_COLOR_GROUP_IDS,
  toadMatchesColorGroup,
} from "../utils/toad-colors";
import type { ToadColorGroup } from "../utils/toad-colors";

/**
 * Скриптованные элитные заказы.
 *
 * Вместо ещё одного десятка ручных предикатов витрина собирает заказы из трёх
 * сценариев: случайный характер, случайный окрас и случайный порог характеристики.
 * Выбранные параметры кодируются в `id` (например,
 * `scripted_v1/personality/ninja/2/90`), поэтому заказ можно восстановить после
 * перезагрузки, хотя в `ShopState` по-прежнему лежит только массив строк.
 *
 * `id` — это фактически сохранённый контракт заказа. Меняя формат, добавляйте новую
 * версию префикса и поддержку старой, иначе уже выданные заказы перестанут открываться.
 */

export type EliteDifficulty = "easy" | "medium" | "hard" | "extreme";

export interface EliteOrder {
  id: string;
  title: string;
  description: string;
  requirement: (toad: Toad) => boolean;
  reward: number;
  difficulty: EliteDifficulty;
  /** Цветовой маркер для заказов на окрас */
  colorSwatch?: string;
}

export type ScriptedEliteKind = "personality" | "color" | "stat";

export const SCRIPTED_ELITE_KINDS: ScriptedEliteKind[] = [
  "personality",
  "color",
  "stat",
];

const SCRIPTED_ID_PREFIX = "scripted_v1";
/** Потолок награды после ребаланса: дороже самого редкого кураторского заказа. */
const MAX_SCRIPTED_REWARD = 100;
/** Старые id (до ребаланса) содержат награды до ~460 💎 — их принимаем, но урезаем. */
const PERSONALITY_TITLES = [
  "Охота за характером",
  "Редкая натура",
  "Темперамент на заказ",
  "Жаба с изюминкой",
];

const COLOR_TITLES = [
  "Палитра болота",
  "Жаба в цвете",
  "Коллекционер оттенков",
  "Оттенок имеет значение",
];

/**
 * Базовая награда за заказ на характер. До оптимизации астро-экономики здесь
 * стояло 90 💎: одна простая сдача давала 9 лутбоксов и обесценивала походы.
 * Теперь простая сдача — это 3 лутбокса, а редкие условия идут отдельно выше.
 */
const PERSONALITY_REWARD = 30;

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomItem = <T>(items: readonly T[]): T =>
  items[randomInt(0, items.length - 1)];

const roundNumber = (value: number, digits = 2): number =>
  Number(value.toFixed(digits));

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

/**
 * Порог сложности считается по награде уже в новой шкале: максимум скриптованного
 * заказа — около 135 💎, поэтому extreme начинается со 120, а не с 400.
 */
const getDifficulty = (reward: number): EliteDifficulty => {
  if (reward >= 120) {
    return "extreme";
  }
  if (reward >= 60) {
    return "hard";
  }
  if (reward >= 30) {
    return "medium";
  }
  return "easy";
};

const roundReward = (value: number): number =>
  Math.max(5, Math.round(value / 5) * 5);

interface StatScriptConfig {
  id: string;
  titles: string[];
  min: number;
  max: number;
  step: number;
  read: (toad: Toad) => number;
  describe: (threshold: number) => string;
  reward: (threshold: number) => number;
}

/**
 * Пороги подобраны по реальным диапазонам генов: масса обычно 5–30, скорость до 1.0
 * (мутации могут дать больше), фертильность до 3.0 у рынка и выше у потомства.
 * Максимумы не берём «космические», иначе заказ будет формально существовать,
 * но никогда не найти подходящую жабу.
 */
const STAT_SCRIPTS: StatScriptConfig[] = [
  {
    id: "weight",
    titles: ["Тяжеловес", "Весомый аргумент", "Болотный гигант"],
    min: 18,
    max: 45,
    step: 1,
    read: (toad) => toad.genes.weight,
    describe: (threshold) =>
      `Жаба с массой не менее ${formatNumber(threshold)}`,
    reward: (threshold) => roundReward(25 + threshold),
  },
  {
    id: "speed",
    titles: ["Скорость света", "Быстрее ветра", "Реактивный прыжок"],
    min: 1.2,
    max: 3,
    step: 0.05,
    read: (toad) => toad.genes.speed,
    describe: (threshold) =>
      `Жаба со скоростью не менее ${formatNumber(threshold)}`,
    reward: (threshold) => roundReward(35 + (threshold - 0.75)),
  },
  {
    id: "fertility",
    titles: ["Демограф", "Плодовитый род", "Фабрика головастиков"],
    min: 1.5,
    max: 3.5,
    step: 0.1,
    read: (toad) => toad.genes.fertility,
    describe: (threshold) =>
      `Жаба с плодовитостью не менее ${formatNumber(threshold)}`,
    reward: (threshold) => roundReward(30 + (threshold - 1.5)),
  },
  {
    id: "rarity",
    titles: ["Редкий экземпляр", "Жемчужина коллекции", "Уникальная находка"],
    min: 2,
    max: 8,
    step: 0.5,
    read: (toad) => toad.genes.rarity,
    describe: (threshold) =>
      `Жаба с Качеством не менее ${formatNumber(threshold)}`,
    reward: (threshold) => roundReward(20 + (threshold - 2)),
  },
  {
    id: "generation",
    titles: ["Древний род", "Наследие поколений", "Хранитель крови"],
    min: 2,
    max: 8,
    step: 1,
    read: (toad) => toad.generation,
    describe: (threshold) =>
      `Жаба с поколением не менее ${formatNumber(threshold)}`,
    reward: (threshold) => roundReward(20 + threshold),
  },
  {
    id: "ageDays",
    titles: ["Проверенный временем", "Ветеран пруда", "Долгожитель"],
    min: 2,
    max: 10,
    step: 1,
    read: (toad) =>
      Math.floor((Date.now() - new Date(toad.created_at).getTime()) / DAY_MS),
    describe: (threshold) =>
      `Жаба возрастом не менее ${formatNumber(threshold)} дн.`,
    reward: (threshold) => roundReward(5 + (threshold - 2)),
  },
];

const STAT_SCRIPT_BY_ID = STAT_SCRIPTS.reduce(
  (scripts, script) => {
    scripts[script.id] = script;
    return scripts;
  },
  {} as Record<string, StatScriptConfig>,
);

const buildId = (kind: ScriptedEliteKind, ...parts: string[]): string =>
  [SCRIPTED_ID_PREFIX, kind, ...parts].join("/");

const parseVariant = (
  value: string | undefined,
  count: number,
): number | null => {
  if (!value) {
    return null;
  }

  const variant = Number.parseInt(value, 10);
  if (!Number.isInteger(variant) || variant < 0) {
    return null;
  }

  return variant % count;
};

const parseReward = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }

  const reward = Number(value);
  if (!Number.isFinite(reward) || reward <= 0 || reward > 101) {
    return null;
  }

  // Заказы, выданные до ребаланса, хранят старую награду в id. Не выбрасываем их
  // с витрины, но и не позволяем забрать старые сотни астро — урезаем до потолка.
  return Math.min(MAX_SCRIPTED_REWARD, Math.round(reward));
};

const parseThreshold = (
  value: string | undefined,
  config: StatScriptConfig,
): number | null => {
  if (!value) {
    return null;
  }

  const threshold = Number(value);
  if (!Number.isFinite(threshold)) {
    return null;
  }

  if (threshold < config.min || threshold > config.max) {
    return null;
  }

  return threshold;
};

const buildPersonalityOrder = (
  key: string,
  variant: number,
  reward: number,
): EliteOrder => {
  const label = personalities[key as keyof typeof personalities].label;

  return {
    id: buildId("personality", key, String(variant), String(reward)),
    title: PERSONALITY_TITLES[variant],
    description: `Жаба с характером «${label}»`,
    requirement: (toad) => toad.genes.personality === key,
    reward,
    difficulty: getDifficulty(reward),
  };
};

const buildColorOrder = (
  group: ToadColorGroup,
  variant: number,
  reward: number,
): EliteOrder => {
  const config = TOAD_COLOR_GROUP_BY_ID[group];

  return {
    id: buildId("color", group, String(variant), String(reward)),
    title: COLOR_TITLES[variant],
    // «Приблизительно» — часть условия: игрок должен понимать, что ищется не
    // конкретный HEX, а группа оттенков. Красить можно только обычную и
    // пятнистую жабу, поэтому заказ не должен приниматься за другие виды.
    description: `Основной окрас — ${config.label.toLowerCase()} `,
    requirement: (toad) =>
      isColorableToadType(toad.type) && toadMatchesColorGroup(toad, group),
    reward,
    difficulty: getDifficulty(reward),
    colorSwatch: config.sample,
  };
};

const buildStatOrder = (
  config: StatScriptConfig,
  threshold: number,
  variant: number,
  reward: number,
): EliteOrder => ({
  id: buildId(
    "stat",
    config.id,
    formatNumber(threshold),
    String(variant),
    String(reward),
  ),
  title: config.titles[variant],
  description: config.describe(threshold),
  requirement: (toad) => config.read(toad) >= threshold,
  reward,
  difficulty: getDifficulty(reward),
});

/**
 * Восстанавливает скриптованный заказ из `id`. Возвращает null для чужих id
 * (кураторские заказы ищутся в `shop-state.ts`) и для повреждённых/устаревших записей.
 */
export const getScriptedEliteOrder = (id: string): EliteOrder | null => {
  const [prefix, kind, ...parts] = id.split("/");

  if (prefix !== SCRIPTED_ID_PREFIX) {
    return null;
  }

  if (kind === "personality" && parts.length === 3) {
    const [key, variantToken, rewardToken] = parts;

    if (!key || !(key in personalities)) {
      return null;
    }

    const variant = parseVariant(variantToken, PERSONALITY_TITLES.length);
    const reward = parseReward(rewardToken);
    if (variant === null || reward === null) {
      return null;
    }

    return buildPersonalityOrder(key, variant, reward);
  }

  if (kind === "color" && parts.length === 3) {
    const [groupToken, variantToken, rewardToken] = parts;

    if (
      !groupToken ||
      !TOAD_COLOR_GROUP_IDS.includes(groupToken as ToadColorGroup)
    ) {
      return null;
    }

    const variant = parseVariant(variantToken, COLOR_TITLES.length);
    const reward = parseReward(rewardToken);
    if (variant === null || reward === null) {
      return null;
    }

    return buildColorOrder(groupToken as ToadColorGroup, variant, reward);
  }

  if (kind === "stat" && parts.length === 4) {
    const [statId, thresholdToken, variantToken, rewardToken] = parts;
    const config = statId ? STAT_SCRIPT_BY_ID[statId] : undefined;

    if (!config) {
      return null;
    }

    const threshold = parseThreshold(thresholdToken, config);
    const variant = parseVariant(variantToken, config.titles.length);
    const reward = parseReward(rewardToken);
    if (threshold === null || variant === null || reward === null) {
      return null;
    }

    return buildStatOrder(config, threshold, variant, reward);
  }

  return null;
};

const randomPersonalityOrder = (): EliteOrder => {
  const key = randomItem(Object.keys(personalities));
  const variant = randomInt(0, PERSONALITY_TITLES.length - 1);

  return buildPersonalityOrder(key, variant, PERSONALITY_REWARD);
};

const randomColorOrder = (): EliteOrder => {
  const group = randomItem(TOAD_COLOR_GROUP_IDS);
  const config = TOAD_COLOR_GROUP_BY_ID[group];
  const variant = randomInt(0, COLOR_TITLES.length - 1);

  return buildColorOrder(group, variant, config.reward);
};

const randomStatOrder = (): EliteOrder => {
  const config = randomItem(STAT_SCRIPTS);
  const steps = Math.round((config.max - config.min) / config.step);
  const threshold = roundNumber(config.min + randomInt(0, steps) * config.step);
  const variant = randomInt(0, config.titles.length - 1);
  const reward = roundReward(config.reward(threshold));

  return buildStatOrder(config, threshold, variant, reward);
};

/** Создаёт новый случайный заказ выбранного сценария. */
export const createScriptedEliteOrder = (
  kind: ScriptedEliteKind,
): EliteOrder => {
  switch (kind) {
    case "personality":
      return randomPersonalityOrder();
    case "color":
      return randomColorOrder();
    case "stat":
      return randomStatOrder();
  }
};
