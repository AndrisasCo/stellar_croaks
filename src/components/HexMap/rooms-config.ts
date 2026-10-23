import { ColonyRoomKind, ColonyRoomState } from "../../models/colony";
import { Expedition } from "../../models/expedition";
import { INITIAL_CAPACITY } from "../../models/scene";
import { Toad } from "../../models/Toad";
import { isToadBusyOnExpedition } from "../../utils/expedition-status";
import {
  AVIARY_ROOM_ID,
  CORE_ROOM_ID,
  NEST_ROOM_ID,
} from "../../utils/constants";
import {
  AxialCoord,
  hexCoordKey,
  hexDistance,
  hexNeighbors,
  hexRing,
} from "./hex-geometry";

/**
 * Конфиг гексагональной карты колонии.
 *
 * Сектора обозначены только цветом: иконок, подписей и кнопок внутри гексов нет — спрайты
 * добавим позже. Тап по гексу открывает существующую React-модалку сектора, а какую именно —
 * решает первое действие сектора (`RoomActionId`, разводка — в `open-room-modal.tsx`).
 *
 * Каталог построек `ROOM_BLUEPRINTS` — единственный источник правды о секторах: из него
 * собираются и карточки меню застройки (`colony-build.ts`), и сами гексы (`createColonyRoom`).
 */

/** Тип гекса карты: пустой слот, ядро или сектор из каталога застройки. */
export type RoomKind = "core" | "empty" | ColonyRoomKind;

/** Что открывает действие сектора: каждому id соответствует модалка на экране карты. */
export type RoomActionId =
  | "colony" // ядро → управление колонией: сводка, кормление, жабы и секторы
  | "toad-list" // биопод → список жаб
  | "scene-info" // биопод → статистика биопода
  | "feed" // биопод → покормить всех (без модалки)
  | "nest" // репродуктор → размножение
  | "collider" // коллайдер → смешивание генов и колбы инкубатора
  | "dissociator" // диссоциатор → расщепление жаб на биомассу
  | "shop" // Торговая капсула → торговля
  | "storage" // склад → ресурсы и коробки
  | "scout" // разведка → команды жаб в походы
  | "hospital" // Медотсек → лечение жаб
  | "power-room"; // энергосектор ⚡ → жабы-энергетики

export interface RoomAction {
  id: RoomActionId;
  /** Эмодзи-иконка действия: карта её не рисует (гексы — только цвет), задел под будущий UI. */
  icon: string;
  /** Подпись для тултипа/уведомлений. */
  title: string;
}

export interface RoomPalette {
  /** Основная заливка гекса. */
  face: number;
  /** Внутренняя (светлая) заливка — даёт объём без спрайтов. */
  inner: number;
  /** Нижняя «грань». */
  edgeShadow: number;
  /** Обводка. */
  edge: number;
  /** Подсветка при наведении. */
  glow: number;
  /** Цвет подписей секторов (у белого ядра текст тёмный). */
  text: number;
}

export interface RoomConfig {
  /**
   * id, которым карта и модалки адресуют сектор. У построек и пустых слотов это id гекса
   * (`slot-*`, `outpost-*`); у базовых секторов — их постоянный id (`CORE_ROOM_ID`,
   * `NEST_ROOM_ID`, `AVIARY_ROOM_ID`), чтобы жабы в репродукторе и `HEX_ROOM_BY_ID`
   * находили гекс после каждой перезагрузки. Канонический id постройки в сейве —
   * `ColonyRoomState.id` (`вид_число`).
   */
  id: string;
  /**
   * id гекса карты. Не меняется при сносе и повторной застройке: по нему карта находит
   * место постройки, а `ColonyRoomState.slotId` помнит, что здесь стоит.
   */
  slotId: string;
  kind: RoomKind;
  title: string;
  /**
   * Полное имя сектора с номером экземпляра: «Репродуктор #2». Его показывают модалки и
   * уведомления, когда речь о конкретном гексе. У вида, который строится много раз, номер
   * обязателен, а у единственного сектора (коллайдер, Торговая Капсула, диссоциатор) и ядра его нет:
   * «Коллайдер», «Ядро». Номера расставляет карта — см. `room-names.ts`, `title` остаётся
   * названием вида.
   */
  name: string;
  subtitle: string;
  /** Эмодзи-иконка сектора. */
  icon: string;
  coord: AxialCoord;
  palette: RoomPalette;
  /** Действия сектора: их наличие отличает построенный сектор от пустого слота (см. isRoomOpen). */
  actions: RoomAction[];
  /** Биопод гекса-биопода (`Scene.id`); null у остальных секторов и пустых слотов. */
  sceneId: number | null;
}

