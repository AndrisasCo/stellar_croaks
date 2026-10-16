import { ReactNode, useMemo } from "react";
import { updateUser } from "../../backend";
import { getRoomUpgrades, upgradeColonyRoom } from "../../backend/colony";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { processAutoFeeders } from "../../utils/auto-feeder";
import { CURRENCY_CONFIG, DEMOLISH_ROOM_COST } from "../../utils/constants";
import {
  hasUpgrade,
  ROOM_UPGRADES,
  RoomUpgradeOption,
} from "../../utils/room-upgrades";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import { getRoomDemolishIssue, isRoomPowered } from "../HexMap/colony-build";
import {
  getBuiltRoomKind,
  getRoomBlueprint,
  isToadRoom,
  RoomConfig,
} from "../HexMap/rooms-config";
import { ClickButton } from "../shared/ClickButton";
import RoomDemolishModal from "./RoomDemolishModal";

/**
 * «Данные сектора» — последний таб каждой модалки сектора на карте.
 *
 * Здесь лежит всё «паспортное» сектора: что это за комната (описание из каталога
 * `HexMap/rooms-config.ts`), сводка по гексу (жабы, ток, улучшения), дополнительная
 * статистика места (`stats` — её передаёт модалка, у которой она есть: биопод показывает
 * статистику биопода, лазарет — койки, «Разведка» — походы), а также то, что раньше жило
 * в отдельной модалке улучшения: покупка апгрейдов и снос сектора.
 *
 * Модалка улучшения (`RoomUpgradeModal`) удалена: клик по ядру карты больше ничего не
 * открывает, а улучшения и снос переехали сюда — к самим секторам, которых они касаются.
 */
export const ROOM_DATA_TAB_ID = "room-data";

/** id последнего таба модалки сектора: он один на все секторы */
export type RoomDataTabId = typeof ROOM_DATA_TAB_ID;

/** Готовое описание таба «Данные сектора» для `shared/ModalTabs` */
export const ROOM_DATA_TAB = {
  id: ROOM_DATA_TAB_ID,
  label: "ⓘ Данные сектора",
  color: "text-sky-400",
} as const;

interface RoomDataTabProps {
  /** Гекс, чьи данные показываем (модалка всегда знает свой сектор) */
  room: RoomConfig;
  /** Дополнительная статистика сектора: у кого она есть, тот и передаёт */
  stats?: ReactNode;
}

