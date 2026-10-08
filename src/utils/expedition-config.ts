import { Expedition, ExpeditionRole, SectorDef } from "../models/expedition";
import { getPersonalityMultipliers, Toad } from "../models/Toad";

/**
 * Константы разведки (Часть 5) и смысл характеристик жаб (Часть 5.3).
 * Чистые расчёты без обращения к сохранению — состояние меняет
 * `utils/expedition-manager.ts`.
 */

// === Команды ===

/** Сколько жаб влезает в команду (5 ролей) */
export const EXPEDITION_TEAM_SIZE = 5;
/** Максимум команд (1 стартовая + постройка «Диспетчерская») */
export const EXPEDITION_MAX_TEAMS = 3;
/** Стоимость постройки «Диспетчерская» за уровень (2-я и 3-я команды), Кваксы */
export const DISPATCH_OFFICE_COST = [250, 900];
/** Сколько команд доступно при уровне Диспетчерской */
export const getMaxExpeditions = (dispatchLevel = 0): number =>
  Math.max(1, Math.min(EXPEDITION_MAX_TEAMS, 1 + dispatchLevel));

/** Стоимость следующей Диспетчерской (null — дальше некуда) */
export const getDispatchOfficeCost = (dispatchLevel: number): number | null =>
  dispatchLevel >= EXPEDITION_MAX_TEAMS - 1
    ? null
    : DISPATCH_OFFICE_COST[dispatchLevel] ?? null;

// === Роли ===

export interface ExpeditionRoleConfig {
  label: string;
  icon: string;
  /** Характеристика, которая решает исход событий роли */
  statLabel: string;
  description: string;
  /** Верхняя граница характеристики: выше — сила роли = 1 */
  statCap: number;
}

export const ROLE_CONFIG: Record<ExpeditionRole, ExpeditionRoleConfig> = {
  scout: {
    label: "Скаут",
    icon: "🏃",
    statLabel: "Скорость",
    description: "Уклоняется, разведывает путь, находит обходы.",
    statCap: 1.5,
  },
  tank: {
    label: "Щитоносец",
    icon: "🛡️",
    statLabel: "Масса / HP",
    description: "Принимает урон на себя и прикрывает команду.",
    statCap: 40,
  },
  medic: {
    label: "Ремонтник",
    icon: "🔧",
    statLabel: "Плодовитость",
    description: "Починяет и подлечивает жаб прямо в рейде.",
    statCap: 3,
  },
  hacker: {
    label: "Оператор",
    icon: "💻",
    statLabel: "Редкость",
    description: "Вскрывает сейфы, обходит турели, выкачивает данные.",
    statCap: 12,
  },
  negotiator: {
    label: "Биолог",
    icon: "🌿",
    statLabel: "Характер",
    description: "Договаривается с местной органикой, добывает образцы.",
    statCap: 1.4,
  },
};

/** Значение характеристики роли у жабы (сырое) */
export const getRoleStat = (toad: Toad, role: ExpeditionRole): number => {
  switch (role) {
    case "scout":
      return toad.genes?.speed || 0;
    case "tank":
      return toad.genes?.weight || 0;
    case "medic":
      return toad.genes?.fertility || 0;
    case "hacker":
      return toad.genes?.rarity || 0;
    case "negotiator": {
      // «Переговорщик» живёт на характере: берём мид-множители личности
      const { weightMultiplier, speedMultiplier } = getPersonalityMultipliers(
        toad.genes?.personality
      );
      return (weightMultiplier + speedMultiplier) / 2;
    }
    default:
      return 0;
  }
};

/** Сила роли 0..1 — нормализованная характеристика жабы */
export const getRolePower = (toad: Toad, role: ExpeditionRole): number => {
  const cap = ROLE_CONFIG[role].statCap;
  const stat = getRoleStat(toad, role);
  return Math.max(0, Math.min(1, stat / cap));
};

// === HP (Часть 2: hp, урон и утилизация) ===

/** Базовый запас прочности жабы */
export const EXPEDITION_BASE_HP = 70;
/** Прибавка HP за единицу массы */
export const EXPEDITION_HP_PER_WEIGHT = 2;
/** Прибавка HP за единицу редкости */
export const EXPEDITION_HP_PER_RARITY = 3;
/** Пассивное восстановление HP в час */
export const HP_REGEN_PER_HOUR = 5;
/** Минимум урона за одно провалившееся событие */
export const EXPEDITION_MIN_DAMAGE = 6;
/** Максимальный HP (страховка от абсурдных значений) */
export const HP_SOFT_CAP = 400;

/** Максимум HP жабы (масса даёт «броню», редкость — запас) */
export const getToadMaxHp = (toad: Toad): number =>
  Math.round(
    Math.min(
      HP_SOFT_CAP,
      (toad.maxHp && toad.maxHp > 0 ? toad.maxHp : EXPEDITION_BASE_HP) +
        (toad.genes?.weight || 0) * EXPEDITION_HP_PER_WEIGHT +
        (toad.genes?.rarity || 0) * EXPEDITION_HP_PER_RARITY
    )
  );

/** Текущий HP жабы (старые сейвы получают полный запас) */
export const getToadHp = (toad: Toad): number => {
  const maxHp = getToadMaxHp(toad);
  if (toad.hp === undefined || toad.hp === null) {
    return maxHp;
  }
  return Math.max(0, Math.min(maxHp, toad.hp));
};

