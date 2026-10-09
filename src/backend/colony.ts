import { ColonyRoomKind, ColonyRoomState, ColonyState, EMPTY_COLONY } from "../models/colony";
import { getGameState, updateGameState } from "./localStorage";
import { updateToadById } from "./index";

/**
 * Постройки колонии: гексагональная карта живёт в состоянии игры,
 * поэтому все действия идут через `updateGameState` — экран карты
 * перерисуется сам по событию `gameStateUpdated`.
 */

/** Построенные комнаты колонии (старые сейвы поля не знают — отдаём пустую колонию). */
export const getColonyState = (): ColonyState =>
  getGameState().colony ?? EMPTY_COLONY;

export const saveColonyState = (colony: ColonyState): ColonyState => {
  updateGameState({ colony });

  return colony;
};

/** Возводит комнату на слоте карты (повторная стройка того же слота не дублируется). */
export const buildColonyRoom = (
  slotId: string,
  kind: ColonyRoomKind
): ColonyRoomState => {
  const colony = getColonyState();
  const room: ColonyRoomState = {
    id: slotId,
    kind,
    builtAt: new Date().toISOString(),
  };

  saveColonyState({
    rooms: [...colony.rooms.filter((item) => item.id !== slotId), room],
  });

  return room;
};

/** Помещает жабу в комнату колонии (энергокомната). */
export const placeToadInRoom = (toadId: number, roomId: string) =>
  updateToadById(toadId, { roomId });

/** Возвращает жабу из комнаты колонии обратно в вольер. */
export const releaseToadFromRoom = (toadId: number) =>
  updateToadById(toadId, { roomId: null });

/** Освобождает комнату целиком — жабы уходят в вольеры (на будущее: снос комнаты). */
export const releaseRoomToads = (roomId: string) => {
  const toads = getGameState().toads.filter((toad) => toad.roomId === roomId);

  toads.forEach((toad) => releaseToadFromRoom(toad.id));

  return toads.length;
};
