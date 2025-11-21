import React, { useState } from "react";
import { Toad, getRarityConfig, getPersonalityLabel } from "../../models/toad";
import { TYPE_ICONS } from "../../utils/constants";
import Modal from "../shared/Modal";
import { useToads } from "../ToadContext";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { updateToadById } from "../../backend";
import { ToadGender } from "../shared/ToadGender";
import { PregnancyIcon } from "../../assets/icons";
import { useNotifications } from "../../hooks/use-notification";

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
}

const StorageModal: React.FC<StorageModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<StorageTabType>("items");
  const { addNotification } = useNotifications();
  const { allToads = [], account, currentScene, toads } = useToads();
  const { playClick } = useSoundEffects();

  // Жабы на складе (без сцены)
  const storedToads = allToads?.filter((toad) => toad.scene_id === null) || [];

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
  ];

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
      <div className="flex border-b border-gray-700 bg-gray-800">
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
      </div>

      {/* Контент */}
      <div className="py-4 overflow-y-auto h-[calc(80vh-176px)] ">
        {/* Вкладка предметов */}
        {activeTab === "items" && (
          <div className="flex flex-col h-[calc(80vh-210px)] gap-5">
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
                  onClick={() => handleUseItem(item)}
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
          <div className="space-y-3 h-[calc(80vh-156px)]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white px-2 font-semibold">Жабы на складе</h3>
              <div className="text-gray-400 text-sm">
                {storedToads.length} из ∞
              </div>
            </div>

            {storedToads.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-3">🐸</div>
                <p className="text-gray-400 text-sm">На складе нет жаб</p>
                <p className="text-gray-500 text-xs mt-1">
                  Жабы появятся здесь после продажи или снятия со сцены
                </p>
              </div>
            ) : (
              storedToads.map((toad) => {
                const rarityConfig = getRarityConfig(toad.genes.rarity);

                return (
                  <div
                    key={toad.id}
                    className="bg-gray-800 rounded-xl p-3 border border-gray-700 hover:border-green-500/50 transition-all cursor-pointer"
                    onClick={() => handleMoveToadToScene(toad)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          className="w-10 h-10 rounded-full border-2"
                          style={{
                            backgroundColor: toad.genes.colors[0],
                            borderColor: rarityConfig.borderColor
                              .replace("border-", "")
                              .replace("/50", ""),
                          }}
                        />
                        <span className="absolute -top-1 -right-1 text-xs bg-gray-800 rounded-full p-1">
                          <ToadGender gender={toad.sex} />
                        </span>
                        {toad.pregnancy?.isPregnant && (
                          <span className="absolute -bottom-1 -left-1 text-xs text-pink-400 bg-gray-800 rounded-full p-1">
                            <PregnancyIcon />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium truncate">
                            {toad.name || "Без имени"}
                          </p>
                          <span className={`text-xs ${rarityConfig.color}`}>
                            {rarityConfig.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mb-1">
                          <span>Размер: {toad.genes.weight.toFixed(1)}</span>
                          <span>Скорость: {toad.genes.speed.toFixed(1)}</span>
                          <span>Редкость: {toad.genes.rarity.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                          <span>Поколение {toad.generation}</span>
                          <span>•</span>
                          <span>
                            {toad.stage === "adult" ? "Взрослый" : "Головастик"}
                          </span>
                          <span>•</span>
                          <span>Сытость: {toad.state.hunger}/100</span>
                          {toad.genes.personality && (
                            <>
                              <span>•</span>
                              <span className="text-purple-400">
                                {getPersonalityLabel(toad.genes.personality)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-green-400 text-sm font-medium">
                        В вольер →
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Подсказка */}
            {storedToads.length > 0 && (
              <div className="mt-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600/50">
                <div className="text-gray-400 text-sm text-center">
                  Нажмите на жабу чтобы переместить в активный вольер
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Статистика в подвале */}
      <div className="border-t border-gray-700/50 py-4 px-2 bg-gray-900/50">
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
      </div>
    </Modal>
  );
};

export default StorageModal;
