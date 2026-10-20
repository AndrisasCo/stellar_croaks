import { useState } from "react";
import { INSTANT_REFRESH_COST } from "../../../../backend/shop-state";
import { usePagination } from "../../../../hooks/use-pagination";
import { Toad } from "../../../../models/Toad";
import { ClickButton } from "../../../shared/ClickButton";
import { CurrencyIcon } from "../../../shared/CurrencyIcon";
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

  const [activeTab, setActiveTab] = useState("items");

  const {
    visibleItems: visibleToads,
    hasMore,
    loadMoreRef,
  } = usePagination<Toad>(shopState.availableToads, 5);

  return (
    <div className="space-y-4 pb-4">
      {/* Управление магазином */}
      <div className="bg-color-main rounded-2xl py-4 px-2 border border-slate-700">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Обновление ассортимента:</span>
            <span className="text-white font-mono">{timeLeft}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefreshShop}
              disabled={!canRefresh}
              className="ui-button-primary flex-1"
            >
              Обновить рынок
            </button>

            <button
              onClick={handleInstantRefresh}
              disabled={tokens < INSTANT_REFRESH_COST}
              className="ui-button-secondary whitespace-nowrap"
            >
              {INSTANT_REFRESH_COST}{" "}
              <CurrencyIcon currency="tokens" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-3">
        <ClickButton
          onClick={() => {
            setActiveTab("items");
          }}
          className={`rounded-md border-2 px-2 text-lg font-semibold text-white duration-200 ${
            activeTab === "items"
              ? "border-cyan-400/70 bg-cyan-500/20 opacity-100"
              : "border-slate-500/50 bg-color-main opacity-70 hover:opacity-90"
          }`}
        >
          Предметы
        </ClickButton>
        <ClickButton
          onClick={() => {
            setActiveTab("toads");
          }}
          className={`rounded-md border-2 px-2 text-lg font-semibold text-white duration-200 ${
            activeTab === "toads"
              ? "border-cyan-400/70 bg-cyan-500/20 opacity-100"
              : "border-slate-500/50 bg-color-main opacity-70 hover:opacity-90"
          }`}
        >
          Жабы
        </ClickButton>
      </div>

      {activeTab === "items" && shopItems.map((i) => <BuyButton item={i} />)}

      {activeTab === "toads" && (
        <>
          {allToadsPurchased ? (
            <div className="bg-color-main rounded-2xl p-6 border border-slate-700 text-center">
              <p className="text-slate-300 text-lg">Все жабы раскуплены!</p>
              <p className="text-slate-500 text-sm mt-1">
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
                        className="ui-button-primary min-w-[64px] whitespace-nowrap px-3 py-1.5"
                      >
                        {calculateBuyPrice(toad as Toad)}{" "}
                        <CurrencyIcon currency="tokens" className="h-4 w-4" />
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
                  <div className="animate-pulse text-slate-300 text-sm">
                    Загрузка жаб...
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BuyTab;
