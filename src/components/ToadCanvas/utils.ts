import { Texture } from "pixi.js";
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
              x: i * 341,
              y: j * 272,
              width: 337,
              height: 272,
            },
          })
        );
      }
      result.push(
        new Texture({
          source: spritesheet,
          frame: {
            x: i * 341,
            y: j * 272,
            width: 337,
            height: 272,
          },
        })
      );
    }
  }
  return result;
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
  };

  return type
    ? map[type] || texturesRef.current.toadTextures
    : texturesRef.current.toadTextures;
};
