import { Expedition, ExpeditionRole, SectorDef } from "../models/expedition";
import { DISEASES, DiseaseDef, isToadSick } from "../models/disease";
import { getPersonalityMultipliers, Toad } from "../models/Toad";
import { LootboxRarity, UNIQUE_TOADS_BY_RARITY } from "../models/Toad/lootbox";
import { Items } from "../models/user";
import {
  BIOMASS_TO_TOKENS_RATE,
  UPKEEP_PER_TOAD_HOUR,
  getBiomassPotentialRate,
  getToadEnergy,
} from "./gamification-config";
import { getToadHomeId } from "./toad-location";

/**
 * Константы разведки (Часть 5) и смысл характеристик жаб (Часть 5.3).
 * Чистые расчёты без обращения к сохранению — состояние меняет
 * `utils/expedition-manager.ts`.
 */

// === Команды ===

/** Сколько жаб влезает в команду (5 ролей) */
export const EXPEDITION_TEAM_SIZE = 5;
/**
 * Сколько случайных жаб может присоединиться к команде за один поход.
 * Событие «попутчик» не должно превращать рейд в бесконечный набор жабы:
 * один поход — один новый житель колонии.
 */
export const EXPEDITION_MAX_COMPANIONS = 1;
/**
 * Сколько разобранных походов храним в архиве.
 *
 * Архив нужен только ради журналов и итогов: он не участвует в лимитах команд.
 * Ограничение держит сейв компактным — журнал одного похода может быть длинным.
 */
export const EXPEDITION_ARCHIVE_LIMIT = 10;
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
    : (DISPATCH_OFFICE_COST[dispatchLevel] ?? null);

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
    statLabel: "Качество",
    description: "Вскрывает сейфы, обходит турели, выкачивает данные.",
    statCap: 12,
  },
  negotiator: {
    label: "Повар",
    icon: "🍎",
    statLabel: "Аппетит",
    description: "Договаривается с местной органикой, добывает образцы.",
    statCap: 1.5,
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
      return toad.genes?.hungerRate || 0;
    }
    default:
      return 0;
  }
};

/** Сила роли 0..EXPEDITION_ROLE_MAX_POWER — нормализованная характеристика жабы */
export const getRolePower = (toad: Toad, role: ExpeditionRole): number => {
  const cap = ROLE_CONFIG[role].statCap;
  const stat = getRoleStat(toad, role);
  return Math.max(0, Math.min(EXPEDITION_ROLE_MAX_POWER, stat / cap));
};

// === HP (Часть 2: hp, урон и утилизация) ===

/** Базовый запас прочности жабы */
export const EXPEDITION_BASE_HP = 70;
/** Прибавка HP за единицу массы */
export const EXPEDITION_HP_PER_WEIGHT = 2;
/** Прибавка HP за единицу редкости */
export const EXPEDITION_HP_PER_RARITY = 3;
/**
 * Пассивное восстановление HP в час ВНЕ Медотсека. Намеренно низкое: без Медотсека
 * раны затягиваются очень медленно, койка лечит в разы быстрее
 * (`HOSPITAL_HP_REGEN_PER_HOUR` в `utils/hospital.ts`).
 */
export const HP_REGEN_PER_HOUR = 1;
/** Минимум урона за одно провалившееся событие */
export const EXPEDITION_MIN_DAMAGE = 10;
/**
 * Глобальный множитель урона событий похода.
 *
 * Опасность сектора (`SectorDef.dangerMultiplier`) задаёт относительную сложность,
 * а этот коэффициент — общий тон походов: после балансировки рейды стали заметно
 * агрессивнее, поэтому весь урон событий поднят на 20%.
 */
export const EXPEDITION_DAMAGE_MULTIPLIER = 2;
/**
 * Базовый шанс, что по возвращении один живой участник принесёт кибер-болезнь.
 *
 * Это именно «принести с собой»: событие «кратер с плесенью» может заразить жабу
 * прямо в рейде, но даже без него команда возвращается с риском 20%. Болезнь
 * выбирается из таблицы `DISEASES`, а лечится дома, в Медотсеке или курсом.
 */
export const EXPEDITION_BASE_DISEASE_CHANCE = 0.2;
/** Максимальный HP (страховка от абсурдных значений) */
export const HP_SOFT_CAP = 400;