const PALETTES: Record<RoomKind, RoomPalette> = {
  core: {
    face: 0xe8f2ff,
    inner: 0xffffff,
    edgeShadow: 0x94a9c4,
    edge: 0x38bdf8,
    glow: 0xffffff,
    text: 0x0f172a,
  },
  aviary: {
    face: 0x166e4c,
    inner: 0x1f9a68,
    edgeShadow: 0x0b3d2a,
    edge: 0x6ee7b7,
    glow: 0xa7f3d0,
    text: 0xffffff,
  },
  breeding: {
    face: 0x5b21b6,
    inner: 0x7c3aed,
    edgeShadow: 0x2e1065,
    edge: 0xc4b5fd,
    glow: 0xddd6fe,
    text: 0xffffff,
  },
  collider: {
    face: 0x4a044e,
    inner: 0xc026d3,
    edgeShadow: 0x2a0230,
    edge: 0xf0abfc,
    glow: 0xfae8ff,
    text: 0xffffff,
  },
  scout: {
    face: 0x1e3a8a,
    inner: 0x3b82f6,
    edgeShadow: 0x172554,
    edge: 0xbfdbfe,
    glow: 0xdbeafe,
    text: 0xffffff,
  },
  storage: {
    face: 0x334155,
    inner: 0x475569,
    edgeShadow: 0x1e293b,
    edge: 0xcbd5e1,
    glow: 0xe2e8f0,
    text: 0xffffff,
  },
  shop: {
    face: 0x42300a,
    inner: 0xeab308,
    edgeShadow: 0x2a1e05,
    edge: 0xfef08a,
    glow: 0xfef9c3,
    text: 0xffffff,
  },
  hospital: {
    face: 0x7f1d1d,
    inner: 0xef4444,
    edgeShadow: 0x450a0a,
    edge: 0xfecaca,
    glow: 0xfee2e2,
    text: 0xffffff,
  },
  dissociator: {
    face: 0x2e3b06,
    inner: 0xa3e635,
    edgeShadow: 0x1a2203,
    edge: 0xecfccb,
    glow: 0xf7fee7,
    text: 0xffffff,
  },
  power: {
    face: 0x4a2f05,
    inner: 0xb45309,
    edgeShadow: 0x2a1a02,
    edge: 0xfbbf24,
    glow: 0xfde68a,
    text: 0xfff7ed,
  },
  empty: {
    face: 0x1b2433,
    inner: 0x223046,
    edgeShadow: 0x0c1119,
    edge: 0x46586f,
    glow: 0x93b4d8,
    text: 0x9fb4cd,
  },
};

/**
 * Черновик сектора: из него собираются и гекс на карте, и карточка в меню застройки.
 *
 * Цены — по ВРЕМЕНИ игры, а не «на глаз»: ранняя колония из 3-4 жаб даёт ~110 Кваксов
 * в сутки, а на старте у игрока 100 Кваксов, из которых 60 уходят на первый корм.
 * Поэтому первые гексы обучения — Репродуктор (первый бесплатно, `firstFree`) и
 * «Разведка» (25) — игрок ставит сразу, не дожидаясь фермы; дальше цена
 * растёт вместе с доходом: полдня фермы (Медотсек), сутки (биопод, репродуктор,
 * энергосектор, Торговая Капсула), несколько суток (лаборатория и коллайдер с инкубатором).
 * Правятся цены здесь — отсюда их берут и карточки застройки, и сама постройка.
 */
