import { useCallback, useMemo } from "react";
import { Toad } from "../models/Toad";
import { ColonyRoomKind, ColonyState, EMPTY_COLONY } from "../models/colony";
import {
  buildColonyRoom,
  demolishColonyRoom,
  placeToadInRoom,
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
import { releaseToadToHome } from "../utils/toad-release";

/**
 * Состояние колонии для экрана карты: построенные секторы, энергосеть и жабы,
 * которые стоят на гексах (в секторах — по `Toad.scene_id` = id сектора, в биоподах — по
 * числовому `Toad.scene_id` = id биопода).
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
   * помнит (`homeId`). Если дома места нет (или биопод пропал), жаба едет в любой
   * свободный биопод под током; только когда такого нет — `no-space` и жаба остаётся
   * где была. С `sceneId` — переезд в указанный биопод (он становится её домом).
   *
   * Возвращаем результат: если свободного биопода под током нет — `no-space`, жаба
   * остаётся где была, а игроку надо сказать об ошибке.
   */
  releaseToad: (toadId: number, sceneId?: number | null) => ToadHomeResult;
}

export const useColony = (): ColonyController => {
  const state = useGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const toads = state.toads;
  const scenes = state.scenes;
  const expeditions = useMemo(
    () => state.expeditions ?? [],
    [state.expeditions],
  );

  const rooms = useMemo(
    () => resolveColonyRooms(colony, scenes),
    [colony, scenes],
  );

  /**
   * Жабы по гексам: у каждого сектора свой список — сектора берут посаженных вручную
   * (`scene_id` — id сектора), биоподы — жильцов своего биопода (`sceneId` гекса).
   */
  const toadsByRoom = useMemo(
    () => getRoomToadLists(rooms, toads),
    [rooms, toads],
  );

  const powerGrid = useMemo(
    () => getPowerGrid(rooms, toadsByRoom, expeditions),
    [rooms, toadsByRoom, expeditions],
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
    (toadId: number, sceneId?: number | null): ToadHomeResult =>
      releaseToadToHome(
        toadId,
        { rooms, scenes, toads, expeditions },
        sceneId,
      ),
    [expeditions, rooms, scenes, toads],
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
