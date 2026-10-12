import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MenuIcons } from "../../assets/icons";
import { useColony } from "../../hooks/use-colony";
import { useGameState } from "../../hooks/use-game-state";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { Toad } from "../../models/Toad";
import { CURRENCY_CONFIG } from "../../utils/constants";
import { checkNestCourtship } from "../../utils/breeding-manager";
import {
  getSceneProductionRate,
  getUpkeepRate,
} from "../../utils/production-manager";
import { getHousingInfo } from "../../utils/housing";
import { getStorageCapacityInfo } from "../../utils/storage";
import { platform } from "../../platform";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import { BurgerMenu } from "../modals/BurgerMenuModal";
import BuildRoomModal from "../modals/BuildRoomModal";
import RoomUpgradeModal from "../modals/RoomUpgradeModal";
import ExpeditionModal from "../modals/ExpeditionModal";
import DissolveModal from "../modals/Lab/DissolveModal";
import ToadCollider from "../modals/Lab/ToadColliderModal";
import ToadSlotModal from "../modals/Lab/ToadSlotModal";
import NestModal from "../modals/Lab/NestModal";
import PowerRoomModal from "../modals/PowerRoomModal";
import ShopMenu from "../modals/ShopMenu";
import StorageModal from "../modals/StorageModal";
import ToadListModal from "../modals/ToadListModal";
import { ToadInfo } from "../modals/ToadInfoModal";
import { useFeedToads } from "../ToadCanvas/use-feed-toads";
import { ClickButton } from "../shared/ClickButton";
import { canBuildOnSlot, isRoomPowered } from "./colony-build";
import HexMapCanvas from "./HexMapCanvas";
import { isRoomOpen, RoomActionId, RoomConfig } from "./rooms-config";
import { canMoveToadToRoom, ToadMoveCheck } from "./toad-move-rules";

/** Локальные часы колонии для HUD (показываются в шапке, обновляются раз в полминуты). */
const formatClock = (date: Date) =>
  date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** Склонение слова «гекс» для уведомления о расширении колонии (как «жабы» в коллайдере). */
const pluralizeHexes = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "гекс";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "гекса";
  }

  return "гексов";
};

/** Модалка, которую открывает действие комнаты, и фон для неё (лаборатория — свой). */
type RoomModalEntry = { render: () => ReactElement; bg?: string } | null;

/**
 * Действия комнат каталога → существующие модалки: карта только выбирает, какую показать.
 * Действия без модалки (тултип «о вольере», чип кормления) помечены null — их открывают
 * другие места интерфейса. Таблица намеренно полная (`Record<RoomActionId, …>`): добавил
 * новое действие в каталог — компилятор напомнит про модалку.
 */
const ROOM_MODAL_BY_ACTION: Record<RoomActionId, RoomModalEntry> = {
  // Ядро: улучшение жилой комнаты — модалка сама показывает список комнат и берёт апгрейды
  // из состояния колонии, поэтому ей ничего передавать не нужно.
  "room-upgrade": { render: () => <RoomUpgradeModal /> },
  // Вольер открывается сам: модалке нужен вольер гекса (`RoomConfig.sceneId`), а не общий
  // «текущий вольер» — см. обработчик клика. Здесь запасной путь без привязки к гексу.
  "toad-list": null,
  "scene-info": null,
  feed: null,
  // Гнёзд в колонии может быть несколько: гекс открывает модалку сам (см. обработчик клика),
  // здесь — запасной путь для базового гнезда `NEST_ROOM_ID`.
  nest: { render: () => <NestModal />, bg: "/bg/bg-lab.webp" },
  collider: { render: () => <ToadCollider />, bg: "/bg/bg-lab.webp" },
  incubator: { render: () => <ToadSlotModal />, bg: "/bg/bg-lab.webp" },
  dissociator: { render: () => <DissolveModal />, bg: "/bg/bg-lab.webp" },
  shop: { render: () => <ShopMenu /> },
  storage: { render: () => <StorageModal /> },
  scout: { render: () => <ExpeditionModal /> },
  hospital: { render: () => <ExpeditionModal initialTab="infirmary" /> },
  // ⚡-комната открывается отдельно: её модалке нужна сама комната
  "power-room": null,
};

