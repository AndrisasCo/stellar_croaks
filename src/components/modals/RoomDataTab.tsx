import {
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { updateScene, updateUser } from "../../backend";
import { getRoomUpgrades, upgradeColonyRoom } from "../../backend/colony";
import { InfoIcons } from "../../assets/icons";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { processAutoFeeders } from "../../utils/auto-feeder";
import { CURRENCY_CONFIG, DEMOLISH_ROOM_COST } from "../../utils/constants";
import {
  normalizeSceneName,
  SCENE_NAME_MAX_LENGTH,
} from "../../utils/scene-name";
import {
  hasUpgrade,
  ROOM_UPGRADES,
  RoomUpgradeOption,
} from "../../utils/room-upgrades";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import {
  getRoomDemolishIssue,
  isRoomPowered,
  ROOM_UNPOWERED_MESSAGE,
  ROOM_UNPOWERED_TITLE,
} from "../HexMap/colony-build";
import {
  getBuiltRoomKind,
  getRoomBlueprint,
  hasAutofeeder,
  RoomConfig,
} from "../HexMap/rooms-config";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon } from "../shared/CurrencyIcon";
import RoomDemolishModal from "./RoomDemolishModal";

/**
 * «Данные сектора» — последний таб каждой модалки сектора на карте.
 *
 * Здесь лежит всё «паспортное» сектора: что это за комната (описание из каталога
 * `HexMap/rooms-config.ts`), сводка по гексу (жабы, ток, улучшения), дополнительная
 * статистика места (`stats` — её передаёт модалка, у которой она есть: биопод показывает
 * статистику биопода, Медотсек — койки, «Разведка» — походы), а также то, что раньше жило
 * в отдельной модалке улучшения: покупка апгрейдов и снос сектора.
 *
 * У биопода здесь же правится имя (`Scene.name`) — оно общее для шапки списка жаб,
 * этой карточки и списка переезда, поэтому разбор ввода вынесен в `utils/scene-name.ts`.
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
  label: "ⓘ О секторе",
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
  const { playSuccess, playError } = useSoundEffects();

  const tokens = Math.floor(account?.tokens || 0);
  const roomToads = toadsByRoom[room.id] ?? [];
  const upgrades = useMemo(
    () => getRoomUpgrades(room),
    // Апгрейды лежат в состоянии колонии: меняются — пересчитываем
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.id, colony],
  );
  const powered = isRoomPowered(room, powerGrid);
  /** Апгрейды есть только у жилых секторов: остальным кормушка ни к чему */
  const canUpgrade = hasAutofeeder(room);
  const installed = ROOM_UPGRADES.filter((option) =>
    hasUpgrade(upgrades, option.upgrade),
  ).length;
  const kind = getBuiltRoomKind(room);
  const description = kind ? getRoomBlueprint(kind).description : room.subtitle;
  const scene = room.sceneId
    ? (ownedScenes.find((item) => item.id === room.sceneId) ?? null)
    : null;
  const demolishIssue = getRoomDemolishIssue(room, roomToads);

  /**
   * Правка имени биопода прямо в «О секторе»: имя — это `Scene.name`, поэтому после
   * сохранения оно меняется и в шапке списка жаб, и в переезде. Гекс без биопода
   * (`scene === null`) поля не получает.
   */
  const [isEditingName, setIsEditingName] = useState(false);
  const [sceneName, setSceneName] = useState(scene?.name ?? "");

  // Биопод может смениться (стрелки листают их в модалке) или имя прийти из облака:
  // незаконченная правка не должна переезжать на чужой биопод.
  useEffect(() => {
    setSceneName(scene?.name ?? "");
    setIsEditingName(false);
  }, [scene?.id, scene?.name]);

  /** Сохранить имя биопода: пустой ввод не принимаем, неизменённое имя просто закрываем */
  const handleSaveName = () => {
    if (!scene) {
      return;
    }

    const name = normalizeSceneName(sceneName);

    if (!name) {
      playError();
      addNotification({
        type: "warn",
        content: "Название биопода не может быть пустым.",
      });
      return;
    }

    if (name !== scene.name) {
      updateScene(scene.id, { name });
      playSuccess();
      addNotification({
        type: "success",
        content: `Биопод переименован: «${name}»`,
      });
    }

    setIsEditingName(false);
  };

  const handleCancelName = () => {
    setIsEditingName(false);
    setSceneName(scene?.name ?? "");
  };

  /** Enter сохраняет имя, Esc отменяет правку, а не закрывает окно (см. ModalProvider) */
  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSaveName();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelName();
    }
  };

  /** Покупка апгрейда: списываем Кваксы, пишем апгрейд сектору и сразу кормим жаб */
  const handleBuy = (option: RoomUpgradeOption) => {
    if (!canUpgrade || hasUpgrade(upgrades, option.upgrade)) {
      playError();
      return;
    }

    if (tokens < option.cost) {
      playError();
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

    playSuccess();
    addNotification({
      type: "success",
      content: `«${option.title}» установлена в «${room.name}»${
        fed > 0 ? `: кормушка сразу покормила ${fed} жаб(ы)` : ""
      } 🍎`,
    });
  };

  return (
    <div className="flex flex-col gap-3 px-2 pb-2">
      {/* Описание сектора — то же, что видно в каталоге карты. Это первое, что нужно
          прочитать о гексе, поэтому блок стоит выше сводки и предупреждений. */}
      <div className="rounded-xl border border-sky-400/25 bg-sky-950/30 p-2">
        <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-sky-200">
          📖 О секторе
        </p>
        <p className="text-2xs leading-snug text-sky-100">{description}</p>
      </div>

      {/* Главная ошибка сектора: без тока рабочие вкладки закрыты, а биопод не производит биомассу */}
      {!powered && (
        <div className="rounded-xl border border-rose-500/60 bg-rose-950/40 p-2">
          <p className="text-xs font-bold text-rose-200">
            ⚠️ {ROOM_UNPOWERED_TITLE}
          </p>
          <p className="mt-1 text-2xs leading-snug text-rose-100/80">
            {ROOM_UNPOWERED_MESSAGE} Его рабочие вкладки закрыты, а жильцы
            биопода без тока не вырабатывают биомассу.
          </p>
        </div>
      )}

      {/* Что это за гекс и кто в нём живёт */}
      <div className="ui-panel p-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{room.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-sm font-semibold text-amber-100">
                {room.name}
              </span>
              {scene && !isEditingName && (
                <span className="inline-flex items-center gap-1 text-2xs text-slate-400">
                  биопод «{scene.name || "Биопод"}»
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-slate-400 transition-colors hover:text-cyan-300"
                    title="Переименовать биопод"
                    aria-label="Переименовать биопод"
                  >
                    {InfoIcons.pencil}
                  </button>
                </span>
              )}
            </div>

            {/* Имя биопода: Enter сохраняет, Esc отменяет правку и не закрывает окно */}
            {scene && isEditingName && (
              <div className="mt-1.5 flex items-center gap-1">
                <input
                  value={sceneName}
                  onChange={(event) => setSceneName(event.target.value)}
                  onKeyDown={handleNameKeyDown}
                  maxLength={SCENE_NAME_MAX_LENGTH}
                  placeholder="Название биопода"
                  aria-label="Название биопода"
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-cyan-400/40 bg-slate-950/60 px-2 py-1 text-xs text-white outline-none transition-colors placeholder-slate-500 focus:border-cyan-400"
                />
                <button
                  onClick={handleSaveName}
                  className="rounded-lg border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/15"
                  title="Сохранить название"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelName}
                  className="rounded-lg border border-rose-500/40 px-2 py-1 text-xs text-rose-300 transition-colors hover:bg-rose-500/15"
                  title="Отменить переименование"
                >
                  ✕
                </button>
              </div>
            )}
            <p className="ui-caption">{room.subtitle}</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-2xs">
          <div className="rounded-lg bg-slate-950/40 px-1 py-1">
            <p className="text-slate-400">Жаб в секторе</p>
            <p className="font-bold text-white">{roomToads.length}</p>
          </div>
          <div className="rounded-lg bg-slate-950/40 px-1 py-1">
            <p className="text-slate-400">Питание</p>
            <p
              className={`font-bold ${
                powered ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {powered ? "⚡ есть ток" : "🔌 без тока"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/40 px-1 py-1">
            <p className="text-slate-400">Улучшения</p>
            <p className="font-bold text-white">
              {canUpgrade ? `${installed}/${ROOM_UPGRADES.length}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Статистика самого места: у биопода, Медотсека и «Разведки» она своя */}
      {stats}

      {/* Улучшения сектора — то, что раньше стояло в модалке улучшения */}
      <div className="flex flex-col gap-2">
        <p className="text-2xs font-bold uppercase tracking-wide text-amber-200">
          🛠️ Улучшения
        </p>

        {!canUpgrade && (
          <p className="ui-caption">У этого сектора улучшений нет.</p>
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
                    : "border-white/10 bg-slate-950/40"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none">{option.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">
                      {option.title}
                    </p>
                    <p className="ui-caption">{option.description}</p>
                  </div>
                </div>

                <ClickButton
                  disabled={bought || !enough}
                  onClick={() => handleBuy(option)}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-xs font-bold transition-colors duration-300 ${
                    bought
                      ? "border-emerald-500/40 text-emerald-300"
                      : enough
                        ? "border-amber-500/50 text-amber-100 hover:bg-amber-800/40"
                        : "border-slate-600/40 text-slate-500"
                  }`}
                >
                  {bought ? (
                    "✓ Установлено"
                  ) : (
                    <>
                      Установить · {option.cost}{" "}
                      <CurrencyIcon currency="tokens" className="h-3 w-3" />
                      {enough ? "" : " — не хватает Кваксов"}
                    </>
                  )}
                </ClickButton>
              </div>
            );
          })}

        {canUpgrade && (
          <p className="text-2xs text-slate-500">
            <CurrencyIcon currency="tokens" className="h-3 w-3" /> в запасе:{" "}
            {tokens}
          </p>
        )}
      </div>

      {/* Снос сектора: подтверждение берёт на себя RoomDemolishModal */}
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-2xs font-bold uppercase tracking-wide text-rose-200">
          🗑️ Снос сектора
        </p>

        <p className="ui-caption">
          Снос стоит {DEMOLISH_ROOM_COST}{" "}
          <CurrencyIcon currency="tokens" className="h-3 w-3" /> и
          подтверждается отдельным окном. Кваксы за постройку не возвращаются,
          зато гекс становится свободным — на нём можно построить заново, и
          следующий сектор того же вида подешевеет.
          {demolishIssue ? ` ${demolishIssue}` : ""}
        </p>

        <ClickButton
          onClick={() => openModal(() => <RoomDemolishModal room={room} />)}
          className="ui-button-danger w-full border-rose-500/40 text-rose-200"
        >
          🗑️ Снести «{room.name}» · {DEMOLISH_ROOM_COST}{" "}
          <CurrencyIcon currency="tokens" className="h-3 w-3" />
        </ClickButton>
      </div>
    </div>
  );
}
