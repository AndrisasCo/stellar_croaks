import { Assets, Texture } from "pixi.js";
import { RoomKind } from "./rooms-config";

/**
 * Фоны комнат: картинка, которая лежит под цветом гекса.
 *
 * Палитра остаётся главным «значком» карты (тип комнаты, тусклость без тока), фон — только
 * фактура самой комнаты. Файлы — webp из `/public/bg/rooms`, собранные из исходных PNG
 * скриптом `scripts/optimize-images.mjs` (исходники переезжают в `design-src/bg` и в
 * рантайме не грузятся: 13.4 МБ PNG превращаются в 1 МБ webp).
 *
 * Папка `rooms/` отдельная не для красоты: в `public/bg` уже лежат `incubator.webp` и
 * `vivarium.webp` другого назначения (фоны модалок) — те же имена перезаписали бы их.
 */
export const ROOM_BACKGROUNDS: Partial<Record<RoomKind, string>> = {
  aviary: "/bg/rooms/vivarium.webp",
  core: "/bg/rooms/core.webp",
  breeding: "/bg/rooms/nest.webp",
  shop: "/bg/rooms/market.webp",
  storage: "/bg/rooms/storage.webp",
  collider: "/bg/rooms/collider.webp",
  dissociator: "/bg/rooms/dissosiator.webp",
  power: "/bg/rooms/power.webp",
  incubator: "/bg/rooms/incubator.webp",
  scout: "/bg/rooms/scout.webp",
  hospital: "/bg/rooms/med.webp",
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
