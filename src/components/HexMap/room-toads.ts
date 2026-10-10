import { Container, Sprite, Texture } from "pixi.js";
import {
  clampPointInPolygon,
  Point,
  randomPointInPolygon,
} from "./hex-geometry";
import { Toad } from "../../models/Toad";
import { getTextureByType } from "../ToadCanvas/utils";
import { updateToadAppearance } from "../ToadCanvas/update-toad";
import { isToadVisibleInRoom } from "./rooms-config";
import {
  ATTRACTOR_SPREAD_X,
  ATTRACTOR_SPREAD_Y,
  DRAG_LIFT,
  FLY_SPEED,
  getToadArea,
  getToadAreaHalfHeight,
  getToadAreaHalfWidth,
  getToadHitRadius,
  getToadScale,
} from "./room-toads-layout";

/**
 * Жабы, живущие внутри гексагональной комнаты.
 *
 * Из старой сцены (ToadCanvas) переиспользуется всё, что касается самих жаб:
 * текстуры (preloadTextures/getTextureByType), анимация (updateToadAppearance)
 * и «характер» (скорость из генов, сон/блуждание, прыжок при тапе).
 * Само движение переписано: жабы не разбредаются по экрану, а держатся внутри зоны жаб —
 * приплюснутого гекса во всю ширину комнаты, прижатого к её низу и обрезанного по стенам
 * (см. `room-toads-layout.ts`).
 */

/** Амплитуда прыжка (в «условных» единицах bounce, как в update-toad). */
const HOP_AMPLITUDE = 6;

export interface RoomBounds {
  /** Центр гекса комнаты. */
  center: Point;
  /** Зона жаб — многоугольник в нижней части комнаты, куда пускают жаб. */
  area: Point[];
  /** Радиус гекса комнаты — нужен для адаптивного размера жаб. */
  hexSize: number;
}

export interface RoomToad {
  toad: Toad;
  container: Container;
  /** Радиус попадания для тапа (мировые координаты). */
  hitRadius: number;
}

export interface RoomToadFlock {
  /** Слой с жабами — добавляется на карту поверх комнат. */
  layer: Container;
  toads: RoomToad[];
  /** Полная синхронизация со списком жаб вольера/гнезда/комнаты ⚡/«Разведки». */
  sync: (toads: Toad[], spawns?: Record<number, Point>) => void;
  /** Точка притяжения (кормушка во время кормления). null — блуждают сами. */
  setAttractor: (point: Point | null) => void;
  /** Реакция на тап: жаба подпрыгивает. */
  react: (toadId: number) => void;
  /** Жаба в этой комнате (нужна карте, чтобы взять её в руку). */
  getToad: (toadId: number) => RoomToad | undefined;
  /** Взяли жабу в руку: блуждание останавливается, жаба «подрастает». */
  beginDrag: (toadId: number) => boolean;
  /** Ведём жабу за пальцем (мировые координаты). */
  dragTo: (toadId: number, point: Point) => void;
  /** Отпустили жабу: остаётся на месте либо летит в target. */
  endDrag: (toadId: number, options: { target: Point; fly: boolean }) => void;
  update: (deltaTime: number) => void;
  destroy: () => void;
}

interface ToadState {
  toad: Toad;
  animationProgress: number;
  state: "idle" | "walking" | "jumping" | "dragging" | "flying";
  stateTimer: number;
  hopPhase: number;
  target: Point;
  speed: number;
  /** Масштаб жабы внутри комнаты (крупные уменьшаются). */
  scale: number;
  needsRedraw: boolean;
  lastState: string;
  lastBounce: number;
}

/** updateToadAppearance читает прогресс анимации из userData, которого нет в типах Pixi v8. */
type ToadContainer = Container & { userData: ToadState };

const createState = (toad: Toad, spawn: Point, hexSize: number): ToadState => ({
  toad,
  animationProgress: 0,
  state: "idle",
  stateTimer: 30 + Math.random() * 150,
  hopPhase: Math.random() * Math.PI * 2,
  target: { ...spawn },
  // Скорость из генов, но в масштабе комнаты (а не всего экрана)
  speed: Math.max(0.18, (toad.genes.speed * toad.genes.weight) / 22 / 8),
  scale: getToadScale(toad.genes.weight, hexSize),
  needsRedraw: true,
  lastState: "",
  lastBounce: -1,
});

