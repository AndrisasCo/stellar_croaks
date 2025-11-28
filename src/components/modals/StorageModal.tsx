import React, { useState } from "react";
import { Toad, generateLootboxToad } from "../../models/toad";
import Modal from "../shared/Modal";
import { useToads } from "../ToadContext";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { createToad, updateToadById } from "../../backend";
import { ToadGender } from "../shared/ToadGender";
import { PregnancyIcon } from "../../assets/icons";
import { useNotifications } from "../../hooks/use-notification";
import { ToadItem } from "../shared/ToadItem";
import { useFilters } from "../../hooks/use-filters";
import { Filters } from "../shared/Filters";
import { randomizeToadCharacteristics } from "../../utils/randomize-toad-characteristics";

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
  const { lootbox } = account.storage || 0;
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

  const handleOpenLootbox = () => {
    const randomToad = randomizeToadCharacteristics(generateLootboxToad());

    addNotification({
      type: "success",
      content: `На склад добавлена новая жаба ${randomToad.name}!`,
    });

    createToad(randomToad);
  };

  // Предметы на складе
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
    // {
    //   id: "2",
    //   name: "Волшебные черви",
    //   icon: "🪱",
    //   quantity: 15,
    //   description: "Повышает плодовитость",
    //   type: "food",
    //   rarity: "uncommon",
    // },
    // {
    //   id: "3",
    //   name: "Сияющие мушки",
    //   icon: "✨",
    //   quantity: 8,
    //   description: "Увеличивает скорость",
    //   type: "food",
    //   rarity: "rare",
    // },
    // {
    //   id: "4",
    //   name: "Лунные камни",
    //   icon: "🌕",
    //   quantity: 3,
    //   description: "Для элитных жаб",
    //   type: "material",
    //   rarity: "epic",
    // },
    // {
    //   id: "5",
    //   name: "Золотые водоросли",
    //   icon: "🌿",
    //   quantity: 25,
    //   description: "Улучшает здоровье",
    //   type: "material",
    //   rarity: "uncommon",
    // },
    // {
    //   id: "6",
    //   name: "Хрустальные икринки",
    //   icon: "🔮",
    //   quantity: 5,
    //   description: "Редкий материал для скрещивания",
    //   type: "material",
    //   rarity: "rare",
    // },
    // {
    //   id: "8",
    //   name: "Усилитель генов",
    //   icon: "🧬",
    //   quantity: 1,
    //   description: "Улучшает характеристики потомства",
    //   type: "tool",
    //   rarity: "epic",
    // },
    // {
    //   id: "9",
    //   name: "Энергетический концентрат",
    //   icon: "⚡",
    //   quantity: 12,
    //   description: "Восстанавливает энергию жаб",
    //   type: "food",
    //   rarity: "common",
    // },
    // {
    //   id: "10",
    //   name: "Радужные брызги",
    //   icon: "🌈",
    //   quantity: 7,
    //   description: "Временно увеличивает редкость",
    //   type: "tool",
    //   rarity: "rare",
    // },
    // {
    //   id: "11",
    //   name: "Легендарная эссенция",
    //   icon: "⭐",
    //   quantity: 1,
    //   description: "Шанс создать легендарную жабу",
    //   type: "material",
    //   rarity: "legendary",
    // },
    // {
    //   id: "12",
    //   name: "Защитный амулет",
    //   icon: "🛡️",
    //   quantity: 4,
    //   description: "Защищает от болезней",
    //   type: "tool",
    //   rarity: "uncommon",
    // },
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

  // Функция использования предмета
  const handleUseItem = (item: StorageItem) => {
    playClick();
    console.log("Использован предмет:", item.name);
    // Здесь будет логика использования предмета
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
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
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
              {storedToads.length} из ∞
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

          {filteredAndSortedToads.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-3">🐸</div>
              <p className="text-gray-400 text-sm">Жаб не обнаружено</p>
              <p className="text-gray-500 text-xs mt-1">
                Попробуйте поменять фильтры
              </p>
            </div>
          ) : (
            filteredAndSortedToads.map((toad) => {
              return (
                <ToadItem
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
        </div>
      )}

      {/* Статистика в подвале
      <div className="border-t border-gray-700/50 py-4 px-2 bg-gray-900/50 mt-5">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="text-blue-400 font-bold">
              {storageItems
                .filter((item) => item.type === "food")
                .reduce((sum, item) => sum + item.quantity, 0)}
            </div>
            <div className="text-gray-400 text-[10px]">Корм</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {storageItems
                .filter((item) => item.type === "material")
                .reduce((sum, item) => sum + item.quantity, 0)}
            </div>
            <div className="text-gray-400 text-[10px]">Материалы</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">{storedToads.length}</div>
            <div className="text-gray-400 text-[10px]">Жабы</div>
          </div>
        </div>
      </div> */}
    </Modal>
  );
};

export default StorageModal;
