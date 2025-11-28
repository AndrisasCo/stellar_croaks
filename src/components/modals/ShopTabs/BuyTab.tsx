import { createToad, updateUser } from "../../../backend";
import { completeAchivement } from "../../../backend/achivements-manager";
import { getGameState } from "../../../backend/localStorage";
import {
  ShopState,
  getShopState,
  saveShopState,
  INSTANT_REFRESH_COST,
  REFRESH_COOLDOWN,
  getNewToads,
} from "../../../backend/shop-state";
import { useNotifications } from "../../../hooks/use-notification";

import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { calculateSellPrice, Toad } from "../../../models/toad";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../../utils/constants";
import { useToads } from "../../ToadContext";
import { ToadItem } from "../../shared/ToadItem";
import { useState, useEffect } from "react";

const refreshShop = (): ShopState => {
  const now = Date.now();
  const newState = getShopState();
  newState.availableToads = getNewToads();
  newState.availableToads = getNewToads();
  newState.items = { lootbox: 1 };
  newState.lastRefresh = now;
  newState.nextRefresh = now + REFRESH_COOLDOWN;
  return newState;
};

const BuyTab: React.FC = () => {
  const { currentScene, account } = useToads();
  const { playBuy } = useSoundEffects();
  const { tokens = 0, astro_quax = 0, storage = { food: 0 } } = account || {};
  const { addNotification } = useNotifications();
  const [shopState, setShopState] = useState<ShopState>(getShopState());
  const [timeLeft, setTimeLeft] = useState<string>("");

  const FOOD_PRICE = 10;

  // Таймер обратного отсчета
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const timeRemaining = shopState.nextRefresh - now;

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
  }, [shopState.nextRefresh]);

  const handleBuyToad = async (toad: Toad) => {
    playBuy();
    completeAchivement("buy-toad");

    const allToadsOnScene =
      getGameState().toads.filter((t) => t.scene_id === currentScene.id)
        .length + 1;

    let scene_id: number | null = currentScene?.id;

    if (currentScene.capacity < allToadsOnScene) {
      scene_id = null;
      addNotification({
        type: "warn",
        content:
          "Превышен лимит жаб на вольер, новая жаба была помещена на склад.",
      });
    }

    createToad({ ...toad, scene_id });
    updateUser({ tokens: tokens - calculateBuyPrice(toad) });

    // Помечаем жабу как купленную
    const newShopState: ShopState = {
      ...shopState,
      availableToads: shopState.availableToads.filter((t) => t.id !== toad.id),
    };

    setShopState(newShopState);
    saveShopState(newShopState);
  };

  const handleBuyItem =
    (item: Record<string, number>, price: Record<string, number>) => () => {
      const currency = Object.keys(price)[0];
      const itemName = Object.keys(item)[0];

      if ((account as any)[currency] < price[currency]) {
        return;
      }

      if (itemName === "lootbox" && shopState.items.lootbox === 0) {
        return;
      }

      playBuy();
      updateUser({
        [currency]: (account as any)[currency] - price[currency],
        storage: {
          ...storage,
          [itemName]: ((storage as any)?.[itemName] || 0) + item[itemName],
        },
      });

      if (itemName === "food") {
        completeAchivement("buy-food");
      }

      if (itemName === "lootbox") {
        // completeAchivement("buy-lootbox");
        addNotification({
          content: "Лутбокс куплен! Откройте склад и активируйте его!",
          type: "success",
        });

        const newShopState = { ...shopState };
        newShopState.items.lootbox = newShopState.items.lootbox - 1;

        setShopState(newShopState);
        saveShopState(newShopState);
      }
    };

  const calculateBuyPrice = (toad: Toad) =>
    Math.ceil(calculateSellPrice(toad) * 2.5);

  const handleRefreshShop = () => {
    const now = Date.now();
    if (now < shopState.nextRefresh) {
      addNotification({
        type: "warn",
        content: "Рынок можно обновить только раз в 3 часа",
      });
      return;
    }

    const newShopState = refreshShop();
    setShopState(newShopState);
    saveShopState(newShopState);
    addNotification({ content: "Рынок обновлен!", type: "success" });
  };

  const handleInstantRefresh = () => {
    if (tokens < INSTANT_REFRESH_COST) {
      addNotification({
        type: "warn",
        content: `Недостаточно кваксов! Нужно ${INSTANT_REFRESH_COST}`,
      });
      return;
    }

    updateUser({ tokens: tokens - INSTANT_REFRESH_COST });
    const newShopState = refreshShop();
    setShopState(newShopState);
    saveShopState(newShopState);
    addNotification({
      content: "Рынок мгновенно обновлен!",
      type: "success",
    });
  };

  const canRefresh = Date.now() >= shopState.nextRefresh;
  const allToadsPurchased = shopState.availableToads.length === 0;

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

      {/* Корм */}
      <div>
        <h3 className="text-white font-semibold mb-3 px-2 text-lg">Корм</h3>

        {/* Вариант 1: 10 корма */}
        <div className="bg-gray-800 rounded-2xl py-4 px-2 border border-gray-700 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-green-400 bg-gray-900">
                <span className="text-xl">🍎</span>
              </div>
              <div>
                <p className="text-white font-medium text-base">Жабий корм</p>
                <p className="text-gray-400 text-sm mt-1">х10 порций</p>
                <p className="text-green-400 text-xs mt-1">∞ доступно</p>
              </div>
            </div>
            <button
              onClick={handleBuyItem({ food: 10 }, { tokens: FOOD_PRICE })}
              disabled={tokens < FOOD_PRICE}
              className={`px-3 min-w-[64px] py-1.5 rounded-lg bg-gray-600 text-sm font-medium text-white whitespace-nowrap transition-colors ${
                tokens >= FOOD_PRICE &&
                "bg-gradient-to-r from-green-600 to-emerald-800 text-white"
              }`}
            >
              {FOOD_PRICE} {CURRENCY_CONFIG.tokens.icon}
            </button>
          </div>
        </div>

        {/* Вариант 2: 100 корма со скидкой */}
        <div className="bg-gray-800 rounded-2xl py-4 px-2 border border-gray-700 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-blue-400 bg-gray-900">
                <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-blue-400 bg-gray-900 relative">
                  {/* Наслоение иконок корма */}
                  <span className="text-xl absolute transform  -translate-y-1 -translate-x-1">
                    🍎
                  </span>
                  <span className="text-xl absolute ">🍎</span>
                  <span className="text-xl absolute transform  translate-y-1 translate-x-1 ">
                    🍎
                  </span>
                </div>
              </div>
              <div>
                <p className="text-white font-medium text-base">
                  Большая упаковка корма
                </p>
                <p className="text-gray-400 text-sm mt-1">х100 порций</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-red-400 text-xs line-through">
                    100 {CURRENCY_CONFIG.tokens.icon}
                  </span>
                  <span className="text-green-400 text-xs font-medium">
                    -10%
                  </span>
                </div>
                <p className="text-green-400 text-xs mt-1">∞ доступно</p>
              </div>
            </div>
            <button
              onClick={handleBuyItem({ food: 100 }, { tokens: 90 })}
              disabled={tokens < 90}
              className={`px-3 min-w-[64px] py-1.5 rounded-lg bg-gray-600 text-sm font-medium text-white whitespace-nowrap transition-colors ${
                tokens >= 90 &&
                "bg-gradient-to-r from-blue-600 to-blue-800 text-white"
              }`}
            >
              90 {CURRENCY_CONFIG.tokens.icon}
            </button>
          </div>
        </div>

        {/* Вариант 3: Лутбокс */}
        <div className="bg-gray-800 rounded-2xl py-4 px-2 border border-purple-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-purple-400 bg-gray-900">
                <span className="text-xl">🎁</span>
              </div>
              <div>
                <p className="text-white font-medium text-base">
                  Таинственный лутбокс
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Случайная жаба или предмет
                </p>
                <p className="text-yellow-400 text-xs mt-1">
                  Редкие и эксклюзивные награды!
                </p>
                <p
                  className={`text-xs mt-1 ${
                    shopState.items.lootbox === 0
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  {shopState.items.lootbox === 0
                    ? "❌ Куплено"
                    : "✅ 1 доступно"}
                </p>
              </div>
            </div>
            <button
              onClick={handleBuyItem({ lootbox: 1 }, { astro_quax: 50 })}
              disabled={astro_quax < 50 || shopState.items.lootbox === 0}
              className={`px-3 min-w-[64px] py-1.5 rounded-lg bg-gray-600 text-sm font-medium text-white whitespace-nowrap transition-colors ${
                astro_quax >= 50 &&
                shopState.items.lootbox &&
                "bg-gradient-to-r from-purple-600 to-purple-800 text-white"
              }`}
            >
              50 {CURRENCY_CONFIG.astro_quax.icon}
            </button>
          </div>
        </div>
      </div>

      {/* Доступные жабы */}
      <div>
        <h3 className="text-white px-2 font-semibold mb-3 text-lg">
          Доступные жабы
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
            {shopState.availableToads.map((toad, index) => {
              return (
                <ToadItem
                  toad={toad as Toad}
                  key={index}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyTab;
