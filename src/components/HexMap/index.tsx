import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MenuIcons } from "../../assets/icons";
import { useColony } from "../../hooks/use-colony";
import { useGameState } from "../../hooks/use-game-state";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { Toad } from "../../models/Toad";
import { checkNestCourtship } from "../../utils/breeding-manager";
import { getSceneProductionRate } from "../../utils/production-manager";
import { getHousingInfo } from "../../utils/housing";
import { getToadHomeId } from "../../utils/toad-location";
import { getStorageCapacityInfo } from "../../utils/storage";
import { platform } from "../../platform";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import { BurgerMenu } from "../modals/BurgerMenuModal";
import BuildRoomModal from "../modals/BuildRoomModal";
import ColonyModal from "../modals/ColonyModal";
import { ToadInfo } from "../modals/ToadInfoModal";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon } from "../shared/CurrencyIcon";
import { canBuildOnSlot, getUnpoweredAviarySceneIds } from "./colony-build";
import HexMapCanvas from "./HexMapCanvas";
import { openRoomModal } from "./open-room-modal";
import { isRoomOpen, RoomConfig } from "./rooms-config";
import { canMoveToadToRoom, ToadMoveCheck } from "./toad-move-rules";
import { UPKEEP_PER_TOAD_HOUR } from "../../utils/gamification-config";

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

/**
 * Главный экран колонии: гексагональная карта вместо старой сцены с жабами и меню.
 *
 * Карта занимает весь экран — она и есть окно, а поверх неё лежит HUD:
 * панель колонии (название, день, биопод, выработка), кнопка меню, ресурсы и
 * переключатель биоподов. Отдельных шапки/подвала больше нет.
 *
 * Гексы — только цвет: иконок, подписей и кнопок внутри секторов нет, в центре гекса
 * живут сами жабы. Поэтому тап по гексу открывает действие сектора из каталога
 * (`rooms-config.ts` → `open-room-modal.tsx`):
 *  - ядро        → «Управление колонией»: сводка, все жабы и массовое кормление;
 *  - биопод      → список жаб и кормление;
 *  - репродуктор      → размножение;
 *  - коллайдер (с вкладкой инкубатора) / диссоциатор → лаборатория;
 *  - магазин, склад, Медотсек → их собственные модалки;
 *  - разведка    → походы: модалке передаётся гекс, а команду собирают из жаб этого сектора;
 *  - ⚡-сектор   → жабы-энергетики внутри;
 *  - свободный гекс → меню застройки (любой сектор — на любой гекс);
 *  - панель колонии в HUD → статистика биопода; кормление — из ядра.
 *
 * Управление картой: тап открывает сектор, в приближенном виде тап по жабе — её
 * карточка, удержание жабы — перенос в другой сектор, двойной тап — приближение.
 *
 * Модалки секторов берутся существующие; у ядра своё окно управления колонией,
 * потому что оно не принадлежит ни одному сектору.
 */
