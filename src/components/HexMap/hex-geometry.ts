/**
 * Геометрия гексагональной карты колонии.
 *
 * Используются «flat-top» гексы (плоская грань сверху и снизу) и axial-координаты (q, r):
 *  - q — ось «восток–юго-восток», r — ось «юг»;
 *  - соседние гексы различаются на единицу, поэтому кольца и расстояния считаются арифметикой.
 *
 * Это те же гексы, что и «pointy-top», развёрнутые на 90°: сетка идёт столбцами, гекс шире,
 * чем выше, поэтому колония компактнее по горизонтали и лучше ложится в вертикальный экран.
 *
 * Все размеры — в мировых пикселях Pixi до применения зума/панорамы.
 */

export interface AxialCoord {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Радиус гекса — расстояние от центра до угла. */
export const HEX_SIZE = 46;

export const koeff = Math.sqrt(3);

/** Расстояние от центра до середины стороны. */
export const hexApothem = (size: number = HEX_SIZE) => (koeff / 2) * size;

/** Ширина гекса (по горизонтали) — между остриём справа и слева. */
export const hexWidth = (size: number = HEX_SIZE) => 2 * size;

/** Высота гекса (по вертикали) — между плоскими гранями сверху и снизу. */
export const hexHeight = (size: number = HEX_SIZE) => koeff * size;

/** Переводит axial-координаты в мировые пиксели (позиция центра гекса). */
export const axialToPixel = (
  coord: AxialCoord,
  size: number = HEX_SIZE,
): Point => ({
  x: size * 1.5 * coord.q,
  y: size * koeff * (coord.r + coord.q / 2),
});

/** Углы гекса: первый — правый (плоская грань сверху), дальше по часовой стрелке. */
export const hexCorners = (center: Point, size: number = HEX_SIZE): Point[] => {
  const corners: Point[] = [];

  for (let index = 0; index < 6; index += 1) {
    const angle = (60 * index * Math.PI) / 180;

    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }

  return corners;
};

/** Плоский список координат углов — формат, который ждёт Graphics.poly(). */
export const hexPolygon = (center: Point, size: number = HEX_SIZE): number[] =>
  hexCorners(center, size).reduce<number[]>((acc, corner) => {
    acc.push(corner.x, corner.y);
    return acc;
  }, []);

/**
 * «Приплюснутый» гекс: полуширина и полувысота заданы независимо.
 *
 * Правильный гекс — частный случай (`halfHeight === hexApothem(halfWidth)`). Так описывается
 * зона жаб в комнате: она растянута во всю ширину гекса (100 %), но занимает лишь нижние 60 %
 * его высоты, поэтому по вертикали она ниже правильного гекса.
 */
export interface HexShape {
  center: Point;
  /** Полуширина — от центра до бокового острия (по ±x). */
  halfWidth: number;
  /** Полувысота — от центра до плоской грани (по ±y). */
  halfHeight: number;
}

/** Углы приплюснутого гекса — в том же порядке, что и у `hexCorners`. */
export const shapeCorners = (shape: HexShape): Point[] => {
  const { center, halfWidth, halfHeight } = shape;
  // Правильный гекс полуширины halfWidth имеет полувысоту hexApothem(halfWidth):
  // «сплющиваем» его по вертикали до нужной полувысоты.
  const squash = halfHeight / hexApothem(halfWidth);

  return hexCorners(center, halfWidth).map((corner) => ({
    x: corner.x,
    y: center.y + (corner.y - center.y) * squash,
  }));
};

/** Расстояние между гексами в шагах. */
export const hexDistance = (a: AxialCoord, b: AxialCoord): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;

  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

/** Шесть направлений axial-соседей — обход по часовой стрелке (для flat-top первое — «юго-восток»). */
export const AXIAL_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

/** Ключ координаты для словарей (уникальный id клетки гекс-сетки). */
export const hexCoordKey = (coord: AxialCoord): string =>
  `${coord.q}:${coord.r}`;

/** Соседние гексы (6 сторон комнаты) — они и есть соседние комнаты колонии. */
export const hexNeighbors = (coord: AxialCoord): AxialCoord[] =>
  AXIAL_DIRECTIONS.map((direction) => ({
    q: coord.q + direction.q,
    r: coord.r + direction.r,
  }));

/** Все координаты кольца заданного радиуса (0 — только центр). */
export const hexRing = (radius: number): AxialCoord[] => {
  if (radius <= 0) {
    return [{ q: 0, r: 0 }];
  }

  const coords: AxialCoord[] = [];
  let current: AxialCoord = { q: 0, r: -radius };

  AXIAL_DIRECTIONS.forEach((direction) => {
    for (let step = 0; step < radius; step += 1) {
      coords.push({ ...current });
      current = { q: current.q + direction.q, r: current.r + direction.r };
    }
  });

  return coords;
};

/** Габариты карты с учётом радиусов гексов. */
export const hexMapBounds = (
  coords: AxialCoord[],
  size: number = HEX_SIZE,
  padding = 0,
) => {
  const halfWidth = hexWidth(size) / 2;
  const halfHeight = hexHeight(size) / 2;

  const minX = Math.min(
    ...coords.map((coord) => axialToPixel(coord, size).x - halfWidth),
  );
  const maxX = Math.max(
    ...coords.map((coord) => axialToPixel(coord, size).x + halfWidth),
  );
  const minY = Math.min(
    ...coords.map((coord) => axialToPixel(coord, size).y - halfHeight),
  );
  const maxY = Math.max(
    ...coords.map((coord) => axialToPixel(coord, size).y + halfHeight),
  );

  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    } as Point,
  };
};

