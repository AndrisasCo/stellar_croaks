import { Items } from "./user";

/**
 * ЧАСТЬ 5. Разведка (походы / экспедиции).
 * Чистые описания: роли команды, сектора Периметра, состояние похода.
 * Логика — `utils/expedition-manager.ts`, события — `utils/expedition-events.ts`,
 * константы и роли — `utils/expedition-config.ts`.
 */

/** Роль жабы в команде (Часть 5.3) */
export type ExpeditionRole =
  | "scout"
  | "tank"
  | "medic"
  | "hacker"
  | "negotiator";

/**
 * Фаза похода: идём наружу, возвращаемся или уже дома.
 *
 * `completed` — команда вернулась, но игрок ещё не решил судьбу добычи: на вкладке
 * «Походы» висят карточки завершённых походов с кнопками «Завершить»
 * (лут на склад) и «Превратить лут в биомассу». Жабы команды в это время ещё
 * считаются занятыми и в «Разведку» не возвращаются.
 */
export type ExpeditionPhase = "outbound" | "returning" | "completed";

/** Добыча, которую команда несёт из сектора */
export interface ExpeditionLoot {
  biomass: number;
  tokens: number;
  astro_quax: number;
  /** Предметы склада: корм, пыль, пигменты, батарейки, мушки, черви */
  items: Partial<Record<Items, number>>;
  /** Найденные образцы: на возврате превращаются в жаб */
  samples: number;
}

export const createEmptyLoot = (): ExpeditionLoot => ({
  biomass: 0,
  tokens: 0,
  astro_quax: 0,
  items: {},
  samples: 0,
});

/** Строка чата экспедиции */
export interface ExpeditionLogEntry {
  id: string;
  at: number;
  /** Роль, от лица которой реплика (или system — служебная строка) */
  role: ExpeditionRole | "system";
  toadId?: number;
  toadName?: string;
  text: string;
  kind: "good" | "bad" | "info";
  /** Изменение HP жабы в этом событии */
  hpDelta?: number;
}

/** Участник команды: жаба + назначенная роль */
export interface ExpeditionMember {
  toadId: number;
  role: ExpeditionRole;
}

export interface Expedition {
  id: string;
  sectorId: number;
  team: ExpeditionMember[];
  startedAt: number;
  phase: ExpeditionPhase;
  /** Прогресс пути «туда», 0..1 (обновляется на каждом тике) */
  progress: number;
  /** Сколько шагов событий уже разыграно */
  resolvedSteps: number;
  /** Момент старта обратного пути */
  returnStartedAt?: number;
  /** Длительность обратного пути (часы) */
  returnHours?: number;
  /** Команду выбили: возврат принудительный, с платой за эвакуацию */
  forced?: boolean;
  /**
   * Шанс завершить поход удачно (Часть 5.4): каждая роль даёт +20% + сложность сектора
   * и удача. Считается на старте, бросок — на возврате: удача множит добычу.
   */
  successChance?: number;
  /** Сколько раз ускоряли возврат */
  speedups?: number;
  /** Итог завершённого похода: удача (true) или провал (false) */
  success?: boolean;
  /** Момент возврата команды домой (для карточки завершённого похода) */
  completedAt?: number;
  /**
   * Сектор «Разведка», из которого ушла команда. После разбора добычи жабы
   * возвращаются именно сюда, а не в биопод: их снова видно на гексе разведки.
   */
  originRoomId?: number;
  /**
   * Добыча похода. Для `phase: "completed"` здесь лежит уже итоговая добыча:
   * с множителем удачи, потерями при эвакуации и добором до нормы фермы.
   */
  loot: ExpeditionLoot;
  log: ExpeditionLogEntry[];
}

/** Сводная статистика разведки (для открытия секторов и ачивок) */
export interface ExpeditionStats {
  /** Завершённых походов */
  completed: number;
  /** Максимальная глубина, из которой команда вернулась */
  bestDepth: number;
  /** Сколько жаб выбили из строя события походов */
  downed: number;
  /**
   * Явно открытые секторы КОНТУРа. Раньше сектор открывался сам по числу
   * завершённых походов; теперь игрок тратит на него пропуска со склада.
   * В старых сейвах поля нет — `normalizeExpeditionStats` выводит открытые
   * секторы из `completed` по прежним порогам, чтобы прогресс не потерялся.
   */
  unlockedSectors?: number[];
}

export const DEFAULT_EXPEDITION_STATS: ExpeditionStats = {
  completed: 0,
  bestDepth: 0,
  downed: 0,
  unlockedSectors: [],
};

/** Сектор Периметра (Часть 5.7) */
export interface SectorDef {
  id: number;
  name: string;
  icon: string;
  description: string;
  /** Глубина: влияет на добычу, урон и порядок открытия */
  depth: number;
  /** Длительность пути в одну сторону, часы */
  durationHours: number;
  /** Множитель добычи */
  lootMultiplier: number;
  /** Множитель урона событий */
  dangerMultiplier: number;
  /** Сколько пропусков КОНТУРа стоит открыть сектор */
  unlockCost: number;
  /** Стартовый сектор — открыт всегда */
  starter?: boolean;
}

