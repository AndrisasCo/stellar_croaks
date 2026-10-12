import { Application, Container, Graphics, Texture } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { Toad } from "../../models/Toad";
import { ClickButton } from "../shared/ClickButton";
import { preloadTextures } from "../ToadCanvas/utils";
import {
  axialToPixel,
  HEX_SIZE,
  hexPolygon,
  Point,
  pointInHex,
} from "./hex-geometry";
import { getHoneycombCoords } from "./hex-honeycomb";
import {
  DOUBLE_TAP_MS,
  getToadPickRadius,
  isDoubleTap,
  LONG_PRESS_MS,
  TapRecord,
  TAP_SLOP,
} from "./hex-input";
import { createRoomView, RoomView } from "./hex-room";
import { preloadRoomBackgrounds } from "./room-backgrounds";
import {
  clampScale,
  getEdgePanSpeed,
  getMapBounds,
  getZoomLevels,
  isZoomedIn,
  ZoomLevels,
} from "./hex-zoom";
import { createRoomToads, RoomToad, RoomToadFlock } from "./room-toads";
import {
  getRoomRing,
  isBuiltRoom,
  isToadRoom,
  RoomConfig,
  RoomKind,
} from "./rooms-config";
import { ToadMoveCheck } from "./toad-move-rules";

/**
 * Гексагональная карта колонии на PixiJS.
 *
 * Канвас сам управляет панорамой, зумом и попаданиями (hit-test), поэтому не зависит
 * от событий Pixi — так одинаково предсказуемо работает и мышью, и пальцем.
 * Комнаты и жаб создают соседние модули (hex-room, room-toads).
 */

export interface HexMapCanvasProps {
  /** Комнаты карты: базовые плюс всё, что игрок построил (см. resolveColonyRooms). */
  rooms: RoomConfig[];
  /** У построенных комнат — есть ли ток (id комнаты → есть ли ток). */
  poweredRooms: Record<string, boolean>;
  /** Жабы по комнатам: id комнаты → список жаб. */
  toadsByRoom: Record<string, Toad[]>;
  /** Комната, к которой идут жабы (кормление). null — блуждают сами. */
  feedRoomId: string | null;
  onRoomTap: (room: RoomConfig) => void;
  onToadTap: (toad: Toad) => void;
  /**
   * Можно ли перенести жабу в эту комнату (удержание жабы + бросок).
   * Правила живут в toad-move-rules, карта только спрашивает.
   */
  canDropToad: (toad: Toad, room: RoomConfig) => ToadMoveCheck;
  /** Жабу перенесли в другую комнату — менять состояние игры должен родитель. */
  onToadDrop: (toad: Toad, room: RoomConfig) => void;
  /** Перенести нельзя: родитель показывает причину (жаба уже летит назад). */
  onToadRejected?: (toad: Toad, room: RoomConfig, reason?: string) => void;
  /** Жабу взяли в руку — звук и отклик на удержание. */
  onToadPickup?: (toad: Toad) => void;
  /**
   * Сменился вид карты:
   *  - false — обзорный (вся колония, тапы открывают комнаты, двойной тап приближает);
   *  - true  — приближенный (гекс почти во весь экран, жабы кликаются по отдельности).
   */
  onZoomedChange?: (zoomed: boolean) => void;
}

/** Длительность доводки камеры: отдаление при переносе и возврат зума (мс). */
const CAMERA_TWEEN_MS = 280;

/** Состояние переноса: жаба в «руке», её стая, камера и целевая комната. */
interface DragState {
  toad: Toad;
  /** Комната, из которой жабу взяли. */
  roomId: string;
  /** Палец, который несёт жабу: отпускание других пальцев перенос не завершает. */
  pointerId: number;
  flock: RoomToadFlock;
  container: Container;
  /** Смещение центра жабы относительно пальца (мировые пиксели). */
  grab: Point;
  /** Последняя точка пальца (экранные координаты) — жаба держится за неё. */
  local: Point;
  /** Где жаба стояла до переноса — сюда она возвращается при отказе. */
  origin: Point;
  /** Камера до переноса: к ней возвращаемся, если перенос не удался. */
  camera: { scale: number; x: number; y: number };
  /** Комната под пальцем (id) — её же и подсвечиваем. */
  targetRoomId: string | null;
  /** Камера уже отдалилась, чтобы жабу можно было донести до любой комнаты. */
  zoomedOut: boolean;
}

/** Удержание: таймер, после которого жаба «берётся в руку». */
interface LongPressState {
  timer: number;
  toadId: number;
  roomId: string;
  pointerId: number;
  flock: RoomToadFlock;
  /** Последняя точка пальца (экранные координаты). */
  local: Point;
}

/** Плавная доводка камеры (масштаб + сдвиг карты). */
interface CameraTween {
  from: { scale: number; x: number; y: number };
  to: { scale: number; x: number; y: number };
  elapsed: number;
  duration: number;
}

/** Виды камеры до первого расчёта под реальный размер экрана. */
const FALLBACK_ZOOM_LEVELS: ZoomLevels = {
  overview: 1,
  detail: 4,
  threshold: 2,
};