/** Жаба выбыла из игры: не производит, не размножается, не идёт в поход */
export const isToadDown = (toad: Toad): boolean => getToadHp(toad) <= 0;

/** Отношение HP жабы к максимуму (0..1) */
export const getToadHpRatio = (toad: Toad): number => {
  const maxHp = getToadMaxHp(toad);
  return maxHp > 0 ? getToadHp(toad) / maxHp : 0;
};

/** Стоимость мгновенного лечения (Кваксы): за каждую потерянную единицу HP */
export const HEAL_TOKENS_PER_HP = 0.4;
/** Минимальная цена лечения */
export const HEAL_MIN_COST = 1;

/** Сколько Кваксов стоит вылечить жабу до полного HP */
export const getHealCost = (toad: Toad): number => {
  const missing = Math.max(0, getToadMaxHp(toad) - getToadHp(toad));
  if (missing <= 0) {
    return 0;
  }
  return Math.max(HEAL_MIN_COST, Math.ceil(missing * HEAL_TOKENS_PER_HP));
};


// === Путь, события и добыча ===

/** Через какие доли пути (0..1) разыгрывается событие похода */
export const EXPEDITION_EVENT_PROGRESS_STEP = 0.12;
/** База шанса на успех в событии роли */
export const EXPEDITION_BASE_EVENT_CHANCE = 0.55;
/** Вклад силы роли в шанс успеха */
export const EXPEDITION_ROLE_CHANCE_BONUS = 0.35;
/** Штраф к шансу за каждую единицу опасности выше 1 */
export const EXPEDITION_DANGER_CHANCE_PENALTY = 0.12;
/** Добыча события «за шаг пути» (биомасса) */
export const EXPEDITION_STEP_BIOMASS = 5;
/** Добыча события «за шаг пути» (Кваксы) */
export const EXPEDITION_STEP_TOKENS = 4;
/** Минимальное время обратного пути, часы */
export const EXPEDITION_MIN_RETURN_HOURS = 0.25;
/** Путь назад = половина пройденного времени (Часть 5.2) */
export const EXPEDITION_RETURN_RATIO = 0.5;
/** Максимум событий, разыгрываемых за один тик (анти-оффлайн-фарм) */
export const EXPEDITION_MAX_EVENTS_PER_TICK = 6;
/** Доля боли, которую снимает щитоносец с команды */
export const TANK_DAMAGE_REDIRECT = 0.6;

/** Общий множитель добычи сектора */
export const getSectorLootFactor = (sector: SectorDef): number =>
  sector.lootMultiplier * (1 + (sector.depth - 1) * 0.08);

// === Стоимость отправки и манипуляций ===

/** Снаряжение команды: биомасса за каждую жабу (растёт с глубиной) */
export const EXPEDITION_SUPPLY_BIOMASS_PER_TOAD = 4;

/** Сколько биомассы стоит снарядить команду в сектор */
export const getExpeditionSendCost = (
  sector: SectorDef,
  teamSize: number
): number =>
  Math.round(
    EXPEDITION_SUPPLY_BIOMASS_PER_TOAD * sector.depth * Math.max(1, teamSize)
  );

/** Сколько биомассы стоит ускорить возврат (за час остатка пути) */
export const SPEEDUP_BIOMASS_PER_HOUR = 8;
/** Минимальная цена ускорения возврата */
export const SPEEDUP_MIN_BIOMASS = 5;

/** Часов осталось до дома (0 — уже дома) */
export const getReturnRemainingHours = (
  expedition: Expedition,
  now = Date.now()
): number => {
  if (
    expedition.phase !== "returning" ||
    !expedition.returnStartedAt ||
    !expedition.returnHours
  ) {
    return 0;
  }
  const leftMs =
    expedition.returnStartedAt + expedition.returnHours * 60 * 60 * 1000 - now;
  return Math.max(0, leftMs / (60 * 60 * 1000));
};

/** Цена ускорения возврата в биомассе (вдвое ближе к дому) */
export const getSpeedUpReturnCost = (
  expedition: Expedition,
  now = Date.now()
): number => {
  const remainingHours = getReturnRemainingHours(expedition, now);
  if (remainingHours <= 0) {
    return 0;
  }
  return Math.max(
    SPEEDUP_MIN_BIOMASS,
    Math.ceil(remainingHours * SPEEDUP_BIOMASS_PER_HOUR)
  );
};

/** Цена «Экстренного маяка»: моментальная эвакуация команды, Астро-кваксы */
export const EXTRACTION_ASTRO_COST = 3;
/** Плата за принудительную эвакуацию выбитой команды (биомасса за жабу) */
export const FORCED_EXTRACTION_FEE_PER_TOAD = 6;
/** Доля утерянной добычи при принудительном возврате */
export const FORCED_LOOT_LOSS = 0.5;
/** Шанс найти образец в хорошем событии */
export const EXPEDITION_SAMPLE_CHANCE = 0.08;
/** Шанс найти Астро-кваксы в хорошем событии */
export const EXPEDITION_ASTRO_CHANCE = 0.12;

// === UI-хелперы ===

/** Тексты-статусы HP для UI */
export const getToadHpStatusLabel = (toad: Toad): string => {
  const ratio = getToadHpRatio(toad);
  if (ratio <= 0) {
    return "выбита из строя";
  }
  if (ratio < 0.35) {
    return "тяжело ранена";
  }
  if (ratio < 0.7) {
    return "ранена";
  }
  return "в форме";
};


