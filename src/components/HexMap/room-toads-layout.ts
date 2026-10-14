import {
  clipPolygonByHex,
  hexApothem,
  HEX_SIZE,
  HexShape,
  Point,
  shapeCorners,
  koeff,
} from "./hex-geometry";

/**
 * Чистая математика посадки жаб в гексагональный сектор.
 *
 * Размер жабы и зона, по которой она ходит, выводятся из размера гекса, поэтому жаба
 * никогда не выходит за грань сектора. Держим формулы отдельно от Pixi,
 * чтобы их можно было проверить без рендера.
 */

/** Общий множитель размера жаб в секторах (0.5 — жабы вдвое мельче базового размера). */
export const TOAD_SIZE_FACTOR = 0.5;

/** Базовое уменьшение жабы в секторе. */
export const ROOM_TOAD_SCALE = 0.62 * TOAD_SIZE_FACTOR;

/** Ширина спрайта жабы в долях размера гекса: крупнее этого жабы в секторе не рисуются. */
export const TOAD_WIDTH_OF_HEX = 0.55;

/** Доля ширины гекса сектора, отданная жабам (1 — жабий гекс во всю ширину сектора). */
export const TOAD_AREA_WIDTH_SCALE = 1;

/** Доля высоты гекса сектора, отданная жабам (0.6 — жабий гекс занимает нижние 60 %). */
export const TOAD_AREA_HEIGHT_SCALE = 0.5;

/**
 * Отступ зоны жаб от краёв сектора — в «жабах».
 *
 * Жаба стоит в точке, а рисуется вокруг неё, поэтому у самого края зоны она вылезала бы за
 * обводку сектора. Отодвигаем зону от стен на ширину одной жабы, чтобы этого не происходило.
 */
export const TOAD_AREA_EDGE_MARGIN_TOADS = 1;

/**
 * Крупные жабы автоматически уменьшаются, чтобы влезать в гекс.
 * update-toad рисует спрайт шириной weight * 3, поэтому за основу берём эту ширину.
 */
export const getToadScale = (weight: number, hexSize: number = HEX_SIZE) =>
  Math.min(
    ROOM_TOAD_SCALE,
    (hexSize * TOAD_WIDTH_OF_HEX * TOAD_SIZE_FACTOR) / Math.max(1, weight * 3),
  );

/**
 * Ширина самого крупного спрайта в секторе: в этот размер упирается getToadScale, поэтому
 * все крупные жабы одного размера. Она же — «одна жаба» для отступов зоны.
 */
export const getToadMaxWidth = (hexSize: number = HEX_SIZE) =>
  hexSize * TOAD_WIDTH_OF_HEX * TOAD_SIZE_FACTOR;

export const getToadAreaMargin = (hexSize: number = HEX_SIZE) => hexSize * 0.3;

/**
 * Радиус гекса, по которому обрезаем зону жаб: гекс сектора, отодвинутый от стен на отступ.
 *
 * У правильного гекса расстояние от центра до грани — апофема, поэтому отступаем на отступ
 * от неё: `hexApothem(size) = size * √3/2`, значит обратный переход — деление на √3/2.
 */
export const getToadAreaClipHexSize = (hexSize: number = HEX_SIZE) =>
  (hexApothem(hexSize) - getToadAreaMargin(hexSize)) / (koeff / 2);

/** Полуширина зоны жаб: 100 % ширины сектора — от центра до бокового острия гекса. */
export const getToadAreaHalfWidth = (hexSize: number = HEX_SIZE) =>
  hexSize * TOAD_AREA_WIDTH_SCALE;

/** Полувысота зоны жаб: 60 % высоты сектора — половина от неё (у зоны две полувысоты). */
export const getToadAreaHalfHeight = (hexSize: number = HEX_SIZE) =>
  hexApothem(hexSize) * TOAD_AREA_HEIGHT_SCALE;

/**
 * Центр зоны жаб. Зона стоит в нижней части сектора, но не липнет к её низу: нижняя грань зоны
 * поднята над нижней гранью гекса на отступ (примерно одна жаба), поэтому жабы ходят по «полу»
 * сектора и не упираются в обводку.
 */