export const SECTORS: SectorDef[] = [
  {
    id: 1,
    name: "Ржавый шлюз",
    icon: "🚪",
    description: "Первый контур Периметра: сыро, грязно, но почти безопасно.",
    depth: 1,
    durationHours: 1.5,
    lootMultiplier: 1,
    dangerMultiplier: 1,
    unlockCost: 0,
    starter: true,
  },
  {
    id: 2,
    name: "Затопленный бункер",
    icon: "🌊",
    description: "Полузатопленный склад: образцы ещё держатся, турели — тоже.",
    depth: 2,
    durationHours: 3,
    lootMultiplier: 1.4,
    dangerMultiplier: 1.15,
    unlockCost: 1,
  },
  {
    id: 3,
    name: "Станция «Периметр-3»",
    icon: "🏚️",
    description: "Мёртвая станция с рабочими сейфами и голодными дронами.",
    depth: 3,
    durationHours: 5,
    lootMultiplier: 1.8,
    dangerMultiplier: 1.3,
    unlockCost: 3,
  },
  {
    id: 4,
    name: "Орбитальный обломок",
    icon: "🛰️",
    description:
      "Кусок орбитальной лаборатории. Данные уцелели, гравитация — нет.",
    depth: 4,
    durationHours: 7,
    lootMultiplier: 2.3,
    dangerMultiplier: 1.5,
    unlockCost: 6,
  },
  {
    id: 5,
    name: "Репродуктор дронов",
    icon: "🐝",
    description: "Роевой улей автоматики: жалит больно, но деталей — горы.",
    depth: 5,
    durationHours: 9,
    lootMultiplier: 2.8,
    dangerMultiplier: 1.7,
    unlockCost: 10,
  },
  {
    id: 6,
    name: "Реактор «Квак-7»",
    icon: "☢️",
    description:
      "Течёт охлаждайка, светится биомасса. Идеальное место для рейда.",
    depth: 6,
    durationHours: 12,
    lootMultiplier: 3.4,
    dangerMultiplier: 2,
    unlockCost: 15,
  },
  {
    id: 7,
    name: "Архив мёртвых генов",
    icon: "🧬",
    description: "Банк геномов до-Кваковой эпохи. Образцы тут — на вес астро.",
    depth: 7,
    durationHours: 15,
    lootMultiplier: 4,
    dangerMultiplier: 2.3,
    unlockCost: 21,
  },
  {
    id: 8,
    name: "Дальний Периметр",
    icon: "🕳️",
    description: "За этой чертой лаборатория не отвечает за сохранность жаб.",
    depth: 8,
    durationHours: 20,
    lootMultiplier: 5,
    dangerMultiplier: 2.7,
    unlockCost: 28,
  },
];

/**
 * Порядок ролей команды: он же порядок слотов в интерфейсе разведки.
 * Пять ролей — пять вкладов в шанс удачного завершения похода (Часть 5.4).
 */
export const EXPEDITION_ROLE_ORDER: ExpeditionRole[] = [
  "scout",
  "tank",
  "medic",
  "hacker",
  "negotiator",
];

/** Сектор по ID (с фолбэком на стартовый) */
export const getSectorById = (sectorId: number): SectorDef =>
  SECTORS.find((sector) => sector.id === sectorId) ?? SECTORS[0];

/**
 * Прежние пороги открытия: сколько завершённых походов требовалось сектору
 * до перехода на пропуска КОНТУРа. Нужны только для старых сейвов.
 */
const LEGACY_UNLOCK_EXPEDITIONS: Record<number, number> = {
  2: 1,
  3: 3,
  4: 6,
  5: 10,
  6: 15,
  7: 21,
  8: 28,
};

/** Секторы, которые старый сейв открывал по числу завершённых походов */
export const getLegacyUnlockedSectors = (completed: number): number[] =>
  SECTORS.filter((sector) => {
    if (sector.starter) {
      return false;
    }

    const required = LEGACY_UNLOCK_EXPEDITIONS[sector.id];

    return required !== undefined && completed >= required;
  }).map((sector) => sector.id);

/**
 * Приводит статистику из сейва к полному виду.
 *
 * Если `unlockedSectors` в сейве нет (старая версия игры), открытые секторы
 * восстанавливаются по прежним порогам `completed`. Пустой массив — это уже
 * новый сейв: игрок просто ещё ничего не открывал, и подставлять ему секторы
 * за завершённые походы нельзя.
 */
export const normalizeExpeditionStats = (
  stats?: Partial<ExpeditionStats>,
): ExpeditionStats => {
  const merged = { ...DEFAULT_EXPEDITION_STATS, ...(stats ?? {}) };

  if (Array.isArray(stats?.unlockedSectors)) {
    return {
      ...merged,
      unlockedSectors: Array.from(
        new Set(stats.unlockedSectors.filter(Number.isInteger)),
      ),
    };
  }

  return {
    ...merged,
    unlockedSectors: getLegacyUnlockedSectors(merged.completed),
  };
};

/** Открыт ли сектор: стартовый — всегда, остальные — если игрок их открыл */
export const isSectorUnlocked = (
  sector: SectorDef,
  stats: ExpeditionStats = DEFAULT_EXPEDITION_STATS,
): boolean =>
  Boolean(sector.starter) ||
  (stats.unlockedSectors ?? getLegacyUnlockedSectors(stats.completed)).includes(
    sector.id,
  );
