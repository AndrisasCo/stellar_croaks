import { useState } from "react";
import { updateUser, deleteToadsByIds } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { Toad, calculateSellPrice } from "../../../models/Toad";
import { useToads } from "../../ToadContext";
import {
  getShopState,
  saveShopState,
  ShopState,
} from "../../../backend/shop-state";
import { ToadItem } from "../../shared/ToadItem";
import { CurrencyIcon } from "../../shared/CurrencyIcon";
import {
  completeAchivement,
  completeAchivementCounter,
} from "../../../backend/achivements-manager";
import { useFilters } from "../../../hooks/use-filters";
import { Filters } from "../../shared/Filters";
import { usePagination } from "../../../hooks/use-pagination";
import { useNotifications } from "../../../hooks/use-notification";
import {
  exchangeBiomassForTokens,
  getBiomassExchangeSpent,
  getBiomassExchangeTokens,
} from "../../../utils/production-manager";
import { isToadBusyOnExpedition } from "../../../utils/expedition-manager";

/** Сколько биомассы продаём: `null` — «вся имеющаяся», число — выбор ползунка */
type BiomassSellChoice = number | null;

/** Биомасса в строке: без хвостовых нулей (12, 12.5) */
const formatBiomass = (value: number): string =>
  String(Math.round(Math.max(0, value) * 100) / 100);

const SellTab: React.FC = () => {
  const { allToads: activeToads, account } = useToads();
  const { playCell } = useSoundEffects();
  const { addNotification } = useNotifications();
  const [selectedToads, setSelectedToads] = useState<number[]>([]);

  const { tokens = 0, biomass = 0 } = account || {};

  /**
   * Часть 3.7: биомасса обменивается ползунком «0 … вся имеющаяся», а не кнопкой
   * «продать всё». Выбор игрока держим отдельно (`null` = весь максимум), чтобы
   * ползунок сам шёл за растущей биомассой, пока его не тронули.
   */
  const [biomassChoice, setBiomassChoice] = useState<BiomassSellChoice>(null);
  const maxBiomass = Math.max(0, Math.floor(biomass));
  const sellBiomass = Math.min(biomassChoice ?? maxBiomass, maxBiomass);
  const sellTokens = getBiomassExchangeTokens(sellBiomass);
  /** Неполный Квакс не берётся: сколько биомассы уйдёт и сколько останется на счету */
  const spentBiomass = getBiomassExchangeSpent(sellTokens);
  const leftBiomass =
    Math.max(0, Math.round((biomass - spentBiomass) * 100) / 100);

  const handleExchangeBiomass = () => {
    const result = exchangeBiomassForTokens(sellBiomass);

    if (result.success) {
      playCell();
      setBiomassChoice(null);
    } else {
      addNotification({
        type: "warn",
        content: "Недостаточно биомассы для обмена",
      });
    }
  };

  // Часть 5: жабы в походе за Периметр продаются только после возвращения и разбора добычи
  const saleableToads = activeToads.filter(
    (toad) => !isToadBusyOnExpedition(toad),
  );
  const expeditionToadCount = activeToads.length - saleableToads.length;

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

    if (!toad || isToadBusyOnExpedition(toad)) {
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
      {/* Ферма: обмен биомассы на Кваксы (Часть 3.7) — ползунок решает, сколько продать */}
      <div className="bg-color-main rounded-xl p-3 border border-emerald-500/30 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-emerald-300 font-semibold text-sm truncate">
              🧪 Биомасса: {formatBiomass(biomass)}
            </div>
            <div className="text-slate-400 text-xs">
              Курс обмена: 2 биомассы = 1{" "}
              <CurrencyIcon currency="tokens" className="h-3 w-3" />
            </div>
          </div>
          <button
            onClick={handleExchangeBiomass}
            disabled={sellTokens <= 0}
            title={
              sellTokens > 0
                ? `Обменять ${formatBiomass(spentBiomass)} 🧪 на ${sellTokens} Кваксов`
                : "Нет биомассы для обмена"
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 ${
              sellTokens > 0
                ? "ui-button-primary"
                : "cursor-not-allowed border border-slate-500/30 bg-slate-600/30 text-slate-400"
            }`}
          >
            Обменять ({sellTokens}{" "}
            <CurrencyIcon currency="tokens" className="h-3 w-3" />)
          </button>
        </div>

        {/* Ползунок: 0 … вся имеющаяся биомасса, шаг — 1 🧪 */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max={maxBiomass}
            step="1"
            value={sellBiomass}
            onChange={(event) => setBiomassChoice(Number(event.target.value))}
            disabled={maxBiomass <= 0}
            aria-label="Сколько биомассы обменять на Кваксы"
            title="Ползунок: сколько биомассы отдать за Кваксы"
            className="flex-1 accent-emerald-500 h-2 rounded-lg bg-slate-600 disabled:opacity-50"
          />
          <span
            className={`w-20 shrink-0 text-right text-xs font-medium ${
              sellBiomass > 0 ? "text-emerald-200" : "text-slate-500"
            }`}
          >
            {sellBiomass} 🧪
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-2xs">
          <span className="text-slate-400">
            Обмен:{" "}
            <span className="text-emerald-300 font-semibold">
              {sellTokens}{" "}
              <CurrencyIcon currency="tokens" className="h-3 w-3" />
            </span>{" "}
            · останется {formatBiomass(leftBiomass)} 🧪
          </span>
          {sellBiomass < maxBiomass && (
            <button
              type="button"
              onClick={() => setBiomassChoice(null)}
              className="shrink-0 text-emerald-300 underline decoration-dotted hover:text-emerald-200"
            >
              вся биомасса
            </button>
          )}
        </div>
      </div>

      {/* Жабы в походе в списке продажи не участвуют — причина видна сразу */}
      {expeditionToadCount > 0 && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-2xs leading-snug text-amber-200">
          🧭 В походе жаб: {expeditionToadCount}. Они появятся в продаже после
          возвращения и разбора добычи.
        </p>
      )}

      {/* Панель фильтров */}
      <Filters
        toads={saleableToads}
        setSortDirection={setSortDirection}
        setSortBy={setSortBy}
        filterBy={filterBy}
        setFilterBy={setFilterBy}
        sortBy={sortBy}
        sortDirection={sortDirection}
        addPrice
      />

      {/* Панель выбора */}
      <div className="bg-color-main rounded-xl p-3 border border-slate-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-200 text-sm">Сумма:</span>
              <span className="text-yellow-200 font-bold text-sm">
                {totalSellPrice}{" "}
                <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {selectedFilteredToads.length > 0 && (
              <button
                onClick={handleSellToads}
                className="ui-button-primary px-3 py-1.5"
              >
                Продать ({selectedFilteredToads.length})
              </button>
            )}
            <button
              onClick={handleSelectAllFiltered}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                isAllFilteredSelected
                  ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-200"
                  : "border-slate-600/50 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
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
        <div className="bg-color-main backdrop-blur-sm rounded-xl p-6 border border-slate-600/20 text-center">
          <p className="text-slate-300 text-sm">
            {activeToads.length === 0
              ? "У вас пока нет жаб"
              : "Жабы не найдены"}
          </p>
          <p className="text-slate-500 text-xs mt-1">
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
                    className="ui-button-primary ml-2 min-w-[64px] whitespace-nowrap px-3 py-1.5"
                  >
                    {price}{" "}
                    <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />
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
              <div className="animate-pulse text-slate-300 text-sm">
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
