import { useState, useEffect } from "react";
import { createToad, updateUser } from "../../../../backend";
import {
  completeAchivement,
  completeAchivementCounter,
} from "../../../../backend/achivements-manager";
import { getGameState } from "../../../../backend/localStorage";
import {
  ShopState,
  getNewToads,
  getShopState,
  initialItemsAmount,
  REFRESH_COOLDOWN,
  saveShopState,
  INSTANT_REFRESH_COST,
} from "../../../../backend/shop-state";
import { useNotifications } from "../../../../hooks/use-notification";
import { usePagination } from "../../../../hooks/use-pagination";
import { useSoundEffects } from "../../../../hooks/use-sound-effects";
import { Toad, calculateSellPrice } from "../../../../models/Toad";
import { UNIQUE_TOADS_BY_RARITY } from "../../../../models/Toad/lootbox";
import { MAX_STORED_TOADS, CURRENCY_CONFIG } from "../../../../utils/constants";
import { ToadItem } from "../../../shared/ToadItem";
import { useToads } from "../../../ToadContext";

const FOOD_PRICE = 10;

// Типы для лутбокса
enum LootboxRarity {
  common = "common", // 1-5
  uncommon = "uncommon", // 6-10
  rare = "rare", // 11-20 (самая распространенная)
  epic = "epic", // 21-35
  legendary = "legendary", // 36-50
}

const refreshShop = (): ShopState => {
  const allToads = getGameState().toads;
  const newToads = getNewToads();
  const averageLevel = Math.max(
    0,
    allToads.reduce((acc, t) => acc + t.genes.rarity, 0) /
      (allToads.length || 1) -
      3
  );

  const now = Date.now();
  const newState = getShopState();
  newState.availableToads = newToads.map((t) => ({
    ...t,
    genes: { ...t.genes, rarity: averageLevel + t.genes?.rarity || 1 },
  }));
  newState.items = { ...initialItemsAmount };
  newState.lastRefresh = now;
  newState.nextRefresh = now + REFRESH_COOLDOWN;

  return newState;
};

