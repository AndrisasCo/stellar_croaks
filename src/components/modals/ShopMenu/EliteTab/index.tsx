import React, { useEffect, useState } from "react";
import { getGameState } from "../../../../backend/localStorage";
import { deleteToadsByIds, updateUser } from "../../../../backend";
import { useSoundEffects } from "../../../../hooks/use-sound-effects";
import { Toad } from "../../../../models/Toad";
import { useToads } from "../../../ToadContext";
import { CURRENCY_CONFIG } from "../../../../utils/constants";
import {
  claimEliteOrder,
  getEliteOrderById,
  getNewElite,
  getShopState,
  ELITE_REFRESH_COOLDOWN,
  INSTANT_REFRESH_ELITE_COOLDOWN,
  INSTANT_REFRESH_ELITE_COST,
  saveShopState,
  ShopState,
} from "../../../../backend/shop-state";
import { useNotifications } from "../../../../hooks/use-notification";
import { CurrencyIcon } from "../../../shared/CurrencyIcon";
import {
  DataCell,
  DataGrid,
  HudPanel,
  SectionTitle,
} from "../../../shared/DataGrid";
import { AcceptButton } from "./AcceptButton";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../../../utils/expedition-manager";

/** Новые заказы на витрину: платное обновление даёт короткий кулдаун вместо суток */
const refreshShop = (cooldownMs = ELITE_REFRESH_COOLDOWN): ShopState => {
  const now = Date.now();
  const newState = getShopState();
  newState.eliteOrders = getNewElite();
  newState.lastRefreshElite = now;
  newState.nextRefreshElite = now + cooldownMs;
  return newState;
};