export default function RoomDataTab({ room, stats }: RoomDataTabProps) {
  const { account, ownedScenes } = useToads();
  const { rooms, colony, toadsByRoom, powerGrid } = useColony();
  const { openModal } = useModal();
  const { addNotification } = useNotifications();
  const { playOk, playBeep } = useSoundEffects();

  const tokens = Math.floor(account?.tokens || 0);
  const roomToads = toadsByRoom[room.id] ?? [];
  const upgrades = useMemo(
    () => getRoomUpgrades(room),
    // Апгрейды лежат в состоянии колонии: меняются — пересчитываем
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.id, colony]
  );
  const powered = isRoomPowered(room, powerGrid);
  /** Апгрейды есть только у жилых секторов: остальным кормушка ни к чему */
  const canUpgrade = isToadRoom(room);
  const installed = ROOM_UPGRADES.filter((option) =>
    hasUpgrade(upgrades, option.upgrade)
  ).length;
  const kind = getBuiltRoomKind(room);
  const description = kind ? getRoomBlueprint(kind).description : room.subtitle;
  const scene = room.sceneId
    ? ownedScenes.find((item) => item.id === room.sceneId) ?? null
    : null;
  const demolishIssue = getRoomDemolishIssue(room, roomToads);

  /** Покупка апгрейда: списываем Кваксы, пишем апгрейд сектору и сразу кормим жаб */
  const handleBuy = (option: RoomUpgradeOption) => {
    if (!canUpgrade || hasUpgrade(upgrades, option.upgrade)) {
      playBeep();
      return;
    }

    if (tokens < option.cost) {
      addNotification({
        type: "warn",
        content: `Не хватает Кваксов: нужно ${option.cost} ${CURRENCY_CONFIG.tokens.icon}, у вас ${tokens}.`,
      });
      return;
    }

    upgradeColonyRoom(room.id, option.upgrade);
    updateUser({ tokens: tokens - option.cost });

    // Кормушка включается сразу: игрок видит её работу, не дожидаясь следующего тика голода
    const { fed } = processAutoFeeders(rooms, toadsByRoom);

    playOk();
    addNotification({
      type: "success",
      content: `«${option.title}» установлена в «${room.name}»${
        fed > 0 ? `: кормушка сразу покормила ${fed} жаб(ы)` : ""
      } 🍎`,
    });
  };

  return (
    <div className="flex flex-col gap-3 px-2 pb-2">
      {/* Что это за гекс и кто в нём живёт */}
      <div className="rounded-xl border border-gray-600/40 bg-color-second p-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{room.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-sm font-semibold text-amber-100">
                {room.name}
              </span>
              {scene && (
                <span className="text-2xs text-gray-400">
                  биопод «{scene.name}»
                </span>
              )}
            </div>
            <p className="text-2xs leading-snug text-gray-400">
              {room.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-2xs">
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-gray-400">Жаб в секторе</p>
            <p className="font-bold text-white">{roomToads.length}</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-gray-400">Питание</p>
            <p
              className={`font-bold ${
                powered ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {powered ? "⚡ есть ток" : "🔌 без тока"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-gray-400">Улучшения</p>
            <p className="font-bold text-white">
              {canUpgrade ? `${installed}/${ROOM_UPGRADES.length}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Описание сектора — то же, что видно в каталоге карты */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-2">
        <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-sky-200">
          📖 О секторе
        </p>
        <p className="text-2xs leading-snug text-sky-100">{description}</p>
      </div>

      {/* Статистика самого места: у биопода, лазарета и «Разведки» она своя */}
      {stats}

      {/* Улучшения сектора — то, что раньше стояло в модалке улучшения */}
      <div className="flex flex-col gap-2">
        <p className="text-2xs font-bold uppercase tracking-wide text-amber-200">
          🛠️ Улучшения
        </p>

        {!canUpgrade && (
          <p className="text-2xs leading-snug text-gray-400">
            У этого сектора улучшений нет: апгрейды (например, «Автокормушка»)
            ставятся только в жилые секторы с жабами.
          </p>
        )}

        {canUpgrade &&
          ROOM_UPGRADES.map((option) => {
            const bought = hasUpgrade(upgrades, option.upgrade);
            const enough = tokens >= option.cost;

            return (
              <div
                key={option.title}
                className={`rounded-xl border p-2 ${
                  bought
                    ? "border-emerald-500/40 bg-emerald-900/20"
                    : "border-gray-600/40 bg-color-main"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none">{option.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">
                      {option.title}
                    </p>
                    <p className="text-2xs leading-snug text-gray-400">
                      {option.description}
                    </p>
                  </div>
                </div>

                <ClickButton
                  disabled={bought || !enough}
                  onClick={() => handleBuy(option)}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-2xs font-bold transition-colors duration-300 ${
                    bought
                      ? "border-emerald-500/40 text-emerald-300"
                      : enough
                      ? "border-amber-500/50 text-amber-100 hover:bg-amber-800/40"
                      : "border-gray-600/40 text-gray-500"
                  }`}
                >
                  {bought
                    ? "✓ Установлено"
                    : `Установить · ${option.cost} ${CURRENCY_CONFIG.tokens.icon}${
                        enough ? "" : " — не хватает Кваксов"
                      }`}
                </ClickButton>
              </div>
            );
          })}

        {canUpgrade && (
          <p className="text-2xs text-gray-500">
            {CURRENCY_CONFIG.tokens.icon} в запасе: {tokens}
          </p>
        )}
      </div>

      {/* Снос сектора: подтверждение берёт на себя RoomDemolishModal */}
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-2xs font-bold uppercase tracking-wide text-rose-200">
          🗑️ Снос сектора
        </p>

        <p className="text-2xs leading-snug text-gray-400">
          Снос стоит {DEMOLISH_ROOM_COST} {CURRENCY_CONFIG.tokens.icon} и
          подтверждается отдельным окном. Кваксы за постройку не возвращаются, зато
          гекс становится свободным — на нём можно построить заново, и следующий
          сектор того же вида подешевеет.
          {demolishIssue ? ` ${demolishIssue}` : ""}
        </p>

        <ClickButton
          onClick={() => openModal(() => <RoomDemolishModal room={room} />)}
          className="w-full rounded-lg border border-rose-500/40 px-3 py-2 text-2xs font-bold text-rose-200 transition-colors duration-300 hover:bg-rose-900/40"
        >
          🗑️ Снести «{room.name}» · {DEMOLISH_ROOM_COST}{" "}
          {CURRENCY_CONFIG.tokens.icon}
        </ClickButton>
      </div>
    </div>
  );
}