const createToad = (
  toad: Toad,
  state: ToadState,
  bounds: RoomBounds,
  texturesRef: { current: any },
  spawn: Point,
): RoomToad => {
  const isToadpole = toad.stage === "toadpole";
  const textures = isToadpole
    ? texturesRef.current?.toadpoleTextures
    : getTextureByType(texturesRef, toad.type);

  const container = new Container() as ToadContainer;
  const sprite = new Sprite(textures?.[0] ?? Texture.WHITE);

  sprite.anchor.set(0.5);
  container.addChild(sprite);

  container.position.set(spawn.x, spawn.y);
  container.scale.set(
    state.scale * (Math.random() > 0.5 ? -1 : 1),
    state.scale,
  );
  // updateToadAppearance хранит прогресс анимации в userData контейнера
  container.userData = state;

  updateToadAppearance(container, toad, state.state, 0)(texturesRef);

  return {
    toad,
    container,
    hitRadius: getToadHitRadius(toad.genes.weight, bounds.hexSize),
  };
};

export const createRoomToads = (
  center: Point,
  hexSize: number,
  texturesRef: { current: any },
): RoomToadFlock => {
  const bounds: RoomBounds = {
    center,
    area: getToadArea(center, hexSize),
    hexSize,
  };
  const layer = new Container();
  const states = new Map<number, ToadState>();
  let toads: RoomToad[] = [];
  let attractor: Point | null = null;

  /**
   * Порядок перекрытия жаб: кто ниже на карте (ближе к зрителю) — тот рисуется поверх.
   *
   * Глубину задаём через `zIndex`, а не перестановкой `layer.children` вручную: структура
   * render-группы в Pixi v8 кэшируется, и прямой `children.sort()` до рендера не долетает
   * (RenderGroupSystem пересобирает детей только по флагу `structureDidChange`, который
   * выставляет сеттер `zIndex`). `sortableChildren` заставляет Pixi пересортировать слой
   * перед отрисовкой: последним рисуется ребёнок с наибольшей глубиной.
   */
  layer.sortableChildren = true;

  /**
   * Низ жабы в координатах слоя: спрайт центрирован (anchor 0.5), поэтому низ —
   * это позиция жабы плюс половина её видимой высоты (крупные жабы перекрывают мелких).
   */
  const getDepth = (roomToad: RoomToad) => {
    const { container } = roomToad;
    const sprite = container.getChildAt(0) as Sprite | undefined;
    const halfHeight =
      ((sprite?.height ?? 0) / 2) * Math.abs(container.scale.y);

    return container.y + halfHeight;
  };

  const sortByDepth = () => {
    toads.forEach((roomToad) => {
      roomToad.container.zIndex = getDepth(roomToad);
    });
  };

  const sync = (nextToads: Toad[], spawns?: Record<number, Point>) => {
    // Ушедшие в поход жабы в комнате не сидят (место они освобождают): спрайт не рисуем
    nextToads = nextToads.filter(isToadVisibleInRoom);

    const nextIds = new Set(nextToads.map((toad) => toad.id));

    toads.forEach((roomToad) => {
      if (!nextIds.has(roomToad.toad.id)) {
        layer.removeChild(roomToad.container);
        roomToad.container.destroy({ children: true });
        states.delete(roomToad.toad.id);
      }
    });

    toads = toads.filter((roomToad) => nextIds.has(roomToad.toad.id));

    const aliveIds = new Set(toads.map((roomToad) => roomToad.toad.id));
    const knownIds = new Set(states.keys());

    nextToads.forEach((toad) => {
      if (!aliveIds.has(toad.id) || !knownIds.has(toad.id)) {
        // Перенесённая жаба садится туда, где её отпустили (spawn «из руки»)
        const spawn = clampPointInPolygon(
          spawns?.[toad.id] ?? randomPointInPolygon(bounds.area),
          bounds.area,
        );
        const state = createState(toad, spawn, bounds.hexSize);
        const roomToad = createToad(toad, state, bounds, texturesRef, spawn);

        states.set(toad.id, state);
        toads.push(roomToad);
        layer.addChild(roomToad.container);
        return;
      }

      // Жаба уже живёт в комнате — обновляем данные и внешний вид при смене стадии
      const state = states.get(toad.id)!;
      const changed =
        state.toad.stage !== toad.stage ||
        state.toad.type !== toad.type ||
        state.toad.genes.colors[0] !== toad.genes.colors[0];

      state.toad = toad;

      if (changed) {
        state.needsRedraw = true;
      }
    });

    sortByDepth();
  };

  /** Случайное место рядом с кормушкой: жабы собираются вокруг неё широким пятном. */
  const pointNearAttractor = (point: Point) =>
    clampPointInPolygon(
      {
        x:
          point.x +
          (Math.random() - 0.5) *
            getToadAreaHalfWidth(bounds.hexSize) *
            ATTRACTOR_SPREAD_X,
        y:
          point.y +
          (Math.random() - 0.5) *
            getToadAreaHalfHeight(bounds.hexSize) *
            ATTRACTOR_SPREAD_Y,
      },
      bounds.area,
    );

  const setAttractor = (point: Point | null) => {
    attractor = point;

    if (!point) {
      return;
    }

    states.forEach((state) => {
      state.target = pointNearAttractor(point);
      state.state = "walking";
    });
  };

  const react = (toadId: number) => {
    const state = states.get(toadId);

    if (!state || state.state === "jumping" || state.state === "dragging") {
      return;
    }

    state.state = "jumping";
    state.hopPhase = 0;
    state.needsRedraw = true;
  };

  /** Жаба этой комнаты по id — карта берёт её в руку при удержании. */
  const getToad = (toadId: number) =>
    toads.find((roomToad) => roomToad.toad.id === toadId);

  /** Взяли жабу в руку: она перестаёт блуждать и слегка подрастает. */
  const beginDrag = (toadId: number) => {
    const state = states.get(toadId);
    const roomToad = getToad(toadId);

    if (!state || !roomToad) {
      return false;
    }

    state.state = "dragging";
    state.hopPhase = 0;
    state.needsRedraw = true;
    roomToad.container.scale.set(
      (roomToad.container.scale.x < 0 ? -1 : 1) * state.scale * DRAG_LIFT,
      state.scale * DRAG_LIFT,
    );

    return true;
  };

  /** Ведём жабу за пальцем: она поворачивается в сторону движения. */
  const dragTo = (toadId: number, point: Point) => {
    const state = states.get(toadId);
    const roomToad = getToad(toadId);

    if (!state || !roomToad) {
      return;
    }

    const { container } = roomToad;

    if (Math.abs(point.x - container.x) > 0.5) {
      container.scale.x =
        Math.abs(container.scale.x) * (point.x > container.x ? -1 : 1);
    }

    container.position.set(point.x, point.y);
  };

  /** Отпустили жабу: остаётся там, где её отпустили, либо летит к target. */
  const endDrag = (
    toadId: number,
    options: { target: Point; fly: boolean },
  ) => {
    const state = states.get(toadId);
    const roomToad = getToad(toadId);

    if (!state || !roomToad) {
      return;
    }

    const { container } = roomToad;

    // «В руке» жаба была крупнее — возвращаем её обычный размер
    container.scale.set(
      (container.scale.x < 0 ? -1 : 1) * state.scale,
      state.scale,
    );

    state.state = options.fly ? "flying" : "idle";
    // Куда бы жабу ни посадили, место всегда внутри зоны жаб
    state.target = clampPointInPolygon(options.target, bounds.area);
    state.hopPhase = 0;
    state.needsRedraw = true;

    if (!options.fly) {
      // Села на место — пусть посидит, прежде чем снова пойти гулять
      state.stateTimer = 60 + Math.random() * 60;
    }
  };

  const update = (deltaTime: number) => {
    toads.forEach((roomToad) => {
      const state = states.get(roomToad.toad.id);

      if (!state) {
        return;
      }

      const { container } = roomToad;

      // Жабу ведёт палец: позицию задаёт карта (dragTo), здесь — только прыжки
      if (state.state === "dragging") {
        // state.hopPhase += deltaTime * 0.3;

        const dragged =
          Math.abs(Math.sin(state.hopPhase)) * HOP_AMPLITUDE * 1.1;

        updateToadAppearance(
          container,
          state.toad,
          "idle",
          dragged,
        )(texturesRef);
        state.lastState = state.state;
        state.lastBounce = dragged;
        state.needsRedraw = false;
        return;
      }

      // Жаба летит: домой (перенос не удался) или на место посадки
      if (state.state === "flying") {
        const dx = state.target.x - container.x;
        const dy = state.target.y - container.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 2) {
          state.state = "idle";
          state.stateTimer = 60 + Math.random() * 90;
          state.hopPhase = 0;
        } else {
          const step = Math.min(FLY_SPEED * deltaTime, distance);

          container.x += (dx / distance) * step;
          container.y += (dy / distance) * step;

          if (Math.abs(dx) > 0.4) {
            container.scale.x = (dx > 0 ? -1 : 1) * state.scale;
          }

          state.hopPhase += deltaTime * 0.34;
        }

        const flying = Math.abs(Math.sin(state.hopPhase)) * HOP_AMPLITUDE * 1.6;

        updateToadAppearance(
          container,
          state.toad,
          "jumping",
          flying,
        )(texturesRef);
        state.lastState = state.state;
        state.lastBounce = flying;
        state.needsRedraw = false;
        return;
      }

      if (state.state === "jumping") {
        state.hopPhase += deltaTime * 0.22;

        if (state.hopPhase >= Math.PI) {
          state.state = "idle";
          state.stateTimer = 40 + Math.random() * 90;
          state.hopPhase = 0;
        }
      } else if (state.state === "walking") {
        const dx = state.target.x - container.x;
        const dy = state.target.y - container.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 1.5) {
          state.state = "idle";
          state.stateTimer = 50 + Math.random() * 200;
          state.hopPhase = 0;
        } else {
          const step = Math.min(state.speed * deltaTime, distance);

          container.x += (dx / distance) * step;
          container.y += (dy / distance) * step;

          if (Math.abs(dx) > 0.4) {
            container.scale.x = (dx > 0 ? -1 : 1) * state.scale;
          }

          state.hopPhase += deltaTime * 0.18;
        }
      } else {
        state.stateTimer -= deltaTime;

        if (state.stateTimer <= 0) {
          if (!attractor && Math.random() < 0.25) {
            // Ленивая жаба просто ещё посидит
            state.stateTimer = 60 + Math.random() * 160;
          } else {
            state.state = "walking";
            state.target = attractor
              ? pointNearAttractor(attractor)
              : randomPointInPolygon(bounds.area);
          }
        }
      }

      const bounce =
        state.state === "jumping"
          ? Math.abs(Math.sin(state.hopPhase)) * HOP_AMPLITUDE
          : state.state === "walking"
            ? Math.abs(Math.sin(state.hopPhase)) * HOP_AMPLITUDE * 0.6
            : 0;

      const stateChanged = state.state !== state.lastState;
      const bounceChanged = Math.abs(bounce - state.lastBounce) > 0.05;

      if (
        stateChanged ||
        bounceChanged ||
        state.state === "walking" ||
        state.needsRedraw
      ) {
        updateToadAppearance(
          container,
          state.toad,
          state.state,
          bounce,
        )(texturesRef);
        state.lastState = state.state;
        state.lastBounce = bounce;
        state.needsRedraw = false;
      }
    });

    sortByDepth();
  };

  const destroy = () => {
    layer.removeChildren().forEach((child) => {
      child.destroy({ children: true });
    });
    states.clear();
    toads = [];
  };

  return {
    layer,
    get toads() {
      return toads;
    },
    sync,
    setAttractor,
    react,
    getToad,
    beginDrag,
    dragTo,
    endDrag,
    update,
    destroy,
  };
};
