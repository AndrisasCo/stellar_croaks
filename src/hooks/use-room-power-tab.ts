import { useEffect, useState } from "react";
import { getRoomPowerIssue } from "../components/HexMap/colony-build";
import { PowerGrid } from "../components/HexMap/colony-power";
import { RoomConfig } from "../components/HexMap/rooms-config";

/**
 * Вкладки сектора с учётом тока.
 *
 * Обесточенный сектор открывается на «Данных сектора»: это единственная вкладка, которая
 * объясняет ошибку и показывает питание. Рабочие табы при этом disabled. Исключения —
 * биопод (его список жаб остаётся доступен, просто без выработки) и энергосектор: его
 * модалка не использует этот хук, иначе из обесточенного ⚡ нельзя было бы посадить жаб.
 */
interface RoomPowerTabOptions<T extends string> {
  /** Гекс, из которого открыли модалку. Без него (бургер-меню, лаборатория) ток не проверяем. */
  room?: RoomConfig;
  /** Энергосеть колонии — считается один раз в `useColony` у самой модалки. */
  powerGrid: PowerGrid;
  /** Вкладка по умолчанию, когда ток есть. */
  defaultTab: T;
  /** Вкладки, которые остаются доступны без тока (у биопода — список жаб). */
  allowedWhenUnpowered?: readonly T[];
}

export const useRoomPowerTab = <T extends string>({
  room,
  powerGrid,
  defaultTab,
  allowedWhenUnpowered,
}: RoomPowerTabOptions<T>) => {
  const issue = room ? getRoomPowerIssue(room, powerGrid) : null;
  const [tab, setTab] = useState<T>(() =>
    issue ? ("room-data" as T) : defaultTab,
  );

  useEffect(() => {
    if (!issue) {
      return;
    }

    if (tab === ("room-data" as T) || allowedWhenUnpowered?.includes(tab)) {
      return;
    }

    setTab("room-data" as T);
  }, [allowedWhenUnpowered, issue, tab]);

  return { tab, setTab, powered: !issue, issue };
};
