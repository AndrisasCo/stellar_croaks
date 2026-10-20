import React, { useEffect, useState } from "react";
import { deleteToadsByIds, updateUser } from "../../../../backend";
import { useSoundEffects } from "../../../../hooks/use-sound-effects";
import { Toad } from "../../../../models/Toad";
import { useToads } from "../../../ToadContext";
import { CURRENCY_CONFIG } from "../../../../utils/constants";
import {
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
  const { astro_quax = 0, tokens = 0 } = account || {};
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
    if (tokens < INSTANT_REFRESH_ELITE_COST) {
      addNotification({
        type: "warn",
        content: `Недостаточно Кваксов! Нужно ${INSTANT_REFRESH_ELITE_COST} ${CURRENCY_CONFIG.tokens.icon}`,
      });
      return;
    }

    updateUser({ tokens: tokens - INSTANT_REFRESH_ELITE_COST });
    const newShopState = refreshShop(INSTANT_REFRESH_ELITE_COOLDOWN);
    setShopState(newShopState);
    saveShopState(newShopState);
    addNotification({
      content: "Элитные заказы обновлены!",
      type: "success",
    });
  };

  const handleSubmitEliteOrder = (order: string) => (toad: Toad) => {
    if (isToadBusyOnExpedition(toad)) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    const selectedOrder = availableOrders.find((a) => a.id === order);
    if (!selectedOrder) {
      return;
    }
    playBuy();
    deleteToadsByIds([toad.id]);
    updateUser({ astro_quax: astro_quax + selectedOrder.reward });

    const newShopState: ShopState = {
      ...shopState,
      eliteOrders: shopState.eliteOrders.filter((or) => or !== order),
    };

    setShopState(newShopState);
    saveShopState(newShopState);
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
    addNotification({ content: "Элитные заказы обновлены!", type: "success" });
  };

  const availableOrders = getAvailableOrders();

  /** Жабы в походе не участвуют в заказах до возвращения и разбора добычи */
  const expeditionToadCount = activeToads.filter((toad) =>
    isToadBusyOnExpedition(toad),
  ).length;

  const canRefresh = Date.now() >= shopState.nextRefreshElite;

  return (
    <div className="space-y-4  pb-4">
      <div className="bg-color-main rounded-2xl py-4 px-2 border border-slate-700">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Обновление заказов:</span>
            <span className="text-white font-mono">{timeLeft}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefreshShop}
              disabled={!canRefresh}
              className="ui-button-primary flex-1"
            >
              Обновить
            </button>

            <button
              onClick={handleInstantRefresh}
              disabled={tokens < INSTANT_REFRESH_ELITE_COST}
              className="ui-button-secondary whitespace-nowrap"
            >
              {INSTANT_REFRESH_ELITE_COST}{" "}
              <CurrencyIcon currency="tokens" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <h3 className="text-white font-semibold mb-3 px-2 text-lg">
        Элитные заказы
      </h3>

      {expeditionToadCount > 0 && (
        <p className="mx-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-2xs leading-snug text-amber-200">
          🧭 В походе жаб: {expeditionToadCount}. Они не участвуют в заказах до
          возвращения и разбора добычи.
        </p>
      )}

      {availableOrders.map((order) => (
        <div
          key={order.id}
          className={`rounded-2xl py-4 px-2 border ${
            order.canComplete
              ? "border-cyan-400/40 bg-cyan-500/10"
              : "bg-color-main border-slate-600/50"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {order.colorSwatch && (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/40"
                    style={{ backgroundColor: order.colorSwatch }}
                  />
                )}
                <h4 className="text-white font-semibold text-base">
                  {order.title}
                </h4>
              </div>
              <p className="text-slate-200 text-sm mb-3">{order.description}</p>

              <div className="flex flex-col gap-2 text-sm text-slate-300 mb-3">
                <div className="flex justify-between">
                  <span>Подходит жаб:</span>
                  <span>{order.suitableToads.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Награда:</span>
                  <span className="text-green-400">
                    {order.reward}{" "}
                    <CurrencyIcon currency="astro_quax" className="h-4 w-4" />
                  </span>
                </div>
              </div>

              <div
                className={`text-sm ${
                  order.canComplete ? "text-green-400" : "text-slate-500"
                }`}
              >
                {order.canComplete
                  ? "✅ Есть подходящие жабы"
                  : "❌ Нет подходящих жаб"}
              </div>
            </div>

            <AcceptButton
              order={order}
              handleSubmitEliteOrder={handleSubmitEliteOrder}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
