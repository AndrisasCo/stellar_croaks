import React, { useState, useEffect } from "react";
import { RARITY_GROUPS_TRESHOLD, Toad } from "../../../models/Toad";
import Modal from "../../shared/Header";
import { updateToadsByIds } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { useToads } from "../../ToadContext";
import { completeAchivement } from "../../../backend/achivements-manager";
import { ToadListCard } from "../../shared/ToadListCard";
import { Filters } from "../../shared/Filters";
import { useFilters } from "../../../hooks/use-filters";
import { Tooltip } from "../../shared/Tooltip";
import { getGameState } from "../../../backend/localStorage";
import { useNotifications } from "../../../hooks/use-notification";
import { ClickButton } from "../../shared/ClickButton";
import { ArrowLeftButtonCompact } from "../../shared/ArrowLeft";
import { ArrowRightButtonCompact } from "../../shared/ArrowRight";
import { getFamilyGroups, getRelationshipColor } from "./utils";
import { CompactToadItem } from "./CompactToadItem";
import { ToadInfo } from "../ToadInfoModal";
import { useModal } from "../../ModalContext";
import { getHousingInfo } from "../../../utils/housing";
import { getRoomUpgrades } from "../../../backend/colony";
import { isUpgradeActive } from "../../../utils/room-upgrades";
import { useColony } from "../../../hooks/use-colony";
import { useGameState } from "../../../hooks/use-game-state";
import { useHospitalAdmission } from "../../../hooks/use-hospital-admission";
import { useRoomPowerTab } from "../../../hooks/use-room-power-tab";
import { isToadAwayFromEnclosure } from "../../../utils/toad-location";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../../utils/expedition-manager";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { ToadIcon } from "../../shared/ToadIcon";
import { SceneStatsTab } from "./SceneStatsTab";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
import { RoomConfig } from "../../HexMap/rooms-config";
import {
  getRoomPowerIssue,
  ROOM_UNPOWERED_TITLE,
} from "../../HexMap/colony-build";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "../RoomDataTab";
import { DataCell, DataGrid, HudPanel } from "../../shared/DataGrid";

/**
 * Список жаб одного биопода.
 *
 * Биопод приходит от гекса карты, по которому тапнули (`RoomConfig.sceneId`): общего
 * «текущего биопода» больше нет, поэтому и закреплён за модалкой гекс. Стрелки листают
 * биоподы прямо здесь (`ownedScenes`) по кругу, не трогая состояние игры: после
 * последнего биопода снова идёт первый, поэтому листать можно бесконечно в обе стороны.
 *
 * У биопода два состояния (таба): список жаб — по умолчанию, и статистика биопода
 * (`SceneInfoModal` больше нет: его содержимое переехало во вкладку `SceneStatsTab`).
 * Если модалку открыл гекс карты, последним идёт общий таб «Данные сектора»
 * (`modals/RoomDataTab.tsx`): описание, апгрейды и снос того же гекса.
 */
type ToadListTab = "toads" | "stats" | RoomDataTabId;

/** Без тока у биопода остаётся только список жаб: смотреть жильцов можно, статистика — нет */
const TOAD_LIST_TABS_ALWAYS_ALLOWED: readonly ToadListTab[] = ["toads"];

/** Табы биопода без «Данных сектора»: список жаб и статистика биопода */
const TOAD_LIST_TABS: ModalTabItem<ToadListTab>[] = [
  {
    id: "toads",
    label: (
      <>
        <ToadIcon className="mr-1 h-3.5 w-3.5" />
        Жабы
      </>
    ),
  },
  { id: "stats", label: "📊 Статистика" },
];