export default function HexMapScreen() {
  const { openModal } = useModal();
  const { addNotification } = useNotifications();
  const { account, allToads, ownedScenes, selectToad } = useToads();
  const { playCroak, playCroakBig, playCroakSmall, playBeep, playOk } =
    useSoundEffects();

  // Колония: построенные секторы, энергосеть и жабы по гексам
  const { rooms, powerGrid, toadsByRoom, placeToad, releaseToad } = useColony();

  /**
   * Жабы биоподов: те, кто не работает в секторах колонии (⚡, «Разведка», репродуктор,
   * Медотсек) — жаба в секторе места в биоподе не занимает и в производстве не считается
   * (`utils/toad-location.ts`).
   * Свой список у каждого гекса-биопода — его собирает `useColony` (`getRoomToadLists`),
   * потому что у каждого гекса «Биопод» свой биопод (`RoomConfig.sceneId`).
   */

  const aviaryToads = useMemo(() => {
    const aviariesIds = ownedScenes.map((s) => s.id);

    return allToads.filter((toad) =>
      aviariesIds.includes(Number(toad.scene_id)),
    );
  }, [allToads, ownedScenes]);

  /**
   * Территория колонии растёт фронтом застройки: у нового сектора открываются все её соседние
   * гексы (см. `getUnlockedRooms`), поэтому о расширении говорим по числу
   * новых гексов, а не по радиусу. Число открытых гексов — это длина списка секторов карты:
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

    // Новая постройка открыла соседей: её гекс, боковые слоты того же кольца и гексы наружу —
    // до пяти за сектор (меньше, если часть соседей уже открыта фронтом других секторов)
    const opened = unlockedCount - previous;

    addNotification({
      type: "success",
      content: `Территория колонии расширилась: под застройку открыто ${opened} ${pluralizeHexes(
        opened,
      )}.`,
      timeout: 6000,
    });
  }, [addNotification, unlockedCount]);

  /**
   * Обесточенные биоподы: их жильцы остаются в списке, но в выработку не идут.
   * Upkeep при этом не пропадает — жабы всё равно едят, поэтому HUD может показать минус.
   */
  const unpoweredAviarySceneIds = useMemo(
    () => getUnpoweredAviarySceneIds(rooms, powerGrid),
    [rooms, powerGrid],
  );

  // Ферма считает только жаб биопода: жабы в энергосекторах не фармят биомассу
  const sceneFarmRate =
    getSceneProductionRate(aviaryToads, unpoweredAviarySceneIds) -
    aviaryToads.length * UPKEEP_PER_TOAD_HOUR;

  // Энергия колонии для HUD: сколько построенных секторов реально под током
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

  // Вид карты: обзорный (тап по секторе) или приближенный (жабы кликаются по отдельности)
  const [zoomedIn, setZoomedIn] = useState(false);

  // Жильё жаб и полки склада: раньше это были «сцены» и склад жаб, теперь — гексы построек
  const housing = getHousingInfo();
  const storage = getStorageCapacityInfo(account?.storage);

  // Чипы ресурсов для HUD над картой (раньше жили в подвале экрана)
  const resources = useMemo(
    () => [
      {
        key: "tokens",
        icon: <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />,
        value: account?.tokens || 0,
        tone: "text-amber-200",
      },
      {
        key: "astro_quax",
        icon: <CurrencyIcon currency="astro_quax" className="h-3.5 w-3.5" />,
        value: account?.astro_quax || 0,
        tone: "text-purple-200",
      },
      {
        key: "biomass",
        icon: "🧪",
        value: Math.floor(account?.biomass || 0),
        tone: "text-lime-200",
      },
      {
        key: "food",
        icon: "🍎",
        value: account?.storage?.food ?? 0,
        tone: "text-pink-200",
      },

      {
        key: "toads",
        icon: "🐸",
        value: allToads.length,
        tone: "text-cyan-200",
      },
      {
        // Места в биоподах: склада жаб больше нет, места дают только биоподы
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
        // Энергия колонии: под током столько-то построенных секторов
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

  /** Тап по секторе — её действие из каталога; у свободного гекса действие одно: застройка. */
  const handleRoomTap = useCallback(
    (room: RoomConfig) => {
      if (!isRoomOpen(room)) {
        // Свободный гекс — стройплощадка: любой сектор можно поставить на любой гекс
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

      // Ядро — центр управления колонией: сводка, все жабы и кормление всей колонии
      // (модалка не привязана к гексу, поэтому открывается до общей таблицы действий).
      if (room.kind === "core") {
        openModal(() => <ColonyModal />, { className: "md:max-w-2xl" });
        return;
      }

      // Остальные секторы открывают свои модалки; ⚡, биопод, репродуктор и Медотсек
      // получают из `openRoomModal` именно тот гекс, по которому тапнули.
      openRoomModal(room, openModal);
    },
    [addNotification, openModal, rooms],
  );

  /**
   * Жабы, живущие в секторе прямо сейчас — нужно правилам переноса:
   * биопод — жильцы биопода, репродуктор — пара на ухаживание и беременные,
   * ⚡-сектор и «Разведка» — те, кого посадили в гекс.
   */
  const getRoomOccupants = useCallback(
    (room: RoomConfig): Toad[] => toadsByRoom[room.id] ?? [],
    [toadsByRoom],
  );

  /**
   * Перенос жабы (удержание + бросок на карте): можно ли посадить её в сектор.
   * Правила — в toad-move-rules, карта только спрашивает и подсвечивает гекс.
   *
   * Вместимость биопода считается у **того** гекса, куда жабу несут: у каждого биопода
   * своя (`RoomConfig.sceneId`), поэтому перенос в переполненный чужой биопод отклоняется.
   */
  const handleCanDropToad = useCallback(
    (toad: Toad, room: RoomConfig): ToadMoveCheck => {
      const aviaryScene =
        room.kind === "aviary" && room.sceneId != null
          ? (ownedScenes.find((scene) => scene.id === room.sceneId) ?? null)
          : null;

      return canMoveToadToRoom(toad, room, {
        roomToads: getRoomOccupants(room).filter((item) => item.id !== toad.id),
        aviaryCount: aviaryScene
          ? allToads.filter(
              (item) => item.scene_id === aviaryScene.id && item.id !== toad.id,
            ).length
          : 0,
        aviaryCapacity: aviaryScene?.capacity ?? 0,
        rooms,
        powerGrid,
      });
    },
    [allToads, getRoomOccupants, ownedScenes, powerGrid, rooms],
  );

  /** Жабу перенесли: биопод принимает жильца, ⚡-сектор — работника, «Разведка» — бойца. */
  const handleToadDrop = useCallback(
    (toad: Toad, room: RoomConfig) => {
      if (room.kind === "power") {
        placeToad(toad.id, room.id);
        playCroakSmall();
        addNotification({
          type: "success",
          content: `${toad.name ?? "Жаба"} теперь работает в энергосекторе ⚡`,
        });
        return;
      }

      // «Разведка» — сектор похода: в ней стоит команда, отсюда жабы уходят в походы
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
        // Биопод гекса: свой дом жаба сохраняет, чужой биопод становится её новым домом.
        // Место у жабы одно: из сектора она уходит, а биопод гекса принимает её жильцом.
        // Мест может не хватить — тогда жаба остаётся там, где была (перенос ещё до
        // броска проверяет `canMoveToadToRoom`, а здесь страховка от гонки).
        const movedToOtherAviary =
          room.sceneId != null && room.sceneId !== getToadHomeId(toad);
        const result = releaseToad(toad.id, room.sceneId ?? null);

        if (!result.ok) {
          playBeep();
          addNotification({
            type: "warn",
            content: `В биоподе «${
              result.scene?.name ?? "биопод"
            }» нет свободных мест — жаба осталась на месте.`,
          });
          return;
        }

        playCroakSmall();
        addNotification({
          type: "success",
          content: movedToOtherAviary
            ? `${toad.name ?? "Жаба"} переехала в ${result.scene.name} 🏠`
            : `${toad.name ?? "Жаба"} вернулась в биопод 🐸`,
          timeout: 4000,
        });
        return;
      }

      // Репродуктор вмещает пару: посадили самца и самку — ухаживание заводит игрок кнопкой
      if (room.kind === "breeding") {
        placeToad(toad.id, room.id);
        playCroakSmall();

        // Пара собралась — подсказываем про кнопку в модалке репродуктора. Пока пары нет
        // (посадили одну жабу), молчим: кого не хватает, скажет модалка репродуктора.
        if (checkNestCourtship(room.id).ready) {
          addNotification({
            type: "success",
            content:
              "Пара в репродукторе ♥ Откройте репродуктор и нажмите «Начать ухаживание»",
            timeout: 6000,
          });
        }
      }
    },
    [addNotification, placeToad, playBeep, playCroakSmall, playOk, releaseToad],
  );

  /** Перенести жабу не вышло: она уже летит назад — показываем причину. */
  const handleToadRejected = useCallback(
    (toad: Toad, room: RoomConfig, reason?: string) => {
      playBeep();
      addNotification({
        type: "warn",
        content:
          reason ??
          `${toad.name ?? "Жабу"} нельзя перенести в сектор «${
            room.name || room.title
          }».`,
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
          {/* Панель колонии — только сводка: у биоподов больше нет общего «текущего»,
              поэтому про сам биопод рассказывает его гекс (тап по биоподу → список жаб) */}
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
            onClick={() =>
              openModal(() => <BurgerMenu />, { className: "md:max-w-lg" })
            }
            className="pointer-events-auto rounded-xl border-2 border-purple-300/70 bg-slate-950/65 p-2 text-purple-200 backdrop-blur-md duration-300 active:scale-95"
          >
            {MenuIcons.menu}
          </ClickButton>
        </div>

        {/* Ресурсы колонии — плавающие чипы поверх карты; кормление живёт в ядре */}
        <div className="pointer-events-none flex w-16 flex-col gap-1.5">
          {resources.map((item) => (
            <div
              key={item.key}
              className={`flex items-center gap-1 rounded-lg border border-white/5 bg-slate-950/55 px-2 py-1 text-[11px] font-semibold backdrop-blur-md ${item.tone}`}
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center text-[12px] leading-none">
                {item.icon}
              </span>
              <span className="tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Подсказка по управлению картой — зависит от текущего вида */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[55%] text-[10px] leading-tight text-cyan-100/40">
        {zoomedIn
          ? "Приближенный вид: тап по жабе — её карточка, тап по гексу — сектор. Удержите жабу, чтобы перенести её в другой сектор."
          : "Обзорный вид: тап по секторе — её интерфейс, двойной тап — приблизиться к гексу, удержание жабы — перенос. Свободный гекс — застройка: любой сектор на любом гексе."}
      </div>
    </div>
  );
}
