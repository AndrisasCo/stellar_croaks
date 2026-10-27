import type { RoomConfig } from "../components/HexMap/rooms-config";
import { getRoomUpgrades } from "../backend/colony";
import { getGameState } from "../backend/localStorage";
import { getToadDisease } from "../models/disease";
import type { Expedition } from "../models/expedition";
import type { Toad } from "../models/Toad";
import { getToadHp, getToadMaxHp } from "./expedition-config";
import { isToadBusyOnExpedition } from "./expedition-status";
import { isUpgradeActive } from "./room-upgrades";
import { releaseToadToHome } from "./toad-release";

/**
 * Репатриатор Медотсека: сам выписывает выздоровевших жаб домой.
 *
 * Койка в Медотсеке — дефицитный ресурс, а выздоровевшая жаба продолжает её занимать,
 * пока игрок не нажмёт «Домой». Репатриатор делает это за игрока: жаба уходит, как только
 * её нечего лечить — нет болезни (даже просроченной) и HP полное. Больная или раненая
 * остаётся на койке.
 *
 * Жаба едет тем же путём, что и кнопка «Домой» (`utils/toad-release.ts`): в свой биопод,
 * а если дома места нет — в любой свободный биопод под током.
 *
 * Апгрейд принадлежит сектору (`ColonyState.upgrades.repatriator`) и может быть выключен
 * переключателем: выключенный не выписывает никого (`utils/room-upgrades.ts` →
 * `isUpgradeActive`).
 */

export interface RepatriatorResult {
  /** Сколько жаб репатриатор действительно отправил домой. */
  sent: number;
  /** id отправленных жаб — для уведомлений и тестов. */
  toadIds: number[];
  /** Сколько жаб было готово к выписке, но места в биоподах не нашлось. */
  stuck: number;
}

/**
 * Пора ли выписывать жабу: взрослая, не в походе, без болезни и с полным HP.
 *
 * Болезнь проверяем по `diseaseId`, а не по таймеру: просроченная болезнь ещё может
 * передаться соседям до ближайшего тика лечения, поэтому такую жабу домой не отправляем.
 */
export const isToadReadyForDischarge = (
  toad: Toad,
  expeditions: Expedition[] = [],
): boolean =>
  toad.stage === "adult" &&
  !isToadBusyOnExpedition(toad, expeditions) &&
  getToadDisease(toad) == null &&
  getToadHp(toad) >= getToadMaxHp(toad);

/**
 * Пройти по включённым репатриаторам и отправить домой всех, кого уже не нужно лечить.
 *
 * `rooms` — секторы карты (`resolveColonyRooms`), `toadsByRoom` — тот же список жильцов,
 * что карта рисует на гексах (`HexMap/room-toad-lists.ts` → `getRoomToadLists`). Каждую
 * отправку делаем по свежему сейву: после первой жабы свободных мест в биоподах стало
 * меньше, и следующая должна это видеть.
 */
export const processRepatriators = (
  rooms: RoomConfig[],
  toadsByRoom: Record<string, Toad[]>,
): RepatriatorResult => {
  const activeRooms = rooms.filter(
    (room) =>
      room.kind === "hospital" &&
      isUpgradeActive(getRoomUpgrades(room), "repatriator"),
  );
  const result: RepatriatorResult = { sent: 0, toadIds: [], stuck: 0 };
  const seen = new Set<number>();

  if (activeRooms.length === 0) {
    return result;
  }

  const initialState = getGameState();
  const expeditions = initialState.expeditions ?? [];

  for (const room of activeRooms) {
    const patients = toadsByRoom[room.id] ?? [];

    for (const patient of patients) {
      if (seen.has(patient.id)) {
        continue;
      }

      seen.add(patient.id);

      if (!isToadReadyForDischarge(patient, expeditions)) {
        continue;
      }

      // Свежий сейв на каждую жабу: предыдущая уже заняла место дома или в резерве
      const state = getGameState();
      const released = releaseToadToHome(patient.id, {
        rooms,
        scenes: state.scenes ?? [],
        toads: state.toads ?? [],
        expeditions: state.expeditions ?? [],
      });

      if (released.ok) {
        result.sent += 1;
        result.toadIds.push(patient.id);
      } else {
        result.stuck += 1;
      }
    }
  }

  return result;
};
