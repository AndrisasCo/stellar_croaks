import { hexMapBounds, hexWidth, HEX_SIZE, Point } from "./hex-geometry";
import { RoomConfig } from "./rooms-config";

/**
 * Чистая математика камеры гекс-карты.
 *
 * Есть два вида карты, и между ними переключает зум:
 *  - обзорный — вся колония целиком (стартовый вид);
 *  - приближенный — один гекс занимает почти всю ширину экрана.
 * Порог — середина между ними: приблизил сильнее половины → включаются детали
 * (кликаются жабы и хотспоты), иначе тап открывает комнату целиком.
 *
 * Габариты карты считаются по её текущим гексам: колония растёт фронтом застройки,
 * поэтому список гексов приходит аргументом (см. `rooms-config` → `getUnlockedRooms`).
 *
 * Держим формулы отдельно от Pixi, чтобы проверять их без рендера.
 */

/** Минимальный зум — видно всю территорию колонии с запасом. */
export const MIN_SCALE = 0.5;

/** Стартовое приближение обзорного вида: в 2× крупнее, чем «вписать всю колонию». */
export const FIT_ZOOM = 2;

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
  /** Зум, с которого включается приближенный вид (детали комнаты). */
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

/** Обзорный зум: вся колония на экране × FIT_ZOOM. */
export const getOverviewScale = (
  screenWidth: number,
  screenHeight: number,
  maxScale: number,
  rooms: RoomConfig[]
) => {
  const bounds = getMapBounds(rooms);

  return clampScale(
    Math.min(
      screenWidth / (bounds.width + 40),
      screenHeight / (bounds.height + 40)
    ) * FIT_ZOOM,
    maxScale
  );
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
 * Сдвиг камеры, когда палец у края экрана: так жабу доносят до дальних комнат,
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
