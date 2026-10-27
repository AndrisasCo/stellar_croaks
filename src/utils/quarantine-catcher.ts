import { getPowerGrid } from "../components/HexMap/colony-build";
import { canMoveToadToRoom } from "../components/HexMap/toad-move-rules";
import type { RoomConfig } from "../components/HexMap/rooms-config";
import { getRoomUpgrades, placeToadInRoom } from "../backend/colony";
import { getGameState } from "../backend/localStorage";
import { isToadSick } from "../models/disease";
import type { Toad } from "../models/Toad";
import { isToadBusyOnExpedition } from "./expedition-status";
import { HOSPITAL_ROOM_TOAD_SLOTS, isToadInHospital } from "./hospital";
import { isUpgradeActive } from "./room-upgrades";

/**
 * Карантин-уловитель — апгрейд Медотсека: сам забирает заболевших жаб на свободные койки.
 *
 * Правило отбора — только активная болезнь (`isToadSick`). HP не порог: уловитель кладёт
 * и выбитую жабу, если её болезнь ещё идёт, но раненого без болезни не трогает — это
 * забота игрока. Поэтому проверка переноса идёт тем же `canMoveToadToRoom`, что и у карты,
 * с `allowDown` для Медотсека: беременную жабу, жабу в походе или обесточенный Медотсек
 * автоматика не обходит.
 *
 * Койки занимаются по порядку секторов карты: у каждого уловителя свой лимит
 * `HOSPITAL_ROOM_TOAD_SLOTS`, а жабы из других Медотсеков не переезжают — они уже
 * изолированы. Дом (`homeId`) при переносе не меняется: после лечения жаба вернётся туда,
 * откуда её забрали, через репатриатор или кнопку «Домой».
 */

export interface QuarantineCatcherResult {
  /** Сколько жаб уловитель действительно забрал на койки. */
  caught: number;
  /** id изолированных жаб — для уведомлений и тестов. */
  toadIds: number[];
}

/** id Медотсеков карты: по ним видно, что жаба уже изолирована и её не нужно переносить. */
const getHospitalIds = (rooms: RoomConfig[]): string[] =>
  Array.from(
    new Set(
      rooms
        .filter((room) => room.kind === "hospital")
        .flatMap((room) => [room.id, room.slotId]),
    ),
  );

/**
 * Один тик карантин-уловителей.
 *
 * `rooms` — секторы карты (`resolveColonyRooms`), `toadsByRoom` — жильцы гексов
 * (`getRoomToadLists`). Список больных читаем из свежего сейва: за время тика
 * `processDiseases` мог вылечить одних и заразить других.
 */
export const processQuarantineCatchers = (
  rooms: RoomConfig[],
  toadsByRoom: Record<string, Toad[]>,
  now = Date.now(),
): QuarantineCatcherResult => {
  const activeRooms = rooms.filter(
    (room) =>
      room.kind === "hospital" &&
      isUpgradeActive(getRoomUpgrades(room), "quarantineCatcher"),
  );
  const result: QuarantineCatcherResult = { caught: 0, toadIds: [] };

  if (activeRooms.length === 0) {
    return result;
  }

  const state = getGameState();
  const expeditions = state.expeditions ?? [];
  // id гексов плюс оба id построек из колонии: `scene_id` жабы мог сохраниться как
  // id гекса (`slot-north`), так и каноническим id постройки (`hospital_1`).
  const storedHospitalIds = (state.colony?.rooms ?? []).flatMap((room) =>
    room.kind === "hospital" ? [room.id, room.slotId ?? room.id] : [],
  );
  const hospitalIds = Array.from(
    new Set([...getHospitalIds(rooms), ...storedHospitalIds]),
  );
  // Перенос на койку требует тока — как и ручной перенос по карте. Ток считаем по
  // текущим жильцам секторов; уловитель никого не выключает и мощность не меняет.
  const powerGrid = getPowerGrid(rooms, toadsByRoom, expeditions);
  const candidates = state.toads.filter(
    (toad) =>
      isToadSick(toad, now) &&
      !isToadInHospital(toad, hospitalIds) &&
      !isToadBusyOnExpedition(toad, expeditions),
  );

  if (candidates.length === 0) {
    return result;
  }

  const caughtIds = new Set<number>();

  for (const room of activeRooms) {
    // Жильцы этого Медотсека: койки, занятые до тика, плюс те, кого уловитель уже положил.
    const occupants = [...(toadsByRoom[room.id] ?? [])];

    for (const toad of candidates) {
      if (
        caughtIds.has(toad.id) ||
        occupants.length >= HOSPITAL_ROOM_TOAD_SLOTS
      ) {
        continue;
      }

      const check = canMoveToadToRoom(toad, room, {
        roomToads: occupants,
        aviaryCount: 0,
        aviaryCapacity: 0,
        rooms,
        powerGrid,
        expeditions,
      });

      if (!check.ok) {
        continue;
      }

      const [moved] = placeToadInRoom(toad.id, room.id);

      if (!moved) {
        continue;
      }

      occupants.push(moved);
      caughtIds.add(toad.id);
      result.caught += 1;
      result.toadIds.push(toad.id);
    }
  }

  return result;
};
