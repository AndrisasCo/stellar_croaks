import { Toad } from "../../models/Toad";
import { RoomConfig } from "./rooms-config";

/**
 * Жабы, которых рисует каждый гекс карты.
 *
 * По умолчанию комната показывает всех, кто посажен в неё вручную (`Toad.roomId`):
 * ⚡-комната, «Разведка», гнездо. Особый случай один — вольер: он показывает жильцов
 * вольера (`roomId` пусто), их раскладывает `housing`.
 *
 * Гнездо рисует только тех, кто в нём сидит: жабы не уходят из гнезда сами — ни после
 * ухаживания, ни после родов, — поэтому пара и головастики остаются на гексе гнезда,
 * пока игрок не перенесёт их. Слияние с посаженными вручную нужно базовому гексу
 * вольера «aviary»: его id совпадает с ключом-«бакетом», и без слияния жаба,
 * посаженная в базовый вольер, исчезала с карты.
 */
export const mergeToads = (...lists: Toad[][]): Toad[] => {
  const seen = new Set<number>();

  return lists.flat().filter((toad) => {
    if (seen.has(toad.id)) {
      return false;
    }

    seen.add(toad.id);
    return true;
  });
};

/** Карта «id комнаты → жабы, которых рисует гекс» */
export const getRoomToadLists = (
  rooms: RoomConfig[],
  toadsByRoom: Record<string, Toad[]>,
  lists: { aviaryToads: Toad[] }
): Record<string, Toad[]> => {
  const map: Record<string, Toad[]> = { ...toadsByRoom };

  rooms.forEach((room) => {
    if (room.kind !== "aviary") {
      return;
    }

    map[room.id] = mergeToads(lists.aviaryToads, toadsByRoom[room.id] ?? []);
  });

  return map;
};
