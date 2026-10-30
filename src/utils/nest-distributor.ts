import { getRoomUpgrades } from "../backend/colony";
import { getGameState } from "../backend/localStorage";
import { resolveColonyRooms } from "../components/HexMap/colony-build";
import { EMPTY_COLONY } from "../models/colony";
import type { Toad } from "../models/Toad";
import { isUpgradeActive } from "./room-upgrades";
import { releaseToadToHome } from "./toad-release";

/**
 * «Распределитель» репродуктора.
 *
 * Апгрейд принадлежит сектору (`ColonyState.upgrades.distributor`) и работает в тике
 * репродуктора: всех головастиков, которые сидят в комнате, он отправляет в биоподы.
 * Порядок тика — покормить (автокормушка), распределить, затем роды и ухаживание
 * (`utils/breeding-manager.ts`): к моменту родов место в репродукторе уже свободно.
 *
 * Перенос идёт через общий возврат домой (`releaseToadToHome`): сначала в биопод,
 * который головастик помнит (`homeId`), затем — в любой свободный биопод под током.
 * Если мест нет, головастик остаётся в репродукторе и ждёт следующего тика; роды в это
 * время не начинаются, потому что весь приплод должен поместиться в комнате
 * (`NEST_TADPOLE_CAPACITY`).
 */

export interface NestDistributorResult {
  /** Сколько головастиков удалось перенести */
  sent: number;
  /** Сколько осталось в репродукторе из-за нехватки мест */
  failed: number;
}

/** Головастик ли это (взрослых распределитель не трогает). */
const isTadpole = (toad: Toad): boolean => toad.stage !== "adult";

/**
 * Один проход распределителя по всем репродукторам с включённым апгрейдом.
 *
 * Состояние читаем из сейва, а не из React: тик живёт вне рендера. Контекст для
 * `releaseToadToHome` обновляем перед каждым переносом — после записи место в биоподе
 * уже занято, и следующий головастик должен видеть актуальную картину.
 */
export const processNestDistributors = (): NestDistributorResult => {
  const state = getGameState();
  const rooms = resolveColonyRooms(state.colony ?? EMPTY_COLONY, state.scenes);
  const nurseryIds = new Set(
    rooms
      .filter(
        (room) =>
          room.kind === "breeding" &&
          isUpgradeActive(getRoomUpgrades(room), "distributor"),
      )
      .flatMap((room) => [room.id, room.slotId]),
  );

  if (nurseryIds.size === 0) {
    return { sent: 0, failed: 0 };
  }

  const tadpoles = getGameState().toads.filter(
    (toad) =>
      isTadpole(toad) &&
      typeof toad.scene_id === "string" &&
      nurseryIds.has(toad.scene_id),
  );

  let sent = 0;
  let failed = 0;

  tadpoles.forEach((toad) => {
    const current = getGameState();
    const result = releaseToadToHome(toad.id, {
      rooms: resolveColonyRooms(
        current.colony ?? EMPTY_COLONY,
        current.scenes,
      ),
      scenes: current.scenes,
      toads: current.toads,
      expeditions: current.expeditions ?? [],
    });

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  });

  return { sent, failed };
};
