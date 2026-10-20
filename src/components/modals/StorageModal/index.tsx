import { useState } from "react";
import { useColony } from "../../../hooks/use-colony";
import { useRoomPowerTab } from "../../../hooks/use-room-power-tab";
import Modal from "../../shared/Header";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
import { useToads } from "../../ToadContext";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { createToad, updateUser } from "../../../backend";
import { useNotifications } from "../../../hooks/use-notification";
import { randomizeToadCharacteristics } from "../../../utils/randomize-toad-characteristics";
import { getGameState } from "../../../backend/localStorage";
import {
  loadColliderState,
  saveColliderState,
} from "../../../backend/collider-manager";
import {
  generateLootboxToad,
  LootboxRarity,
} from "../../../models/Toad/lootbox";
import { itemsFull, Items } from "../../../models/user";
import { completeAchivementCounter } from "../../../backend/achivements-manager";
import {
  getStorageCapacityInfo,
  STORAGE_CAPACITY_PER_ROOM,
} from "../../../utils/storage";
import { getSceneFreeSlots } from "../../../utils/housing";
import { dissolveNewToad } from "../../../utils/dissolve-manager";
import { useDissociator } from "../../../hooks/use-dissociator";
import { Toad } from "../../../models/Toad";
import { LootboxReveal } from "./LootboxReveal";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "../RoomDataTab";
import { RoomConfig } from "../../HexMap/rooms-config";

/**
 * Склад — только предметы. Жаб здесь больше нет: каждая жаба живёт в биоподе
 * (`scene_id`), поэтому лутбокс сначала показывает окно с новой жабой
 * (`LootboxReveal`), а игрок сам выбирает биопод или распыляет её на биомассу.
 * Если свободных биоподов нет — лутбокс остаётся лежать, а игра предлагает
 * построить новый биопод.
 *
 * Вместимость полок растёт постройками «Склад» на карте колонии: каждая постройка
 * даёт `STORAGE_CAPACITY_PER_ROOM` единиц (см. `utils/storage.ts`).
 *
 * Тело модалки — табы (`shared/ModalTabs`): полки предметов и, если модалку открыл гекс
 * склада (`room`), «Данные сектора» — тот же таб, что и у остальных секторов карты.
 */

/** Табы склада: полки предметов и данные сектора-гекса */
type StorageTab = "items" | RoomDataTabId;

/** Новая жаба из лутбокса ещё не создана: ждёт выбора биопода или разбора */
interface LootboxRevealState {
  toad: Toad;
  rarity: LootboxRarity;
  defaultSceneId: number;
}

// Типы предметов на складе
interface StorageItem {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  description: string;
  type: "food" | "material" | "tool";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  key: string;
  onClick?: () => void;
}