const ToadListModal: React.FC<{
  /** Биопод, который открывают: гекс карты или дом жабы (`homeId`) из её карточки */
  sceneId?: number | null;
  /** Гекс карты, из которого открыли список: по нему появляется таб «Данные сектора» */
  room?: RoomConfig;
}> = ({ sceneId, room }) => {
  const { openModal } = useModal();
  const { playCrunchShort } = useSoundEffects();
  const { handleFeedToads, ownedScenes, selectToad, allToads, selectedToad } =
    useToads();
  const { addNotification } = useNotifications();
  const { expeditions = [] } = useGameState();
  const { rooms, powerGrid } = useColony();
  /** Быстрая отправка на койку из списка: правила те же, что у карты */
  const { getAdmission, admit } = useHospitalAdmission();
  /**
   * Обесточенный биопод открывается на данных сектора, но список жаб остаётся живым:
   * смотреть и кормить жильцов можно, а биомассу такой биопод не вырабатывает.
   */
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<ToadListTab>({
    room,
    powerGrid,
    defaultTab: "toads",
    allowedWhenUnpowered: TOAD_LIST_TABS_ALWAYS_ALLOWED,
  });

  // Биопод списка: гекс задаёт стартовый, стрелки листают остальные
  const [sceneIndex, setSceneIndex] = useState(() => {
    const index = ownedScenes.findIndex((scene) => scene.id === sceneId);

    return index >= 0 ? index : 0;
  });
  const scene = ownedScenes[sceneIndex] ?? ownedScenes[0] ?? null;

  /** Гекс-биопод открытого списка: по нему видно питание и апгрейды сектора (автокормушка) */
  const enclosureRoom = React.useMemo(
    () => rooms.find((room) => room.sceneId === scene?.id) ?? null,
    [rooms, scene?.id],
  );

  /**
   * «Данные сектора» относим к показанному гексу, а не к тому, с которого модалку
   * открыли. Иначе после стрелок таб продолжает править стартовый биопод: его
   * апгрейды выглядят купленными у всех подряд, а снос бьёт не по тому гексу.
   * Таб остаётся только у списков, открытых с карты (`room`), как и раньше.
   */
  const roomDataRoom = room ? enclosureRoom : null;

  /**
   * Питание текущего биопода. Стрелки листают биоподы, не закрывая модалку, поэтому
   * ориентируемся на показанный гекс, а не на тот, с которого модалку открыли.
   * Запасной `powerIssue` годится, только пока показан тот же гекс: у сейва может не
   * найтись `RoomConfig`, но чужому биоподу чужое питание приписывать нельзя.
   */
  const currentPowerIssue = enclosureRoom
    ? getRoomPowerIssue(enclosureRoom, powerGrid)
    : room?.sceneId === scene?.id
      ? powerIssue
      : null;

  /**
   * Без тока рабочие вкладки недоступны. Если стрелки привели на обесточенный биопод,
   * уводим со статистики: на данных сектора (когда гекс известен) или на список жаб.
   */
  useEffect(() => {
    if (!currentPowerIssue) {
      return;
    }

    if (tab === "toads" || (tab === "room-data" && roomDataRoom)) {
      return;
    }

    setTab(roomDataRoom ? "room-data" : "toads");
  }, [currentPowerIssue, roomDataRoom, setTab, tab]);

  /**
   * Вкладка «Данные сектора» живёт только у гекса с настройками. У старого сейва
   * биопод может быть без `RoomConfig`, и после листания по кругу такая вкладка
   * осталась бы вкладкой-призраком с пустым телом. Уводим на список жаб.
   */
  useEffect(() => {
    if (tab === "room-data" && !roomDataRoom) {
      setTab("toads");
    }
  }, [roomDataRoom, setTab, tab]);

  /**
   * Жабы открытого биопода — только те, кто в нём **сейчас** (`scene_id`). Жаба в секторе
   * колонии (репродуктор, ⚡, «Разведка», Медотсек) место в биоподе не занимает и в списке
   * не висит: вернуть её домой можно из карточки жабы или из модалки сектора
   * (`utils/toad-location.ts`).
   */
  const toads = React.useMemo(
    () =>
      allToads
        .filter(
          (toad) =>
            toad.scene_id === scene?.id &&
            !isToadBusyOnExpedition(toad, expeditions),
        )
        .sort((a, b) => b.genes.rarity - a.genes.rarity),
    [allToads, scene?.id, expeditions],
  );

  /**
   * Свои жабы в походе: место в биоподе они освободили (`scene_id`), но дом (`homeId`)
   * помнят. Показываем их отдельной плашкой, чтобы они не пропадали из меню своего
   * биопода до возвращения. Вместимость и кормление считаются только по жильцам (`toads`).
   */
  const awayToads = React.useMemo(
    () =>
      allToads
        .filter((toad) =>
          isToadAwayFromEnclosure(
            toad,
            scene?.id,
            isToadBusyOnExpedition(toad, expeditions),
          ),
        )
        .sort((a, b) => b.genes.rarity - a.genes.rarity),
    [allToads, scene?.id, expeditions],
  );

  const {
    filteredAndSortedToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  } = useFilters(toads);

  const [viewMode, setViewMode] = useState<"detailed" | "compact">("detailed");

  /**
   * Табы биопода: список жаб, статистика и, если модалку открыл гекс, «Данные сектора».
   * Без тока статистика закрыта, а список жаб остаётся: жильцы доступны всегда.
   */
  const tabs: ModalTabItem<ToadListTab>[] = [
    ...TOAD_LIST_TABS.map((tab) =>
      tab.id === "toads"
        ? tab
        : {
            ...tab,
            disabled: Boolean(currentPowerIssue),
            disabledHint: currentPowerIssue ?? undefined,
          },
    ),
    ...(roomDataRoom ? [{ ...ROOM_DATA_TAB }] : []),
  ];
  const [selectedToads, setSelectedToads] = useState<Set<number>>(new Set());
  const [showMoveTooltip, setShowMoveTooltip] = useState(false);
  const [familyGroups, setFamilyGroups] = useState<Map<number, number>>(
    new Map(),
  );

  /** Места в биоподах колонии: склада жаб больше нет, поэтому это единственный дом */
  const housing = getHousingInfo();

  /**
   * Автокормушка биопода: апгрейд стоит у гекса (`getRoomUpgrades`), и легаси-бонус
   * биопода читается там же, поэтому спрашиваем про гекс, а не про `Scene`.
   * Если гекс не нашёлся (сейв знает биопод, но не карту), проверяем биопод напрямую —
   * так старая покупка тоже видна.
   *
   * Покупка и выключатель — разные вещи: жабам помогает только включённая кормушка,
   * а в шапке видно, что улучшение вообще есть (см. `isUpgradeActive`).
   */
  const autoFeederSceneId = scene?.id;
  const roomUpgrades = React.useMemo(
    () =>
      autoFeederSceneId == null
        ? {}
        : getRoomUpgrades(
            enclosureRoom ?? {
              id: `enclosure-${autoFeederSceneId}`,
              sceneId: autoFeederSceneId,
            },
          ),
    [enclosureRoom, autoFeederSceneId],
  );
  const hasAutoFeeder = Boolean(roomUpgrades.autoFeeder);
  const autoFeederActive = isUpgradeActive(roomUpgrades, "autoFeeder");

  useEffect(() => {
    if (!selectedToad) {
      return;
    }
    const element = document.getElementById(selectedToad.id.toString());

    if (element) {
      element.scrollIntoView();
    }
  }, [selectedToad?.id]);

  // Вычисляем родственные группы при изменении списка жаб
  useEffect(() => {
    if (toads.length > 0) {
      const groups = getFamilyGroups(toads);
      setFamilyGroups(groups);
    }
  }, [toads]);

  const handleToadClick = (toad: Toad) => {
    selectToad(toad.id);
    openModal(() => <ToadInfo />);
  };

  // Функция для выделения/снятия выделения жабы
  const handleSelectToad = (toadId: number) => {
    setSelectedToads((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(toadId)) {
        newSelected.delete(toadId);
      } else {
        newSelected.add(toadId);
      }
      return newSelected;
    });
  };

  // Выделить все
  const selectAll = () => {
    setSelectedToads(new Set(filteredAndSortedToads.map((toad) => toad.id)));
  };

  // Отменить выделение
  const clearSelection = () => {
    setSelectedToads(new Set());
  };

  // Покормить выделенных
  const feedSelected = () => {
    if (selectedToads.size === 0) return;

    const feedIds = Array.from(selectedToads).filter((id) => {
      const toad = allToads.find((item) => item.id === id);
      return Boolean(toad && !isToadBusyOnExpedition(toad, expeditions));
    });

    if (feedIds.length !== selectedToads.size) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      setSelectedToads(new Set(feedIds));
      return;
    }

    playCrunchShort();
    handleFeedToads(feedIds);
    completeAchivement("feed-one");
    setSelectedToads(new Set());
  };

  // Переместить выделенных: биопод обязателен — склада жаб больше нет.
  // Переезд — это новое место и новый дом (`scene_id` и `homeId`), а сектор колонии
  // освобождается: место у жабы одно (`utils/toad-location.ts`).
  const moveSelected = (sceneId: number) => {
    if (selectedToads.size === 0) return;

    const state = getGameState();
    const currentExpeditions = state.expeditions ?? [];
    // Жабу могли отправить в поход, пока список был открыт: перенос ждёт возвращения
    const movingIds = Array.from(selectedToads).filter((id) => {
      const toad = state.toads.find((item) => item.id === id);
      return Boolean(toad && !isToadBusyOnExpedition(toad, currentExpeditions));
    });

    if (movingIds.length !== selectedToads.size) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      setSelectedToads(new Set(movingIds));
      return;
    }

    const nextScene = state.scenes.find((s) => s.id === sceneId);
    // Жильцы биопода без самих переезжающих: они как раз уходят из своих биоподов
    const residents =
      state.toads.filter(
        (t) => t.scene_id === sceneId && !selectedToads.has(t.id),
      ).length + movingIds.length;

    if (!nextScene || nextScene.capacity < residents) {
      addNotification({ type: "warn", content: "Данный биопод переполнен!" });
      return;
    }

    updateToadsByIds(movingIds, {
      scene_id: sceneId,
      homeId: sceneId,
    });

    setSelectedToads(new Set());
    setShowMoveTooltip(false);
  };

  // Группируем жаб по всем типам редкости
  const groupedToads = {
    common: toads.filter(
      (toad) => toad.genes.rarity < RARITY_GROUPS_TRESHOLD.uncommon,
    ),
    uncommon: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.uncommon &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.rare,
    ),
    rare: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.rare &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.epic,
    ),
    epic: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.epic &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.legendary,
    ),
    legendary: toads.filter(
      (toad) => toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.legendary,
    ),
  };

  // Общая статистика по голоду
  const hungerStats = {
    wellFed: toads.filter((t) => t.state.hunger >= 80).length,
    normal: toads.filter((t) => t.state.hunger >= 50 && t.state.hunger < 80)
      .length,
    starving: toads.filter((t) => t.state.hunger < 50).length,
  };

  /**
   * Биоподы листаются по кругу: после последнего идёт первый, перед первым — последний.
   * Так стрелка никогда не «залипает» на краю, а модалку не нужно закрывать, чтобы
   * вернуться к началу списка. Блокируем кнопки только когда биопод действительно один:
   * листать нечего, и бесконечный цикл из одного элемента выглядел бы как поломка.
   */
  const onNextScene = () =>
    setSceneIndex((index) =>
      ownedScenes.length > 0 ? (index + 1) % ownedScenes.length : 0,
    );

  const onPrevScene = () =>
    setSceneIndex((index) =>
      ownedScenes.length > 0
        ? (index - 1 + ownedScenes.length) % ownedScenes.length
        : 0,
    );

  return (
    <Modal
      tone="emerald"
      title={
        /**
         * Шапка списка — сам биопод: имя, сколько жаб внутри из вместимости и есть ли
         * автокормушка. Суммарные подписи набираем мельче и своим цветом: градиент
         * родительского заголовка иначе перекрасил бы их в общий зелёно-фиолетовый.
         */
        <span className="flex flex-col items-center gap-0.5">
          <span> {scene?.name ?? "Биопод"}</span>

          {hasAutoFeeder && (
            <span
              className={`text-2xs font-medium [-webkit-text-fill-color:currentColor] text-lime-300`}
            >
              Улучшение: автокормушка{autoFeederActive ? "" : " · выключена"}
            </span>
          )}
        </span>
      }
    >
      {/* Состояния биопода: список жаб, его статистика и, если модалку открыл гекс карты,
          данные сектора — переключатель тот же, что у других секторов (`shared/ModalTabs`). */}
      <ModalTabs tabs={tabs} active={tab} onChange={setTab} />

      {/* Сколько жаб внутри и листание биоподов: строка нужна всем вкладкам, поэтому
          остаётся над телом и не зависит от выбранного таба. */}
      <div className="px-1 pb-3 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-300 [-webkit-text-fill-color:currentColor]">
            {toads.length} / {scene?.capacity ?? 0} жаб
          </span>
          {awayToads.length > 0 && (
            <span className="text-2xs font-medium text-amber-300 [-webkit-text-fill-color:currentColor]">
              · 🧭 {awayToads.length} в походе
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 ml-auto">
          <ArrowLeftButtonCompact
            className="w-6 h-6"
            disabled={ownedScenes.length <= 1}
            onClick={onPrevScene}
          />
          <ArrowRightButtonCompact
            className="w-6 h-6"
            disabled={ownedScenes.length <= 1}
            onClick={onNextScene}
          />
        </div>
      </div>

      {/* Список жаб — состояние биопода по умолчанию. Фильтры, режим вида, выделение и
          подвал нужны только здесь: у вкладки статистики свои секции. */}
      {tab === "toads" && (
        <>
          {/* Ошибка сектора: жильцы доступны, но биомасса у обесточенного биопода не растёт */}
          {currentPowerIssue && (
            <HudPanel tone="rose" className="mx-1 mb-3 p-2">
              <p className="text-xs font-bold text-rose-200">
                ⚠️ {ROOM_UNPOWERED_TITLE}
              </p>
              <p className="mt-1 text-2xs leading-snug text-rose-100/80">
                Биопод обесточен: жабы остаются доступны, но биомассу он не
                вырабатывает. Подключите сектор к ядру или энергосектору ⚡.
              </p>
            </HudPanel>
          )}

          {/* Свои жабы в походе: в списке жильцов их нет (место освобождено), но дом
              остался этим биоподом — игрок должен видеть, кто вернётся после похода. */}
          {awayToads.length > 0 && (
            <HudPanel tone="amber" className="mx-1 mb-3 p-2">
              <p className="text-xs font-bold text-amber-200">
                🧭 В походе: {awayToads.length}
              </p>
              <p className="mt-0.5 text-2xs leading-snug text-amber-100/70">
                Убедитесь, что жабам будет куда вернуться
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {awayToads.map((toad) => (
                  <button
                    key={toad.id}
                    type="button"
                    onClick={() => handleToadClick(toad)}
                    className="flex items-center gap-1.5 rounded-none border border-amber-400/30 bg-slate-950/50 px-1.5 py-1 text-left transition-colors hover:border-amber-300/60"
                    title={`${toad.name ?? "Жаба"} — в походе`}
                  >
                    <ToadAvatar toad={toad} size={6} />
                    <span className="max-w-[110px] truncate text-2xs font-medium text-amber-100">
                      {toad.name ?? "Без имени"}
                    </span>
                    <span className="text-2xs text-amber-300">🧭</span>
                  </button>
                ))}
              </div>
            </HudPanel>
          )}

          <Filters
            toads={toads}
            setSortDirection={setSortDirection}
            setSortBy={setSortBy}
            filterBy={filterBy}
            setFilterBy={setFilterBy}
            sortBy={sortBy}
            sortDirection={sortDirection}
            addHunger
            addHealth
          />

          {/* Режим вида: подробные карточки или сетка (по центру — стрелки биоподов) */}
          <div className="px-1 pb-3 flex gap-2 ">
            <ClickButton
              onClick={() => setViewMode("detailed")}
              className={`h-min rounded-none border px-3 py-1 font-mono text-2xs font-semibold uppercase tracking-[0.08em] transition-all ${
                viewMode === "detailed"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25 hover:text-white"
              }`}
              title="Подробный вид"
            >
              Подробно
            </ClickButton>
            <ClickButton
              onClick={() => setViewMode("compact")}
              className={`h-min rounded-none border px-3 py-1 font-mono text-2xs font-semibold uppercase tracking-[0.08em] transition-all ${
                viewMode === "compact"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25 hover:text-white"
              }`}
              title="Компактный вид"
            >
              Сетка
            </ClickButton>
          </div>
          {/* Панель управления выделением (только для компактного режима) */}
          {viewMode === "compact" && (
            <HudPanel className="mb-4 p-3">
              <div className="relative flex items-center justify-between">
                <div className="text-sm text-white">
                  <span className="ui-kicker">Выбрано</span>{" "}
                  <span className="font-mono font-bold tabular-nums">
                    {selectedToads.size}
                  </span>{" "}
                  жаб
                </div>

                <div className="flex gap-2">
                  {/* Выделить все */}
                  <button
                    onClick={selectAll}
                    className="rounded-none border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 font-mono text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25"
                    title="Выделить все"
                  >
                    ▼
                  </button>

                  {/* Отменить выделение */}
                  <button
                    onClick={clearSelection}
                    className="rounded-none border border-slate-500/30 bg-slate-500/20 px-2 py-1 font-mono text-xs font-medium text-slate-200 transition-all hover:bg-slate-500/30"
                    title="Отменить выделение"
                  >
                    ✕
                  </button>

                  {/* Покормить выделенных */}
                  <button
                    onClick={feedSelected}
                    className="rounded-none border border-green-500/30 bg-green-500/20 px-3 py-1 font-mono text-xs font-medium text-green-300 transition-all hover:bg-green-500/30"
                    title="Покормить выделенных"
                  >
                    🍎
                  </button>

                  {/* Переместить выделенных */}
                  <div className="">
                    <button
                      onClick={() => setShowMoveTooltip(!showMoveTooltip)}
                      className="rounded-none border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/25"
                      title="Переместить выделенных"
                    >
                      🏠
                    </button>

                    {showMoveTooltip && (
                      <Tooltip
                        title="Куда"
                        isOpen={true}
                        onClose={() => setShowMoveTooltip(false)}
                        className="right-0 "
                      >
                        <div className="space-y-1 h-40 overflow-auto">
                          {ownedScenes
                            .filter((s) => s.id !== scene?.id)
                            .map((s) => (
                              <button
                                key={s.id}
                                onClick={() => moveSelected(s.id)}
                                className="w-full text-left p-2  text-xs truncate border-b-[1px] border-slate-500/10"
                              >
                                🏠 {s.name}
                              </button>
                            ))}
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            </HudPanel>
          )}

          {/* Контент с прокруткой */}
          <div className="px-1">
            {filteredAndSortedToads.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-3 flex justify-center text-slate-300">
                  <ToadIcon className="h-10 w-10" />
                </div>
                <p className="text-slate-300 text-sm">
                  {toads.length === 0
                    ? awayToads.length > 0
                      ? "В биоподе сейчас никого нет"
                      : "Пока нет жаб в коллекции"
                    : "Жабы не найдены"}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {toads.length === 0
                    ? awayToads.length > 0
                      ? "Жабы этого биопода в походе — они вернутся после разбора добычи"
                      : "Приобретите жаб на рынке"
                    : "Измените фильтры для отображения"}
                </p>
              </div>
            ) : viewMode === "detailed" ? (
              // Подробный режим: список без подсветки родни — цвет семейства
              // остаётся только в компактной сетке, где карточки идут плиткой.
              <div className="space-y-2">
                {filteredAndSortedToads.map((toad) => {
                  const admission = getAdmission(toad);

                  return (
                    <ToadListCard
                      key={toad.id}
                      id={(toad.id || 0).toString()}
                      toad={toad}
                      onOpen={() => handleToadClick(toad)}
                      variant="full"
                      showHunger
                      showHp
                      showEnergy
                      hungerAction={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playCrunchShort();
                            handleFeedToads([toad.id]);
                            completeAchivement("feed-one");
                          }}
                          className="rounded-none border border-green-500/30 bg-green-500/20 px-2 py-1 font-mono text-2xs font-medium leading-none text-green-300 transition-all hover:bg-green-500/30"
                          title="Покормить"
                        >
                          🍎
                        </button>
                      }
                      healthAction={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            admit(toad);
                          }}
                          disabled={!admission.room}
                          className="rounded-none border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 font-mono text-sm font-bold leading-none text-rose-300 transition-all hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-700/20 disabled:text-slate-500"
                          title={admission.issue ?? "Отправить в Медотсек"}
                        >
                          ✚
                        </button>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              // Компактный режим (сетка) с выделением
              <div className="grid grid-cols-3 gap-2">
                {filteredAndSortedToads.map((toad) => {
                  const familyId = familyGroups.get(toad.id);
                  const familyColor =
                    familyId !== undefined
                      ? getRelationshipColor(familyId)
                      : undefined;

                  return (
                    <CompactToadItem
                      key={toad.id}
                      toad={toad}
                      isSelected={selectedToads.has(toad.id)}
                      onSelect={handleSelectToad}
                      familyColor={familyColor}
                      onProfileClick={handleToadClick}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Подвал с статистикой */}
          <div className="border-t border-slate-700/50 py-3 px-2 bg-slate-950/50 mt-3">
            <DataGrid columns={5} className="mb-2">
              <DataCell
                dense
                label="Обычные"
                value={groupedToads.common.length}
                color="text-green-400"
              />
              <DataCell
                dense
                label="Необычные"
                value={groupedToads.uncommon.length}
                color="text-blue-400"
              />
              <DataCell
                dense
                label="Редкие"
                value={groupedToads.rare.length}
                color="text-purple-400"
              />
              <DataCell
                dense
                label="Эпические"
                value={groupedToads.epic.length}
                color="text-orange-400"
              />
              <DataCell
                dense
                label="Легендарные"
                value={groupedToads.legendary.length}
                color="text-yellow-400"
              />
            </DataGrid>

            {/* Статистика голода */}
            <DataGrid columns={3}>
              <DataCell
                dense
                label="Сытые"
                value={hungerStats.wellFed}
                color="text-green-400"
              />
              <DataCell
                dense
                label="Норма"
                value={hungerStats.normal}
                color="text-yellow-400"
              />
              <DataCell
                dense
                label="Голодные"
                value={hungerStats.starving}
                color="text-red-400"
              />
            </DataGrid>

            {/* Места в биоподах: склада жаб нет, поэтому «дом» — только биоподы */}
            <HudPanel className="mt-2 flex items-center justify-between gap-2 px-2 py-1.5 text-2xs text-slate-300">
              <span>
                🏠 Мест в биоподах: {housing.used} / {housing.capacity}{" "}
                (биоподов: {housing.enclosures})
              </span>
              {housing.free === 0 && (
                <span className="text-rose-300">
                  Мест нет — постройте «Биопод» на карте
                </span>
              )}
            </HudPanel>
          </div>
        </>
      )}

      {/* Статистика биопода: второе состояние модалки — шапка, стрелки и список жаб те же,
          меняется только тело */}
      {tab === "stats" && scene && (
        <SceneStatsTab
          scene={scene}
          toads={toads}
          hasAutoFeeder={hasAutoFeeder}
          autoFeederActive={autoFeederActive}
        />
      )}

      {/* ВКЛАДКА «Данные сектора»: описание, улучшения и снос показанного гекса карты — по
          ней видно, что это за биопод и что с ним можно сделать. */}
      {tab === "room-data" && roomDataRoom && (
        <RoomDataTab
          room={roomDataRoom}
          stats={
            <DataGrid columns={3}>
              <DataCell
                dense
                label={
                  <>
                    <ToadIcon className="mr-1 h-3 w-3" />В биоподе
                  </>
                }
                value={`${toads.length}/${scene?.capacity ?? 0}`}
                color="text-white"
              />
              <DataCell
                dense
                label="🏠 Мест в колонии"
                value={`${housing.used}/${housing.capacity}`}
                color="text-white"
              />
              <DataCell
                dense
                label="🍽 Автокормушка"
                value={
                  hasAutoFeeder
                    ? autoFeederActive
                      ? "есть"
                      : "выключена"
                    : "нет"
                }
                color={autoFeederActive ? "text-lime-300" : "text-slate-300"}
              />
            </DataGrid>
          }
        />
      )}
    </Modal>
  );
};

export default ToadListModal;