/**
 * Максимум HP жабы (масса даёт «броню», Качество — запас).
 *
 * Максимум — ЧИСТАЯ функция генов: он не зависит от того, что записано в сейве.
 * Поле `toad.maxHp` — только кэш для интерфейса и для `processHpRegen` (видно, что
 * значение изменилось). Раньше сохранённый `maxHp` брался за базу и бонусы генов
 * начислялись поверх: `processHpRegen` пишет посчитанный максимум в сейв, поэтому на
 * каждом следующем тике (раз в 5 минут) максимум рос на `вес*2 + Качество*3`, а hp
 * стоял на месте — у новорождённой жабы здоровье проседало само по себе
 * (`tmp-verify-hp-drift.mjs`).
 */
export const getToadMaxHp = (toad: Toad): number =>
  Math.round(
    Math.min(
      HP_SOFT_CAP,
      EXPEDITION_BASE_HP +
        (toad.genes?.weight || 0) * EXPEDITION_HP_PER_WEIGHT +
        (toad.genes?.rarity || 0) * EXPEDITION_HP_PER_RARITY,
    ),
  );

/** Текущий HP жабы (старые сейвы получают полный запас) */
export const getToadHp = (toad: Toad): number => {
  const maxHp = getToadMaxHp(toad);
  if (toad.hp === undefined || toad.hp === null) {
    return maxHp;
  }
  return Math.max(0, Math.min(maxHp, toad.hp));
};

/** Кого и чем наградил поход на обратном пути */
export interface ExpeditionReturnDisease {
  toad: Toad;
  disease: DiseaseDef;
}

/**
 * Бросок базовой болезни на возврате команды.
 *
 * Берём только живых и ещё не болеющих жаб: поход не должен перезаписывать
 * активную болезнь или заражать выбитую жабу. Сначала бросается общий шанс
 * `EXPEDITION_BASE_DISEASE_CHANCE`, затем равновероятно выбираются жаба и болезнь.
 * Принимает `rng`/`now` для проверок — в игре используются `Math.random`/`Date.now`.
 */
export const rollExpeditionDisease = (
  team: Toad[],
  rng: () => number = Math.random,
  now = Date.now(),
): ExpeditionReturnDisease | null => {
  if (rng() >= EXPEDITION_BASE_DISEASE_CHANCE) {
    return null;
  }

  const candidates = team.filter(
    (toad) => getToadHp(toad) > 0 && !isToadSick(toad, now),
  );

  if (candidates.length === 0) {
    return null;
  }

  return {
    toad: candidates[Math.floor(rng() * candidates.length)],
    disease: DISEASES[Math.floor(rng() * DISEASES.length)],
  };
};

/** Жаба выбыла из игры: не производит, не размножается, не идёт в поход */
export const isToadDown = (toad: Toad): boolean => getToadHp(toad) <= 0;

/**
 * Жаба в походе стоит  в ⚡-секторе, ни в «Разведке»
 */
export const getAwayToadUpdate = (
  toad: Toad,
  scene_id: number | undefined,
): Partial<Toad> => {
  const maxHp = getToadMaxHp(toad);

  return {
    status: "out",
    hp: maxHp,
    maxHp,
    scene_id,
    homeId: getToadHomeId(toad),
  };
};

/** Отношение HP жабы к максимуму (0..1) */
export const getToadHpRatio = (toad: Toad): number => {
  const maxHp = getToadMaxHp(toad);
  return maxHp > 0 ? getToadHp(toad) / maxHp : 0;
};

/**
 * Стоимость мгновенного лечения (Кваксы): за каждую потерянную единицу HP.
 * Цена намеренно высокая — мгновенное лечение это «пропустить ожидание»,
 * альтернатива койке в Медотсеке, где HP идёт +24 в час.
 */
export const HEAL_TOKENS_PER_HP = 2;
/** Минимальная цена мгновенного лечения */
export const HEAL_MIN_COST = 8;

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

/** Итоговый множитель урона событий: опасность сектора × общий тон походов */
export const getSectorDamageMultiplier = (sector: SectorDef): number =>
  sector.dangerMultiplier * EXPEDITION_DAMAGE_MULTIPLIER;

/**
 * Сколько Астро-кваксов приносит одна находка в хорошем событии.
 *
 * База — 1 💎, и ещё +1 💎 за каждые `EXPEDITION_ASTRO_DEPTH_STEP` уровней глубины:
 * ближний Периметр платит 1, середина (s4–s6) — 2, дальние секторы (s7–s8) — 3.
 * Так походы остаются основным «честным» источником астро: награда растёт вместе
 * с риском и временем пути, а не с одной только удачей на витрине заказов.
 */
