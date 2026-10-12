import { ColonyRoomKind, ColonyRoomState } from "../../models/colony";
import { Toad } from "../../models/Toad";
import { NEST_ROOM_ID } from "../../utils/constants";
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
  | "room-upgrade" // ядро → улучшение комнаты (автокормушка)
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
  /**
   * Вольер гекса-вольера (`Scene`), который он показывает: у каждого гекса «Вольер» свой.
   * Гекс рисует жильцов именно этого вольера (`Toad.scene_id`), а не общий список жаб.
   * У остальных комнат вольера нет — поля не будет.
   */
  sceneId?: number;
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
 *
 * Цены — по ВРЕМЕНИ игры, а не «на глаз»: ранняя колония из 3-4 жаб даёт ~110 Кваксов
 * в сутки, а на старте у игрока 50 Кваксов. Поэтому первые два гекса обучения —
 * «Разведка» (25) и «Склад» (25) — игрок ставит сразу, не дожидаясь фермы; дальше цена
 * растёт вместе с доходом: полдня фермы (инкубатор, лазарет), сутки (вольер, гнездо,
 * энергокомната, магазин), несколько суток (лаборатория и коллайдер).
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
    baseCost: 160,
    costGrowth: 1.6,
    actions: [{ id: "power-room", icon: "⚡", title: "Энергокомната" }],
  },
  aviary: {
    kind: "aviary",
    title: "Вольер",
    subtitle: "Новый дом для жаб",
    icon: "🐸",
    description:
      "Строит ещё один вольер: +20 мест для жаб. Вольеров может быть до 10 — каждый следующий дороже.",
    palette: PALETTES.aviary,
    unique: false,
    baseCost: 120,
    costGrowth: 1.7,
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
    baseCost: 150,
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
    baseCost: 80,
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
    baseCost: 600,
    costGrowth: 1,
    actions: [{ id: "collider", icon: "🧬", title: "Коллайдер" }],
  },
  scout: {
    kind: "scout",
    title: "Разведка",
    subtitle: "Команды жаб в походы",
    icon: "🧭",
    description:
      "Диспетчерская колонии: команды уходят в походы по секторам Периметра. Поход всегда выгоднее фермы, а каждая роль в команде добавляет 20% к шансу удачного возврата.",
    palette: PALETTES.scout,
    unique: false,
    baseCost: 25,
    costGrowth: 1.8,
    actions: [{ id: "scout", icon: "🧭", title: "Разведка" }],
  },
  storage: {
    kind: "storage",
    title: "Склад",
    subtitle: "+300 к вместимости",
    icon: "📦",
    description:
      "Каждый склад добавляет 300 единиц к полкам: корм, батарейки, пигменты, пыль и лутбоксы. Тап по складу открывает его содержимое.",
    palette: PALETTES.storage,
    unique: false,
    baseCost: 25,
    costGrowth: 1.7,
    actions: [{ id: "storage", icon: "📦", title: "Склад" }],
  },
  shop: {
    kind: "shop",
    title: "Магазин",
    subtitle: "Торговля",
    icon: "🛒",
    description:
      "Покупка и продажа жаб, элитные заказы за Астро-кваксы. Магазин в колонии один.",
    palette: PALETTES.shop,
    unique: true,
    baseCost: 450,
    costGrowth: 1,
    actions: [{ id: "shop", icon: "🛒", title: "Магазин" }],
  },
  hospital: {
    kind: "hospital",
    title: "Лазарет",
    subtitle: "6 коек, быстрое лечение",
    icon: "🩹",
    description:
      "Койки для шести жаб: здесь HP идёт +24 в час вместо 1, болезнь проходит втрое быстрее и не передаётся соседям. Мгновенное лечение за Кваксы — самый дорогой способ.",
    palette: PALETTES.hospital,
    unique: false,
    baseCost: 95,
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
    baseCost: 400,
    costGrowth: 1,
    actions: [{ id: "dissociator", icon: "🧪", title: "Диссоциатор" }],
  },
};

/**
 * Порядок комнат в меню застройки: сначала то, что нужно на обучении (разведка и склад
 * ставятся со стартовых Кваксов), дальше жильё и энергия, потом лаборатория и торговля.
 * Список и есть порядок карточек — каталог `ROOM_BLUEPRINTS` остаётся без порядка.
 */