const LootboxDetails: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { playBuy } = useSoundEffects();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="bg-gray-900 border-2 border-purple-500 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">
              🎁 Таинственный лутбокс
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <p className="text-gray-300 mb-6">
            В лутбоксе можно получить уникальных жаб разной редкости. Шансы
            распределены следующим образом:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <h4 className="text-green-400 font-bold mb-2">
                🟢 Обычные (40%)
              </h4>
              <p className="text-gray-400 text-sm mb-3">Редкость 1-5</p>
              {UNIQUE_TOADS_BY_RARITY[LootboxRarity.common].map((toad, idx) => (
                <div key={idx} className="text-gray-300 text-sm mb-1">
                  • {toad.name}
                </div>
              ))}
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-blue-700">
              <h4 className="text-blue-400 font-bold mb-2">
                🔵 Необычные (30%)
              </h4>
              <p className="text-gray-400 text-sm mb-3">Редкость 6-10</p>
              {UNIQUE_TOADS_BY_RARITY[LootboxRarity.uncommon].map(
                (toad, idx) => (
                  <div key={idx} className="text-gray-300 text-sm mb-1">
                    • {toad.name}
                  </div>
                )
              )}
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-purple-700">
              <h4 className="text-purple-400 font-bold mb-2">
                🟣 Редкие (20%)
              </h4>
              <p className="text-gray-400 text-sm mb-3">Редкость 11-20</p>
              {UNIQUE_TOADS_BY_RARITY[LootboxRarity.rare].map((toad, idx) => (
                <div key={idx} className="text-gray-300 text-sm mb-1">
                  • {toad.name}
                </div>
              ))}
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-yellow-700">
              <h4 className="text-yellow-400 font-bold mb-2">
                🟡 Эпические (7%)
              </h4>
              <p className="text-gray-400 text-sm mb-3">Редкость 21-35</p>
              {UNIQUE_TOADS_BY_RARITY[LootboxRarity.epic].map((toad, idx) => (
                <div key={idx} className="text-gray-300 text-sm mb-1">
                  • {toad.name}
                </div>
              ))}
            </div>

            <div className="md:col-span-2 bg-gray-800/50 p-4 rounded-xl border border-orange-700">
              <h4 className="text-orange-400 font-bold mb-2">
                🟠 Легендарные (3%)
              </h4>
              <p className="text-gray-400 text-sm mb-3">Редкость 36-50</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.legendary].map(
                  (toad, idx) => (
                    <div key={idx} className="text-gray-300 text-sm">
                      • {toad.name}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BuyTab: React.FC = () => {
  const { currentScene, account } = useToads();
  const { playBuy } = useSoundEffects();
  const { tokens = 0, astro_quax = 0, storage = { food: 0 } } = account || {};
  const { addNotification } = useNotifications();
  const [shopState, setShopState] = useState<ShopState>(getShopState());
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [showLootboxDetails, setShowLootboxDetails] = useState(false);
  const {
    visibleItems: visibleToads,
    hasMore,
    loadMoreRef,
  } = usePagination<Toad>(shopState.availableToads, 8); // Увеличили для сетки 2x4

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
    completeAchivementCounter("buyToad", 1);

    const allToadsOnScene =
      getGameState().toads.filter((t) => t.scene_id === currentScene.id)
        .length + 1;

    let scene_id: number | null = currentScene?.id;

    if (currentScene.capacity < allToadsOnScene) {
      if (
        getGameState().toads.filter((t) => t.scene_id === null).length + 1 >
        MAX_STORED_TOADS
      ) {
        addNotification({
          type: "danger",
          content: `Все хранилища переполнены`,
        });
        return;
      }
      scene_id = null;
      addNotification({
        type: "warn",
        content:
          "Превышен лимит жаб на вольер, новая жаба была помещена на склад.",
      });
    }

    createToad({ ...toad, scene_id });
    updateUser({ tokens: tokens - calculateBuyPrice(toad) });

    const newShopState: ShopState = {
      ...shopState,
      availableToads: shopState.availableToads.filter((t) => t.id !== toad.id),
    };

    setShopState(newShopState);
    saveShopState(newShopState);
  };

  const updateShopStateAmount = (keyString: string) => {
    const newShopState = { ...shopState };
    newShopState.items[keyString] = newShopState.items[keyString] - 1;

    setShopState(newShopState);
    saveShopState(newShopState);
  };

  const handleBuyItem =
    (
      item: Record<string, number>,
      price: Record<string, number>,
      noAmount?: boolean
    ) =>
    () => {
      const currency = Object.keys(price)[0];
      const itemName = Object.keys(item)[0];

      if ((account as any)[currency] < price[currency]) {
        return;
      }

      if (!shopState.items[itemName] && !noAmount) {
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

      addNotification({
        content: "Предмет куплен!",
        type: "success",
        timeout: 3000,
      });

      if (noAmount) {
        return;
      }
      updateShopStateAmount(itemName);
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

  const BuyButton = ({ onClick, disabled, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 min-w-[80px] rounded-lg disabled:bg-gray-700 disabled:text-gray-500 text-sm font-medium text-white whitespace-nowrap transition-colors ${
        !disabled
          ? "bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900"
          : ""
      }`}
    >
      {children}
    </button>
  );

  // Сетка предметов 2x2
  const items = [
    {
      title: "Жабий корм",
      description: "х10 порций",
      icon: "🍎",
      borderColor: "border-green-400",
      bgColor: "bg-gray-900",
      price: `${FOOD_PRICE} ${CURRENCY_CONFIG.tokens.icon}`,
      onClick: handleBuyItem({ food: 10 }, { tokens: FOOD_PRICE }, true),
      disabled: tokens < FOOD_PRICE,
      available: "∞ доступно",
      availableColor: "text-green-400",
    },
    {
      title: "Большая упаковка корма",
      description: "х100 порций",
      icon: (
        <div className="relative">
          <span className="text-xl absolute -top-1 -left-1">🍎</span>
          <span className="text-xl">🍎</span>
          <span className="text-xl absolute -bottom-1 -right-1">🍎</span>
        </div>
      ),
      borderColor: "border-blue-400",
      bgColor: "bg-gray-900",
      price: `90 ${CURRENCY_CONFIG.tokens.icon}`,
      originalPrice: `100 ${CURRENCY_CONFIG.tokens.icon}`,
      onClick: handleBuyItem({ food: 100 }, { tokens: 90 }),
      disabled: tokens < 90 || !shopState.items.food,
      available: shopState.items.food
        ? `✅ ${shopState.items.food} доступно`
        : "❌ Куплено",
      availableColor: shopState.items.food ? "text-green-400" : "text-red-400",
    },
    {
      title: "Упаковка батареек",
      description: "х3 батарейки, можно ускорить инкубацию",
      icon: (
        <div className="relative">
          <span className="text-xl absolute -top-1 -left-1">🔋</span>
          <span className="text-xl">🔋</span>
          <span className="text-xl absolute -bottom-1 -right-1">🔋</span>
        </div>
      ),
      borderColor: "border-blue-400",
      bgColor: "bg-gray-900",
      price: `5 ${CURRENCY_CONFIG.astro_quax.icon}`,
      onClick: handleBuyItem({ battery: 3 }, { astro_quax: 5 }),
      disabled: astro_quax < 5 || !shopState.items.battery,
      available: shopState.items.battery
        ? `✅ ${shopState.items.battery} доступно`
        : "❌ Куплено",
      availableColor: shopState.items.battery
        ? "text-green-400"
        : "text-red-400",
    },
    {
      title: "Белковые черви",
      description: "Ускоряют рост головастика на 100%",
      icon: "🪱",
      borderColor: "border-blue-700",
      bgColor: "bg-gray-900",
      price: `10 ${CURRENCY_CONFIG.astro_quax.icon}`,
      onClick: handleBuyItem({ worms: 1 }, { astro_quax: 10 }),
      disabled: astro_quax < 10 || !shopState.items.worms,
      available: shopState.items.worms
        ? `✅ ${shopState.items.worms} доступно`
        : "❌ Куплено",
      availableColor: shopState.items.worms ? "text-green-400" : "text-red-400",
    },
  ];

  return (
    <>
      {showLootboxDetails && (
        <LootboxDetails onClose={() => setShowLootboxDetails(false)} />
      )}

      <div className="space-y-6 pb-4">
        {/* Управление магазином */}
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">
                Обновление ассортимента:
              </span>
              <span className="text-white font-mono text-lg">{timeLeft}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefreshShop}
                disabled={!canRefresh}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  canRefresh
                    ? "bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {canRefresh ? "🔄 Обновить рынок" : "⏳ Обновление недоступно"}
              </button>

              <button
                onClick={handleInstantRefresh}
                disabled={tokens < INSTANT_REFRESH_COST}
                className={`px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  tokens >= INSTANT_REFRESH_COST
                    ? "bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                ⚡ {INSTANT_REFRESH_COST} {CURRENCY_CONFIG.tokens.icon}
              </button>
            </div>
          </div>
        </div>

        {/* Разделы в сетке 2x2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Левая колонка: Предметы */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-xl mb-4 px-2">
              📦 Предметы
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={`bg-gray-800 rounded-xl p-4 border ${item.borderColor} flex flex-col justify-between h-full`}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-12 h-12 flex items-center justify-center rounded-full ${item.borderColor} border-2 ${item.bgColor}`}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-base leading-tight">
                          {item.title}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          {item.description}
                        </p>
                        {item.originalPrice && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-red-400 text-xs line-through">
                              {item.originalPrice}
                            </span>
                            <span className="text-green-400 text-xs font-medium bg-green-900/30 px-1 rounded">
                              -10%
                            </span>
                          </div>
                        )}
                        <p className={`text-xs mt-2 ${item.availableColor}`}>
                          {item.available}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                        item.disabled
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900"
                      }`}
                    >
                      {item.price}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Специальные предметы под сеткой */}
            <div className="space-y-4">
              {/* Сияющие мушки */}
              <div className="bg-gray-800 rounded-xl p-4 border border-blue-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-blue-400 bg-gray-900">
                      <span className="text-2xl">✨</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-base">
                        Сияющие мушки
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Ускоряют беременность жабы на 100%
                      </p>
                      <p
                        className={`text-xs mt-2 ${
                          shopState.items.sparkleFlys === 0
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {shopState.items.sparkleFlys === 0
                          ? "❌ Куплено"
                          : `✅ ${shopState.items.sparkleFlys} доступно`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleBuyItem(
                      { sparkleFlys: 1 },
                      { astro_quax: 20 }
                    )}
                    disabled={astro_quax < 20 || !shopState.items.sparkleFlys}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      astro_quax >= 20 && shopState.items.sparkleFlys
                        ? "bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    20 {CURRENCY_CONFIG.astro_quax.icon}
                  </button>
                </div>
              </div>

              {/* Лутбокс */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-purple-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -translate-y-8 translate-x-8"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-purple-500/5 rounded-full translate-y-8 -translate-x-8"></div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-purple-400 bg-gray-900">
                        <span className="text-2xl">🎁</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-base">
                          Таинственный лутбокс
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          Случайная жаба или предмет
                        </p>
                        <p className="text-yellow-400 text-xs mt-1">
                          Редкие и эксклюзивные награды!
                        </p>
                        <p
                          className={`text-xs mt-2 ${
                            shopState.items.lootbox === 0
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {shopState.items.lootbox === 0
                            ? "❌ Куплено"
                            : `✅ ${shopState.items.lootbox} доступно`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleBuyItem(
                          { lootbox: 1 },
                          { astro_quax: 50 }
                        )}
                        disabled={astro_quax < 50 || !shopState.items.lootbox}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                          astro_quax >= 50 && shopState.items.lootbox
                            ? "bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white"
                            : "bg-gray-700 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        50 {CURRENCY_CONFIG.astro_quax.icon}
                      </button>

                      <button
                        onClick={() => setShowLootboxDetails(true)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                      >
                        Подробнее
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Правая колонка: Жабы */}
          <div>
            <h3 className="text-white font-bold text-xl mb-4 px-2">🐸 Жабы</h3>

            {allToadsPurchased ? (
              <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center">
                <p className="text-gray-400 text-lg">Все жабы раскуплены!</p>
                <p className="text-gray-500 text-sm mt-2">
                  Дождитесь обновления магазина или обновите его сейчас
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {visibleToads.map((toad, index) => (
                  <div
                    key={`${toad.id}-${index}`}
                    className="bg-gray-800 rounded-xl p-3 border border-gray-700"
                  >
                    <ToadItem
                      toad={toad as Toad}
                      compact={true}
                      button={
                        <div className="mt-3">
                          <button
                            onClick={() => handleBuyToad(toad as Toad)}
                            disabled={tokens < calculateBuyPrice(toad as Toad)}
                            className={`w-full px-3 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap transition-colors ${
                              tokens >= calculateBuyPrice(toad as Toad)
                                ? "bg-gradient-to-r from-green-600 to-emerald-800 hover:from-green-700 hover:to-emerald-900"
                                : "bg-gray-700 text-gray-400"
                            }`}
                          >
                            {calculateBuyPrice(toad as Toad)}{" "}
                            {CURRENCY_CONFIG.tokens.icon}
                          </button>
                        </div>
                      }
                    />
                  </div>
                ))}

                {/* Индикатор загрузки */}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="col-span-2 flex justify-center py-4"
                    key="load-more"
                  >
                    <div className="animate-pulse text-gray-400 text-sm">
                      Загрузка жаб...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BuyTab;
