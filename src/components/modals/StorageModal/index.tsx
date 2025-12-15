import React, { useState } from "react";
import { Toad, generateLootboxToad } from "../../../models/toad";
import Modal from "../../shared/Modal";
import { useToads } from "../../ToadContext";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  createToad,
  updateToadById,
  updateToadsByIds,
  updateUser,
} from "../../../backend";
import { useNotifications } from "../../../hooks/use-notification";
import { ToadItem } from "../../shared/ToadItem";
import { useFilters } from "../../../hooks/use-filters";
import { Filters } from "../../shared/Filters";
import { randomizeToadCharacteristics } from "../../../utils/randomize-toad-characteristics";
import { getGameState } from "../../../backend/localStorage";
import {
  loadColliderState,
  saveColliderState,
} from "../../../backend/collider-manager";
import { MAX_STORED_TOADS } from "../../../utils/constants";
import { usePagination } from "../../../hooks/use-pagination";

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type StorageTabType = "items" | "toads";

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

const StorageModal: React.FC<StorageModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<StorageTabType>("toads");
  const { addNotification } = useNotifications();
  const { allToads = [], account, currentScene, toads } = useToads();
  const { playClick } = useSoundEffects();
  const [selectedToads, setSelectedToads] = useState<number[]>([]);

  // Жабы на складе (без сцены)
  const storedToads = allToads?.filter((toad) => toad.scene_id === null) || [];

  const {
    filteredAndSortedToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  } = useFilters(storedToads);

  const {
    visibleItems: visibleToads,
    hasMore,
    loadMoreRef,
  } = usePagination<Toad>(filteredAndSortedToads, 5);

  const handleSelectAllFiltered = () => {
    const filteredToadIds = filteredAndSortedToads.map((toad) => toad.id);
    const allSelected = filteredToadIds.every((id) =>
      selectedToads.includes(id)
    );

    if (allSelected) {
      setSelectedToads(
        selectedToads.filter((id) => !filteredToadIds.includes(id))
      );
    } else {
      const newSelected = [...new Set([...selectedToads, ...filteredToadIds])];
      setSelectedToads(newSelected);
    }
  };

  const selectedFilteredToads = selectedToads.filter((id) =>
    filteredAndSortedToads.some((toad) => toad.id === id)
  );

  const isAllFilteredSelected =
    filteredAndSortedToads.length > 0 &&
    filteredAndSortedToads.every((toad) => selectedToads.includes(toad.id));

  const handleOpenLootbox = () => {
    const account = getGameState().user;
    if (!account.storage.lootbox) {
      return;
    }
    const randomToad = randomizeToadCharacteristics(generateLootboxToad());

    addNotification({
      type: "success",
      content: `На склад добавлена новая жаба ${randomToad.name}!`,
    });

    updateUser({
      storage: { ...account.storage, lootbox: account.storage.lootbox - 1 },
    });

    createToad(randomToad);
  };

  const handleClickBattery = () => {
    const account = getGameState().user;
    if (!account.storage.battery) {
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

    if (activeSlot.isReady) {
      addNotification({
        type: "warn",
        content: `Инкубация уже завершена!`,
      });
      return;
    }

    activeSlot.startTime = activeSlot.startTime - 10 * 60 * 1000; // +10 мин
    saveColliderState(collider);
    window.dispatchEvent(new Event("colliderChanged"));

    addNotification({
      type: "success",
      content: `Инкубация ускорена`,
    });

    updateUser({
      storage: { ...account.storage, battery: account.storage.battery - 1 },
    });
  };

  const storageItems: StorageItem[] = [
    {
      id: "1",
      name: "Жабий корм",
      icon: "🍎",
      quantity: account?.storage?.food || 0,
      description: "Основной корм для жаб",
      type: "food",
      rarity: "common",
      key: "food",
    },
    {
      id: "2",
      name: "Лутбокс",
      icon: "🎁",
      quantity: account?.storage?.lootbox || 0,
      description: "Открой!",
      type: "tool",
      rarity: "rare",
      key: "lootbox",
      onClick: handleOpenLootbox,
    },
    {
      id: "3",
      name: "Батарейка",
      icon: "🔋",
      quantity: account?.storage?.battery || 0,
      description: "Ускоряет созревание жабы в инкубаторе на 10 минут",
      type: "tool",
      rarity: "common",
      key: "battery",
      onClick: handleClickBattery,
    },
    {
      id: "4",
      name: "Сияющие мушки",
      icon: "✨",
      quantity: account?.storage?.sparkleFlys || 0,
      description: "Ускоряют беременность жабы на 100%",
      type: "material",
      rarity: "rare",
      key: "sparkle_flys",
    },
    {
      id: "5",
      name: "Белковые черви",
      icon: "🪱",
      quantity: account?.storage?.worms || 0,
      description: "Ускоряет рост головастика на 100%",
      type: "material",
      rarity: "uncommon",
      key: "worms",
    },
  ].filter((t) => t.quantity);

  // Функция для получения цвета редкости предмета
  const getItemRarityColor = (rarity: StorageItem["rarity"]): string => {
    const colors = {
      common: "text-gray-400",
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
      common: "bg-gray-700/50",
      uncommon: "bg-green-900/20",
      rare: "bg-blue-900/20",
      epic: "bg-purple-900/20",
      legendary: "bg-yellow-900/20",
    };
    return colors[rarity];
  };

  // Функция перемещения жабы на сцену
  const handleMoveToadToScene = (toad: Toad) => {
    playClick();
    if (currentScene.capacity < toads.length + 1) {
      addNotification({ type: "warn", content: "Данный вольер переполнен!" });
      return;
    }
    updateToadById(toad.id, { scene_id: currentScene.id });
  };

  const handleMoveToadsToScene = () => {
    playClick();

    if (currentScene.capacity >= toads.length + selectedFilteredToads.length) {
      updateToadsByIds(selectedFilteredToads, { scene_id: currentScene.id });
      setSelectedToads([]);
      return;
    }
    const maxCapacity = currentScene.capacity - toads.length;
    updateToadsByIds(selectedFilteredToads.slice(0, maxCapacity), {
      scene_id: currentScene.id,
    });
    setSelectedToads([]);

    addNotification({ type: "warn", content: "Данный вольер переполнен!" });
  };

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
    <Modal isOpen={isOpen} onClose={onClose} icon={icon} title="Склад">
      {/* Табы */}
      <div className="flex border-b border-gray-700 bg-gray-800 mb-3">
        <button
          onClick={() => {
            playClick();
            setActiveTab("toads");
          }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "toads"
              ? "text-green-400 border-b-2 border-green-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Жабы ({storedToads.length})
        </button>
        <button
          onClick={() => {
            playClick();
            setActiveTab("items");
          }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "items"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Предметы
        </button>
      </div>

      {/* Вкладка предметов */}
      {activeTab === "items" && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white px-2 font-semibold">Инвентарь</h3>
            <div className="text-gray-400 text-sm">
              Всего предметов:{" "}
              {storageItems.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          </div>
          {/* Сетка предметов 3x4 */}
          <div className="grid grid-cols-3 gap-3">
            {storageItems.map((item) => (
              <div
                key={item.id}
                className={`relative rounded-xl p-3 border transition-all cursor-pointer group ${getItemRarityBg(
                  item.rarity
                )} border-gray-600/50 hover:border-blue-500/50`}
                onClick={item.onClick}
              >
                {/* Количество */}
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {item.quantity}
                </div>

                {/* Иконка предмета */}
                <div className="text-2xl text-center mb-2">{item.icon}</div>

                {/* Название и описание */}
                <div className="text-center">
                  <div
                    className={`text-sm font-medium mb-1 ${getItemRarityColor(
                      item.rarity
                    )}`}
                  >
                    {item.name}
                  </div>
                  <div className="text-gray-400 text-xs leading-tight">
                    {item.description}
                  </div>
                </div>

                {/* Бэйджик типа */}
                <div className="absolute top-1 left-1">
                  <div
                    className={`text-[10px] px-2 py-1 rounded-full ${
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
          {/* Подсказка
            <div className="p-3 bg-gray-700/50 mt-auto  rounded-lg border border-gray-600/50">
              <div className="text-gray-400 text-sm text-center">
                Нажмите на предмет для использования
              </div>
            </div> */}
        </div>
      )}

      {/* Вкладка жаб */}
      {activeTab === "toads" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white px-2 font-semibold">Жабы на складе</h3>
            <div className="text-gray-400 text-sm">
              {storedToads.length} из {MAX_STORED_TOADS}
            </div>
          </div>

          <Filters
            toads={storedToads}
            setSortDirection={setSortDirection}
            setSortBy={setSortBy}
            filterBy={filterBy}
            setFilterBy={setFilterBy}
            sortBy={sortBy}
            sortDirection={sortDirection}
          />

          <div className="flex gap-2">
            {selectedFilteredToads.length > 0 && (
              <button
                onClick={handleMoveToadsToScene}
                className="px-3 py-1.5 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm border border-yellow-500/30"
              >
                В вольер
              </button>
            )}
            <button
              onClick={handleSelectAllFiltered}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                isAllFilteredSelected
                  ? "bg-red-500/20 text-red-400 border-red-500/40"
                  : "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
              }`}
              title={isAllFilteredSelected ? "Снять выделение" : "Выбрать все"}
            >
              {isAllFilteredSelected ? "✕" : "▼"}
            </button>
          </div>

          {filteredAndSortedToads.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-3">🐸</div>
              <p className="text-gray-400 text-sm">Жаб не обнаружено</p>
              <p className="text-gray-500 text-xs mt-1">
                Попробуйте поменять фильтры
              </p>
            </div>
          ) : (
            visibleToads.map((toad) => {
              return (
                <ToadItem
                  isSelected={selectedToads.includes(toad.id)}
                  onClick={() => {
                    if (selectedToads.includes(toad.id)) {
                      setSelectedToads(
                        selectedToads.filter((id) => id !== toad.id)
                      );
                    } else {
                      setSelectedToads([...selectedToads, toad.id]);
                    }
                  }}
                  key={toad.id}
                  button={
                    <button
                      className="text-green-400 px-1 py-2 bg-green-400 bg-opacity-30 rounded-lg text-sm font-medium"
                      onClick={() => handleMoveToadToScene(toad)}
                    >
                      В вольер →
                    </button>
                  }
                  toad={toad}
                />
              );
            })
          )}
          {/* Индикатор загрузки для бесконечного скролла */}
          {hasMore && (
            <div
              ref={loadMoreRef}
              className="flex justify-center py-4"
              key="load-more"
            >
              <div className="animate-pulse text-gray-400 text-sm">
                Загрузка жаб...
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default StorageModal;
