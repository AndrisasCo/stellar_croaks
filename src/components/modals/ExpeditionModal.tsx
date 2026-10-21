import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../shared/Header";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon, CurrencyText } from "../shared/CurrencyIcon";
import { HpBar } from "../shared/HpBar";
import { ToadAvatar } from "../shared/ToadAvatar";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import RoomDataTab, { ROOM_DATA_TAB } from "./RoomDataTab";
import { ToadInfo } from "./ToadInfoModal";
import { ExpeditionLootGrid } from "./ExpeditionLootGrid";
import { ExpeditionLogList, formatExpeditionDate } from "./ExpeditionLogList";
import { ExpeditionLogModal } from "./ExpeditionLogModal";
import { SlidePager } from "../shared/SlidePager";
import { useNotifications } from "../../hooks/use-notification";
import { useGameState } from "../../hooks/use-game-state";
import { useColony } from "../../hooks/use-colony";
import { useRoomPowerTab } from "../../hooks/use-room-power-tab";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import { Toad, getToadTypeLabel } from "../../models/Toad";
import {
  Expedition,
  ExpeditionMember,
  EXPEDITION_ROLE_ORDER,
  ExpeditionRole,
  getPreviousSector,
  getSectorById,
  isPreviousSectorCompleted,
  isPreviousSectorUnlocked,
  isSectorUnlocked,
  normalizeExpeditionStats,
  SECTORS,
} from "../../models/expedition";
import { Items } from "../../models/user";
import {
  EXPEDITION_BASE_DISEASE_CHANCE,
  EXPEDITION_RETURN_RATIO,
  EXPEDITION_SAMPLE_TOAD_CHANCE,
  EXPEDITION_TEAM_SIZE,
  EXTRACTION_ASTRO_COST,
  ExpeditionTeamMember,
  canToadAffordExpedition,
  getContourPassReward,
  getDispatchOfficeCost,
  getEvacuationCost,
  getExpeditionProfitFloor,
  getExpeditionSampleReward,
  getExpeditionSendCost,
  getExpeditionEnergyCost,
  getExpeditionSuccessChance,
  getExpeditionToadEnergyCost,
  getRoleStat,
  getSectorDamageMultiplier,
  getSectorSuccessFactor,
  getSpeedUpReturnCost,
  getToadHp,
  getToadHpStatusLabel,
  getToadMaxHp,
  HP_REGEN_PER_HOUR,
  isAwaitingEvacuation,
  ROLE_CONFIG,
} from "../../utils/expedition-config";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  buyDispatchOffice,
  canSendToad,
  evacuateExpedition,
  extractExpedition,
  finishExpedition,
  getExpeditionBiomassValue,
  getExpeditionEtaMs,
  getExpeditionLootSummary,
  getExpeditionProgress,
  getExpeditionStorageCheck,
  getExpeditionTeamStatus,
  getReturnProgress,
  getRoomExpeditions,
  getSectorUnlockStatus,
  isExpeditionFromRoom,
  isToadBusyOnExpedition,
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
import { ToadSlotGrid } from "../shared/ToadSlotGrid";
import type { ToadSlotPickerConfig } from "../shared/ToadSlotGrid";
import type { ToadPickerItem } from "../shared/ToadPicker";
import { TOAD_PICKER_REJECTED_GROUP } from "../../utils/toad-picker";
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
}> = ({ toad, energyCost }) => {
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
    <>
      <span
        className={energy >= energyCost ? "text-lime-300" : "text-red-400"}
        title={`Силы: ${energy} / ${MAX_ENERGY}. Поход в этот сектор стоит ${energyCost} ⚡ — силы восстанавливаются +${ENERGY_REGEN_PER_HOUR} в час`}
      >
        ⚡{energy}
      </span>
      <span
        className={`ml-2 ${hungerColor}`}
        title={`Сытость: ${hunger} %. Ниже ${PRODUCTION_MIN_HUNGER} % жаба вырабатывает лишь ${Math.round(
          PRODUCTION_HUNGRY_FACTOR * 100,
        )} % биомассы`}
      >
        🍽{hunger}%
      </span>
    </>
  );
};

const TeamStatusList: React.FC<{ expedition: Expedition }> = ({
  expedition,
}) => (
  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
    {getExpeditionTeamStatus(expedition).map(
      ({ member, toad, hp, maxHp, ratio, down }) => {
        const role = ROLE_CONFIG[member.role];
        const tone = down
          ? "border-red-500/60 bg-red-950/40 text-red-200"
          : ratio < 0.35
            ? "border-orange-500/50 bg-orange-950/30 text-orange-100"
            : ratio < 0.7
              ? "border-amber-500/50 bg-amber-950/30 text-amber-100"
              : "border-emerald-500/50 bg-emerald-950/30 text-emerald-100";

        return (
          <div
            key={member.toadId}
            title={`${role.icon} ${role.label} · ${
              toad?.name ?? `Жаба #${member.toadId}`
            } · ${hp}/${maxHp} HP${down ? " · выбита" : ""}`}
            className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-1.5 text-center ${tone}`}
          >
            {/* Роль — маленьким значком в углу, чтобы не отнимать место у аватара */}
            <span
              title={role.label}
              className="absolute left-1 top-1 rounded bg-slate-950/70 px-0.5 text-2xs leading-none"
            >
              {role.icon}
            </span>

            {toad ? (
              <span className={down ? "opacity-60 grayscale" : ""}>
                <ToadAvatar toad={toad} size={10} />
              </span>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-slate-500/60 text-xs text-slate-400">
                ?
              </span>
            )}

            <span className="w-full truncate text-3xs font-semibold leading-tight">
              {toad?.name ?? `Жаба #${member.toadId}`}
            </span>
            <span className="text-3xs font-bold leading-none">
              {hp}/{maxHp}
            </span>
            {/* Полоска HP под именем: кто просел, видно без наведения */}
            <HpBar hp={hp} maxHp={maxHp} />
          </div>
        );
      },
    )}
  </div>
);