/** Точка внутри выпуклого многоугольника (ray casting). */
export const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const { x: xi, y: yi } = polygon[i];
    const { x: xj, y: yj } = polygon[j];

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

/** Точка внутри гекса (локальные координаты относительно центра гекса). */
export const pointInHex = (
  point: Point,
  center: Point,
  size: number = HEX_SIZE,
): boolean => pointInPolygon(point, hexCorners(center, size));

/** Центр выпуклого многоугольника (среднее его углов) — точка, лежащая внутри фигуры. */
export const polygonCenter = (polygon: Point[]): Point => {
  const sum = polygon.reduce<Point>(
    (acc, corner) => ({ x: acc.x + corner.x, y: acc.y + corner.y }),
    { x: 0, y: 0 },
  );

  return { x: sum.x / polygon.length, y: sum.y / polygon.length };
};

/** Насколько точка прижимается внутрь грани, чтобы попадание не зависело от округлений. */
const EDGE_INSET = 0.985;

/**
 * Вписывает точку в выпуклый многоугольник: если она снаружи, сдвигает её по лучу
 * от центра многоугольника до грани. Нужна при переносе жаб — жаба садится туда, где её
 * отпустили, но всегда внутри разрешённой зоны.
 */
export const clampPointInPolygon = (point: Point, polygon: Point[]): Point => {
  const center = polygonCenter(polygon);
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;
  let scale = 1;

  for (let index = 0; index < polygon.length; index += 1) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    const edgeX = to.x - from.x;
    const edgeY = to.y - from.y;
    const edgeLength = Math.hypot(edgeX, edgeY);

    // Нормаль грани, направленная наружу от центра многоугольника
    let normalX = edgeY / edgeLength;
    let normalY = -edgeX / edgeLength;

    if (normalX * (from.x - center.x) + normalY * (from.y - center.y) < 0) {
      normalX = -normalX;
      normalY = -normalY;
    }

    // Грань — прямая normal · p = limit: за ней точка уже выходит из многоугольника
    const limit = normalX * (from.x - center.x) + normalY * (from.y - center.y);
    const along = normalX * offsetX + normalY * offsetY;

    if (along > limit) {
      scale = Math.min(scale, limit / along);
    }
  }

  if (scale >= 1) {
    return { x: point.x, y: point.y };
  }

  return {
    x: center.x + offsetX * scale * EDGE_INSET,
    y: center.y + offsetY * scale * EDGE_INSET,
  };
};