export interface RoomBlueprint {
  kind: ColonyRoomKind;
  title: string;
  subtitle: string;
  icon: string;
  /** Описание для меню застройки. */
  description: string;
  palette: RoomPalette;
  /** Сектор строится в колонии только в одном экземпляре (коллайдер, Торговая Капсула, диссоциатор). */
  unique: boolean;
  /** Цена первой такого сектора в Кваксах 🔷. */
  baseCost: number;
  /**
   * Во сколько раз дорожает каждая следующая такой сектор.
   * Все повторяемые секторы растут одинаково (×1.5), чтобы поздняя колония не упиралась
   * в экспоненциальную стену: раньше разброс 1.6–2.0 делал пятый биопод дороже первых четырёх.
   */
  costGrowth: number;
  /**
   * Первый ПОСТРОЕННЫЙ сектор этого вида бесплатный (обучающий жест).
   *
   * Базовые секторы (ядро, биопод, репродуктор) стоят с начала игры и в счёте построенных
   * не участвуют, поэтому скидка достаётся первой постройке игрока. Бесплатный сектор
   * не сдвигает цену следующих: второй стоит как обычный первый.
   */
  firstFree?: boolean;
  /** Действия сектора: первое — то, что открывает тап по гексу. */
  actions: RoomAction[];
}

export const ROOM_BLUEPRINTS: Record<ColonyRoomKind, RoomBlueprint> = {
  power: {
    kind: "power",
    title: "Энергосектор",
    subtitle: "Ток для соседей",
    icon: "⚡",
    description:
      "Каждый организм питает один из шести энергоконутов, позволяя эффективно записать целый сектор. ",
    palette: PALETTES.power,
    unique: false,
    baseCost: 160,
    costGrowth: 1.5,
    actions: [{ id: "power-room", icon: "⚡", title: "Энергосектор" }],
  },
  aviary: {
    kind: "aviary",
    title: "Биопод",
    subtitle: "Вольер для жаб",
    icon: "🐸",
    description: `Биопод является основным местом содержания организмов, обеспечивает стабильные условия для выработки ценной биомассы`,
    palette: PALETTES.aviary,
    unique: false,
    baseCost: 120,
    costGrowth: 1.5,
    actions: [
      { id: "toad-list", icon: "📋", title: "Список жаб биопода" },
      { id: "scene-info", icon: "ⓘ", title: "О биоподе" },
      { id: "feed", icon: "🍎", title: "Покормить всех" },
    ],
  },
  breeding: {
    kind: "breeding",
    title: "Репродуктор",
    subtitle: "Размножение",
    icon: "🥚",
    description:
      "Репродукция новых организмов проводится здесь с максимальным контролем",
    palette: PALETTES.breeding,
    unique: false,
    baseCost: 150,
    costGrowth: 1.5,
    firstFree: true,
    actions: [{ id: "nest", icon: "🥚", title: "Репродуктор" }],
  },
  collider: {
    kind: "collider",
    title: "Коллайдер",
    subtitle: "Смешивание генов",
    icon: "🧬",
    description:
      "Смешивает гены организмов: гибрид как правило получается лучше чем родители, но могут быть и неудачи. Чем больше использовано генов, тем выше будет качество результата. ",
    palette: PALETTES.collider,
    unique: true,
    baseCost: 600,
    costGrowth: 1,
    actions: [{ id: "collider", icon: "🧬", title: "Коллайдер" }],
  },
  scout: {
    kind: "scout",
    title: "КОНТУР",
    subtitle: "КОНтроль Территории УРовня",
    icon: "🧭",
    description:
      "КОНтроль Территории УРовня. Диспетчерская колонии: команды уходят в походы по секторам Периметра в поисках добычи и ответов на вопросы.",
    palette: PALETTES.scout,
    unique: false,
    baseCost: 25,
    costGrowth: 2,
    actions: [{ id: "scout", icon: "🧭", title: "КОНТУР" }],
  },
  storage: {
    kind: "storage",
    title: "Склад",
    subtitle: "+300 к вместимости под током",
    icon: "📦",
    description:
      "Каждый склад под током добавляет 300 единиц к хранению. Обесточенный склад полок не даёт: подведите к нему ток от ядра или энергосектора ⚡.",
    palette: PALETTES.storage,
    unique: false,
    baseCost: 25,
    costGrowth: 1.5,
    actions: [{ id: "storage", icon: "📦", title: "Склад" }],
  },
  shop: {
    kind: "shop",
    title: "Торговая капсула",
    subtitle: "Торговля",
    icon: "🛒",
    description:
      "Торговая капсула осуществляет связь с внешним миром, редкие гены и биомасса ценяется на космическом рынке. ",
    palette: PALETTES.shop,
    unique: true,
    baseCost: 0,
    costGrowth: 1,
    actions: [{ id: "shop", icon: "🛒", title: "Торговая капсула" }],
  },
  hospital: {
    kind: "hospital",
    title: "Медотсек",
    subtitle: "6 коек, быстрое лечение",
    icon: "🩹",
    description:
      "Место для шести организмов: здесь здоровье восстанавливается намного эффективнее, а инфекции эффективно сдерживаются от распостранения.",
    palette: PALETTES.hospital,
    unique: false,
    baseCost: 95,
    costGrowth: 1.5,
    actions: [{ id: "hospital", icon: "🩹", title: "Медотсек" }],
  },
  dissociator: {
    kind: "dissociator",
    title: "Диссоциатор",
    subtitle: "Расщепление генов",
    icon: "🧪",
    description: "Здесь производится расщепление организмов на биомассу",
    palette: PALETTES.dissociator,
    unique: true,
    baseCost: 400,
    costGrowth: 1,
    actions: [{ id: "dissociator", icon: "🧪", title: "Диссоциатор" }],
  },
};

