import { ColonyRoomKind } from "../../models/colony";
import { AxialCoord, hexDistance, hexRing } from "./hex-geometry";

/**
 * Конфиг гексагональной карты колонии.
 *
 * Комнаты обозначены только цветом: иконок, подписей и кнопок внутри гексов нет — спрайты
 * добавим позже. Тап по гексу открывает существующую React-модалку комнаты, а какую именно —
 * решает первое действие комнаты (`RoomActionId`, разводка — в `HexMap/index.tsx`).
 *
 * Каталог построек `ROOM_BLUEPRINTS` — единственный источник правды о комнатах: из него
 * собираются и карточки меню застройки (`colony-build.ts`), и сами гексы (`createColonyRoom`).
 */

/** Тип гекса карты: пустой слот, ядро или комната из каталога застройки. */
export type RoomKind = "core" | "empty" | ColonyRoomKind;

/** Что открывает действие комнаты: каждому id соответствует модалка на экране карты. */
export type RoomActionId =
  | "menu" // ядро → меню колонии
  | "toad-list" // вольер → список жаб
  | "scene-info" // вольер → статистика вольера
  | "feed" // вольер → покормить всех (без модалки)
  | "nest" // гнездо → размножение
  | "collider" // коллайдер → смешивание генов
  | "incubator" // инкубатор → колбы после коллайдера
  | "dissociator" // диссоциатор → расщепление жаб на биомассу
  | "shop" // магазин → торговля
  | "storage" // склад → ресурсы и коробки
  | "scout" // разведка → команды жаб в походы
  | "hospital" // лазарет → лечение жаб
  | "power-room"; // энергокомната ⚡ → жабы-энергетики

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
  /** Цвет подписей комнаты (у белого ядра текст тёмный). */
  text: number;
}

