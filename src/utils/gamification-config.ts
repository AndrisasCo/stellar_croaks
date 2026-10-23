import { getPersonalityMultipliers, Toad } from "../models/Toad";
import { getDiseasePenaltyMultiplier } from "../models/disease";

// === Размножение: энергия и cooldown (Часть 3.2) ===

/**
 * Базовый максимум «сил» жабы.
 *
 * Итоговый максимум растёт с качеством: `getToadMaxEnergy`. Константа остаётся
 * базой для обычной жабы и для старых сейвов, где качество не задано.
 */
export const MAX_ENERGY = 100;
/** Прибавка к максимуму сил за единицу качества (rarity) */
export const ENERGY_PER_RARITY = 5;
/** Базовая стоимость спаривания (энергия) */
export const BREED_ENERGY_BASE = 25;
/** Базовый расход биомассы на одно спаривание */
export const BREED_BIOMASS_BASE = 8;
/** Базовый отдых после скрещивания — 10 минут */
export const BREED_COOLDOWN_BASE_MS = 10 * 60 * 1000;
/** Сколько жаб влезает в гекс «Репродуктор»: пара (самец + самка) на ухаживание */
export const NEST_ROOM_TOAD_SLOTS = 2;

// === Ухаживание в репродукторе: беременность стартует не сразу (Часть 3.2) ===

/**
 * Окно ухаживания: беременность стартует через случайные 15–30 минут после
 * спаривания («шанс раньше/позже»). Характер пары сдвигает окно: страстные
 * и энергичные успевают быстрее, сонные и аскеты — позже.
 */
export const MATING_MIN_MINUTES = 15;
export const MATING_MAX_MINUTES = 30;

/** Сдвиг окна ухаживания по характеру: быстрые < 1, медленные > 1 */
const MATING_PERSONALITY: Record<string, number> = {
  hyperactive: 0.75,
  energetic: 0.8,
  passionate: 0.8,
  playboy: 0.85,
  robot: 1.1,
  hermit: 1.2,
  ascetic: 1.25,
  zombie: 1.35,
  sleepy: 1.4,
};

/** Множитель окна ухаживания по характеру жабы (неизвестный — 1) */
export const getMatingPersonalityFactor = (
  personality?: string | null
): number => MATING_PERSONALITY[personality ?? ""] ?? 1;

/** Идёт ли ухаживание прямо сейчас */
export const isToadCourting = (toad: Toad): boolean => Boolean(toad.mating);

/**
 * Сколько минут займёт ухаживание пары: случайные 15–30 мин × характер пары.
 * Считается один раз при спаривании — потом живёт в `Toad.mating.startAt`.
 */
export const getMatingMinutes = (female: Toad, male?: Toad | null): number => {
  const base =
    MATING_MIN_MINUTES +
    Math.random() * (MATING_MAX_MINUTES - MATING_MIN_MINUTES);
  const factor = male
    ? (getMatingPersonalityFactor(female.genes?.personality) +
        getMatingPersonalityFactor(male.genes?.personality)) /
      2
    : getMatingPersonalityFactor(female.genes?.personality);

  return Math.max(1, Math.round(base * factor));
};

/** Сколько осталось ухаживать (мс) — для отсчёта в интерфейсе */
export const getMatingTimeLeft = (toad: Toad, now = Date.now()): number =>
  Math.max(0, (toad.mating?.startAt ?? now) - now);


// === Фарм биомассы (Часть 3.3) ===

/** Мягкое выгорание голода за реальные сутки */
export const HUNGER_PER_DAY = 40;
/** Базовая выработка биомассы взрослой жабой в час */
export const BIOMASS_PER_TOAD_HOUR = 2.1;
/** Расход биомассы на содержание одной жабы в час (апкипинг) */
export const UPKEEP_PER_TOAD_HOUR = 0.6;
/**
 * Порог голода, ниже которого жаба работает «на голодном минимуме».
 * Порог держим на уровне кормления автокормушки (см. `AUTO_FEED_HUNGER` в `utils/auto-feeder.ts`):
 * кормушка доливает жабу ровно на нём, поэтому сектор с апгрейдом из голодного режима не выходит.
 */
