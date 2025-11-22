import { createToad, updateUser } from "../../../backend";
import { getGameState } from "../../../backend/localStorage";
import { useNotifications } from "../../../hooks/use-notification";

import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { calculateSellPrice, Toad } from "../../../models/toad";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../../utils/constants";
import { randomizeToadCharacteristics } from "../../../utils/randomize-toad-characteristics";
import { useToads } from "../../ToadContext";
import { ToadItem } from "./ToadItem";
import { useState, useEffect } from "react";

// Интерфейс для состояния магазина
interface ShopState {
  availableToads: Partial<Toad>[];
  purchasedToads: string[]; // ID или названия купленных жаб
  lastRefresh: number; // timestamp последнего обновления
  nextRefresh: number; // timestamp следующего обновления
}

// Список всех возможных жаб для магазина
const ALL_TOADS: Partial<Toad>[] = [
  {
    name: "Зеленая жаба",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 30,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#6B8C42"],
      pattern: "smooth",
      weight: 18,
      speed: 0.4,
      rarity: 1.0,
      hungerRate: 1.0,
      fertility: 1.0,
      personality: null,
    },
  },
  {
    name: "Коричневая жаба",
    type: "common",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 25,
    },
    pregnancy: null,
    genes: {
      colors: ["#8B4513", "#A0522D"],
      pattern: "smooth",
      weight: 15,
      speed: 0.35,
      rarity: 1.1,
      hungerRate: 0.9,
      fertility: 1.2,
      personality: null,
    },
  },
  {
    name: "Пятнистая жаба",
    type: "common",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 35,
    },
    pregnancy: null,
    genes: {
      colors: ["#5D8C59", "#4A4A4A"],
      pattern: "spotted",
      weight: 17,
      speed: 0.45,
      rarity: 1.2,
      hungerRate: 1.1,
      fertility: 1.3,
      personality: null,
    },
  },
  {
    name: "Лесная жаба",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "toadpole",
    scene_id: null,
    state: {
      hunger: 28,
    },
    pregnancy: null,
    genes: {
      colors: ["#4A7C59", "#5D8C42"],
      pattern: "smooth",
      weight: 20,
      speed: 0.38,
      rarity: 1.05,
      hungerRate: 0.8,
      fertility: 1.1,
      personality: null,
    },
  },
  {
    name: "Болотная жаба",
    type: "common",
    generation: 1,
    sex: "male",
    stage: "toadpole",
    scene_id: null,
    state: {
      hunger: 32,
    },
    pregnancy: null,
    genes: {
      colors: ["#6B8C59", "#4A7C42"],
      pattern: "smooth",
      weight: 11,
      speed: 0.42,
      rarity: 1.08,
      hungerRate: 1.2,
      fertility: 0.9,
      personality: null,
    },
  },
  {
    name: "Золотая жаба",
    type: "rare",
    generation: 1,
    sex: "female",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 20,
    },
    pregnancy: null,
    genes: {
      colors: ["#FFD700", "#FFEC8B"],
      pattern: "smooth",
      weight: 12,
      speed: 0.5,
      rarity: 2.0,
      hungerRate: 0.7,
      fertility: 1.5,
      personality: null,
    },
  },
  {
    name: "Хрустальная жаба",
    type: "epic",
    generation: 1,
    sex: "male",
    stage: "adult",
    scene_id: null,
    state: {
      hunger: 15,
    },
    pregnancy: null,
    genes: {
      colors: ["#E6E6FA", "#F0F8FF"],
      pattern: "crystalline",
      weight: 10,
      speed: 0.6,
      rarity: 3.0,
      hungerRate: 0.5,
      fertility: 2.0,
      personality: null,
    },
  },
];

// Ключ для localStorage
const SHOP_STATE_KEY = "toad_shop_state";
const REFRESH_COOLDOWN = 3 * 60 * 60 * 1000; // 3 часа в миллисекундах
const INSTANT_REFRESH_COST = 20; // Стоимость мгновенного обновления