/**
 * Случайная точка внутри выпуклого многоугольника — для «блуждания» жаб по комнате.
 *
 * Берём точку в описанном прямоугольнике и отбрасываем те, что легли за грани:
 * выпуклая фигура занимает не меньше половины такого прямоугольника, поэтому промахов мало.
 */
export const randomPointInPolygon = (polygon: Point[]): Point => {
  const xs = polygon.map((corner) => corner.x);
  const ys = polygon.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const point = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };

    if (pointInPolygon(point, polygon)) {
      return point;
    }
  }

  // 2^-12 — практически невозможно, но жаба не должна «залипнуть» на выходе
  return polygonCenter(polygon);
};

/** Точность, с которой после обрезки сравниваются углы многоугольника. */
const CLIP_EPS = 1e-6;

/** Отрезает от многоугольника всё, что лежит за прямой `normal · p = limit`. */
const clipPolygonByHalfPlane = (
  polygon: Point[],
  normalX: number,
  normalY: number,
  limit: number,
): Point[] => {
  const result: Point[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentDot = normalX * current.x + normalY * current.y;
    const nextDot = normalX * next.x + normalY * next.y;
    // Точки на самой грани (в пределах CLIP_EPS) считаем внутри: иначе угол, лежащий
    // ровно на грани гекса, терялся бы из-за погрешности округлений
    const currentInside = currentDot >= limit - CLIP_EPS;
    const nextInside = nextDot >= limit - CLIP_EPS;

    if (currentInside) {
      result.push(current);
    }

    // Ребро пересекает грани — добавляем точку стыка (currentDot === nextDot
    // сюда не попадёт: тогда обе точки лежат по одну сторону)
    if (currentInside !== nextInside) {
      const t = (limit - currentDot) / (nextDot - currentDot);

      result.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      });
    }
  }

  return result;
};

/**
 * Убирает повторяющиеся углы: когда грань многоугольника ложится ровно на грань гекса,
 * их общая точка попадает в список дважды, а нулевое ребро ломает расчёт нормалей.
 */
const dropRepeatedCorners = (polygon: Point[]): Point[] => {
  const result: Point[] = [];

  polygon.forEach((corner) => {
    const previous = result.length > 0 ? result[result.length - 1] : null;
    const repeated =
      previous !== null &&
      Math.hypot(corner.x - previous.x, corner.y - previous.y) <= CLIP_EPS;

    if (!repeated) {
      result.push(corner);
    }
  });

  // Контур замкнут: первый и последний угол тоже могут совпасть
  if (result.length > 1) {
    const first = result[0];
    const last = result[result.length - 1];

    if (Math.hypot(first.x - last.x, first.y - last.y) <= CLIP_EPS) {
      result.pop();
    }
  }

  return result;
};

/**
 * Пересечение многоугольника с гексом (Сазерленд–Ходжман: режем по каждой грани).
 *
 * Нужно, чтобы зона жаб не вылезала за стены комнаты: просим «гекс во всю ширину»,
 * а получаем ту его часть, что действительно лежит внутри гекса комнаты.
 */
export const clipPolygonByHex = (
  polygon: Point[],
  center: Point,
  size: number = HEX_SIZE,
): Point[] => {
  const corners = hexCorners(center, size);
  let result = polygon;

  for (let index = 0; index < corners.length; index += 1) {
    const from = corners[index];
    const to = corners[(index + 1) % corners.length];

    // Внутренняя нормаль грани: разворачиваем её в сторону центра гекса
    let normalX = to.y - from.y;
    let normalY = -(to.x - from.x);
    const length = Math.hypot(normalX, normalY);

    normalX /= length;
    normalY /= length;

    if (normalX * (center.x - from.x) + normalY * (center.y - from.y) < 0) {
      normalX = -normalX;
      normalY = -normalY;
    }

    // Внутри гекса — точки, для которых normal · p ≥ normal · from
    result = clipPolygonByHalfPlane(
      result,
      normalX,
      normalY,
      normalX * from.x + normalY * from.y,
    );

    if (result.length === 0) {
      return result;
    }
  }

  return dropRepeatedCorners(result);
};