export const ROOM_BLUEPRINT_ORDER: ColonyRoomKind[] = [
  "scout",
  "storage",
  "aviary",
  "power",
  "breeding",
  "incubator",
  "hospital",
  "shop",
  "collider",
  "dissociator",
];

/**
 * Собирает комнату карты из черновика: гекс остаётся на своём месте, меняются вид, цвет,
 * подписи и действия. Из этой же функции получаются базовые комнаты колонии.
 *
 * `sceneId` передаёт только гекс-вольер: он показывает жильцов своего вольера.
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
 * Тап по ядру открывает улучшение комнат: апгрейдов в игре пока один — автокормушка,
 * а ставится он жилой комнате, поэтому модалка сначала спрашивает, какой именно гекс улучшаем.
 */
const CORE_ROOM: RoomConfig = {
  id: "core",
  kind: "core",
  title: "Ядро",
  subtitle: "Центр колонии",
  icon: "🏛",
  coord: ORIGIN,
  palette: PALETTES.core,
  actions: [{ id: "room-upgrade", icon: "🔧", title: "Улучшение комнаты" }],
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
 * Свободные слоты второго кольца: последнее кольцо со «старыми» id — «outpost-N» с прошлых
 * версий. Сейвы помнят id построек, поэтому переименование этих слотов их бы потеряло;
 * с третьего кольца id несёт номер кольца (см. `ringSlots`).
 */
const RING_TWO_SLOTS: RoomConfig[] = hexRing(2).map((coord, index) =>
  emptySlot(`outpost-${index}`, coord),
);

/**
 * Стартовый радиус колонии: ядро, вольер и гнездо на первом кольце и свободные слоты
 * второго. Дальше карта растёт от построек фронтом застройки — см. `getUnlockedRooms`.
 */
export const BASE_COLONY_RADIUS = 2;

/**
 * Предел роста колонии: дальше гексов нет (внешнее кольцо — шестое, 36 слотов, вся карта —
 * 127 гексов), поэтому у постройки на предельном кольце новых соседей не открывается.
 * Слотов заведомо больше, чем игрок успеет застроить, а карта остаётся лёгкой для рендера.
 */
export const MAX_COLONY_RADIUS = 6;

/** Гексы, которые стоят на карте с начала игры: ядро, базовые комнаты и слоты 1–2 колец. */
const BASE_ROOMS: RoomConfig[] = [
  CORE_ROOM,
  baseRoom("aviary", "aviary", { q: -1, r: 0 }),
  // id гнезда — общая константа: в него уходит пара на ухаживание (utils/constants.ts)
  baseRoom(NEST_ROOM_ID, "breeding", { q: 1, r: 0 }),
  ...RING_ONE_SLOTS,
  ...RING_TWO_SLOTS,
];

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
 * Каталог гексов карты до кольца `radius` включительно: базовые комнаты и слоты колец.
 * Живую карту собирает `getUnlockedRooms`, а каталог нужен как справочник id и координат:
 * карта растёт фронтом от построек, поэтому «радиус до кольца» её форму больше не описывает.
 */
export const getColonyRooms = (
  radius: number = MAX_COLONY_RADIUS,
): RoomConfig[] => {
  const rooms = [...BASE_ROOMS];
  const outer = Math.min(radius, MAX_COLONY_RADIUS);

  for (let ring = BASE_COLONY_RADIUS + 1; ring <= outer; ring += 1) {
    rooms.push(...ringSlots(ring));
  }

  return rooms;
};

/**
 * Все возможные гексы карты: по ним ищутся комнаты сейва (`HEX_ROOM_BY_ID`) — слот кольца,
 * до которого колония ещё не доросла, тоже должен находиться.
 */
export const ALL_HEX_ROOMS: RoomConfig[] = getColonyRooms();

export const HEX_ROOM_BY_ID: Record<string, RoomConfig> = ALL_HEX_ROOMS.reduce<
  Record<string, RoomConfig>
>((acc, room) => {
  acc[room.id] = room;
  return acc;
}, {});

/** Гекс каталога по координате: по нему фронт застройки находит слоты соседних колец. */
export const HEX_ROOM_BY_COORD: Record<string, RoomConfig> =
  ALL_HEX_ROOMS.reduce<Record<string, RoomConfig>>((acc, room) => {
    acc[hexCoordKey(room.coord)] = room;
    return acc;
  }, {});

/** Черновик комнаты: цена, «единственная в колонии», описание (см. colony-build). */
export const getRoomBlueprint = (kind: ColonyRoomKind): RoomBlueprint =>
  ROOM_BLUEPRINTS[kind];

/** Открыта ли комната (у пустых слотов действий нет). */
export const isRoomOpen = (room: RoomConfig) => room.actions.length > 0;

/** Комната построена, а не пустой слот под застройку. */
export const isBuiltRoom = (room: RoomConfig) => room.kind !== "empty";

/**
 * Живут ли в комнате жабы: вольер, гнездо, энергокомнаты ⚡, «Лазарет» и комнаты похода
 * («Разведка»). У остальных комнат оборудование и товар — жабам там делать нечего.
 *
 * «Лазарет» тоже принимает жаб (`canMoveToadToRoom`, койки), поэтому его обитатели —
 * раненые и больные — рисуются спрайтами прямо на гексе комнаты, как в остальных
 * «жабьих» комнатах (`HexMapCanvas` создаёт стайку только для `isToadRoom`).
 */
export const isToadRoom = (room: RoomConfig) =>
  room.kind === "aviary" ||
  room.kind === "breeding" ||
  room.kind === "power" ||
  room.kind === "scout" ||
  room.kind === "hospital";

/**
 * Видна ли жаба в комнате прямо сейчас: ушедшую в поход (`status: "out"`) карта не рисует —
 * жаба в походе, а не в комнате, и двух местах сразу не бывает. Место в комнате она при
 * уходе освобождает (`roomId` сбрасывается при отправке, `utils/expedition-config.ts`),
 * поэтому спрайт не вернётся «сам на старое место»: домой жаба приходит в вольер.
 * Страховка на случай сейва, где жаба уже в походе, но место ещё старое.
 */
export const isToadVisibleInRoom = (toad: Toad) => toad.status !== "out";

/** Кольцо, в котором стоит комната (0 — ядро, дальше — кольца слотов вокруг него). */
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
 * Открытые гексы колонии: базовая карта плюс фронт застройки вокруг построенных комнат.
 *
 * Карта растёт не кольцами, а от самих комнат: у новой постройки открываются **все шесть
 * соседних гексов** — и те, что лежат на кольцо дальше от ядра, и те, что стоят вбок по её
 * же кольцу. Раньше открывались только «внешние» соседи (2–3 гекса), и у комнаты всегда
 * оставались закрытые боковые клетки: фронт получался дырявым, а медовая сетка территории
 * (она обступает колонию по всем соседям, `hex-honeycomb.ts`) обещала гекс там, где застройки
 * не было. Теперь фронт сплошной — вокруг комнаты нет закрытых клеток.
 *
 * Внутрь открывать уже нечего: кольца `BASE_COLONY_RADIUS` и ниже открыты с начала игры.
 * За пределом карты соседей в каталоге нет, поэтому рост сам упирается в `MAX_COLONY_RADIUS`.
 *
 * Постройки из сейва попадают на карту всегда, даже если их слот открылся не по этим
 * правилам: карта не должна терять то, что игрок уже построил. Чужие id каталогу
 * неизвестны и карту не трогают.
 */
export const getUnlockedRooms = (
  builtRooms: ColonyRoomState[],
): RoomConfig[] => {
  const unlocked = new Map<string, RoomConfig>();

  BASE_ROOMS.forEach((room) => unlocked.set(room.id, room));

  builtRooms.forEach((built) => {
    const room = HEX_ROOM_BY_ID[built.id];

    // Слот мог исчезнуть из каталога — чужой id карту не расширяет
    if (!room) {
      return;
    }

    // Свой гекс на карте есть всегда: постройку игрока карта не забывает
    unlocked.set(room.id, room);

    // Фронт застройки: у комнаты открываются все соседи — и наружу, и вбок по своему кольцу.
    // Соседей за пределом карты в каталоге нет, поэтому рост сам упирается в MAX_COLONY_RADIUS.
    hexNeighbors(room.coord).forEach((coord) => {
      const slot = HEX_ROOM_BY_COORD[hexCoordKey(coord)];

      if (slot) {
        unlocked.set(slot.id, slot);
      }
    });
  });

  return [...unlocked.values()];
};
