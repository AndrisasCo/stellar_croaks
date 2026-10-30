import { KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { updateScene, updateUser } from "../../backend";
import { getRoomUpgrades, upgradeColonyRoom } from "../../backend/colony";
import { getGameState } from "../../backend/localStorage";
import { InfoIcons } from "../../assets/icons";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { processAutoFeeders } from "../../utils/auto-feeder";
import { processAutoBreeders } from "../../utils/breeding-manager";
import { processNestDistributors } from "../../utils/nest-distributor";
import { processQuarantineCatchers } from "../../utils/quarantine-catcher";
import { processRepatriators } from "../../utils/repatriator";
import { CURRENCY_CONFIG, DEMOLISH_ROOM_COST } from "../../utils/constants";
import {
  normalizeSceneName,
  SCENE_NAME_MAX_LENGTH,
} from "../../utils/scene-name";
import {
  getRoomUpgradeOptions,
  getUpgradePurchasePatch,
  getUpgradeTogglePatch,
  hasUpgrade,
  isUpgradeActive,
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
  RoomConfig,
} from "../HexMap/rooms-config";
import { getRoomToadLists } from "../HexMap/room-toad-lists";
import { DataCell, DataGrid, HudPanel, SectionTitle } from "../shared/DataGrid";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon, IconText } from "../shared/CurrencyIcon";
import { ToadIcon } from "../shared/ToadIcon";
import { ToggleButton } from "../shared/ToggleButton";
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
  /**
   * У каждого вида сектора свой список апгрейдов: у Медотсека — кормушка,
   * репатриатор и карантин-уловитель
   */
  const availableUpgrades = getRoomUpgradeOptions(room.kind);
  const canUpgrade = availableUpgrades.length > 0;
  const installed = availableUpgrades.filter((option) =>
    hasUpgrade(upgrades, option.key),
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

  /**
   * Свежий список жильцов нужен автоматике: после репатриатора или включения
   * уловителя места на койках уже другие, а состояние в React ещё не перерисовано.
   */
  const catchSickToads = () => {
    const current = getGameState();

    return processQuarantineCatchers(
      rooms,
      getRoomToadLists(rooms, current.toads),
    );
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

  /**
   * Покупка апгрейда: списываем Кваксы, пишем апгрейд сектору (сразу включённым)
   * и тут же применяем его — игрок видит работу, не дожидаясь тика.
   */
  const handleBuy = (option: RoomUpgradeOption) => {
    if (!canUpgrade || hasUpgrade(upgrades, option.key)) {
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

    upgradeColonyRoom(room.id, getUpgradePurchasePatch(option));
    updateUser({ tokens: tokens - option.cost });

    const { fed } = processAutoFeeders(rooms, toadsByRoom);
    const { sent } =
      option.key === "repatriator"
        ? processRepatriators(rooms, toadsByRoom)
        : { sent: 0 };
    // Применяем отлов сразу: покупка не должна ждать следующего тика Медотсека.
    const { caught } = catchSickToads();
    // «Инициатор» применяется сразу: если пара уже в слотах и готова — ухаживание
    // начнётся в момент покупки, а общее уведомление ниже это отметит.
    const autoBred =
      option.key === "autoBreeder"
        ? processAutoBreeders()
        : { started: 0 };
    // «Распределитель» сразу разгружает репродуктор: покупка не ждёт тика.
    const distributed =
      option.key === "distributor"
        ? processNestDistributors()
        : { sent: 0, failed: 0 };

    playSuccess();
    addNotification({
      type: "success",
      content: `Апгрейд «${option.title}» установлен в «${room.name}»${
        fed > 0 ? `: кормушка сразу покормила ${fed} жаб(ы) 🍎` : ""
      }${sent > 0 ? `: репатриатор сразу отправил домой ${sent} жаб(ы) 🛬` : ""}${
        caught > 0
          ? `: карантин-уловитель сразу забрал на койки ${caught} 🐸`
          : ""
      }${autoBred.started > 0 ? ": инициатор сразу начал ухаживание 💞" : ""}${
        distributed.sent > 0
          ? `: распределитель сразу перенёс ${distributed.sent} головастиков 📦`
          : ""
      }`,
    });
  };

  /** Переключатель купленного апгрейда: покупка остаётся, меняется только её работа */
  const handleToggle = (option: RoomUpgradeOption) => {
    if (!hasUpgrade(upgrades, option.key)) {
      return;
    }

    const enabled = !isUpgradeActive(upgrades, option.key);

    upgradeColonyRoom(room.id, getUpgradeTogglePatch(option.key, enabled));
    playSuccess();

    // Включённый «Инициатор» не ждёт следующего тика: если пара уже готова,
    // ухаживание начнётся сразу (менеджер сам скажет об этом уведомлением).
    if (enabled && option.key === "autoBreeder") {
      processAutoBreeders(addNotification);
    }

    // Включённый «Распределитель» сразу разгружает репродуктор.
    if (enabled && option.key === "distributor") {
      const { sent } = processNestDistributors();

      if (sent > 0) {
        addNotification({
          type: "success",
          content: `«Распределитель» «${room.name}» сразу перенёс ${sent} головастиков в биоподы 📦`,
        });
      }
    }

    // Включённый уловитель не должен ждать следующего тика: сразу забираем тех, кому
    // уже нужна койка. При выключении, наоборот, никого не трогаем.
    if (enabled && option.key === "quarantineCatcher") {
      const { caught } = catchSickToads();

      if (caught > 0) {
        addNotification({
          type: "success",
          content: `Карантин-уловитель «${room.name}» сразу забрал на койки ${caught} 🐸`,
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Паспорт сектора: иконка, имя, тип и описание в одной карточке. Отдельная
          панель «О секторе» дублировала заголовок и оставляла пустую полосу,
          поэтому описание живёт прямо под именем — первое, что читает игрок. */}
      <HudPanel className="h-fit w-full p-0">
        <div className="flex items-start gap-2.5 p-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-600/50 bg-slate-950/50 text-2xl leading-none"
          >
            <IconText text={room.icon} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-100">
                {room.name}
              </h3>
              <span className="border border-slate-600/50 bg-slate-950/50 px-1.5 py-0.5 text-3xs uppercase tracking-[0.12em] text-slate-400">
                {room.subtitle}
              </span>
              {scene && !isEditingName && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="inline-flex min-w-0 items-center gap-1 text-2xs text-slate-400 transition-colors hover:text-slate-100"
                  title="Переименовать биопод"
                  aria-label="Переименовать биопод"
                >
                  <span className="truncate">
                    🏠 «{scene.name || "Биопод"}»
                  </span>
                  {InfoIcons.pencil}
                </button>
              )}
            </div>

            <p className="mt-1 text-2xs leading-snug text-slate-300">
              {description}
            </p>

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
                  className="min-w-0 flex-1 border border-slate-600/60 bg-slate-950/50 px-2 py-1 text-xs text-white outline-none transition-colors placeholder-slate-500 focus:border-slate-400"
                />
                <button
                  onClick={handleSaveName}
                  className="border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/15"
                  title="Сохранить название"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelName}
                  className="border border-rose-500/40 px-2 py-1 text-xs text-rose-300 transition-colors hover:bg-rose-500/15"
                  title="Отменить переименование"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Техническая строка: статус канала и заполненность сектора. Заполняет
            нижнюю полосу карточки и даёт быстрый ответ «работает ли гекс». */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-600/40 px-3 py-1.5 text-3xs uppercase tracking-[0.12em]">
          <span
            className={`font-bold ${
              powered ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            ● {powered ? "Питание есть" : "Нет тока"}
          </span>
          <span aria-hidden="true" className="h-3 w-px bg-slate-700" />
          {/* Строка-декор: состояние дублирует «Питание есть / Нет тока», поэтому гаснет в фон */}
          <span className="text-slate-500 opacity-100">
            Канал // {powered ? "стабилен" : "потерян"}
          </span>
          <span className="ml-auto flex items-center gap-1 tabular-nums text-slate-400">
            <ToadIcon className="h-3 w-3" />
            {roomToads.length}
          </span>
        </div>
      </HudPanel>

      {/* Главная ошибка сектора: без тока рабочие вкладки закрыты, а биопод не производит биомассу */}
      {!powered && (
        <HudPanel tone="rose" className="p-2">
          <p className="text-xs font-bold text-rose-200">
            ⚠️ {ROOM_UNPOWERED_TITLE}
          </p>
          <p className="mt-1 text-2xs leading-snug text-rose-100/80">
            {ROOM_UNPOWERED_MESSAGE} Его рабочие вкладки закрыты, а жильцы
            биопода без тока не вырабатывают биомассу.
          </p>
        </HudPanel>
      )}

      {/* Сводка по гексу: те же клетки, что и у статистики биопода */}
      <DataGrid columns={3}>
        <DataCell
          dense
          label="Жабы"
          value={roomToads.length}
          color="text-white"
        />
        <DataCell
          dense
          label="Питание"
          value={powered ? "⚡ есть ток" : "🔌 без тока"}
          color={powered ? "text-emerald-300" : "text-rose-300"}
        />
        <DataCell
          dense
          label="Апгрейды"
          value={canUpgrade ? `${installed}/${availableUpgrades.length}` : "—"}
          color="text-white"
        />
      </DataGrid>

      {/* Статистика самого места: у биопода, Медотсека и «Разведки» она своя */}
      {stats}

      {/* Улучшения сектора — то, что раньше стояло в модалке улучшения */}
      <div className="flex flex-col gap-2">
        <SectionTitle
          aside={
            canUpgrade ? `${installed}/${availableUpgrades.length}` : undefined
          }
        >
          🛠️ Улучшения
        </SectionTitle>

        {!canUpgrade && (
          <p className="ui-caption">У этого сектора улучшений нет.</p>
        )}

        {canUpgrade &&
          availableUpgrades.map((option) => {
            const bought = hasUpgrade(upgrades, option.key);
            const active = isUpgradeActive(upgrades, option.key);
            const enough = tokens >= option.cost;

            return (
              <HudPanel
                key={option.key}
                tone={bought ? "emerald" : "cyan"}
                className="p-2"
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

                {bought ? (
                  <div className="mt-2 flex items-center justify-between gap-2 border border-emerald-500/20 bg-slate-950/50 px-2 py-1.5">
                    <span
                      className={`text-2xs font-bold ${
                        active ? "text-emerald-300" : "text-slate-400"
                      }`}
                    >
                      {active
                        ? "✓ Установлено · работает"
                        : "Установлено · выключено"}
                    </span>
                    <ToggleButton
                      checked={active}
                      onChange={() => handleToggle(option)}
                      label={option.title}
                    />
                  </div>
                ) : (
                  <ClickButton
                    disabled={!enough}
                    onClick={() => handleBuy(option)}
                    className={`mt-2 w-full border px-3 py-2 text-xs font-bold transition-colors duration-300 ${
                      enough
                        ? "border-amber-500/50 text-amber-100 hover:bg-amber-800/40"
                        : "border-slate-600/40 text-slate-500"
                    }`}
                  >
                    Установить · {option.cost}{" "}
                    <CurrencyIcon currency="tokens" className="h-3 w-3" />
                    {enough ? "" : " — не хватает Кваксов"}
                  </ClickButton>
                )}
              </HudPanel>
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
        <SectionTitle>🗑️ Снос сектора</SectionTitle>

        <p className="ui-caption">
          Снос стоит {DEMOLISH_ROOM_COST}{" "}
          <CurrencyIcon currency="tokens" className="h-3 w-3" /> и
          подтверждается отдельным окном. Кваксы за постройку не возвращаются,
          зато гекс становится свободным — на нём можно построить заново, и
          следующий сектор того же вида подешевеет.
          {demolishIssue && (
            <>
              {" "}
              <IconText text={demolishIssue} />
            </>
          )}
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
