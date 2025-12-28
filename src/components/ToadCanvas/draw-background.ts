import { Container, Sprite } from "pixi.js";

// texturesRef.current.foodTextures =
//   currentScene.name === "худ"
//     ? texturesRef.current.foodTextures1
//     : texturesRef.current.foodTextures2;
export const drawBackground =
  (w: number, h: number) => (appRef, texturesRef, handleShowFoodTooltip) => {
    if (!appRef.current || !texturesRef.current?.backgroundTexture) return;

    const stage = appRef.current.stage;

    let backgroundSprite;
    let fenceSprite;
    let fenceSprite2;

    let foodContainer;

    // Ищем существующие спрайты
    try {
      backgroundSprite = stage.getChildAt(0) as Sprite;
      fenceSprite = stage.getChildAt(stage.children.length - 1) as Sprite;
      fenceSprite2 = stage.getChildAt(1) as Sprite;
      foodContainer = stage.getChildAt(2) as Sprite;
      foodContainer.getChildAt(0).texture = texturesRef.current.foodTextures[0];
    } catch {
      // Если нет спрайта фона или это не спрайт, создаем новый
      backgroundSprite = new Sprite(texturesRef.current.backgroundTexture);
      stage.addChildAt(backgroundSprite, 0); // Добавляем на самый нижний слой
      fenceSprite2 = new Sprite(texturesRef.current.fenceTexture);
      stage.addChildAt(fenceSprite2, 1);
      foodContainer = new Container();

      foodContainer.eventMode = "static";
      foodContainer.cursor = "pointer";

      foodContainer.on("pointerdown", handleShowFoodTooltip);
      foodContainer.addChild(new Sprite(texturesRef.current.foodTextures[0]));
      stage.addChildAt(foodContainer, 2);

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
    const ratio = foodContainer.height / foodContainer.width;
    foodContainer.width = 85;
    foodContainer.height = 85 * ratio;
    foodContainer.x = (w - 50) / 2;
    foodContainer.y = h / 2.5;
  };
