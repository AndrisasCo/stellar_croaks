import type { Scene } from "../../models/scene";
import type { Toad } from "../../models/Toad";
import { isRoomPowered } from "./colony-build";
import type { PowerGrid } from "./colony-power";
import type { RoomConfig } from "./rooms-config";

export interface FreePoweredAviaryInput {
  /** Секторы карты с именами (`resolveColonyRooms`). */
  rooms: RoomConfig[];
  /** Биоподы колонии. */
  scenes: Scene[];
  /** Все жабы колонии: по ним считается занятость биоподов. */
  toads: Toad[];
  powerGrid: PowerGrid;
  /** Жаба, которой ищут место: её текущее место не считается занятым. */
  toadId: number;
}

/**
 * Свободный биопод под током — запасное место, когда родной биопод жабы полон
 * (или пропал из сейва).
 *
 * Берём первый по порядку карты: обесточенный биопод не подходит, потому что его
 * жильцы не вырабатывают биомассу. Если свободных запитанных биоподов нет — null.
 */
export const findFreePoweredAviary = ({
  rooms,
  scenes,
  toads,
  powerGrid,
  toadId,
}: FreePoweredAviaryInput): RoomConfig | null => {
  for (const room of rooms) {
    if (room.kind !== "aviary" || room.sceneId == null) {
      continue;
    }

    if (!isRoomPowered(room, powerGrid)) {
      continue;
    }

    const scene = scenes.find((item) => item.id === room.sceneId);

    if (!scene) {
      continue;
    }

    const residents = toads.filter(
      (item) => item.scene_id === scene.id && item.id !== toadId,
    ).length;

    if (residents < scene.capacity) {
      return room;
    }
  }

  return null;
};