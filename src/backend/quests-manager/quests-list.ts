import { Toad } from "../../models/Toad";
import { ToadTypes } from "../../models/Toad/toad-species";
import { SECTORS } from "../../models/expedition";

/**
 * ЖУРНАЛ ЗАДАНИЙ.
 *
 * Каталог — единственный источник правды о заданиях: движок
 * (`backend/quests-manager/index.ts`) только читает эти описания, проверяет
 * триггеры и считает прогресс. Новое задание добавляется одной записью здесь,
 * без правок UI и сохранения.
 *
 * Три типа:
 *  - `quick`  — короткие задания на 2–15 минут;
 *  - `medium` — средние задания, собранные в пять цепочек;
 *  - `long`   — магистраль: пять длинных заданий, которые всегда видны
 *               в журнале и ведут игрока через весь КОНТУР.
 *
 * Шесть сфер покрывают все основные системы колонии: экономика, колония,
 * селекция, разведка, медицина и коллекции.
 */

export type QuestType = "quick" | "medium" | "long";

export type QuestSphere =
  | "economy"
  | "colony"
  | "selection"
  | "exploration"
  | "medicine"
  | "collection";

/** Числовые показатели, по которым считается прогресс задания. */
export type QuestMetric =
  | "toads"
  | "adultToads"
  | "toadSpecies"
  | "generation2Plus"
  | "toadsWithParents"
  | "expeditionReserveRoles"
  | "reserveRoleHacker"
  | "reserveRoleScout"
  | "reserveRoleTank"
  | "reserveRoleMedic"
  | "reserveRoleNegotiator"
  | "rooms"
  | "aviaryRooms"
  | "breedingRooms"
  | "colliderRooms"
  | "scoutRooms"
  | "shopRooms"
  | "hospitalRooms"
  | "powerRooms"
  | "storageRooms"
  | "tokens"
  | "astroQuax"
  | "food"
  | "lootboxes"
  | "geneDust"
  | "contourPass"
  | "completedSectors"
  | "unlockedSectors"
  | "lastSectorCompleted"
  | "completedExpeditions"
  | "bestDepth"
  | "playDays"
  | "sessions"
  | "sickToads"
  | "fedToads"
  | "foodBought"
  | "lootboxOpened"
  | "curedToads"
  | "diseaseOutbreaks"
  | "colliderToads"
  | "perfectExpeditionToads"
  | "eliteOrdersCompleted"
  /** Куплено жаб в Торговой капсуле (накопительный счётчик событий). */
  | "boughtToads"
  /** Продано жаб на рынке. */
  | "soldToads"
  /** Разобрано жаб в диссоциаторе. */
  | "dissolvedToads"
  /** Текущий запас биомассы на ферме. */
  | "biomass"
  /** Жабы с качеством 25+ — научное ядро команды. */
  | "legendaryToads"
  /** Жабы весом 8 и меньше — разведчики узких проходов. */
  | "tinyToads"
  /** Жабы со скоростью 0.2 и меньше — выносливые часовые. */
  | "slowToads"
  /** Жабы с поломкой ДНК 80+ — те, кто выживает в хаосе. */
  | "mutantToads"
  /** Десятое поколение с почти чистой ДНК (поломка ≤ 0.9). */
  | "perfectGenomeToads";

/** События, которые игровой код сообщает журналу явно. */
export type QuestEvent =
  | "toad_fed"
  | "food_bought"
  | "lootbox_opened"
  | "toad_cured"
  | "disease_outbreak"
  | "collider_toad_collected"
  | "elite_order_completed"
  | "toad_bought"
  | "toad_sold"
  | "toad_dissolved";

export type QuestTrigger =
  /** Задание доступно сразу (стартовые задания и магистраль). */
  | { type: "always" }
  /** Предыдущее задание цепочки выполнено. */
  | { type: "chain"; parentId: string }
  /** Достигнут абсолютный показатель игры. */
  | { type: "metric"; metric: QuestMetric; value: number }
  /** Накопилось событие журнала. */
  | { type: "event"; event: QuestEvent; value?: number }
  /** Прошло игровых дней или минут в текущей сессии. */
  | { type: "time"; days?: number; minutes?: number }
  /** Все условия сразу — для составных триггеров. */
  | { type: "all"; triggers: QuestTrigger[] };

export interface QuestGoal {
  /** Показатель, по которому задание считается выполненным. */
  metric: QuestMetric;
  target: number;
  /**
   * Необязательный показатель для полосы прогресса. Нужен там, где цель
   * бинарная (например, «пройти последний сектор»), а показать хочется
   * осмысленный путь по всему КОНТУРу.
   */
  progressMetric?: QuestMetric;
  progressTarget?: number;
  /** Подпись прогресса в карточке: «Секторов пройдено», «Накормлено жаб». */
  label: string;
}

export interface QuestReward {
  tokens?: number;
  astroQuax?: number;
  lootboxes?: number;
  geneDust?: number;
  /** Уникальные специалисты, которые вступают в экспедиционную команду. */
  toads?: QuestToadReward[];
}

/**
 * Жаба-награда за задание.
 *
 * Заготовка уходит в `createToad`: движок сам подберёт биопод и запишет вид в
 * коллекцию. `role` — короткая строка для карточки награды, чтобы игрок понимал,
 * зачем этот специалист нужен команде.
 */
export interface QuestToadReward {
  toad: Partial<Toad>;
  role?: string;
}

export interface QuestDef {
  id: string;
  type: QuestType;
  sphere: QuestSphere;
  title: string;
  description: string;
  /** 1–3 предложения лора: зачем колонии это задание и как оно ведёт в глубину. */
  lore?: string;
  trigger: QuestTrigger;
  goal: QuestGoal;
  rewards: QuestReward;
  /** Меньшее число — выше в списке. */
  priority?: number;
  /** Стартовое задание: активируется при первом открытии журнала. */
  starter?: boolean;
  /** Средние задания собираются в цепочки (см. `QUEST_CHAINS`). */
  chainId?: string;
}

export const QUEST_SPHERES: Record<
  QuestSphere,
  {
    title: string;
    icon: string;
    badgeClass: string;
    barClass: string;
    panelClass: string;
  }