/**
 * Порядок секторов в меню застройки: сначала Торговая капсула из задания «Первый сектор»,
 * дальше жильё и энергия, потом лаборатория и торговля. Список и есть порядок карточек —
 * каталог `ROOM_BLUEPRINTS` остаётся без порядка.
 */
export const ROOM_BLUEPRINT_ORDER: ColonyRoomKind[] = [
  "shop",
  "aviary",
  "power",
  "scout",
  "storage",
  "breeding",
  "hospital",
  "collider",
  "dissociator",
];

/**
 * Собирает сектор карты из черновика: гекс остаётся на своём месте, меняются вид, цвет,
 * подписи и действия. Из этой же функции получаются базовые секторы колонии.
 *
 * `sceneId` передаёт только гекс-биопод: он показывает жильцов своего биопода.
 */
export const createColonyRoom = (
  slot: RoomConfig,
  kind: ColonyRoomKind,
  sceneId?: number,
): RoomConfig => {
  const blueprint = ROOM_BLUEPRINTS[kind];

  return {
    ...slot,
    kind,
    title: blueprint.title,
    name: blueprint.title,
    subtitle: blueprint.subtitle,
    icon: blueprint.icon,
    palette: blueprint.palette,
    actions: blueprint.actions,
    ...(sceneId !== undefined ? { sceneId } : {}),
  };
};

/** Центр колонии в axial-координатах: точка отсчёта колец (ядро, расстояние, соседи «наружу»). */
const ORIGIN: AxialCoord = { q: 0, r: 0 };

/**
 * Центр колонии — белое ядро: у него нет черновика, второго ядра не построить.
 * Тап по ядру открывает улучшение секторов: апгрейдов в игре пока один — автокормушка,
 * а ставится он жилом секторе, поэтому модалка сначала спрашивает, какой именно гекс улучшаем.
 */
