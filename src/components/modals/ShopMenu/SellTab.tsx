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
import { CurrencyIcon } from "../../shared/CurrencyIcon";
import { HudPanel, SectionTitle } from "../../shared/DataGrid";
import { ToadListCard } from "../../shared/ToadListCard";
import { recordQuestEvent } from "../../../backend/quests-manager";
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
import { itemsFull, Items } from "../../../models/user";
import {
  GENE_DUST_SELL_PRICE,
  getGeneDustSellTokens,
  sellGeneDust,
} from "../../../utils/gene-dust";

/** Сколько биомассы продаём: `null` — «вся имеющаяся», число — выбор ползунка */
type BiomassSellChoice = number | null;

/** Биомасса в строке: без хвостовых нулей (12, 12.5) */
const formatBiomass = (value: number): string =>
  String(Math.round(Math.max(0, value) * 100) / 100);

/** Иконка генной пыли — та же, что на складе и в добыче похода (не эмодзи). */
const GENE_DUST_ICON = itemsFull[Items.geneDust].icon;

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

  /**
   * Генная пыль — второй товар вкладки «Продать». Курс фиксированный:
   * 1 пылинка = 5 Кваксов. Ползунок отдаёт часть запаса, остаток остаётся
   * на складе для коллайдера.
   */
  const dustAvailable = Math.max(
    0,
    Math.floor(account?.storage?.[Items.geneDust] ?? 0),
  );
  const [dustChoice, setDustChoice] = useState<number | null>(null);
  const sellDust = Math.min(dustChoice ?? dustAvailable, dustAvailable);
  const geneDustTokens = getGeneDustSellTokens(sellDust);
  const leftDust = dustAvailable - sellDust;

  const handleSellGeneDust = () => {
    const result = sellGeneDust(sellDust);

    if (result.success) {
      playCell();
      setDustChoice(null);
    } else {
      addNotification({
        type: "warn",
        content: "Генной пыли нет на складе",
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
    recordQuestEvent("toad_sold", selectedFilteredToads.length);

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
    recordQuestEvent("toad_sold", 1);

    playCell();
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
      <HudPanel tone="emerald" className="flex flex-col gap-2 p-2.5">
        <SectionTitle aside={`${formatBiomass(biomass)} UNIT`}>
          Биомасса
        </SectionTitle>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-200">
              <span aria-hidden="true" className="text-base leading-none">
                🧪
              </span>
              <span className="truncate">{formatBiomass(biomass)} в резерве</span>
            </div>
            <div className="mt-0.5 text-2xs text-slate-400">
              Курс обмена: 2 биомассы = 1{" "}
              <CurrencyIcon currency="tokens" className="h-3 w-3" />
            </div>
          </div>
          <button
            type="button"
            onClick={handleExchangeBiomass}
            disabled={sellTokens <= 0}
            title={
              sellTokens > 0
                ? `Обменять ${formatBiomass(spentBiomass)} 🧪 на ${sellTokens} Кваксов`
                : "Нет биомассы для обмена"
            }
            className={`${
              sellTokens > 0 ? "ui-button-primary" : "ui-button-secondary"
            } shrink-0 px-3 py-1.5 text-3xs`}
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
            className="ui-range flex-1 accent-emerald-500"
          />
          <span
            className={`w-20 shrink-0 text-right text-xs font-medium tabular-nums ${
              sellBiomass > 0 ? "text-emerald-200" : "text-slate-500"
            }`}
          >
            {sellBiomass} 🧪
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-2xs">
          <span className="text-slate-400">
            Обмен:{" "}
            <span className="font-semibold text-emerald-300">
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
      </HudPanel>

      {/* Генная пыль: фиксированный курс 1 шт = 5 Кваксов, ползунок отдаёт часть запаса */}
      <HudPanel tone="violet" className="flex flex-col gap-2 p-2.5">
        <SectionTitle aside={`${dustAvailable} UNIT`}>
          Генная пыль
        </SectionTitle>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-fuchsia-200">
              <img
                src={GENE_DUST_ICON}
                alt=""
                draggable={false}
                className="h-4 w-4 shrink-0 select-none object-contain"
              />
              <span className="truncate">{dustAvailable} на складе</span>
            </div>
            <div className="mt-0.5 text-2xs text-slate-400">
              Курс продажи: 1 шт = {GENE_DUST_SELL_PRICE}{" "}
              <CurrencyIcon currency="tokens" className="h-3 w-3" />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSellGeneDust}
            disabled={geneDustTokens <= 0}
            title={
              geneDustTokens > 0
                ? `Продать ${sellDust} шт. за ${geneDustTokens} Кваксов`
                : "Нет генной пыли для продажи"
            }
            className={`${
              geneDustTokens > 0
                ? "ui-button-primary"
                : "ui-button-secondary"
            } shrink-0 px-3 py-1.5 text-3xs`}
          >
            Продать ({geneDustTokens}{" "}
            <CurrencyIcon currency="tokens" className="h-3 w-3" />)
          </button>
        </div>

        {/* Ползунок: 0 … вся генная пыль на складе */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max={dustAvailable}
            step="1"
            value={sellDust}
            onChange={(event) => setDustChoice(Number(event.target.value))}
            disabled={dustAvailable <= 0}
            aria-label="Сколько генной пыли продать"
            title="Ползунок: сколько генной пыли отдать за Кваксы"
            className="ui-range flex-1 accent-fuchsia-500"
          />
          <span
            className={`inline-flex w-20 shrink-0 items-center justify-end gap-1 text-xs font-medium tabular-nums ${
              sellDust > 0 ? "text-fuchsia-200" : "text-slate-500"
            }`}
          >
            {sellDust}
            <img
              src={GENE_DUST_ICON}
              alt=""
              draggable={false}
              className="h-3.5 w-3.5 shrink-0 select-none object-contain"
            />
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-2xs">
          <span className="text-slate-400">
            Выручка:{" "}
            <span className="text-fuchsia-300 font-semibold">
              {geneDustTokens}{" "}
              <CurrencyIcon currency="tokens" className="h-3 w-3" />
            </span>{" "}
            · останется {leftDust}{" "}
            <img
              src={GENE_DUST_ICON}
              alt=""
              draggable={false}
              className="inline-block h-3 w-3 shrink-0 select-none object-contain align-[-0.15em]"
            />
          </span>
          {sellDust < dustAvailable && (
            <button
              type="button"
              onClick={() => setDustChoice(null)}
              className="shrink-0 text-fuchsia-300 underline decoration-dotted hover:text-fuchsia-200"
            >
              вся пыль
            </button>
          )}
        </div>

        {dustAvailable === 0 && (
          <p className="ui-hint">
            Генная пыль приходит из походов за Периметр. В коллайдере она
            повышает качество гибрида, а здесь её можно продать.
          </p>
        )}
      </HudPanel>

      {/* Жабы в походе в списке продажи не участвуют — причина видна сразу */}
      {expeditionToadCount > 0 && (
        <HudPanel tone="amber" className="px-3 py-2">
          <p className="flex items-start gap-2 text-2xs leading-snug text-amber-200">
            <span
              aria-hidden="true"
              className="mt-1.5 h-1 w-1 shrink-0 bg-amber-300"
            />
            <span>
              В походе жаб: {expeditionToadCount}. Они появятся в продаже после
              возвращения и разбора добычи.
            </span>
          </p>
        </HudPanel>
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

      {/* Панель выбора: сумма, количество и групповые действия */}
      <HudPanel tone="cyan" className="p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div>
              <div className="ui-kicker">К оплате</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-bold tabular-nums text-yellow-200">
                {totalSellPrice}{" "}
                <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />
              </div>
            </div>
            <span className="h-8 w-px bg-cyan-400/20" aria-hidden="true" />
            <div>
              <div className="ui-kicker">Выбрано</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-slate-200">
                {selectedFilteredToads.length}
                <span className="text-slate-500">
                  {" "}
                  / {filteredToads.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {selectedFilteredToads.length > 0 && (
              <button
                type="button"
                onClick={handleSellToads}
                className="ui-button-primary px-3 py-1.5"
              >
                Продать ({selectedFilteredToads.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              aria-pressed={isAllFilteredSelected}
              className={`flex h-9 w-9 items-center justify-center border text-sm transition-colors ${
                isAllFilteredSelected
                  ? "border-cyan-300/60 bg-cyan-500/20 text-cyan-200"
                  : "border-slate-600/50 bg-slate-800/60 text-slate-300 hover:border-cyan-400/40 hover:bg-slate-700/60"
              }`}
              title={isAllFilteredSelected ? "Снять выделение" : "Выбрать все"}
            >
              {isAllFilteredSelected ? "✕" : "▼"}
            </button>
          </div>
        </div>
      </HudPanel>

      {/* Список жаб */}
      {filteredToads.length === 0 ? (
        <HudPanel tone="cyan" className="p-6 text-center">
          <p className="text-sm text-slate-300">
            {activeToads.length === 0
              ? "У вас пока нет жаб"
              : "Жабы не найдены"}
          </p>
          <p className="mt-1 text-2xs text-slate-500">
            {activeToads.length === 0
              ? "Приобретите жаб на рынке"
              : "Измените фильтры для отображения"}
          </p>
        </HudPanel>
      ) : (
        <div className="space-y-2">
          {visibleToads.map((toad) => {
            const price = calculateSellPrice(toad);
            const isSelected = selectedToads.includes(toad.id);

            return (
              <ToadListCard
                key={toad.id}
                toad={toad}
                variant="full"
                selected={isSelected}
                onOpen={() => {
                  if (isSelected) {
                    setSelectedToads(
                      selectedToads.filter((id) => id !== toad.id),
                    );
                  } else {
                    setSelectedToads([...selectedToads, toad.id]);
                  }
                }}
                actions={
                  <button
                    type="button"
                    aria-label={`Продать жабу «${
                      toad.name || "без имени"
                    }» за ${price}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSellSingleToad(toad.id);
                    }}
                    className="ui-button-primary ml-2 min-w-[72px] whitespace-nowrap px-3 py-1.5"
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
    </div>
  );
};

export default SellTab;
