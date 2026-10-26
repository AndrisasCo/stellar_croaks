import { useCallback, useMemo } from "react";
import { canMoveToadToRoom } from "../components/HexMap/toad-move-rules";
import { RoomConfig } from "../components/HexMap/rooms-config";
import { Toad } from "../models/Toad";
import { isToadInHospital, needsHospitalCare } from "../utils/hospital";
import { useColony } from "./use-colony";
import { useGameState } from "./use-game-state";

/**
 * Быстрая отправка жабы в Медотсек из списков жаб (`shared/ToadListCard`).
 *
 * Кнопка «✚» стоит рядом с полосой HP, поэтому правила те же, что у переноса по карте
 * (`canMoveToadToRoom`): Медотсек должен быть построен и под током, койка — свободна,
 * а жаба — не в походе. Отдельно отсекаем случаи, когда кнопка бессмысленна: жаба уже
 * лежит на койке или ей нечего лечить (HP полное и болезней нет) — такие кнопки
 * показываются неактивными с причиной в подсказке.
 *
 * Хук общий для списка колонии и списка биопода: иначе «первый Медотсек со свободной
 * койкой» искался бы в двух местах по-разному.
 */

export interface HospitalAdmission {
  /** Медотсек, который примет жабу: первый со свободной койкой и током */
  room: RoomConfig | null;
  /** Почему отправить нельзя: нет Медотсека, койки заняты, жаба здорова и т.п. */
  issue: string | null;
}

export interface HospitalAdmissionController {
  /** Куда и можно ли отправить жабу */
  getAdmission: (toad: Toad) => HospitalAdmission;
  /** Отправить жабу на койку: `false`, если принять её некому */
  admit: (toad: Toad) => boolean;
}

export const useHospitalAdmission = (): HospitalAdmissionController => {
  const { rooms, powerGrid, toadsByRoom, placeToad } = useColony();
  const state = useGameState();
  const expeditions = useMemo(
    () => state.expeditions ?? [],
    [state.expeditions],
  );

  /** Все Медотсекы колонии: койки есть в каждом, а «✚» ищет свободную */
  const hospitalRooms = useMemo(
    () => rooms.filter((room) => room.kind === "hospital"),
    [rooms],
  );
  const hospitalIds = useMemo(
    () => hospitalRooms.map((room) => room.id),
    [hospitalRooms],
  );

  const getAdmission = useCallback(
    (toad: Toad): HospitalAdmission => {
      if (isToadInHospital(toad, hospitalIds)) {
        return { room: null, issue: "Жаба уже в Медотсеке" };
      }

      if (hospitalRooms.length === 0) {
        return { room: null, issue: "В колонии нет Медотсека" };
      }

      if (!needsHospitalCare(toad)) {
        return {
          room: null,
          issue: "HP полное и болезней нет — Медотсек не нужен",
        };
      }

      let firstIssue: string | null = null;

      for (const hospital of hospitalRooms) {
        const check = canMoveToadToRoom(toad, hospital, {
          roomToads: (toadsByRoom[hospital.id] ?? []).filter(
            (item) => item.id !== toad.id,
          ),
          aviaryCount: 0,
          aviaryCapacity: 0,
          rooms,
          powerGrid,
          expeditions,
        });

        if (check.ok) {
          return { room: hospital, issue: null };
        }

        firstIssue = firstIssue ?? check.reason ?? null;
      }

      return { room: null, issue: firstIssue };
    },
    [expeditions, hospitalIds, hospitalRooms, powerGrid, rooms, toadsByRoom],
  );

  const admit = useCallback(
    (toad: Toad): boolean => {
      const { room } = getAdmission(toad);

      if (!room) {
        return false;
      }

      placeToad(toad.id, room.id);
      return true;
    },
    [getAdmission, placeToad],
  );

  return { getAdmission, admit };
};
