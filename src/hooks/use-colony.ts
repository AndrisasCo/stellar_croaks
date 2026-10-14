import { useCallback, useMemo } from "react";
import { Toad } from "../models/Toad";
import { ColonyRoomKind, ColonyState, EMPTY_COLONY } from "../models/colony";
import {
  buildColonyRoom,
  demolishColonyRoom,
  moveToadToAviary,
  placeToadInRoom,
  sendToadHome,
  ToadHomeResult,
} from "../backend/colony";
import { useGameState } from "./use-game-state";
import {
  getPowerGrid,
  resolveColonyRooms,
} from "../components/HexMap/colony-build";
import { PowerGrid } from "../components/HexMap/colony-power";
import { getRoomToadLists } from "../components/HexMap/room-toad-lists";
import { RoomConfig } from "../components/HexMap/rooms-config";
import { getToadHomeId } from "../utils/toad-location";

/**
 * Состояние колонии для экрана карты: построенные секторы, энергосеть и жабы,
 * которые стоят на гексах (в секторах — по `Toad.roomId`, в биоподах — по `Toad.scene_id`).
 *
 * Жабы из секторов достаются из общего состояния, а сеть пересчитывается на каждый чих —
 * формулы дешёвые и чистые (colony-power).
 */
export interface ColonyController {
  colony: ColonyState;
  /** Сектора карты: базовые плюс построенные игроком (у биоподов — свой `sceneId`). */
  rooms: RoomConfig[];
  /** Энергосеть: у каждой построенного сектора видно, есть ли ток. */
  powerGrid: PowerGrid;
  /** Жабы по гексам: id гекса → жабы, которых он рисует (биоподы — своих жильцов). */
  toadsByRoom: Record<string, Toad[]>;
  buildRoom: (slotId: string, kind: ColonyRoomKind) => void;
  /** Снести сектор: гекс остаётся свободным слотом, улучшения сектора сгорают. */
  demolishRoom: (roomId: string) => void;
  /** Посадить жабу в сектор колонии: место в биоподе освобождается, дом — в `homeId` */
  placeToad: (toadId: number, roomId: string) => void;
  /**
   * Вернуть жабу из сектора в биопод. Без `sceneId` — домой: в биопод, который жаба
   * помнит (`homeId`); с `sceneId` — переезд в указанный биопод (он становится её домом).
   *
   * Возвращаем результат: в полный биопод жаба не влезет (`no-space`) — она остаётся
   * где была, а игроку надо сказать об ошибке.
   */
  releaseToad: (toadId: number, sceneId?: number | null) => ToadHomeResult;
}

export const useColony = (): ColonyController => {
  const state = useGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const toads = state.toads;
  const scenes = state.scenes;

  const rooms = useMemo(() => resolveColonyRooms(colony, scenes), [colony, scenes]);

  /**
   * Жабы по гексам: у каждого сектора свой список — сектора берут посаженных вручную
   * (`roomId`), биоподы — жильцов своего биопода (`sceneId` гекса).
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

  const demolishRoom = useCallback(
    (roomId: string) => demolishColonyRoom(roomId),
    [],
  );

  const placeToad = useCallback(
    (toadId: number, roomId: string) => placeToadInRoom(toadId, roomId),
    [],
  );

  const releaseToad = useCallback(
    (toadId: number, sceneId?: number | null): ToadHomeResult => {
      const toad = toads.find((item) => item.id === toadId);

      // Другой биопод — переезд: он становится новым домом жабы, сектор освобождается
      if (sceneId != null && toad && sceneId !== getToadHomeId(toad)) {
        return moveToadToAviary(toadId, sceneId);
      }

      // Свой биопод (или адреса нет) — домой: место в нём проверяет сам биопод
      return sendToadHome(toadId);
    },
    [toads],
  );

  return {
    colony,
    rooms,
    powerGrid,
    toadsByRoom,
    buildRoom,
    demolishRoom,
    placeToad,
    releaseToad,
  };
};