> = {
  economy: {
    title: "Экономика",
    icon: "🔷",
    badgeClass: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    barClass: "bg-amber-400",
    panelClass: "border-amber-400/20",
  },
  colony: {
    title: "Колония",
    icon: "🏙️",
    badgeClass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    barClass: "bg-emerald-400",
    panelClass: "border-emerald-400/20",
  },
  selection: {
    title: "Селекция",
    icon: "🧬",
    badgeClass: "border-violet-400/30 bg-violet-500/10 text-violet-200",
    barClass: "bg-violet-400",
    panelClass: "border-violet-400/20",
  },
  exploration: {
    title: "Разведка",
    icon: "🧭",
    badgeClass: "border-sky-400/30 bg-sky-500/10 text-sky-200",
    barClass: "bg-sky-400",
    panelClass: "border-sky-400/20",
  },
  medicine: {
    title: "Медицина",
    icon: "🩹",
    badgeClass: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    barClass: "bg-rose-400",
    panelClass: "border-rose-400/20",
  },
  collection: {
    title: "Коллекции",
    icon: "📦",
    badgeClass: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200",
    barClass: "bg-fuchsia-400",
    panelClass: "border-fuchsia-400/20",
  },
};

export const QUEST_TYPE_META: Record<
  QuestType,
  { title: string; short: string; icon: string }
> = {
  quick: { title: "Быстрые задания", short: "Быстрое", icon: "⚡" },
  medium: { title: "Средние задания", short: "Среднее", icon: "⏳" },
  long: { title: "Магистраль", short: "Долгое", icon: "🗺️" },
};

/**
 * Пять средних цепочек. Внутри большинства цепочек задания открываются по
 * очереди, а между цепочками игрок может переключаться — журнал держит
 * несколько активных средних задач из разных сфер. `m07` и `m10` — боковые
 * ответвления от `q15` и `q16`: медицинская и коллекционная линии не должны
 * ждать последнего шага основной секции. «Генный алхимик» — отдельная ветка
 * для необычных особей, из которых собирают научный отдел экспедиции.
 */
export const QUEST_CHAINS: QuestChain[] = [
  {
    id: "supply",
    title: "Экономика и снабжение",
    description: "Оборот Кваксов, запас корма и космический капитал.",
    sphere: "economy",
    taskIds: [
      "m01-turnover",
      "m02-celestial-capital",
      "m03-warehouse-stock",
      "m16-elite-broker",
      "m18-thousand",
      "m19-toad-trader",
    ],
  },
  {
    id: "colony",
    title: "Колониальный уклад",
    description: "Жильё, энергия, лаборатория и профилактика болезней.",
    sphere: "colony",
    taskIds: [
      "m04-biropolis",
      "m05-powered",
      "m06-laboratory",
      "m07-prevention",
      "m17-breeding-line",
      "m25-biomass-100",
      "m26-dissolve-10",
    ],
  },
  {
    id: "selection",
    title: "Селекция и коллекции",
    description: "Племенные линии, разнообразие видов и архив образцов.",
    sphere: "selection",
    taskIds: [
      "m08-bloodline",
      "m09-genetic-diversity",
      "m13a-operator",
      "m13b-scout",
      "m13c-tank",
      "m13d-medic",
      "m13e-negotiator",
      "m14-collider-line",
      "m15-perfect-organism",
      "m10-sample-archive",
      "m27-lootbox-100",
    ],
  },
  {
    id: "genetics",
    title: "Генный алхимик",
    description:
      "Странные, редкие и нестабильные особи, из которых собирают научный отдел экспедиции.",
    sphere: "selection",
    taskIds: [
      "m20-legendary-25",
      "m21-slow-gourmet",
      "m22-mini-quack",
      "m23-chaos-dna",
      "m24-perfect-genome",
    ],
  },
  {
    id: "perimeter",
    title: "Периметр",
    description: "Глубина КОНТУРа и пропуска в неизвестность.",
    sphere: "exploration",
    taskIds: ["m11-depth-three", "m12-unknown-pass", "m28-expedition-10"],
  },
];

export const QUEST_CHAIN_ORDER = QUEST_CHAINS.map((chain) => chain.id);

export const getQuestChain = (chainId?: string): QuestChain | undefined =>
  chainId ? QUEST_CHAINS.find((chain) => chain.id === chainId) : undefined;

const quick = (def: Omit<QuestDef, "type">): QuestDef => ({
  ...def,
  type: "quick",
});
const medium = (def: Omit<QuestDef, "type">): QuestDef => ({
  ...def,
  type: "medium",
});
const long = (def: Omit<QuestDef, "type">): QuestDef => ({
  ...def,
  type: "long",
});

export interface QuestChain {
  id: string;
  title: string;
  description: string;
  sphere: QuestSphere;
  taskIds: string[];
}

/**
 * Специалисты экспедиционного корпуса.
 *
 * Раньше это были групповые награды достижений. Теперь каждая жаба вступает в
 * команду только через задание: игрок не «выбивает» её за набор галочек, а
 * действительно доводит колонию до нужного состояния и получает пополнение.
 */
const CREW_PROFESSOR: QuestToadReward = {
  role: "генетик · качество линии",
  toad: {
    name: "Профессор Пузырь",
    type: ToadTypes.turtle,
    generation: 0,
    sex: "male",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 0 },
    genes: {
      colors: ["#4B0082", "#32CD32", "#FFD700"],
      pattern: "holographic",
      weight: 15,
      speed: 0.5,
      rarity: 5,
      hungerRate: 0.5,
      fertility: 1,
      personality: "energetic",
    },
  },
};

const CREW_BARON: QuestToadReward = {
  role: "снабженец · торговые связи",
  toad: {
    name: "Барон Квак-Ротшильд",
    type: ToadTypes.topaz,
    generation: 0,
    sex: "male",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 0 },
    genes: {
      colors: ["#FFD700", "#C0C0C0", "#000000"],
      pattern: "imperial_stripes",
      weight: 22.5,
      speed: 0.8,
      rarity: 5,
      hungerRate: 0.5,
      fertility: 0.5,
      personality: "imperial",
    },
  },
};

