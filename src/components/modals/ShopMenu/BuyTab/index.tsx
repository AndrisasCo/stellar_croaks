import { useState } from "react";
import { INSTANT_REFRESH_COST } from "../../../../backend/shop-state";
import { usePagination } from "../../../../hooks/use-pagination";
import { Toad } from "../../../../models/Toad";
import { ClickButton } from "../../../shared/ClickButton";
import { CurrencyIcon } from "../../../shared/CurrencyIcon";
import { HudPanel, SectionTitle } from "../../../shared/DataGrid";
import { ToadListCard } from "../../../shared/ToadListCard";
import { useToads } from "../../../ToadContext";
import { BuyButton } from "./BuyButton";
import { useShop } from "./use-shop";

/** Две витрины канала: расходники и живые жабы. */
type BuyTabId = "items" | "toads";

const BUY_TABS: { id: BuyTabId; label: string; code: string }[] = [
  { id: "items", label: "Предметы", code: "CARGO" },
  { id: "toads", label: "Жабы", code: "BIO" },
];

/** Переключатель витрины: терминальные сегменты вместо старых «пилюль». */
const BuyTabSwitch = ({
  active,
  onChange,
}: {
  active: BuyTabId;
  onChange: (tab: BuyTabId) => void;
}) => (
  <div
    role="tablist"
    aria-label="Витрина торгового терминала"
    className="grid grid-cols-2 border border-amber-400/20 bg-slate-950/50 sm:inline-flex"
  >
    {BUY_TABS.map((tab) => {
      const isActive = tab.id === active;

      return (
        <ClickButton
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.id)}
          className={`relative inline-flex items-center justify-center gap-1.5 px-3 py-2 text-3xs font-semibold uppercase tracking-[0.16em] transition-colors ${
            isActive
              ? "bg-amber-400/10 text-amber-200"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          {tab.label}
          <span className="text-slate-600">{tab.code}</span>
        </ClickButton>
      );
    })}
  </div>
);

const BuyTab: React.FC = () => {
  const { account } = useToads();
  const { tokens = 0 } = account || {};
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

  const [activeTab, setActiveTab] = useState<BuyTabId>("items");

  const {
    visibleItems: visibleToads,
    hasMore,
    loadMoreRef,
  } = usePagination<Toad>(shopState.availableToads, 5);

  const instantRefreshAvailable = tokens >= INSTANT_REFRESH_COST;

  return (
    <div className="space-y-3 pb-4">
      {/* Канал закупок: витрина, таймер и обновление в одной панели */}
      <HudPanel tone="amber" className="p-2.5">
        <SectionTitle aside={canRefresh ? "READY" : timeLeft}>
          Канал закупок
        </SectionTitle>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <BuyTabSwitch active={activeTab} onChange={setActiveTab} />

          {canRefresh ? (
            <button
              type="button"
              onClick={handleRefreshShop}
              className="ui-button-primary w-full px-3 py-2 sm:w-auto"
            >
              Обновить рынок
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInstantRefresh}
              disabled={!instantRefreshAvailable}
              title={
                instantRefreshAvailable
                  ? "Мгновенно обновить витрину"
                  : "Недостаточно Кваксов для мгновенного обновления"
              }
              className={`${
                instantRefreshAvailable
                  ? "ui-button-primary"
                  : "ui-button-secondary"
              } w-full px-3 py-2 sm:w-auto`}
            >
              Обновить за {INSTANT_REFRESH_COST}{" "}
              <CurrencyIcon currency="tokens" className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-3xs uppercase tracking-[0.14em] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1 w-1 ${
                canRefresh
                  ? "bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  : "bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
              }`}
            />
            {canRefresh ? "Сброс доступен" : "Ожидание цикла"}
          </span>
          <span className="tabular-nums text-amber-200/80">
            {activeTab === "items" ? "CH-01" : "CH-02"}
          </span>
        </div>
      </HudPanel>

      {activeTab === "items" && (
        <section aria-label="Предметы на продажу">
          <SectionTitle aside={`${shopItems.length} SKU`}>Груз</SectionTitle>
          <div className="space-y-2">
            {shopItems.map((item) => (
              <BuyButton
                key={`${item.key}-${item.quantity}-${item.price}`}
                item={item}
              />
            ))}
          </div>
        </section>
      )}

      {activeTab === "toads" && (
        <section aria-label="Жабы на продажу">
          <SectionTitle aside={`${shopState.availableToads.length} BIO`}>
            Витрина жаб
          </SectionTitle>

          {allToadsPurchased ? (
            <HudPanel tone="amber" className="p-5 text-center">
              <p className="text-sm font-semibold text-amber-100">
                Все жабы раскуплены
              </p>
              <p className="mt-1 text-2xs leading-snug text-slate-400">
                Дождитесь обновления Торговой Капсулы или запустите платный
                сброс цикла.
              </p>
            </HudPanel>
          ) : (
            <div className="space-y-2">
              {visibleToads.map((toad, index) => (
                <ToadListCard
                  key={`${toad.id}-${index}`}
                  toad={toad as Toad}
                  variant="full"
                  actions={
                    <button
                      type="button"
                      aria-label={`Купить жабу «${
                        toad.name || "без имени"
                      }» за ${calculateBuyPrice(toad as Toad)}`}
                      onClick={() => handleBuyToad(toad as Toad)}
                      disabled={tokens < calculateBuyPrice(toad as Toad)}
                      className="ui-button-primary min-w-[72px] whitespace-nowrap px-3 py-1.5"
                    >
                      {calculateBuyPrice(toad as Toad)}{" "}
                      <CurrencyIcon currency="tokens" className="h-4 w-4" />
                    </button>
                  }
                />
              ))}

              {/* Индикатор загрузки для бесконечного скролла */}
              {hasMore && (
                <div
                  ref={loadMoreRef}
                  className="flex items-center justify-center gap-2 py-4"
                  key="load-more"
                >
                  <span
                    aria-hidden="true"
                    className="h-1 w-8 animate-pulse bg-cyan-300"
                  />
                  <span className="text-3xs uppercase tracking-[0.16em] text-slate-400">
                    Загрузка жаб
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default BuyTab;