export const EliteTab: React.FC = () => {
  const { allToads: activeToads, account } = useToads();
  const { playBuy } = useSoundEffects();
  const { tokens = 0 } = account || {};
  const [shopState, setShopState] = useState<ShopState>(getShopState());
  const [timeLeft, setTimeLeft] = useState<string>("");

  const { addNotification } = useNotifications();

  // Таймер обратного отсчета
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const timeRemaining = shopState.nextRefreshElite - now;

      if (timeRemaining <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor(
        (timeRemaining % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [shopState.nextRefreshElite]);

  const handleInstantRefresh = () => {
    // Баланс читаем из сейва: вторая вкладка могла потратить Кваксы, а рендер
    // всё ещё показывает старое значение.
    const currentTokens = getGameState().user.tokens ?? 0;

    if (currentTokens < INSTANT_REFRESH_ELITE_COST) {
      addNotification({
        type: "warn",
        content: `Недостаточно Кваксов! Нужно ${INSTANT_REFRESH_ELITE_COST} ${CURRENCY_CONFIG.tokens.icon}`,
      });
      return;
    }

    updateUser({ tokens: currentTokens - INSTANT_REFRESH_ELITE_COST });
    const newShopState = refreshShop(INSTANT_REFRESH_ELITE_COOLDOWN);
    setShopState(newShopState);
    saveShopState(newShopState);
  };

  const handleSubmitEliteOrder = (order: string) => (toad: Toad) => {
    // Метаданные заказа восстанавливаются из id, а не из закешированного рендера:
    // после обновления витрины или из второй вкладки список в замыкании устарел.
    const selectedOrder = getEliteOrderById(order);
    if (!selectedOrder) {
      return;
    }

    // Жабу тоже перечитываем из сейва: вторая вкладка могла уже сдать её в другой
    // заказ, и оплата за «призрак» была бы бесплатной наградой.
    const freshToad = getGameState().toads.find((item) => item.id === toad.id);
    if (!freshToad) {
      return;
    }
    if (isToadBusyOnExpedition(freshToad)) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    // Списываем заказ первым: повторный клик/вкладка не должны получить награду
    // за уже сданный заказ. Если оплата ниже не случится, игрок потеряет заказ,
    // но не получит бесконечный источник Астро-кваксов.
    if (!claimEliteOrder(order)) {
      return;
    }

    setShopState(getShopState());
    playBuy();
    deleteToadsByIds([toad.id]);
    // Баланс читаем из сейва, а не из рендера: два заказа подряд до перерисовки
    // иначе посчитали бы награду от старого значения и потеряли предыдущую.
    const currentAstro = getGameState().user.astro_quax ?? 0;
    updateUser({ astro_quax: currentAstro + selectedOrder.reward });
  };

  const getAvailableOrders = () => {
    // Set — защита от дублей в старом/повреждённом сейве: React-ключи заказов
    // должны оставаться уникальными. Неизвестные id (например, из будущей версии
    // генератора) спокойно пропускаем, а не роняем всю витрину.
    return Array.from(new Set(shopState.eliteOrders)).flatMap((orderId) => {
      const order = getEliteOrderById(orderId);
      if (!order) {
        return [];
      }

      const suitableToads = activeToads.filter(
        (toad) => !isToadBusyOnExpedition(toad) && order.requirement(toad),
      );
      return [
        {
          ...order,
          canComplete: suitableToads.length > 0,
          suitableToads,
        },
      ];
    });
  };

  const handleRefreshShop = () => {
    const now = Date.now();
    if (now < shopState.nextRefreshElite) {
      addNotification({
        type: "warn",
        content: "Витрина заказов обновляется раз в сутки",
      });
      return;
    }

    const newShopState = refreshShop();
    setShopState(newShopState);
    saveShopState(newShopState);
  };

  const availableOrders = getAvailableOrders();

  /** Жабы в походе не участвуют в заказах до возвращения и разбора добычи */
  const expeditionToadCount = activeToads.filter((toad) =>
    isToadBusyOnExpedition(toad),
  ).length;

  const canRefresh = Date.now() >= shopState.nextRefreshElite;

  return (
    <div className="space-y-3 pb-4">
      <HudPanel tone="amber" className="p-2.5">
        <SectionTitle aside={canRefresh ? "READY" : timeLeft}>
          Канал заказов
        </SectionTitle>

        <DataGrid columns={2} tone="amber">
          <DataCell
            label="Контрактов"
            value={availableOrders.length}
            accent="bg-amber-300"
          />
          <DataCell
            label="Баланс"
            color="text-amber-100"
            accent="bg-cyan-300"
            value={
              <span className="inline-flex items-center gap-1.5">
                {tokens}
                <CurrencyIcon currency="tokens" className="h-4 w-4" />
              </span>
            }
          />
        </DataGrid>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="ui-kicker">Следующий цикл</div>
            <div className="font-mono text-sm tabular-nums text-amber-100">
              {timeLeft}
            </div>
          </div>

          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={handleRefreshShop}
              disabled={!canRefresh}
              className="ui-button-primary px-3 py-1.5 text-3xs"
            >
              Обновить
            </button>

            <button
              type="button"
              onClick={handleInstantRefresh}
              disabled={tokens < INSTANT_REFRESH_ELITE_COST}
              className="ui-button-secondary whitespace-nowrap px-3 py-1.5 text-3xs"
            >
              {INSTANT_REFRESH_ELITE_COST}{" "}
              <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </HudPanel>

      <SectionTitle aside={`${availableOrders.length} CONTRACTS`}>
        Элитные заказы
      </SectionTitle>

      {expeditionToadCount > 0 && (
        <HudPanel tone="amber" className="px-3 py-2">
          <p className="flex items-start gap-2 text-2xs leading-snug text-amber-200">
            <span
              aria-hidden="true"
              className="mt-1.5 h-1 w-1 shrink-0 bg-amber-300"
            />
            <span>
              В походе жаб: {expeditionToadCount}. Они не участвуют в заказах
              до возвращения и разбора добычи.
            </span>
          </p>
        </HudPanel>
      )}

      {availableOrders.map((order) => (
        <HudPanel
          key={order.id}
          tone={order.canComplete ? "emerald" : "cyan"}
          className="p-2.5"
        >
          <div className="flex items-start gap-2.5">
            {order.colorSwatch && (
              <span
                aria-hidden="true"
                className="mt-1 h-3.5 w-3.5 shrink-0 border border-white/40 shadow-[0_0_10px_currentColor]"
                style={{
                  backgroundColor: order.colorSwatch,
                  color: order.colorSwatch,
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <h4 className="min-w-0 truncate text-sm font-semibold text-white">
                  {order.title}
                </h4>
                <span
                  className={`shrink-0 text-3xs font-semibold uppercase tracking-[0.14em] ${
                    order.canComplete ? "text-emerald-300" : "text-slate-500"
                  }`}
                >
                  {order.canComplete ? "READY" : "LOCKED"}
                </span>
              </div>
              <p className="mt-1 text-2xs leading-snug text-slate-300">
                {order.description}
              </p>
            </div>
          </div>

          <DataGrid columns={2} className="mt-2">
            <DataCell
              label="Подходит жаб"
              value={order.suitableToads.length}
              color={order.canComplete ? "text-emerald-200" : "text-slate-300"}
            />
            <DataCell
              label="Награда"
              color="text-violet-200"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {order.reward}
                  <CurrencyIcon
                    currency="astro_quax"
                    className="h-3.5 w-3.5"
                  />
                </span>
              }
            />
          </DataGrid>

          <div
            className={`mt-2 flex items-center gap-1.5 text-3xs uppercase tracking-[0.12em] ${
              order.canComplete ? "text-emerald-300" : "text-slate-500"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1 w-1 ${
                order.canComplete
                  ? "bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  : "bg-slate-600"
              }`}
            />
            {order.canComplete
              ? "Есть подходящие жабы"
              : "Нет подходящих жаб"}
          </div>

          <div className="mt-2">
            <AcceptButton
              order={order}
              handleSubmitEliteOrder={handleSubmitEliteOrder}
            />
          </div>
        </HudPanel>
      ))}
    </div>
  );
};
