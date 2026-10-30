import React, { useEffect, useMemo, useState } from "react";
import Modal from "../shared/Header";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon, IconText } from "../shared/CurrencyIcon";
import { HpBar } from "../shared/HpBar";
import { ToadIcon } from "../shared/ToadIcon";
import { ToadAvatar } from "../shared/ToadAvatar";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import RoomDataTab, { ROOM_DATA_TAB } from "./RoomDataTab";
import { ToadInfo } from "./ToadInfoModal";
import { DataCell, DataGrid, HudPanel, SectionTitle } from "../shared/DataGrid";
import { ExpeditionLootGrid } from "./ExpeditionLootGrid";
import { ExpeditionLogList, formatExpeditionDate } from "./ExpeditionLogList";
import { ExpeditionLogModal } from "./ExpeditionLogModal";
import { SlidePager } from "../shared/SlidePager";
import { useNotifications } from "../../hooks/use-notification";
import { useGameState } from "../../hooks/use-game-state";
import { useColony } from "../../hooks/use-colony";
import { useRoomPowerTab } from "../../hooks/use-room-power-tab";
import { getGameState } from "../../backend/localStorage";
import { resolveColonyRooms } from "../HexMap/colony-build";
import { EMPTY_COLONY } from "../../models/colony";
import { releaseToadsToHome } from "../../utils/toad-release";
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
  EXPEDITION_SAMPLE_TOAD_CHANCE,
  EXPEDITION_TEAM_SIZE,
  EXTRACTION_ASTRO_COST,
  ExpeditionTeamMember,
  canToadAffordExpedition,
  getContourPassReward,
  getEvacuationCost,
  getExpeditionSampleReward,
  getExpeditionSendCost,
  getExpeditionSuccessChance,
  getExpeditionToadEnergyCost,
  getRoleStat,
  getSectorDamageMultiplier,
  getSpeedUpReturnCost,
  getToadHp,
  isAwaitingEvacuation,
  ROLE_CONFIG,
} from "../../utils/expedition-config";
import {
  canSendToad,
  evacuateExpedition,
  extractExpedition,
  finishExpedition,
  getExpeditionBiomassValue,
  getExpeditionEtaMs,
  getExpeditionFoundToadsCheck,
  getExpeditionLootSummary,
  getExpeditionProgress,
  getExpeditionStorageCheck,
  getExpeditionTeamStatus,
  getReturnProgress,
  getRoomExpeditions,
  getSectorUnlockStatus,
  isExpeditionFromRoom,
  processExpeditions,
  speedUpReturn,
  startExpedition,
  unlockSector,
  withdrawExpedition,
} from "../../utils/expedition-manager";
import { getMaxExpeditions } from "../../utils/expedition-config";
import { getToadEnergy } from "../../utils/gamification-config";
import { RoomConfig, isToadVisibleInRoom } from "../HexMap/rooms-config";
import { ToadSlotGrid } from "../shared/ToadSlotGrid";
import type {
  ToadSlotMeter,
  ToadSlotPickerConfig,
} from "../shared/ToadSlotGrid";
import type { ToadPickerItem } from "../shared/ToadPicker";
import { TOAD_PICKER_REJECTED_GROUP } from "../../utils/toad-picker";
import {
  assignToadToRole,
  emptyExpeditionSlots,
  ExpeditionSlots,
  getAssignedRole,
  getRolePowerPercent,
  removeToadFromTeam,
  sortToadsByRolePower,
  syncSlotsWithCrew,
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
 * Показатель силы роли: одна и та же характеристика, проценты и полоска
 * и в списке выбора, и на занятом слоте команды.
 */
const getRoleMeter = (toad: Toad, role: ExpeditionRole): ToadSlotMeter => {
  const config = ROLE_CONFIG[role];
  const percent = getRolePowerPercent(toad, role);
  const stat = getRoleStat(toad, role);

  return {
    value: percent,
    label: `${percent}%`,
    detail: `${config.statLabelShort} ${stat.toFixed(2)}`,
    detailTitle: `${config.statLabel}: ${stat.toFixed(2)}`,
    caption: percent > 40 ? "Подходит" : "Не подходит",
  };
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
            className={`relative flex min-w-0 flex-col items-center gap-1 rounded-none border px-1 py-1.5 text-center ${tone}`}
          >
            {/* Роль — маленьким значком в углу, чтобы не отнимать место у аватара */}
            <span
              title={role.label}
              className="absolute left-1 top-1 rounded-none bg-slate-950/70 px-0.5 text-2xs leading-none"
            >
              {role.icon}
            </span>

            {toad ? (
              <span className={down ? "opacity-60 grayscale" : ""}>
                <ToadAvatar toad={toad} size={10} />
              </span>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-none border border-dashed border-slate-500/60 text-xs text-slate-400">
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
 * Плитки списка рисует общий `shared/ToadPickerList` — здесь только состав групп.
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

  const expeditions = useMemo(
    () => state.expeditions ?? [],
    [state.expeditions],
  );
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
  /**
   * Жабы команды, которых не пропустит `startExpedition`: больна, выбита,
   * беременна или уже в другом походе. Больная жаба остаётся в слоте (она
   * физически в «Разведке»), слот краснеет, а отправка ждёт лечения — иначе
   * игрок видел бы пустую роль и не понимал, почему команда неполная.
   */
  const unfitMembers = members.reduce<Array<{ toad: Toad; reason: string }>>(
    (acc, member) => {
      const toad = state.toads.find((item) => item.id === member.toadId);
      const check = toad ? canSendToad(toad, expeditions) : null;

      if (toad && check && !check.ok) {
        acc.push({ toad, reason: check.reason ?? "не готова к походу" });
      }

      return acc;
    },
    [],
  );
  const biomass = state.user.biomass || 0;
  const tokens = state.user.tokens || 0;

  /**
   * Почему жаба не готова к походу в выбранный сектор: `canSendToad` (больна, выбита,
   * беременна, уже в походе) или нехватка сил на глубину сектора. `null` — жаба готова.
   *
   * Жабу при этом можно поставить в слот (силы восстанавливаются, а болезнь лечат), но
   * место и её плитка в списке краснеют с причиной: зелёный «всё в порядке» на жабе без
   * сил обещал бы поход, который `startExpedition` всё равно не отправит.
   */
  const getExpeditionIssue = (toad: Toad): string | null => {
    const check = canSendToad(toad, expeditions);

    if (!check.ok) {
      return check.reason ?? "не готова к походу";
    }

    if (!canToadAffordExpedition(toad, selectedSector)) {
      return `мало сил: ⚡${Math.round(getToadEnergy(toad))} из ${energyCostPerToad}`;
    }

    return null;
  };

  // Сектора и жаб по секторам берём из колонии теми же вычислениями, что и карта.
  const { rooms, toadsByRoom, powerGrid, placeToad, releaseToad } = useColony();
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
    unfitMembers.length === 0 &&
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

  /**
   * Экипаж сектора: те же жабы, что рисует карта. Жаба в пути скрыта (её слот
   * сохранён только ради возврата), а вернувшаяся из похода уже стоит в «Разведке»
   * и снова видна — до разбора добычи карточка остаётся заблокированной.
   */
  const crew = useMemo(
    () =>
      (crewRoom ? toadsByRoom[crewRoom.id] : undefined)?.filter((toad) =>
        isToadVisibleInRoom(toad, expeditions),
      ) ?? [],
    [crewRoom, expeditions, toadsByRoom],
  );

  /** Кого из экипажа можно взять в поход — правило то же, что и у команды (`canSendToad`) */
  const crewSendable = useMemo(
    () => crew.filter((toad) => canSendToad(toad, expeditions).ok),
    [crew, expeditions],
  );

  /**
   * Слот команды и место в контуре — одно и то же: жаба стоит в «Разведке», пока занят её
   * слот. Поэтому слоты держим равными ВСЕМ жильцам сектора, а не только готовым к
   * отправке: вернувшаяся из похода больная жаба должна остаться в своём слоте и
   * краснеть причиной, а не исчезать из команды, пока её лечат. Кого вернули в биопод
   * или забрал поход — роль освобождает (`syncSlotsWithCrew`). Функция чистая, поэтому
   * лишний вызов ничего не ломает: без изменений она возвращает тот же объект, и React
   * не перерисовывает модалку.
   */
  useEffect(() => {
    if (!crewRoom) {
      return;
    }

    setSlots((prev) => syncSlotsWithCrew(prev, crew));
  }, [crewRoom, crew]);

  /**
   * Жабы сектора — отдельной группой вверху списков ролей: они уже стоят в контуре,
   * а жабы всей колонии остаются ниже — выбранная жаба переезжает в сектор.
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
   * «Не подходят» с причиной. Плитки рисует общий `ToadPickerList`; роль передаёт
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
          const stat = getRoleStat(toad, role);

          return {
            toad,
            rank: stat,
            tone: own ? "selected" : other ? "warn" : "default",
            // Жаба не пройдёт проверку сектора (силы, болезнь) — плитка краснеет с причиной
            issue: getExpeditionIssue(toad),
            note: (
              <>
                ❤️ {Math.round(getToadHp(toad))}
                {own
                  ? " · ✓ на этой роли"
                  : other
                    ? ` · в команде: ${ROLE_CONFIG[other].icon} ${
                        ROLE_CONFIG[other].label
                      }`
                    : ""}
              </>
            ),
            meter: getRoleMeter(toad, role),
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
   * «Отправить всех в биопод»: убирает вернувшихся жаб из «Разведки» одним действием.
   *
   * У каждой жабы сначала проверяется её дом (`homeId`), а если он занят или обесточен —
   * любой свободный биопод под током. Контекст читаем из сейва заново перед каждой
   * жабой: предыдущая уже заняла место, и старый снимок показал бы его свободным.
   * Кнопка доступна только когда поход этого контура разобран (или его не было):
   * перемещать жаб, пока они числятся в команде, нельзя.
   */
  const handleSendAllHome = () => {
    if (!crewRoom || crew.length === 0) {
      return;
    }

    if (ownActiveExpeditions.length > 0) {
      addNotification({
        type: "warn",
        content: "Сначала завершите поход и разберите добычу.",
      });
      return;
    }

    const { sent, failed } = releaseToadsToHome(
      crew.map((toad) => toad.id),
      () => {
        const fresh = getGameState();
        const freshScenes = fresh.scenes ?? [];

        return {
          rooms: resolveColonyRooms(fresh.colony ?? EMPTY_COLONY, freshScenes),
          scenes: freshScenes,
          toads: fresh.toads ?? [],
          expeditions: fresh.expeditions ?? [],
        };
      },
    );

    if (failed > 0) {
      addNotification({
        type: "warn",
        content: sent
          ? `В биоподы ушли ${sent} жаб, ${failed} не поместились: нет свободных мест под током.`
          : "В биоподах нет свободных мест под током.",
        timeout: 9000,
      });
      return;
    }

    addNotification({
      type: "success",
      content:
        sent === 1
          ? "Жаба вернулась в биопод."
          : `В биоподы вернулись: ${sent}.`,
    });
  };

  /**
   * Крестик слота: жаба уходит из контура домой — в свой биопод, а если место там занято,
   * в любой свободный под током. Слот освобождаем только после переезда, иначе жаба
   * осталась бы в секторе без роли; если биоподы полны — она остаётся в команде.
   */
  const handleReleaseFromSlot = (toad: Toad) => {
    if (crewRoom) {
      const result = releaseToad(toad.id);

      if (!result.ok) {
        addNotification({
          type: "warn",
          content: `${toad.name}: в биоподах нет свободных мест под током — жаба остаётся в команде.`,
          timeout: 9000,
        });
        return;
      }
    }

    setSlots((prev) => removeToadFromTeam(prev, toad.id));
  };

  /**
   * Выбор жабы в слоте роли: жаба сразу переезжает в контур «Разведки» — карта рисует её
   * спрайтом в секторе, и с этого момента она и есть команда. Место в биоподе при этом
   * освобождается (`placeToadInRoom` помнит дом в `homeId`), поэтому жаба из любого сектора
   * колонии может встать в слот.
   *
   * Если роль уже занята другой жабой, прежнюю сначала возвращаем в биопод: иначе в секторе
   * оказалось бы шесть жаб на пять мест. Не поместилась — команда остаётся как была,
   * и игрок видит причину. По той же причине жабу не пускаем в сектор, где уже пять
   * жильцов, — карта такую жабу тоже не приняла бы.
   */
  const handleRolePick = (role: ExpeditionRole, toad: Toad) => {
    const check = canSendToad(toad, expeditions);

    if (!check.ok) {
      addNotification({
        type: "warn",
        content: `${toad.name}: ${check.reason}`,
      });
      return;
    }

    // Без контура слот никого никуда не переселяет: команда живёт только в «Разведке»
    if (!crewRoom) {
      addNotification({
        type: "warn",
        content:
          "Сектор «Разведка» не найден: откройте поход через гекс сектора.",
      });
      return;
    }

    // Сектор вмещает ровно одну команду: шестую жабу карта в него не пустит
    const inRoom = crew.some((item) => item.id === toad.id);

    if (!inRoom && crew.length >= EXPEDITION_TEAM_SIZE) {
      addNotification({
        type: "warn",
        content: `В «Разведке» заняты все ${EXPEDITION_TEAM_SIZE} мест: сначала верните кого-то в биопод.`,
        timeout: 9000,
      });
      return;
    }

    const previousId = slots[role];
    const previous =
      previousId === ""
        ? null
        : (crew.find((item) => item.id === previousId) ?? null);

    if (previous && previous.id !== toad.id) {
      const released = releaseToad(previous.id);

      if (!released.ok) {
        addNotification({
          type: "warn",
          content: `${previous.name}: в биоподах нет свободных мест под током — жаба остаётся в команде.`,
          timeout: 9000,
        });
        return;
      }
    }

    placeToad(toad.id, crewRoom.id);
    setSlots((prev) => assignToadToRole(prev, toad.id, role));
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
        className={`ui-panel flex h-full flex-col gap-2 overflow-hidden rounded-none border p-3 ${
          !unlocked
            ? "border-slate-700/40 bg-slate-950/50 text-slate-500"
            : selected
              ? "border-emerald-400/70 bg-slate-950/50 text-emerald-50"
              : "border-slate-600/40 bg-slate-950/50 text-slate-200"
        }`}
      >
        {item.image && (
          <div className="-mx-3 -mt-3 shrink-0 border-b border-slate-700/40 bg-slate-950/50">
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
                className={`ui-badge ml-auto shrink-0 ${
                  !unlocked
                    ? "border-slate-600/40 bg-slate-950/50 text-slate-400"
                    : selected
                      ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-100"
                      : "border-slate-600/40 bg-slate-950/50 text-slate-300"
                }`}
              >
                {!unlocked ? "🔒 закрыт" : "открыт"}
              </span>
            </p>
            <p className="text-2xs text-slate-400">{item.description}</p>
          </div>
        </div>

        <DataGrid columns={3}>
          <DataCell
            dense
            label="Путь туда"
            value={`${item.durationHours} ч`}
            color="text-white"
          />
          <DataCell
            dense
            label="Добыча / Сложность"
            value={`×${item.lootMultiplier} / ×${
              Math.round(getSectorDamageMultiplier(item) * 100) / 100
            }`}
            color="text-white"
          />
          <DataCell
            dense
            label="Снаряжение"
            value={`${sendCost} 🧪`}
            color="text-white"
          />
          <DataCell
            dense
            label="Силы необходимо"
            value={`${energyCostPerToad} ⚡`}
            color="text-white"
          />
          <DataCell
            dense
            label="Потенциальная добыча"
            value={
              <div
                className="flex flex-wrap items-center gap-1"
                title={`${Math.round(
                  EXPEDITION_SAMPLE_TOAD_CHANCE * 100,
                )}% за удачный поход: «${sampleReward.template.name}»`}
              >
                <span>{getContourPassReward(item)} 🎫</span>
                <span className="flex items-center gap-0.5 bg-slate-950/50 px-1 py-0.5">
                  <ToadAvatar toad={sampleReward.template as Toad} size={4} />
                  <span className="text-3xs font-semibold text-slate-300">
                    {Math.round(EXPEDITION_SAMPLE_TOAD_CHANCE * 100)}%
                  </span>
                </span>
              </div>
            }
            color="text-white"
          />
          <DataCell
            dense
            label="Шанс удачного возврата"
            value={
              <>
                {Math.round(successChance * 100)}%
                {successChance >= 1 ? " (гарантия)" : ""}
              </>
            }
            color={successChance >= 1 ? "text-emerald-300" : "text-amber-200"}
          />
        </DataGrid>

        {!sectorUnlocked && (
          <div className="ui-panel flex flex-col gap-2 rounded-none border-amber-500/40 bg-amber-950/30 px-3 py-2">
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
              className={`w-full rounded-none border py-2 font-mono text-2xs font-bold uppercase tracking-[0.08em] transition-colors duration-300 ${
                canUnlockSector
                  ? "bg-amber-800/60 border-amber-400/70 text-amber-50 hover:bg-amber-700/70"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-500"
              }`}
            >
              🎫 Открыть за {unlockStatus.required} 🎫
            </ClickButton>
          </div>
        )}
      </div>
    );
  });

  return (
    <Modal title={room?.name ?? crewRoom?.name ?? "Разведка"} tone="emerald">
      {/* Переключатель сразу под названием: дальше — сводка и выбранный таб */}
      <ModalTabs tabs={expeditionTabs} active={tab} onChange={setTab} />

      <div className="flex flex-col gap-3 px-1">
        {/* Сводка по разведке: та же «капсула», что у торгового терминала —
            HUD-панель с верхним свечением, статусом канала и живым маркером. */}
        <HudPanel
          tone={powerIssue ? "rose" : "emerald"}
          className="p-2.5 shadow-[0_0_26px_-12px_rgba(52,211,153,0.95)]"
        >
          <SectionTitle aside={powerIssue ? "OFFLINE" : "ONLINE"}>
            Контур связи
          </SectionTitle>

          <DataGrid columns={3} tone={powerIssue ? "rose" : "emerald"}>
            <DataCell
              dense
              label="Пропуска Контура"
              value={contourPasses}
              color="text-emerald-200"
            />
            <DataCell
              dense
              label="Завершено"
              value={stats.completed}
              color="text-white"
            />
            <DataCell
              dense
              label="Активных"
              value={`${shownActiveExpeditions.length}/${teamLimit}`}
              color="text-emerald-300"
            />
          </DataGrid>

          <div className="mt-2 flex items-center justify-between gap-2 text-3xs uppercase tracking-[0.14em] text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1 w-1 shrink-0 animate-pulse ${
                  powerIssue
                    ? "bg-rose-300 shadow-[0_0_6px_rgba(251,113,133,0.8)]"
                    : "bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                }`}
              />
              <span
                className={`truncate ${powerIssue ? "text-rose-300" : "opacity-100"}`}
                title={powerIssue ?? undefined}
              >
                {powerIssue ?? `Канал защищён · ${crewRoom?.name ?? "контур"}`}
              </span>
            </span>
            <span
              className={`shrink-0 ${
                powerIssue
                  ? "text-rose-300/80"
                  : "text-emerald-300/80 opacity-100"
              }`}
            >
              {powerIssue ? "NO PWR" : "UPLINK"}
            </span>
          </div>
        </HudPanel>

        {/* ВКЛАДКА: поход этого контура или сборы новой команды */}
        {tab === "main" && (
          <div className="flex flex-col gap-3">
            {shownCompletedExpeditions.map((expedition) => {
              const sectorDef = getSectorById(expedition.sectorId);
              const storage = getExpeditionStorageCheck(expedition);
              const foundToads = getExpeditionFoundToadsCheck(
                expedition,
                "storage",
              );
              const canFinishStorage = storage.ok && foundToads.ok;
              const biomassValue = getExpeditionBiomassValue(expedition);
              const survived = expedition.success !== false;

              return (
                <HudPanel
                  key={expedition.id}
                  tone={survived ? "emerald" : "rose"}
                  className="flex flex-col gap-2 p-3"
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
                      className={`ui-badge shrink-0 ${
                        survived
                          ? "border-emerald-400/40 bg-emerald-900/60 text-emerald-200"
                          : "border-red-400/40 bg-red-900/50 text-red-200"
                      }`}
                    >
                      {survived ? "✅ поход удался" : "⚠️ провал"}
                    </span>
                  </div>
                  <TeamStatusList expedition={expedition} />
                  <ExpeditionLootGrid
                    loot={expedition.loot}
                    contourPasses={expedition.contourPasses}
                    sampleToad={getExpeditionSampleReward(sectorDef).template}
                  />

                  {(expedition.companions?.length ?? 0) > 0 && (
                    <p className="text-2xs leading-snug text-cyan-200">
                      🐸 С командой{" "}
                      {expedition.companions!.map((toad) => `«${toad.name}»`).join(", ")}
                      {" "}— «Завершить» поселит в биопод, «В биомассу»
                      переработает вместе с лутом.
                    </p>
                  )}
                  {!foundToads.ok && (
                    <p className="text-2xs leading-snug text-red-300">
                      В биоподах нет места для найденных жаб: нужно{" "}
                      {foundToads.needed}, свободно {foundToads.free} — постройте
                      «Биопод», иначе «Завершить» недоступно. Лут можно
                      переработать в биомассу.
                    </p>
                  )}

                  <ClickButton
                    onClick={() => openExpeditionLog(expedition)}
                    title="Прочитать полный бортовой журнал завершённого похода"
                    className=" mt-6 w-full  rounded-none border border-emerald-500/40 bg-emerald-950/40 py-2 font-mono text-2xs font-bold uppercase tracking-[0.06em] text-emerald-100 hover:bg-emerald-900/50"
                  >
                    📡 Открыть логи{" "}
                    <span className="ml-1 rounded-none bg-slate-950/50 px-1.5 py-0.5 font-mono text-3xs font-semibold tabular-nums text-slate-300">
                      {expedition.log.length}
                    </span>
                  </ClickButton>
                  <div className="flex flex-wrap gap-1.5">
                    <ClickButton
                      onClick={() => handleFinish(expedition.id, "storage")}
                      disabled={!canFinishStorage}
                      title={
                        !storage.ok
                          ? "На складе не хватает места: постройте «Склад» или переработайте лут в биомассу"
                          : !foundToads.ok
                            ? `В биоподах нет места для найденных жаб: нужно ${foundToads.needed}, свободно ${foundToads.free}. Постройте «Биопод»`
                            : "Забрать предметы на склад, а биомассу, Кваксы и образцы — в колонию"
                      }
                      className={`flex-1 rounded-none border py-2 font-mono text-2xs font-bold uppercase tracking-[0.06em] ${
                        canFinishStorage
                          ? "border-emerald-500/40 bg-emerald-900/50 text-emerald-100 hover:bg-emerald-800/60"
                          : "cursor-not-allowed border-slate-600/30 bg-slate-800/40 text-slate-500"
                      }`}
                    >
                      Завершить
                    </ClickButton>
                    <ClickButton
                      onClick={() => handleFinish(expedition.id, "biomass")}
                      title="Переработать всю добычу похода — включая предметы, образцы и попутчиков — в биомассу"
                      className="flex-1 rounded-none border border-lime-500/40 bg-lime-900/50 py-2 font-mono text-2xs font-bold uppercase tracking-[0.06em] text-lime-100 hover:bg-lime-800/60"
                    >
                      🧪 Превратить лут в биомассу (+{biomassValue} 🧪)
                    </ClickButton>
                  </div>
                </HudPanel>
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
                <HudPanel
                  key={expedition.id}
                  tone={stranded ? "rose" : returning ? "sky" : "emerald"}
                  className="flex flex-col gap-2 p-3"
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
                      className={`ui-badge ${
                        stranded
                          ? "border-red-400/40 bg-red-900/60 text-red-100"
                          : returning
                            ? "border-blue-400/40 bg-blue-900/50 text-blue-200"
                            : "border-amber-400/40 bg-amber-900/50 text-amber-200"
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
                    <div className="h-1.5 w-full overflow-hidden bg-slate-800/80">
                      <div
                        className={`h-full transition-all duration-500 ${
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
                        <ToadIcon className="mr-1 h-3 w-3" />С командой идёт:{" "}
                        {expedition.companions
                          .map(
                            (toad) =>
                              `${getToadTypeLabel(
                                toad.type ?? null,
                              ).toLowerCase()} «${toad.name}»`,
                          )
                          .join(", ")}{" "}
                        — при завершении похода поселится в биопод
                      </p>
                    )}

                  <p className="text-2xs text-slate-300">
                    Добыча:{" "}
                    <IconText
                      text={getExpeditionLootSummary(expedition)}
                      iconClassName="h-3 w-3"
                    />
                  </p>

                  <ExpeditionLogList log={expedition.log} limit={40} />

                  <div className="flex flex-wrap gap-1.5">
                    {!returning && (
                      <ClickButton
                        onClick={() => handleWithdraw(expedition.id)}
                        className="flex-1 rounded-none border border-slate-600/40 bg-red-800/60 py-2 font-mono text-2xs font-bold uppercase tracking-[0.06em] text-slate-200 hover:bg-red-700/70"
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
                        className={`flex-1 rounded-none border py-2 font-mono text-2xs font-bold uppercase tracking-[0.06em] ${
                          canAffordEvacuation
                            ? "border-red-500/40 bg-red-800/60 text-red-50 hover:bg-red-700/70"
                            : "cursor-not-allowed border-slate-600/40 bg-slate-700/60 text-slate-400"
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
                          className="flex-1 rounded-none border border-emerald-500/40 bg-emerald-900/50 py-2 font-mono text-2xs font-bold uppercase tracking-[0.06em] text-emerald-100 hover:bg-emerald-800/60"
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
                          ? "Забрать команду домой сразу: итог посчитается как при обычном возврате, без ожидания таймера"
                          : "Забрать команду с середины пути: поход не будет успешным, добыча — только уже найденная"
                      }
                      className="flex-1 rounded-none border border-emerald-500/40 bg-emerald-900/50 py-2 font-mono text-2xs font-bold uppercase tracking-[0.06em] text-emerald-100 hover:bg-emerald-800/60"
                    >
                      Закончить немедленно ({EXTRACTION_ASTRO_COST}{" "}
                      <CurrencyIcon currency="astro_quax" className="h-3 w-3" />
                      )
                    </ClickButton>
                  </div>
                </HudPanel>
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

            {/* Слоты ролей команды: та же сетка с «+», что у репродуктора, коллайдера и Медотсека.
                Жаба в слоте и есть команда в контуре: выбор переносит её в «Разведку»,
                крестик — возвращает в биопод, а «Отправить всех в биопод» очищает сектор. */}
            <ToadSlotGrid
              slots={EXPEDITION_ROLE_ORDER.map((role) => {
                const config = ROLE_CONFIG[role];
                const pickedId = slots[role];
                const picked =
                  pickedId === ""
                    ? null
                    : (state.toads.find((toad) => toad.id === pickedId) ??
                      null);

                return {
                  toad: picked,
                  label: config.label,
                  icon: config.icon,
                  // Сила роли и её характеристика — той же полоской, что в модалке выбора
                  meter: picked ? getRoleMeter(picked, role) : undefined,
                  // Жаба без сил на этот сектор: слот краснеет с причиной, а не зеленеет
                  issue: picked ? getExpeditionIssue(picked) : null,
                  disabledHint: `${config.label}: ${config.description}`,
                };
              })}
              columns={5}
              // Значок роли остаётся на занятом слоте: так видно, кто какую роль занимает
              showIconOnOccupied
              title="Команда в контуре"
              headerRight={`собрано ${members.length} из ${EXPEDITION_TEAM_SIZE}`}
              pickerFor={(index) => getRolePicker(EXPEDITION_ROLE_ORDER[index])}
              onPick={(toad, index) =>
                handleRolePick(EXPEDITION_ROLE_ORDER[index], toad)
              }
              onOpen={openToadCard}
              onRemove={handleReleaseFromSlot}
              removeLabel="Вернуть в биопод"
              footer={
                crewRoom ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-2xs leading-snug text-slate-400">
                      {crew.length > 0
                        ? `В «Разведке»: ${crew.length}/${EXPEDITION_TEAM_SIZE} `
                        : "Сектор пуст: соберите команду."}
                    </p>
                    {crew.length > 0 && (
                      <ClickButton
                        onClick={handleSendAllHome}
                        title="Вернуть всех жаб из «Разведки» в биоподы: домой, а если места нет — в любой свободный биопод под током"
                        className="ui-chip shrink-0 border-slate-400/30 bg-slate-500/10 text-slate-200 transition-colors hover:bg-slate-500/20"
                      >
                        х Расформировать команду
                      </ClickButton>
                    )}
                  </div>
                ) : undefined
              }
            />

            {/* Итог отправки */}
            {((members.length > 0 && biomass < sendCost) ||
              tiredMembers.length > 0 ||
              unfitMembers.length > 0) && (
              <div className="ui-panel flex flex-col gap-2 rounded-none border-slate-600/30 bg-color-main px-3 py-2">
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
                {unfitMembers.length > 0 && (
                  <p className="text-2xs text-red-300">
                    Жабы не готовы к походу:{" "}
                    {unfitMembers
                      .map(({ toad, reason }) => `${toad.name} — ${reason}`)
                      .join(", ")}
                  </p>
                )}
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
                      className="ui-panel w-full cursor-pointer rounded-none border-slate-600/40 bg-slate-950/50 p-3 text-left transition-colors hover:border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-white">
                          {sectorDef.icon} {sectorDef.name}
                        </p>
                        <span
                          className={`ui-badge shrink-0 ${
                            stranded
                              ? "border-red-400/40 bg-red-900/60 text-red-100"
                              : returning
                                ? "border-blue-400/40 bg-blue-900/50 text-blue-200"
                                : "border-amber-400/40 bg-amber-900/50 text-amber-200"
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
                      <div className="mt-2 h-1.5 w-full overflow-hidden bg-slate-800/80">
                        <div
                          className={`h-full transition-all duration-500 ${
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
                      className="ui-panel w-full cursor-pointer rounded-none border-emerald-500/40 bg-emerald-950/30 p-3 text-left transition-colors hover:border-emerald-400/60 hover:bg-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-white">
                          {sectorDef.icon} {sectorDef.name}
                        </p>
                        <span className="ui-badge shrink-0 border-emerald-400/40 bg-emerald-900/60 text-emerald-200">
                          🎁 ждёт разбора
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-2xs text-slate-400">
                        🧭 {originRoom?.name ?? "«Разведка» не записана"} ·{" "}
                        {expedition.team.length} жаб
                      </p>
                      <p className="mt-1 text-2xs text-slate-300">
                        <IconText
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
                      className="ui-panel rounded-none border-slate-600/40 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-white">
                          {sectorDef.icon} {sectorDef.name}
                        </p>
                        <span
                          className={`ui-badge shrink-0 ${
                            survived
                              ? "border-emerald-400/40 bg-emerald-900/50 text-emerald-200"
                              : "border-red-400/40 bg-red-900/50 text-red-200"
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
                        <IconText
                          text={getExpeditionLootSummary(expedition)}
                          iconClassName="h-3 w-3"
                        />
                      </p>
                      <ClickButton
                        onClick={() => openExpeditionLog(expedition)}
                        title="Прочитать полный бортовой журнал этого похода"
                        className="mt-2 w-full rounded-none border border-emerald-500/40 bg-emerald-950/40 py-1.5 font-mono text-3xs font-bold uppercase tracking-[0.06em] text-emerald-100 hover:bg-emerald-900/50"
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
              <DataGrid columns={3}>
                <DataCell
                  dense
                  label="🧭 В секторе"
                  value={crew.length}
                  color="text-white"
                />
                <DataCell
                  dense
                  label="✅ Готовы к походу"
                  value={crewSendable.length}
                  color="text-emerald-300"
                />
                <DataCell
                  dense
                  label="🚁 Активных команд"
                  value={`${shownActiveExpeditions.length}/${teamLimit}`}
                  color="text-white"
                />
              </DataGrid>
            }
          />
        )}
      </div>
    </Modal>
  );
};

export default ExpeditionModal;
