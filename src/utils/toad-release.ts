import {
  moveToadToAviary,
  sendToadHome,
  ToadHomeResult,
} from "../backend/colony";
import { findFreePoweredAviary } from "../components/HexMap/aviary-release";
import { getPowerGrid } from "../components/HexMap/colony-build";
import { getRoomToadLists } from "../components/HexMap/room-toad-lists";
import type { RoomConfig } from "../components/HexMap/rooms-config";
import type { Expedition } from "../models/expedition";
import type { Scene } from "../models/scene";
import type { Toad } from "../models/Toad";
import { getToadHomeId } from "./toad-location";

/**
 * Возврат жабы из сектора колонии в биопод — общий путь для кнопки «Домой» и апгрейда
 * «Репатриатор» (`utils/repatriator.ts`).
 *
 * Без `sceneId` жаба едет домой: в биопод, который помнит (`homeId`). Если дома места нет
 * (или биопод пропал), ищем любой свободный биопод под током — обесточенный не годится,
 * его жильцы не вырабатывают биомассу. С `sceneId` — переезд в указанный биопод, он же
 * становится новым домом.
 *
 * Контекст передаёт вызывающий: хук колонии берёт его из React-состояния, а тик
 * репатриатора — прямо из сейва (`backend/localStorage.ts`).
 */
export interface ToadReleaseContext {
  /** Секторы карты с именами (`resolveColonyRooms`). */
  rooms: RoomConfig[];
  /** Биоподы колонии. */
  scenes: Scene[];
  /** Все жабы колонии: по ним считается занятость биоподов. */
  toads: Toad[];
  /** Походы: сеть и свободные места считаются с учётом ушедших жаб. */
  expeditions: Expedition[];
}

export const releaseToadToHome = (
  toadId: number,
  { rooms, scenes, toads, expeditions }: ToadReleaseContext,
  sceneId?: number | null,
): ToadHomeResult => {
  const toad = toads.find((item) => item.id === toadId);

  // Другой биопод — переезд: он становится новым домом жабы, сектор освобождается
  if (sceneId != null && toad && sceneId !== getToadHomeId(toad)) {
    return moveToadToAviary(toadId, sceneId);
  }

  // Свой биопод (или адреса нет) — домой: место в нём проверяет сам биопод
  const homeResult = sendToadHome(toadId);

  if (homeResult.ok) {
    return homeResult;
  }

  // Дома места нет (или биопод пропал) — ищем любой свободный биопод под током.
  // Сеть пересчитываем уже без этой жабы: если она работала в ⚡, её уход может
  // обесточить соседний биопод, и селить её туда нельзя. Обесточенный биопод
  // не годится и сам по себе: его жильцы не вырабатывают биомассу.
  const fallbackGrid = getPowerGrid(
    rooms,
    getRoomToadLists(
      rooms,
      toads.filter((item) => item.id !== toadId),
    ),
    expeditions,
  );
  const fallback = findFreePoweredAviary({
    rooms,
    scenes,
    toads,
    powerGrid: fallbackGrid,
    toadId,
  });

  if (fallback?.sceneId == null) {
    return { ok: false, reason: "no-space", scene: null };
  }

  return moveToadToAviary(toadId, fallback.sceneId);
};

export interface ToadReleaseBatchResult {
  /** Сколько жаб устроено в биоподы */
  sent: number;
  /** Сколько не поместилось: свободных мест под током не хватило */
  failed: number;
}

/**
 * Отправить всех перечисленных жаб домой за один проход.
 *
 * Контекст запрашивается заново перед каждой жабой: `sendToadHome` и
 * `moveToadToAviary` пишут сейв, поэтому занятость биоподов и сеть меняются
 * между итерациями. Если брать один снимок на всю пачку, вторая жаба увидит
 * свободным место, которое только что заняла первая.
 */
export const releaseToadsToHome = (
  toadIds: number[],
  getContext: () => ToadReleaseContext,
): ToadReleaseBatchResult => {
  let sent = 0;
  let failed = 0;

  toadIds.forEach((toadId) => {
    const result = releaseToadToHome(toadId, getContext());

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  });

  return { sent, failed };
};
