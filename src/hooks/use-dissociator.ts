import { isRoomPowered } from "../components/HexMap/colony-build";
import { getBuiltRoomKind } from "../components/HexMap/rooms-config";
import { useColony } from "./use-colony";

/** Состояние Диссоциатора: стоит ли сектор в колонии и принимает ли он жаб. */
export interface DissociatorStatus {
  /** Сектор построен (неважно, есть ли в нём ток). */
  built: boolean;
  /** Сектор построен и под током — только тогда он разбирает жаб в биомассу. */
  ready: boolean;
}

/**
 * Готов ли Диссоциатор к разбору жаб.
 *
 * Разбор возможен, только когда сектор построен и подключён к сети
 * (`colony-build.ts` → `isRoomPowered`). Пока он не готов, кнопки «Разобрать на
 * биомассу» показывают окно-подсказку (`shared/DissolveBlockedModal`) вместо
 * подтверждения: обесточенный или отсутствующий сектор жаб не переработает.
 */
export const useDissociator = (): DissociatorStatus => {
  const { rooms, powerGrid } = useColony();
  const room = rooms.find(
    (item) => getBuiltRoomKind(item) === "dissociator",
  );

  return {
    built: Boolean(room),
    ready: Boolean(room && isRoomPowered(room, powerGrid)),
  };
};