/**
 * Группа жаб в списке роли: «В «Разведке»» / «Жабы колонии».
 * Строки списка рисует общий `shared/ToadPickerList` — здесь только состав групп.
 */
interface RoleToadGroup {
  label: string;
  toads: Toad[];
}

type ExpeditionTab = "main" | "all" | "room-data";

const ExpeditionModal: React.FC<{
  onClose?: () => void;
  /** Гекс «Разведки», из которого открыли модалку: его жильцы — экипаж для команды. */
  roomId?: string;
}> = ({ roomId }) => {
  const { addNotification } = useNotifications();
  const { openModal, closeModal } = useModal();
  const { selectToad } = useToads();
  const state = useGameState();
  const [, setTick] = useState(0);

  const [sectorId, setSectorId] = useState<number>(SECTORS[0].id);
  const [slots, setSlots] = useState<ExpeditionSlots>(emptyExpeditionSlots());
  /** Плашки ролей с описанием и HP скрыты под спойлером — команду собирают по слотам */
  const [rolesInfoOpen, setRolesInfoOpen] = useState(false);

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
  /** Завершённые и разобранные походы: их журналы можно перечитать из архива */
  const expeditionArchive = state.expeditionArchive ?? [];
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
  /**
   * КОНТУР открывается по порядку: следующий сектор — только после того,
   * как предыдущий открыт и хотя бы раз пройден.
   */
  const previousSelectedSector = getPreviousSector(selectedSector);
  const previousSectorUnlocked = isPreviousSectorUnlocked(
    selectedSector,
    stats,
  );
  const previousSectorCompleted = isPreviousSectorCompleted(
    selectedSector,
    stats,
  );
  const canUnlockSector =
    !sectorUnlocked &&
    previousSectorUnlocked &&
    previousSectorCompleted &&
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

  // Сектора и жаб по секторам берём из колонии теми же вычислениями, что и карта.
  const { rooms, toadsByRoom, powerGrid, releaseToad } = useColony();
  const room = rooms.find((r) => r.id === roomId);

  /**
   * Сектор «Разведка», из которой открыли модалку: её жильцы — экипаж, из которого
   * собирают команду. Из бургер-меню гекса нет — берём «Разведку» с активным походом
   * (именно её подробности ждут на первой вкладке), затем — с жабами внутри, а если
   * и такой нет — первую построенную: пустой сектор модалка тоже показывает, чтобы игрок
   * знал, куда сажать команду (построек «Разведки» может и не быть — тогда блока нет).
   */
  const crewRoom = useMemo(() => {
    const scoutRooms = rooms.filter((room) => room.kind === "scout");

    if (roomId) {
      return scoutRooms.find((room) => room.id === roomId) ?? null;
    }

    // Свежий поход важнее «Разведки» с жабами: после отправки команды исходный
    // сектор пуст, и без этого бургер-меню открывало чужой контур без подробностей.
    // Неразобранная добыча тоже привязана к контуру — ведём туда же.
    const linkedRoom = [...activeExpeditions, ...completedExpeditions]
      .filter((expedition) => expedition.originRoomId != null)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((expedition) =>
        scoutRooms.find((scout) => isExpeditionFromRoom(expedition, scout)),
      )
      .find((scout): scout is RoomConfig => Boolean(scout));

    return (
      linkedRoom ??
      scoutRooms.find((room) => (toadsByRoom[room.id] ?? []).length > 0) ??
      scoutRooms[0] ??
      null
    );
  }, [activeExpeditions, completedExpeditions, rooms, roomId, toadsByRoom]);

  /**
   * Походы, которые решают, можно ли отправлять новую команду: у каждого гекса
   * своя «Разведка». Поход без контура привязывает миграция в `localStorage.ts`,
   * поэтому здесь и в карточках ниже — только строгое совпадение.
   *
   * Чужие походы кнопку не гасят: вторая «Разведка» остаётся свободной, пока
   * первая команда в пути. Ограничение — только по своему контуру.
   */
  const shownActiveExpeditions = getRoomExpeditions(
    activeExpeditions,
    crewRoom,
  );
  const shownCompletedExpeditions = getRoomExpeditions(
    completedExpeditions,
    crewRoom,
  );
  const ownActiveExpeditions = shownActiveExpeditions.concat(
    shownCompletedExpeditions,
  );
  /** В контуре уже есть поход (в пути или ждёт разбора) — новую команду не отправляем */
  const hasOwnExpedition =
    ownActiveExpeditions.length > 0 || shownCompletedExpeditions.length > 0;

  const canSend =
    members.length > 0 &&
    biomass >= sendCost &&
    tiredMembers.length === 0 &&
    !hasOwnExpedition &&
    sectorUnlocked;

  /** Обесточенная «Разведка»: отправлять и принимать походы нельзя, данные — можно */
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<ExpeditionTab>({
    room: crewRoom ?? undefined,
    powerGrid,
    defaultTab: "main",
  });

  /**
   * Табы модалки: свой поход/сборы, сводка всех походов колонии и «Данные сектора».
   * Таб данных — только когда модалку открыли по гексу «Разведки»: данным нужен свой
   * сектор (его жильцы, апгрейды и снос), а из бургер-меню гекса нет.
   */
  const expeditionTabs: ModalTabItem<ExpeditionTab>[] = [
    {
      id: "main",
      label: `🚁 Поход${
        shownActiveExpeditions.length
          ? ` (${shownActiveExpeditions.length})`
          : ""
      }`,
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    {
      id: "all",
      label: `🗺 Все походы${expeditions.length ? ` (${expeditions.length})` : ""}`,
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
   * Списки жаб для модалок ролей: группы те же (экипаж «Разведки» сверху),
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

  /**
   * Список жаб для модалки роли: тот же набор, что был у выпадающего списка, плюс
   * «Не подходят» с причиной. Строки рисует общий `ToadPickerList`; роль передаёт
   * только своё: силу характеристики, проценты и пометку «уже в команде».
   */
  const getRolePicker = (role: ExpeditionRole): ToadSlotPickerConfig => {
    const config = ROLE_CONFIG[role];

    return {
      groups: roleGroups[role].map((group) => ({
        label: group.label,
        items: group.toads.map((toad): ToadPickerItem => {
          const other = getAssignedRole(slots, toad.id);
          const own = other === role;
          const percent = getRolePowerPercent(toad, role);

          return {
            toad,
            rank: getRoleStat(toad, role),
            tone: own ? "selected" : other ? "warn" : "default",
            note: (
              <div className="truncate">
                {getRoleStat(toad, role).toFixed(2)} {config.statLabel} ·{" "}
                {getToadHpStatusLabel(toad)}
                {own
                  ? " · ✓ на этой роли"
                  : other
                    ? ` · в команде: ${ROLE_CONFIG[other].icon} ${
                        ROLE_CONFIG[other].label
                      }`
                    : ""}
                <ToadVitals toad={toad} energyCost={energyCostPerToad} />
              </div>
            ),
            meter: { value: percent, label: `${percent}%` },
          };
        }),
      })),
      rejected: {
        label: TOAD_PICKER_REJECTED_GROUP,
        items: state.toads
          .map((toad): ToadPickerItem => {
            const check = canSendToad(toad, expeditions);

            return {
              toad,
              rank: getRoleStat(toad, role),
              reason: check.ok ? null : check.reason,
            };
          })
          .filter((item) => Boolean(item.reason)),
      },
      hint: (
        <span>
          <b className="text-slate-300">
            {config.icon} {config.label}
          </b>{" "}
          · {config.statLabel}. {config.description}
        </span>
      ),
      emptyText:
        "Нет доступных жаб: у остальных есть причина отказа — откройте «Не подходят».",
    };
  };

  /** Тап по занятому слоту роли — карточка жабы поверх модалки КОНТУРа */
  const openToadCard = (toad: Toad) => {
    selectToad(toad.id);
    openModal(() => <ToadInfo />);
  };

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

  const notify = (result: { success: boolean; message: string }) => {
    if (!result.success) {
      addNotification({ type: "warn", content: result.message });
    }
  };

  const handleSend = () => {
    const result = startExpedition(sectorId, members, crewRoom?.id);
    notify(result);
    if (result.success) {
      setSlots(emptyExpeditionSlots());
      setTab("main");
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
  const handleEvacuate = (id: string) => notify(evacuateExpedition(id));
  const handleExtract = (id: string) =>
    notify(extractExpedition(id, addNotification));

  /**
   * Вернуть жабу из «Разведки» в её биопод — та же кнопка, что в других секторах.
   * Место проверяет сам биопод: пока жаба была в походе или в секторе, его могли занять.
   */
  const handleSendHome = (toad: Toad) => {
    if (isToadBusyOnExpedition(toad, expeditions)) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    const result = releaseToad(toad.id);

    if (!result.ok) {
      addNotification({
        type: "warn",
        content:
          result.reason === "no-space"
            ? `${toad.name}: в биоподе «${result.scene?.name}» нет места — постройте биопод или переселите её в другой («🏠 Переместить» в карточке жабы).`
            : `${toad.name}: биопод, в котором она жила, не найден — переселите её в другой («🏠 Переместить» в карточке жабы).`,
        timeout: 9000,
      });
      return;
    }
  };

  /** Клик по карточке открывает карточку жабы, но не мешает кнопкам действий */
  const handleCrewCardClick = (
    event: React.MouseEvent<HTMLDivElement>,
    toad: Toad,
  ) => {
    if (
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea, [data-toad-card-stop]",
      )
    ) {
      return;
    }

    openToadCard(toad);
  };

  const handleCrewCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    toad: Toad,
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openToadCard(toad);
    }
  };

  /**
   * Строка экипажа сектора: кто живёт в «Разведке» и что с ним можно сделать.
   * Свободная жаба показывает свою сильную роль, жаба в команде — занятую ею роль;
   * тап по кнопке ставит жабу в команду или выводит её оттуда.
   */
  const renderCrewCard = (toad: Toad, readOnly = false) => {
    const assigned = getAssignedRole(slots, toad.id);
    const check = canSendToad(toad, expeditions);
    const busy = isToadBusyOnExpedition(toad, expeditions);
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
        role="button"
        tabIndex={0}
        onClick={(event) => handleCrewCardClick(event, toad)}
        onKeyDown={(event) => handleCrewCardKeyDown(event, toad)}
        title={`Открыть карточку: ${toad.name}`}
        className={`rounded-xl px-2 py-1.5 border flex items-center gap-2 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
          !assigned
            ? "bg-slate-800/40 border-slate-600/30 hover:border-cyan-400/50"
            : offRole
              ? "bg-amber-950/30 border-amber-500/40 hover:border-cyan-400/50"
              : "bg-emerald-950/30 border-emerald-500/40 hover:border-cyan-400/50"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-100 truncate">
            {toad.name}
          </p>
          <p className="text-2xs text-slate-400 truncate">
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

        <div
          className="flex shrink-0 flex-col items-stretch gap-1"
          data-toad-card-stop
        >
          {!readOnly && (
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
              className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors duration-300 ${
                assigned
                  ? "bg-cyan-900/50 border-cyan-400/60 text-cyan-100 hover:bg-cyan-800/60"
                  : check.ok
                    ? "bg-slate-800/60 border-slate-500/50 text-slate-200 hover:bg-slate-700/70"
                    : "bg-slate-800/40 border-slate-700/40 text-slate-500"
              }`}
            >
              {assigned ? "✓ В команде" : "→ В команду"}
            </ClickButton>
          )}

          <ClickButton
            onClick={() => handleSendHome(toad)}
            disabled={busy}
            title={
              busy ? EXPEDITION_TOAD_BUSY_REASON : "Вернуть жабу в её биопод"
            }
            className={`rounded-lg border px-2 py-1 text-2xs transition-colors ${
              busy
                ? "cursor-not-allowed border-slate-700/60 text-slate-500"
                : "border-slate-600/60 text-slate-300 hover:border-rose-400 hover:text-rose-200"
            }`}
          >
            В биопод
          </ClickButton>
        </div>
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
      return;
    }

    setSlots(next);
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

  /** Контур, из которого ушёл поход: id гекса, id постройки или старый `Scene.id` */
  const findExpeditionRoom = (expedition: Expedition) => {
    const scoutRooms = rooms.filter((item) => item.kind === "scout");

    // Старый сейв не помнил контур: если «Разведка» одна, поход точно её
    if (expedition.originRoomId == null) {
      return scoutRooms.length === 1 ? scoutRooms[0] : null;
    }

    return (
      scoutRooms.find((item) => isExpeditionFromRoom(expedition, item)) ?? null
    );
  };

  /**
   * Сводка «Все походы»: клик открывает модалку контура, из которого ушла команда.
   * Если старый сейв не запомнил контур, ведём в текущую (или первую) «Разведку».
   */
  const openExpeditionRoom = (expedition: Expedition) => {
    const originRoom = findExpeditionRoom(expedition);

    // Контур записан, но его уже снесли: открывать чужую «Разведку» нельзя
    if (!originRoom && expedition.originRoomId != null) {
      addNotification({
        type: "warn",
        content: "Контур, из которого ушёл поход, больше не существует.",
      });
      return;
    }

    const target =
      originRoom ??
      crewRoom ??
      rooms.find((item) => item.kind === "scout") ??
      null;

    if (!target) {
      addNotification({
        type: "warn",
        content: "«Разведка», из которой ушёл поход, не найдена.",
      });
      return;
    }

    // Поход этого же контура — просто переключаем вкладку, без пересоздания модалки
    if (crewRoom && target.id === crewRoom.id) {
      setTab("main");
      return;
    }

    closeModal();
    openModal(() => <ExpeditionModal roomId={target.id} />);
  };

  /** Полный журнал похода — отдельной модалкой поверх «Разведки» */
  const openExpeditionLog = (expedition: Expedition) => {
    openModal(ExpeditionLogModal, {
      props: { expedition },
      // Журнал читается построчно: на всю ширину строки становятся слишком длинными.
      className: "md:max-w-3xl",
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

    /** Жаба из лутбокса, закреплённая за глубиной: 10% при успешном походе */
    const sampleReward = getExpeditionSampleReward(item);

    return (
      <div
        key={item.id}
        className={`flex h-full flex-col gap-2 overflow-hidden rounded-2xl border p-3 ${
          !unlocked
            ? "border-slate-700/40 bg-slate-900/40 text-slate-500"
            : selected
              ? "border-cyan-400/70 bg-cyan-950/50 text-cyan-50"
              : "border-slate-600/40 bg-slate-800/50 text-slate-200"
        }`}
      >
        {item.image && (
          <div className="-mx-3 -mt-3 shrink-0 border-b border-slate-700/40 bg-slate-950/60">
            <img
              src={item.image}
              alt={`Иллюстрация сектора «${item.name}»`}
              loading={selected ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              className={`h-32 w-full object-cover object-center sm:h-40 ${
                unlocked ? "" : "opacity-60 grayscale"
              }`}
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold flex mb-1">
              {item.icon} {item.name}
              <span
                className={`shrink-0 ml-auto rounded-lg px-2 py-1 text-2xs font-bold ${
                  !unlocked
                    ? "bg-slate-900/60 text-slate-400"
                    : selected
                      ? "bg-cyan-400/20 text-cyan-100"
                      : "bg-slate-900/50 text-slate-300"
                }`}
              >
                {!unlocked ? "🔒 закрыт" : "открыт"}
              </span>
            </p>
            <p className="text-2xs text-slate-400">{item.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center text-2xs">
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-slate-400">Путь туда</p>
            <p className="font-bold">{item.durationHours} ч</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-slate-400">Добыча / Сложность</p>
            <p className="font-bold">
              ×{item.lootMultiplier} / ×
              {Math.round(getSectorDamageMultiplier(item) * 100) / 100}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-slate-400">Снаряжение</p>
            <p className="font-bold">{sendCost} 🧪</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-slate-400">Силы необходимо</p>
            <p className="font-bold">{energyCostPerToad} ⚡</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-slate-400">Потенциальная добыча</p>
            <div
              className="flex flex-wrap items-center justify-center gap-1 font-bold"
              title={`${Math.round(
                EXPEDITION_SAMPLE_TOAD_CHANCE * 100,
              )}% за удачный поход: «${sampleReward.template.name}»`}
            >
              <span>{getContourPassReward(item)} 🎫</span>
              <span className="flex items-center gap-0.5 rounded-md bg-slate-950/60 px-1 py-0.5">
                <ToadAvatar toad={sampleReward.template as Toad} size={4} />
                <span className="text-3xs font-semibold text-slate-300">
                  {Math.round(EXPEDITION_SAMPLE_TOAD_CHANCE * 100)}%
                </span>
              </span>
            </div>
          </div>
          <div className="rounded-lg bg-slate-900/40 px-1 py-1">
            <p className="text-slate-400">Шанс удачного возврата</p>
            <p className="font-bold">
              <span
                className={` ${
                  successChance >= 1 ? "text-emerald-300" : "text-amber-200"
                }`}
              >
                {Math.round(successChance * 100)}%
                {successChance >= 1 ? " (гарантия)" : ""}
              </span>{" "}
            </p>
          </div>
        </div>

        {/* Итог отправки */}
        {((members.length > 0 && biomass < sendCost) ||
          tiredMembers.length > 0) && (
          <div className="bg-color-main rounded-xl px-3 py-2 border border-slate-600/30 flex flex-col gap-2">
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
              </p>
            )}
          </div>
        )}

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
            <p className="text-2xs leading-snug text-slate-300">
              {!previousSectorUnlocked
                ? `Сначала необходимо пройти «${
                    previousSelectedSector?.name ?? "предыдущий сектор"
                  }».`
                : !previousSectorCompleted
                  ? `Сначала пройдите «${
                      previousSelectedSector?.name ?? "предыдущий сектор"
                    }» хотя бы раз: отправьте команду и дождитесь её возвращения.`
                  : `Пропуск КОНТУРа — расходуемый ресурс склада. Его приносят завершённые походы, а тратится он на открытие следующего сектора.`}
            </p>
            <ClickButton
              onClick={handleUnlockSector}
              disabled={!canUnlockSector}
              className={`w-full py-2 rounded-xl text-xs font-bold border transition-colors duration-300 ${
                canUnlockSector
                  ? "bg-amber-800/60 border-amber-400/70 text-amber-50 hover:bg-amber-700/70"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-500"
              }`}
            >
              🎫 Открыть за {unlockStatus.required} 🎫
            </ClickButton>
          </div>
        )}
        {sectorUnlocked && (
          <ClickButton
            onClick={handleSend}
            disabled={!canSend}
            className={`w-full mt-auto ${
              canSend ? "ui-button-primary" : "ui-button-secondary"
            }`}
          >
            Отправить в «{selectedSector.name}»
          </ClickButton>
        )}
      </div>
    );
  });

  return (
    <Modal
      title={room?.name ?? crewRoom?.name ?? "Разведка"}
      icon={<span className="text-xl">🧭</span>}
    >
      {/* Переключатель сразу под названием: дальше — сводка и выбранный таб */}
      <ModalTabs tabs={expeditionTabs} active={tab} onChange={setTab} />

      <div className="flex flex-col gap-3 px-1">
        {/* Сводка по разведке */}
        <div className="grid gap-2 text-center grid-cols-2">
          <div className="ui-panel py-2 px-1">
            <p className="ui-hint">🎫 Пропуска КОНТУРа</p>
            <p className="text-base font-bold text-white">{contourPasses}</p>
          </div>
          <div className="ui-panel py-2 px-1">
            <p className="ui-hint">Походов завершено</p>
            <p className="text-base font-bold text-white">{stats.completed}</p>
          </div>
        </div>

        {/* ВКЛАДКА: поход этого контура или сборы новой команды */}
        {tab === "main" && (
          <div className="flex flex-col gap-3">
            {shownCompletedExpeditions.map((expedition) => {
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
                      <p className="mt-0.5 text-2xs text-slate-400">
                        глубина {sectorDef.depth} · {expedition.team.length} жаб
                        · вернулись{" "}
                        {formatExpeditionDate(expedition.completedAt)}
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
                  <TeamStatusList expedition={expedition} />
                  <ExpeditionLootGrid
                    loot={expedition.loot}
                    sampleToad={getExpeditionSampleReward(sectorDef).template}
                  />

                  <ClickButton
                    onClick={() => openExpeditionLog(expedition)}
                    title="Прочитать полный бортовой журнал завершённого похода"
                    className=" mt-6 w-full  rounded-xl border border-cyan-500/40 bg-cyan-950/40 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-900/50"
                  >
                    📡 Открыть логи{" "}
                    <span className="ml-1 rounded-md bg-slate-950/50 px-1.5 py-0.5 text-3xs font-semibold text-slate-300">
                      {expedition.log.length}
                    </span>
                  </ClickButton>
                  <div className="flex flex-wrap gap-1.5">
                    <ClickButton
                      onClick={() => handleFinish(expedition.id, "storage")}
                      disabled={!storage.ok}
                      title={
                        storage.ok
                          ? "Забрать предметы на склад, а биомассу, Кваксы и образцы — в колонию"
                          : "На складе не хватает места: постройте «Склад» или переработайте лут в биомассу"
                      }
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                        storage.ok
                          ? "bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-100 border-emerald-500/40"
                          : "bg-slate-800/40 text-slate-500 border-slate-600/30 cursor-not-allowed"
                      }`}
                    >
                      Завершить
                    </ClickButton>
                    <ClickButton
                      onClick={() => handleFinish(expedition.id, "biomass")}
                      title="Переработать всю добычу похода, включая предметы и образцы, в биомассу"
                      className="flex-1 py-2 rounded-xl bg-lime-900/50 hover:bg-lime-800/60 text-lime-100 text-xs font-bold border border-lime-500/40"
                    >
                      🧪 Превратить лут в биомассу (+{biomassValue} 🧪)
                    </ClickButton>
                  </div>
                </div>
              );
            })}

            {shownActiveExpeditions.map((expedition) => {
              const sectorDef = getSectorById(expedition.sectorId);
              const stranded = isAwaitingEvacuation(expedition);
              const returning = expedition.phase === "returning";
              const progress = stranded
                ? Math.max(0, Math.min(1, expedition.progress))
                : returning
                  ? getReturnProgress(expedition)
                  : getExpeditionProgress(expedition);
              const eta = getExpeditionEtaMs(expedition);
              const speedUpCost = getSpeedUpReturnCost(expedition);
              const evacuationCost = getEvacuationCost(sectorDef);
              const canAffordEvacuation = Math.floor(tokens) >= evacuationCost;

              return (
                <div
                  key={expedition.id}
                  className="bg-color-main rounded-2xl p-3 border border-slate-600/30 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {sectorDef.icon} {sectorDef.name}
                      </p>
                      <p className="text-2xs text-slate-400">
                        глубина {sectorDef.depth} • команда из{" "}
                        {expedition.team.length} жаб
                        {expedition.forced && !stranded && (
                          <span className="text-red-400"> • выбиты</span>
                        )}
                      </p>
                      {expedition.originRoomId == null && (
                        <p className="text-2xs text-amber-300/80">
                          Контур не записан — поход из старого сейва
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-2xs font-bold px-2 py-1 rounded-lg ${
                        stranded
                          ? "bg-red-900/60 text-red-100"
                          : returning
                            ? "bg-blue-900/50 text-blue-200"
                            : "bg-amber-900/50 text-amber-200"
                      }`}
                    >
                      {stranded
                        ? "🚨 выбиты"
                        : returning
                          ? "🏠 возврат"
                          : "🧭 в пути"}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-2xs text-slate-400 mb-1">
                      <span>
                        {stranded
                          ? `Выбиты на ${Math.round(progress * 100)}% пути`
                          : returning
                            ? "Путь домой"
                            : `Прогресс ${Math.round(progress * 100)}%`}
                      </span>
                      <span>
                        {stranded ? (
                          <>
                            эвакуация: {evacuationCost}{" "}
                            <CurrencyIcon
                              currency="tokens"
                              className="h-3 w-3"
                            />
                          </>
                        ) : returning ? (
                          <>домой через {formatDuration(eta)}</>
                        ) : (
                          <>сектор через {formatDuration(eta)}</>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          stranded
                            ? "bg-red-500"
                            : returning
                              ? "bg-blue-400"
                              : "bg-amber-400"
                        }`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Статы жаб — сразу под прогрессом: кто просел, видно не открывая журнал */}
                  <TeamStatusList expedition={expedition} />

                  {expedition.companions &&
                    expedition.companions.length > 0 && (
                      <p className="text-2xs text-emerald-200">
                        🐸 С командой идёт:{" "}
                        {expedition.companions
                          .map(
                            (toad) =>
                              `${getToadTypeLabel(
                                toad.type ?? null,
                              ).toLowerCase()} «${toad.name}»`,
                          )
                          .join(", ")}{" "}
                        — дома поселится в биопод
                      </p>
                    )}

                  <p className="text-2xs text-slate-300">
                    Добыча:{" "}
                    <CurrencyText
                      text={getExpeditionLootSummary(expedition)}
                      iconClassName="h-3 w-3"
                    />
                  </p>

                  <ExpeditionLogList log={expedition.log} limit={40} />

                  <div className="flex flex-wrap gap-1.5">
                    {!returning && (
                      <ClickButton
                        onClick={() => handleWithdraw(expedition.id)}
                        className="flex-1 py-2 rounded-xl bg-red-800/60 hover:bg-red-700/70 text-slate-200 text-xs font-bold border border-slate-600/40"
                      >
                        ⏪ Отозвать
                      </ClickButton>
                    )}
                    {stranded ? (
                      <ClickButton
                        onClick={() => handleEvacuate(expedition.id)}
                        disabled={!canAffordEvacuation}
                        title={
                          canAffordEvacuation
                            ? `Эвакуировать выбитую команду за ${evacuationCost} Кваксов`
                            : `Не хватает ${evacuationCost - Math.floor(tokens)} Кваксов`
                        }
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                          canAffordEvacuation
                            ? "bg-red-800/60 hover:bg-red-700/70 text-red-50 border-red-500/40"
                            : "bg-slate-700/60 text-slate-400 border-slate-600/40 cursor-not-allowed"
                        }`}
                      >
                        Эвакуировать ({evacuationCost}{" "}
                        <CurrencyIcon currency="tokens" className="h-3 w-3" />)
                      </ClickButton>
                    ) : (
                      returning &&
                      speedUpCost > 0 && (
                        <ClickButton
                          onClick={() => handleSpeedUp(expedition.id)}
                          className="flex-1 py-2 rounded-xl bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-100 text-xs font-bold border border-emerald-500/40"
                        >
                          ⚡ Ускорить ({speedUpCost} 🧪)
                        </ClickButton>
                      )
                    )}
                    <ClickButton
                      onClick={() => handleExtract(expedition.id)}
                      disabled={stranded}
                      title={
                        returning
                          ? "Забрать команду домой сразу: добыча останется той, что уже лежит в рюкзаке"
                          : "Забрать команду с середины пути: поход не будет успешным, добыча — только уже найденная"
                      }
                      className="flex-1 py-2 rounded-xl bg-cyan-900/50 hover:bg-cyan-800/60 text-cyan-100 text-xs font-bold border border-cyan-500/40"
                    >
                      Закончить немедленно ({EXTRACTION_ASTRO_COST}{" "}
                      <CurrencyIcon currency="astro_quax" className="h-3 w-3" />
                      )
                    </ClickButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ВКЛАДКА: сборы новой команды — только если из контура ещё никто не ушёл */}
        {tab === "main" && ownActiveExpeditions.length === 0 && (
          <div className="flex flex-col gap-3">
            {/* Секторы: постраничный слайдер — одна страница на один поход.
                Страница выбирает сектор: стрелки ‹ › и точки внизу = выбор похода. */}
            <SlidePager
              index={sectorIndex}
              onIndexChange={(page) => setSectorId(SECTORS[page].id)}
              labels={SECTORS.map(
                (item) =>
                  `${item.icon} ${item.name}${
                    isSectorUnlocked(item, stats) ? "" : " (закрыт)"
                  }`,
              )}
              slides={sectorSlides}
            />

            {/* Слоты ролей команды: та же сетка с «+», что у репродуктора, коллайдера и Медотсека */}
            <ToadSlotGrid
              slots={EXPEDITION_ROLE_ORDER.map((role) => {
                const config = ROLE_CONFIG[role];
                const pickedId = slots[role];
                const picked =
                  pickedId === ""
                    ? null
                    : (availableToads.find((toad) => toad.id === pickedId) ??
                      null);

                return {
                  toad: picked,
                  label: config.label,
                  icon: config.icon,
                  badge: picked
                    ? `${getRolePowerPercent(picked, role)}%`
                    : undefined,
                  disabledHint: `${config.label}: ${config.description}`,
                };
              })}
              columns={5}
              title="Собрать команду"
              headerRight={`собрано ${members.length} из ${EXPEDITION_TEAM_SIZE}`}
              pickerFor={(index) => getRolePicker(EXPEDITION_ROLE_ORDER[index])}
              onPick={(toad, index) =>
                handleRolePick(EXPEDITION_ROLE_ORDER[index], String(toad.id))
              }
              onOpen={openToadCard}
              onRemove={(_toad, index) =>
                handleRolePick(EXPEDITION_ROLE_ORDER[index], "")
              }
              removeLabel="Снять жабу с роли"
            />
          </div>
        )}

        {/* Экипаж «Разведки» — внизу вкладки: и при сборах, и когда команда уже в походе */}
        {tab === "main" && crewRoom && (
          <div className="bg-color-main flex flex-col gap-2 rounded-xl border border-slate-600/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-white">
                🧭 В «Разведке»: {crew.length}/{EXPEDITION_TEAM_SIZE}
              </p>
              {ownActiveExpeditions.length === 0 &&
                crewSendable.length > 0 &&
                members.length < EXPEDITION_TEAM_SIZE && (
                  <ClickButton
                    onClick={handleFillFromRoom}
                    title="Занять свободные роли сильнейшими жабами сектора"
                    className="ui-chip border-cyan-400/30 bg-cyan-500/10 text-cyan-200 transition-colors hover:bg-cyan-500/20"
                  >
                    Собрать команду
                  </ClickButton>
                )}
            </div>

            {crew.length === 0 && (
              <p className="text-2xs leading-snug text-slate-400">
                {ownActiveExpeditions.length > 0
                  ? "Экипаж в походе: после возврата и разбора добычи жабы снова появятся в «Разведке»."
                  : `Сектор пуст: перенесите сюда на карте до ${EXPEDITION_TEAM_SIZE} взрослых жаб — команда соберётся из них, а из похода жаба возвращается в биопод (место в «Разведке» она освобождает).`}
              </p>
            )}

            {crew.map((toad) =>
              renderCrewCard(toad, ownActiveExpeditions.length > 0),
            )}
          </div>
        )}

        {/* ВКЛАДКА: все походы колонии — сводка и переход в контур-источник */}
        {tab === "all" && (
          <div className="flex flex-col gap-3">
            <p className="text-2xs leading-snug text-slate-400">
              Все походы колонии: активные команды и добыча, ждущая разбора.
            </p>

            {expeditions.length === 0 && (
              <p className="py-3 text-center text-xs text-slate-400">
                Походов пока нет: соберите команду на вкладке «Поход».
              </p>
            )}

            {activeExpeditions.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="ui-kicker">
                  Активные · {activeExpeditions.length}
                </p>
                {activeExpeditions.map((expedition) => {
                  const sectorDef = getSectorById(expedition.sectorId);
                  const stranded = isAwaitingEvacuation(expedition);
                  const returning = expedition.phase === "returning";
                  const progress = stranded
                    ? Math.max(0, Math.min(1, expedition.progress))
                    : returning
                      ? getReturnProgress(expedition)
                      : getExpeditionProgress(expedition);
                  const eta = getExpeditionEtaMs(expedition);
                  const evacuationCost = getEvacuationCost(sectorDef);
                  const originRoom = findExpeditionRoom(expedition);

                  return (
                    <div
                      key={expedition.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openExpeditionRoom(expedition)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openExpeditionRoom(expedition);
                        }
                      }}
                      title={`Открыть контур: ${
                        originRoom?.name ?? "«Разведка»"
                      }`}
                      className="w-full cursor-pointer rounded-2xl border border-slate-600/40 bg-slate-900/50 p-3 text-left transition-colors hover:border-cyan-400/50 hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-white">
                          {sectorDef.icon} {sectorDef.name}
                        </p>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-1 text-2xs font-bold ${
                            stranded
                              ? "bg-red-900/60 text-red-100"
                              : returning
                                ? "bg-blue-900/50 text-blue-200"
                                : "bg-amber-900/50 text-amber-200"
                          }`}
                        >
                          {stranded
                            ? "🚨 выбиты"
                            : returning
                              ? "🏠 возврат"
                              : "🧭 в пути"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-2xs text-slate-400">
                        🧭 {originRoom?.name ?? "«Разведка» не записана"} ·{" "}
                        {expedition.team.length} жаб · глубина {sectorDef.depth}
                      </p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            stranded
                              ? "bg-red-500"
                              : returning
                                ? "bg-blue-400"
                                : "bg-amber-400"
                          }`}
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-2xs text-slate-400">
                        <span>
                          {stranded
                            ? `выбиты на ${Math.round(progress * 100)}% пути`
                            : returning
                              ? "путь домой"
                              : `прогресс ${Math.round(progress * 100)}%`}
                        </span>
                        <span>
                          {stranded ? (
                            <>
                              эвакуация {evacuationCost}{" "}
                              <CurrencyIcon
                                currency="tokens"
                                className="h-3 w-3"
                              />
                            </>
                          ) : returning ? (
                            <>домой через {formatDuration(eta)}</>
                          ) : (
                            <>сектор через {formatDuration(eta)}</>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {completedExpeditions.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="ui-kicker">
                  Ждут разбора · {completedExpeditions.length}
                </p>
                {completedExpeditions.map((expedition) => {
                  const sectorDef = getSectorById(expedition.sectorId);
                  const originRoom = findExpeditionRoom(expedition);

                  return (
                    <div
                      key={expedition.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openExpeditionRoom(expedition)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openExpeditionRoom(expedition);
                        }
                      }}
                      title={`Открыть контур: ${
                        originRoom?.name ?? "«Разведка»"
                      }`}
                      className="w-full cursor-pointer rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-left transition-colors hover:border-emerald-400/60 hover:bg-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-white">
                          {sectorDef.icon} {sectorDef.name}
                        </p>
                        <span className="shrink-0 rounded-lg bg-emerald-900/60 px-2 py-1 text-2xs font-bold text-emerald-200">
                          🎁 ждёт разбора
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-2xs text-slate-400">
                        🧭 {originRoom?.name ?? "«Разведка» не записана"} ·{" "}
                        {expedition.team.length} жаб
                      </p>
                      <p className="mt-1 text-2xs text-slate-300">
                        <CurrencyText
                          text={getExpeditionLootSummary(expedition)}
                          iconClassName="h-3 w-3"
                        />
                      </p>
                      <p className="mt-1 text-2xs font-semibold text-emerald-300">
                        Открыть контур →
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {expeditionArchive.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="ui-kicker">
                  📜 Архив походов · {expeditionArchive.length}
                </p>
                <p className="text-2xs leading-snug text-slate-500">
                  Разобранные походы: добыча уже в колонии, а бортовой журнал
                  можно перечитать.
                </p>
                {expeditionArchive.map((expedition) => {
                  const sectorDef = getSectorById(expedition.sectorId);
                  const survived = expedition.success !== false;

                  return (
                    <div
                      key={expedition.id}
                      className="rounded-2xl border border-slate-600/40 bg-slate-900/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-white">
                          {sectorDef.icon} {sectorDef.name}
                        </p>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-1 text-2xs font-bold ${
                            survived
                              ? "bg-emerald-900/50 text-emerald-200"
                              : "bg-red-900/50 text-red-200"
                          }`}
                        >
                          {survived ? "✅ удался" : "⚠️ провал"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-2xs text-slate-400">
                        {formatExpeditionDate(expedition.completedAt)} ·{" "}
                        {expedition.team.length} жаб · глубина {sectorDef.depth}
                      </p>
                      <p className="mt-1 text-2xs text-slate-300">
                        <CurrencyText
                          text={getExpeditionLootSummary(expedition)}
                          iconClassName="h-3 w-3"
                        />
                      </p>
                      <ClickButton
                        onClick={() => openExpeditionLog(expedition)}
                        title="Прочитать полный бортовой журнал этого похода"
                        className="mt-2 w-full rounded-xl border border-cyan-500/40 bg-cyan-950/40 py-1.5 text-2xs font-bold text-cyan-100 hover:bg-cyan-900/50"
                      >
                        📡 Открыть логи ({expedition.log.length})
                      </ClickButton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: данные сектора — описание, статистика, улучшения и снос */}
        {tab === "room-data" && crewRoom && (
          <RoomDataTab
            room={crewRoom}
            stats={
              <div className="grid grid-cols-3 gap-1.5 text-center text-2xs">
                <div className="rounded-lg bg-slate-900/40 px-1 py-1">
                  <p className="text-slate-400">🧭 В секторе</p>
                  <p className="font-bold text-white">{crew.length}</p>
                </div>
                <div className="rounded-lg bg-slate-900/40 px-1 py-1">
                  <p className="text-slate-400">✅ Готовы к походу</p>
                  <p className="font-bold text-white">{crewSendable.length}</p>
                </div>
                <div className="rounded-lg bg-slate-900/40 px-1 py-1">
                  <p className="text-slate-400">🚁 Активных команд</p>
                  <p className="font-bold text-white">
                    {shownActiveExpeditions.length}/{teamLimit}
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
