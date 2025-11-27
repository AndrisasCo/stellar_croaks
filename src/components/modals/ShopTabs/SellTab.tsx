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
import { ToadItem } from "../../shared/ToadItem";
import { completeAchivement } from "../../../backend/achivements-manager";
import { useFilters } from "../../../hooks/use-filters";
import { Filters } from "../../shared/Filters";

const SellTab: React.FC = () => {
  const { allToads: activeToads, account, currentScene } = useToads();
  const { playCell } = useSoundEffects();
  const [selectedToads, setSelectedToads] = useState<number[]>([]);

  const preparedToads = activeToads.filter(
    (t) => t.scene_id === null || t.scene_id === currentScene.id
  );

  const { tokens = 0 } = account || {};

  const {
    filteredAndSortedToads: filteredToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  } = useFilters(preparedToads);

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

  return (
    <div className="space-y-3 pb-3">
      {/* Панель фильтров */}
      <Filters
        toads={activeToads}
        setSortDirection={setSortDirection}
        setSortBy={setSortBy}
        filterBy={filterBy}
        setFilterBy={setFilterBy}
        sortBy={sortBy}
        sortDirection={sortDirection}
        addPrice
      />

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
