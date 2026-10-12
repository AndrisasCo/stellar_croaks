import { useCallback, useMemo } from "react";
import { Toad } from "../models/Toad";
import { ColonyRoomKind, ColonyState, EMPTY_COLONY } from "../models/colony";
import {
  buildColonyRoom,
  moveToadToAviary,
  placeToadInRoom,
  releaseToadFromRoom,
} from "../backend/colony";
import { useGameState } from "./use-game-state";
import {
  getPowerGrid,
  resolveColonyRooms,
} from "../components/HexMap/colony-build";
import { PowerGrid } from "../components/HexMap/colony-power";
import { getRoomToadLists } from "../components/HexMap/room-toad-lists";
import { RoomConfig } from "../components/HexMap/rooms-config";

/**
 * Состояние колонии для экрана карты: построенные комнаты, энергосеть и жабы,
 * которые стоят на гексах (в комнатах — по `Toad.roomId`, в вольерах — по `Toad.scene_id`).
 *
 * Жабы из комнат достаются из общего состояния, а сеть пересчитывается на каждый чих —
 * формулы дешёвые и чистые (colony-power).
 */
export interface ColonyController {
  colony: ColonyState;
  /** Комнаты карты: базовые плюс построенные игроком (у вольеров — свой `sceneId`). */
  rooms: RoomConfig[];
  /** Энергосеть: у каждой построенной комнаты видно, есть ли ток. */
  powerGrid: PowerGrid;
  /** Жабы по гексам: id гекса → жабы, которых он рисует (вольеры — своих жильцов). */
  toadsByRoom: Record<string, Toad[]>;
  buildRoom: (slotId: string, kind: ColonyRoomKind) => void;
  placeToad: (toadId: number, roomId: string) => void;
  /**
   * Вернуть жабу из комнаты в вольер (`roomId` сбрасывается). Если указан вольер,
   * он становится её новым домом — так перенос жабы в другой вольер меняет `scene_id`.
   */
  releaseToad: (toadId: number, sceneId?: number | null) => void;
}

export const useColony = (): ColonyController => {
  const state = useGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const toads = state.toads;
  const scenes = state.scenes;

  const rooms = useMemo(() => resolveColonyRooms(colony, scenes), [colony, scenes]);

  /**
   * Жабы по гексам: у каждой комнаты свой список — комнаты берут посаженных вручную
   * (`roomId`), вольеры — жильцов своего вольера (`sceneId` гекса).
   */
  const toadsByRoom = useMemo(
    () => getRoomToadLists(rooms, toads),
    [rooms, toads],
  );

  const powerGrid = useMemo(
    () => getPowerGrid(rooms, toadsByRoom),
    [rooms, toadsByRoom],
  );

  const buildRoom = useCallback(
    (slotId: string, kind: ColonyRoomKind) => buildColonyRoom(slotId, kind),
    [],
  );

  const placeToad = useCallback(
    (toadId: number, roomId: string) => placeToadInRoom(toadId, roomId),
    [],
  );

  const releaseToad = useCallback(
    (toadId: number, sceneId?: number | null) => {
      const toad = toads.find((item) => item.id === toadId);

      // Другой вольер — переезд: дом жабы меняется, комната освобождается
      if (sceneId != null && sceneId !== toad?.scene_id) {
        return moveToadToAviary(toadId, sceneId);
      }

      return releaseToadFromRoom(toadId);
    },
    [toads],
  );

  return {
    colony,
    rooms,
    powerGrid,
    toadsByRoom,
    buildRoom,
    placeToad,
    releaseToad,
  };
};