/** Запас тёмной подложки за медовой сеткой: подложка шире габаритов колонии (пиксели). */
const BACKDROP_MARGIN = 600;

/**
 * Фон карты: тёмная подложка + медовая сетка территории колонии.
 *
 * Сетка рисуется только за открытыми гексами: под ними живут комнаты и свободные слоты,
 * и там линия сетки шла рядом с контуром слота — сквозь полупрозрачный пустой слот
 * просвечивали обе, и контур выглядел сдвоенным. Карта растёт фронтом вокруг новых
 * построек, поэтому клетки сетки встают на все гексы, соседние с колонией (`getHoneycombCoords`):
 * сетка обступает колонию по её форме, а не кольцом по радиусу (см. `rebuildRooms`).
 */
const drawBackdrop = (graphics: Graphics, rooms: RoomConfig[]) => {
  const bounds = getMapBounds(rooms);

  graphics.clear();
  graphics
    .rect(
      bounds.minX - BACKDROP_MARGIN,
      bounds.minY - BACKDROP_MARGIN,
      bounds.width + BACKDROP_MARGIN * 2,
      bounds.height + BACKDROP_MARGIN * 2,
    )
    .fill({ color: 0x070c14 });

  getHoneycombCoords(rooms.map((room) => room.coord)).forEach((coord) => {
    graphics
      .poly(hexPolygon(axialToPixel(coord, HEX_SIZE), HEX_SIZE))
      // Сетка — фоновая фактура: комнаты и живой ток должны читаться сильнее неё
      .stroke({ width: 1, color: 0x3f5d7d, alpha: 0.07 });
  });
};

