import { Assets, Texture } from "pixi.js";
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

export const createTextures = (
  spritesheet: any,
  isToad = true,
  iMax = 3,
  jMax = 2
) => {
  const result: Texture[] = [];
  for (let j = 0; j < jMax; j++) {
    for (let i = 0; i < iMax; i++) {
      if (i === 2 && j === 0 && isToad) {
        result.push(
          new Texture({
            source: spritesheet,
            frame: {
              x: (i * spritesheet.width) / iMax,
              y: (j * spritesheet.height) / jMax,
              width: spritesheet.width / iMax,
              height: spritesheet.height / 2,
            },
          })
        );
      }
      result.push(
        new Texture({
          source: spritesheet,
          frame: {
            x: (i * spritesheet.width) / iMax,
            y: (j * spritesheet.height) / jMax,
            width: spritesheet.width / iMax,
            height: spritesheet.height / jMax,
          },
        })
      );
    }
  }
  return result;
};

/** Лист спрайтов головастика: отдельная картинка, а не кадры взрослой жабы. */
const TOADPOLE_SPRITES_URL = "/sprites/toadpole.webp";

/**
 * Лист спрайтов взрослой жабы: имя файла совпадает со значением `ToadTypes`.
 * Правило одно на всех потребителей — статичную картинку в интерфейсе собирает так же
 * `ToadAvatar`.
 */
export const toadSpriteUrl = (type: ToadTypes) => `/sprites/${type}.webp`;

/**
 * Предзагружаем текстуры жаб и создаём кадры анимации (один раз на запуск карты).
 *
 * Грузим каждый лист отдельно и глушим ошибку только у него. Раньше здесь стоял один
 * `Promise.all` внутри общего `try`, поэтому один битый путь уносил все текстуры сразу:
 * жабы на карте рисовались белыми квадратами, а тинт делал из них цветные прямоугольники
 * (см. `HexMap/room-toads.ts`). Сейчас пропавшее имя видно в консоли, остальные жабы
 * рисуются как обычно.
 */
export const preloadTextures = async () => {
  const res: Record<string, Texture[]> = {};

  const loadSpriteSheet = async (key: string, url: string) => {
    try {
      const spriteSheet = await Assets.load(url);

      res[key] = createTextures(spriteSheet.source);
    } catch (error) {
      console.warn(`Не загрузился спрайт жабы: ${url}`, error);
    }
  };

  await Promise.all([
    loadSpriteSheet("toadpoleTextures", TOADPOLE_SPRITES_URL),
    ...Object.values(ToadTypes).map((type) =>
      loadSpriteSheet(type, toadSpriteUrl(type))
    ),
  ]);

  return res;
};

export const getTextureByType = (texturesRef: any, type: ToadTypes | null) => {
  return type
    ? texturesRef.current[type] || texturesRef.current.hybrid
    : texturesRef.current.hybrid;
};
