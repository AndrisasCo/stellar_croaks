import { getPersonalityMultipliers, Toad } from "../models/Toad";
import { BonusType, getBoostByScene, Scene } from "../models/scene";
import { getDiseasePenaltyMultiplier } from "../models/disease";

// === Размножение: энергия и cooldown (Часть 3.2) ===

/** Максимальный запас «сил» жабы */
export const MAX_ENERGY = 100;
/** Пассивное восстановление энергии: +1 за 10 минут */
export const ENERGY_REGEN_PER_HOUR = 6;
/** Базовая стоимость спаривания (энергия) */
export const BREED_ENERGY_BASE = 25;
/** Базовый расход биомассы на одно спаривание */
export const BREED_BIOMASS_BASE = 8;
/** Базовый отдых после скрещивания — 10 минут */
export const BREED_COOLDOWN_BASE_MS = 10 * 60 * 1000;
/** Базовое число родильных слотов на купол (постройка «Гнездо») */
export const NEST_BASE_SLOTS = 2;

// === Фарм биомассы (Часть 3.3) ===

/** Мягкое выгорание голода за реальные сутки */
export const HUNGER_PER_DAY = 40;
/** Базовая выработка биомассы взрослой жабой в час */
export const BIOMASS_PER_TOAD_HOUR = 2.1;
/** Расход биомассы на содержание одной жабы в час (апкипинг) */
export const UPKEEP_PER_TOAD_HOUR = 0.6;
/** При голоде ниже порога выработка падает до нуля */
export const PRODUCTION_MIN_HUNGER = 30;
/** Курс обмена биомассы на Кваксы (2 биомассы = 1 квакс) */
export const BIOMASS_TO_TOKENS_RATE = 0.5;

// === Диссоциатор: жаба → биомасса (утилизация) ===

/** Неснижаемая часть выхода биомассы при разборе жабы */
export const DISSOLVE_BASE_BIOMASS = 2;
/** Вклад редкости в выход биомассы */
export const DISSOLVE_RARITY_RATE = 1.5;
/** Головастик даёт меньше биомассы, чем взрослая жаба */
export const DISSOLVE_TADPOLE_FACTOR = 0.35;
/** Бесполая жаба теряет часть массы (разбор всё равно выгоден) */
export const DISSOLVE_NEUTER_FACTOR = 0.6;
/** Сколько жаб можно разобрать за один заход */
export const DISSOLVE_MAX_BATCH = 5;

// Множители cooldown по характеру: быстрые / медленные
const COOLDOWN_PERSONALITY: Record<string, number> = {
  energetic: 0.7,
  hyperactive: 0.8,
  passionate: 0.8,
  playboy: 0.85,
  sleepy: 1.5,
  zombie: 1.6,
  ascetic: 1.4,
  hermit: 1.3,
  robot: 1.2,
};

/** Текущая энергия жабы (с учётом дефолта для старых сейвов) */
export const getToadEnergy = (toad: Toad): number => {
  const energy = toad.energy ?? MAX_ENERGY;
  return Math.max(0, Math.min(MAX_ENERGY, energy));
};

/** Множитель отдыха по характеру жабы (быстрые / медленные) */
export const getPersonalityCooldownMultiplier = (
  personality?: string | null
): number => COOLDOWN_PERSONALITY[personality ?? ""] ?? 1;

/** Стоимость спаривания в энергии: base × (1 + rarity/20) */
export const getEnergyCost = (toad: Toad): number =>
  Math.round(BREED_ENERGY_BASE * (1 + toad.genes.rarity / 20));

/** Стоимость спаривания в биомассе */
export const getBreedBiomassCost = (toad: Toad): number =>
  Math.round(BREED_BIOMASS_BASE * (1 + toad.genes.rarity / 20));

/** Полная стоимость пары в биомассе: самец + самка */
export const getBreedPairBiomassCost = (male: Toad, female: Toad): number =>
  getBreedBiomassCost(male) + getBreedBiomassCost(female);

/** Отдых после скрещивания: base × (1 + rarity/10) × характер / бонус сцены */
export const getBreedCooldownMs = (
  toad: Toad,
  withSceneBoost = true
): number => {
  const personalityMult = getPersonalityCooldownMultiplier(
    toad.genes.personality
  );
  const base =
    BREED_COOLDOWN_BASE_MS * (1 + toad.genes.rarity / 10) * personalityMult;
  if (!withSceneBoost) {
    return base;
  }

  const boost = getBoostByScene(toad.scene_id, BonusType.pregnancy);
  return base / boost;
};

/** Готова ли жаба к скрещиванию прямо сейчас */
export const isToadReadyToBreed = (toad: Toad, now = Date.now()): boolean => {
  if (toad.stage !== "adult") return false;
  if (toad.pregnancy?.isPregnant) return false;
  if ((toad.breedCooldownUntil ?? 0) > now) return false;
  return getToadEnergy(toad) >= getEnergyCost(toad);
};

/** Множитель выработки биомассы в зависимости от голода (0 при голоде) */
export const getProductionFactor = (hunger: number): number => {
  if (hunger <= PRODUCTION_MIN_HUNGER) return 0;
  return (hunger - PRODUCTION_MIN_HUNGER) / (100 - PRODUCTION_MIN_HUNGER);
};

/**
 * Потенциальная выработка жабы в час (до голода, болезней и ранений).
 * По ней считаются «нормы» вне фермы: например, сколько та же команда принесла бы
 * биомассы за время похода (Часть 5.4: поход обязан быть выгоднее фермы).
 */
export const getBiomassPotentialRate = (toad: Toad): number => {
  if (toad.stage !== "adult") return 0;

  const { weightMultiplier } = getPersonalityMultipliers(toad.genes.personality);

  return (
    BIOMASS_PER_TOAD_HOUR *
    (1 + toad.genes.rarity / 10) *
    (1 + toad.genes.weight / 50) *
    weightMultiplier
  );
};

/**
 * Выработка биомассы жабой в час.
 * Зависит от редкости, веса, характера, голода и кибер-болезни (Часть 3.6).
 */
export const getBiomassRate = (toad: Toad): number =>
  getBiomassPotentialRate(toad) *
  getDiseasePenaltyMultiplier(toad.state?.diseaseId) *
  getProductionFactor(toad.state.hunger);

/** Число доступных родильных слотов купола */
export const getNestSlots = (scene?: Scene | null): number =>
  scene?.nestSlots ?? NEST_BASE_SLOTS;

/** Максимум родильных слотов купола (постройка «Гнездо» апгрейдится за Кваксы) */
export const NEST_MAX_SLOTS = 6;
/** Базовая цена первого апгрейда Гнезда в Кваксах (аудит: было 40 — почти бесплатно) */
export const NEST_SLOT_UPGRADE_BASE_COST = 150;
/** Во сколько раз дорожает каждый следующий родильный слот */
export const NEST_SLOT_UPGRADE_GROWTH = 2.4;

/** Цена следующего родильного слота в Кваксах (дорожает с каждым апгрейдом) */
export const getNestSlotUpgradeCost = (scene?: Scene | null): number => {
  const steps = Math.max(0, getNestSlots(scene) - NEST_BASE_SLOTS);
  return Math.round(
    NEST_SLOT_UPGRADE_BASE_COST * Math.pow(NEST_SLOT_UPGRADE_GROWTH, steps)
  );
};

/** Можно ли ещё расширить Гнездо вольера */
export const canUpgradeNest = (scene?: Scene | null): boolean =>
  getNestSlots(scene) < NEST_MAX_SLOTS;