const CORE_ROOM: RoomConfig = {
  id: CORE_ROOM_ID,
  slotId: "core",
  kind: "core",
  title: "Ядро",
  // Ядро одно с начала игры — номер в имени ему не нужен (второго ядра не построить)
  name: "Ядро",
  subtitle: "Центр колонии",
  icon: "🏛",
  coord: ORIGIN,
  palette: PALETTES.core,
  actions: [{ id: "colony", icon: "", title: "Управление колонией" }],
  sceneId: null,
};

/** Гекс под застройку: цвет «пустой», действий нет — игрок решает, что здесь построить. */
const emptySlot = (id: string, coord: AxialCoord): RoomConfig => ({
  id,
  // У свободного гекса id сектора и id гекса совпадают: сектора ещё нет
  slotId: id,
  kind: "empty",
  title: "",
  // Пустой слот ничего не построил — имени у него нет (подпись рисовать нечего)
  name: "",
  subtitle: "",
  icon: "+",
  coord,
  palette: PALETTES.empty,
  actions: [],
  sceneId: null,
});

/**
 * Свободный слот на месте снесённого сектора: тот же гекс, но сектора на нём больше нет.
 * Из этого получается и базовый биопод, который игрок снёс: в каталоге он записан сектором
 * (`BASE_ROOMS`), а на карте обязан показываться слотом — иначе снос базового сектора
 * выглядел бы как «ничего не произошло».
 */
const toEmptySlot = (room: RoomConfig): RoomConfig =>
  emptySlot(room.slotId, room.coord);

/** Базовые секторы колонии (ядро рисуется отдельно): биопод и репродуктор стоят с начала игры. */
const baseRoom = (
  slotId: string,
  kind: ColonyRoomKind,
  coord: AxialCoord,
  id: string,
): RoomConfig => ({
  ...createColonyRoom(emptySlot(slotId, coord), kind),
  id,
});

/**
 * Свободные слоты первого кольца: два оставшихся гекса кольца заняты биоподом и репродуктором.
 * id слотов менять нельзя — по ним сейвы помнят уже построенные секторы.
 */
const RING_ONE_SLOTS: RoomConfig[] = [
  emptySlot("slot-north", { q: 0, r: -1 }),
  emptySlot("slot-south", { q: 0, r: 1 }),
  emptySlot("slot-south-west", { q: -1, r: 1 }),
  emptySlot("slot-north-east", { q: 1, r: -1 }),
];

/**
 * Свободные слоты второго кольца: последнее кольцо со «старыми» id — «outpost-N» с прошлых
 * версий. Сейвы помнят id построек, поэтому переименование этих слотов их бы потеряло;
 * с третьего кольца id несёт номер кольца (см. `ringSlots`).
 */
const RING_TWO_SLOTS: RoomConfig[] = hexRing(2).map((coord, index) =>
  emptySlot(`outpost-${index}`, coord),
);

/**
 * Дальнее кольцо стартовой карты и базовой части каталога: слоты вокруг ядра, биопода и
 * репродуктора лежат на кольцах 1–2 (см. `getUnlockedRooms`). Со третьего кольца id слотов несут
 * номер кольца (`outpost-3-N`), а второе кольцо помнит «старые» id `outpost-N` — по ним
 * сейвы узнают уже построенные секторы (см. `getColonyRooms`).
 */
export const BASE_COLONY_RADIUS = 2;

/**
 * Предел роста колонии: дальше гексов нет (внешнее кольцо — шестое, 36 слотов, вся карта —
 * 127 гексов), поэтому у постройки на предельном кольце новых соседей не открывается.
 * Слотов заведомо больше, чем игрок успеет застроить, а карта остаётся лёгкой для рендера.
 */
export const MAX_COLONY_RADIUS = 20;

