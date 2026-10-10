import React, { useEffect, useState } from "react";
import { deleteToadsByIds, updateUser } from "../../../../backend";
import { useSoundEffects } from "../../../../hooks/use-sound-effects";
import { Toad } from "../../../../models/Toad";
import { useToads } from "../../../ToadContext";
import { CURRENCY_CONFIG } from "../../../../utils/constants";
import {
  eliteOrders,
  getNewElite,
  getShopState,
  ELITE_REFRESH_COOLDOWN,
  INSTANT_REFRESH_ELITE_COOLDOWN,
  INSTANT_REFRESH_ELITE_COST,
  saveShopState,
  ShopState,
} from "../../../../backend/shop-state";
import { useNotifications } from "../../../../hooks/use-notification";
import { AcceptButton } from "./AcceptButton";

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
    return eliteOrders
      .filter((oreder) => shopState.eliteOrders.includes(oreder.id))
      .map((order) => {
        const suitableToads = activeToads.filter(order.requirement);
        return {
          ...order,
          canComplete: suitableToads.length > 0,
          suitableToads,
        };
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

  const canRefresh = Date.now() >= shopState.nextRefreshElite;

  return (
    <div className="space-y-4  pb-4">
      <div className="bg-color-main rounded-2xl py-4 px-2 border border-gray-700">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Обновление заказов:</span>
            <span className="text-white font-mono">{timeLeft}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefreshShop}
              disabled={!canRefresh}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                canRefresh
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-gray-600 text-gray-300 cursor-not-allowed"
              }`}
            >
              Обновить
            </button>

            <button
              onClick={handleInstantRefresh}
              disabled={tokens < INSTANT_REFRESH_ELITE_COST}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tokens >= INSTANT_REFRESH_ELITE_COST
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-gray-600 text-gray-300 cursor-not-allowed"
              }`}
            >
              {INSTANT_REFRESH_ELITE_COST} {CURRENCY_CONFIG.tokens.icon}
            </button>
          </div>
        </div>
      </div>

      <h3 className="text-white font-semibold mb-3 px-2 text-lg">
        Элитные заказы
      </h3>

      {availableOrders.map((order) => (
        <div
          key={order.id}
          className={`rounded-2xl py-4 px-2 border ${
            order.canComplete
              ? "bg-purple-900/20 border-purple-500/50"
              : "bg-color-main border-gray-600/50"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex-1">
              <h4 className="text-white font-semibold text-base mb-2">
                {order.title}
              </h4>
              <p className="text-gray-200 text-sm mb-3">{order.description}</p>

              <div className="flex flex-col gap-2 text-sm text-gray-300 mb-3">
                <div className="flex justify-between">
                  <span>Подходит жаб:</span>
                  <span>{order.suitableToads.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Награда:</span>
                  <span className="text-green-400">
                    {order.reward} {CURRENCY_CONFIG.astro_quax.icon}
                  </span>
                </div>
              </div>

              <div
                className={`text-sm ${
                  order.canComplete ? "text-green-400" : "text-gray-500"
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
