import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../shared/Header";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon, CurrencyText } from "../shared/CurrencyIcon";
import { HpBar } from "../shared/HpBar";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import RoomDataTab, { ROOM_DATA_TAB } from "./RoomDataTab";
import { SwipeSlides } from "../shared/SwipeSlides";
import { useNotifications } from "../../hooks/use-notification";
import { useGameState } from "../../hooks/use-game-state";
import { useColony } from "../../hooks/use-colony";
import { useRoomPowerTab } from "../../hooks/use-room-power-tab";
import { Toad } from "../../models/Toad";
import {
  Expedition,
  ExpeditionMember,
  EXPEDITION_ROLE_ORDER,
  ExpeditionRole,
  getSectorById,
  isSectorUnlocked,
  normalizeExpeditionStats,
  SECTORS,
} from "../../models/expedition";
import { Items } from "../../models/user";
import {
  EXPEDITION_RETURN_RATIO,
  EXPEDITION_TEAM_SIZE,
  EXTRACTION_ASTRO_COST,
  ExpeditionTeamMember,
  canToadAffordExpedition,
  getContourPassReward,
  getDispatchOfficeCost,
  getExpeditionProfitFloor,
  getExpeditionSendCost,
  getExpeditionEnergyCost,
  getExpeditionSuccessChance,
  getExpeditionToadEnergyCost,
  getRoleStat,
  getSectorSuccessFactor,
  getSpeedUpReturnCost,
  getToadHp,
  getToadHpStatusLabel,
  getToadMaxHp,
  HP_REGEN_PER_HOUR,
  ROLE_CONFIG,
} from "../../utils/expedition-config";
import {
  buyDispatchOffice,
  canSendToad,
  extractExpedition,
  finishExpedition,
  getExpeditionBiomassValue,
  getExpeditionEtaMs,
  getExpeditionLootSummary,
  getExpeditionProgress,
  getExpeditionStorageCheck,
  getExpeditionTeamStatus,
  getReturnProgress,
  getSectorUnlockStatus,
  isToadOnExpedition,
  processExpeditions,
  speedUpReturn,
  startExpedition,
  unlockSector,
  withdrawExpedition,
} from "../../utils/expedition-manager";
import { getMaxExpeditions } from "../../utils/expedition-config";
import {
  ENERGY_REGEN_PER_HOUR,
  MAX_ENERGY,
  PRODUCTION_HUNGRY_FACTOR,
  PRODUCTION_MIN_HUNGER,
  getToadEnergy,
} from "../../utils/gamification-config";
import { RoomConfig } from "../HexMap/rooms-config";
import { ToadPicker } from "../shared/ToadPicker";
import {
  assignToadToRole,
  emptyExpeditionSlots,
  ExpeditionSlots,
  fillTeamFromCrew,
  getAssignedRole,
  getBestRole,
  getCrewTapRole,
  getRolePowerPercent,
  removeToadFromTeam,
  sortToadsByRolePower,
} from "../../utils/expedition-crew";

