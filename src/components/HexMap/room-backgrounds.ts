import { Assets, Texture } from "pixi.js";
import { RoomKind } from "./rooms-config";

/**
 * Фоны комнат: картинка, которая лежит под цветом гекса.
 *
 * Палитра остаётся главным «значком» карты (тип комнаты, тусклость без тока), фон — только
 * фактура самой комнаты. Файлы — как и все картинки игры, webp из `/public/bg`; исходники
 * (jpg/avif) лежат рядом в `/public/source` и в рантайме не грузятся.
 */
export const ROOM_BACKGROUNDS: Partial<Record<RoomKind, string>> = {
  // aviary: "/bg/med.png",
  aviary: "/bg/vivarium.png",
  core: "/bg/core.png",
  breeding: "/bg/nest.png",
  shop: "/bg/market.png",
  // med: "/bg/vivarium.png",
};

/**
 * Грузит фоны комнат. Если что-то не приехало — отдаём то, что успело: карта просто
 * останется цветной, как раньше, и ничего не сломается.
 */
export const preloadRoomBackgrounds = async (): Promise<
  Partial<Record<RoomKind, Texture>>
> => {
  const kinds = Object.keys(ROOM_BACKGROUNDS) as RoomKind[];

  try {
    const textures = await Promise.all(
      kinds.map((kind) => Assets.load(ROOM_BACKGROUNDS[kind] as string)),
    );

    return kinds.reduce<Partial<Record<RoomKind, Texture>>>(
      (result, kind, index) => {
        result[kind] = textures[index];

        return result;
      },
      {},
    );
  } catch (error) {
    return {};
  }
};
