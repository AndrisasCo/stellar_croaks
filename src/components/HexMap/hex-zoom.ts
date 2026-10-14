import { hexMapBounds, hexWidth, HEX_SIZE, Point } from "./hex-geometry";
import { RoomConfig } from "./rooms-config";

/**
 * Чистая математика камеры гекс-карты.
 *
 * Есть два вида карты, и между ними переключает зум:
 *  - обзорный — вся колония целиком (стартовый вид; вписывает в экран **всю** карту, включая
 *    только что открытый фронт застройки — см. `FIT_ZOOM` и `getOverviewView`);
 *  - приближенный — один гекс занимает почти всю ширину экрана.
 * Порог — середина между ними: приблизил сильнее половины → включаются детали
 * (кликаются жабы и хотспоты), иначе тап открывает сектор целиком.
 *
 * Габариты карты считаются по её текущим гексам: колония растёт фронтом застройки,
 * поэтому список гексов приходит аргументом (см. `rooms-config` → `getUnlockedRooms`).
 *
 * Держим формулы отдельно от Pixi, чтобы проверять их без рендера.
 */

/**
 * Минимальный зум. На пределе карта — 127 гексов, 994×1109 мировых пикселей: в узкий
 * экран 360×640 она вписывается при зуме ≈0.35, поэтому пол 0.3 с запасом. Раньше стоял
 * 0.5, и на телефоне выросшая колония в экран уже не влезала.
 */
export const MIN_SCALE = 0.3;

/**
 * Множитель обзорного зума: единица — «вписать колонию в экран целиком».
 *
 * Обзорный вид обязан показывать всю карту, включая только что открытый фронт застройки.
 * Ранее здесь стояла двойка («в 2× крупнее, чем вписать»), и карта в экран не влезала: на
 * широком экране по вертикали помещалась лишь половина колонии. Новые гексы после постройки
 * уезжали за кадр — игрок видел только боковые, а «наружу» гексы будто не появлялись.
 */
export const FIT_ZOOM = 1;

/** Поле вокруг карты в обзорном виде (мировые пиксели): колония не липнет к краям экрана. */
export const OVERVIEW_MARGIN = 40;

/** Доля ширины экрана, которую занимает гекс в приближенном виде. */
export const DETAIL_WIDTH_RATIO = 0.92;

/** Нижняя граница приближенного зума — на случай очень узкого экрана. */
export const MIN_DETAIL_SCALE = 1.2;

/** Край экрана, у которого начинается автопанорама при переносе жабы (пиксели). */
export const EDGE_PAN_MARGIN = 64;

/** Скорость автопанорамы у края экрана (экранных пикселей за миллисекунду). */
export const EDGE_PAN_SPEED = 0.5;

export interface ZoomLevels {
  /** Зум обзорного вида (вся колония). */
  overview: number;
  /** Максимальный зум — гекс почти во всю ширину экрана. */
  detail: number;
  /** Зум, с которого включается приближенный вид (детали сектора). */
  threshold: number;
}

/** Максимальный зум зависит от ширины экрана, поэтому передаётся параметром. */
export const clampScale = (value: number, maxScale: number) =>
  Math.min(maxScale, Math.max(MIN_SCALE, value));

/** Габариты всей колонии в мировых пикселях (без учёта зума). */
export const getMapBounds = (rooms: RoomConfig[]) =>
  hexMapBounds(
    rooms.map((room) => room.coord),
    HEX_SIZE,
    HEX_SIZE * 0.8,
  );

/** Приближенный зум: гекс занимает почти всю ширину экрана. */
export const getDetailScale = (screenWidth: number) =>
  Math.max(
    MIN_DETAIL_SCALE,
    (screenWidth * DETAIL_WIDTH_RATIO) / hexWidth(HEX_SIZE)
  );

/** Зум, при котором вся колония влезает в экран целиком (с полем `OVERVIEW_MARGIN`). */
export const getFitScale = (
  screenWidth: number,
  screenHeight: number,
  rooms: RoomConfig[],
  margin: number = OVERVIEW_MARGIN
) => {
  const bounds = getMapBounds(rooms);

  return Math.min(
    screenWidth / (bounds.width + margin),
    screenHeight / (bounds.height + margin)
  );
};

/** Обзорный зум: вся колония на экране × FIT_ZOOM. */
export const getOverviewScale = (
  screenWidth: number,
  screenHeight: number,
  maxScale: number,
  rooms: RoomConfig[]
) => {
  const scale = getFitScale(screenWidth, screenHeight, rooms) * FIT_ZOOM;

  return clampScale(scale, maxScale);
};

/**
 * Обзорная камера: зум «вся колония на экране» и сдвиг, которым карта встаёт по центру.
 *
 * Возвращает и камеру, и видимый прямоугольник мира. По прямоугольнику проверяется главное
 * свойство обзорного вида — что на экран попадает вся карта, включая свежий фронт застройки:
 * у нового сектора открываются соседние гексы, и игрок обязан увидеть их сразу, а не искать
 * панорамой (проверки — `tmp-verify-colony-growth.mjs`, секция 8).
 */
export const getOverviewView = (
  screenWidth: number,
  screenHeight: number,
  rooms: RoomConfig[],
  levels: ZoomLevels = getZoomLevels(screenWidth, screenHeight, rooms)
) => {
  const bounds = getMapBounds(rooms);
  const scale = levels.overview;
  const x = screenWidth / 2 - bounds.center.x * scale;
  const y = screenHeight / 2 - bounds.center.y * scale;

  return {
    scale,
    x,
    y,
    /** Часть мира, попавшая на экран (мировые пиксели). */
    visible: {
      minX: (0 - x) / scale,
      maxX: (screenWidth - x) / scale,
      minY: (0 - y) / scale,
      maxY: (screenHeight - y) / scale,
    },
  };
};

/** Оба вида под текущий размер экрана + порог между ними. */
export const getZoomLevels = (
  screenWidth: number,
  screenHeight: number,
  rooms: RoomConfig[]
): ZoomLevels => {
  const detail = getDetailScale(screenWidth);
  const overview = getOverviewScale(screenWidth, screenHeight, detail, rooms);

  return {
    overview,
    detail,
    threshold: (overview + detail) / 2,
  };
};

/** Приближен ли вид настолько, что жабы и хотспоты кликаются по отдельности. */
export const isZoomedIn = (scale: number, levels: ZoomLevels) =>
  scale >= levels.threshold;

/**
 * Сдвиг камеры, когда палец у края экрана: так жабу доносят до дальних секторов,
 * не отпуская её. Возвращает скорость в экранных пикселях за миллисекунду
 * (нули — панорама не нужна, палец в середине).
 */
export const getEdgePanSpeed = (
  point: Point,
  screen: { width: number; height: number },
  margin: number = EDGE_PAN_MARGIN,
  speed: number = EDGE_PAN_SPEED
): Point => {
  const axis = (value: number, size: number) => {
    if (value < margin) {
      // Палец у левого/верхнего края — мир едет вправо/вниз, открывая то, что за краем
      return Math.min(1, (margin - value) / margin);
    }

    if (value > size - margin) {
      return -Math.min(1, (value - (size - margin)) / margin);
    }

    return 0;
  };

  return {
    x: axis(point.x, screen.width) * speed,
    y: axis(point.y, screen.height) * speed,
  };
};
