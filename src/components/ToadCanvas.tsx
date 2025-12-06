import { useEffect, useRef, useState } from "react";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  AlphaFilter,
  BlurFilter,
  FillGradient,
  ContainerChild,
  Rectangle,
} from "pixi.js";
import type { Toad } from "../models/toad";
import { getWindowDimensions, getSceneSettings } from "../utils/ui";
import { useSoundEffects } from "../hooks/use-sound-effects";
import { useToads } from "./ToadContext";
import { GRADIENTS } from "../models/scene";
import { useGameState } from "../hooks/use-game-state";

type ContainerChildCustom = ContainerChild & { userData?: any };

// Константы для анимации
const TOAD_FRAMES_COUNT = 4; // Количество кадров анимации жабы
const TOADPOLE_FRAMES_COUNT = 4; // Количество кадров анимации головастика
const ANIMATION_SPEED = 0.06; // Базовая скорость анимации

// Предзагружаем текстуры и создаем текстуры для анимации один раз
const preloadTextures = async () => {
  try {
    const [
      toadSpriteSheet,
      eyeOpenTexture,
      eyeClosedTexture,
      toadpoleSpriteSheet,
      foodTexture,
    ] = await Promise.all([
      Assets.load("/assets/toad-move.svg"),
      Assets.load("/assets/eye.png"),
      Assets.load("/assets/eye-closed.png"),
      Assets.load("/assets/toadpole.svg"),
      Assets.load("/assets/apple.png"),
    ]);

    // Создаем массивы текстур один раз для жабы
    const toadTextures: Texture[] = [];
    const toadFrameWidth = toadSpriteSheet.width / TOAD_FRAMES_COUNT;

    for (let i = 0; i < TOAD_FRAMES_COUNT; i++) {
      const texture = new Texture({
        source: toadSpriteSheet.source,
        frame: {
          x: i * toadFrameWidth,
          y: 0,
          width: toadFrameWidth - 1,
          height: toadSpriteSheet.height,
        },
      });
      toadTextures.push(texture);
    }

    // Создаем массивы текстур один раз для головастика
    const toadpoleTextures: Texture[] = [];
    const toadpoleFrameWidth =
      toadpoleSpriteSheet.width / TOADPOLE_FRAMES_COUNT;

    for (let i = 0; i < TOADPOLE_FRAMES_COUNT; i++) {
      const texture = new Texture({
        source: toadpoleSpriteSheet.source,
        frame: {
          x: i * toadpoleFrameWidth,
          y: 0,
          width: toadpoleFrameWidth - 2,
          height: toadpoleSpriteSheet.height,
        },
      });
      toadpoleTextures.push(texture);
    }

    return {
      toadSpriteSheet,
      eyeOpenTexture,
      eyeClosedTexture,
      toadpoleSpriteSheet,
      foodTexture,
      toadTextures, // Готовый массив текстур для жабы
      toadpoleTextures, // Готовый массив текстур для головастика
    };
  } catch (error) {
    console.warn("Some textures not found, using fallbacks");
    const whiteTexture = Texture.WHITE;
    const fallbackTextures = Array(TOAD_FRAMES_COUNT).fill(whiteTexture);

    return {
      toadSpriteSheet: whiteTexture,
      eyeOpenTexture: whiteTexture,
      eyeClosedTexture: whiteTexture,
      toadpoleSpriteSheet: whiteTexture,
      foodTexture: whiteTexture,
      toadTextures: fallbackTextures,
      toadpoleTextures: fallbackTextures,
    };
  }
};