const CREW_RECOMBINANT: QuestToadReward = {
  role: "биоинженер · контроль мутаций",
  toad: {
    name: "Рекомбинант Идеальный",
    type: ToadTypes.mutantNeonBlue,
    generation: 0,
    sex: "neuter",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 50 },
    genes: {
      colors: ["#00CED1", "#E6E6FA", "#F0E68C"],
      pattern: "fractal_geometric",
      weight: 20,
      speed: 1.2,
      rarity: 5,
      hungerRate: 0.7,
      fertility: 1.5,
      personality: "innovator",
    },
  },
};

const CREW_SYMBIONT: QuestToadReward = {
  role: "медик · выживание в хаосе",
  toad: {
    name: "Симбионт Стабильный",
    type: ToadTypes.forest,
    generation: 0,
    sex: "female",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 65 },
    genes: {
      colors: ["#228B22", "#90EE90", "#006400"],
      pattern: "stripes",
      weight: 28,
      speed: 0.3,
      rarity: 5,
      hungerRate: 1.8,
      fertility: 0,
      personality: "calm",
    },
  },
};

const CREW_NEON: QuestToadReward = {
  role: "инженер · чистая линия",
  toad: {
    name: "Неоновый Эталон",
    type: ToadTypes.mutantNeon,
    generation: 10,
    sex: "male",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 0 },
    genes: {
      colors: ["#39FF14", "#00FFFF", "#8A2BE2"],
      pattern: "fractal_geometric",
      weight: 21,
      speed: 1.6,
      rarity: 7,
      hungerRate: 0.6,
      fertility: 1.8,
      personality: "innovator",
    },
  },
};

const CREW_CURATOR: QuestToadReward = {
  role: "биокуратор · ферма и биомасса",
  toad: {
    name: "Биокуратор Квак",
    type: ToadTypes.crystall,
    generation: 0,
    sex: "female",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 0 },
    genes: {
      colors: ["#7FFF00", "#00CED1", "#2E8B57"],
      pattern: "holographic",
      weight: 24,
      speed: 1.1,
      rarity: 5,
      hungerRate: 0.6,
      fertility: 1.4,
      personality: "workaholic",
    },
  },
};

const CREW_LUCKY: QuestToadReward = {
  role: "собиратель · поиск артефактов",
  toad: {
    name: "Брилиантовый везунчик",
    type: ToadTypes.diamond,
    generation: 0,
    sex: "female",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 0 },
    genes: {
      colors: ["#4B0082"],
      pattern: "holographic",
      weight: 18,
      speed: 1,
      rarity: 5,
      hungerRate: 1,
      fertility: 0.5,
      personality: "lucky",
    },
  },
};

const CREW_GUIDE: QuestToadReward = {
  role: "проводник · маршруты Периметра",
  toad: {
    name: "Проводник Периметра",
    type: ToadTypes.forest,
    generation: 0,
    sex: "female",
    stage: "adult",
    parents: null,
    pregnancy: null,
    state: { hunger: 100, genetic_fault: 0 },
    genes: {
      colors: ["#556B2F", "#2E8B57", "#8FBC8F"],
      pattern: "striped",
      weight: 26,
      speed: 1.45,
      rarity: 6,
      hungerRate: 0.7,
      fertility: 1.6,
      personality: "adventurer",
    },
  },
};

