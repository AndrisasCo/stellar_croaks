import { useState } from "react";
import Modal from "../../shared/Header";
import { useToads } from "../../ToadContext";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { createToad, updateUser } from "../../../backend";
import { useNotifications } from "../../../hooks/use-notification";
import { randomizeToadCharacteristics } from "../../../utils/randomize-toad-characteristics";
import { ToadTypes } from "../../../models/Toad/toad-species";
import { getGameState } from "../../../backend/localStorage";
import {
  loadColliderState,
  saveColliderState,
} from "../../../backend/collider-manager";
import {
  generateLootboxToad,
  LootboxRarity,
} from "../../../models/Toad/lootbox";
import { ConfettiAnimation } from "./animations";
import { itemsFull, Items } from "../../../models/user";
import {
  completeAchivementCounter,
  getAchievementState,
} from "../../../backend/achivements-manager";
import {
  getStorageCapacityInfo,
  STORAGE_CAPACITY_PER_ROOM,
} from "../../../utils/storage";
import { pickSceneForNewToad } from "../../../utils/housing";

/**
 * Склад — только предметы. Жаб здесь больше нет: каждая жаба живёт в биоподе
 * (`scene_id`), поэтому лутбокс открывается сразу в свободный биопод, а если места
 * нет — лутбокс остаётся лежать, и игра предлагает построить биопод.
 *
 * Вместимость полок растёт постройками «Склад» на карте колонии: каждая постройка
 * даёт `STORAGE_CAPACITY_PER_ROOM` единиц (см. `utils/storage.ts`).
 */

/** Сколько крафтовой пыли даёт дубликат жабы (Часть 3.7) */
const getDuplicateDust = (rarity: LootboxRarity): number => {
  switch (rarity) {
    case LootboxRarity.rare:
      return 10;
    case LootboxRarity.uncommon:
      return 5;
    default:
      return 3;
  }
};

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

const StorageModal: React.FC = () => {
  const { addNotification } = useNotifications();
  const { account } = useToads();
  const { playClick, playOk, playLegendary } = useSoundEffects();
  const [showConfetti, setShowConfetti] = useState(0);

  const capacity = getStorageCapacityInfo(account?.storage);

  const handleOpenLootbox = () => {
    const current = getGameState().user;

    if (!current.storage.lootbox) {
      return;
    }

    // Лутбокс открывается в живой биопод: склада жаб больше нет
    const scene = pickSceneForNewToad();

    if (!scene) {
      addNotification({
        type: "warn",
        content: "В био-подах нет мест или недостаточно питания.",
      });
      return;
    }

    setShowConfetti(showConfetti + 1);
    completeAchivementCounter("lootbox", 1);
    const { baseToad, rarity } = generateLootboxToad();
    const randomToad = randomizeToadCharacteristics(baseToad);
    let toadLabel = "";

    if ([LootboxRarity.epic, LootboxRarity.legendary].includes(rarity)) {
      toadLabel =
        rarity === LootboxRarity.epic ? "☄️ Эпическая" : "🐲 Легендарная ";
      playLegendary();
    } else {
      playOk();
      toadLabel = rarity === LootboxRarity.rare ? "✨ Редкая" : "Обычная";
    }

    const isHighRarity = [LootboxRarity.epic, LootboxRarity.legendary].includes(
      rarity,
    );

    updateUser({
      storage: { ...current.storage, lootbox: current.storage.lootbox - 1 },
    });

    // Часть 3.7: дубликат вида (кроме эпиков/легендарок) разбирается в крафтовую пыль
    const isDuplicate =
      !isHighRarity &&
      Boolean(randomToad.type) &&
      (getAchievementState().toads_collection || []).includes(
        randomToad.type as ToadTypes,
      );

    if (isDuplicate) {
      const dust = getDuplicateDust(rarity);
      updateUser({
        storage: {
          ...getGameState().user.storage,
          [Items.craftDust]: (current.storage[Items.craftDust] || 0) + dust,
        },
      });
      playOk();
      addNotification({
        type: "success",
        content: `Дубликат (${toadLabel.toLowerCase()}) разобран на крафтовую пыль: +${dust} ${itemsFull[Items.craftDust].name}`,
      });
      return;
    }

    addNotification({
      type: "success",
      content: `${toadLabel} жаба ${randomToad.name} поселилась в «${scene.name}»!`,
    });

    createToad({ ...randomToad, scene_id: scene.id });
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
      description: "Открывается прямо в биопод",
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
      common: "text-gray-300",
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
      className="w-6 h-6 text-blue-400"
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
    <Modal icon={icon} title="Склад">
      <ConfettiAnimation trigger={showConfetti} intensity={5} />

      {/* Полки: сколько места занято и откуда берётся вместимость */}
      <div className="mb-3 rounded-xl border border-blue-500/30 bg-blue-950/20 p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-blue-200">📦 Полки</span>
          <span className="tabular-nums text-gray-200">
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
                  : "bg-blue-500"
            }`}
            style={{ width: `${filledPercent}%` }}
          />
        </div>
        <p className="mt-2 text-2xs leading-snug text-gray-300">
          Складов в колонии: {capacity.rooms} — каждый даёт +
          {STORAGE_CAPACITY_PER_ROOM} к вместимости. Новый склад — гекс «📦
          Склад» на карте.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h3 className="text-white px-2 font-semibold">Инвентарь</h3>
          <div className="text-gray-300 text-sm">Свободно: {capacity.free}</div>
        </div>

        {storageItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-300 text-4xl mb-3">📦</div>
            <p className="text-gray-300 text-sm">Полки пусты</p>
            <p className="text-gray-500 text-xs mt-1">
              Корм, батарейки и пигменты появятся здесь после покупок и походов
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {storageItems.map((item) => (
              <div
                key={item.id}
                className={`relative rounded-xl p-3 border transition-all cursor-pointer group ${getItemRarityBg(
                  item.rarity,
                )} border-gray-600/50 hover:border-blue-500/50`}
                onClick={item.onClick}
              >
                {/* Количество */}
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
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
                  <div className="text-gray-300 text-xs leading-tight">
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
    </Modal>
  );
};

export default StorageModal;
