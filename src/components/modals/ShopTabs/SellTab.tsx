import { useState } from "react";
import { updateUser, deleteToadsByIds } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  Toad,
  getRarityConfig,
  getPersonalityLabel,
  calculateSellPrice,
} from "../../../models/toad";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../../utils/constants";
import { useToads } from "../../ToadContext";
import { PregnancyIcon } from "../../../assets/icons";
import {
  getShopState,
  saveShopState,
  ShopState,
} from "../../../backend/shop-state";
import { ToadItem } from "./ToadItem";
import { completeAchivement } from "../../../backend/achivements-manager";

// Иконка стрелки для сортировки
const SortArrowIcon = ({ direction }: { direction: "asc" | "desc" | null }) => (
  <svg
    className={`w-3 h-3 transition-transform ${
      direction === "desc" ? "rotate-180" : ""
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 16 16"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6l4 4 4-4"
    />
  </svg>
);

const SellTab: React.FC = () => {
  const { allToads: activeToads, account, currentScene } = useToads();
  const { playCell } = useSoundEffects();
  const [selectedToads, setSelectedToads] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<"rarity" | "price" | "name">("rarity");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterBy, setFilterBy] = useState<"all" | "enclosure" | "storage">(
    "all"
  );
  const { tokens = 0 } = account || {};

  // Обработчик сортировки
  const handleSort = (type: "rarity" | "price" | "name") => {
    if (sortBy === type) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      setSortDirection("desc");
    }
  };

  // Фильтрация по бизнес-логике
  const getFilteredToads = () => {
    switch (filterBy) {
      case "enclosure":
        return activeToads.filter((t) => t.scene_id === currentScene.id);
      case "storage":
        return activeToads.filter((t) => t.scene_id === null);
      case "all":
      default:
        return activeToads;
    }
  };

  // Сортировка
  const getSortedToads = (toads: Toad[]) => {
    return [...toads].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "rarity":
          aValue = a.genes.rarity;
          bValue = b.genes.rarity;
          break;
        case "price":
          aValue = calculateSellPrice(a);
          bValue = calculateSellPrice(b);
          break;
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;
        default:
          return 0;
      }

      if (sortDirection === "desc") {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });
  };

  const filteredToads = getSortedToads(getFilteredToads());
  const selectedFilteredToads = selectedToads.filter((id) =>
    filteredToads.some((toad) => toad.id === id)
  );

  const totalSellPrice = selectedFilteredToads.reduce((total, toadId) => {
    const toad = activeToads.find((t) => t.id === toadId);
    return total + (toad ? calculateSellPrice(toad) : 0);
  }, 0);

  const handleSellToads = async () => {
    if (selectedFilteredToads.length === 0) return;
    completeAchivement("sell-toad");

    playCell();
    deleteToadsByIds(selectedFilteredToads);
    updateUser({ tokens: tokens + totalSellPrice });
    setSelectedToads([]);

    const shopState = getShopState();
    const soldToads = activeToads.filter((t) =>
      selectedFilteredToads.includes(t.id)
    );

    const newShopState: ShopState = {
      ...shopState,
      availableToads: [...shopState.availableToads, ...soldToads],
    };

    saveShopState(newShopState);
  };

  const handleSellSingleToad = async (toadId: number) => {
    completeAchivement("sell-toad");
    playCell();
    const toad = activeToads.find((t) => t.id === toadId);
    if (toad) {
      const price = calculateSellPrice(toad);
      deleteToadsByIds([toadId]);
      updateUser({ tokens: tokens + price });
      setSelectedToads(selectedToads.filter((id) => id !== toadId));

      const shopState = getShopState();
      const newShopState: ShopState = {
        ...shopState,
        availableToads: [...shopState.availableToads, toad],
      };
      saveShopState(newShopState);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredToadIds = filteredToads.map((toad) => toad.id);
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

  const isAllFilteredSelected =
    filteredToads.length > 0 &&
    filteredToads.every((toad) => selectedToads.includes(toad.id));

  // Статистика для отображения
  const enclosureCount = activeToads.filter(
    (t) => t.scene_id === currentScene.id
  ).length;
  const storageCount = activeToads.filter((t) => t.scene_id === null).length;

  return (
    <div className="space-y-3 px-3 pb-3">
      {/* Панель фильтров */}
      <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 border border-cyan-500/20">
        <div className="space-y-2">
          {/* Селектор сортировки */}
          <div className="flex items-center gap-2">
            <span className="text-cyan-300 text-xs font-medium min-w-[20px]">
              <svg
                className="w-4 h-4"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6L8 2L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 10L8 14L4 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="flex bg-gray-700/50 rounded-lg p-1 border border-cyan-500/10">
              <button
                onClick={() => handleSort("rarity")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                  sortBy === "rarity"
                    ? "bg-cyan-600 text-white shadow-sm shadow-cyan-500/30"
                    : "text-gray-300 hover:text-cyan-300"
                }`}
              >
                Редкость
                <SortArrowIcon
                  direction={sortBy === "rarity" ? sortDirection : null}
                />
              </button>
              <div className="w-px bg-cyan-500/20 my-1"></div>
              <button
                onClick={() => handleSort("price")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                  sortBy === "price"
                    ? "bg-cyan-600 text-white shadow-sm shadow-cyan-500/30"
                    : "text-gray-300 hover:text-cyan-300"
                }`}
              >
                Цена
                <SortArrowIcon
                  direction={sortBy === "price" ? sortDirection : null}
                />
              </button>
              <div className="w-px bg-cyan-500/20 my-1"></div>
              <button
                onClick={() => handleSort("name")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                  sortBy === "name"
                    ? "bg-cyan-600 text-white shadow-sm shadow-cyan-500/30"
                    : "text-gray-300 hover:text-cyan-300"
                }`}
              >
                Имя
                <SortArrowIcon
                  direction={sortBy === "name" ? sortDirection : null}
                />
              </button>
            </div>
          </div>

          {/* Селектор фильтрации */}
          <div className="flex items-center gap-2">
            <span className="text-purple-300 text-xs font-medium min-w-[20px]">
              <svg
                className="w-4 h-4"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 2H2L6 8V14L10 12V8L14 2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>
            <div className="flex bg-gray-700/50 rounded-lg p-1 border border-purple-500/10">
              <button
                onClick={() => setFilterBy("all")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  filterBy === "all"
                    ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                    : "text-gray-300 hover:text-purple-300"
                }`}
              >
                Все ({activeToads.length})
              </button>
              <div className="w-px bg-purple-500/20 my-1"></div>
              <button
                onClick={() => setFilterBy("enclosure")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  filterBy === "enclosure"
                    ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                    : "text-gray-300 hover:text-purple-300"
                }`}
              >
                Вольер ({enclosureCount})
              </button>
              <div className="w-px bg-purple-500/20 my-1"></div>
              <button
                onClick={() => setFilterBy("storage")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  filterBy === "storage"
                    ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                    : "text-gray-300 hover:text-purple-300"
                }`}
              >
                Склад ({storageCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Панель выбора */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-3 border border-yellow-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-sm">Сумма:</span>
              <span className="text-yellow-200 font-bold text-sm">
                {totalSellPrice} {CURRENCY_CONFIG.tokens.icon}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {selectedFilteredToads.length > 0 && (
              <button
                onClick={handleSellToads}
                className="px-3 py-1.5 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm border border-yellow-500/30"
              >
                Продать ({selectedFilteredToads.length})
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
        </div>
      </div>

      {/* Список жаб */}
      {filteredToads.length === 0 ? (
        <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl p-6 border border-gray-600/20 text-center">
          <p className="text-gray-400 text-sm">
            {activeToads.length === 0
              ? "У вас пока нет жаб"
              : "Жабы не найдены"}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {activeToads.length === 0
              ? "Приобретите жаб на рынке"
              : "Измените фильтры для отображения"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredToads.map((toad) => {
            const price = calculateSellPrice(toad);
            const isSelected = selectedToads.includes(toad.id);

            return (
              <ToadItem
                key={toad.id}
                isSelected={isSelected}
                onClick={() => {
                  if (isSelected) {
                    setSelectedToads(
                      selectedToads.filter((id) => id !== toad.id)
                    );
                  } else {
                    setSelectedToads([...selectedToads, toad.id]);
                  }
                }}
                toad={toad}
                button={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSellSingleToad(toad.id);
                    }}
                    className="px-3 min-w-[64px] py-1.5 bg-gradient-to-r from-yellow-600 to-amber-600  text-white rounded-lg text-sm font-medium transition-all shadow-sm border border-yellow-500/30 ml-2"
                  >
                    {price} {CURRENCY_CONFIG.tokens.icon}
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellTab;
