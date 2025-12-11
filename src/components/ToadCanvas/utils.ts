import { Assets, Texture } from "pixi.js";
import { ToadTypes } from "../../models/toad";

export function makeColorWhiter(hexColor, percent) {
  // Убедимся, что процент от 0 до 100
  percent = Math.min(100, Math.max(0, percent)) / 100;

  // Преобразуем hex в RGB
  let r = parseInt(hexColor.substring(1, 3), 16);
  let g = parseInt(hexColor.substring(3, 5), 16);
  let b = parseInt(hexColor.substring(5, 7), 16);

  // Смешиваем с белым (255, 255, 255)
  // Формула: исходный * (1 - percent) + белый * percent
  r = Math.round(r * (1 - percent) + 255 * percent);
  g = Math.round(g * (1 - percent) + 255 * percent);
  b = Math.round(b * (1 - percent) + 255 * percent);

  // Обратно в hex
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export const createTextures = (spritesheet: any) => {
  const result: Texture[] = [];
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 3; i++) {
      if (i === 2 && j === 0) {
        result.push(
          new Texture({
            source: spritesheet,
            frame: {
              x: (i * spritesheet.width) / 3,
              y: (j * spritesheet.height) / 2,
              width: spritesheet.width / 3,
              height: spritesheet.height / 2,
            },
          })
        );
      }
      result.push(
        new Texture({
          source: spritesheet,
          frame: {
            x: (i * spritesheet.width) / 3,
            y: (j * spritesheet.height) / 2,
            width: spritesheet.width / 3,
            height: spritesheet.height / 2,
          },
        })
      );
    }
  }
  return result;
};

// Предзагружаем текстуры и создаем текстуры для анимации один раз
export const preloadTextures = async () => {
  try {
    const [
      // toadSpriteSheetZebra,
      // toadSpriteSheetTurtle,
      toadSpriteSheetFire,
      toadSpriteSheetLeopard,
      toadSpriteSheet,
      toadDragonSpriteSheet,
      toadTigerSpriteSheet,
      toadMutantSpriteSheet,
      toadSpottedSpriteSheet,
      toadSpriteSheet1,
      toadSpriteSheet2,
      toadSpriteSheet3,
      toadSpriteSheetCrystall2,
      toadSpriteSheet4,
      toadSpriteSheet5,
      toadpoleSpriteSheet,
      foodTexture,
    ] = await Promise.all([
      // Assets.load("/sprites/co.png"),
      // Assets.load("/sprites/zebra.png"),
      Assets.load("/sprites/zebra.png"),
      Assets.load("/sprites/turtle.png"),
      Assets.load("/sprites/fire.png"),
      Assets.load("/sprites/leopard.png"),
      Assets.load("/sprites/hybrid.png"), //
      Assets.load("/sprites/dragon.png"),
      Assets.load("/sprites/tiger.png"),
      Assets.load("/sprites/mutant.png"),
      Assets.load("/sprites/camouflage.png"),
      Assets.load("/sprites/forest.png"),
      Assets.load("/sprites/money.png"),
      Assets.load("/sprites/crystall.png"),
      Assets.load("/sprites/crystall_pink.png"),
      Assets.load("/sprites/stone.png"),
      Assets.load("/sprites/chaos.png"),
      Assets.load("/sprites/toadpole.png"),
      Assets.load("/assets/apple.svg"),
    ]);

    const [
      toadTexturesZebra,
      toadTexturesTurtle,
      toadTexturesFire,
      toadTexturesLeopard,
      toadTextures,
      toadTexturesDragon,
      toadTexturesTiger,
      toadTexturesCamouflage,
      toadTexturesMutant,
      toadTexturesForest,
      toadTexturesMoney,
      toadTexturesCrystall,
      toadTexturesCrystallPink,
      toadTexturesStone,
      toadTexturesChaos,
      toadpoleTextures,
    ] = [
      createTextures(toadSpriteSheetZebra.source),
      createTextures(toadSpriteSheetTurtle.source),
      createTextures(toadSpriteSheetFire.source),
      createTextures(toadSpriteSheetLeopard.source),
      createTextures(toadSpriteSheet.source),
      createTextures(toadDragonSpriteSheet.source),
      createTextures(toadTigerSpriteSheet.source),
      createTextures(toadSpottedSpriteSheet.source),
      createTextures(toadMutantSpriteSheet.source),
      createTextures(toadSpriteSheet1.source),
      createTextures(toadSpriteSheet2.source),
      createTextures(toadSpriteSheet3.source),
      createTextures(toadSpriteSheetCrystall2.source),
      createTextures(toadSpriteSheet4.source),
      createTextures(toadSpriteSheet5.source),
      createTextures(toadpoleSpriteSheet.source),
    ];

    return {
      toadTexturesZebra,
      toadTexturesTurtle,
      toadTexturesFire,
      toadTexturesLeopard,
      toadTexturesDragon,
      toadTexturesMoney,
      toadTexturesCrystall,
      toadTexturesCrystallPink,
      toadTexturesStone,
      toadTexturesChaos,
      toadTexturesForest,
      foodTexture,
      toadTextures, // Готовый массив текстур для жабы
      toadpoleTextures, // Готовый массив текстур для головастика
      toadTexturesCamouflage,
      toadTexturesMutant,
      toadTexturesTiger,
    };
  } catch (error) {
    return {};
  }
};

export const getTextureByType = (texturesRef: any, type: ToadTypes | null) => {
  const map = {
    [ToadTypes.hybrid]: texturesRef.current.toadTextures,
    [ToadTypes.camouflage]: texturesRef.current.toadTexturesCamouflage,
    [ToadTypes.tiger]: texturesRef.current.toadTexturesTiger,
    [ToadTypes.mutant]: texturesRef.current.toadTexturesMutant,
    [ToadTypes.money]: texturesRef.current.toadTexturesMoney,
    [ToadTypes.stone]: texturesRef.current.toadTexturesStone,
    [ToadTypes.crystall]: texturesRef.current.toadTexturesCrystall,
    [ToadTypes.crystallPink]: texturesRef.current.toadTexturesCrystallPink,
    [ToadTypes.forest]: texturesRef.current.toadTexturesForest,
    [ToadTypes.chaos]: texturesRef.current.toadTexturesChaos,
    [ToadTypes.dragon]: texturesRef.current.toadTexturesDragon,
    [ToadTypes.leopard]: texturesRef.current.toadTexturesLeopard,
    [ToadTypes.fire]: texturesRef.current.toadTexturesFire,
    [ToadTypes.zebra]: texturesRef.current.toadTexturesZebra,
    [ToadTypes.turtle]: texturesRef.current.toadTexturesTurtle,
  };

  return type
    ? map[type] || texturesRef.current.toadTextures
    : texturesRef.current.toadTextures;
};