const quickQuests: QuestDef[] = [
  quick({
    id: "q01-first-sector",
    sphere: "colony",
    title: "Первый сектор",
    description:
      "Постройте Торговую капсулу — она бесплатна и открывает рынок.",
    lore: "Станция давно мертва, но её торговые капсулы всё ещё узнают входящий сигнал. Первая капсула — не роскошь, а способ выжить: без обмена колония останется наедине с пустыми полками.",
    trigger: { type: "always" },
    goal: {
      metric: "shopRooms",
      target: 1,
      label: "Торговых капсул",
    },
    rewards: { tokens: 20 },
    priority: 1,
    starter: true,
  }),
  quick({
    id: "q04-first-feed",
    sphere: "selection",
    title: "Первое кормление",
    description:
      "Покормите хотя бы одну жабу: корм покупается в Торговой капсуле.",
    trigger: { type: "always" },
    goal: {
      metric: "fedToads",
      target: 1,
      label: "Накормлено жаб",
    },
    rewards: { tokens: 10 },
    priority: 2,
    starter: true,
  }),
  quick({
    id: "q02-food-stock",
    sphere: "economy",
    title: "Корм в кладовой",
    description:
      "Купите упаковку корма на 10 единиц — колония не должна голодать.",
    trigger: { type: "chain", parentId: "q01-first-sector" },
    goal: {
      metric: "foodBought",
      target: 10,
      label: "Куплено корма",
    },
    rewards: { tokens: 15 },
    priority: 10,
  }),
  quick({
    id: "q03-feed-colony",
    sphere: "selection",
    title: "Накормить колонию",
    description:
      "Покормите трёх жаб: сытые жабы быстрее восстанавливаются и лучше работают.",
    trigger: { type: "chain", parentId: "q02-food-stock" },
    goal: {
      metric: "fedToads",
      target: 3,
      label: "Накормлено жаб",
    },
    rewards: { tokens: 15 },
    priority: 11,
  }),
  quick({
    id: "q05-roof",
    sphere: "colony",
    title: "Крыша над головой",
    description:
      "Постройте новый биопод: в колонии всегда должно хватать места.",
    lore: "Биопод — не просто вольер: это кислород, тепло и влага. Каждый новый биопод позволяет расширить производство биомассы.",
    trigger: { type: "chain", parentId: "q03-feed-colony" },
    goal: {
      metric: "aviaryRooms",
      target: 1,
      label: "Построено биоподов",
    },
    rewards: { tokens: 25 },
    priority: 12,
  }),
  quick({
    id: "q06-first-deal",
    sphere: "economy",
    title: "Первая сделка",
    description: "Накопите 150 Кваксов — торговля любит платёжеспособных.",
    trigger: { type: "chain", parentId: "q02-food-stock" },
    goal: {
      metric: "tokens",
      target: 150,
      label: "Кваксов в казне",
    },
    rewards: { lootboxes: 1 },
    priority: 13,
  }),
  quick({
    id: "q07-open-lootbox",
    sphere: "collection",
    title: "Открыть лутбокс",
    description: "Откройте лутбокс и поселите новую жабу в свободный биопод.",
    lore: "Лутбоксы падают с орбиты вместе с обломками — контейнеры снабжения, которые станция так и не дождалась.",
    trigger: { type: "event", event: "lootbox_opened" },
    goal: {
      metric: "lootboxOpened",
      target: 1,
      label: "Открыто лутбоксов",
    },
    rewards: { astroQuax: 5 },
    priority: 14,
  }),
  quick({
    id: "q08-sanitary-day",
    sphere: "medicine",
    title: "Санитарный день",
    description: "Вылечите жабу: поместите ее в Медотсек.",
    lore: "Болезни на станции не умирают вместе с экипажем: они ждут в вентиляции, в фильтрах, в старых образцах. Медотсек изолирует болезнь, предотвращая ее распространение и ускорит выздоровления жабы. ",
    trigger: { type: "event", event: "disease_outbreak" },
    goal: {
      metric: "curedToads",
      target: 1,
      label: "Вылечено жаб",
    },
    rewards: { tokens: 30 },
    priority: 15,
  }),
  quick({
    id: "q09-enter-contour",
    sphere: "exploration",
    title: "В КОНТУР",
    description: "Постройте КОНТУР — диспетчерскую для походов по Периметру.",
    lore: "Начало исследование станции будет положено. ",
    trigger: { type: "chain", parentId: "q03-feed-colony" },
    goal: {
      metric: "scoutRooms",
      target: 1,
      label: "Построено КОНТУРов",
    },
    rewards: { tokens: 25 },
    priority: 16,
  }),
  quick({
    id: "q10-first-expedition",
    sphere: "exploration",
    title: "Первый поход",
    description: "Завершите первый поход и верните команду домой.",
    lore: "Первый поход — проверка не глубины, а дисциплины: вернуться должны все, кто ушёл. ",
    trigger: { type: "chain", parentId: "q09-enter-contour" },
    goal: {
      metric: "completedExpeditions",
      target: 1,
      label: "Завершено походов",
    },
    rewards: { lootboxes: 1 },
    priority: 17,
  }),
  quick({
    id: "q11-offspring",
    sphere: "selection",
    title: "Потомство",
    description: "Получите первого головастика в репродукторе.",
    lore: "Репродуктор — единственное место на станции, где жизнь ещё начинается, а не заканчивается. Первый головастик — доказательство, что колония здесь не гостит.",
    trigger: { type: "chain", parentId: "q05-roof" },
    goal: {
      metric: "toadsWithParents",
      target: 1,
      label: "Головастик рожден",
    },
    rewards: { lootboxes: 1 },
    priority: 18,
  }),
  quick({
    id: "q12-power-order",
    sphere: "colony",
    title: "Свет и порядок",
    description: "Постройте энергосектор: без тока сектор бесполезен.",
    trigger: { type: "chain", parentId: "q05-roof" },
    goal: {
      metric: "powerRooms",
      target: 1,
      label: "Энергосекторов",
    },
    rewards: { tokens: 20 },
    priority: 19,
  }),
  quick({
    id: "q13-astro-pocket",
    sphere: "economy",
    title: "Астро в кармане",
    description: "Соберите 10 астро-кваксов — валюта уникальных сделок.",
    trigger: { type: "chain", parentId: "q10-first-expedition" },
    goal: {
      metric: "astroQuax",
      target: 10,
      label: "Астро-кваксов",
    },
    rewards: { lootboxes: 1 },
    priority: 20,
  }),
  quick({
    id: "q14-first-collection",
    sphere: "collection",
    title: "Первая коллекция",
    description: "Соберите жаб трёх разных видов: гибриды тоже считаются.",
    trigger: { type: "chain", parentId: "q07-open-lootbox" },
    goal: {
      metric: "toadSpecies",
      target: 3,
      label: "Видов жаб",
    },
    rewards: { lootboxes: 2 },
    priority: 21,
  }),
  quick({
    id: "q15-hospital",
    sphere: "medicine",
    title: "Медотсек",
    description:
      "Постройте Медотсек: болезни проходят быстрее, пациенты изолированы.",
    trigger: { type: "chain", parentId: "q08-sanitary-day" },
    goal: {
      metric: "hospitalRooms",
      target: 1,
      label: "Медотсеков",
    },
    rewards: { tokens: 30 },
    priority: 22,
  }),
  quick({
    id: "q16-gene-dust",
    sphere: "collection",
    title: "Генная пыль",
    description: "Соберите 5 единиц генной пыли — материала для коллайдера.",
    lore: "Генная пыль оседает там, где работал коллайдер: в трещинах, в фильтрах, в костях тех, кто не успел выйти. Колония собирает её, чтобы не повторить их путь.",
    trigger: { type: "chain", parentId: "q07-open-lootbox" },
    goal: {
      metric: "geneDust",
      target: 5,
      label: "Генной пыли",
    },
    rewards: { astroQuax: 10 },
    priority: 23,
  }),
  quick({
    id: "q17-first-purchase",
    sphere: "economy",
    title: "Пополнение семейства",
    description: "Купите первую жабу в Торговой капсуле.",
    lore: "Торговая капсула открыта, но колонии нужны новые особи: без свежей крови экспедиция не переживёт глубину. Первая покупка — не трата, а вербовка.",
    trigger: { type: "chain", parentId: "q01-first-sector" },
    goal: {
      metric: "boughtToads",
      target: 1,
      label: "Куплено жаб",
    },
    rewards: { tokens: 25 },
    priority: 24,
  }),
  quick({
    id: "q18-first-sale",
    sphere: "economy",
    title: "Жаба уходит с молотка",
    description: "Продайте одну жабу на рынке.",
    lore: "Не всякая жаба годится в исследовательскую команду. Иногда лучшая служба — обменять её на ресурсы и освободить место под нового специалиста. ",
    trigger: { type: "chain", parentId: "q01-first-sector" },
    goal: {
      metric: "soldToads",
      target: 1,
      label: "Продано жаб",
    },
    rewards: { tokens: 30 },
    priority: 25,
  }),
  quick({
    id: "q19-first-hybrid",
    sphere: "selection",
    title: "Безумный ученый",
    description: "Заберите первого гибрида из инкубатора коллайдера.",
    lore: "Коллайдер выдал первую химеру — нестабильную, но живую. Профессор Пузырь согласен присоединиться к команде, если вы докажете, что умеете доводить эксперимент до конца, а не до первой ошибки.",
    trigger: { type: "metric", metric: "colliderRooms", value: 1 },
    goal: {
      metric: "colliderToads",
      target: 1,
      label: "Жаб из коллайдера",
    },
    rewards: { toads: [CREW_PROFESSOR], geneDust: 5 },
    priority: 26,
  }),
  quick({
    id: "q20-first-dissolve",
    sphere: "colony",
    title: "Первый разбор",
    description: "Переработайте жабу в биомассу в диссоциаторе.",
    lore: "Диссоциатор превращает павшую или лишнюю жабу в биомассу. Для дальних секторов нужен запас топлива — и немного уважения к тем, кто его оставил.",
    trigger: { type: "event", event: "toad_dissolved" },
    goal: {
      metric: "dissolvedToads",
      target: 1,
      label: "Разобрано жаб",
    },
    rewards: { tokens: 25 },
    priority: 27,
  }),
];