export const EXPEDITION_ASTRO_DEPTH_STEP = 3;

export const getExpeditionAstroDrop = (sector: SectorDef): number =>
  1 + Math.floor((Math.max(1, sector.depth) - 1) / EXPEDITION_ASTRO_DEPTH_STEP);

/**
 * Сколько пропусков КОНТУРа приносит успешно завершённый поход в сектор.
 *
 * Пропуск — расходуемый ресурс склада и единственный способ открыть следующий
 * сектор. Награда растёт с глубиной: 1 🎫 на старте и 5 🎫 на «Дальнем Периметре»,
 * поэтому старые пороги (1/3/6/10/15/21/28 походов) превращаются в понятную
 * лестницу накоплений, а не в обязательный гринд одной и той же локации.
 * Провал пропуска не даёт: иначе глубины открывались бы без успешных рейдов.
 */
export const getContourPassReward = (sector: SectorDef): number =>
  1 + Math.floor(Math.max(1, sector.depth) / 2);

// === Итог похода: удачное завершение (Часть 5.4) ===

/**
 * Каждая роль в команде добавляет шанс завершить поход удачно.
 * Полностью подходящая жаба (сила роли 1.0) даёт +20%; жаба на 200% даёт +40%,
 * а жаба, которая лишь дотягивает до требований роли (сила < 1), закрывает только
 * половину вклада. Отсюда две опорные точки дизайна:
 *  - 5 ролей с силой 0.9 → 5 × 0.45 × 20% = 45% удачного завершения;
 *  - 3 роли с силой 2.0 → 3 × 2.0 × 20% = 120% (гарантированный успех).
 */
export const EXPEDITION_ROLE_SUCCESS_BONUS = 0.2;
/** Максимум силы роли: 2.0 — жаба сильно перекрывает требования роли (200%) */
export const EXPEDITION_ROLE_MAX_POWER = 999;
/** Множитель вклада для жабы, которая не дотягивает до роли (сила < 1) */
export const EXPEDITION_ROLE_UNDERFIT_FACTOR = 0.5;
/** Разброс удачи: шанс умножается на 0.9..1.1 («немного рандома») */
export const EXPEDITION_LUCK_SPREAD = 0.1;
/** Потолок отображаемого шанса (выше 100% — «гарантированно») */
export const EXPEDITION_SUCCESS_CAP = 1.5;
/** Множитель добычи за удачное завершение похода */
export const EXPEDITION_GOOD_FINISH_LOOT = 1.7;
/** Во сколько раз поход обязан быть выгоднее фермы за то же время */
export const EXPEDITION_PROFIT_MARGIN = 1.5;
/** Оценка случайного предмета из похода в Кваксах-эквиваленте */
export const EXPEDITION_ITEM_VALUE = 6;
/** Оценка образца (живой жабы из сектора) в Кваксах-эквиваленте */
export const EXPEDITION_SAMPLE_VALUE = 40;
/**
 * Оценка особого образца — жабы из лутбокса, закреплённой за глубиной.
 * Втрое дороже обычного образца: это именная жаба редкого тира, которую нельзя
 * найти в событии, а можно только вынести из конкретного сектора.
 */
export const EXPEDITION_LOOTBOX_SAMPLE_VALUE = 120;
/**
 * Оценка Астро-квакса в Кваксах-эквиваленте.
 *
 * Раньше астро оценивался как половина образца (20 🔷), из-за чего каждая находка
 * 💎 почти целиком вычиталась из добора добычи до нормы и поход «за астро» платил
 * меньше Кваксов. Астро — премиальная валюта, но не в 20 раз дороже Квакса:
 * лутбокс стоит 10 💎, поэтому для нормы достаточно курса 1 💎 ≈ 5 🔷.
 */
export const EXPEDITION_ASTRO_VALUE = 5;

/** Вклад роли в «юнитах»: 1 юнит = +20% к шансу удачного завершения */
export const getRoleSuccessUnits = (power: number): number =>
  Math.max(0, power) <= 1
    ? Math.max(0, power) * EXPEDITION_ROLE_UNDERFIT_FACTOR
    : Math.max(0, power);

/** Множитель сложности сектора: чем глубже Периметр, тем труднее удержать удачу */
export const getSectorSuccessFactor = (sector: SectorDef): number =>
  1 / (1 + Math.max(0, sector.depth - 1) * 0.12);