/**
 * Главный экран колонии: гексагональная карта вместо старой сцены с жабами и меню.
 *
 * Карта занимает весь экран — она и есть окно, а поверх неё лежит HUD:
 * панель колонии (название, день, вольер, выработка), кнопка меню, ресурсы и
 * переключатель вольеров. Отдельных шапки/подвала больше нет.
 *
 * Гексы — только цвет: иконок, подписей и кнопок внутри комнат нет, в центре гекса
 * живут сами жабы. Поэтому тап по гексу открывает действие комнаты из каталога
 * (`rooms-config.ts` → `ROOM_MODAL_BY_ACTION`):
 *  - ядро        → улучшение комнаты (автокормушка для жилой комнаты);
 *  - вольер      → список жаб и кормление;
 *  - гнездо      → размножение;
 *  - коллайдер / инкубатор / диссоциатор → лаборатория;
 *  - магазин, склад, разведка, лазарет → их собственные модалки;
 *  - ⚡-комната   → жабы-энергетики внутри;
 *  - свободный гекс → меню застройки (любую комнату — на любой гекс);
 *  - панель колонии в HUD → статистика вольера, чип 🍎 — покормить всех.
 *
 * Управление картой: тап открывает комнату, в приближенном виде тап по жабе — её
 * карточка, удержание жабы — перенос в другую комнату, двойной тап — приближение.
 *
 * Модалки берутся существующие — новый UI-слой не создаётся.
 */