// Функции для работы с localStorage
const getShopState = (): ShopState => {
  const stored = localStorage.getItem(SHOP_STATE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  // Инициализация нового состояния магазина
  return initializeShop();
};

const saveShopState = (state: ShopState) => {
  localStorage.setItem(SHOP_STATE_KEY, JSON.stringify(state));
};

// Инициализация магазина со случайным набором жаб
const initializeShop = (): ShopState => {
  const now = Date.now();
  const shuffled = [...ALL_TOADS].sort(() => Math.random() - 0.5);
  const availableToads = shuffled.slice(0, 3); // 3 случайные жабы

  return {
    availableToads,
    purchasedToads: [],
    lastRefresh: now - REFRESH_COOLDOWN,
    nextRefresh: now,
  };
};

const refreshShop = (currentState: ShopState): ShopState => {
  const now = Date.now();

  const availableToadsPool = ALL_TOADS.filter(
    (toad) => !currentState.purchasedToads.includes(toad.name!)
  );

  if (availableToadsPool.length === 0) {
    const newState = initializeShop();
    newState.lastRefresh = now;
    newState.nextRefresh = now + REFRESH_COOLDOWN;
    return newState;
  }

  const shuffled = [...availableToadsPool].sort(() => Math.random() - 0.5);
  const availableToads = shuffled
    .slice(0, Math.min(3, shuffled.length))
    .map((toad) => randomizeToadCharacteristics(toad, 0.1)); // Добавляем рандомизацию

  return {
    ...currentState,
    availableToads,
    lastRefresh: now,
    nextRefresh: now + REFRESH_COOLDOWN,
  };
};

const BuyTab: React.FC = () => {
  const { currentScene, account } = useToads();
  const { playBuy } = useSoundEffects();
  const { tokens = 0, storage = { food: 0 } } = account || {};
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

    const allToadsOnScene =
      getGameState().toads.filter(
        (t) => !t.is_off && t.scene_id === currentScene.id
      ).length + 1;

    if (currentScene.capacity < allToadsOnScene) {
      createToad({ ...toad, scene_id: null });
      addNotification({
        type: "warn",
        content:
          "Превышен лимит жаб на вольер, новая жаба была помещена на склад.",
      });
      return;
    }

    createToad({ ...toad, scene_id: currentScene?.id });
    updateUser({ tokens: tokens - calculateBuyPrice(toad) });

    // Помечаем жабу как купленную
    const newShopState = {
      ...shopState,
      purchasedToads: [...shopState.purchasedToads, toad.name],
      availableToads: shopState.availableToads.filter(
        (t) => t.name !== toad.name
      ),
    };

    setShopState(newShopState);
    saveShopState(newShopState);
  };

  const handleBuyItem = async () => {
    playBuy();
    updateUser({
      tokens: tokens - FOOD_PRICE,
      storage: { food: (storage?.food || 0) + 10 },
    });
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

    const newShopState = refreshShop(shopState);
    setShopState(newShopState);
    saveShopState(newShopState);
    addNotification({ content: "Рынок обновлен!", type: "success" });
  };

  const handleInstantRefresh = () => {
    if (tokens < INSTANT_REFRESH_COST) {
      addNotification({
        type: "warn",
        content: `Недостаточно астрокваксов! Нужно ${INSTANT_REFRESH_COST}`,
      });
      return;
    }

    updateUser({ tokens: tokens - INSTANT_REFRESH_COST });
    const newShopState = refreshShop(shopState);
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
        <div className="bg-gray-800 rounded-2xl py-4 px-2 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-green-400 bg-gray-900">
                <span className="text-xl">🍎</span>
              </div>
              <div>
                <p className="text-white font-medium text-base">Жабий корм</p>
                <p className="text-gray-400 text-sm mt-1">х10 порций</p>
              </div>
            </div>
            <button
              onClick={handleBuyItem}
              disabled={tokens < FOOD_PRICE}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-w-[90px]  text-white ${
                tokens >= FOOD_PRICE
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {FOOD_PRICE} {CURRENCY_CONFIG.tokens.icon}
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
              const isPurchased = shopState.purchasedToads.includes(toad.name!);

              return (
                <ToadItem
                  toad={toad as Toad}
                  key={index}
                  button={
                    <button
                      onClick={() => handleBuyToad(toad as Toad)}
                      disabled={
                        tokens < calculateBuyPrice(toad as Toad) || isPurchased
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-w-[90px] ${
                        tokens >= calculateBuyPrice(toad as Toad) &&
                        !isPurchased
                          ? "bg-green-600 hover:bg-green-500 text-white"
                          : "bg-gray-600 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {isPurchased
                        ? "Куплено"
                        : `${calculateBuyPrice(toad as Toad)} ${
                            CURRENCY_CONFIG.tokens.icon
                          }`}
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