const mediumQuests: QuestDef[] = [
  medium({
    id: "m01-turnover",
    sphere: "economy",
    chainId: "supply",
    title: "Оборот",
    description:
      "Доведите казну до 300 Кваксов, не останавливаясь на первой сделке.",
    lore: "Триста Кваксов — это уже не карманные деньги, а оборот. Станция начинает узнавать колонию по подписи на сделках и перестаёт спрашивать, откуда у неё столько.",
    trigger: { type: "chain", parentId: "q06-first-deal" },
    goal: {
      metric: "tokens",
      target: 300,
      label: "Кваксов в казне",
    },
    rewards: { tokens: 50, lootboxes: 1 },
    priority: 30,
  }),
  medium({
    id: "m02-celestial-capital",
    sphere: "economy",
    chainId: "supply",
    title: "Небесный капитал",
    description: "Соберите 25 астро-кваксов и откройте элитные сделки.",
    lore: "Астро-кваксы ходят только среди тех, кто был в глубине. Двадцать пять штук — пропуск в круг, где торгуют не кормом, а координатами и молчанием.",
    trigger: { type: "chain", parentId: "m01-turnover" },
    goal: {
      metric: "astroQuax",
      target: 25,
      label: "Астро-кваксов",
    },
    rewards: { lootboxes: 1, astroQuax: 10 },
    priority: 31,
  }),
  medium({
    id: "m03-warehouse-stock",
    sphere: "economy",
    chainId: "supply",
    title: "Складской запас",
    description: "Держите на складе 20 единиц корма: запас — это спокойствие.",
    lore: "Двадцать единиц корма — это не жадность, а тишина в колонии. Пока склад полон, никто не считает, кому достанется последняя порция.",
    trigger: { type: "chain", parentId: "m01-turnover" },
    goal: {
      metric: "food",
      target: 20,
      label: "Корма на складе",
    },
    rewards: { lootboxes: 2 },
    priority: 32,
  }),
  medium({
    id: "m04-biropolis",
    sphere: "colony",
    chainId: "colony",
    title: "Биополис",
    description: "Постройте три биопода: колонии нужны новые вольеры.",
    lore: "Три биопода — это уже не убежище, а район. Станция помнит, как выглядели её жилые крылья до карантина; колония строит свои — меньше, но живые.",
    trigger: { type: "chain", parentId: "q05-roof" },
    goal: {
      metric: "aviaryRooms",
      target: 3,
      label: "Построено биоподов",
    },
    rewards: { tokens: 60, lootboxes: 1 },
    priority: 33,
  }),
  medium({
    id: "m05-powered",
    sphere: "colony",
    chainId: "colony",
    title: "Под напряжением",
    description:
      "Постройте два энергосектора — ток должен быть в каждом крыле.",
    lore: "Один энергосектор будит крыло, два — держат его в сознании. Станция не любит просыпаться полностью: в её коридорах слишком много того, что лучше не будить.",
    trigger: { type: "chain", parentId: "m04-biropolis" },
    goal: {
      metric: "powerRooms",
      target: 2,
      label: "Энергосекторов",
    },
    rewards: { lootboxes: 2 },
    priority: 34,
  }),
  medium({
    id: "m06-laboratory",
    sphere: "colony",
    chainId: "colony",
    title: "Лаборатория",
    description: "Постройте Коллайдер и откройте генетические эксперименты.",
    lore: "Коллайдер на станции строили не для жаб — для чего-то, что должно было пережить экипаж. Колония использует его иначе, но иногда по ночам он гудит так же, как тогда.",
    trigger: { type: "chain", parentId: "m05-powered" },
    goal: {
      metric: "colliderRooms",
      target: 1,
      label: "Коллайдеров",
    },
    rewards: { geneDust: 10, lootboxes: 1 },
    priority: 35,
  }),
  medium({
    id: "m07-prevention",
    sphere: "medicine",
    chainId: "colony",
    title: "Профилактика",
    description: "Вылечите трёх жаб: поместите их в Медотсек",
    lore: "Три вылеченные жабы — это три раза, когда колония выбрала лечение вместо изоляции. Станция, кажется, удивлена.",
    trigger: { type: "chain", parentId: "q15-hospital" },
    goal: {
      metric: "curedToads",
      target: 3,
      label: "Вылечено жаб",
    },
    rewards: { tokens: 60, lootboxes: 1 },
    priority: 36,
  }),
  medium({
    id: "m08-bloodline",
    sphere: "selection",
    chainId: "selection",
    title: "Племенная линия",
    description: "Получите 10 головастиков: селекция становится системой.",
    lore: "Десять головастиков — это уже не случайность, а линия. Колония перестаёт ждать, кого принесёт орбита, и начинает решать сама, какими будут следующие жабы.",
    trigger: { type: "chain", parentId: "q11-offspring" },
    goal: {
      metric: "toadsWithParents",
      target: 10,
      label: "Головастиков",
    },
    rewards: { lootboxes: 2 },
    priority: 37,
  }),
  medium({
    id: "m09-genetic-diversity",
    sphere: "selection",
    chainId: "selection",
    title: "Генетическое разнообразие",
    description:
      "Соберите пять разных видов жаб — от гибридов до редких мутантов.",
    lore: " В глубоких секторах выживает не сильнейший, а тот, кто умеет адаптироваться к разным условиям. ",
    trigger: { type: "chain", parentId: "m08-bloodline" },
    goal: {
      metric: "toadSpecies",
      target: 5,
      label: "Видов жаб",
    },
    rewards: { lootboxes: 3 },
    priority: 38,
  }),
  medium({
    id: "m13a-operator",
    sphere: "selection",
    chainId: "selection",
    title: "Оператор резерва",
    description:
      "Вырастите взрослую жабу из селекции или коллайдера с качеством 10+ для экспедиционного резерва.",
    lore: "Оператор вскроет терминал, взломает дрон или обезвредит ловушку. Колония учится не терять специалистов вместе с походами.",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "reserveRoleHacker",
      target: 1,
      label: "Оператор в резерве",
    },
    rewards: { tokens: 20 },
    priority: 39,
  }),
  medium({
    id: "m13b-scout",
    sphere: "selection",
    chainId: "selection",
    title: "Скаут резерва",
    description:
      "Вырастите взрослую жабу из селекции или коллайдера со скоростью 2+ для экспедиционного резерва.",
    lore: "Скаут — тот, кто первым пойдёт изучать подозрительный сигнал. ",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "reserveRoleScout",
      target: 1,
      label: "Скаут в резерве",
    },
    rewards: { tokens: 20 },
    priority: 40,
  }),
  medium({
    id: "m13c-tank",
    sphere: "selection",
    chainId: "selection",
    title: "Щитоносец резерва",
    description:
      "Вырастите взрослую жабу из селекции или коллайдера с весом 30+ для экспедиционного резерва.",
    lore: "Щитоносец - щит команды, берет на себя основной урон, и масса тут имеет решающее значение.  ",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "reserveRoleTank",
      target: 1,
      label: "Щитоносец в резерве",
    },
    rewards: { tokens: 20, lootboxes: 1 },
    priority: 41,
  }),
  medium({
    id: "m13d-medic",
    sphere: "selection",
    chainId: "selection",
    title: "Ремонтник резерва",
    description:
      "Вырастите взрослую жабу из селекции или коллайдера с плодовитостью 2+ для экспедиционного резерва.",
    lore: "Ремонтник — тот, кто поднимет команду в трудный момент. Плодовитость здесь не про потомство, а про запас жизненных сил, который он отдаёт другим.",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "reserveRoleMedic",
      target: 1,
      label: "Ремонтник в резерве",
    },
    rewards: { tokens: 20, lootboxes: 1 },
    priority: 42,
  }),
  medium({
    id: "m13e-negotiator",
    sphere: "selection",
    chainId: "selection",
    title: "Снабженец резерва",
    description:
      "Вырастите взрослую жабу из селекции или коллайдера с аппетитом 2+ для экспедиционного резерва.",
    lore: "Снабженец найдёт еду там, где её никто больше не найдет, и договорится с тем, кто её охраняет. Аппетит здесь — мера того, сколько он готов взять на себя.",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "reserveRoleNegotiator",
      target: 1,
      label: "Снабженец в резерве",
    },
    rewards: { tokens: 20, lootboxes: 1 },
    priority: 43,
  }),
  medium({
    id: "m10-sample-archive",
    sphere: "collection",
    chainId: "selection",
    title: "Архив образцов",
    description: "Откройте пять лутбоксов и пополните архив колонии.",
    lore: "Колония собирает не вещи, а следы тех, кто был здесь до неё: бирки, записки, иногда — жаб.",
    trigger: { type: "chain", parentId: "q16-gene-dust" },
    goal: {
      metric: "lootboxOpened",
      target: 5,
      label: "Открыто лутбоксов",
    },
    rewards: { lootboxes: 2, astroQuax: 10 },
    priority: 44,
  }),
  medium({
    id: "m11-depth-three",
    sphere: "exploration",
    chainId: "perimeter",
    title: "Глубина 3",
    description: "Пройдите три сектора Периметра и закрепите маршрут.",
    lore: "Три сектора — это уже маршрут, а не вылазка. На третьей глубине станция начинает отвечать на сигналы, и КОНТУР фиксирует это впервые за долгое время.",
    trigger: { type: "chain", parentId: "q10-first-expedition" },
    goal: {
      metric: "completedSectors",
      target: 3,
      label: "Секторов пройдено",
    },
    rewards: { astroQuax: 50, lootboxes: 1 },
    priority: 45,
  }),
  medium({
    id: "m12-unknown-pass",
    sphere: "exploration",
    chainId: "perimeter",
    title: "Пропуск в неизвестность",
    description:
      "Откройте четыре сектора КОНТУРа — впереди ещё много неизведанного.",
    lore: "Каждый открытый сектор — это дверь, которую станция не открывала годами. Колония открывает четыре и понимает: за ними не пустота, а продолжение.",
    trigger: { type: "chain", parentId: "m11-depth-three" },
    goal: {
      metric: "unlockedSectors",
      target: 4,
      label: "Секторов открыто",
    },
    rewards: { lootboxes: 2 },
    priority: 46,
  }),
  medium({
    id: "m14-collider-line",
    sphere: "selection",
    chainId: "selection",
    title: "10 жаб из коллайдера",
    description:
      "Заберите из инкубатора 10 жаб, выведенных в коллайдере: эксперимент должен стать системой.",
    lore: "Десять жаб из коллайдера — это уже не эксперимент, а конвейер. Впервые за долгое время оборудование станции используют по назначению.",
    trigger: { type: "metric", metric: "colliderRooms", value: 1 },
    goal: {
      metric: "colliderToads",
      target: 10,
      label: "Жаб забрано из коллайдера",
    },
    rewards: { tokens: 80, lootboxes: 1 },
    priority: 47,
  }),
  medium({
    id: "m15-perfect-organism",
    sphere: "selection",
    chainId: "selection",
    title: "Почти идеальный организм",
    description:
      "Выведите жабу из селекции или коллайдера со скоростью 2+, весом 30+, плодовитостью 2+, аппетитом 2+ и качеством 20+.",
    lore: "Скорость, масса, плодовитость, аппетит и качество сразу — это уже не жаба, а почти идеальный организм. Колония впервые выводит особь, которая будет готова отправиться к Ядру.",
    trigger: { type: "chain", parentId: "m14-collider-line" },
    goal: {
      metric: "perfectExpeditionToads",
      target: 1,
      label: "Совершенных жаб",
    },
    rewards: { astroQuax: 40, lootboxes: 3 },
    priority: 48,
  }),
  medium({
    id: "m16-elite-broker",
    sphere: "economy",
    chainId: "supply",
    title: "Элитный брокер",
    description:
      "Выполните 3 элитных заказа в Торговой капсуле: редкие жабы должны приносить астро-кваксы.",
    lore: "Элитные заказы не висят на общем рынке: это маленький закрытый рынок. Три выполненных заказа — и колонию начнут узнавать.",
    trigger: { type: "metric", metric: "astroQuax", value: 1 },
    goal: {
      metric: "eliteOrdersCompleted",
      target: 3,
      label: "Элитных заказов сдано",
    },
    rewards: { astroQuax: 30, lootboxes: 2 },
    priority: 49,
  }),
  medium({
    id: "m17-breeding-line",
    sphere: "colony",
    chainId: "colony",
    title: "Ещё два репродуктора",
    description:
      "Постройте ещё два репродуктора: одной колбы мало, когда племенная линия растёт.",
    lore: "Одна колба — это надежда, три — это план. Колония перестаёт ждать, кого принесёт случай, и начинает вести линию сама.",
    trigger: { type: "metric", metric: "breedingRooms", value: 1 },
    goal: {
      metric: "breedingRooms",
      target: 3,
      label: "Репродукторов построено",
    },
    rewards: { tokens: 80, lootboxes: 2 },
    priority: 50,
  }),
  medium({
    id: "m18-thousand",
    sphere: "economy",
    chainId: "supply",
    title: "Жабный олигарх",
    description: "Доведите казну до 1 000 Кваксов.",
    lore: "Глубина требует денег: броня, корм, топливо и ремонт шлюзов. Тысяча Кваксов в казне — первый раз, когда колония может позволить себе настоящую экспедицию, а не прогулку.",
    trigger: { type: "chain", parentId: "m01-turnover" },
    goal: {
      metric: "tokens",
      target: 1000,
      label: "Кваксов в казне",
    },
    rewards: { tokens: 120, lootboxes: 2 },
    priority: 51,
  }),
  medium({
    id: "m19-toad-trader",
    sphere: "economy",
    chainId: "supply",
    title: "Коллекционер",
    description: "Купите 12 жаб в Торговой капсуле.",
    lore: "Двенадцать покупок — это уже не случайные сделки, а поток. Барон Квак-Ротшильд заметил оборот и сам предложил колонии свои связи: с таким снабженцем глубокие секторы перестанут быть безнадёжной тратой.",
    trigger: { type: "chain", parentId: "m01-turnover" },
    goal: {
      metric: "boughtToads",
      target: 12,
      label: "Куплено жаб",
    },
    rewards: { toads: [CREW_BARON], lootboxes: 2 },
    priority: 52,
  }),
  medium({
    id: "m25-biomass-100",
    sphere: "colony",
    chainId: "colony",
    title: "Биофабрика",
    description: "Накопите 100 биомассы на ферме.",
    lore: "Биокупол работает на биомассе, а глубокие секторы — на биокультуре. Сто единиц запаса превращают ферму в настоящую базу снабжения; Биокуратор Квак лично проследит, чтобы команда не ушла в рейд голодной.",
    trigger: { type: "chain", parentId: "m06-laboratory" },
    goal: {
      metric: "biomass",
      target: 100,
      label: "Биомассы на ферме",
    },
    rewards: { toads: [CREW_CURATOR], lootboxes: 1 },
    priority: 53,
  }),
  medium({
    id: "m26-dissolve-10",
    sphere: "colony",
    chainId: "colony",
    title: "Биоконвейер",
    description: "Переработайте 10 жаб в биомассу.",
    lore: "Каждая переработанная жаба — это топливо и питательная среда для следующей попытки. Десять циклов диссоциатора доказывают: колония умеет превращать потери в ресурсы.",
    trigger: { type: "chain", parentId: "q20-first-dissolve" },
    goal: {
      metric: "dissolvedToads",
      target: 10,
      label: "Разобрано жаб",
    },
    rewards: { tokens: 60, lootboxes: 2 },
    priority: 54,
  }),
  medium({
    id: "m20-legendary-25",
    sphere: "selection",
    chainId: "genetics",
    title: "Легенда галактики",
    description: "Выведите жабу с качеством 25+.",
    lore: "Качество 25+ — не просто красивая цифра: такая жаба держит ДНК под контролем даже в зоне радиации. Рекомбинант Идеальный готов стать научным ядром команды, если вы докажете чистоту линии.",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "legendaryToads",
      target: 1,
      label: "Жаб с качеством 25+",
    },
    rewards: { toads: [CREW_RECOMBINANT], astroQuax: 20 },
    priority: 55,
  }),
  medium({
    id: "m21-slow-gourmet",
    sphere: "selection",
    chainId: "genetics",
    title: "Медлительный гурман",
    description: "Выведите жабу со скоростью 0.2 и меньше.",
    lore: "В глубоких секторах спешка убивает. Медлительная особь с экономным метаболизмом — идеальный часовой для узких шлюзов, где важнее выдержка, чем скорость.",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "slowToads",
      target: 1,
      label: "Жаб со скоростью ≤ 0.2",
    },
    rewards: { tokens: 40, lootboxes: 1 },
    priority: 56,
  }),
  medium({
    id: "m22-mini-quack",
    sphere: "selection",
    chainId: "genetics",
    title: "Мини-квак",
    description: "Выведите жабу весом 8 и меньше.",
    lore: "Тяжёлую жабу не протолкнуть в вентиляцию, а лёгкая пройдёт везде. ",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "tinyToads",
      target: 1,
      label: "Жаб весом ≤ 8",
    },
    rewards: { lootboxes: 2, geneDust: 10 },
    priority: 57,
  }),
  medium({
    id: "m23-chaos-dna",
    sphere: "selection",
    chainId: "genetics",
    title: "Хаос в ДНК",
    description: "Выведите жабу с поломкой ДНК 80+.",
    lore: "Поломки ДНК 80+ обычно означают приговор. Но важно научиться жить с хаосом внутри и даже находить в нём пользу: в зонах, где нормальные жабы гибнут, ненормльная может выжить.",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "mutantToads",
      target: 1,
      label: "Жаб с поломкой ДНК 80+",
    },
    rewards: { toads: [CREW_SYMBIONT], geneDust: 10 },
    priority: 58,
  }),
  medium({
    id: "m24-perfect-genome",
    sphere: "selection",
    chainId: "genetics",
    title: "Совершенный геном",
    description: "Выведите жабу десятого поколения с поломкой ДНК не выше 0.9.",
    lore: "Десятое поколение с почти нулевыми поломками — это уже не случайность, а выведенная чистая линия. Такие жабы понадобятся для самых опасных экспедиций. ",
    trigger: { type: "chain", parentId: "m20-legendary-25" },
    goal: {
      metric: "perfectGenomeToads",
      target: 1,
      label: "Жаб с чистой ДНК 10-го поколения",
    },
    rewards: {
      toads: [CREW_NEON],
      astroQuax: 60,
      lootboxes: 3,
    },
    priority: 59,
  }),
  medium({
    id: "m27-lootbox-100",
    sphere: "collection",
    chainId: "selection",
    title: "Искатель сокровищ",
    description: "Откройте 100 лутбоксов.",
    lore: "Сто вскрытых контейнеров — это уже статистика, а не удача. Брилиантовый везунчик согласится идти в команду только к тому, кто доказал: он умеет находить ценное даже в мусоре орбитальной станции.",
    trigger: { type: "chain", parentId: "m10-sample-archive" },
    goal: {
      metric: "lootboxOpened",
      target: 100,
      label: "Открыто лутбоксов",
    },
    rewards: { toads: [CREW_LUCKY], lootboxes: 10 },
    priority: 60,
  }),
  medium({
    id: "m28-expedition-10",
    sphere: "exploration",
    chainId: "perimeter",
    title: "Полевой отряд",
    description: "Завершите 10 походов в КОНТУРе.",
    trigger: { type: "chain", parentId: "q10-first-expedition" },
    goal: {
      metric: "completedExpeditions",
      target: 10,
      label: "Завершено походов",
    },
    rewards: { toads: [CREW_GUIDE], lootboxes: 2 },
    priority: 61,
  }),
];