/** Живые роли команды: жаба + назначенная роль (для UI и расчётов) */
export interface ExpeditionTeamMember {
  role: ExpeditionRole;
  toad: Toad;
}

/** Случайная удача похода: 0.9..1.1 (немного рандома вокруг расчётного шанса) */
export const rollExpeditionLuck = (rng: () => number = Math.random): number =>
  1 - EXPEDITION_LUCK_SPREAD + rng() * EXPEDITION_LUCK_SPREAD * 2;

/**
 * Шанс завершить поход удачно (0..1.5).
 * Складываем вклады всех занятых ролей, множим на сложность сектора и на удачу.
 */
export const getExpeditionSuccessChance = (
  members: ExpeditionTeamMember[],
  sector: SectorDef,
  luck = 1,
): number => {
  const units = members.reduce(
    (sum, member) =>
      sum + getRoleSuccessUnits(getRolePower(member.toad, member.role)),
    0,
  );

  const chance =
    units *
    EXPEDITION_ROLE_SUCCESS_BONUS *
    getSectorSuccessFactor(sector) *
    Math.max(0, luck);

  return Math.max(0, Math.min(EXPEDITION_SUCCESS_CAP, chance));
};

// === Поход против фермы (Часть 5.4: «поход всегда выгоднее») ===

/** Оценка добычи похода в Кваксах-эквиваленте (1 🧪 = 0.5 🔷) */
export const getLootValue = (loot: {
  biomass?: number;
  tokens?: number;
  astro_quax?: number;
  items?: Partial<Record<Items, number>>;
  samples?: number;
  lootboxSamples?: number;
}): number => {
  const items = Object.values(loot.items ?? {}).reduce(
    (sum, amount) => sum + Math.max(0, amount || 0),
    0,
  );

  return (
    Math.max(0, loot.biomass || 0) * 0.5 +
    Math.max(0, loot.tokens || 0) +
    Math.max(0, loot.astro_quax || 0) * EXPEDITION_ASTRO_VALUE +
    items * EXPEDITION_ITEM_VALUE +
    Math.max(0, loot.samples || 0) * EXPEDITION_SAMPLE_VALUE +
    Math.max(0, loot.lootboxSamples || 0) * EXPEDITION_LOOTBOX_SAMPLE_VALUE
  );
};

/**
 * Во сколько биомассы оценивается лут при переработке на вкладке «Походы».
 *
 * Берём квакс-эквивалент добычи (`getLootValue`) и переводим его обратно в биомассу
 * по курсу рынка: 1 🔷 = 2 🧪. Так игрок видит честную альтернативу складу —
 * предметы и образцы тоже растворяются в биомассе, а не пропадают.
 */
export const getLootBiomassValue = (loot: {
  biomass?: number;
  tokens?: number;
  astro_quax?: number;
  items?: Partial<Record<Items, number>>;
  samples?: number;
  lootboxSamples?: number;
}): number =>
  Math.max(
    0,
    Math.round((getLootValue(loot) / BIOMASS_TO_TOKENS_RATE) * 10) / 10,
  );

/** Сколько Кваксов-эквивалента те же жабы принесли бы фермой за `hours` часов (нетто) */
export const getFarmValueForTeam = (toads: Toad[], hours: number): number => {
  const perHour = toads.reduce(
    (sum, toad) =>
      sum + Math.max(0, getBiomassPotentialRate(toad) - UPKEEP_PER_TOAD_HOUR),
    0,
  );

  return perHour * Math.max(0, hours) * BIOMASS_TO_TOKENS_RATE;
};

/**
 * Норма добычи похода: ферма за время отсутствия команды (туда и обратно) с запасом
 * `EXPEDITION_PROFIT_MARGIN` плюс потраченное на снаряжение. Поход ниже этой нормы
 * не возвращается — иначе ферма была бы выгоднее похода.
 */
export const getExpeditionProfitFloor = (
  toads: Toad[],
  awayHours: number,
  supplyBiomass = 0,
): number =>
  getFarmValueForTeam(toads, awayHours) * EXPEDITION_PROFIT_MARGIN +
  Math.max(0, supplyBiomass) * BIOMASS_TO_TOKENS_RATE;

// === Стоимость отправки и манипуляций ===