/**
 * Сектора, которые стоят на карте с начала игры: ядро, биопод и репродуктор.
 *
 * Слотов в базовой карте нет намеренно: **слот под застройку обязан касаться построенной
 * сектора**, а слоты открывает фронт застройки — и он расходится от базовых секторов так же,
 * как от построек игрока (см. `getUnlockedRooms`). Поэтому стартовая карта — ядро, биопод,
 * репродуктор и гексы вокруг них: дальние слоты кольца 2, у которых рядом нет ни одного сектора,
 * в колонию не входят и откроются, когда игрок подведёт к ним постройку. Раньше базовые
 * кольца 1–2 открывались целиком «по радиусу», и такие слоты висели на карте без единой
 * сектора рядом — гекс под застройку, ни с чем не соединённый.
 */
const BASE_ROOMS: RoomConfig[] = [
  CORE_ROOM,
  baseRoom("aviary", "aviary", { q: -1, r: 0 }, AVIARY_ROOM_ID),
  // id репродуктора — общая константа: в него уходит пара на ухаживание (utils/constants.ts)
  baseRoom("breeding", "breeding", { q: 1, r: 0 }, NEST_ROOM_ID),
];

/**
 * Базовые секторы, которые можно снести: всё, кроме ядра. Их нет в `ColonyState.rooms`
 * (они стоят с начала игры), поэтому о сносе помнит `ColonyState.demolished` — по его id
 * гекс показывается свободным слотом (`getUnlockedRooms`).
 */
const DEMOLISHABLE_BASE_IDS = new Set(
  BASE_ROOMS.filter((room) => room.kind !== "core").flatMap((room) => [
    room.id,
    room.slotId,
  ]),
);

/**
 * Свободные слоты кольца: с третьего кольца id несёт его номер, чтобы слоты разных колец
 * не путались (`outpost-3-0`). Сейвы помнят id построек, поэтому старое имя слотов второго
 * кольца (`outpost-N`) остаётся как есть.
 */
const ringSlots = (ring: number): RoomConfig[] =>
  hexRing(ring).map((coord, index) =>
    emptySlot(`outpost-${ring}-${index}`, coord),
  );

/**
 * Базовая часть каталога: сектора стартовой карты и слоты колец 1–2 — в том числе закрытые
 * на старте (по их id сейвы помнят уже построенные секторы). Кольца 3+ дописывает
 * `getColonyRooms`.
 */
const BASE_CATALOG: RoomConfig[] = [
  ...BASE_ROOMS,
  ...RING_ONE_SLOTS,
  ...RING_TWO_SLOTS,
];

/**
 * Каталог гексов карты до кольца `radius` включительно: базовые секторы и слоты колец.
 * Живую карту собирает `getUnlockedRooms`, а каталог нужен как справочник id и координат:
 * карта растёт фронтом от построек, поэтому «радиус до кольца» её форму больше не описывает.
 */
export const getColonyRooms = (
  radius: number = MAX_COLONY_RADIUS,
): RoomConfig[] => {
  const rooms = [...BASE_CATALOG];
  const outer = Math.min(radius, MAX_COLONY_RADIUS);

  for (let ring = BASE_COLONY_RADIUS + 1; ring <= outer; ring += 1) {
    rooms.push(...ringSlots(ring));
  }

  return rooms;
};

/**
 * Все возможные гексы карты: по ним ищутся сектора сейва (`HEX_ROOM_BY_ID`) — слот кольца,
 * до которого колония ещё не доросла, тоже должен находиться.
 */
export const ALL_HEX_ROOMS: RoomConfig[] = getColonyRooms();

export const HEX_ROOM_BY_ID: Record<string, RoomConfig> = ALL_HEX_ROOMS.reduce<
  Record<string, RoomConfig>
>((acc, room) => {
  acc[room.id] = room;
  // Старые сейвы помнят постройку по id гекса (`aviary`, `slot-north`): по этому же
  // ключу карта находит гекс, пока `ColonyRoomState.slotId` не переехал в новый формат.
  acc[room.slotId] = acc[room.slotId] ?? room;
  return acc;
}, {});

/** Гекс каталога по координате: по нему фронт застройки находит слоты соседних колец. */
export const HEX_ROOM_BY_COORD: Record<string, RoomConfig> =
  ALL_HEX_ROOMS.reduce<Record<string, RoomConfig>>((acc, room) => {
    acc[hexCoordKey(room.coord)] = room;
    return acc;
  }, {});

