import { Toad } from "../../models/Toad";
import { RoomConfig } from "./rooms-config";

/**
 * Жабы, которых рисует каждый гекс карты: свой список у каждого гекса.
 *
 * Комната показывает только тех, кто физически в ней сидит (`Toad.roomId`):
 * ⚡-комната, «Разведка», гнездо, лазарет. Жабы из гнезда сами не уходят — ни после
 * ухаживания, ни после родов, — поэтому пара и головастики остаются на гексе гнезда,
 * пока игрок не перенесёт их.
 *
 * Вольер — особый случай: вольеров в колонии много, и у каждого гекса-вольера свой
 * (`RoomConfig.sceneId`). Гекс показывает жильцов **своего** вольера: жабы без `roomId`,
 * у которых `scene_id` указывает на его вольер. Раньше вольер был один на всю карту
 * (общий `currentScene`), и один и тот же список жаб рисовался на каждом гексе-вольере:
 * теперь карта показывает, кто живёт где.
 */
export const getRoomToadLists = (
  rooms: RoomConfig[],
  toads: Toad[]
): Record<string, Toad[]> => {
  const map: Record<string, Toad[]> = {};
  const aviaryRooms = rooms.filter(
    (room) => room.kind === "aviary" && room.sceneId !== undefined
  );
  const claimedScenes = new Set(aviaryRooms.map((room) => room.sceneId));

  rooms.forEach((room) => {
    if (room.kind === "aviary" && room.sceneId !== undefined) {
      // Жильцы вольера: не работают в комнатах и их дом — вольер этого гекса
      map[room.id] = toads.filter(
        (toad) => !toad.roomId && toad.scene_id === room.sceneId
      );
      return;
    }

    const inside = toads.filter((toad) => toad.roomId === room.id);

    if (inside.length > 0) {
      map[room.id] = inside;
    }
  });

  /**
   * Страховка от пропавших жаб: вольер, который не привязан ни к одному гексу (старые
   * сейвы покупали вольеры в магазине), показывает базовый гекс «Вольер». Туда же
   * попадают жабы с пустым `scene_id` (наследие старого «склада жаб»): жаба без вольера
   * лучше видна на базовом гексе, чем не видна вовсе.
   */
  const fallbackRoom = aviaryRooms[0];

  if (fallbackRoom) {
    const homeless = toads.filter(
      (toad) => !toad.roomId && !claimedScenes.has(toad.scene_id)
    );

    if (homeless.length > 0) {
      map[fallbackRoom.id] = [...(map[fallbackRoom.id] ?? []), ...homeless];
    }
  }

  return map;
};