/** Снаряжение команды: биомасса за каждую жабу (растёт с глубиной) */
export const EXPEDITION_SUPPLY_BIOMASS_PER_TOAD = 4;

/** Сколько биомассы стоит снарядить команду в сектор */
export const getExpeditionSendCost = (
  sector: SectorDef,
  teamSize: number,
): number =>
  Math.round(
    EXPEDITION_SUPPLY_BIOMASS_PER_TOAD * sector.depth * Math.max(1, teamSize),
  );

/**
 * Силы жабы на поход (Часть 5): путь за Периметр выматывает, и чем глубже сектор,
 * тем дороже он обходится. Силы — **личный** ресурс жабы, поэтому платит не общий
 * склад, а каждая участница команды: в модалке разведки у жаб видно силы, а
 * снаряжение биомассой оплачивается отдельно, со склада.
 *
 * Дома силы капают обратно (+6 в час), так что поход — ещё и очередь: жабу, которая
 * копит силы на «Репродуктор», дешевле взять в ближний сектор, чем в дальний.
 * Первый сектор стоит 10 ⚡, «Центр станции» (глубина 8) — 52 ⚡.
 */
export const EXPEDITION_ENERGY_BASE = 10;
/** Плюс столько сил за каждую следующую глубину сектора */
export const EXPEDITION_ENERGY_PER_DEPTH = 6;

/** Силы одной жабы на поход в сектор */
export const getExpeditionToadEnergyCost = (sector: SectorDef): number =>
  EXPEDITION_ENERGY_BASE +
  EXPEDITION_ENERGY_PER_DEPTH * (Math.max(1, sector.depth) - 1);

/** Силы всей команды на поход: каждую жабу считаем отдельно, тут — сумма для итога */
export const getExpeditionEnergyCost = (
  sector: SectorDef,
  teamSize: number,
): number => getExpeditionToadEnergyCost(sector) * Math.max(1, teamSize);

/** Хватает ли жабе сил на поход в сектор */
export const canToadAffordExpedition = (
  toad: Toad,
  sector: SectorDef,
): boolean => getToadEnergy(toad) >= getExpeditionToadEnergyCost(sector);

/** Сколько биомассы стоит ускорить возврат (за час остатка пути) */
export const SPEEDUP_BIOMASS_PER_HOUR = 8;
/** Минимальная цена ускорения возврата */
export const SPEEDUP_MIN_BIOMASS = 5;

/** Часов осталось до дома (0 — уже дома) */
export const getReturnRemainingHours = (
  expedition: Expedition,
  now = Date.now(),
): number => {
  if (isAwaitingEvacuation(expedition)) {
    return 0;
  }
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
  now = Date.now(),
): number => {
  const remainingHours = getReturnRemainingHours(expedition, now);
  if (remainingHours <= 0) {
    return 0;
  }
  return Math.max(
    SPEEDUP_MIN_BIOMASS,
    Math.ceil(
      Math.max(remainingHours, expedition.speedups || 1) *
        SPEEDUP_BIOMASS_PER_HOUR *
        (expedition.speedups || 1),
    ),
  );
};

/** Цена «Экстренного маяка»: моментальная эвакуация команды, Астро-кваксы */
export const EXTRACTION_ASTRO_COST = 3;
/**
 * Эвакуация выбитой команды: Кваксы за каждую глубину сектора.
 * Пока команда выбита, обратный отсчёт стоит — домой её вытаскивает только
 * платная эвакуация (или «Экстренный маяк» за Астро-кваксы).
 */
export const EVACUATION_TOKEN_COST_PER_DEPTH = 100;

/** Сколько Кваксов стоит эвакуация выбитой команды из сектора */
export const getEvacuationCost = (sector: SectorDef): number =>
  EVACUATION_TOKEN_COST_PER_DEPTH * Math.max(1, sector.depth);

/**
 * Команда выбита и ждёт эвакуации: таймер возврата не идёт.
 * У старых сейвов поля нет — такие походы возвращаются по таймеру, как раньше.
 */
export const isAwaitingEvacuation = (expedition: Expedition): boolean =>
  Boolean(expedition.forced && expedition.awaitingEvacuation);
