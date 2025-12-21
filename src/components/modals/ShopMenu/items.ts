import { useEffect, useState } from "react";
import {
  INSTANT_REFRESH_COST,
  REFRESH_COOLDOWN,
  ShopState,
  getNewToads,
  getShopState,
  initialItemsAmount,
  saveShopState,
} from "../../../backend/shop-state";
import { Items } from "../../../models/user";
import { updateUser } from "../../../backend";
import { completeAchivement } from "../../../backend/achivements-manager";
import { getGameState } from "../../../backend/localStorage";
import { useNotifications } from "../../../hooks/use-notification";
import { useToads } from "../../ToadContext";
import { useSoundEffects } from "../../../hooks/use-sound-effects";

export const useShop = () => {
  const { account } = useToads();

  const { tokens = 0, astro_quax = 0, storage = { food: 0 } } = account || {};
  const [shopState, setShopState] = useState<ShopState>(getShopState());
  const [timeLeft, setTimeLeft] = useState<string>("");
  const { addNotification } = useNotifications();
  const { playBuy } = useSoundEffects();

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

  const shopItems = [
    {
      key: Items.food,
      name: "Жабий корм x10",
      icon: "/assets/food.png",
      description: "Основной корм для жаб",
      rarity: "common",
      price: 10,
      currency: "tokens",
      left: Infinity,
      quantity: 10,
    },
    {
      key: Items.food,
      name: "Упаковка корма x100",
      icon: "/assets/food2.png",
      description: "Большая упаковка корма",
      rarity: "common",
      price: 90,
      currency: "tokens",
      quantity: 100,
      left: shopState.items[Items.food],
    },
    {
      key: Items.lootbox,

      name: "Лутбокс",
      icon: "/assets/lootbox.png",
      description: "Открой!",
      rarity: "rare",
      price: 50,
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.lootbox],
    },
    {
      key: Items.battery,
      price: 5,

      name: "Батарейки х3",
      icon: "/assets/battery.png",
      description: "Ускоряет созревание жабы в инкубаторе на 10 минут",
      rarity: "common",
      currency: "astro_quax",
      quantity: 3,
      left: shopState.items[Items.battery],
    },
    {
      key: Items.sparkleFlys,
      price: 20,

      name: "Сияющие мушки",
      icon: "/assets/flies.png",
      description: "Ускоряют беременность жабы на 100%",
      rarity: "rare",
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.sparkleFlys],
    },
    {
      key: Items.worms,
      price: 10,
      name: "Протеиновые черви",
      icon: "/assets/worms.png",
      description: "Ускоряет рост головастика на 100%",
      rarity: "uncommon",
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.worms],
    },
  ];

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

  shopItems.map((s) => ({
    ...s,
    disabled: account?.[s.currency] < s.price || s.left === 0,
    onCLick: handleBuyItem(
      { [s.key]: s.quantity },
      { [s.currency]: s.price },
      true
    ),
  }));

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

  return { shopItems };
};
