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
import { getWindowDimensions } from "../../utils/ui";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { useToads } from "../ToadContext";
import { useGameState } from "../../hooks/use-game-state";
import { Toad } from "../../models/Toad";
import { getTextureByType, preloadTextures } from "./utils";
import { ClickButton } from "../shared/ClickButton";
import { useFeedToads } from "./use-feed-toads";
import { drawBackground } from "./draw-background";
import { updateToadAppearance } from "./update-toad";
import { moveToads } from "./move-toads";
import { getAutoHunger } from "../../utils/get-auto-hunger";

export type ContainerChildCustom = ContainerChild & { userData?: any };

export default function ToadCanvas() {
  const { toads, selectToad: onToadSelect, currentScene } = useToads();
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>(null);
  const toadsRef = useRef<Container[]>([]);
  const initializedRef = useRef(false);
  const texturesRef = useRef<any>(null);
  const {
    showFoodTooltip,
    handleCancelFeed,
    handleConfirmFeed,
    handleShowFoodTooltip,
    getTooltipMessage,
    isFoodActive,
  } = useFeedToads();

  const { playCroak, playBeep, playCroakBig, playCroakSmall } =
    useSoundEffects();

  // 1. Используем стейт для размеров, чтобы компонент знал об обновлениях
  const [dimensions, setDimensions] = useState(getWindowDimensions());
  const [isReady, setIsReady] = useState(false);
  const { lastSaved } = useGameState();

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
      stage.setChildIndex(container, index + 3);
    });
  };

  const moveToadsToFood = () => {
    if (!appRef.current) return;
    const stage = appRef.current.stage;
    const foodContainer = stage.getChildAt(2);

    toadsRef.current.forEach((container: ContainerChildCustom) => {
      const data = container.userData;
      if (!data) {
        return;
      }

      data.destination.x = foodContainer._position._x + 40;
      data.destination.y = foodContainer._position._y;
      data.distance = 70;
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
        destination: {},
        distance: 0,
      };

      container.userData = data;
      updateToadAppearance(
        container,
        toadData,
        data.state,
        data.bounce
      )(texturesRef);
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
        updateToadAppearance(
          container,
          toadData,
          data.state,
          data.bounce
        )(texturesRef);
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
          updateToadAppearance(
            container,
            toadData,
            data.state,
            data.bounce
          )(texturesRef);
        }
      };

      container.on("pointerup", handlePointerUp);
      container.on("pointerupoutside", handlePointerUp);

      appRef.current.stage.addChild(container);
      toadsRef.current.push(container);

      // Сортируем жабы после добавления новой
      sortToadsByDepth();
    };

  const transitionToNewScene = async () => {
    if (!appRef.current || isTransitioning) return;
    appRef.current.autoFeeder = !!currentScene.bonuses?.autoFeeder;
    texturesRef.current.foodTextures = currentScene.bonuses?.autoFeeder
      ? texturesRef.current.foodTextures2
      : texturesRef.current.foodTextures1;
    // Берем актуальные размеры
    const curW = appRef.current.screen.width;
    const curH = appRef.current.screen.height;

    setIsTransitioning(true);

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
    drawBackground(curW, curH)(appRef, texturesRef, handleShowFoodTooltip);

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
    // Перерисовываем фон с новым градиентом

    setIsTransitioning(false);
    previousSceneRef.current = currentScene?.id;
  };

  useEffect(() => {
    if (!appRef.current) {
      return;
    }
    const stage = appRef.current.stage;
    const foodContainer = stage.getChildAt(2);
    const foodTexture = foodContainer.getChildAt(0);

    if (!isFoodActive) {
      foodTexture.texture = texturesRef.current.foodTextures[0];
      return;
    }

    foodTexture.texture = texturesRef.current.foodTextures[1];

    moveToadsToFood();
  }, [isFoodActive]);

  useEffect(() => {
    const handleResize = () => {
      const { width: newW, height: newH } = getWindowDimensions();
      setDimensions({ width: newW, height: newH });

      if (appRef.current) {
        // Ресайзим Pixi Renderer
        appRef.current.renderer.resize(newW, newH);
        // Перерисовываем фон под новые размеры
        drawBackground(newW, newH)(appRef, texturesRef, handleShowFoodTooltip);
      }
    };

    // if (texturesRef.current) {
    //   texturesRef.current.foodTextures = texturesRef.current.foodTextures2;

    // }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [currentScene.id]); // Зависимость от сцены нужна, чтобы фон перерисовался с правильным градиентом

  useEffect(() => {
    if (!canvasRef.current || initializedRef.current === true) {
      return;
    }

    const initPixi = async () => {
      texturesRef.current = await preloadTextures();

      texturesRef.current.foodTextures = currentScene.bonuses?.autoFeeder
        ? texturesRef.current.foodTextures2
        : texturesRef.current.foodTextures1;
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
      appRef.current.autoFeeder = !!currentScene.bonuses?.autoFeeder;

      drawBackground(initialW, initialH)(
        appRef,
        texturesRef,
        handleShowFoodTooltip
      );

      toads.forEach(createToad(initialW, initialH, onToadSelect));

      app.ticker.add(() => {
        toadsRef.current.forEach(moveToads(app, texturesRef));
        sortToadsByDepth();
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsReady(true);
    };

    initPixi();
    initializedRef.current = true;

    return () => {
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

    if (currentScene.bonuses?.autoFeeder && !appRef.current.autoFeeder) {
      appRef.current.autoFeeder = true;
      const curW = appRef.current.screen.width;
      const curH = appRef.current.screen.height;
      texturesRef.current.foodTextures = texturesRef.current.foodTextures2;
      drawBackground(curW, curH)(appRef, texturesRef, handleShowFoodTooltip);
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

    const oldToadsColors = toadsRef.current.map(
      (i: ContainerChildCustom) => i.userData.toadData.genes.colors[0]
    );

    const updatedToad =
      toads.find((toad) => !oldToadsColors.includes(toad.genes.colors[0])) ||
      toads.find((toad) => !oldToadsNames.includes(toad.name));

    if (updatedToad) {
      const currentToadData: ContainerChildCustom | undefined =
        toadsRef.current.find(
          (i: ContainerChildCustom) => i.userData.toadData.id === updatedToad.id
        );
      if (currentToadData) {
        currentToadData.userData.toadData = { ...updatedToad };
        currentToadData.userData.toadData.spawnTime = Date.now();
        updateToadAppearance(
          currentToadData,
          updatedToad,
          currentToadData.userData.state,
          currentToadData.userData.bounce
        )(texturesRef);
      }
    }
  }, [
    currentScene.id,
    currentScene.bonuses?.autoFeeder,
    lastSaved,
    initializedRef.current,
    appRef.current,
    texturesRef.current,
    JSON.stringify(toads),
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
      {showFoodTooltip && (
        <div className="fixed top-[calc(25%)] left-[calc(50%-125px)]   mb-2 z-50">
          <div
            className="
                  bg-color-main border border-gray-600 rounded-lg p-3 
                  shadow-lg min-w-[250px] backdrop-blur-sm
                "
          >
            <div className="text-white text-sm text-center mb-2">
              {getTooltipMessage().message}
            </div>
            <div className="flex gap-2">
              <ClickButton
                onClick={handleCancelFeed}
                className="
                        flex-1 py-2 px-3 rounded text-sm
                        bg-gray-600 hover:bg-gray-500 text-white
                        transition-colors duration-200
                      "
              >
                Отмена
              </ClickButton>
              <ClickButton
                onClick={handleConfirmFeed}
                disabled={getTooltipMessage().disabled || isFoodActive}
                className="
                        flex-1 py-2 px-3 rounded text-sm
                        bg-yellow-600 hover:bg-yellow-500 text-white
                        transition-colors duration-200
                        flex items-center justify-center gap-1
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
              >
                <img src={"/assets/food.webp"} width={30} />
                Покормить
              </ClickButton>
            </div>
          </div>

          {/* Стрелка тултипа */}
          <div
            className="
                  absolute top-full left-1/2 transform -translate-x-1/2
                  w-0 h-0 border-l-4 border-r-4 border-t-4
                  border-l-transparent border-r-transparent border-t-gray-800
                "
          ></div>
        </div>
      )}
    </div>
  );
}