const longQuests: QuestDef[] = [
  long({
    id: "l01-first-contour",
    sphere: "exploration",
    title: "Первый контур",
    description:
      "Соберите команду в КОНТУРе и пройдите «Ржавый шлюз» — первый уровень Периметра.",
    lore: "«Ржавый шлюз» — не название, а диагноз: первый сектор Периметра держится на честном слове и старой смазке. Его запечатывали в спешке, но уже не узнать почему.",
    trigger: { type: "always" },
    goal: {
      metric: "completedSectors",
      target: 1,
      label: "Секторов пройдено",
    },
    rewards: { tokens: 100, lootboxes: 1 },
    priority: 1,
    starter: true,
  }),
  long({
    id: "l02-perimeter-3",
    sphere: "exploration",
    title: "Станция «Периметр-3»",
    description:
      "Дойдите до третьей глубины: снимите данные с заброшенной станции наблюдения.",
    lore: "Станция наблюдения на третьей глубине всё ещё передаёт данные — в пустоту, по расписанию, которое никто не отменял. ",
    trigger: { type: "chain", parentId: "l01-first-contour" },
    goal: {
      metric: "completedSectors",
      target: 3,
      label: "Секторов пройдено",
    },
    rewards: { tokens: 150, lootboxes: 2 },
    priority: 2,
  }),
  long({
    id: "l03-depth-six",
    sphere: "exploration",
    title: "Глубина шесть",
    description:
      "Пройдите шесть секторов: жар крематория и рой дронов не должны остановить экспедицию.",
    lore: "Крематорий на шестой глубине всё ещё тёплый — станция сжигала что-то до самого карантина и, кажется, не до конца остановилась. Дроны-патрульные здесь агрессивнее: они охраняют не только вход, а выход.",
    trigger: { type: "chain", parentId: "l02-perimeter-3" },
    goal: {
      metric: "completedSectors",
      target: 6,
      label: "Секторов пройдено",
    },
    rewards: { astroQuax: 200, lootboxes: 3 },
    priority: 3,
  }),
  long({
    id: "l04-last-sector",
    sphere: "exploration",
    title: "Центр станции",
    description:
      "Пройдите последний сектор КОНТУРа. Сигнал из глубины ждал слишком долго.",
    trigger: { type: "chain", parentId: "l03-depth-six" },
    goal: {
      metric: "lastSectorCompleted",
      target: 1,
      progressMetric: "completedSectors",
      progressTarget: SECTORS.length,
      label: "Секторов пройдено",
    },
    rewards: { geneDust: 50, lootboxes: 10 },
    priority: 4,
  }),
  long({
    id: "l05-perimeter-master",
    sphere: "exploration",
    title: "Хозяин Периметра",
    description: "Завершите 50 походов в КОНТУРе.",
    lore: "Пятьдесят походов — это не подвиг, а привычка. Когда команда знает каждый шлюз и каждую тень на станции, Периметр перестаёт быть границей и становится домом.",
    trigger: { type: "chain", parentId: "m28-expedition-10" },
    goal: {
      metric: "completedExpeditions",
      target: 50,
      label: "Завершено походов",
    },
    rewards: { astroQuax: 250, lootboxes: 8, geneDust: 50 },
    priority: 5,
  }),
];

export const QUESTS: QuestDef[] = [
  ...quickQuests,
  ...mediumQuests,
  ...longQuests,
];

export const QUEST_BY_ID = new Map(QUESTS.map((quest) => [quest.id, quest]));

export const getQuestById = (id: string): QuestDef | undefined =>
  QUEST_BY_ID.get(id);

export const getQuestCounts = () => ({
  quick: QUESTS.filter((quest) => quest.type === "quick").length,
  medium: QUESTS.filter((quest) => quest.type === "medium").length,
  long: QUESTS.filter((quest) => quest.type === "long").length,
});
