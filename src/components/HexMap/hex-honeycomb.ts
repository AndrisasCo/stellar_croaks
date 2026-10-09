import { AxialCoord, hexRing } from "./hex-geometry";
import { COLONY_RADIUS } from "./rooms-config";

/**
 * Медовая сетка территории колонии — фон под картой.
 *
 * Сетка живёт только **за** колонией: под её гексами стоят комнаты и пустые слоты, и там
 * линия сетки (0.96 гекса) шла рядом с контуром слота (пунктир 0.92 гекса) — сквозь
 * полупрозрачный пустой слот второго кольца просвечивали обе, и контур читался сдвоенным.
 *
 * Держим формулы отдельно от Pixi (как `hex-zoom.ts`), чтобы проверять их без рендера.
 */

/** Кольцо, с которого начинается сетка: сразу за внешним кольцом колонии. */
export const HONEYCOMB_FROM_RING = COLONY_RADIUS + 1;

/** Сколько колец сетки уходит в территорию за комнатами колонии. */
export const HONEYCOMB_RINGS = 1;

/** Клетка сетки чуть меньше гекса комнаты: между клетками остаётся зазор, сетка читается кружевом. */
export const HONEYCOMB_CELL_SCALE = 1;

/** Координаты клеток сетки — всё, что фон рисует за колонией. */
export const getHoneycombCoords = (
  rings: number = HONEYCOMB_RINGS,
): AxialCoord[] => {
  const coords: AxialCoord[] = [];

  for (
    let radius = HONEYCOMB_FROM_RING;
    radius < HONEYCOMB_FROM_RING + rings;
    radius += 1
  ) {
    coords.push(...hexRing(radius));
  }

  return coords;
};
