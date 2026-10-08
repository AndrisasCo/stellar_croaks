import { useState } from "react";
import { updateUser, deleteToadsByIds } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { Toad, calculateSellPrice } from "../../../models/Toad";
import { CURRENCY_CONFIG } from "../../../utils/constants";
import { useToads } from "../../ToadContext";
import {
  getShopState,
  saveShopState,
  ShopState,
} from "../../../backend/shop-state";
import { ToadItem } from "../../shared/ToadItem";
import {
  completeAchivement,
  completeAchivementCounter,
} from "../../../backend/achivements-manager";
import { useFilters } from "../../../hooks/use-filters";
import { Filters } from "../../shared/Filters";
import { usePagination } from "../../../hooks/use-pagination";
import { useNotifications } from "../../../hooks/use-notification";
import { exchangeBiomassForTokens } from "../../../utils/production-manager";
import { BIOMASS_TO_TOKENS_RATE } from "../../../utils/gamification-config";

const SellTab: React.FC = () => {
  const { allToads: activeToads, account } = useToads();
  const { playCell } = useSoundEffects();
  const { addNotification } = useNotifications();
  const [selectedToads, setSelectedToads] = useState<number[]>([]);

  const { tokens = 0, biomass = 0 } = account || {};
  const biomassTokens = Math.floor(biomass * BIOMASS_TO_TOKENS_RATE);

  // Часть 3.7: биомасса с фермы обменивается на Кваксы
  const handleExchangeBiomass = () => {
    const result = exchangeBiomassForTokens();
    if (result.success) {
      playCell();
      addNotification({
        type: "success",
        content: `Обменяно биомассы на ${result.tokensGained} Кваксов`,
      });
    } else {
      addNotification({
        type: "warn",
        content: "Недостаточно биомассы для обмена",
      });
    }
  };

  // Часть 5: жабы в походе за Периметр продаются только после возвращения
  const saleableToads = activeToads.filter((toad) => toad.status !== "out");

  const {
    filteredAndSortedToads: filteredToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  } = useFilters(saleableToads);

  const selectedFilteredToads = selectedToads.filter((id) =>
    filteredToads.some((toad) => toad.id === id)
  );

  const {
    visibleItems: visibleToads,
    hasMore,
    loadMoreRef,
  } = usePagination<Toad>(filteredToads, 5);

  const totalSellPrice = selectedFilteredToads.reduce((total, toadId) => {
    const toad = activeToads.find((t) => t.id === toadId);
    return total + (toad ? calculateSellPrice(toad) : 0);
  }, 0);

  const handleSellToads = async () => {
    if (selectedFilteredToads.length === 0) {
      return;
    }
    completeAchivement("sell-toad");
    completeAchivementCounter("earn", totalSellPrice);

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
    const toad = activeToads.find((t) => t.id === toadId);

    if (!toad || toad.status === "out") {
      return;
    }
    completeAchivement("sell-toad");

    playCell();
    const price = calculateSellPrice(toad);
    completeAchivementCounter("earn", price);

    deleteToadsByIds([toadId]);
    updateUser({ tokens: tokens + price });
    setSelectedToads(selectedToads.filter((id) => id !== toadId));

    const shopState = getShopState();
    const newShopState: ShopState = {
      ...shopState,
      availableToads: [...shopState.availableToads, toad],
    };
    saveShopState(newShopState);
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
      {/* Ферма: обмен биомассы на Кваксы (Часть 3.7) */}
      <div className="bg-color-main rounded-xl p-3 border border-emerald-500/30 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-emerald-300 font-semibold text-sm truncate">
            🧪 Биомасса: {Math.floor(biomass)}
          </div>
          <div className="text-gray-400 text-xs">
            Курс обмена: 2 биомассы = 1 {CURRENCY_CONFIG.tokens.icon}
          </div>
        </div>
        <button
          onClick={handleExchangeBiomass}
          disabled={biomassTokens <= 0}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 ${
            biomassTokens > 0
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400/30 hover:from-emerald-500 hover:to-teal-500"
              : "bg-gray-600/30 text-gray-400 border-gray-500/30 cursor-not-allowed"
          }`}
        >
          Обменять ({biomassTokens} {CURRENCY_CONFIG.tokens.icon})
        </button>
      </div>

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
      <div className="bg-color-main rounded-xl p-3 border border-gray-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-200 text-sm">Сумма:</span>
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
        <div className="bg-color-main backdrop-blur-sm rounded-xl p-6 border border-gray-600/20 text-center">
          <p className="text-gray-300 text-sm">
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
          {visibleToads.map((toad) => {
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

          {hasMore && (
            <div
              ref={loadMoreRef}
              className="flex justify-center py-4"
              key="load-more"
            >
              <div className="animate-pulse text-gray-300 text-sm">
                Загрузка жаб...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SellTab;