export const getToadAreaCenter = (
  center: Point,
  hexSize: number = HEX_SIZE,
): Point => ({
  x: center.x,
  y:
    center.y +
    hexApothem(hexSize) -
    getToadAreaMargin(hexSize) -
    getToadAreaHalfHeight(hexSize),
});

/**
 * Заказанная форма зоны жаб: приплюснутый гекс во всю ширину сектора (100 %) в её нижней части
 * (60 % высоты). Низ этой формы отодвинут от низа сектора на отступ — см. `getToadAreaCenter`.
 */
export const getToadAreaShape = (
  center: Point,
  hexSize: number = HEX_SIZE,
): HexShape => ({
  center: getToadAreaCenter(center, hexSize),
  halfWidth: getToadAreaHalfWidth(hexSize),
  halfHeight: getToadAreaHalfHeight(hexSize),
});

/**
 * Зона, по которой реально ходят жабы: заказанный гекс, обрезанный по стенам сектора с отступом.
 *
 * Такой гекс во всю ширину сектора не может целиком лежать в её гексе — у нижних боковых
 * граней сектора он вылезал бы наружу, поэтому лишнее отрезаем. Обрезаем не по самим стенам,
 * а по гексу, отодвинутому от них на отступ (примерно одна жаба): тогда жаба, стоящая у края
 * зоны, всё равно остаётся внутри сектора. В итоге зона занимает нижние 60 % высоты сектора,
 * отодвинута от её низа и наклонных стен на один шаг жабы.
 */
export const getToadArea = (
  center: Point,
  hexSize: number = HEX_SIZE,
): Point[] =>
  clipPolygonByHex(
    shapeCorners(getToadAreaShape(center, hexSize)),
    center,
    getToadAreaClipHexSize(hexSize),
  );

/** Половина ширины спрайта жабы в мировых пикселях. */
export const getToadHalfWidth = (weight: number, hexSize: number = HEX_SIZE) =>
  weight * 1.5 * getToadScale(weight, hexSize);

/** Полная ширина спрайта жабы в мировых пикселях. */
export const getToadWidth = (weight: number, hexSize: number = HEX_SIZE) =>
  getToadHalfWidth(weight, hexSize) * 2;

/** Радиус попадания для тапа по жабе. */
export const getToadHitRadius = (weight: number, hexSize: number = HEX_SIZE) =>
  Math.max(16, getToadHalfWidth(weight, hexSize));

/**
 * Свободная полоса сектора над зоной жаб: верхние 40 % высоты минус отступ зоны от стен.
 * Жаба выше этой полосы уже не помещается в сектор — её спрайт вылезет за верхнюю грань.
 */
export const getToadAreaHeadroom = (hexSize: number = HEX_SIZE) =>
  hexApothem(hexSize) * 2 * (1 - TOAD_AREA_HEIGHT_SCALE) -
  getToadAreaMargin(hexSize);

/**
 * Помещается ли жаба такого веса в сектор: сравниваем её спрайт с полосой над зоной жаб.
 * По ширине жаба проходит с запасом — getToadScale ограничивает спрайт, а зона во всю ширину.
 */
export const toadFitsInRoom = (weight: number, hexSize: number = HEX_SIZE) =>
  getToadHalfWidth(weight, hexSize) <= getToadAreaHeadroom(hexSize);

/** Жаба «в руке»: насколько крупнее она становится при переносе. */
export const DRAG_LIFT = 1.14;

/** Скорость полёта жабы (мировых пикселей за кадр) — возврат на место и посадка. */
export const FLY_SPEED = 13;

/**
 * Разброс жаб вокруг кормушки по осям — в долях зоны жаб.
 * Кормушка одна, поэтому жабы встают вокруг неё широким пятном, а не в точку.
 */
export const ATTRACTOR_SPREAD_X = 0.7;
export const ATTRACTOR_SPREAD_Y = 0.35;
