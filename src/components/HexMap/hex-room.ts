import { Container, Graphics, Sprite, Texture } from "pixi.js";
import {
  axialToPixel,
  hexCorners,
  hexHeight,
  hexPolygon,
  hexWidth,
  HEX_SIZE,
  Point,
} from "./hex-geometry";
import {
  getRoomRing,
  isBuiltRoom,
  isRoomOpen,
  RoomConfig,
} from "./rooms-config";

/**
 * Отрисовка одной комнаты на гексагональной карте (Pixi).
 *
 * Комната — это только цветной гекс: палитра кодирует тип, тусклость — отсутствие
 * тока, пульс ядра — «жизнь». Иконок, подписей и хотспотов на гексах нет: в середине
 * комнаты живут сами жабы, а действия комнаты открываются её модалкой.
 *
 * У комнаты может быть фото (пока — у вольера, см. `room-backgrounds.ts`): оно вписано
 * в гекс и занимает место цветной заливки — тип комнаты читается по обводке палитры.
 */

/** Подсветка комнаты при переносе жабы: примет · не примет · нет подсветки. */
export type RoomDropTarget = "ok" | "no" | null;

export interface RoomView {
  room: RoomConfig;
  center: Point;
  container: Container;
  open: boolean;
  /** Есть ли в комнате ток: обесточенная комната тускнеет — цвет и есть сигнал. */
  setPowered: (powered: boolean) => void;
  setHovered: (hovered: boolean) => void;
  /** Подсветка при переносе жабы: зелёный гекс — примет, красный — нет. */
  setDropTarget: (target: RoomDropTarget) => void;
  /** Фото комнаты вместо цветной заливки; текстура приезжает асинхронно и ровно один раз. */
  setBackground: (texture: Texture) => void;
  /** Анимация «жизни» комнаты (пульс ядра). */
  update: (deltaTime: number) => void;
}

/** Пунктирный контур гекса — им обведён пустой слот: сплошная обводка слоту не рисуется. */
const drawDashedHex = (
  graphics: Graphics,
  size: number,
  color: number,
  alpha: number,
  width: number,
  dashLength = 3,
  gapLength = 3,
) => {
  const corners = hexCorners({ x: 0, y: 0 }, size);

  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % corners.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const step = dashLength + gapLength;
    const segments = Math.floor(length / step);

    for (let segment = 0; segment < segments; segment += 1) {
      const from = (segment * step) / length;
      const to = (segment * step + dashLength) / length;

      graphics
        .moveTo(
          start.x + (end.x - start.x) * from,
          start.y + (end.y - start.y) * from,
        )
        .lineTo(
          start.x + (end.x - start.x) * to,
          start.y + (end.y - start.y) * to,
        );
    }
  }

  graphics.stroke({ width, color, alpha });
};