/** Черновик сектора: цена, «единственная в колонии», описание (см. colony-build). */
export const getRoomBlueprint = (kind: ColonyRoomKind): RoomBlueprint =>
  ROOM_BLUEPRINTS[kind];

/** Открыта ли сектор (у пустых слотов действий нет). */
export const isRoomOpen = (room: RoomConfig) => room.actions.length > 0;

/** Сектор построен, а не пустой слот под застройку. */
export const isBuiltRoom = (room: RoomConfig) => room.kind !== "empty";

/**
 * Вид построенного сектора — `null` у пустого слота и ядра.
 *
 * У гекса вид шире типа построек (`RoomKind` включает «ядро» и «пустой слот»), а каталог
 * `ROOM_BLUEPRINTS` знает только `ColonyRoomKind`. Помощник сужает тип там, где по секторе
 * карты берут цену или черновик (`colony-build.ts` → `getRoomCost`, `getRoomCostAfterDemolish`).
 */
export const getBuiltRoomKind = (room: RoomConfig): ColonyRoomKind | null => {
  if (room.kind === "empty" || room.kind === "core") {
    return null;
  }

  return room.kind;
};

/**
 * Живут ли в секторе жабы: биопод, репродуктор, энергосектора ⚡, «Медотсек» и сектора похода
 * («Разведка»). У остальных секторов оборудование и товар — жабам там делать нечего.
 *
 * «Медотсек» тоже принимает жаб (`canMoveToadToRoom`, койки), поэтому его обитатели —
 * раненые и больные — рисуются спрайтами прямо на гексе сектора, как в остальных
 * «жабьих» секторах (`HexMapCanvas` создаёт стайку только для `isToadRoom`).
 */
export const isToadRoom = (room: RoomConfig) =>
  room.kind === "aviary" ||
  room.kind === "breeding" ||
  room.kind === "power" ||
  room.kind === "scout" ||
  room.kind === "hospital";

export const hasAutofeeder = (room: RoomConfig) =>
  room.kind === "aviary" ||
  room.kind === "breeding" ||
  room.kind === "power" ||
  room.kind === "scout" ||
  room.kind === "hospital";

/**
 * Видна ли жаба в секторе прямо сейчас: ушедшую в поход карта не рисует —
 * жаба в походе, а не в секторе, и в двух местах сразу не бывает. Место в секторе она при
 * уходе освобождает (`scene_id` снова становится биоподом при отправке,
 * `utils/expedition-config.ts`), поэтому спрайт не вернётся «сам на старое место»:
 * домой жаба приходит в биопод.
 * Проверяем и запись похода, а не только статус: вернувшаяся жаба остаётся в «Разведке»
 * до разбора добычи и не должна появляться на карте раньше времени.
 * Страховка на случай сейва, где жаба уже в походе, но место ещё старое.
 */
export const isToadVisibleInRoom = (toad: Toad, expeditions?: Expedition[]) =>
  !isToadBusyOnExpedition(toad, expeditions);

/** Кольцо, в котором стоит сектор (0 — ядро, дальше — кольца слотов вокруг него). */
export const getRoomRing = (room: RoomConfig) =>
  hexDistance(room.coord, ORIGIN);

/**
 * Дальнее кольцо карты: самый удалённый от ядра гекс списка (пустые слоты фронта тоже
 * считаются). Карта растёт фронтом, поэтому радиус — не форма карты, а «радиус по дальнему
 * гексу»: по нему удобно сравнивать карты между собой (проверки роста, отладка).
 */
export const getRoomsRadius = (rooms: RoomConfig[]): number =>
  rooms.reduce((max, room) => Math.max(max, getRoomRing(room)), 0);