export default function ToadCanvas({ isFoodActive, setIsFoodActive }: any) {
  const { toads, selectToad: onToadSelect, currentScene } = useToads();
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>(null);
  const toadsRef = useRef<Container[]>([]);
  const foodRef = useRef<Container | null>(null);
  const initializedRef = useRef(false);
  const texturesRef = useRef<any>(null);
  const { penWidth, penHeight } = getSceneSettings();
  const { playCroak, playCroakSmall, playCroakBig, playCrunch, playExited } =
    useSoundEffects();
  const { width, height } = getWindowDimensions();
  const [isReady, setIsReady] = useState(false);

  const { lastSaved } = useGameState();

  const foodTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousSceneRef = useRef(currentScene?.id);

  const updateToadAppearance = (
    container: Container,
    toad: Toad,
    state: string,
    bounce: number = 0
  ) => {
    const toadSprite = container.getChildAt(0) as Sprite;

    if (!toadSprite || !texturesRef.current) return;

    const isToadpole = toad.stage === "toadpole";
    const data = container.userData;

    // Выбираем массив текстур в зависимости от типа
    const textures = isToadpole
      ? texturesRef.current.toadpoleTextures
      : texturesRef.current.toadTextures;
    const framesCount = isToadpole ? TOADPOLE_FRAMES_COUNT : TOAD_FRAMES_COUNT;

    if (textures && textures.length > 0) {
      if (state === "walking" && data) {
        // Плавная анимация движения
        data.animationProgress += data.animationSpeed;

        // Рассчитываем кадр с плавным переходом
        const frameIndex =
          (Math.floor(data.animationProgress) % (framesCount - 1)) + 1;

        // Устанавливаем текстуру из заранее созданного массива
        toadSprite.texture = textures[frameIndex];
      } else {
        // В покое используем первый кадр
        toadSprite.texture = textures[0];
        data.animationProgress = 0;
      }
    }

    const size =
      (isToadpole ? toad.genes.weight / 1.5 : toad.genes.weight) * 1.5;
    const bodyY = (-bounce * size) / 10;

    toadSprite.y = bodyY;
    toadSprite.width = size * 2;
    toadSprite.height = size * 1.5;

    // Анимация свечения для новых жаб
    const isNew = Date.now() - new Date(toad.created_at).getTime() < 10000;
    if (isNew) {
      const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
      toadSprite.tint = `hsl(${pulse * 60}, 100%, 70%)`;
    } else {
      toadSprite.tint = toad.genes.colors[0];
    }
  };

  // Функция для создания корма
  const createFood = (x: number, y: number) => {
    if (!appRef.current?.stage || !texturesRef.current) return;

    if (foodRef.current) {
      appRef.current.stage.removeChild(foodRef.current);
      foodRef.current.destroy({ children: true });
    }

    playExited();

    setTimeout(() => {
      playCrunch();
    }, 500);

    const foodContainer: ContainerChildCustom = new Container();
    const foodSprite = new Sprite(texturesRef.current.foodTexture);

    foodSprite.anchor.set(0.5);
    foodSprite.width = 40;
    foodSprite.height = 40;
    foodSprite.tint = 0xffd700;

    const glow = new Sprite(texturesRef.current.foodTexture);
    glow.anchor.set(0.5);
    glow.width = 50;
    glow.height = 50;
    glow.tint = 0xffff00;
    glow.alpha = 0.3;
    glow.filters = [new BlurFilter({ strength: 5 })];

    foodContainer.addChild(glow, foodSprite);
    foodContainer.x = x;
    foodContainer.y = y;
    foodContainer.userData = {
      createdAt: Date.now(),
      pulse: 0,
    };

    appRef.current.stage.addChild(foodContainer);
    foodRef.current = foodContainer;

    if (foodTimerRef.current) {
      clearTimeout(foodTimerRef.current);
    }

    foodTimerRef.current = setTimeout(() => {
      removeFood();
    }, 12000);
  };

  const removeFood = () => {
    if (foodRef.current && appRef.current?.stage) {
      appRef.current.stage.removeChild(foodRef.current);
      foodRef.current.destroy({ children: true });
      foodRef.current = null;
      setIsFoodActive(false);
    }

    if (foodTimerRef.current) {
      clearTimeout(foodTimerRef.current);
      foodTimerRef.current = null;
    }
  };

  const moveToadsToFood = () => {
    if (!foodRef.current) return;

    const foodX = foodRef.current.x;
    const foodY = foodRef.current.y;

    toadsRef.current.forEach((container: ContainerChildCustom) => {
      const data = container.userData;
      if (!data || data.isDragging || data.state === "dragging") return;

      const dx = foodX - container.x;
      const dy = foodY - container.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 60) {
        data.vx = 0;
        data.vy = 0;
        data.state = "walking";
        data.stateTimer = 60;
        data.needsRedraw = true;
        return;
      }

      const speed = data.speed * 1.3;
      data.vx = (dx / distance) * speed;
      data.vy = (dy / distance) * speed;

      data.state = "walking";
      data.stateTimer = 120;
      data.bounceDirection = 1;
      data.needsRedraw = true;
    });
  };

  const handleFeedToads = () => {
    if (!appRef.current) return;

    const padding = 50;
    const foodX = padding + Math.random() * (width - padding * 2);
    const foodY = padding + Math.random() * (height - padding * 2);

    createFood(foodX, foodY);
    moveToadsToFood();
  };

  useEffect(() => {
    if (!isFoodActive) {
      return;
    }
    handleFeedToads();
  }, [isFoodActive]);

  const createToad =
    (width: number, height: number, onToadSelect: (toadId: number) => void) =>
    (toadData: Toad) => {
      if (!appRef.current?.stage || !texturesRef.current) {
        return;
      }

      const container: ContainerChildCustom = new Container();
      const isToadpole = toadData.stage === "toadpole";

      // Выбираем начальную текстуру из заранее созданного массива
      const initialTextures = isToadpole
        ? texturesRef.current.toadpoleTextures
        : texturesRef.current.toadTextures;

      const initialTexture = initialTextures
        ? initialTextures[0]
        : Texture.WHITE;

      const toadSprite = new Sprite(initialTexture);
      toadSprite.anchor.set(0.5);
      toadSprite.tint = toadData.genes.colors[0];

      container.addChild(toadSprite);

      const padding = 15;
      const penWidth = width - padding * 2;
      const penHeight = height - padding * 2;

      container.x = padding + 25 + Math.random() * (penWidth - 50);
      container.y = padding + 25 + Math.random() * (penHeight - 50);
      container.scale.x = Math.random() > 0.5 ? 1 : -1;

      const data = {
        vx: 0,
        vy: 0,
        speed: (toadData.genes.speed * toadData.genes.weight) / 22,
        size: toadData.genes.weight,
        id: toadData.id,
        toadData,
        state: "idle",
        stateTimer: 60 + Math.random() * 120,
        bounce: 0,
        bounceDirection: 1,
        isDragging: false,
        dragOffset: { x: 0, y: 0 },
        dropAnimation: {
          isDropping: false,
          startY: 0,
          targetY: 0,
          progress: 0,
          duration: 10,
        },
        isTapped: false,
        tapTimer: 0,
        lastState: "idle",
        lastBounce: 0,
        needsRedraw: false,
        // Свойства для плавной анимации
        animationProgress: 0,
        animationSpeed: ANIMATION_SPEED,
        movementSpeedFactor: 1,
      };

      container.userData = data;

      updateToadAppearance(container, toadData, data.state, data.bounce);

      container.eventMode = "static";
      container.cursor = "pointer";

      // Обработчик тапа
      container.on("pointerdown", () => {
        if (toadData.stage === "toadpole" || data.size < 15) {
          playCroakSmall();
        } else {
          data.size > 20 && playCroakBig();
          20 >= data.size && data.size >= 15 && playCroak();
        }

        data.isTapped = true;
        data.tapTimer = 0;
        data.state = "jumping";
        data.bounce = 4;

        updateToadAppearance(container, toadData, data.state, data.bounce);
        onToadSelect(toadData.id);
      });

      let dragTimeout: NodeJS.Timeout;
      container.on("pointerdown", (event) => {
        dragTimeout = setTimeout(() => {
          data.isTapped = false;
          data.isDragging = true;
          data.dragOffset = {
            x: event.global.x - container.x,
            y: event.global.y - container.y,
          };
          data.state = "dragging";
          container.cursor = "grabbing";
          container.alpha = 0.9;
          container.scale.set(1.1);
        }, 200);
      });

      container.on("globalpointermove", (event) => {
        if (data.isDragging) {
          container.x = event.global.x - data.dragOffset.x;
          container.y = event.global.y - data.dragOffset.y;
        }
      });

      const handlePointerUp = () => {
        clearTimeout(dragTimeout);

        if (data.isDragging) {
          data.isDragging = false;
          container.cursor = "pointer";
          container.alpha = 1;
          container.scale.set(1.0);

          const leftBound = 15 + data.size;
          const rightBound = width - 15 - data.size;
          const topBound = 15 + data.size;
          const bottomBound = height - 15 - data.size;

          const targetX = Math.max(
            leftBound,
            Math.min(rightBound, container.x)
          );
          const targetY = Math.max(
            topBound,
            Math.min(bottomBound, container.y)
          );

          data.dropAnimation = {
            isDropping: true,
            startY: container.y,
            targetY: targetY,
            progress: 0,
            duration: 15,
          };

          container.x = targetX;
          data.state = "idle";
          updateToadAppearance(container, toadData, data.state, data.bounce);
        }
      };

      container.on("pointerup", handlePointerUp);
      container.on("pointerupoutside", handlePointerUp);

      appRef.current.stage.addChild(container);
      toadsRef.current.push(container);
    };

  const transitionToNewScene = async () => {
    if (!appRef.current || isTransitioning) return;

    setIsTransitioning(true);
    removeFood();

    const stage = appRef.current.stage;
    const fadeOverlay = new Graphics();
    fadeOverlay
      .roundRect(0, 0, width, height, 20)
      .fill({ color: "rgb(17 24 39)", alpha: 1 });
    stage.addChild(fadeOverlay);

    await new Promise<void>((resolve) => {
      let alpha = 0;
      const fadeOut = () => {
        alpha += 0.032;
        fadeOverlay.alpha = alpha;

        if (alpha < 0.8) {
          requestAnimationFrame(fadeOut);
        } else {
          resolve();
        }
      };
      fadeOut();
    });

    const ground = stage.getChildAt(0) as Graphics;
    if (ground) {
      ground.clear();
      const gradient = new FillGradient({
        end: { x: 0, y: 1 },
        colorStops: GRADIENTS[currentScene?.gradient || 0],
      });
      ground.roundRect(0, 0, width, height, 20).fill(gradient);
    }

    await new Promise<void>((resolve) => {
      let alpha = 0.8;
      const fadeIn = () => {
        alpha -= 0.02;
        fadeOverlay.alpha = alpha;

        if (alpha > 0) {
          requestAnimationFrame(fadeIn);
        } else {
          stage.removeChild(fadeOverlay);
          fadeOverlay.destroy();
          resolve();
        }
      };
      fadeIn();
    });

    setIsTransitioning(false);
    previousSceneRef.current = currentScene?.id;
  };

  useEffect(() => {
    if (!canvasRef.current || initializedRef.current === true) {
      return;
    }

    const initPixi = async () => {
      texturesRef.current = await preloadTextures();

      const app = new Application();

      await app.init({
        width,
        height,
        backgroundColor: "#111827",
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      canvasRef.current?.appendChild(app.canvas);
      (appRef as any).current = app;

      const ground = new Graphics();
      const gradient = new FillGradient({
        end: { x: 0, y: 1 },
        colorStops: GRADIENTS[currentScene?.gradient || 0],
      });

      ground.roundRect(0, 0, width, height, 20).fill(gradient);
      app.stage.addChild(ground);

      toads.forEach(createToad(width, height, onToadSelect));

      app.ticker.add(() => {
        // Анимация пульсации корма
        if (foodRef.current) {
          const foodData = (foodRef as any).current.userData;
          foodData.pulse += 0.1;
          const scale = 1 + Math.sin(foodData.pulse) * 0.1;
          foodRef.current.scale.set(scale);
        }

        toadsRef.current.forEach((container: ContainerChildCustom) => {
          const data = container.userData;
          if (!data) return;

          // Плавное управление скоростью анимации
          const targetSpeedFactor =
            data.state === "walking" && Math.abs(data.vx) > 0.1
              ? Math.min(Math.abs(data.vx) * 2, 2.5)
              : 1;

          // Плавная интерполяция скорости
          data.movementSpeedFactor +=
            (targetSpeedFactor - data.movementSpeedFactor) * 0.1;
          data.animationSpeed = ANIMATION_SPEED * 1;

          const isNew = data.toadData.spawnTime
            ? Date.now() - data.toadData.spawnTime < 10000
            : false;

          const stateChanged = data.state !== data.lastState || isNew;
          const bounceChanged = Math.abs(data.bounce - data.lastBounce) > 0.1;

          if (data.needsRedraw || stateChanged || bounceChanged) {
            updateToadAppearance(
              container,
              data.toadData,
              data.state,
              data.bounce
            );
            data.needsRedraw = false;
            data.lastState = data.state;
            data.lastBounce = data.bounce;
          }

          // Обработка анимации падения
          if (data.dropAnimation.isDropping) {
            data.dropAnimation.progress += app.ticker.deltaTime;
            const progress = Math.min(
              data.dropAnimation.progress / data.dropAnimation.duration,
              1
            );
            const bounce = Math.sin(progress * Math.PI) * 16;
            container.y = data.dropAnimation.targetY + bounce;

            if (progress >= 1) {
              data.dropAnimation.isDropping = false;
              data.state = "idle";
              data.stateTimer = 30;
              container.y = data.dropAnimation.targetY;
            }
            data.needsRedraw = true;
            return;
          }

          if (data.isDragging) return;

          // Обработка прыжка
          if (data.state === "jumping") {
            data.bounce -= 0.4;
            if (data.bounce <= 0) {
              data.bounce = 0;
              data.state = "idle";
              data.stateTimer = 30;
            }
            data.needsRedraw = true;
            return;
          }

          // Обработка таймера тапа
          if (data.isTapped) {
            data.tapTimer += app.ticker.deltaTime;
            if (data.tapTimer > 5) {
              data.isTapped = false;
            }
          }

          // Если есть корм, периодически двигаем жаб к нему
          if (foodRef.current && Math.random() < 0.02) {
            moveToadsToFood();
          }

          // Смена состояний
          data.stateTimer -= app.ticker.deltaTime;
          if (data.stateTimer <= 0 && Math.random() < 0.05) {
            if (data.state === "sleeping") {
              data.state = "idle";
              data.stateTimer = 90 + Math.random() * 120;
            } else if (Math.random() < 0.3) {
              data.state = "sleeping";
              data.stateTimer = 180 + Math.random() * 180;
            } else if (Math.random() < 0.7) {
              data.state = "walking";
              data.stateTimer = 120 + Math.random() * 180;
              data.vx = (Math.random() - 0.5) * data.speed;
              data.vy = (Math.random() - 0.5) * data.speed;
            } else {
              data.state = "idle";
              data.stateTimer = 60 + Math.random() * 120;
            }
            data.needsRedraw = true;
          }

          // Движение (только для walking состояния)
          if (data.state === "walking") {
            // Анимация подпрыгивания при ходьбе
            data.bounce += 0.01 * data.bounceDirection;
            if (data.bounce >= 4) data.bounceDirection = -10;
            if (data.bounce <= 0) data.bounceDirection = 10;
            data.needsRedraw = true;

            container.x += data.vx;
            container.y += data.vy;

            // Разворот жабы в направлении движения
            if (data.vx !== 0) {
              container.scale.x = data.vx > 0 ? -1 : 1;
            }

            // Проверка границ
            const leftBound = 15 + data.size;
            const rightBound = width - 15 - data.size;
            const topBound = 15 + data.size;
            const bottomBound = height - 15 - data.size;

            if (
              container.x < leftBound ||
              container.x > rightBound ||
              container.y < topBound ||
              container.y > bottomBound
            ) {
              data.vx *= -1;
              data.vy *= -1;
              container.x = Math.max(
                leftBound,
                Math.min(rightBound, container.x)
              );
              container.y = Math.max(
                topBound,
                Math.min(bottomBound, container.y)
              );
              data.state = "idle";
              data.stateTimer = 30;
              data.animationProgress = 0;
              data.needsRedraw = true;
            }
          }
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsReady(true);
    };

    initPixi();
    initializedRef.current = true;

    return () => {
      if (foodTimerRef.current) {
        clearTimeout(foodTimerRef.current);
      }
      appRef.current?.destroy(true);
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (
      initializedRef.current &&
      previousSceneRef.current !== currentScene?.id
    ) {
      transitionToNewScene();
    }
  }, [currentScene?.id]);

  useEffect(() => {
    if (
      initializedRef.current === false ||
      !appRef.current ||
      !texturesRef.current
    ) {
      return;
    }

    const existingIds = toadsRef.current.map(
      (c: ContainerChildCustom) => c.userData?.toadData.id
    );
    const newToads = toads.filter((t) => !existingIds.includes(t.id));

    newToads.forEach((toadData) => {
      createToad(penWidth, penHeight, onToadSelect)(toadData);
    });

    toadsRef.current = toadsRef.current.filter(
      (container: ContainerChildCustom) => {
        const exists = toads.some(
          (t) => t.id === container.userData?.toadData.id
        );
        if (!exists) {
          container.destroy({ children: true });
        }
        return exists;
      }
    );

    const oldToadsNames = toadsRef.current.map(
      (i: ContainerChildCustom) => i.userData.toadData.name
    );
    const updatedToad = toads.find(
      (toad) => !oldToadsNames.includes(toad.name)
    );

    if (updatedToad) {
      const currentToadData: ContainerChildCustom | undefined =
        toadsRef.current.find(
          (i: ContainerChildCustom) => i.userData.toadData.id === updatedToad.id
        );
      if (currentToadData) {
        currentToadData.userData.toadData.name = updatedToad.name;
        currentToadData.userData.toadData.spawnTime = Date.now();
        updateToadAppearance(
          currentToadData,
          updatedToad,
          currentToadData.userData.state,
          currentToadData.userData.bounce
        );
      }
    }
  }, [
    currentScene.id,
    lastSaved,
    initializedRef.current,
    appRef.current,
    texturesRef.current,
  ]);

  return (
    <div className="relative">
      <div
        className="rounded-2xl duration-200"
        style={{ width, height, opacity: isReady ? 1 : 0 }}
        ref={canvasRef}
      />
    </div>
  );
}