export default function HexMapScreen() {
  const { openModal } = useModal();
  const { addNotification } = useNotifications();
  const { account, allToads, ownedScenes, selectToad } = useToads();
  const { playCroak, playCroakBig, playCroakSmall, playBeep, playOk } =
    useSoundEffects();
  const {
    showFoodTooltip,
    handleCancelFeed,
    handleConfirmFeed,
    handleShowFoodTooltip,
    getTooltipMessage,
    isFoodActive,
  } = useFeedToads();

  // Колония: построенные комнаты, энергосеть и жабы по гексам
  const { rooms, powerGrid, toadsByRoom, placeToad, releaseToad } = useColony();

  /**
   * Жабы вольеров: те, кто не работает в комнатах колонии (⚡, «Разведка», гнездо).
   * Свой список у каждого гекса-вольера — его собирает `useColony` (`getRoomToadLists`),
   * потому что у каждого гекса «Вольер» свой вольер (`RoomConfig.sceneId`).
   */
  const aviaryToads = useMemo(
    () => allToads.filter((toad) => !toad.roomId),
    [allToads],
  );

  /**
   * Территория колонии растёт фронтом застройки: у новой комнаты открываются все её соседние
   * гексы (см. `getUnlockedRooms`), поэтому о расширении говорим по числу
   * новых гексов, а не по радиусу. Число открытых гексов — это длина списка комнат карты:
   * в нём только открытые слоты и постройки.
   */
  const unlockedCount = rooms.length;
  const prevUnlockedRef = useRef(unlockedCount);

  useEffect(() => {
    const previous = prevUnlockedRef.current;

    prevUnlockedRef.current = unlockedCount;

    // Первый проход (загрузка сейва) и снос расширением не считаются
    if (unlockedCount <= previous) {
      return;
    }

    // Новая постройка открыла соседей — 3 гекса за комнату (меньше, если фронты пересеклись)
    const opened = unlockedCount - previous;

    addNotification({
      type: "success",
      content: `Территория колонии расширилась: под застройку открыто ${opened} ${pluralizeHexes(
        opened,
      )}.`,
      timeout: 6000,
    });
  }, [addNotification, unlockedCount]);

  // Ферма считает только жаб вольера: жабы в энергокомнатах не фармят биомассу
  const sceneFarmRate =
    getSceneProductionRate(aviaryToads) - getUpkeepRate(aviaryToads);

  // Энергия колонии для HUD: сколько построенных комнат реально под током
  const poweredRooms = useMemo(
    () => Object.values(powerGrid.powered).filter(Boolean).length,
    [powerGrid],
  );
  const builtRooms = Object.keys(powerGrid.powered).length;
  // День колонии: считается от даты создания аккаунта (как «День 13» в макете).
  const gameState = useGameState();
  const colonyDay = useMemo(() => {
    const startedAt = new Date(gameState.createdAt || Date.now()).getTime();

    if (Number.isNaN(startedAt)) {
      return 1;
    }

    return Math.max(1, Math.floor((Date.now() - startedAt) / 86_400_000) + 1);
  }, [gameState.createdAt]);

  // Часы колонии в шапке HUD
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 30_000);

    return () => clearInterval(id);
  }, []);

  // Вид карты: обзорный (тап по комнате) или приближенный (жабы кликаются по отдельности)
  const [zoomedIn, setZoomedIn] = useState(false);

  // Жильё жаб и полки склада: раньше это были «сцены» и склад жаб, теперь — гексы построек
  const housing = getHousingInfo();
  const storage = getStorageCapacityInfo(account?.storage);

  // Чипы ресурсов для HUD над картой (раньше жили в подвале экрана)
  const resources = useMemo(
    () => [
      {
        key: "food",
        icon: "🍎",
        value: account?.storage?.food ?? 0,
        tone: "text-pink-200",
      },
      {
        key: "biomass",
        icon: "🧪",
        value: Math.floor(account?.biomass || 0),
        tone: "text-lime-200",
      },
      {
        key: "tokens",
        icon: CURRENCY_CONFIG.tokens.icon,
        value: account?.tokens || 0,
        tone: "text-amber-200",
      },
      {
        key: "astro_quax",
        icon: CURRENCY_CONFIG.astro_quax.icon,
        value: account?.astro_quax || 0,
        tone: "text-purple-200",
      },
      {
        key: "toads",
        icon: "🐸",
        value: allToads.length,
        tone: "text-cyan-200",
      },
      {
        // Места в вольерах: склада жаб больше нет, места дают только вольеры
        key: "housing",
        icon: "🏠",
        value: `${housing.used}/${housing.capacity}`,
        tone: housing.free > 0 ? "text-cyan-200" : "text-rose-300",
      },
      {
        // Склад предметов: полки дают постройки «Склад»
        key: "storage",
        icon: "📦",
        value: `${storage.used}/${storage.capacity}`,
        tone: storage.free > 0 ? "text-blue-200" : "text-rose-300",
      },
      {
        // Энергия колонии: под током столько-то построенных комнат
        key: "power",
        icon: "⚡",
        value: `${poweredRooms}/${builtRooms}`,
        tone: poweredRooms === builtRooms ? "text-amber-200" : "text-rose-300",
      },
    ],
    [
      account?.storage?.food,
      account?.biomass,
      account?.tokens,
      account?.astro_quax,
      allToads.length,
      housing.used,
      housing.capacity,
      housing.free,
      storage.used,
      storage.capacity,
      storage.free,
      poweredRooms,
      builtRooms,
    ],
  );

  /** Тап по жабе (только в приближенном виде): крик по размеру + карточка жабы. */
  const handleToadTap = useCallback(
    (toad: Toad) => {
      if (toad.stage === "toadpole") {
        playBeep();
      } else if (toad.genes.weight < 15) {
        playCroakSmall();
      } else if (toad.genes.weight > 20) {
        playCroakBig();
      } else {
        playCroak();
      }

      selectToad(toad.id);
      openModal(() => <ToadInfo />);
    },
    [openModal, playBeep, playCroak, playCroakBig, playCroakSmall, selectToad],
  );

  /** Тап по комнате — её действие из каталога; у свободного гекса действие одно: застройка. */
  const handleRoomTap = useCallback(
    (room: RoomConfig) => {
      if (!isRoomOpen(room)) {
        // Свободный гекс — стройплощадка: любую комнату можно поставить на любой гекс
        if (!canBuildOnSlot(room, rooms)) {
          addNotification({
            type: "info",
            content:
              "Этот гекс застроить нельзя: сначала освободите или выберите другой.",
            timeout: 5000,
          });
          return;
        }

        openModal(() => <BuildRoomModal slot={room} />);
        return;
      }

      // ⚡-комната: жабы внутри и их кормление — модалке нужна сама комната
      if (room.kind === "power") {
        openModal(() => <PowerRoomModal room={room} />);
        return;
      }

      // Гнездо: гнёзд в колонии может быть несколько — модалка знает, какой гекс открыли
      if (room.kind === "breeding") {
        openModal(() => <NestModal roomId={room.id} />, { bg: "/bg/bg-lab.webp" });
        return;
      }

      // Вольер: список жаб именно этого гекса — вольер его сцены, а не общий «текущий»
      if (room.kind === "aviary") {
        const sceneId = room.sceneId;

        if (sceneId === undefined) {
          return;
        }

        openModal(() => <ToadListModal sceneId={sceneId} />);
        return;
      }

      const actionId = room.actions[0]?.id;
      const modal = actionId ? ROOM_MODAL_BY_ACTION[actionId] : null;

      if (!modal) {
        return;
      }

      openModal(modal.render, modal.bg ? { bg: modal.bg } : undefined);
    },
    [addNotification, openModal, rooms],
  );

  /**
   * Жабы, живущие в комнате прямо сейчас — нужно правилам переноса:
   * вольер — жильцы вольера, гнездо — пара на ухаживание и беременные,
   * ⚡-комната и «Разведка» — те, кого посадили в гекс.
   */
  const getRoomOccupants = useCallback(
    (room: RoomConfig): Toad[] => toadsByRoom[room.id] ?? [],
    [toadsByRoom],
  );

  /**
   * Перенос жабы (удержание + бросок на карте): можно ли посадить её в комнату.
   * Правила — в toad-move-rules, карта только спрашивает и подсвечивает гекс.
   *
   * Вместимость вольера считается у **того** гекса, куда жабу несут: у каждого вольера
   * своя (`RoomConfig.sceneId`), поэтому перенос в переполненный чужой вольер отклоняется.
   */
  const handleCanDropToad = useCallback(
    (toad: Toad, room: RoomConfig): ToadMoveCheck => {
      const aviaryScene =
        room.kind === "aviary" && room.sceneId !== undefined
          ? ownedScenes.find((scene) => scene.id === room.sceneId) ?? null
          : null;

      return canMoveToadToRoom(toad, room, {
        roomToads: getRoomOccupants(room).filter((item) => item.id !== toad.id),
        aviaryCount: aviaryScene
          ? allToads.filter(
              (item) =>
                item.scene_id === aviaryScene.id && item.id !== toad.id
            ).length
          : 0,
        aviaryCapacity: aviaryScene?.capacity ?? 0,
        rooms,
        powerGrid,
      });
    },
    [allToads, getRoomOccupants, ownedScenes, powerGrid, rooms]
  );

  /** Жабу перенесли: вольер принимает жильца, ⚡-комната — работника, «Разведка» — бойца. */
  const handleToadDrop = useCallback(
    (toad: Toad, room: RoomConfig) => {
      if (room.kind === "power") {
        placeToad(toad.id, room.id);
        playCroakSmall();
        addNotification({
          type: "success",
          content: `${toad.name ?? "Жаба"} теперь работает в энергокомнате ⚡`,
        });
        return;
      }

      // «Разведка» — комната похода: в ней стоит команда, отсюда жабы уходят в походы
      if (room.kind === "scout") {
        placeToad(toad.id, room.id);
        playCroakSmall();
        addNotification({
          type: "success",
          content: `${toad.name ?? "Жаба"} встала в команду в «Разведке» 🧭`,
        });
        return;
      }

      if (room.kind === "aviary") {
        // Вольер гекса: свой дом жаба сохраняет, чужой вольер становится её новым домом.
        // `roomId` сбрасывается — жаба идёт в вольер, и ферма снова её считает.
        const movedToOtherAviary =
          room.sceneId !== undefined && room.sceneId !== toad.scene_id;
        const aviaryScene = ownedScenes.find((s) => s.id === room.sceneId);

        releaseToad(toad.id, room.sceneId ?? null);
        playCroakSmall();
        addNotification({
          type: "success",
          content: movedToOtherAviary
            ? `${toad.name ?? "Жаба"} переехала в ${aviaryScene?.name ?? "другой вольер"} 🏠`
            : `${toad.name ?? "Жаба"} вернулась в вольер 🐸`,
          timeout: 4000,
        });
        return;
      }

      // Гнездо вмещает пару: посадили самца и самку — ухаживание заводит игрок кнопкой
      if (room.kind === "breeding") {
        placeToad(toad.id, room.id);
        playCroakSmall();

        // Пара собралась — подсказываем про кнопку в модалке гнезда. Пока пары нет
        // (посадили одну жабу), молчим: кого не хватает, скажет модалка гнезда.
        if (checkNestCourtship(room.id).ready) {
          addNotification({
            type: "success",
            content:
              "Пара в гнезде ♥ Откройте гнездо и нажмите «Начать ухаживание»",
            timeout: 6000,
          });
        }
      }
    },
    [
      addNotification,
      ownedScenes,
      placeToad,
      playCroakSmall,
      playOk,
      releaseToad,
    ],
  );

  /** Перенести жабу не вышло: она уже летит назад — показываем причину. */
  const handleToadRejected = useCallback(
    (toad: Toad, room: RoomConfig, reason?: string) => {
      playBeep();
      addNotification({
        type: "warn",
        content:
          reason ??
          `${toad.name ?? "Жабу"} нельзя перенести в комнату «${room.title}».`,
        timeout: 4500,
      });
    },
    [addNotification, playBeep],
  );

  /** Жабу взяли в руку: крик по размеру и отклик удержания (в Telegram — вибрация). */
  const handleToadPickup = useCallback(
    (toad: Toad) => {
      if (toad.stage === "toadpole") {
        playBeep();
      } else {
        playCroakSmall();
      }

      // Отклик удержания: в Telegram это вибрация, в вебе — тихий no-op (см. src/platform)
      platform.haptic("light");
    },
    [playBeep, playCroakSmall],
  );

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#070c14] text-white">
      {/* Карта занимает весь экран — она и есть окно, HUD лежит поверх неё */}
      <div className="absolute inset-0">
        <HexMapCanvas
          rooms={rooms}
          poweredRooms={powerGrid.powered}
          toadsByRoom={toadsByRoom}
          feedRoomId={isFoodActive ? "aviary" : null}
          onRoomTap={handleRoomTap}
          onToadTap={handleToadTap}
          canDropToad={handleCanDropToad}
          onToadDrop={handleToadDrop}
          onToadRejected={handleToadRejected}
          onToadPickup={handleToadPickup}
          onZoomedChange={setZoomedIn}
        />
      </div>

      {/* HUD: панель колонии, меню и ресурсы поверх карты */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Панель колонии — только сводка: у вольеров больше нет общего «текущего»,
              поэтому про сам вольер рассказывает его гекс (тап по вольеру → список жаб) */}
          <div className="pointer-events-auto min-w-0 rounded-2xl border border-cyan-400/25 bg-slate-950/65 px-3 py-2 text-left shadow-lg backdrop-blur-md">
            <span className="backgroundDark block text-xl leading-none">
              Stellar Croak
            </span>
            <span className="mt-1 block text-[10px] leading-tight text-cyan-200/80">
              День {colonyDay} · {clock} · Колония
            </span>
            <span className="block text-[10px] leading-tight text-cyan-200/60">
              {allToads.length} жаб ·{" "}
              <span
                className={
                  sceneFarmRate >= 0 ? "text-lime-300/90" : "text-rose-300/90"
                }
              >
                {sceneFarmRate > 0 ? "+" : ""}
                {sceneFarmRate.toFixed(1)} 🧪/ч
              </span>
            </span>
          </div>

          <ClickButton
            title="Меню колонии"
            // Меню — столбик кнопок, ему широкая карточка десктопа (md:max-w-5xl в
            // ModalProvider) ни к чему: просим узкую, как телефонную.
            onClick={() =>
              openModal(() => <BurgerMenu />, { className: "md:max-w-lg" })
            }
            className="pointer-events-auto rounded-xl border-2 border-purple-300/70 bg-slate-950/65 p-2 text-purple-200 backdrop-blur-md duration-300 active:scale-95"
          >
            {MenuIcons.menu}
          </ClickButton>
        </div>

        {/* Ресурсы колонии — плавающие чипы поверх карты. Чип 🍎 кормит всех жаб */}
        <div className="pointer-events-none flex flex-wrap items-center gap-1.5">
          {resources.map((item) => {
            const chipClass = `flex items-center gap-1 rounded-lg border border-white/5 bg-slate-950/55 px-2 py-1 text-[11px] font-semibold backdrop-blur-md ${item.tone}`;
            const content = (
              <>
                <span className="text-[12px] leading-none">{item.icon}</span>
                <span className="tabular-nums">{item.value}</span>
              </>
            );

            if (item.key !== "food") {
              return (
                <div key={item.key} className={chipClass}>
                  {content}
                </div>
              );
            }

            // Кормление всех жаб: раньше это была иконка 🍎 внутри гекса-вольера
            return (
              <ClickButton
                key={item.key}
                title="Покормить всех жаб"
                onClick={handleShowFoodTooltip}
                className={`pointer-events-auto duration-200 active:scale-95 ${chipClass}`}
              >
                {content}
              </ClickButton>
            );
          })}
        </div>
      </header>

      {/* Подсказка по управлению картой — зависит от текущего вида */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[55%] text-[10px] leading-tight text-cyan-100/40">
        {zoomedIn
          ? "Приближенный вид: тап по жабе — её карточка, тап по гексу — комната. Удержите жабу, чтобы перенести её в другую комнату."
          : "Обзорный вид: тап по комнате — её интерфейс, двойной тап — приблизиться к гексу, удержание жабы — перенос. Свободный гекс — застройка: любая комната на любом гексе."}
      </div>

      {/* Кормление: та же механика, что была на старой сцене */}
      {showFoodTooltip && (
        <div className="fixed left-1/2 top-1/4 z-50 w-[250px] -translate-x-1/2">
          <div className="bg-color-main rounded-lg border border-gray-600 p-3 shadow-lg backdrop-blur-sm">
            <div className="mb-2 text-center text-sm text-white">
              {getTooltipMessage().message}
            </div>
            <div className="flex gap-2">
              <ClickButton
                onClick={handleCancelFeed}
                className="flex-1 rounded bg-gray-600 px-3 py-2 text-sm text-white duration-200 hover:bg-gray-500"
              >
                Отмена
              </ClickButton>
              <ClickButton
                onClick={handleConfirmFeed}
                disabled={getTooltipMessage().disabled || isFoodActive}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-yellow-600 px-3 py-2 text-sm text-white duration-200 hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <img src="/assets/food.webp" width={30} alt="food" />
                Покормить
              </ClickButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