export const createRoomView = (
  room: RoomConfig,
  size: number = HEX_SIZE,
): RoomView => {
  const center = axialToPixel(room.coord, size);
  const ring = getRoomRing(room);
  const open = isRoomOpen(room);
  const container = new Container();

  container.position.set(center.x, center.y);

  const hexPoints = hexPolygon({ x: 0, y: 0 }, size);
  // Дальние кольца бледнее, но построенная комната всегда выглядит «живой»
  const dimFactor = ring >= 2 && !open ? 0.45 : 1;

  // 2. Тело комнаты: заливка, светлая сердцевина, обводка
  const body = new Graphics();

  let hasBackground = false;

  const drawBody = () => {
    body.clear();

    // С фото заливок нет вовсе: кадр и есть комната, а её тип читается по обводке
    if (!hasBackground) {
      body.poly(hexPoints).fill({
        color: room.palette.face,
        alpha: dimFactor,
      });

      if (open) {
        body.poly(hexPolygon({ x: 0, y: -size * 0.04 }, size * 0.84)).fill({
          color: room.palette.inner,
          alpha: 0.8,
        });
      }
    }

    // Обводка гекса: построенная комната обведена сплошной линией по своему контуру, пустой
    // слот — только пунктиром по тому же контуру. Сплошную обводку слоту не рисуем: вместе с
    // пунктиром она читалась как сдвоенный контур (см. §10 в GAME_DESIGN_IMPLEMENTED.md).
    if (isBuiltRoom(room)) {
      // body
      // .poly(hexPoints)
      // .stroke({ width: 2, color: room.palette.edge, alpha: 0.95 });
    } else {
      drawDashedHex(
        body,
        size,
        room.palette.edge,
        ring >= 2 ? 0.45 : 0.8,
        ring >= 2 ? 1.5 : 2.5,
      );
    }
  };

  drawBody();
  container.addChild(body);

  // 3. Пульс ядра и подсветка наведения — отдельный слой, чтобы не перерисовывать гекс
  const glow = new Graphics();
  glow
    .poly(hexPolygon({ x: 0, y: 0 }, size * 0.99))
    .stroke({ width: 1, color: room.palette.glow, alpha: 0.9 });
  glow.alpha = 0;
  container.addChild(glow);

  // 4. Обесточенная комната гаснет тёмной плёнкой: цвет и есть весь «значок»
  const outage = new Container();
  const outageShade = new Graphics();

  outageShade.poly(hexPoints).fill({ color: 0x02040a, alpha: 0.62 });

  outage.addChild(outageShade);
  outage.visible = false;
  container.addChild(outage);

  let powered = true;

  const setPowered = (next: boolean) => {
    if (powered === next) {
      return;
    }

    powered = next;
    outage.visible = !next;
    // Обесточенная комната теряет цвет, но остаётся на карте
    body.alpha = next ? 1 : 0.55;
  };

  // 5. Подсветка при переносе жабы: зелёная — жабу примут, красная — нет
  const dropRing = new Graphics();

  dropRing.poly(hexPoints).fill({ color: 0xffffff, alpha: 0.1 });
  dropRing.visible = false;
  container.addChild(dropRing);

  let dropTarget: RoomDropTarget = null;
  let dropPulse = 0;

  const setDropTarget = (next: RoomDropTarget) => {
    if (dropTarget === next) {
      return;
    }

    dropTarget = next;
    dropRing.visible = next !== null;
    dropRing.alpha = 1;

    if (next === null) {
      return;
    }

    dropRing
      .clear()
      .poly(hexPoints)
      .fill({ color: next === "ok" ? 0x34d399 : 0xf87171, alpha: 0.16 })
      .stroke({
        width: 4,
        color: next === "ok" ? 0x34d399 : 0xf87171,
        alpha: 0.95,
      });
  };

  const setHovered = (hovered: boolean) => {
    glow.alpha = hovered ? 1 : 0;
  };

  // 6. Фото комнаты: кадр вместо цветной заливки, поверх него — обводка, пульс и подсветки
  let background: Sprite | null = null;

  const setBackground = (texture: Texture) => {
    // Фото приезжает асинхронно и может приехать второй раз (пересборка карты) — кладём один раз
    if (background || !texture) {
      return;
    }

    const sprite = new Sprite(texture);
    const mask = new Graphics().poly(hexPoints).fill(0x000000);

    sprite.anchor.set(0.5);
    sprite.scale.set(
      hexWidth(size) / texture.width,
      hexHeight(size) / texture.height,
    );
    sprite.mask = mask;

    hasBackground = true;

    // Фото — сразу над тенью: обводка, пульс, обесточка и подсветка переноса остаются поверх
    container.addChildAt(mask, 1);
    container.addChildAt(sprite, 2);
    // Гекс под фото больше не заливается цветом: кадр и есть комната
    drawBody();

    background = sprite;
  };

  // Пульс ядра — карта не выглядит статичной, даже когда жабы спят
  let pulse = 0;
  let pulseAlpha = 0;

  const update = (deltaTime: number) => {
    // Подсвеченная комната «дышит» — видно, куда жаба прилетит
    if (dropTarget) {
      dropPulse += deltaTime * 0.09;
      dropRing.alpha = 0.72 + Math.abs(Math.sin(dropPulse)) * 0.28;
    }

    if (room.kind !== "core") {
      return;
    }

    // pulse += deltaTime * 0.02;
    // pulseAlpha = 0.25 + Math.abs(Math.sin(pulse)) * 0.35;
    // glow.alpha = Math.max(glow.alpha, pulseAlpha);
  };

  return {
    room,
    center,
    container,
    open,
    setPowered,
    setHovered,
    setDropTarget,
    setBackground,
    update,
  };
};