/**
 * Открытые гексы колонии: базовые секторы плюс фронт застройки вокруг построек.
 *
 * Правило карты одно: **слот под застройку стоит только там, где рядом есть построенная
 * сектор**. Фронт ведут все секторы — и базовые (ядро, биопод, репродуктор), и возведённые
 * игроком: у каждой открываются **все шесть соседних гексов** — и те, что лежат на кольцо
 * дальше от ядра, и те, что стоят вбок по её же кольцу. Поэтому вокруг сектора нет закрытых
 * клеток, а слотов «в пустоте» на карте не бывает. Раньше базовые кольца 1–2 открывались
 * целиком по радиусу, и дальние слоты кольца 2 висели без единого сектора рядом; теперь и
 * стартовая карта — это фронт вокруг ядра, биопода и репродуктора.
 *
 * За пределом карты соседей в каталоге нет, поэтому рост сам упирается в `MAX_COLONY_RADIUS`.
 *
 * Постройки из сейва попадают на карту всегда, даже если их слот открылся не по этим
 * правилам: карта не должна терять то, что игрок уже построил. Чужие id каталогу
 * неизвестны и карту не трогают.
 *
 * **Снос сектора землю не отбирает.** Гекс снесённого сектора (`demolished`) остаётся на
 * карте — только уже свободным слотом, — и его фронт продолжает держать открытыми гексы,
 * которые выросли от него. Иначе снос одного сектора в глубине фронта отрезал бы от колонии
 * всю ветку, что за ней выросла: постройки игрока карта помнит (они в сейве), а вот слоты
 * вокруг них держались бы только на «секторах рядом» — и пропали бы вместе с ними.
 * Базовый сектор, которую игрок снёс, показывается так же слотом: её id лежит в
 * `demolished`, а сама она — в `BASE_ROOMS`.
 */
export const getUnlockedRooms = (
  builtRooms: ColonyRoomState[],
  demolished: string[] = [],
): RoomConfig[] => {
  const unlocked = new Map<string, RoomConfig>();
  const cleared = new Set(demolished);

  /** Снесённая базовый сектор: гекс на карте есть, сектора на нём нет (ядро не сносится). */
  const isClearedBase = (id: string) =>
    cleared.has(id) && DEMOLISHABLE_BASE_IDS.has(id);

  /** Снос базового сектора могли записать и по id гекса (`aviary`, `breeding`) */
  const isClearedRoom = (room: RoomConfig) =>
    isClearedBase(room.id) || isClearedBase(room.slotId);

  BASE_ROOMS.forEach((room) =>
    unlocked.set(room.slotId, isClearedRoom(room) ? toEmptySlot(room) : room),
  );

  /** Сектора, вокруг которых расходится фронт: базовые и постройки игрока (чужие id — мимо). */
  const frontier: RoomConfig[] = [
    ...BASE_ROOMS,
    // Гексы снесённых секторов тоже держат фронт: снос не сжимает открытую территорию
    ...demolished
      .map((id) => HEX_ROOM_BY_ID[id])
      .filter((room): room is RoomConfig => room !== undefined),
    ...builtRooms
      .map((built) => HEX_ROOM_BY_ID[built.slotId ?? built.id])
      .filter((room): room is RoomConfig => room !== undefined),
  ];

  frontier.forEach((room) => {
    // Свой гекс на карте есть всегда: постройку игрока карта не забывает. Кроме снесённой
    // базового сектора — её гекс уже поставлен слотом выше, и сектором его не вернуть.
    if (!isClearedRoom(room)) {
      unlocked.set(room.slotId, room);
    }

    // Фронт застройки: у сектора открываются все соседи — и наружу, и вбок по своему кольцу.
    // Соседей за пределом карты в каталоге нет, поэтому рост сам упирается в MAX_COLONY_RADIUS.
    hexNeighbors(room.coord).forEach((coord) => {
      const slot = HEX_ROOM_BY_COORD[hexCoordKey(coord)];

      if (slot && !isClearedRoom(slot)) {
        unlocked.set(slot.slotId, slot);
      }
    });
  });

  return [...unlocked.values()];
};
