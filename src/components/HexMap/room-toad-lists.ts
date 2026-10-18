import { Toad } from "../../models/Toad";
import { isToadInRoom } from "../../utils/toad-location";
import { RoomConfig } from "./rooms-config";

/**
 * Жабы, которых рисует каждый гекс карты: свой список у каждого гекса.
 *
 * Сектор показывает только тех, кто физически в ней сидит (`Toad.scene_id` = id сектора):
 * ⚡-сектор, «Разведка», репродуктор, лазарет. Жабы из репродуктора сами не уходят — ни после
 * ухаживания, ни после родов, — поэтому пара и головастики остаются на гексе репродуктора,
 * пока игрок не перенесёт их.
 *
 * Биопод — особый случай: биоподов в колонии много, и у каждого гекса-биопода свой
 * (`RoomConfig.sceneId`). Гекс показывает жильцов **своего** биопода: жаб, которые сейчас
 * в нём живут (числовой `scene_id`). Жаба в секторе колонии места в биоподе не занимает и здесь
 * не появится — её `scene_id` — id сектора, а дом (`homeId`) гекс не рисует (см.
 * `utils/toad-location.ts`). Раньше биопод был один на всю карту (общий `currentScene`),
 * и один и тот же список жаб рисовался на каждом гексе-биоподе: теперь карта показывает,
 * кто живёт где.
 */
export const getRoomToadLists = (
  rooms: RoomConfig[],
  toads: Toad[]
): Record<string, Toad[]> => {
  const map: Record<string, Toad[]> = {};
  const aviaryRooms = rooms.filter(
    (room) => room.kind === "aviary" && room.sceneId != null
  );
  const claimedScenes = new Set(aviaryRooms.map((room) => room.sceneId));

  rooms.forEach((room) => {
    if (room.kind === "aviary" && room.sceneId != null) {
      // Жильцы биопода: кто живёт в нём сейчас — жаб в секторах колонии здесь нет,
      // их `scene_id` — id сектора, а место в биоподе не занято (`utils/toad-location.ts`)
      map[room.id] = toads.filter(
        (toad) => toad.scene_id === room.sceneId
      );
      return;
    }

    // Старые сейвы могли помнить постройку по каноническому id, а карта зовёт её
    // по id гекса: принимаем оба, чтобы жаба не пропадала после перезагрузки.
    const inside = toads.filter(
      (toad) =>
        isToadInRoom(toad) &&
        (toad.scene_id === room.id || toad.scene_id === room.slotId)
    );

    if (inside.length > 0) {
      map[room.id] = inside;
    }
  });

  /**
   * Страховка от пропавших жаб: жильцов биопода, который не привязан ни к одному гексу
   * (старые сейвы покупали биоподы в магазине), показывает базовый гекс «Биопод». Туда же
   * попадают жабы без биопода (нет числа в `scene_id` и никакого сектора — наследие старого
   * «склада жаб»): жаба без места лучше видна на базовом гексе, чем не видна вовсе.
   * Жаба в секторе колонии сюда не попадает: её рисует сам сектор (`scene_id`).
   */
  const fallbackRoom = aviaryRooms[0];

  if (fallbackRoom) {
    const homeless = toads.filter(
      (toad) =>
        !isToadInRoom(toad) &&
        (toad.scene_id == null ||
          !claimedScenes.has(toad.scene_id as number))
    );

    if (homeless.length > 0) {
      map[fallbackRoom.id] = [...(map[fallbackRoom.id] ?? []), ...homeless];
    }
  }

  return map;
};