export const PRODUCTION_MIN_HUNGER = 20;
/**
 * Сколько от своей нормы выдаёт голодная жаба (голод ≤ `PRODUCTION_MIN_HUNGER`), доля.
 *
 * Раньше на пороге выработка падала в ноль, и это запирало игрока: колония без корма, биомассы
 * и Кваксов вырабатывала ровно 0, а накопить на корм было не из чего — `processProduction` не
 * пускает биомассу в минус, поэтому и апкипинг при нулевой выработке ничего не даёт. Теперь у
 * голодной жабы есть «прожиточный минимум», и голодовка — это треть выручки, а не тупик.
 *
 * Долю держим выше апкипинга: `0.3 × потенциал` при `потенциал > 2/ч` перекрывает
 * `UPKEEP_PER_TOAD_HOUR` (0.6), и голодающая колония потихоньку копит на корм — ~3.8 🔷 в сутки
 * на типичную жабу против ~11 🔷 у сытой. Меньше 0.2 ставить бессмысленно: пол, не
 * перекрывающий содержание, оставляет колонию всё с тем же нулём.
 */
export const PRODUCTION_HUNGRY_FACTOR = 0.3;
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

/**
 * Максимум сил жабы: база плюс качество.
 *
 * Максимум — чистая функция генов, как и `getToadMaxHp`: в сейве он не хранится,
 * поэтому старые сейвы не требуют миграции. Поле `Toad.energy` — только текущий
 * запас, который обрезается по этому максимуму.
 */
export const getToadMaxEnergy = (toad: Pick<Toad, "genes">): number =>
  Math.round(
    MAX_ENERGY + Math.max(0, toad.genes?.rarity || 0) * ENERGY_PER_RARITY,
  );

/** Текущая энергия жабы (с учётом дефолта для старых сейвов) */
export const getToadEnergy = (toad: Toad): number => {
  const maxEnergy = getToadMaxEnergy(toad);
  const energy = toad.energy ?? maxEnergy;
  return Math.max(0, Math.min(maxEnergy, energy));
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

/**
 * Отдых после скрещивания: `base × (1 + rarity/10) × характер`.
 * Ускорения от бонусов биопода («ускоренная беременность») удалены как легаси.
 */
export const getBreedCooldownMs = (toad: Toad): number => {
  const personalityMult = getPersonalityCooldownMultiplier(
    toad.genes.personality
  );

  return BREED_COOLDOWN_BASE_MS * (1 + toad.genes.rarity / 10) * personalityMult;
};

/** Готова ли жаба к скрещиванию прямо сейчас */
export const isToadReadyToBreed = (toad: Toad, now = Date.now()): boolean => {
  if (toad.stage !== "adult") return false;
  if (toad.pregnancy?.isPregnant) return false;
  // Пара уже в репродукторе: пока идёт ухаживание, жаба занята (Часть 3.2)
  if (toad.mating) return false;
  if ((toad.breedCooldownUntil ?? 0) > now) return false;
  return getToadEnergy(toad) >= getEnergyCost(toad);
};

/**
 * Множитель выработки биомассы в зависимости от голода.
 * Сытая жаба (100 %) — 1, голодная (≤ `PRODUCTION_MIN_HUNGER`) — `PRODUCTION_HUNGRY_FACTOR`,
 * между ними линейный рост: минимум у голодной нужен, чтобы голодовка не запирала игрока
 * (см. `PRODUCTION_HUNGRY_FACTOR`). Множитель монотонный, поэтому покормить жабу всегда выгодно.
 */
export const getProductionFactor = (hunger: number): number => {
  if (hunger <= PRODUCTION_MIN_HUNGER) return PRODUCTION_HUNGRY_FACTOR;
  return (
    PRODUCTION_HUNGRY_FACTOR +
    ((1 - PRODUCTION_HUNGRY_FACTOR) * (hunger - PRODUCTION_MIN_HUNGER)) /
      (100 - PRODUCTION_MIN_HUNGER)
  );
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

// Родильные слоты не продаются по одному: в репродукторе всегда два места (самка и самец),
// а вторая пара требует нового «Репродуктора» на карте. Апгрейд слотов за Кваксы удалён
// вместе с UI — иначе скрытая цена ×2.4 за слот ломала бы общий рост цен секторов (×1.5).