/** Плата за принудительную эвакуацию выбитой команды (биомасса за жабу) */
export const FORCED_EXTRACTION_FEE_PER_TOAD = 6;
/** Доля утерянной добычи при принудительном возврате */
export const FORCED_LOOT_LOSS = 0.5;
/** Шанс найти образец в хорошем событии */
export const EXPEDITION_SAMPLE_CHANCE = 0.08;
/**
 * Шанс найти Астро-кваксы в хорошем событии.
 *
 * 18% против прежних 12%: вместе с ростом находки по глубине поход даёт
 * в среднем ~0,7 💎 в ближних секторах и ~2 💎 в дальних. Иначе витрина элитных
 * заказов остаётся единственным источником астро и обесценивает разведку.
 */
export const EXPEDITION_ASTRO_CHANCE = 0.18;
/**
 * Шанс дополнительной находки Астро-кваксов в хорошем событии.
 *
 * Раньше на этом месте (35%) выпадал случайный пигмент. Пигменты убраны из
 * добычи похода, поэтому бросок отдаём Астро-кваксам — с тем же количеством,
 * что и у обычной находки (1–3 💎 в зависимости от глубины сектора).
 */
export const EXPEDITION_ASTRO_BONUS_CHANCE = 0.35;

// === Особый образец за прохождение сектора ===

/**
 * Шанс, что удачный поход принесёт особый образец — жабу из лутбокса,
 * закреплённую за глубиной сектора.
 *
 * Обычные образцы (8% в хорошем событии) можно найти в любом секторе, а этот —
 * только за конкретную глубину и только при успешном завершении. Так именных
 * жаб из Жаббокса можно получить и через разведку, а не только за лутбоксы.
 */
export const EXPEDITION_SAMPLE_TOAD_CHANCE = 0.1;

export interface ExpeditionSampleReward {
  /** Тир лутбокса: от обычного на входе до легендарного в центре станции */
  rarity: LootboxRarity;
  /** Конкретная жаба, которая может достаться за прохождение глубины */
  template: Partial<Toad>;
}

/** Шаблон жабы по имени внутри тира (фолбэк — первая жаба тира) */
const getLootboxTemplate = (
  rarity: LootboxRarity,
  name: string,
): Partial<Toad> =>
  UNIQUE_TOADS_BY_RARITY[rarity].find((toad) => toad.name === name) ??
  UNIQUE_TOADS_BY_RARITY[rarity][0];

/**
 * Награда за глубину: от обычных жаб на входе до легендарной в центре станции.
 *
 * Редкость растёт вместе с уровнем, поэтому глубокий рейд ценнее не только
 * добычей, но и шансом на уникальную жабу. Вид привязан к тематике сектора:
 * ржавый шлюз — лесной странник, крематорий — кристаллический призрак и т.д.
 */
export const EXPEDITION_SAMPLE_TOADS: Record<number, ExpeditionSampleReward> = {
  1: {
    rarity: LootboxRarity.common,
    template: getLootboxTemplate(LootboxRarity.common, "Лесной странник"),
  },
  2: {
    rarity: LootboxRarity.common,
    template: getLootboxTemplate(LootboxRarity.common, "Болотный житель"),
  },
  3: {
    rarity: LootboxRarity.uncommon,
    template: getLootboxTemplate(LootboxRarity.uncommon, "Изумрудный прыгун"),
  },
  4: {
    rarity: LootboxRarity.uncommon,
    template: getLootboxTemplate(LootboxRarity.uncommon, "Золотистый охотник"),
  },
  5: {
    rarity: LootboxRarity.rare,
    template: getLootboxTemplate(LootboxRarity.rare, "Камнелап"),
  },
  6: {
    rarity: LootboxRarity.rare,
    template: getLootboxTemplate(LootboxRarity.rare, "Сапфировый призрак"),
  },
  7: {
    rarity: LootboxRarity.epic,
    template: getLootboxTemplate(LootboxRarity.epic, "Кваккон"),
  },
  8: {
    rarity: LootboxRarity.legendary,
    template: getLootboxTemplate(LootboxRarity.legendary, "Галактрон"),
  },
};

/** Самая глубокая награда — фолбэк для секторов вне таблицы */
const MAX_SAMPLE_DEPTH = Math.max(
  ...Object.keys(EXPEDITION_SAMPLE_TOADS).map(Number),
);

/** Жаба из лутбокса, закреплённая за глубиной сектора */
export const getExpeditionSampleReward = (
  sector: SectorDef,
): ExpeditionSampleReward =>
  EXPEDITION_SAMPLE_TOADS[sector.depth] ??
  EXPEDITION_SAMPLE_TOADS[MAX_SAMPLE_DEPTH];

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