/** Часы/минуты/секунды до события похода */
const formatDuration = (ms: number): string => {
  if (ms <= 0) {
    return "вот-вот";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  if (minutes > 0) {
    return `${minutes}м ${seconds}с`;
  }
  return `${seconds}с`;
};

/** Время реплики в чате похода */
const formatClock = (at: number): string =>
  new Date(at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Значки состояния жабы в списках команды: **сытость** 🍽 и **силы** ⚡.
 *
 * Поход стоит сил (`energyCost` — цена по глубине выбранного сектора), поэтому цвет
 * значка сил отвечает на главный вопрос выбора: «дотянет ли жаба до этого сектора».
 * Сытость рядом, потому что её спрашивают ровно там же: из похода жаба возвращается
 * домой, где голод режет выработку биомассы, а на пороге `PRODUCTION_MIN_HUNGER` её
 * подхватывает автокормушка сектора.
 */
const ToadVitals: React.FC<{
  toad: Toad;
  /** Силы на поход в выбранный сектор */
  energyCost: number;
  className?: string;
}> = ({ toad, energyCost, className }) => {
  const energy = Math.round(getToadEnergy(toad));
  const hunger = Math.round(toad.state?.hunger ?? 0);
  const hungerColor =
    hunger >= 80
      ? "text-green-300"
      : hunger >= 50
        ? "text-yellow-300"
        : hunger >= PRODUCTION_MIN_HUNGER
          ? "text-orange-300"
          : "text-red-400";

  return (
    <span
      className={`flex items-center gap-2 text-3xs font-medium ${
        className ?? ""
      }`}
    >
      <span
        className={energy >= energyCost ? "text-lime-300" : "text-red-400"}
        title={`Силы: ${energy} / ${MAX_ENERGY}. Поход в этот сектор стоит ${energyCost} ⚡ — силы восстанавливаются +${ENERGY_REGEN_PER_HOUR} в час`}
      >
        ⚡{energy}
      </span>
      <span
        className={hungerColor}
        title={`Сытость: ${hunger} %. Ниже ${PRODUCTION_MIN_HUNGER} % жаба вырабатывает лишь ${Math.round(
          PRODUCTION_HUNGRY_FACTOR * 100,
        )} % биомассы`}
      >
        🍽{hunger}%
      </span>
    </span>
  );
};

const LogList: React.FC<{ expedition: Expedition }> = ({ expedition }) => {
  const entries = [...expedition.log].reverse().slice(0, 12);

  if (entries.length === 0) {
    return (
      <p className="text-2xs text-gray-400 italic">
        Тишина в эфире: команда ещё не вышла на связь.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
      {entries.map((entry) => {
        const role = entry.role === "system" ? null : ROLE_CONFIG[entry.role];
        const color =
          entry.kind === "good"
            ? "text-green-300"
            : entry.kind === "bad"
              ? "text-red-300"
              : "text-gray-300";

        return (
          <p key={entry.id} className={`text-2xs leading-snug ${color}`}>
            <span className="text-gray-500">{formatClock(entry.at)} </span>
            <span className="font-semibold">
              {role
                ? `${role.icon} ${entry.toadName ?? role.label}`
                : "📡 Связь"}
              :{" "}
            </span>
            <CurrencyText text={entry.text} iconClassName="h-3 w-3" />
            {typeof entry.hpDelta === "number" && entry.hpDelta !== 0 && (
              <span
                className={
                  entry.hpDelta < 0 ? "text-red-400" : "text-green-400"
                }
              >
                {" "}
                ({entry.hpDelta > 0 ? `+${entry.hpDelta}` : entry.hpDelta} HP)
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
};

const TeamStatusList: React.FC<{ expedition: Expedition }> = ({
  expedition,
}) => (
  <div className="flex flex-col gap-1.5">
    {getExpeditionTeamStatus(expedition).map(
      ({ member, toad, hp, maxHp, down }) => (
        <div key={member.toadId} className="flex items-center gap-2">
          <span className="text-sm w-5 text-center">
            {ROLE_CONFIG[member.role].icon}
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-2xs">
              <span className={down ? "text-red-400" : "text-gray-200"}>
                {toad?.name ?? `Жаба #${member.toadId}`}
                {down && " — выбита"}
              </span>
              <span className="text-gray-400">
                {hp}/{maxHp} HP
              </span>
            </div>
            <HpBar hp={hp} maxHp={maxHp} className="mt-0.5" />
          </div>
        </div>
      ),
    )}
  </div>
);

/**
 * Группа жаб в выпадающем списке роли: «В «Разведке»» / «Жабы колонии».
 * Строки списка рисует общий `shared/ToadPicker` — здесь только состав групп.
 */
interface RoleToadGroup {
  label: string;
  toads: Toad[];
}

type ExpeditionTab = "runs" | "send" | "room-data";

const ExpeditionModal: React.FC<{
  onClose?: () => void;
  /** Гекс «Разведки», из которого открыли модалку: его жильцы — экипаж для команды. */
  roomId: string;
}> = ({ roomId }) => {
  const { addNotification } = useNotifications();
  const state = useGameState();
  const [, setTick] = useState(0);

  const [sectorId, setSectorId] = useState<number>(SECTORS[0].id);
  const [slots, setSlots] = useState<ExpeditionSlots>(emptyExpeditionSlots());

  // Походы живут по реальному времени — обновляем отсчёты раз в секунду
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Открыли модалку — «догоняем» события походов, пока игрок был в меню.
  // Зависимостей нет: синк нужен один раз при открытии (тик раз в секунду дальше).
  useEffect(() => {
    processExpeditions(addNotification);
  }, []);

  const expeditions = state.expeditions ?? [];
  /**
   * Завершённые походы ждут разбора добычи: они не занимают лимит «Диспетчерской»
   * и показываются отдельным блоком над активными. Команда всё ещё в походе —
   * жабы освобождаются только после «Завершить»/«В биомассу».
   */
  const completedExpeditions = expeditions.filter(
    (expedition) => expedition.phase === "completed",
  );
  const activeExpeditions = expeditions.filter(
    (expedition) => expedition.phase !== "completed",
  );
  const stats = normalizeExpeditionStats(state.expeditionStats);
  const dispatchLevel = state.user.dispatchLevel ?? 0;
  const teamLimit = getMaxExpeditions(dispatchLevel);
  const dispatchCost = getDispatchOfficeCost(dispatchLevel);

  const selectedSector =
    SECTORS.find((item) => item.id === sectorId) ?? SECTORS[0];
  /** Страница слайдера = выбранный сектор: свайп и стрелки двигают выбор сектора */
  const sectorIndex = Math.max(
    0,
    SECTORS.findIndex((item) => item.id === selectedSector.id),
  );
  /**
   * Сектор открыт? Листать закрытые можно (видно, что впереди), а отправлять — нет:
   * без этой проверки свайп на закрытую страницу отправлял бы команду в закрытый сектор.
   */
  const sectorUnlocked = isSectorUnlocked(selectedSector, stats);
  /** Пропуска КОНТУРа на складе: игрок тратит их на открытие следующих секторов */
  const contourPasses = Math.max(
    0,
    Math.floor(state.user.storage?.[Items.contourPass] ?? 0),
  );
  const unlockStatus = getSectorUnlockStatus(selectedSector, stats);
  /** КОНТУР открывается по порядку: следующий сектор — только после предыдущего */
  const previousSectorUnlocked =
    sectorIndex === 0 || isSectorUnlocked(SECTORS[sectorIndex - 1], stats);
  const canUnlockSector =
    !sectorUnlocked &&
    previousSectorUnlocked &&
    contourPasses >= unlockStatus.required;
  const unlockedSectors = SECTORS.filter((item) =>
    isSectorUnlocked(item, stats),
  ).length;

  const availableToads = useMemo(
    () => state.toads.filter((toad) => canSendToad(toad, expeditions).ok),
    [state.toads, expeditions],
  );

  const members: ExpeditionMember[] = EXPEDITION_ROLE_ORDER.filter(
    (role) => slots[role] !== "",
  ).map((role) => ({ toadId: slots[role] as number, role }));

  const sendCost = getExpeditionSendCost(selectedSector, members.length);
  /** Силы одной жабы на поход в выбранный сектор: растут с глубиной (см. `getExpeditionToadEnergyCost`) */
  const energyCostPerToad = getExpeditionToadEnergyCost(selectedSector);
  /**
   * Жабы команды, которым сил не хватает: поход не отправят (`startExpedition` проверит
   * то же самое), поэтому предупреждаем до нажатия и гасим кнопку — иначе игрок узнает
   * о нехватке сил только по тосту-ошибке.
   */
  const tiredMembers = members.reduce<Toad[]>((acc, member) => {
    const toad = state.toads.find((item) => item.id === member.toadId);

    if (toad && !canToadAffordExpedition(toad, selectedSector)) {
      acc.push(toad);
    }

    return acc;
  }, []);
  const biomass = state.user.biomass || 0;
  const tokens = state.user.tokens || 0;
  const astro = state.user.astro_quax || 0;
  const canSend =
    members.length > 0 &&
    biomass >= sendCost &&
    tiredMembers.length === 0 &&
    activeExpeditions.length < teamLimit &&
    sectorUnlocked;

  // Сектора и жаб по секторам берём из колонии теми же вычислениями, что и карта.
  const { rooms, toadsByRoom, powerGrid } = useColony();
  const room = rooms.find((r) => r.id === roomId);

  /**
   * Сектор «Разведка», из которой открыли модалку: её жильцы — экипаж, из которого
   * собирают команду. Из бургер-меню гекса нет — берём «Разведку» с жабами внутри, а если
   * и такой нет — первую построенную: пустой сектор модалка тоже показывает, чтобы игрок
   * знал, куда сажать команду (построек «Разведки» может и не быть — тогда блока нет).
   */
  const crewRoom = useMemo(() => {
    const scoutRooms = rooms.filter((room) => room.kind === "scout");

    if (roomId) {
      return scoutRooms.find((room) => room.id === roomId) ?? null;
    }

    return (
      scoutRooms.find((room) => (toadsByRoom[room.id] ?? []).length > 0) ??
      scoutRooms[0] ??
      null
    );
  }, [rooms, roomId, toadsByRoom]);

  /** Обесточенная «Разведка»: отправлять и принимать походы нельзя, данные — можно */
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<ExpeditionTab>({
    room: crewRoom ?? undefined,
    powerGrid,
    defaultTab: "runs",
  });

  /**
   * Табы модалки: походы, отправка и «Данные сектора». Таб данных — только когда
   * модалку открыли по гексу «Разведки»: данным нужен свой сектор (его жильцы,
   * апгрейды и снос), а из бургер-меню гекса нет.
   */
  const expeditionTabs: ModalTabItem<ExpeditionTab>[] = [
    {
      id: "runs",
      label: `🚁 Походы${expeditions.length ? ` (${expeditions.length})` : ""}`,
      color: "text-amber-400",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    {
      id: "send",
      label: "🎯 Новый поход",
      color: "text-emerald-400",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    ...(crewRoom ? [{ ...ROOM_DATA_TAB }] : []),
  ];

  /** Экипаж сектора: те же жабы, что рисует карта (ушедшие в поход сектор покинули) */
  const crew = useMemo(
    () => (crewRoom ? toadsByRoom[crewRoom.id] : undefined) ?? [],
    [crewRoom, toadsByRoom],
  );

  /** Кого из экипажа можно взять в поход — правило то же, что и у команды (`canSendToad`) */
  const crewSendable = crew.filter((toad) => canSendToad(toad, expeditions).ok);

  /**
   * Жабы сектора — отдельной группой вверху списков ролей: команду собирают из экипажа,
   * а жабы всей колонии остаются ниже. Команда из одних экипажных жаб собирается в один тап.
   */
  const { crewAvailable, otherAvailable } = useMemo(() => {
    const crewIds = new Set(crew.map((toad) => toad.id));

    return {
      crewAvailable: availableToads.filter((toad) => crewIds.has(toad.id)),
      otherAvailable: availableToads.filter((toad) => !crewIds.has(toad.id)),
    };
  }, [availableToads, crew]);

  /**
   * Списки жаб для выпадающих списков ролей: группы те же (экипаж «Разведки» сверху),
   * но внутри группы жабы отсортированы по силе роли — сверху тот, кому роль подходит
   * больше (`sortToadsByRolePower`). Пустые группы в список не попадают.
   */
  const roleGroups = useMemo(
    () =>
      EXPEDITION_ROLE_ORDER.reduce(
        (acc, role) => {
          acc[role] = [
            {
              label: `🧭 В «Разведке» (${crewAvailable.length})`,
              toads: sortToadsByRolePower(crewAvailable, role),
            },
            {
              label: "Жабы колонии",
              toads: sortToadsByRolePower(otherAvailable, role),
            },
          ].filter((group) => group.toads.length > 0);

          return acc;
        },
        {} as Record<ExpeditionRole, RoleToadGroup[]>,
      ),
    [crewAvailable, otherAvailable],
  );

  /** Команда с самими жабами: по ней считаем шанс удачного завершения */
  const team: ExpeditionTeamMember[] = members
    .map((member) => {
      const toad = state.toads.find((item) => item.id === member.toadId);
      return toad ? { role: member.role, toad } : null;
    })
    .filter((member): member is ExpeditionTeamMember => member !== null);

  /**
   * Шанс вернуться с удачей: каждая занятая роль даёт +20% от своей силы,
   * глубина сектора режет вклад, удача гуляет ±10%.
   */
  const successChance = getExpeditionSuccessChance(team, selectedSector);
  const sectorSuccessFactor = getSectorSuccessFactor(selectedSector);
  /** Поход всегда выгоднее фермы: норма добычи за путь туда-обратно + снаряжение */
  const awayHours =
    selectedSector.durationHours * (1 + EXPEDITION_RETURN_RATIO);
  const profitNorm = getExpeditionProfitFloor(
    team.map((member) => member.toad),
    awayHours,
    sendCost,
  );

  const notify = (result: { success: boolean; message: string }) =>
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });

  const handleSend = () => {
    const result = startExpedition(
      sectorId,
      members,
      crewRoom?.sceneId || undefined,
    );
    notify(result);
    if (result.success) {
      setSlots(emptyExpeditionSlots());
      setTab("runs");
    }
  };

  /** Открыть выбранный сектор за пропуска КОНТУРа со склада */
  const handleUnlockSector = () => notify(unlockSector(selectedSector.id));

  /**
   * Разбор добычи завершённого похода. После успеха жабы уже стоят в «Разведке»,
   * а карточка исчезает из списка: модалка остаётся открытой, чтобы игрок видел
   * обновлённый экипаж (и мог сразу отправить его снова).
   */
  const handleFinish = (id: string, mode: "storage" | "biomass") =>
    notify(finishExpedition(id, mode));

  const handleWithdraw = (id: string) => notify(withdrawExpedition(id));
  const handleSpeedUp = (id: string) => notify(speedUpReturn(id));
  const handleExtract = (id: string) =>
    notify(extractExpedition(id, addNotification));
  const handleBuyDispatch = () => notify(buyDispatchOffice());

  /**
   * Строка экипажа сектора: кто живёт в «Разведке» и что с ним можно сделать.
   * Свободная жаба показывает свою сильную роль, жаба в команде — занятую ею роль;
   * тап по кнопке ставит жабу в команду или выводит её оттуда.
   */
  const renderCrewCard = (toad: Toad) => {
    const assigned = getAssignedRole(slots, toad.id);
    const check = canSendToad(toad, expeditions);
    // Подсказка — та же роль, куда жабу поставит тап, чтобы кнопка не обещала другого
    const role = assigned ?? getCrewTapRole(slots, toad);
    const config = ROLE_CONFIG[role];
    /**
     * Жаба уже в команде, но не на своей сильнейшей роли — карточка янтарная:
     * видно, кого стоит переставить (тап уберёт жабу из команды, дальше — новый тап).
     */
    const best = getBestRole(toad);
    const offRole = Boolean(assigned) && assigned !== best;

    return (
      <div
        key={toad.id}
        className={`rounded-xl px-2 py-1.5 border flex items-center gap-2 ${
          !assigned
            ? "bg-slate-800/40 border-gray-600/30"
            : offRole
              ? "bg-amber-950/30 border-amber-500/40"
              : "bg-emerald-950/30 border-emerald-500/40"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-100 truncate">
            {toad.name}
          </p>
          <p className="text-2xs text-gray-400 truncate">
            {!check.ok && !assigned
              ? `⚠️ ${check.reason}`
              : assigned
                ? `в команде: ${config.icon} ${config.label} ${getRolePowerPercent(
                    toad,
                    assigned,
                  )}%${
                    offRole
                      ? ` · сильнее: ${ROLE_CONFIG[best].icon} ${
                          ROLE_CONFIG[best].label
                        }`
                      : ""
                  }`
                : `пойдёт на роль: ${config.icon} ${config.label} ${getRolePowerPercent(
                    toad,
                    role,
                  )}%`}
          </p>
          <ToadVitals
            toad={toad}
            energyCost={energyCostPerToad}
            className="mt-0.5"
          />
        </div>

        <ClickButton
          onClick={() => handleCrewTap(toad)}
          disabled={!assigned && !check.ok}
          title={
            assigned
              ? `Убрать из команды (${config.label})`
              : check.ok
                ? `В команду: ${config.label}`
                : check.reason
          }
          className={`shrink-0 py-1.5 px-2 rounded-lg text-2xs font-bold border transition-colors duration-300 ${
            assigned
              ? "bg-amber-800/60 border-amber-400/70 text-amber-50 hover:bg-amber-700/70"
              : check.ok
                ? "bg-slate-800/60 border-gray-500/50 text-gray-200 hover:bg-slate-700/70"
                : "bg-slate-800/40 border-gray-700/40 text-gray-500"
          }`}
        >
          {assigned ? "✓ В команде" : "→ В команду"}
        </ClickButton>
      </div>
    );
  };

  /** Тап по жабе сектора: в команде — вывести, свободна — поставить на сильную роль */
  const handleCrewTap = (toad: Toad) => {
    if (getAssignedRole(slots, toad.id)) {
      setSlots((prev) => removeToadFromTeam(prev, toad.id));
      return;
    }

    const check = canSendToad(toad, expeditions);

    if (!check.ok) {
      addNotification({
        type: "warn",
        content: `${toad.name}: ${check.reason}`,
      });
      return;
    }

    setSlots((prev) =>
      assignToadToRole(prev, toad.id, getCrewTapRole(prev, toad)),
    );
  };

  /** «Собрать команду»: свободные роли занимают самые сильные жабы сектора */
  const handleFillFromRoom = () => {
    const next = fillTeamFromCrew(slots, crewSendable);
    const filled = EXPEDITION_ROLE_ORDER.filter(
      (role) => slots[role] === "" && next[role] !== "",
    ).length;

    if (filled === 0) {
      addNotification({
        type: "info",
        content: "Все роли команды заняты: свободных мест нет.",
      });
      return;
    }

    setSlots(next);
    addNotification({
      type: "success",
      content: `В команду из «Разведки» встали ${filled} жаб(ы) 🧭`,
    });
  };

  /**
   * Выбор жабы в списке роли: пусто — снять жабу с роли, иначе поставить её туда
   * (одна жаба — одна роль, поэтому из прежней роли она уходит).
   */
  const handleRolePick = (role: ExpeditionRole, value: string) => {
    setSlots((prev) => {
      if (value === "") {
        const current = prev[role];

        return current === "" ? prev : removeToadFromTeam(prev, current);
      }

      return assignToadToRole(prev, Number(value), role);
    });
  };

  /**
   * Страницы слайдера секторов: один сектор — одна страница.
   *
   * Страница **и есть** выбор сектора (свайп вправо-влево, стрелки ‹ › и точки), поэтому
   * на экране всегда тот сектор, который полетит в поход. Закрытые секторы листать можно —
   * видно, что впереди, — но отправить туда не даст `canSend` (`sectorUnlocked`).
   */
  const sectorSlides = SECTORS.map((item) => {
    const unlocked = isSectorUnlocked(item, stats);
    const selected = item.id === selectedSector.id;
    const sectorCost = getExpeditionSendCost(item, Math.max(1, members.length));
    /** Силы на поход в этот сектор: их тратит каждая жаба команды */
    const sectorEnergy = getExpeditionToadEnergyCost(item);
    const backHours =
      Math.round(item.durationHours * EXPEDITION_RETURN_RATIO * 10) / 10;

    return (
      <div
        key={item.id}
        className={`flex h-full flex-col gap-2 rounded-2xl border p-3 ${
          !unlocked
            ? "border-gray-700/40 bg-slate-900/40 text-gray-500"
            : selected
              ? "border-amber-400/70 bg-amber-900/50 text-amber-50"
              : "border-gray-600/40 bg-slate-800/50 text-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {item.icon} {item.name}
            </p>
            <p className="text-2xs text-gray-400">{item.description}</p>
          </div>
          <span
            className={`shrink-0 rounded-lg px-2 py-1 text-2xs font-bold ${
              !unlocked
                ? "bg-slate-900/60 text-gray-400"
                : selected
                  ? "bg-amber-400/20 text-amber-100"
                  : "bg-slate-900/50 text-gray-300"
            }`}
          >
            {!unlocked ? "🔒 закрыт" : selected ? "✓ выбран" : "открыт"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center text-2xs">
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-gray-400">Путь туда</p>
            <p className="font-bold">{item.durationHours} ч</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-gray-400">Добыча</p>
            <p className="font-bold">×{item.lootMultiplier}</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-gray-400">Риск</p>
            <p className="font-bold">×{item.dangerMultiplier}</p>
          </div>
        </div>

        <p className="text-2xs text-gray-400">
          Глубина {item.depth} · обратно ~{backHours} ч · снаряжение{" "}
          {sectorCost} 🧪 на команду из {Math.max(1, members.length)} жаб · силы{" "}
          {sectorEnergy} ⚡ на жабу · награда {getContourPassReward(item)} 🎫
        </p>

        <p
          className={`mt-auto text-2xs leading-snug ${
            !unlocked
              ? "text-amber-200/90"
              : selected
                ? "text-lime-300"
                : "text-gray-500"
          }`}
        >
          {!unlocked
            ? `🔒 Открытие: ${item.unlockCost} 🎫 КОНТУРа (на складе ${contourPasses}). Разглядывать можно — отправить нет.`
            : selected
              ? "Команда полетит отсюда: соберём её в слотах ролей ниже."
              : "Листайте вправо-влево — на странице один поход."}
        </p>
      </div>
    );
  });

  return (
    <Modal
      title={room?.name ?? crewRoom?.name ?? "Разведка"}
      icon={<span className="text-xl">🧭</span>}
    >
      <div className="flex flex-col gap-3 px-1">
        {/* Сводка по разведке */}
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="bg-color-main rounded-xl py-2 px-1 border border-gray-600/30">
            <p className="text-2xs text-gray-400">🎫 Пропуска КОНТУРа</p>
            <p className="text-base font-bold text-white">{contourPasses}</p>
          </div>
          <div className="bg-color-main rounded-xl py-2 px-1 border border-gray-600/30">
            <p className="text-2xs text-gray-400">Походов завершено</p>
            <p className="text-base font-bold text-white">{stats.completed}</p>
          </div>
          <div className="bg-color-main rounded-xl py-2 px-1 border border-gray-600/30">
            <p className="text-2xs text-gray-400">Лучшая глубина</p>
            <p className="text-base font-bold text-white">{stats.bestDepth}</p>
          </div>
          <div className="bg-color-main rounded-xl py-2 px-1 border border-gray-600/30">
            <p className="text-2xs text-gray-400">Активные команды</p>
            <p className="text-base font-bold text-white">
              {activeExpeditions.length}/{teamLimit}
            </p>
          </div>
        </div>

        {/* Переключение вкладок: вид один на все секторы (`shared/ModalTabs`) */}
        <ModalTabs tabs={expeditionTabs} active={tab} onChange={setTab} />

        {/* ВКЛАДКА: активные походы */}
        {tab === "runs" && (
          <div className="flex flex-col gap-3">
            {completedExpeditions.map((expedition) => {
              const sectorDef = getSectorById(expedition.sectorId);
              const storage = getExpeditionStorageCheck(expedition);
              const biomassValue = getExpeditionBiomassValue(expedition);
              const survived = expedition.success !== false;

              return (
                <div
                  key={expedition.id}
                  className={`rounded-2xl p-3 border flex flex-col gap-2 ${
                    survived
                      ? "bg-emerald-950/30 border-emerald-500/40"
                      : "bg-red-950/20 border-red-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">
                        {sectorDef.icon} {sectorDef.name}
                      </p>
                      <p className="text-2xs text-gray-400">
                        глубина {sectorDef.depth} • команда из{" "}
                        {expedition.team.length} жаб
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-2xs font-bold px-2 py-1 rounded-lg ${
                        survived
                          ? "bg-emerald-900/60 text-emerald-200"
                          : "bg-red-900/50 text-red-200"
                      }`}
                    >
                      {survived ? "✅ поход удался" : "⚠️ провал"}
                    </span>
                  </div>

                  <p className="text-2xs text-gray-300 leading-snug">
                    {survived
                      ? "Команда вернулась с добычей. Заберите её на склад или переработайте в биомассу — после этого жабы вернутся в «Разведку»."
                      : "Сектор потрепал команду: добыча скромнее, жабы вернулись ранеными. Разберите трофеи, чтобы вернуть их в строй."}
                  </p>

                  <TeamStatusList expedition={expedition} />

                  <p className="text-2xs text-gray-300">
                    🎒 Добыча:{" "}
                    <CurrencyText
                      text={getExpeditionLootSummary(expedition)}
                      iconClassName="h-3 w-3"
                    />
                  </p>
                  {expedition.loot.samples > 0 && (
                    <p className="text-2xs text-cyan-200">
                      🧬 Образцов в секторе: {expedition.loot.samples}
                    </p>
                  )}

                  <p
                    className={`text-2xs ${
                      storage.ok ? "text-gray-500" : "text-amber-300"
                    }`}
                  >
                    {storage.needed > 0
                      ? storage.ok
                        ? `📦 На склад: ${storage.needed} предмет(ов), свободно ${storage.free}`
                        : `📦 Склад полон: нужно ${storage.needed}, свободно ${storage.free}. Освободите место или переработайте лут.`
                      : "📦 Предметов нет — на склад идти не за чем."}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    <ClickButton
                      onClick={() => handleFinish(expedition.id, "storage")}
                      disabled={!storage.ok}
                      title={
                        storage.ok
                          ? "Забрать предметы на склад, а биомассу, Кваксы и образцы — в колонию"
                          : "На складе не хватает места: постройте «Склад» или переработайте лут в биомассу"
                      }
                      className={`flex-1 py-2 rounded-xl text-2xs font-bold border ${
                        storage.ok
                          ? "bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-100 border-emerald-500/40"
                          : "bg-slate-800/40 text-gray-500 border-gray-600/30 cursor-not-allowed"
                      }`}
                    >
                      Завершить
                    </ClickButton>
                    <ClickButton
                      onClick={() => handleFinish(expedition.id, "biomass")}
                      title="Переработать всю добычу похода, включая предметы и образцы, в биомассу"
                      className="flex-1 py-2 rounded-xl bg-lime-900/50 hover:bg-lime-800/60 text-lime-100 text-2xs font-bold border border-lime-500/40"
                    >
                      🧪 Превратить лут в биомассу (+{biomassValue} 🧪)
                    </ClickButton>
                  </div>
                </div>
              );
            })}

            {activeExpeditions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">
                {completedExpeditions.length > 0
                  ? "Активных походов нет: разберите добычу завершённых и отправляйте команду снова."
                  : "Никто не в походе. Соберите команду из жаб и отправьте её за Периметр — добыча и образцы того стоят."}
              </p>
            )}

            {activeExpeditions.map((expedition) => {
              const sectorDef = getSectorById(expedition.sectorId);
              const returning = expedition.phase === "returning";
              const progress = returning
                ? getReturnProgress(expedition)
                : getExpeditionProgress(expedition);
              const eta = getExpeditionEtaMs(expedition);
              const speedUpCost = getSpeedUpReturnCost(expedition);

              return (
                <div
                  key={expedition.id}
                  className="bg-color-main rounded-2xl p-3 border border-gray-600/30 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {sectorDef.icon} {sectorDef.name}
                      </p>
                      <p className="text-2xs text-gray-400">
                        глубина {sectorDef.depth} • команда из{" "}
                        {expedition.team.length} жаб
                        {expedition.forced && (
                          <span className="text-red-400"> • выбиты</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-2xs font-bold px-2 py-1 rounded-lg ${
                        returning
                          ? "bg-blue-900/50 text-blue-200"
                          : "bg-amber-900/50 text-amber-200"
                      }`}
                    >
                      {returning ? "🏠 возврат" : "🧭 в пути"}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-2xs text-gray-400 mb-1">
                      <span>
                        {returning
                          ? "Путь домой"
                          : `Прогресс ${Math.round(progress * 100)}%`}
                      </span>
                      <span>
                        {returning ? "домой через " : "сектор через "}
                        {formatDuration(eta)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          returning ? "bg-blue-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>

                  <TeamStatusList expedition={expedition} />

                  <p className="text-2xs text-gray-300">
                    🎒 В рюкзаке:{" "}
                    <CurrencyText
                      text={getExpeditionLootSummary(expedition)}
                      iconClassName="h-3 w-3"
                    />
                  </p>

                  <LogList expedition={expedition} />

                  <div className="flex flex-wrap gap-1.5">
                    {!returning && (
                      <ClickButton
                        onClick={() => handleWithdraw(expedition.id)}
                        className="flex-1 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 text-gray-200 text-2xs font-bold border border-gray-600/40"
                      >
                        ⏪ Отозвать
                      </ClickButton>
                    )}
                    {returning && speedUpCost > 0 && (
                      <ClickButton
                        onClick={() => handleSpeedUp(expedition.id)}
                        className="flex-1 py-2 rounded-xl bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-100 text-2xs font-bold border border-emerald-500/40"
                      >
                        ⚡ Ускорить ({speedUpCost} 🧪)
                      </ClickButton>
                    )}
                    <ClickButton
                      onClick={() => handleExtract(expedition.id)}
                      className="flex-1 py-2 rounded-xl bg-cyan-900/50 hover:bg-cyan-800/60 text-cyan-100 text-2xs font-bold border border-cyan-500/40"
                    >
                      🚁 Маяк ({EXTRACTION_ASTRO_COST}{" "}
                      <CurrencyIcon
                        currency="astro_quax"
                        className="h-3 w-3"
                      />{" "}
                      / есть {astro})
                    </ClickButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ВКЛАДКА: отправка новой команды */}
        {tab === "send" && (
          <div className="flex flex-col gap-3">
            {/* Секторы: горизонтальный слайдер — одна страница на один поход.
                Страница выбирает сектор, поэтому свайп вправо-влево = выбор похода. */}
            <SwipeSlides
              index={sectorIndex}
              onIndexChange={(page) => setSectorId(SECTORS[page].id)}
              labels={SECTORS.map(
                (item) =>
                  `${item.icon} ${item.name}${
                    isSectorUnlocked(item, stats) ? "" : " (закрыт)"
                  }`,
              )}
              hint={
                <p className="text-2xs text-gray-400">
                  🗺️ Секторы Периметра: открыто {unlockedSectors} из{" "}
                  {SECTORS.length}. На странице один поход — листайте
                  вправо-влево.
                </p>
              }
              slides={sectorSlides}
            />

            {!sectorUnlocked && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-100">
                    🔒 «{selectedSector.name}» закрыт
                  </span>
                  <span className="shrink-0 text-2xs font-bold text-amber-200">
                    {contourPasses} / {unlockStatus.required} 🎫
                  </span>
                </div>
                <p className="text-2xs leading-snug text-gray-300">
                  {!previousSectorUnlocked
                    ? `Сначала откройте «${
                        SECTORS[sectorIndex - 1]?.name ?? "предыдущий сектор"
                      }»: КОНТУР проходят по порядку.`
                    : `Пропуск КОНТУРа — расходуемый ресурс склада. Его приносят завершённые походы, а тратится он на открытие следующего сектора.`}
                </p>
                <ClickButton
                  onClick={handleUnlockSector}
                  disabled={!canUnlockSector}
                  className={`w-full py-2 rounded-xl text-2xs font-bold border transition-colors duration-300 ${
                    canUnlockSector
                      ? "bg-amber-800/60 border-amber-400/70 text-amber-50 hover:bg-amber-700/70"
                      : "bg-slate-800/40 border-gray-700/40 text-gray-500"
                  }`}
                >
                  🎫 Открыть за {unlockStatus.required} 🎫
                </ClickButton>
              </div>
            )}

            {/* Слоты ролей команды: как места репродуктора — панель с заголовком и карточка на роль */}
            <div className="bg-color-main rounded-xl px-3 py-2 border border-amber-500/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200 font-semibold">
                  👥 Места команды
                </span>
                <span className="text-2xs text-gray-400">
                  собрано {members.length} из {EXPEDITION_TEAM_SIZE}
                </span>
              </div>

              {EXPEDITION_ROLE_ORDER.map((role) => {
                const config = ROLE_CONFIG[role];
                const pickedId = slots[role];
                const picked =
                  pickedId === ""
                    ? undefined
                    : availableToads.find((toad) => toad.id === pickedId);

                return (
                  <div
                    key={role}
                    className={`rounded-lg p-2 bg-black/20 border flex flex-col gap-1.5 ${
                      picked
                        ? "border-amber-500/30"
                        : "border-dashed border-emerald-500/40"
                    }`}
                  >
                    {/* Слот роли — тот же выпадающий список, что и в репродукторе */}
                    <ToadPicker
                      icon={config.icon}
                      caption={config.label}
                      label={config.label}
                      picked={picked}
                      placeholder="＋ назначить"
                      pickedSummary={
                        picked ? (
                          <span className="flex shrink-0 items-center gap-2">
                            <ToadVitals
                              toad={picked}
                              energyCost={energyCostPerToad}
                            />
                            <span className="text-2xs font-bold text-amber-200">
                              {getRolePowerPercent(picked, role)}%
                            </span>
                          </span>
                        ) : undefined
                      }
                      groups={roleGroups[role].map((group) => ({
                        label: group.label,
                        items: group.toads.map((toad) => {
                          const other = getAssignedRole(slots, toad.id);
                          const own =
                            other === role ||
                            String(toad.id) === String(pickedId);
                          const percent = getRolePowerPercent(toad, role);

                          return {
                            toad,
                            rank: getRoleStat(toad, role),
                            tone: own ? "selected" : other ? "warn" : "default",
                            note: (
                              <span className="flex items-center gap-1.5">
                                <span className="truncate">
                                  {getRoleStat(toad, role).toFixed(2)}{" "}
                                  {config.statLabel} ·{" "}
                                  {getToadHpStatusLabel(toad)}
                                  {own
                                    ? " · ✓ на этой роли"
                                    : other
                                      ? ` · в команде: ${
                                          ROLE_CONFIG[other].icon
                                        } ${ROLE_CONFIG[other].label}`
                                      : ""}
                                </span>
                                <ToadVitals
                                  toad={toad}
                                  energyCost={energyCostPerToad}
                                />
                              </span>
                            ),
                            meter: {
                              value: percent,
                              label: `${percent}%`,
                            },
                          };
                        }),
                      }))}
                      hint={`Сверху — сильнее для роли «${config.label}» (${
                        config.statLabel
                      }). Янтарная жаба уже в другой роли: выбор перенесёт её сюда. Под именем — ⚡ силы (красные: на этот сектор не хватит) и 🍽 сытость.`}
                      emptyText="Нет доступных жаб: остальные в походе, ранены или ещё не выросли."
                      clear={
                        pickedId !== ""
                          ? {
                              label: "Снять жабу с роли",
                              onClear: () => handleRolePick(role, ""),
                            }
                          : undefined
                      }
                      onPick={(toad) => handleRolePick(role, String(toad.id))}
                    />

                    {/* Роль — строка под слотом, как статус жабы в репродукторе */}
                    <div className="text-2xs text-gray-300 leading-snug">
                      {config.description}
                    </div>

                    {picked && (
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 text-2xs text-red-300">
                          ❤ {Math.round(getToadHp(picked))}/
                          {getToadMaxHp(picked)}
                        </span>
                        {/* Полоска HP: видно, дотянет ли жаба до конца похода */}
                        <HpBar
                          hp={getToadHp(picked)}
                          maxHp={getToadMaxHp(picked)}
                          className="flex-1"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Жабы сектора «Разведка»: экипаж, из которого команда собирается в один тап */}
            {crewRoom && (
              <div className="bg-color-main rounded-xl px-3 py-2 border border-gray-600/30 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white">
                    🧭 В «Разведке»: {crew.length}/{EXPEDITION_TEAM_SIZE}
                  </p>
                  {crewSendable.length > 0 &&
                    members.length < EXPEDITION_TEAM_SIZE && (
                      <ClickButton
                        onClick={handleFillFromRoom}
                        title="Занять свободные роли сильнейшими жабами сектора"
                        className="shrink-0 py-1.5 px-2 rounded-lg text-2xs font-bold border bg-amber-900/50 border-amber-500/50 text-amber-100 hover:bg-amber-800/60 transition-colors duration-300"
                      >
                        Собрать команду
                      </ClickButton>
                    )}
                </div>

                {crew.length === 0 && (
                  <p className="text-2xs leading-snug text-gray-400">
                    Сектор пуст: перенесите сюда на карте до{" "}
                    {EXPEDITION_TEAM_SIZE} взрослых жаб — команда соберётся из
                    них, а из похода жаба возвращается в биопод (место в
                    «Разведке» она освобождает).
                  </p>
                )}

                {crew.map((toad) => renderCrewCard(toad))}
              </div>
            )}

            {/* Итог отправки */}
            <div className="bg-color-main rounded-xl px-3 py-2 border border-gray-600/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-2xs text-gray-300">
                <span>Снаряжение: {sendCost} 🧪</span>
                <span>В запасе: {Math.round(biomass)} 🧪</span>
              </div>
              {/* Силы платит каждая жаба: их видно у жаб в списках и в значках ⚡ напротив имён */}
              <div className="flex items-center justify-between text-2xs text-gray-300">
                <span>
                  Силы команды: −{energyCostPerToad} ⚡ на жабу
                  {members.length > 0
                    ? ` (−${getExpeditionEnergyCost(
                        selectedSector,
                        members.length,
                      )} ⚡ всего)`
                    : ""}
                </span>
                <span>Восстановление +{ENERGY_REGEN_PER_HOUR} ⚡/ч</span>
              </div>
              <p className="text-2xs text-gray-400">
                {selectedSector.icon} {selectedSector.name}: путь туда{" "}
                {selectedSector.durationHours} ч, обратно ~
                {Math.round(
                  selectedSector.durationHours * EXPEDITION_RETURN_RATIO * 10,
                ) / 10}{" "}
                ч
              </p>

              {/* Итог по ролям: шанс удачного возврата и норма добычи против фермы */}
              <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-2 py-1.5 text-2xs">
                <span className="text-gray-300">🎯 Шанс удачного возврата</span>
                <span
                  className={`font-bold ${
                    successChance >= 1 ? "text-emerald-300" : "text-amber-200"
                  }`}
                >
                  {Math.round(successChance * 100)}%
                  {successChance >= 1 ? " (гарантия)" : ""}
                </span>
              </div>
              <p className="text-2xs leading-snug text-gray-400">
                Каждая роль даёт +20% (сила роли умножает вклад, глубина сектора
                — ×{sectorSuccessFactor.toFixed(2)}). Удачное завершение
                умножает добычу.
              </p>
              {team.length > 0 && (
                <p className="text-2xs leading-snug text-lime-300">
                  Поход принесёт не меньше {Math.round(profitNorm)} в{" "}
                  <CurrencyIcon currency="tokens" className="h-3 w-3" />
                  -эквиваленте: это выгоднее фермы за {awayHours.toFixed(1)} ч
                  и окупает снаряжение.
                </p>
              )}

              {activeExpeditions.length >= teamLimit && (
                <p className="text-2xs text-amber-300">
                  Все команды уже в походе: дождитесь возврата или постройте
                  «Диспетчерскую».
                </p>
              )}
              {members.length > 0 && biomass < sendCost && (
                <p className="text-2xs text-red-300">
                  Не хватает биомассы на снаряжение.
                </p>
              )}
              {tiredMembers.length > 0 && (
                <p className="text-2xs text-red-300">
                  Не хватает сил на поход ({energyCostPerToad} ⚡ на жабу):{" "}
                  {tiredMembers
                    .map(
                      (toad) =>
                        `${toad.name} — ${Math.round(getToadEnergy(toad))} ⚡`,
                    )
                    .join(", ")}
                  . Силы капают дома: +{ENERGY_REGEN_PER_HOUR} ⚡/ч, либо
                  возьмите в ближний сектор.
                </p>
              )}
              {!sectorUnlocked && (
                <p className="text-2xs text-amber-300">
                  🔒 «{selectedSector.name}» закрыт: нужно{" "}
                  {selectedSector.unlockCost} 🎫 КОНТУРа (на складе{" "}
                  {contourPasses}). Отправить можно с открытой страницы.
                </p>
              )}

              <ClickButton
                onClick={handleSend}
                disabled={!canSend}
                className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-colors duration-300 ${
                  canSend
                    ? "bg-amber-800/60 border-amber-400/70 text-amber-50 hover:bg-amber-700/70"
                    : "bg-slate-800/40 border-gray-700/40 text-gray-500"
                }`}
              >
                🚀 Отправить в «{selectedSector.name}»
              </ClickButton>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: данные сектора — описание, статистика, улучшения и снос */}
        {tab === "room-data" && crewRoom && (
          <RoomDataTab
            room={crewRoom}
            stats={
              <div className="grid grid-cols-3 gap-1.5 text-center text-2xs">
                <div className="rounded-lg bg-slate-900/40 px-1 py-1">
                  <p className="text-gray-400">🧭 В секторе</p>
                  <p className="font-bold text-white">{crew.length}</p>
                </div>
                <div className="rounded-lg bg-slate-900/40 px-1 py-1">
                  <p className="text-gray-400">✅ Готовы к походу</p>
                  <p className="font-bold text-white">{crewSendable.length}</p>
                </div>
                <div className="rounded-lg bg-slate-900/40 px-1 py-1">
                  <p className="text-gray-400">🚁 Активных команд</p>
                  <p className="font-bold text-white">
                    {activeExpeditions.length}/{teamLimit}
                  </p>
                </div>
              </div>
            }
          />
        )}
      </div>
    </Modal>
  );
};

export default ExpeditionModal;
