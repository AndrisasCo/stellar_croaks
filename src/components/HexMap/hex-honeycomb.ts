import { AxialCoord, hexCoordKey, hexNeighbors } from "./hex-geometry";

/**
 * Медовая сетка территории колонии — фон под картой.
 *
 * Сетка живёт только **за** колонией: под её гексами стоят комнаты и пустые слоты, и там
 * линия сетки (0.96 гекса) шла рядом с контуром слота (пунктир 0.92 гекса) — сквозь
 * полупрозрачный пустой слот второго кольца просвечивали обе, и контур читался сдвоенным.
 *
 * Карта растёт фронтом вокруг построек (см. `rooms-config` → `getUnlockedRooms`), поэтому
 * сетка — не кольцо от радиуса, а венок вокруг открытых гексов: клетка встаёт на каждый
 * гекс, соседний с колонией. Так сетка обступает колонию по её настоящей форме — с выступами
 * там, где игрок строил, — и не оставляет пустоты между краем карты и кольцом сетки.
 *
 * Держим формулы отдельно от Pixi (как `hex-zoom.ts`), чтобы проверять их без рендера.
 */

/** Сколько колец сетки уходит в территорию за гексами колонии. */
export const HONEYCOMB_RINGS = 1;

/** Клетка сетки чуть меньше гекса комнаты: между клетками остаётся зазор, сетка читается кружевом. */
export const HONEYCOMB_CELL_SCALE = 1;

/**
 * Координаты клеток сетки — всё, что фон рисует за открытыми гексами колонии.
 * Клетки никогда не совпадают с гексами колонии и не повторяются между кольцами.
 */
export const getHoneycombCoords = (
  colony: AxialCoord[],
  rings: number = HONEYCOMB_RINGS,
): AxialCoord[] => {
  const taken = new Set(colony.map((coord) => hexCoordKey(coord)));
  const frame: AxialCoord[] = [];
  let frontier = colony;

  for (let layer = 0; layer < rings; layer += 1) {
    const next: AxialCoord[] = [];

    frontier.forEach((coord) => {
      hexNeighbors(coord).forEach((neighbour) => {
        const key = hexCoordKey(neighbour);

        // Гекс колонии и уже занятую клетку сетки второй раз не берём
        if (taken.has(key)) {
          return;
        }

        taken.add(key);
        frame.push(neighbour);
        next.push(neighbour);
      });
    });

    frontier = next;
  }

  return frame;
};