export interface RoomConfig {
  id: string;
  kind: RoomKind;
  title: string;
  subtitle: string;
  /** Эмодзи-иконка комнаты. */
  icon: string;
  coord: AxialCoord;
  palette: RoomPalette;
  /** Действия комнаты: их наличие отличает построенную комнату от пустого слота (см. isRoomOpen). */
  actions: RoomAction[];
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
  incubator: {
    face: 0x0b3f4a,
    inner: 0x06b6d4,
    edgeShadow: 0x062a33,
    edge: 0x67e8f9,
    glow: 0xa5f3fc,
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
 * Черновик комнаты: из него собираются и гекс на карте, и карточка в меню застройки.
 * Цены — черновые, для балансировки: правятся в одном месте, дальше расходятся сами.
 */
export interface RoomBlueprint {
  kind: ColonyRoomKind;
  title: string;
  subtitle: string;
  icon: string;
  /** Описание для меню застройки. */
  description: string;
  palette: RoomPalette;
  /** Комната строится в колонии только в одном экземпляре (коллайдер, магазин, диссоциатор). */
  unique: boolean;
  /** Цена первой такой комнаты в Кваксах 🔷. */
  baseCost: number;
  /** Во сколько раз дорожает каждая следующая такая комната. */
  costGrowth: number;
  /** Действия комнаты: первое — то, что открывает тап по гексу. */
  actions: RoomAction[];
}

export const ROOM_BLUEPRINTS: Record<ColonyRoomKind, RoomBlueprint> = {
  power: {
    kind: "power",
    title: "Энергокомната",
    subtitle: "Ток для соседей",
    icon: "⚡",
    description:
      "Даёт ток соседним комнатам: 6 жаб внутри закрывают все 6 сторон. Жаб нужно кормить.",
    palette: PALETTES.power,
    unique: false,
    baseCost: 120,
    costGrowth: 1.6,
    actions: [{ id: "power-room", icon: "⚡", title: "Энергокомната" }],
  },
  aviary: {
    kind: "aviary",
    title: "Вольер",
    subtitle: "Дом для жаб",
    icon: "🐸",
    description:
      "Жабы живут, растут и производят биомассу. Вместимость — по текущему вольеру колонии.",
    palette: PALETTES.aviary,
    unique: false,
    baseCost: 400,
    costGrowth: 2,
    actions: [
      { id: "toad-list", icon: "📋", title: "Список жаб вольера" },
      { id: "scene-info", icon: "ⓘ", title: "О вольере" },
      { id: "feed", icon: "🍎", title: "Покормить всех" },
    ],
  },
  breeding: {
    kind: "breeding",
    title: "Гнездо",
    subtitle: "Размножение, беременность",
    icon: "🥚",
    description:
      "Беременность идёт под присмотром: жабы зреют в гнезде, потомство уходит в инкубатор.",
    palette: PALETTES.breeding,
    unique: false,
    baseCost: 500,
    costGrowth: 2,
    actions: [{ id: "nest", icon: "🥚", title: "Гнездо" }],
  },
  incubator: {
    kind: "incubator",
    title: "Инкубатор",
    subtitle: "Колбы после коллайдера",
    icon: "🧫",
    description:
      "Колбы для потомства коллайдера: гибрид дозревает здесь и оттуда отправляется в вольер.",
    palette: PALETTES.incubator,
    unique: false,
    baseCost: 300,
    costGrowth: 1.8,
    actions: [{ id: "incubator", icon: "🧫", title: "Инкубатор" }],
  },
  collider: {
    kind: "collider",
    title: "Коллайдер",
    subtitle: "Смешивание генов",
    icon: "🧬",
    description:
      "Смешивает гены двух жаб: гибрид уходит в инкубатор. Комната — в единственном экземпляре.",
    palette: PALETTES.collider,
    unique: true,
    baseCost: 800,
    costGrowth: 1,
    actions: [{ id: "collider", icon: "🧬", title: "Коллайдер" }],
  },
  scout: {
    kind: "scout",
    title: "Разведка",
    subtitle: "Команды жаб в походы",
    icon: "🧭",
    description:
      "Диспетчерская колонии: собирает команды жаб и отправляет их в походы по секторам Периметра.",
    palette: PALETTES.scout,
    unique: false,
    baseCost: 350,
    costGrowth: 1.8,
    actions: [{ id: "scout", icon: "🧭", title: "Разведка" }],
  },
  storage: {
    kind: "storage",
    title: "Склад",
    subtitle: "Ресурсы и коробки",
    icon: "📦",
    description:
      "Полки и коробки колонии: здесь лежат корм, биомасса, предметы и лишние жабы.",
    palette: PALETTES.storage,
    unique: false,
    baseCost: 250,
    costGrowth: 1.7,
    actions: [{ id: "storage", icon: "📦", title: "Склад" }],
  },
  shop: {
    kind: "shop",
    title: "Магазин",
    subtitle: "Торговля",
    icon: "🛒",
    description:
      "Покупка и продажа жаб, элитные заказы и вольеры. Магазин в колонии один.",
    palette: PALETTES.shop,
    unique: true,
    baseCost: 600,
    costGrowth: 1,
    actions: [{ id: "shop", icon: "🛒", title: "Магазин" }],
  },
  hospital: {
    kind: "hospital",
    title: "Лазарет",
    subtitle: "Лечение жаб",
    icon: "🩹",
    description:
      "Раненых жаб лечат за Кваксы, не дожидаясь, пока HP восстановится само.",
    palette: PALETTES.hospital,
    unique: false,
    baseCost: 450,
    costGrowth: 1.8,
    actions: [{ id: "hospital", icon: "🩹", title: "Лазарет" }],
  },
  dissociator: {
    kind: "dissociator",
    title: "Диссоциатор",
    subtitle: "Расщепление генов",
    icon: "🧪",
    description:
      "Жаба расщепляется на биомассу: необратимо, зато полезно. Комната в колонии одна.",
    palette: PALETTES.dissociator,
    unique: true,
    baseCost: 700,
    costGrowth: 1,
    actions: [{ id: "dissociator", icon: "🧪", title: "Диссоциатор" }],
  },
};

/**
 * Порядок комнат в меню застройки: сначала инфраструктура и базовые нужды, дальше лаборатория
 * и торговля. Список и есть порядок карточек — каталог `ROOM_BLUEPRINTS` остаётся без порядка.
 */
export const ROOM_BLUEPRINT_ORDER: ColonyRoomKind[] = [
  "power",
  "aviary",
  "breeding",
  "incubator",
  "collider",
  "scout",
  "storage",
  "shop",
  "hospital",
  "dissociator",
];

/**
 * Собирает комнату карты из черновика: гекс остаётся на своём месте, меняются вид, цвет,
 * подписи и действия. Из этой же функции получаются базовые комнаты колонии.
 */
export const createColonyRoom = (
  slot: RoomConfig,
  kind: ColonyRoomKind,
): RoomConfig => {
  const blueprint = ROOM_BLUEPRINTS[kind];

  return {
    ...slot,
    kind,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    icon: blueprint.icon,
    palette: blueprint.palette,
    actions: blueprint.actions,
  };
};

/** Центр колонии — белое ядро: у него нет черновика, второго ядра не построить. */
const CORE_ROOM: RoomConfig = {
  id: "core",
  kind: "core",
  title: "Ядро",
  subtitle: "Центр колонии",
  icon: "🏛",
  coord: { q: 0, r: 0 },
  palette: PALETTES.core,
  actions: [{ id: "menu", icon: "☰", title: "Меню колонии" }],
};

/** Гекс под застройку: цвет «пустой», действий нет — игрок решает, что здесь построить. */
const emptySlot = (id: string, coord: AxialCoord): RoomConfig => ({
  id,
  kind: "empty",
  title: "",
  subtitle: "",
  icon: "+",
  coord,
  palette: PALETTES.empty,
  actions: [],
});

/** Базовые комнаты колонии (ядро рисуется отдельно): вольер и гнездо стоят с начала игры. */
const baseRoom = (
  id: string,
  kind: ColonyRoomKind,
  coord: AxialCoord,
): RoomConfig => createColonyRoom(emptySlot(id, coord), kind);

/**
 * Свободные слоты первого кольца: два оставшихся гекса кольца заняты вольером и гнездом.
 * id слотов менять нельзя — по ним сейвы помнят уже построенные комнаты.
 */
const RING_ONE_SLOTS: RoomConfig[] = [
  emptySlot("slot-north", { q: 0, r: -1 }),
  emptySlot("slot-south", { q: 0, r: 1 }),
  emptySlot("slot-south-west", { q: -1, r: 1 }),
  emptySlot("slot-north-east", { q: 1, r: -1 }),
];

/**
 * Свободные слоты второго кольца — территория колонии под расширение. id остаются
 * «outpost-N» с прошлых версий: сейвы помнят id построек, переименование их бы потеряло.
 */
const RING_TWO_SLOTS: RoomConfig[] = hexRing(2).map((coord, index) =>
  emptySlot(`outpost-${index}`, coord),
);

/** Полный список гексов карты (без сортировки — порядок отрисовки задаёт канвас). */
export const HEX_ROOMS: RoomConfig[] = [
  CORE_ROOM,
  baseRoom("aviary", "aviary", { q: -1, r: 0 }),
  baseRoom("breeding", "breeding", { q: 1, r: 0 }),
  ...RING_ONE_SLOTS,
  ...RING_TWO_SLOTS,
];

export const HEX_ROOM_BY_ID: Record<string, RoomConfig> = HEX_ROOMS.reduce<
  Record<string, RoomConfig>
>((acc, room) => {
  acc[room.id] = room;
  return acc;
}, {});

/** Черновик комнаты: цена, «единственная в колонии», описание (см. colony-build). */
export const getRoomBlueprint = (kind: ColonyRoomKind): RoomBlueprint =>
  ROOM_BLUEPRINTS[kind];

/** Открыта ли комната (у пустых слотов действий нет). */
export const isRoomOpen = (room: RoomConfig) => room.actions.length > 0;

/** Комната построена, а не пустой слот под застройку. */
export const isBuiltRoom = (room: RoomConfig) => room.kind !== "empty";

/** Живут ли в комнате жабы: вольер, гнездо и построенные энергокомнаты ⚡. */
export const isToadRoom = (room: RoomConfig) =>
  room.kind === "aviary" || room.kind === "breeding" || room.kind === "power";

/** Кольцо, в котором стоит комната (0 — ядро, 1 и 2 — слоты вокруг). */
export const getRoomRing = (room: RoomConfig) =>
  hexDistance(room.coord, { q: 0, r: 0 });

/**
 * Внешнее кольцо колонии: дальше начинается свободная территория.
 * По нему фон решает, где рисовать медовую сетку: внутри колонии её нет, иначе линия
 * сетки просвечивала бы сквозь полупрозрачный пустой слот рядом с его пунктиром и
 * контур читался бы сдвоенным (см. `HONEYCOMB_FROM_RING` в `hex-honeycomb.ts`).
 */
export const COLONY_RADIUS = Math.max(...HEX_ROOMS.map(getRoomRing));

