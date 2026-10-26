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
 *  - `medium` — средние задания, собранные в четыре цепочки;
 *  - `long`   — магистраль: четыре длинных задания, которые всегда видны
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
  | "diseaseOutbreaks";

/** События, которые игровой код сообщает журналу явно. */
export type QuestEvent =
  | "toad_fed"
  | "food_bought"
  | "lootbox_opened"
  | "toad_cured"
  | "disease_outbreak";

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
}

export interface QuestDef {
  id: string;
  type: QuestType;
  sphere: QuestSphere;
  title: string;
  description: string;
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
 * Четыре средние цепочки. Внутри большинства цепочек задания открываются по
 * очереди, а между цепочками игрок может переключаться — журнал держит
 * несколько активных средних задач из разных сфер. `m07` и `m10` — боковые
 * ответвления от `q15` и `q16`: медицинская и коллекционная линии не должны
 * ждать последнего шага основной секции.
 */
export const QUEST_CHAINS: QuestChain[] = [
  {
    id: "supply",
    title: "Экономика и снабжение",
    description: "Оборот Кваксов, запас корма и космический капитал.",
    sphere: "economy",
    taskIds: ["m01-turnover", "m02-celestial-capital", "m03-warehouse-stock"],
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
      "m13-expedition-reserve",
      "m10-sample-archive",
    ],
  },
  {
    id: "perimeter",
    title: "Периметр",
    description: "Глубина КОНТУРа и пропуска в неизвестность.",
    sphere: "exploration",
    taskIds: ["m11-depth-three", "m12-unknown-pass"],
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

const quickQuests: QuestDef[] = [
  quick({
    id: "q01-first-sector",
    sphere: "colony",
    title: "Первый сектор",
    description:
      "Постройте Торговую капсулу — она бесплатна и открывает рынок.",
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
    description: "Покормите трёх жаб: сытые жабы быстрее растут и работают.",
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
    trigger: { type: "chain", parentId: "q07-open-lootbox" },
    goal: {
      metric: "geneDust",
      target: 5,
      label: "Генной пыли",
    },
    rewards: { astroQuax: 10 },
    priority: 23,
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
    description: "Получите  10 головастиков: селекция становится системой.",
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
    id: "m13-expedition-reserve",
    sphere: "selection",
    chainId: "selection",
    title: "Экспедиционный резерв",
    description:
      "Закройте пять экспедиционных ролей взрослыми жабами из селекции или коллайдера: оператор с силами 150+ и качеством 10+, скаут со скоростью 1.2+, щитоносец с размером 18+, ремонтник с плодовитостью 1.2+ и Снабженец с аппетитом 1.2+. Одна жаба может закрыть несколько ролей сразу.",
    trigger: { type: "chain", parentId: "m09-genetic-diversity" },
    goal: {
      metric: "expeditionReserveRoles",
      target: 5,
      label: "Ролей для походов",
    },
    rewards: { tokens: 100, lootboxes: 3 },
    priority: 39,
  }),
  medium({
    id: "m10-sample-archive",
    sphere: "collection",
    chainId: "selection",
    title: "Архив образцов",
    description: "Откройте пять лутбоксов и пополните архив колонии.",
    trigger: { type: "chain", parentId: "q16-gene-dust" },
    goal: {
      metric: "lootboxOpened",
      target: 5,
      label: "Открыто лутбоксов",
    },
    rewards: { lootboxes: 2, astroQuax: 10 },
    priority: 40,
  }),
  medium({
    id: "m11-depth-three",
    sphere: "exploration",
    chainId: "perimeter",
    title: "Глубина 3",
    description: "Пройдите три сектора Периметра и закрепите маршрут.",
    trigger: { type: "chain", parentId: "q10-first-expedition" },
    goal: {
      metric: "completedSectors",
      target: 3,
      label: "Секторов пройдено",
    },
    rewards: { astroQuax: 50, lootboxes: 1 },
    priority: 41,
  }),
  medium({
    id: "m12-unknown-pass",
    sphere: "exploration",
    chainId: "perimeter",
    title: "Пропуск в неизвестность",
    description:
      "Откройте четыре сектора КОНТУРа — впереди ещё много неизведанного.",
    trigger: { type: "chain", parentId: "m11-depth-three" },
    goal: {
      metric: "unlockedSectors",
      target: 4,
      label: "Секторов открыто",
    },
    rewards: { lootboxes: 2 },
    priority: 42,
  }),
];

const longQuests: QuestDef[] = [
  long({
    id: "l01-first-contour",
    sphere: "exploration",
    title: "Первый контур",
    description:
      "Соберите команду в КОНТУРе и пройдите «Ржавый шлюз» — первый уровень Периметра.",
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
