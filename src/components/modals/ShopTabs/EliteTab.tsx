import React, { useEffect, useState } from "react";
import { deleteToadsByIds, updateUser } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { Toad } from "../../../models/toad";
import { useToads } from "../../ToadContext";
import { CURRENCY_CONFIG } from "../../../utils/constants";
import { ToadGender } from "../../shared/ToadGender";
import {
  eliteOrders,
  getNewElite,
  getShopState,
  INSTANT_REFRESH_ELITE_COST,
  REFRESH_COOLDOWN,
  saveShopState,
  ShopState,
} from "../../../backend/shop-state";
import { useNotifications } from "../../../hooks/use-notification";
import { ToadAvatar } from "../../shared/ToadAvatar";

const refreshShop = (): ShopState => {
  const now = Date.now();
  const newState = getShopState();
  newState.eliteOrders = getNewElite();
  newState.lastRefreshElite = now;
  newState.nextRefreshElite = now + REFRESH_COOLDOWN * 8;
  return newState;
};

const EliteTab: React.FC = () => {
  const { allToads: activeToads, account } = useToads();
  const { playBuy } = useSoundEffects();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
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
        content: `Недостаточно астрокваксов! Нужно ${INSTANT_REFRESH_ELITE_COST}`,
      });
      return;
    }

    updateUser({ tokens: tokens - INSTANT_REFRESH_ELITE_COST });
    const newShopState = refreshShop();
    setShopState(newShopState);
    saveShopState(newShopState);
    addNotification({
      content: "Элитные заказы обновлены!",
      type: "success",
    });
  };

  const handleAcceptEliteOrder = (order: any) => {
    setSelectedOrder(order);
  };

  const handleSubmitEliteOrder = (order: string) => (toad: Toad) => {
    playBuy();
    deleteToadsByIds([toad.id]);
    updateUser({ astro_quax: astro_quax + selectedOrder.reward });

    const newShopState: ShopState = {
      ...shopState,
      eliteOrders: shopState.eliteOrders.filter((or) => or !== order),
    };

    setShopState(newShopState);
    saveShopState(newShopState);
    setSelectedOrder(null);
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
        content: "Рынок можно обновить только раз в 3 часа",
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
      <h3 className="text-white font-semibold mb-3 px-2 text-lg">
        Элитные заказы
      </h3>
      <div className="bg-gray-800 rounded-2xl py-4 px-2 border border-gray-700">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Обновление заказов:</span>
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
              Обновить
            </button>

            <button
              onClick={handleInstantRefresh}
              disabled={tokens < INSTANT_REFRESH_ELITE_COST}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tokens >= INSTANT_REFRESH_ELITE_COST
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {INSTANT_REFRESH_ELITE_COST} {CURRENCY_CONFIG.tokens.icon}
            </button>
          </div>
        </div>
      </div>

      {availableOrders.map((order) => (
        <div
          key={order.id}
          className={`rounded-2xl py-4 px-2 border ${
            order.canComplete
              ? "bg-purple-900/20 border-purple-500/50"
              : "bg-gray-800/50 border-gray-600/50"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex-1">
              <h4 className="text-white font-semibold text-base mb-2">
                {order.title}
              </h4>
              <p className="text-gray-300 text-sm mb-3">{order.description}</p>

              <div className="flex flex-col gap-2 text-sm text-gray-400 mb-3">
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

            <button
              onClick={() => handleAcceptEliteOrder(order)}
              disabled={!order.canComplete}
              className={`w-full py-3 rounded-xl text-base font-medium transition-colors ${
                order.canComplete
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {order.canComplete ? "Принять заказ" : "Недоступно"}
            </button>
          </div>
        </div>
      ))}
      {selectedOrder && (
        <EliteOrderTooltip
          order={selectedOrder}
          availableToads={selectedOrder.suitableToads}
          onSelectToad={handleSubmitEliteOrder(selectedOrder.id)}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default EliteTab;

interface EliteOrderTooltipProps {
  order: any;
  availableToads: Toad[];
  onSelectToad: (toad: Toad) => void;
  onClose: () => void;
}

const EliteOrderTooltip: React.FC<EliteOrderTooltipProps> = ({
  order,
  availableToads,
  onSelectToad,
  onClose,
}) => {
  const [selectedToadId, setSelectedToadId] = useState<number | null>(null);

  const handleSubmit = () => {
    if (selectedToadId) {
      const toad = availableToads.find((t) => t.id === selectedToadId);
      if (toad) {
        onSelectToad(toad);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl p-4 w-full max-w-xs border border-purple-500/40 shadow-lg">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Выбор жабы</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Информация о заказе */}
        <div className="mb-3">
          <h4 className="text-purple-400 font-medium text-xs mb-1">
            {order.title}
          </h4>
          <p className="text-gray-300 text-xs mb-2 line-clamp-2">
            {order.description}
          </p>
          <div className="text-green-400 text-sm font-semibold">
            Награда: {order.reward} {CURRENCY_CONFIG.astro_quax.icon}
          </div>
        </div>

        {/* Список жаб */}
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          <p className="text-gray-400 text-xs">Подходящие жабы:</p>
          {availableToads.map((toad) => (
            <div
              key={toad.id}
              onClick={() => setSelectedToadId(toad.id)}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                selectedToadId === toad.id
                  ? "bg-purple-900/30 border-purple-500"
                  : "bg-gray-700/50 border-gray-600 hover:border-purple-400/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <ToadAvatar toad={toad} size={8} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-white font-medium text-xs truncate">
                      {toad.name}
                    </span>
                    <ToadGender gender={toad.sex} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 text-xs text-gray-400">
                    <span>Редкость: {toad.genes.rarity.toFixed(1)}</span>
                  </div>
                </div>
                <div>{toad.scene_id ? "" : "📦"}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors text-xs font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedToadId}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors text-xs ${
              selectedToadId
                ? "bg-purple-600 hover:bg-purple-500 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};