const StorageModal: React.FC<{ room?: RoomConfig }> = ({ room }) => {
  const { addNotification } = useNotifications();
  const { account } = useToads();
  const { playOk, playError, playSuccess, playLegendary, playBubblesLong } =
    useSoundEffects();
  const { ready: dissociatorReady } = useDissociator();
  const [lootboxReveal, setLootboxReveal] = useState<LootboxRevealState | null>(
    null,
  );
  const { powerGrid } = useColony();
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<StorageTab>({ room, powerGrid, defaultTab: "items" });

  const capacity = getStorageCapacityInfo(account?.storage);

  /** Табы модалки: полки и, если модалку открыл гекс склада, «Данные сектора» */
  const storageTabs: ModalTabItem<StorageTab>[] = [
    {
      id: "items",
      label: "📦 Полки",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    ...(room ? [{ ...ROOM_DATA_TAB }] : []),
  ];

  const handleOpenLootbox = () => {
    const current = getGameState().user;

    if (!current.storage.lootbox || lootboxReveal) {
      return;
    }

    // Новой жабе нужно место: без свободного биопода лутбокс не открываем
    const freeScenes = getGameState().scenes.filter(
      (scene) => getSceneFreeSlots(scene) > 0,
    );

    if (freeScenes.length === 0) {
      playError();
      addNotification({
        type: "danger",
        content:
          "Все биоподы заняты — постройте новый биопод на карте колонии, чтобы открыть лутбокс.",
      });
      return;
    }

    completeAchivementCounter("lootbox", 1);
    const { baseToad, rarity } = generateLootboxToad();
    const randomToad = randomizeToadCharacteristics(baseToad) as Toad;

    if ([LootboxRarity.epic, LootboxRarity.legendary].includes(rarity)) {
      playLegendary();
    } else {
      playOk();
    }

    updateUser({
      storage: { ...current.storage, lootbox: current.storage.lootbox - 1 },
    });

    // Жабу создаём только после выбора биопода — до этого она «в окне» лутбокса
    setLootboxReveal({
      toad: randomToad,
      rarity,
      defaultSceneId: freeScenes[0].id,
    });
  };

  const handlePlaceLootboxToad = (sceneId: number) => {
    if (!lootboxReveal) {
      return;
    }

    // Пока окно открыто, биопод мог заполниться: проверяем место ещё раз
    const scene = getGameState().scenes.find((item) => item.id === sceneId);

    if (!scene || getSceneFreeSlots(scene) <= 0) {
      playError();
      addNotification({
        type: "danger",
        content: "Выбранный биопод уже заполнен — выберите другой.",
      });
      return;
    }

    createToad({
      ...lootboxReveal.toad,
      scene_id: scene.id,
      homeId: scene.id,
    });

    setLootboxReveal(null);
  };

  const handleDissolveLootboxToad = () => {
    if (!lootboxReveal) {
      return;
    }

    if (!dissociatorReady) {
      playError();
      addNotification({
        type: "danger",
        content:
          "Чтобы распылить жабу на биомассу, нужен построенный и запитанный диссоциатор.",
      });
      return;
    }

    playBubblesLong();
    const biomassGained = dissolveNewToad(lootboxReveal.toad);

    playSuccess();
    addNotification({
      type: "success",
      content: `Жаба ${
        lootboxReveal.toad.name || "без имени"
      } распылена на биомассу: +${biomassGained} 🧪.`,
    });
    setLootboxReveal(null);
  };

  const handleClickBattery = () => {
    const current = getGameState().user;

    if (!current.storage.battery) {
      return;
    }

    const collider = loadColliderState();
    const activeSlot = collider.slots.find((s) => s.child);

    if (!activeSlot) {
      addNotification({
        type: "danger",
        content: `В инкубаторе пусто`,
      });
      return;
    }

    if (
      activeSlot.isReady ||
      (activeSlot.startTime &&
        activeSlot.startTime + activeSlot.duration < Date.now())
    ) {
      addNotification({
        type: "warn",
        content: `Инкубация уже завершена!`,
      });
      return;
    }

    // −10 минут: сдвигаем старт инкубации назад, приближая готовность
    activeSlot.startTime =
      (activeSlot.startTime ?? Date.now()) - 10 * 60 * 1000;
    saveColliderState(collider);
    window.dispatchEvent(new Event("colliderChanged"));

    addNotification({
      type: "success",
      content: `Инкубация ускорена`,
    });

    updateUser({
      storage: { ...current.storage, battery: current.storage.battery - 1 },
    });
  };

  const _storageItems: Record<string, StorageItem> = {
    food: {
      id: "1",
      name: "Жабий корм",
      icon: "/assets/food.webp",
      quantity: account?.storage?.food || 0,
      description: "Основной корм для жаб",
      type: "food",
      rarity: "common",
      key: "food",
    },
    lootbox: {
      id: "2",
      name: "Лутбокс",
      icon: "/assets/lootbox.webp",
      quantity: account?.storage?.lootbox || 0,
      description: "Новая жаба: поселить в биопод или распылить на биомассу",
      type: "tool",
      rarity: "rare",
      key: "lootbox",
      onClick: handleOpenLootbox,
    },
    battery: {
      id: "3",
      name: "Батарейка",
      icon: "/assets/battery.webp",
      quantity: account?.storage?.battery || 0,
      description: "Ускоряет созревание жабы в инкубаторе на 10 минут",
      type: "tool",
      rarity: "common",
      key: "battery",
      onClick: handleClickBattery,
    },
    sparkleFlys: {
      id: "4",
      name: "Сияющие мушки",
      icon: "/assets/flies.webp",
      quantity: account?.storage?.sparkleFlys || 0,
      description: "Ускоряют беременность жабы",
      type: "material",
      rarity: "rare",
      key: "sparkleFlys",
    },
    worms: {
      id: "5",
      name: "Белковые черви",
      icon: "/assets/worms.webp",
      quantity: account?.storage?.worms || 0,
      description: "Ускоряет рост головастика",
      type: "material",
      rarity: "uncommon",
      key: "worms",
    },
    contourPass: {
      id: "6",
      name: "Пропуск КОНТУРа",
      icon: "/assets/contour-pass.svg",
      quantity: account?.storage?.[Items.contourPass] || 0,
      description:
        "Открывает следующий сектор Периметра. Цифровой пропуск: полки не занимает",
      type: "tool",
      rarity: "rare",
      key: "contourPass",
    },
  };

  const storageItems = Object.values(itemsFull)
    .map((item) => {
      const meta = _storageItems[item.key];

      return {
        ...item,
        ...meta,
        id: meta?.id ?? item.key,
        name: meta?.name ?? item.name,
        description: meta?.description ?? item.description,
        type: meta?.type ?? "material",
        rarity: (meta?.rarity ?? "uncommon") as StorageItem["rarity"],
        quantity: account?.storage?.[item.key] || 0,
      };
    })
    .filter((item) => item.quantity);

  // Функция для получения цвета редкости предмета
  const getItemRarityColor = (rarity: StorageItem["rarity"]): string => {
    const colors = {
      common: "text-slate-300",
      uncommon: "text-green-400",
      rare: "text-blue-400",
      epic: "text-purple-400",
      legendary: "text-yellow-400",
    };
    return colors[rarity];
  };

  // Функция для получения цвета фона редкости
  const getItemRarityBg = (rarity: StorageItem["rarity"]): string => {
    const colors = {
      common: "bg-slate-900/50",
      uncommon: "bg-green-900/50",
      rare: "bg-blue-900/50",
      epic: "bg-purple-900/50",
      legendary: "bg-yellow-900/50",
    };
    return colors[rarity];
  };

  const filledPercent = Math.min(
    100,
    Math.round((capacity.used / capacity.capacity) * 100),
  );

  const icon = (
    <svg
      className="w-6 h-6 text-cyan-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );

  return (
    <Modal icon={icon} title={room?.name ?? "Склад"}>
      {/* Табы: полки и «Данные сектора» (у склада из бургер-меню гекса нет —
          тогда таб один, и рисовать полоску табов нечего) */}
      {storageTabs.length > 1 && (
        <ModalTabs tabs={storageTabs} active={tab} onChange={setTab} />
      )}

      {tab === "items" && (
        <>
          {/* Полки: сколько места занято и откуда берётся вместимость */}
          <div className="mb-3 rounded-xl border border-cyan-400/25 bg-cyan-950/15 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-cyan-200">📦 Полки</span>
              <span className="tabular-nums text-slate-200">
                {capacity.used} / {capacity.capacity}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  filledPercent >= 100
                    ? "bg-rose-500"
                    : filledPercent > 75
                      ? "bg-amber-500"
                      : "brand-bar"
                }`}
                style={{ width: `${filledPercent}%` }}
              />
            </div>
            <p className="mt-2 text-2xs leading-snug text-slate-300">
              Складов в колонии: {capacity.rooms} — каждый даёт +
              {STORAGE_CAPACITY_PER_ROOM} к вместимости. Новый склад — гекс «📦
              Склад» на карте.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h3 className="text-white px-2 font-semibold">Инвентарь</h3>
              <div className="text-slate-300 text-sm">
                Свободно: {capacity.free}
              </div>
            </div>

            {storageItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-slate-300 text-4xl mb-3">📦</div>
                <p className="text-slate-200 text-sm">Полки пусты</p>
                <p className="text-slate-400 text-xs mt-1">
                  Корм, батарейки и пигменты появятся здесь после покупок и
                  походов
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {storageItems.map((item) => (
                  <div
                    key={item.id}
                    className={`relative rounded-xl p-3 border transition-all cursor-pointer group ${getItemRarityBg(
                      item.rarity,
                    )} border-slate-600/50 hover:border-cyan-400/50`}
                    onClick={item.onClick}
                  >
                    {/* Количество */}
                    <div className="absolute top-0 right-0 bg-cyan-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {item.quantity}
                    </div>

                    {/* Иконка предмета */}
                    <img
                      className="max-w-16 max-h-16 mb-2 mx-auto"
                      src={item.icon}
                    />

                    {/* Название и описание */}
                    <div className="text-center">
                      <div
                        className={`text-sm font-medium mb-1 ${getItemRarityColor(
                          item.rarity,
                        )}`}
                      >
                        {item.name}
                      </div>
                      <div className="text-slate-300 text-xs leading-tight">
                        {item.description}
                      </div>
                    </div>

                    {/* Бэйджик типа */}
                    <div className="absolute top-1 left-1">
                      <div
                        className={`text-2xs px-2 py-1 rounded-full ${
                          item.type === "food"
                            ? "bg-green-900/50 text-green-400"
                            : item.type === "material"
                              ? "bg-yellow-900/50 text-yellow-400"
                              : "bg-blue-900/50 text-blue-400"
                        }`}
                      >
                        {item.type === "food"
                          ? "Корм"
                          : item.type === "material"
                            ? "Материал"
                            : "Инструмент"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* «Данные сектора»: у склада-гекса тот же таб, что и у остальных секторов карты */}
      {tab === "room-data" && room && <RoomDataTab room={room} />}

      {/* Новая жаба: выбор биопода или разбор. Окно поверх «Склада» */}
      {lootboxReveal && (
        <LootboxReveal
          toad={lootboxReveal.toad}
          rarity={lootboxReveal.rarity}
          scenes={getGameState().scenes.filter(
            (scene) => getSceneFreeSlots(scene) > 0,
          )}
          defaultSceneId={lootboxReveal.defaultSceneId}
          dissociatorReady={dissociatorReady}
          onPlace={handlePlaceLootboxToad}
          onDissolve={handleDissolveLootboxToad}
        />
      )}
    </Modal>
  );
};

export default StorageModal;
