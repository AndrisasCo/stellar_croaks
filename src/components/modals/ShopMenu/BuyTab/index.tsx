import { INSTANT_REFRESH_COST } from "../../../../backend/shop-state";
import { usePagination } from "../../../../hooks/use-pagination";
import { Toad } from "../../../../models/Toad";
import { CURRENCY_CONFIG } from "../../../../utils/constants";
import { ToadItem } from "../../../shared/ToadItem";
import { useToads } from "../../../ToadContext";
import { BuyButton } from "./BuyButton";
import { useShop } from "./use-shop";

const BuyTab: React.FC = () => {
  const { account } = useToads();
  const { tokens = 0, astro_quax = 0, storage = { food: 0 } } = account || {};
  const {
    shopItems,
    handleInstantRefresh,
    handleBuyToad,
    handleRefreshShop,
    timeLeft,
    canRefresh,
    calculateBuyPrice,
    allToadsPurchased,
    shopState,
  } = useShop();

  const {
    visibleItems: visibleToads,
    hasMore,
    loadMoreRef,
  } = usePagination<Toad>(shopState.availableToads, 5);

  console.log({ shopItems });

  return (
    <div className="space-y-4 pb-4">
      {/* Управление магазином */}
      <div className="bg-gray-800 rounded-2xl py-4 px-2 border border-gray-700">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Обновление ассортимента:</span>
            <span className="text-white font-mono">{timeLeft}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefreshShop}
              disabled={!canRefresh}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                canRefresh
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              Обновить рынок
            </button>

            <button
              onClick={handleInstantRefresh}
              disabled={tokens < INSTANT_REFRESH_COST}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tokens >= INSTANT_REFRESH_COST
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {INSTANT_REFRESH_COST} {CURRENCY_CONFIG.tokens.icon}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-white font-semibold mb-3 px-2 text-lg">Предметы</h3>
        {shopItems.map((i) => (
          <BuyButton item={i} />
        ))}
      </div>

      {/* Доступные жабы */}
      <div>
        <h3 className="text-white px-2 font-semibold mb-3 text-lg">
          Доступные жабы
          {visibleToads.length > 0 && (
            <span className="text-gray-400 text-sm ml-2">
              ({visibleToads.length} из {shopState.availableToads.length})
            </span>
          )}
        </h3>

        {allToadsPurchased ? (
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 text-center">
            <p className="text-gray-400 text-lg">Все жабы раскуплены!</p>
            <p className="text-gray-500 text-sm mt-1">
              Дождитесь обновления магазина или обновите его сейчас за
              астрокваксы
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleToads.map((toad, index) => {
              return (
                <ToadItem
                  toad={toad as Toad}
                  key={`${toad.id}-${index}`}
                  button={
                    <button
                      onClick={() => handleBuyToad(toad as Toad)}
                      disabled={tokens < calculateBuyPrice(toad as Toad)}
                      className={`px-3 min-w-[64px] py-1.5 rounded-lg bg-gray-600 text-sm font-medium text-white whitespace-nowrap transition-colors ${
                        tokens >= calculateBuyPrice(toad as Toad) &&
                        "bg-gradient-to-r from-green-600 to-emerald-800 text-white"
                      }`}
                    >
                      {calculateBuyPrice(toad as Toad)}{" "}
                      {CURRENCY_CONFIG.tokens.icon}
                    </button>
                  }
                />
              );
            })}

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
      </div>
    </div>
  );
};

export default BuyTab;
