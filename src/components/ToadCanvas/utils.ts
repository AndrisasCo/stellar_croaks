import { Assets, Texture, TextureSource } from "pixi.js";
import { ToadTypes } from "../../models/Toad/toad-species";

export function makeColorWhiter(hexColor: string, percent: number) {
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
    const [toadpoleSpriteSheet, foodTexture] = await Promise.all([
      Assets.load("/sprites/toadpole.png"),
      Assets.load("/assets/apple.svg"),
    ]);
    const toadpoleTextures = createTextures(toadpoleSpriteSheet.source);
    const res: Record<string, Texture<TextureSource<any>>[]> = {
      toadpoleTextures,
      foodTexture,
    };

    const typeArray = Object.values(ToadTypes);

    const promises = typeArray.map((type) =>
      Assets.load(`/sprites/${type}.png`)
    );

    const allSpriteshits = await Promise.all(promises);

    allSpriteshits.forEach((s, index) => {
      res[typeArray[index]] = createTextures(s.source);
    });

    return res;
  } catch (error) {
    return {};
  }
};

export const getTextureByType = (texturesRef: any, type: ToadTypes | null) => {
  return type
    ? texturesRef.current[type] || texturesRef.current.hybrid
    : texturesRef.current.hybrid;
};
