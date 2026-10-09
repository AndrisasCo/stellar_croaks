import { useCallback, useMemo } from "react";
import { Toad } from "../models/Toad";
import { ColonyRoomKind, ColonyState, EMPTY_COLONY } from "../models/colony";
import {
  buildColonyRoom,
  placeToadInRoom,
  releaseToadFromRoom,
} from "../backend/colony";
import { useGameState } from "./use-game-state";
import {
  getPowerGrid,
  resolveColonyRooms,
} from "../components/HexMap/colony-build";
import { PowerGrid } from "../components/HexMap/colony-power";
import { RoomConfig } from "../components/HexMap/rooms-config";

/**
 * Состояние колонии для экрана карты: построенные комнаты, энергосеть и жабы,
 * которые работают в комнатах (в энергокомнатах ⚡).
 *
 * Жабы из комнат достаются из общего состояния по полю `Toad.roomId`, а сеть
 * пересчитывается на каждый чих — формулы дешёвые и чистые (colony-power).
 */
export interface ColonyController {
  colony: ColonyState;
  /** Комнаты карты: базовые плюс построенные игроком. */
  rooms: RoomConfig[];
  /** Энергосеть: у каждой построенной комнаты видно, есть ли ток. */
  powerGrid: PowerGrid;
  /** Жабы по комнатам колонии (только те, кто живёт не в вольере). */
  toadsByRoom: Record<string, Toad[]>;
  buildRoom: (slotId: string, kind: ColonyRoomKind) => void;
  placeToad: (toadId: number, roomId: string) => void;
  releaseToad: (toadId: number) => void;
}

export const useColony = (): ColonyController => {
  const state = useGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const toads = state.toads;

  /** Жабы, сидящие в комнатах колонии: id комнаты → жабы. */
  const toadsByRoom = useMemo(() => {
    const map: Record<string, Toad[]> = {};

    toads.forEach((toad) => {
      if (!toad.roomId) {
        return;
      }

      map[toad.roomId] = [...(map[toad.roomId] ?? []), toad];
    });

    return map;
  }, [toads]);

  const rooms = useMemo(() => resolveColonyRooms(colony), [colony]);

  const powerGrid = useMemo(
    () => getPowerGrid(rooms, toadsByRoom),
    [rooms, toadsByRoom],
  );

  console.log({ powerGrid });

  const buildRoom = useCallback(
    (slotId: string, kind: ColonyRoomKind) => buildColonyRoom(slotId, kind),
    [],
  );

  const placeToad = useCallback(
    (toadId: number, roomId: string) => placeToadInRoom(toadId, roomId),
    [],
  );

  const releaseToad = useCallback(
    (toadId: number) => releaseToadFromRoom(toadId),
    [],
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
