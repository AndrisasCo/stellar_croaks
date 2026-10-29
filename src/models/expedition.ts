import { Toad } from "./Toad";
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
  /** Предметы склада: корм, генная пыль, пигменты, батарейки, мушки, черви */
  items: Partial<Record<Items, number>>;
  /** Найденные образцы: на возврате превращаются в жаб */
  samples: number;
  /**
   * Особый образец за успешное прохождение глубины (10%): из него при разборе
   * добычи вырастает не обычная жаба сектора, а именная жаба из лутбокса,
   * закреплённая за уровнем (`EXPEDITION_SAMPLE_TOADS`).
   *
   * Поле необязательное: старые сейвы его не знают, и это нормально —
   * отсутствие означает 0 особых образцов.
   */
  lootboxSamples?: number;
}

export const createEmptyLoot = (): ExpeditionLoot => ({
  biomass: 0,
  tokens: 0,
  astro_quax: 0,
  items: {},
  samples: 0,
  lootboxSamples: 0,
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
  /**
   * Команда дошла до сектора. Только такой поход может сложиться удачно:
   * разворот с середины пути (отзыв или «Экстренный маяк» до прибытия) успехом
   * не считается. Маяк, нажатый на обратном пути, исход не меняет — команда и
   * так возвращалась домой.
   */
  reachedSector?: boolean;
  /** Сколько шагов событий уже разыграно */
  resolvedSteps: number;
  /**
   * Сколько событий на пути «туда». Фиксируется на старте, чтобы правка
   * длительности сектора не меняла число событий уже идущего похода.
   * У старых сейвов поля нет — считаем по текущему сектору.
   */
  totalEvents?: number;
  /** Момент старта обратного пути */
  returnStartedAt?: number;
  /** Длительность обратного пути (часы) */
  returnHours?: number;
  /** Команду выбили: возврат принудительный, с платой за эвакуацию */
  forced?: boolean;
  /**
   * Вся команда выбита и ждёт эвакуации: обратный отсчёт стоит, пока игрок
   * не оплатит её за Кваксы (`getEvacuationCost`). Поле появилось позже старых
   * сейвов: выбитые походы без него возвращались сами по таймеру.
   */
  awaitingEvacuation?: boolean;
  /**
   * Шанс завершить поход удачно (Часть 5.4): каждая роль даёт +20% + сложность сектора
   * и удача. Считается на старте, бросок — на возврате: удача множит добычу.
   */
  successChance?: number;
  /** Сколько раз ускоряли возврат */
  speedups?: number;
  /**
   * Итог завершённого похода: `true` — команда дошла до сектора и бросок удачи
   * сложился; `false` — провал (в том числе разворот с середины пути).
   */
  success?: boolean;
  /** Момент возврата команды домой (для карточки завершённого похода) */
  completedAt?: number;
  /**
   * Контур («Разведка»), из которого ушла команда: id гекса карты (`room.id`).
   * После разбора добычи жабы возвращаются именно сюда, а не в биопод — их снова
   * видно на гексе контура, а модалка понимает, какому контуру принадлежит поход.
   *
   * Старые сейвы могли помнить числовой `Scene.id` — его тоже принимаем.
   */
  originRoomId?: number | string;
  /**
   * Жабы, которые присоединились к команде в пути (событие «попутчик»).
   * В состав ролей они не входят: дома `completeArrival` поселит их в биоподы,
   * а до возвращения они просто идут вместе с командой.
   */
  companions?: Partial<Toad>[];
  /**
   * Пропуска КОНТУРа, начисленные за этот поход.
   *
   * Сами пропуска попадают на склад сразу при возврате команды, а поле нужно
   * только для отчёта: показать награду в добыче похода. В `loot` их нет,
   * поэтому переработка добычи в биомассу их не затрагивает.
   *
   * В старых сейвах поля нет — отчёт просто не покажет пропуска.
   */
  contourPasses?: number;
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
   * Секторы, которые команда прошла хотя бы раз: дошла до них и вернулась.
   * Нужны для правила «следующую глубину открывают только после пройденной
   * предыдущей». В старых сейвах поля нет — `normalizeExpeditionStats`
   * выводит его из `bestDepth`, чтобы прогресс не потерялся.
   */
  completedSectors?: number[];
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
  completedSectors: [],
  unlockedSectors: [],
};

/** Сектор Периметра (Часть 5.7) */
export interface SectorDef {
  id: number;
  name: string;
  icon: string;
  description: string;
  /**
   * Иллюстрация для карусели секторов: webp из `public/bg/sectors`.
   * Необязательна — у сектора без арта остаётся прежняя текстовая карточка.
   */
  image?: string;
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
    description:
      "Внешний контур Периметра и первая точка доступа для рейдовых групп. Инфраструктура частично разрушена, атмосфера влажная и коррозийная. Угроза минимальна: патрули автоматики редки, ценных образцов почти нет.",
    image: "/bg/sectors/contur1.webp",
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
    description:
      "Складской уровень, затопленный после отказа дренажных систем. Значительная часть грузов испорчена, однако в герметичных контейнерах сохранились рабочие образцы. Передвижение затруднено, возможны обрушения конструкций и контакт с подводной автоматикой.",
    image: "/bg/sectors/contur2.webp",
    depth: 2,
    durationHours: 2,
    lootMultiplier: 1.4,
    dangerMultiplier: 1.15,
    unlockCost: 1,
  },
  {
    id: 3,
    name: "Станция «Периметр-3»",
    icon: "🏚️",
    description:
      "Выведенная из эксплуатации станция наблюдения. Персонал эвакуирован, системы охраны переведены в автономный режим. Сейфы и терминалы частично функциональны, периметр патрулируется дронами с истёкшим сроком обслуживания. Уровень угрозы умеренный.",
    image: "/bg/sectors/contur3.webp",
    depth: 3,
    durationHours: 4,
    lootMultiplier: 1.8,
    dangerMultiplier: 1.3,
    unlockCost: 3,
  },
  {
    id: 4,
    name: "Орбитальный обломок",
    icon: "🛰️",
    description:
      "Фрагмент орбитальной лаборатории, потерявший гравитационную стабилизацию. Архивы данных уцелели и представляют высокую ценность, однако перемещение внутри сектора требует постоянного контроля ориентации. Риск травм и потери снаряжения повышен.",
    image: "/bg/sectors/contur4.webp",
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
    description:
      "Автоматизированный сборочный улей роевой автоматики. Конвейеры продолжают выпуск дронов по устаревшей программе, несмотря на отсутствие операторов. Рой агрессивен и скоординирован, однако насыщенность узлами, приводами и редкими компонентами делает сектор приоритетной целью для рейда.",
    image: "/bg/sectors/contur5.webp",
    depth: 5,
    durationHours: 9,
    lootMultiplier: 2.8,
    dangerMultiplier: 1.7,
    unlockCost: 10,
  },
  {
    id: 6,
    name: "Гелиос-крематорий",
    icon: "☢️",
    description:
      "Солнечный коллектор и система термообработки отходов станции. Температурный режим нестабилен, броня деградирует быстро, однако силовые ячейки и теплоносители сохранили ресурс. Работать рекомендуется короткими циклами.",
    image: "/bg/sectors/contur6.webp",
    depth: 6,
    durationHours: 12,
    lootMultiplier: 3.4,
    dangerMultiplier: 2,
    unlockCost: 15,
  },
  {
    id: 7,
    name: "Гидропонная станция",
    icon: "🕳️",
    description:
      "Растения разрослись и вплелись корнями в обшивку сектора, напряжение непостоянно, а из темноты доносится подозрительное жужжание. ",
    image: "/bg/sectors/contur7.webp",
    depth: 7,
    durationHours: 20,
    lootMultiplier: 5,
    dangerMultiplier: 2.7,
    unlockCost: 28,
  },
  {
    id: 8,
    name: "Центр станции",
    icon: "☣️",
    description:
      "Центральный управляющий комплекс станции. Из глубины сектора регистрируется периодический сигнал неустановленного происхождения. Это даёт основание предполагать, что не вся разумная жизнь на станции уничтожена — либо что-то научилось имитировать её достаточно убедительно. Здесь сосредоточены ключевые архивы, силовые установки и центральный контур управления. ",
    image: "/bg/sectors/contur8.webp",
    depth: 8,
    durationHours: 24,
    lootMultiplier: 14.5,
    dangerMultiplier: 5.8,
    unlockCost: 40,
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
 * Секторы, которые старый сейв успел пройти. Отдельного списка в нём не было,
 * поэтому считаем пройденными все глубины не больше `bestDepth` — команда
 * возвращалась из самой глубокой, значит предыдущие уже были ей по силам.
 */
const getLegacyCompletedSectors = (bestDepth: number): number[] =>
  SECTORS.filter((sector) => sector.depth <= bestDepth).map(
    (sector) => sector.id,
  );

/**
 * Приводит статистику из сейва к полному виду.
 *
 * Если `unlockedSectors` в сейве нет (старая версия игры), открытые секторы
 * восстанавливаются по прежним порогам `completed`. Пустой массив — это уже
 * новый сейв: игрок просто ещё ничего не открывал, и подставлять ему секторы
 * за завершённые походы нельзя.
 *
 * `completedSectors` появился вместе с правилом «следующая глубина — после
 * пройденной предыдущей». В старых сейвах его нет: выводим пройденные глубины
 * из `bestDepth`, чтобы игрок не потерял уже достигнутый прогресс.
 */
export const normalizeExpeditionStats = (
  stats?: Partial<ExpeditionStats>,
): ExpeditionStats => {
  const merged = { ...DEFAULT_EXPEDITION_STATS, ...(stats ?? {}) };

  const completedSectors = Array.isArray(stats?.completedSectors)
    ? Array.from(new Set(stats.completedSectors.filter(Number.isInteger)))
    : getLegacyCompletedSectors(merged.bestDepth);
  const unlockedSectors = Array.isArray(stats?.unlockedSectors)
    ? Array.from(new Set(stats.unlockedSectors.filter(Number.isInteger)))
    : getLegacyUnlockedSectors(merged.completed);

  return { ...merged, completedSectors, unlockedSectors };
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

/**
 * Предыдущий сектор КОНТУРа — тот, что идёт перед этим по порядку глубин.
 * Именно его нужно сначала открыть и пройти: пропусков может хватить сразу
 * на несколько секторов вперёд, но перепрыгнуть непройденную глубину нельзя.
 */
export const getPreviousSector = (sector: SectorDef): SectorDef | undefined => {
  const index = SECTORS.findIndex((item) => item.id === sector.id);

  return index > 0 ? SECTORS[index - 1] : undefined;
};

/** Сектор пройден: команда хотя бы раз дошла до него и вернулась домой */
export const isSectorCompleted = (
  sector: SectorDef,
  stats: ExpeditionStats = DEFAULT_EXPEDITION_STATS,
): boolean =>
  (
    stats.completedSectors ?? getLegacyCompletedSectors(stats.bestDepth)
  ).includes(sector.id);

/** Предыдущая глубина уже открыта (у стартового сектора предыдущей нет) */
export const isPreviousSectorUnlocked = (
  sector: SectorDef,
  stats: ExpeditionStats = DEFAULT_EXPEDITION_STATS,
): boolean => {
  const previous = getPreviousSector(sector);

  return !previous || isSectorUnlocked(previous, stats);
};

/** Предыдущая глубина уже пройдена хотя бы один раз */
export const isPreviousSectorCompleted = (
  sector: SectorDef,
  stats: ExpeditionStats = DEFAULT_EXPEDITION_STATS,
): boolean => {
  const previous = getPreviousSector(sector);

  return !previous || isSectorCompleted(previous, stats);
};
