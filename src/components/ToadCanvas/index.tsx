import { useEffect, useRef, useState } from "react";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
  ContainerChild,
} from "pixi.js";
import { getWindowDimensions, getSceneSettings } from "../../utils/ui";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { useToads } from "../ToadContext";
import { GRADIENTS } from "../../models/scene";
import { useGameState } from "../../hooks/use-game-state";
import { TOAD_FRAMES_COUNT, ANIMATION_SPEED } from "./constants";
import { Toad } from "../../models/Toad";
import { ToadTypes } from "../../models/Toad/toad-species";
import { getTextureByType, makeColorWhiter, preloadTextures } from "./utils";

export type ContainerChildCustom = ContainerChild & { userData?: any };

export default function ToadCanvas({ isFoodActive, setIsFoodActive }: any) {
  const { toads, selectToad: onToadSelect, currentScene } = useToads();
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>(null);
  const toadsRef = useRef<Container[]>([]);
  const foodRef = useRef<Container | null>(null);
  const initializedRef = useRef(false);
  const texturesRef = useRef<any>(null);
  const {
    playCroak,
    playBeep,
    playCroakBig,
    playCroakSmall,
    playCrunch,
    playExited,
  } = useSoundEffects();

  // 1. Используем стейт для размеров, чтобы компонент знал об обновлениях
  const [dimensions, setDimensions] = useState(getWindowDimensions());

  const [isReady, setIsReady] = useState(false);

  const { lastSaved } = useGameState();

  const foodTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousSceneRef = useRef(currentScene?.id);

  const sortToadsByDepth = () => {
    if (!appRef.current) return;
    const stage = appRef.current.stage;

    // Фильтруем только жабы (не фон и не забор)
    const toadContainers = stage.children.filter(
      (child: ContainerChildCustom) => child.userData?.toadData
    );

    // Сортируем жабы по Y координате (ниже = выше в отображении)
    toadContainers.sort((a: ContainerChildCustom, b: ContainerChildCustom) => {
      return a.y + a.userData.size / 2 - b.y - b.userData.size / 2;
    });

    // Расставляем жабы в правильном порядке
    toadContainers.forEach((container, index) => {
      stage.setChildIndex(container, index + 2);
    });
  };

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
    const textures = isToadpole
      ? texturesRef.current.toadpoleTextures
      : getTextureByType(texturesRef, toad.type);

    if (textures && textures.length > 0) {
      if (state === "walking" && data) {
        data.animationProgress += data.animationSpeed;
        const frameIndex =
          (Math.floor(data.animationProgress) % (TOAD_FRAMES_COUNT - 1)) + 1;
        toadSprite.texture = textures[frameIndex];
      } else {
        toadSprite.texture = textures[0];
        data.animationProgress = 0;
      }
    }
    const size = toad.genes.weight * 1.5;
    const bodyY = (-bounce * size) / 10;
    toadSprite.y = bodyY;
    const aspectRatio = toadSprite.height / toadSprite.width;
    toadSprite.setSize(size * 2, size * 2 * aspectRatio);
    if (
      toad.stage === "adult" &&
      [ToadTypes.hybrid, ToadTypes.camouflage].includes(toad.type)
    ) {
      toadSprite.tint = makeColorWhiter(toad.genes.colors[0], 10);
    }
  };

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

    const ratio = foodSprite.height / foodSprite.width;
    foodSprite.width = 35;
    foodSprite.height = 35 * ratio;

    foodContainer.addChild(foodSprite);
    foodContainer.x = x;
    foodContainer.y = y;
    foodContainer.userData = {
      createdAt: Date.now(),
      pulse: 0,
    };
    appRef.current.stage.addChild(foodContainer);
    foodRef.current = foodContainer;
    // Еда должна быть под забором
    const stage = appRef.current.stage;
    stage.setChildIndex(foodContainer, 1);

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

  const createToad =
    (spawnW: number, spawnH: number, onToadSelect: (toadId: number) => void) =>
    (toadData: Toad) => {
      if (!appRef.current?.stage || !texturesRef.current) {
        return;
      }

      const container: ContainerChildCustom = new Container();
      const isToadpole = toadData.stage === "toadpole";
      const initialTextures = isToadpole
        ? texturesRef.current.toadpoleTextures
        : getTextureByType(texturesRef, toadData.type);
      const initialTexture = initialTextures
        ? initialTextures[0]
        : Texture.WHITE;
      const toadSprite = new Sprite(initialTexture);
      toadSprite.anchor.set(0.5);
      container.addChild(toadSprite);

      const padding = 15;
      const penWidth = spawnW - padding * 2;
      const penHeight = spawnH - padding * 2;

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
        animationProgress: 0,
        animationSpeed: ANIMATION_SPEED,
        movementSpeedFactor: 1,
      };

      container.userData = data;
      updateToadAppearance(container, toadData, data.state, data.bounce);
      container.eventMode = "static";
      container.cursor = "pointer";

      container.on("pointerdown", () => {
        if (toadData.stage === "toadpole") {
          playBeep();
        } else {
          if (data.size < 15) {
            playCroakSmall();
          } else {
            data.size > 20 && playCroakBig();
            20 >= data.size && data.size >= 15 && playCroak();
          }
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

          // ИСПОЛЬЗУЕМ app.screen ДЛЯ АКТУАЛЬНЫХ ГРАНИЦ
          const currentW = appRef.current?.screen.width || spawnW;
          const currentH = appRef.current?.screen.height || spawnH;

          const leftBound = 15 + data.size;
          const rightBound = currentW - 15 - data.size;
          const topBound = 15 + data.size;
          const bottomBound = currentH - 15 - data.size;

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

      // Сортируем жабы после добавления новой
      sortToadsByDepth();
    };

  const drawBackground = (w: number, h: number) => {
    if (!appRef.current || !texturesRef.current?.backgroundTexture) return;

    const stage = appRef.current.stage;

    let backgroundSprite;
    let fenceSprite;
    let fenceSprite2;
    // Ищем существующие спрайты
    try {
      backgroundSprite = stage.getChildAt(0) as Sprite;
      fenceSprite = stage.getChildAt(stage.children.length - 1) as Sprite;
      fenceSprite2 = stage.getChildAt(1) as Sprite;
    } catch {
      // Если нет спрайта фона или это не спрайт, создаем новый
      backgroundSprite = new Sprite(texturesRef.current.backgroundTexture);
      stage.addChildAt(backgroundSprite, 0); // Добавляем на самый нижний слой
      fenceSprite2 = new Sprite(texturesRef.current.fenceTexture);

      stage.addChildAt(fenceSprite2, 1);

      // Если нет спрайта забора, создаем его
      fenceSprite = new Sprite(texturesRef.current.fenceTexture);
      stage.addChild(fenceSprite);
    }

    // Обновляем размеры и позицию фона
    backgroundSprite.texture = texturesRef.current.backgroundTexture;
    backgroundSprite.width = w;
    backgroundSprite.height = h;
    backgroundSprite.x = 0;
    backgroundSprite.y = 0;

    // Обновляем размеры и позицию забора
    fenceSprite.texture = texturesRef.current.fenceTexture;
    fenceSprite2.texture = texturesRef.current.fenceTexture;
    fenceSprite.width = w;
    fenceSprite2.width = w;

    // Рассчитываем высоту забора с сохранением пропорций
    const fenceRatio = fenceSprite.texture.width / fenceSprite.texture.height;
    fenceSprite.height = fenceSprite.width / fenceRatio;
    fenceSprite2.height = fenceSprite.width / fenceRatio;

    fenceSprite.x = 0;
    fenceSprite2.x = 0;
    fenceSprite.y = h - fenceSprite.height; // Забор начинается снизу
    fenceSprite2.y = 0; // Забор начинается снизу

    // ВАЖНО: Перемещаем забор на самый верхний слой
    stage.setChildIndex(fenceSprite, stage.children.length - 1);

    // Сортируем жабы после обновления фона
    sortToadsByDepth();
  };

  const transitionToNewScene = async () => {
    if (!appRef.current || isTransitioning) return;

    // Берем актуальные размеры
    const curW = appRef.current.screen.width;
    const curH = appRef.current.screen.height;

    setIsTransitioning(true);
    removeFood();

    const stage = appRef.current.stage;
    const fadeOverlay = new Graphics();
    fadeOverlay
      .roundRect(0, 0, curW, curH, 20)
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

    // Перерисовываем фон с новым градиентом
    drawBackground(curW, curH);

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
    if (!isFoodActive) return;
    const currentW = appRef.current?.screen.width || dimensions.width;
    const currentH = appRef.current?.screen.height || dimensions.height;

    const padding = 50;
    const foodX = padding + Math.random() * (currentW - padding * 2);
    const foodY = padding + Math.random() * (currentH - padding * 2);

    createFood(foodX, foodY);
    moveToadsToFood();
  }, [isFoodActive]);

  // 2. Обработчик ресайза окна
  useEffect(() => {
    const handleResize = () => {
      const { width: newW, height: newH } = getWindowDimensions();
      setDimensions({ width: newW, height: newH });

      if (appRef.current) {
        // Ресайзим Pixi Renderer
        appRef.current.renderer.resize(newW, newH);
        // Перерисовываем фон под новые размеры
        drawBackground(newW, newH);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [currentScene]); // Зависимость от сцены нужна, чтобы фон перерисовался с правильным градиентом

  useEffect(() => {
    if (!canvasRef.current || initializedRef.current === true) {
      return;
    }

    const initPixi = async () => {
      texturesRef.current = await preloadTextures();
      // Используем начальные размеры из стейта
      const initialW = dimensions.width;
      const initialH = dimensions.height;

      const app = new Application();

      await app.init({
        width: initialW,
        height: initialH,
        backgroundColor: "#111827",
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      canvasRef.current?.appendChild(app.canvas);
      (appRef as any).current = app;

      drawBackground(initialW, initialH);

      toads.forEach(createToad(initialW, initialH, onToadSelect));

      app.ticker.add(() => {
        toadsRef.current.forEach((container: ContainerChildCustom) => {
          const data = container.userData;
          if (!data) return;

          data.animationSpeed = ANIMATION_SPEED;
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

          if (data.isTapped) {
            data.tapTimer += app.ticker.deltaTime;
            if (data.tapTimer > 5) {
              data.isTapped = false;
            }
          }

          if (foodRef.current && Math.random() < 0.02) {
            moveToadsToFood();
          }

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

          if (data.state === "walking") {
            data.bounce += 0.01 * data.bounceDirection;
            if (data.bounce >= 4) data.bounceDirection = -10;
            if (data.bounce <= 0) data.bounceDirection = 10;
            data.needsRedraw = true;

            container.x += data.vx;
            container.y += data.vy;

            if (data.vx !== 0) {
              container.scale.x = data.vx > 0 ? -1 : 1;
            }

            // ВАЖНО: Используем app.screen для проверки границ, а не статические width/height
            // Это позволяет жабам реагировать на изменение размера окна
            const currentScreenW = app.screen.width;
            const currentScreenH = app.screen.height;

            const leftBound = 15 + data.size;
            const rightBound = currentScreenW - 15 - data.size;
            const topBound = 15 + data.size;
            const bottomBound = currentScreenH - 15 - data.size;

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

        // Сортируем жабы по глубине каждый кадр
        sortToadsByDepth();
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

    // Используем актуальные размеры для новых жаб
    const currentW = appRef.current.screen.width;
    const currentH = appRef.current.screen.height;

    const existingIds = toadsRef.current.map(
      (c: ContainerChildCustom) => c.userData?.toadData.id
    );
    const newToads = toads.filter((t) => !existingIds.includes(t.id));

    newToads.forEach((toadData) => {
      createToad(currentW, currentH, onToadSelect)(toadData);
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
    toads, // Добавил toads в зависимости, чтобы отслеживать новых
    initializedRef.current,
    appRef.current,
    texturesRef.current,
  ]);

  return (
    <div className="relative -ml-2  w-[100vw]">
      <div
        className="rounded-2xl duration-200"
        // Размеры DIV теперь берутся из стейта
        style={{
          width: dimensions.width,
          height: dimensions.height,
          opacity: isReady ? 1 : 0,
        }}
        ref={canvasRef}
      />
    </div>
  );
}