export default function HexMapCanvas(props: HexMapCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [texturesReady, setTexturesReady] = useState(false);
  const appRef = useRef<Application | null>(null);
  const viewsRef = useRef<RoomView[]>([]);
  const flocksRef = useRef<Record<string, RoomToadFlock>>({});
  const texturesRef = useRef<any>(null);
  /** Фоны комнат (фото вольера): приезжают отдельно от спрайтов жаб. */
  const roomBackgroundsRef = useRef<Partial<Record<RoomKind, Texture>>>({});
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const autoFitRef = useRef(true);
  /** Обзорный и приближенный зум под текущий экран. */
  const zoomLevelsRef = useRef<ZoomLevels>(FALLBACK_ZOOM_LEVELS);
  /** Текущий вид — чтобы не дёргать React лишний раз. */
  const zoomedRef = useRef(false);
  const propsRef = useRef(props);
  const controlsRef = useRef({
    zoomTo: (_level: "overview" | "detail") => {},
    reset: () => {},
  });
  /** Пересборка карты (после постройки комнаты — см. resolveColonyRooms). */
  const rebuildRoomsRef = useRef<() => void>(() => {});
  /** Обновление бейджей и наличия тока без пересборки карты. */
  const syncRoomVisualsRef = useRef<() => void>(() => {});
  /** Раздача подгруженных фонов комнатам (после пересборки карты или прихода фото). */
  const applyRoomBackgroundsRef = useRef<() => void>(() => {});
  /** Жаба «в руке»: удержание сработало, палец ведёт жабу по карте. */
  const dragRef = useRef<DragState | null>(null);
  /** Ожидание удержания: таймер, который «берёт жабу в руку». */
  const longPressRef = useRef<LongPressState | null>(null);
  /** Плавная доводка камеры (отдаление при переносе и возврат зума). */
  const cameraTweenRef = useRef<CameraTween | null>(null);
  /**
   * Точки посадки перенесённых жаб (id жабы → мировые координаты).
   * Нужны ровно один раз: чтобы жаба села туда, где её отпустили, а не в случайное место.
   */
  const spawnHintsRef = useRef<Record<number, Point>>({});

  propsRef.current = props;

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let disposed = false;
    let detach = () => {};
    const app = new Application();
    const pointers = new Map<number, Point>();
    const gesture = {
      multi: false,
      moved: 0,
      startPoint: { x: 0, y: 0 } as Point,
      startOffset: { x: 0, y: 0 } as Point,
      pinchDistance: 0,
      pinchScale: 1,
      pinchAnchor: { x: 0, y: 0 } as Point,
    };
    /** Отложенный тап обзорного вида: ждём, не окажется ли он первым из двойного. */
    let pendingTap: number | null = null;
    /** Предыдущий тап — по нему узнаём двойной. */
    let lastTap: TapRecord | null = null;

    const init = async () => {
      await app.init({
        background: 0x070c14,
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });

      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }

      appRef.current = app;
      host.appendChild(app.canvas);
      app.canvas.style.display = "block";
      app.canvas.style.touchAction = "none";

      const world = new Container();
      app.stage.addChild(world);

      // Фон: тёмная подложка + медовая сетка территории колонии.
      // Перерисовывается, когда карта растёт (см. rebuildRooms → drawBackdrop).
      const backdrop = new Graphics();
      drawBackdrop(backdrop, propsRef.current.rooms);
      world.addChild(backdrop);

      /** Сколько гексов было под фоном: по числу видно, что карта выросла. */
      let drawnCount = propsRef.current.rooms.length;

      // Два слоя: комнаты и жабы поверх них. Оба пересобираются, когда игрок
      // строит новую комнату (см. rebuildRooms → resolveColonyRooms).
      const roomsLayer = new Container();
      const toadsLayer = new Container();

      world.addChild(roomsLayer, toadsLayer);

      // Бейджи (число жаб, ток) и наличие тока — без пересборки карты
      const syncRoomVisuals = () => {
        viewsRef.current.forEach((view) => {
          const unpowered =
            isBuiltRoom(view.room) &&
            propsRef.current.poweredRooms[view.room.id] === false;

          view.setPowered(!unpowered);
        });
      };

      /**
       * Фоны комнат (фото вольера): кладём тем комнатам, у которых есть картинка.
       * Вызывается и после пересборки карты, и когда фото только-только приехало —
       * у самой комнаты `setBackground` повторный вызов игнорируется.
       */
      const applyRoomBackgrounds = () => {
        const backgrounds = roomBackgroundsRef.current;

        viewsRef.current.forEach((view) => {
          const texture = backgrounds[view.room.kind];

          if (texture) {
            view.setBackground(texture);
          }
        });
      };

      /** Пересборка карты: снос старых комнат и стай, сборка из props.rooms. */
      const rebuildRooms = () => {
        // Пересборка рвёт стаи: жабу в руке возвращать некуда — просто отпускаем
        cancelDrag(false);
        cancelPendingTap();

        // Карта могла вырасти (или сжаться) — фон подстраиваем под новую форму колонии:
        // у новой постройки открылись соседние гексы, а медовая сетка обступила их венком
        const count = propsRef.current.rooms.length;
        const grown = count > drawnCount;

        drawnCount = count;
        drawBackdrop(backdrop, propsRef.current.rooms);

        roomsLayer
          .removeChildren()
          .forEach((child) => child.destroy({ children: true }));
        Object.values(flocksRef.current).forEach((flock) => {
          toadsLayer.removeChild(flock.layer);
          flock.destroy();
        });
        flocksRef.current = {};

        // Сортировка «дальние кольца ниже» — ядро рисуется поверх остальных комнат
        const views = [...propsRef.current.rooms]
          .sort((a, b) => getRoomRing(b) - getRoomRing(a))
          .map((room) => createRoomView(room, HEX_SIZE));

        views.forEach((view) => roomsLayer.addChild(view.container));
        viewsRef.current = views;

        // Жабы живут в своих комнатах: вольер, гнездо и энергокомнаты
        const textures = texturesRef.current;
        const flocks: Record<string, RoomToadFlock> = {};
        // Жаба, перенесённая прямо перед пересборкой, садится на своё место
        const spawns = takeSpawnHints();

        propsRef.current.rooms.filter(isToadRoom).forEach((room) => {
          const flock = createRoomToads(
            axialToPixel(room.coord, HEX_SIZE),
            HEX_SIZE,
            texturesRef,
          );

          toadsLayer.addChild(flock.layer);

          // Текстуры могут ещё не догрузиться — тогда стаю наполнит синк ниже
          if (textures) {
            flock.sync(propsRef.current.toadsByRoom[room.id] ?? [], spawns);
          }

          flocks[room.id] = flock;
        });

        flocksRef.current = flocks;
        syncRoomVisuals();
        // Комнаты собраны заново — фон (если уже загружен) возвращаем им сразу
        applyRoomBackgrounds();

        // Карта выросла — показываем колонию целиком: это событие игрока («территория
        // расширилась»), поэтому обзор возвращаем даже из приближенного вида. Без роста
        // камеру не трогаем: смотрит обзор — вписываем колонию, приближенный вид не сбиваем.
        if (grown || autoFitRef.current) {
          autoFitRef.current = true;
          fitToView();
        }
      };

      rebuildRoomsRef.current = rebuildRooms;
      syncRoomVisualsRef.current = syncRoomVisuals;
      applyRoomBackgroundsRef.current = applyRoomBackgrounds;

      // Тикер появляется только после app.init — регистрируем игровой цикл здесь
      app.ticker.add((ticker) => {
        updateCameraTween(ticker.deltaMS);
        viewsRef.current.forEach((view) => view.update(ticker.deltaTime));
        Object.values(flocksRef.current).forEach((flock) =>
          flock.update(ticker.deltaTime),
        );
        updateDragFrame(ticker.deltaMS);
      });

      attachListeners();
      setMapReady(true);
    };

    init();

    // Текстуры жаб — тот же набор, что грузит старая сцена с жабами
    preloadTextures().then((textures) => {
      if (disposed) {
        return;
      }

      texturesRef.current = textures;
      setTexturesReady(true);
    });

    // Фоны комнат: пока фото едет, карта уже играбельна — гекс просто остаётся цветным
    preloadRoomBackgrounds().then((backgrounds) => {
      if (disposed) {
        return;
      }

      roomBackgroundsRef.current = backgrounds;
      applyRoomBackgroundsRef.current();
    });

    const applyTransform = () => {
      const world = app.stage.children[0] as Container | undefined;
      const { scale, x, y } = transformRef.current;

      if (!world) {
        return;
      }

      world.scale.set(scale);
      world.position.set(x, y);

      // Вид переключается зумом: обзорный ⇄ приближенный (см. syncZoomLevels)
      const zoomed = isZoomedIn(scale, zoomLevelsRef.current);

      if (zoomed !== zoomedRef.current) {
        zoomedRef.current = zoomed;
        propsRef.current.onZoomedChange?.(zoomed);
      }
    };

    /** Пересчёт обзорного и приближенного зума под текущий размер экрана. */
    const syncZoomLevels = () => {
      zoomLevelsRef.current = getZoomLevels(
        app.screen.width,
        app.screen.height,
        propsRef.current.rooms,
      );
    };

    /** Приближен ли вид настолько, что жабы и хотспоты кликаются по отдельности. */
    const isDetailView = () =>
      isZoomedIn(transformRef.current.scale, zoomLevelsRef.current);

    const screenToWorld = (point: Point): Point => {
      const { scale, x, y } = transformRef.current;

      return { x: (point.x - x) / scale, y: (point.y - y) / scale };
    };

    /** Забирает точки посадки перенесённых жаб: применяются один раз, сразу после синка. */
    const takeSpawnHints = () => {
      const hints = spawnHintsRef.current;

      spawnHintsRef.current = {};

      return hints;
    };

    const lerp = (from: number, to: number, progress: number) =>
      from + (to - from) * progress;

    /**
     * Камера обзорного вида: вся колония целиком.
     * Такая доводка нужна при переносе жабы — иначе до дальних комнат не донести.
     */
    const getOverviewCamera = () => {
      syncZoomLevels();

      const bounds = getMapBounds(propsRef.current.rooms);
      const scale = zoomLevelsRef.current.overview;

      return {
        scale,
        x: app.screen.width / 2 - bounds.center.x * scale,
        y: app.screen.height / 2 - bounds.center.y * scale,
      };
    };

    /** Камера приближенного вида, наведённая на комнату (показать, куда жаба прилетела). */
    const getRoomCamera = (room: RoomConfig) => {
      syncZoomLevels();

      const scale = zoomLevelsRef.current.detail;
      const center = axialToPixel(room.coord, HEX_SIZE);

      return {
        scale,
        x: app.screen.width / 2 - center.x * scale,
        y: app.screen.height / 2 - center.y * scale,
      };
    };

    /** Плавно доводит камеру до нужного вида (отдаление, возврат зума, показ комнаты). */
    const tweenCamera = (
      to: { scale: number; x: number; y: number },
      duration: number = CAMERA_TWEEN_MS,
    ) => {
      cameraTweenRef.current = {
        from: { ...transformRef.current },
        to,
        elapsed: 0,
        duration,
      };
      autoFitRef.current = false;
    };

    /** Кадр анимации камеры — вызывается из тикера. */
    const updateCameraTween = (deltaMS: number) => {
      const tween = cameraTweenRef.current;

      if (!tween) {
        return;
      }

      tween.elapsed = Math.min(tween.duration, tween.elapsed + deltaMS);

      const progress = tween.duration > 0 ? tween.elapsed / tween.duration : 1;
      const eased = 1 - Math.pow(1 - progress, 3);

      transformRef.current = {
        scale: lerp(tween.from.scale, tween.to.scale, eased),
        x: lerp(tween.from.x, tween.to.x, eased),
        y: lerp(tween.from.y, tween.to.y, eased),
      };
      applyTransform();

      if (progress >= 1) {
        cameraTweenRef.current = null;
      }
    };

    /** Зум так, чтобы точка под якорем осталась на месте. */
    const zoomAtScale = (nextScale: number, anchor: Point) => {
      cameraTweenRef.current = null;

      const scale = clampScale(nextScale, zoomLevelsRef.current.detail);
      const worldPoint = screenToWorld(anchor);

      transformRef.current = {
        scale,
        x: anchor.x - worldPoint.x * scale,
        y: anchor.y - worldPoint.y * scale,
      };
      autoFitRef.current = false;
      applyTransform();
    };

    const fitToView = () => {
      cameraTweenRef.current = null;
      transformRef.current = getOverviewCamera();
      applyTransform();
    };

    controlsRef.current = {
      /** Две «ступени» камеры: вся колония или гекс почти во весь экран. */
      zoomTo: (level) => {
        if (level === "overview") {
          autoFitRef.current = true;
          fitToView();
          return;
        }

        zoomAtScale(zoomLevelsRef.current.detail, {
          x: app.screen.width / 2,
          y: app.screen.height / 2,
        });
      },
      reset: () => {
        autoFitRef.current = true;
        fitToView();
      },
    };

    const findRoomAt = (worldPoint: Point) =>
      [...viewsRef.current]
        .sort((a, b) => getRoomRing(a.room) - getRoomRing(b.room))
        .find((view) => pointInHex(worldPoint, view.center, HEX_SIZE)) ?? null;

    /**
     * Ближайшая жаба под точкой (мировые координаты) + id её комнаты.
     *
     * Радиус — её собственный плюс допуск пальца (см. getToadPickRadius): в обзорном
     * виде жабы мелкие, и без этого допуска удержание бы не срабатывало. Если под
     * пальцем сразу несколько жаб, берём ближайшую — так выбор всегда предсказуем.
     */
    const findToadAt = (worldPoint: Point) => {
      const scale = transformRef.current.scale;
      let best: {
        roomId: string;
        flock: RoomToadFlock;
        roomToad: RoomToad;
        distance: number;
      } | null = null;

      for (const [roomId, flock] of Object.entries(flocksRef.current)) {
        for (const roomToad of flock.toads) {
          const dx = roomToad.container.x - worldPoint.x;
          const dy = roomToad.container.y - worldPoint.y;
          const radius = getToadPickRadius(roomToad.hitRadius, scale);

          if (Math.abs(dx) > radius || Math.abs(dy) > radius) {
            continue;
          }

          const distance = Math.hypot(dx, dy);

          if (!best || distance < best.distance) {
            best = { roomId, flock, roomToad, distance };
          }
        }
      }

      if (!best) {
        return null;
      }

      return {
        roomId: best.roomId,
        flock: best.flock,
        roomToad: best.roomToad,
      };
    };

    /** Снимает подсветку со всех комнат и зажигает её у целевой. */
    const setDropTarget = (roomId: string | null, check?: ToadMoveCheck) => {
      viewsRef.current.forEach((view) => {
        if (view.room.id !== roomId) {
          view.setDropTarget(null);
          return;
        }

        view.setDropTarget(check?.ok ? "ok" : "no");
      });
    };

    /** Комната под курсором мыши — единственная «живая» подсветка обзорного вида. */
    let hoveredRoomId: string | null = null;

    const setHoveredRoom = (roomId: string | null) => {
      if (hoveredRoomId === roomId) {
        return;
      }

      hoveredRoomId = roomId;
      viewsRef.current.forEach((view) =>
        view.setHovered(view.room.id === roomId),
      );
    };

    /** Жаба летит домой — перенос не удался или отменён. */
    const flyToadBack = (drag: DragState) =>
      drag.flock.endDrag(drag.toad.id, { target: drag.origin, fly: true });

    /** Возвращает зум, который был до переноса (если камера отдалялась). */
    const restoreCamera = (drag: DragState) => {
      if (drag.zoomedOut) {
        tweenCamera(drag.camera);
      }
    };

    /** Сбрасывает ожидание удержания (палец поехал, второй палец, отпускание). */
    const cancelLongPress = () => {
      const pending = longPressRef.current;

      longPressRef.current = null;

      if (pending) {
        window.clearTimeout(pending.timer);
      }
    };

    /** Отменяет отложенный тап обзорного вида: двойной тап, перенос, пересборка карты. */
    const cancelPendingTap = () => {
      if (pendingTap !== null) {
        window.clearTimeout(pendingTap);
        pendingTap = null;
      }

      lastTap = null;
    };

    /** Удержание сработало: жаба «в руке» и слушается пальца. */
    const beginDrag = (pending: LongPressState) => {
      const roomToad = pending.flock.getToad(pending.toadId);

      if (!roomToad || !pending.flock.beginDrag(pending.toadId)) {
        return;
      }

      // Перенос важнее тапа: отложенное открытие комнаты больше не нужно
      cancelPendingTap();

      const world = screenToWorld(pending.local);

      dragRef.current = {
        toad: roomToad.toad,
        roomId: pending.roomId,
        pointerId: pending.pointerId,
        flock: pending.flock,
        container: roomToad.container,
        // Смещение фиксируем на старте: жаба остаётся под пальцем при любом зуме
        grab: {
          x: roomToad.container.x - world.x,
          y: roomToad.container.y - world.y,
        },
        local: { ...pending.local },
        origin: { x: roomToad.container.x, y: roomToad.container.y },
        camera: { ...transformRef.current },
        targetRoomId: null,
        zoomedOut: false,
      };

      setHoveredRoom(null);
      app.canvas.style.cursor = "grabbing";
      propsRef.current.onToadPickup?.(roomToad.toad);
    };

    /** Палец ведёт жабу: доводим её, проверяем комнату под ней и при нужде отдаляем зум. */
    const updateDrag = (local: Point) => {
      const drag = dragRef.current;

      if (!drag || drag.container.destroyed) {
        return;
      }

      drag.local = { ...local };

      const world = screenToWorld(local);
      const point = { x: world.x + drag.grab.x, y: world.y + drag.grab.y };

      drag.flock.dragTo(drag.toad.id, point);

      // Жаба покинула родной гекс — отдаляем зум, чтобы её было куда донести
      if (!drag.zoomedOut) {
        const source = propsRef.current.rooms.find(
          (room) => room.id === drag.roomId,
        );
        const center = source ? axialToPixel(source.coord, HEX_SIZE) : null;

        if (!center || !pointInHex(point, center, HEX_SIZE * 1.02)) {
          drag.zoomedOut = true;
          tweenCamera(getOverviewCamera());
        }
      }

      const view = findRoomAt(point);
      const room = view && view.room.id !== drag.roomId ? view.room : null;
      const nextRoomId = room?.id ?? null;

      if (nextRoomId !== drag.targetRoomId) {
        drag.targetRoomId = nextRoomId;
        setDropTarget(
          nextRoomId,
          room ? propsRef.current.canDropToad(drag.toad, room) : undefined,
        );
      }
    };

    /** Кадр переноса: автопанорама у края экрана и жаба, которая держится под пальцем. */
    const updateDragFrame = (deltaMS: number) => {
      const drag = dragRef.current;

      if (!drag) {
        return;
      }

      const pan = getEdgePanSpeed(drag.local, app.screen);

      if (pan.x !== 0 || pan.y !== 0) {
        cameraTweenRef.current = null;
        transformRef.current = {
          scale: transformRef.current.scale,
          x: transformRef.current.x + pan.x * deltaMS,
          y: transformRef.current.y + pan.y * deltaMS,
        };
        applyTransform();
      }

      // Позицию пересчитываем каждый кадр: камера отдаляется, но жаба не уезжает от пальца
      updateDrag(drag.local);
    };

    /**
     * Отпустили жабу.
     *
     * Есть подходящая комната — жаба остаётся в ней, а карта показывает её новое
     * место жительства. Комната жабу не принимает — жаба летит назад, а игрок
     * получает причину отказа. Отпустили мимо комнат или в родном гексе — просто
     * возвращаем жабу на место, без уведомлений.
     */
    const finishDrag = () => {
      const drag = dragRef.current;

      if (!drag) {
        return;
      }

      dragRef.current = null;
      setDropTarget(null);
      app.canvas.style.cursor = "grab";

      // Комнату перестроили прямо во время переноса — возвращать некуда
      if (drag.container.destroyed) {
        return;
      }

      const point = { x: drag.container.x, y: drag.container.y };
      const view = findRoomAt(point);
      const room = view && view.room.id !== drag.roomId ? view.room : null;

      if (!room) {
        flyToadBack(drag);
        restoreCamera(drag);
        return;
      }

      const check = propsRef.current.canDropToad(drag.toad, room);

      if (!check.ok) {
        flyToadBack(drag);
        restoreCamera(drag);
        propsRef.current.onToadRejected?.(drag.toad, room, check.reason);
        return;
      }

      // Жаба садится туда, где её отпустили: соседняя стая подхватит её на этом месте
      spawnHintsRef.current[drag.toad.id] = { ...point };
      drag.flock.endDrag(drag.toad.id, { target: point, fly: false });
      propsRef.current.onToadDrop(drag.toad, room);
    };

    /** Отмена переноса: жаба возвращается, но состояние игры не меняется. */
    const cancelDrag = (flyBack = true) => {
      const drag = dragRef.current;

      if (!drag) {
        return;
      }

      dragRef.current = null;
      setDropTarget(null);

      if (flyBack && !drag.container.destroyed) {
        flyToadBack(drag);
      }

      restoreCamera(drag);
    };

    /**
     * Приближение к гексу — двойной тап в обзорном виде.
     * Комната под пальцем встаёт в центр экрана, пустой гекс — просто точка приближения.
     */
    const zoomToDetailAt = (worldPoint: Point, local: Point) => {
      const view = findRoomAt(worldPoint);

      if (view) {
        tweenCamera(getRoomCamera(view.room));
        return;
      }

      zoomAtScale(zoomLevelsRef.current.detail, local);
    };

    /**
     * Тап по карте.
     *
     * Приближенный вид — тап по жабе открывает её карточку, остальное отдаём комнате.
     * Обзорный вид — одиночный тап открывает интерфейс комнаты, двойной приближает к
     * ней. Пока открыто окно двойного тапа, одиночный тап ждёт: иначе первый тап успел
     * бы открыть комнату раньше второго касания.
     */
    const handleTap = (worldPoint: Point, local: Point) => {
      if (isDetailView()) {
        const toadHit = findToadAt(worldPoint);

        if (toadHit) {
          toadHit.flock.react(toadHit.roomToad.toad.id);
          propsRef.current.onToadTap(toadHit.roomToad.toad);
          return;
        }

        const roomView = findRoomAt(worldPoint);

        if (roomView) {
          propsRef.current.onRoomTap(roomView.room);
        }

        return;
      }

      const next: TapRecord = { time: performance.now(), point: { ...local } };

      if (isDoubleTap(lastTap, next)) {
        cancelPendingTap();
        zoomToDetailAt(worldPoint, local);
        return;
      }

      const view = findRoomAt(worldPoint);

      cancelPendingTap();
      lastTap = next;
      pendingTap = window.setTimeout(() => {
        pendingTap = null;
        lastTap = null;

        if (view) {
          propsRef.current.onRoomTap(view.room);
        }
      }, DOUBLE_TAP_MS);
    };

    const attachListeners = () => {
      const canvas = app.canvas;

      const toLocal = (event: { clientX: number; clientY: number }): Point => {
        const rect = canvas.getBoundingClientRect();

        return {
          x: ((event.clientX - rect.left) * app.screen.width) / rect.width,
          y: ((event.clientY - rect.top) * app.screen.height) / rect.height,
        };
      };

      const updateHover = (worldPoint: Point | null) => {
        const view = worldPoint ? findRoomAt(worldPoint) : null;

        setHoveredRoom(view?.room.id ?? null);

        // Жабу можно взять удержанием в любом виде — курсор подсказывает и по ней
        const interactive = Boolean(
          worldPoint && (view?.open || findToadAt(worldPoint)),
        );

        canvas.style.cursor = interactive ? "pointer" : "grab";
      };

      const handlePointerDown = (event: PointerEvent) => {
        // Пока жаба «в руке», новые пальцы игнорируем — перенос важнее панорамы
        if (dragRef.current) {
          return;
        }

        const local = toLocal(event);

        pointers.set(event.pointerId, local);

        if (pointers.size === 1) {
          gesture.multi = false;
          gesture.moved = 0;
          gesture.startPoint = local;
          gesture.startOffset = {
            x: transformRef.current.x,
            y: transformRef.current.y,
          };

          // Долгое удержание жабы берёт её в руку — и в обзорном виде тоже:
          // жабу под пальцем выбирает findToadAt (ближайшая в допуске пальца)
          const hit = findToadAt(screenToWorld(local));

          if (hit) {
            longPressRef.current = {
              toadId: hit.roomToad.toad.id,
              roomId: hit.roomId,
              pointerId: event.pointerId,
              flock: hit.flock,
              local: { ...local },
              timer: window.setTimeout(() => {
                const pending = longPressRef.current;

                longPressRef.current = null;

                if (pending) {
                  beginDrag(pending);
                }
              }, LONG_PRESS_MS),
            };
          }
        } else {
          const [first, second] = [...pointers.values()];
          const mid = {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
          };

          cancelLongPress();
          gesture.multi = true;
          gesture.pinchDistance = Math.hypot(
            first.x - second.x,
            first.y - second.y,
          );
          gesture.pinchScale = transformRef.current.scale;
          gesture.pinchAnchor = screenToWorld(mid);
        }

        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // часть браузеров не даёт захват пальца — панорама всё равно работает
        }
      };

      const handlePointerMove = (event: PointerEvent) => {
        const local = toLocal(event);

        // Жаба «в руке»: палец ведёт её, карта при этом не панорамируется
        if (dragRef.current) {
          updateDrag(local);
          return;
        }

        if (!pointers.has(event.pointerId)) {
          updateHover(screenToWorld(local));
          return;
        }

        pointers.set(event.pointerId, local);

        // Палец ведёт удержание жабы: пока он почти не двигался — просто запоминаем точку
        if (longPressRef.current) {
          longPressRef.current.local = { ...local };
        }

        if (pointers.size >= 2) {
          const [first, second] = [...pointers.values()];
          const mid = {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
          };
          const distance = Math.hypot(first.x - second.x, first.y - second.y);

          if (gesture.pinchDistance > 0) {
            const scale = clampScale(
              gesture.pinchScale * (distance / gesture.pinchDistance),
              zoomLevelsRef.current.detail,
            );

            transformRef.current = {
              scale,
              x: mid.x - gesture.pinchAnchor.x * scale,
              y: mid.y - gesture.pinchAnchor.y * scale,
            };
            autoFitRef.current = false;
            applyTransform();
          }

          return;
        }

        const dx = local.x - gesture.startPoint.x;
        const dy = local.y - gesture.startPoint.y;

        gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));

        if (gesture.moved > TAP_SLOP) {
          // Палец поехал — значит это панорама, а не удержание жабы
          cancelLongPress();

          cameraTweenRef.current = null;
          transformRef.current = {
            scale: transformRef.current.scale,
            x: gesture.startOffset.x + dx,
            y: gesture.startOffset.y + dy,
          };
          autoFitRef.current = false;
          applyTransform();
        }
      };

      const handlePointerUp = (event: PointerEvent) => {
        const local = toLocal(event);
        const isTap =
          pointers.size === 1 && !gesture.multi && gesture.moved <= TAP_SLOP;

        cancelLongPress();
        pointers.delete(event.pointerId);

        if (pointers.size === 0) {
          gesture.multi = false;
          gesture.pinchDistance = 0;
        }

        // Отпустили жабу: она либо остаётся в новой комнате, либо летит назад
        if (dragRef.current) {
          // Жабу несёт конкретный палец — отпускание соседних нас не интересует
          if (dragRef.current.pointerId === event.pointerId) {
            updateDrag(local);
            finishDrag();
          }

          return;
        }

        if (isTap) {
          handleTap(screenToWorld(local), local);
        }
      };

      const handlePointerCancel = (event: PointerEvent) => {
        cancelLongPress();
        pointers.delete(event.pointerId);

        if (pointers.size === 0) {
          gesture.multi = false;
          gesture.pinchDistance = 0;
        }

        // Жест прервала система — жабу безопаснее вернуть на место
        if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
          cancelDrag();
        }
      };

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        zoomAtScale(
          transformRef.current.scale * Math.exp(-event.deltaY * 0.0014),
          toLocal(event),
        );
      };

      const handlePointerLeave = () => updateHover(null);

      // Долгое удержание не должно открывать контекстное меню и меню браузера
      const handleContextMenu = (event: Event) => event.preventDefault();

      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("pointercancel", handlePointerCancel);
      canvas.addEventListener("pointerleave", handlePointerLeave);
      canvas.addEventListener("contextmenu", handleContextMenu);
      canvas.addEventListener("wheel", handleWheel, { passive: false });

      detach = () => {
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointermove", handlePointerMove);
        canvas.removeEventListener("pointerup", handlePointerUp);
        canvas.removeEventListener("pointercancel", handlePointerCancel);
        canvas.removeEventListener("pointerleave", handlePointerLeave);
        canvas.removeEventListener("contextmenu", handleContextMenu);
        canvas.removeEventListener("wheel", handleWheel);
      };

      canvas.style.cursor = "grab";
      // Удержание жабы не должно выделять страницу и вызывать системное меню
      canvas.style.setProperty("-webkit-user-select", "none");
      canvas.style.setProperty("user-select", "none");
      canvas.style.setProperty("-webkit-touch-callout", "none");
      // Все жесты (панорама, щипок, удержание) обрабатывает игра: браузер не должен
      // перехватывать их зумом/скроллом страницы (второй раз — на случай, если
      // канвас пересоздали и inline-стиль потерялся)
      canvas.style.setProperty("touch-action", "none");
      canvas.style.setProperty("overscroll-behavior", "none");
      fitToView();
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!appRef.current) {
        return;
      }

      appRef.current.resize();
      syncZoomLevels();

      if (autoFitRef.current) {
        fitToView();
      }
    });

    resizeObserver.observe(host);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      detach();
      cancelLongPress();
      cancelPendingTap();
      dragRef.current = null;
      cameraTweenRef.current = null;
      Object.values(flocksRef.current).forEach((flock) => flock.destroy());
      flocksRef.current = {};
      viewsRef.current = [];
      controlsRef.current = { zoomTo: () => {}, reset: () => {} };
      rebuildRoomsRef.current = () => {};
      syncRoomVisualsRef.current = () => {};
      applyRoomBackgroundsRef.current = () => {};

      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }

      setMapReady(false);
      setTexturesReady(false);
    };
  }, []);

  /** Подпись набора комнат: пересборка карты нужна только когда карта меняется. */
  const roomsKey = props.rooms
    .map((room) => `${room.id}:${room.kind}`)
    .join("|");

  // Постройка новой комнаты (или снос) меняет карту — собираем её заново
  useEffect(() => {
    if (!mapReady) {
      return;
    }

    rebuildRoomsRef.current();
  }, [mapReady, roomsKey]);

  // Ток в комнатах — без пересборки карты
  useEffect(() => {
    if (!mapReady) {
      return;
    }

    syncRoomVisualsRef.current();
  }, [mapReady, props.poweredRooms]);

  // Синхронизация жаб по комнатам — только когда текстуры уже загружены
  useEffect(() => {
    if (!mapReady || !texturesReady) {
      return;
    }

    // Точки посадки перенесённых жаб: нужны ровно на этот проход (см. finishDrag)
    const spawns = spawnHintsRef.current;

    spawnHintsRef.current = {};

    Object.entries(flocksRef.current).forEach(([roomId, flock]) => {
      flock.sync(props.toadsByRoom[roomId] ?? [], spawns);
    });
  }, [mapReady, texturesReady, props.toadsByRoom]);

  // Во время кормления жабы идут к кормушке вольера
  useEffect(() => {
    if (!mapReady) {
      return;
    }

    Object.entries(flocksRef.current).forEach(([roomId, flock]) => {
      if (roomId !== props.feedRoomId) {
        flock.setAttractor(null);
        return;
      }

      const view = viewsRef.current.find((item) => item.room.id === roomId);

      // Жабы идут к центру кормушки: отдельного хотспота в комнате больше нет
      flock.setAttractor(view?.center ?? null);
    });
  }, [mapReady, props.feedRoomId, roomsKey]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full overflow-hidden" />

      {/* Управление камерой: две ступени — вся колония и приближенный вид на гекс */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2">
        <ClickButton
          title="Приблизить к гексу (жабы кликаются)"
          onClick={() => controlsRef.current.zoomTo("detail")}
          className="bg-slate-800/70 border-2 border-cyan-300/70 text-cyan-100 rounded-lg w-10 h-10 text-xl font-bold backdrop-blur-sm active:scale-95 transition-transform"
        >
          +
        </ClickButton>
        <ClickButton
          title="Обзорный вид (вся колония)"
          onClick={() => controlsRef.current.zoomTo("overview")}
          className="bg-slate-800/70 border-2 border-cyan-300/70 text-cyan-100 rounded-lg w-10 h-10 text-xl font-bold backdrop-blur-sm active:scale-95 transition-transform"
        >
          −
        </ClickButton>
        <ClickButton
          title="Показать всю колонию"
          onClick={() => controlsRef.current.reset()}
          className="bg-slate-800/70 border-2 border-cyan-300/70 text-cyan-100 rounded-lg w-10 h-10 text-base backdrop-blur-sm active:scale-95 transition-transform"
        >
          ⌖
        </ClickButton>
      </div>
    </div>
  );
}
