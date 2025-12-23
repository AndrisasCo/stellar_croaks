import { useState, useEffect } from "react";
import { createToad, updateUser } from "../../../../backend";
import {
  completeAchivement,
  completeAchivementCounter,
} from "../../../../backend/achivements-manager";
import { getGameState } from "../../../../backend/localStorage";
import {
  ShopState,
  getShopState,
  saveShopState,
  getNewToads,
  initialItemsAmount,
  REFRESH_COOLDOWN,
  INSTANT_REFRESH_COST,
} from "../../../../backend/shop-state";
import { useNotifications } from "../../../../hooks/use-notification";
import { useSoundEffects } from "../../../../hooks/use-sound-effects";
import { Items } from "../../../../models/user";
import { useToads } from "../../../ToadContext";
import { Toad, calculateSellPrice } from "../../../../models/Toad";
import { MAX_STORED_TOADS } from "../../../../utils/constants";

export type ShopItem = {
  key: Items;
  name: string;
  icon: string;
  description: string;
  rarity: "common" | "rare" | "uncommon";
  price: number;
  currency: "tokens" | "astro_quax";
  left: number;
  quantity: number;
  onClick: () => void;
  disabled: boolean;
};

export const useShop = () => {
  const { account, currentScene } = useToads();

  const { tokens = 0, storage = { food: 0 } } = account || {};
  const [shopState, setShopState] = useState<ShopState>(getShopState());
  const [timeLeft, setTimeLeft] = useState<string>("");
  const { addNotification } = useNotifications();
  const { playBuy } = useSoundEffects();
  console.log({ shopState });

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

  const _shopItems: Partial<ShopItem>[] = [
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
      key: Items.battery,
      price: 5,

      name: "Батарейки х3",
      icon: "/assets/battery.png",
      description: "Ускоряет созревание в инкубаторе",
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
      description: "Ускоряют беременность",
      rarity: "uncommon",
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.sparkleFlys],
    },
    {
      key: Items.worms,
      price: 10,
      name: "Протеиновые черви",
      icon: "/assets/worms.png",
      description: "Ускоряет рост головастика",
      rarity: "uncommon",
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.worms],
    },
    {
      key: Items.lootbox,

      name: "Лутбокс",
      icon: "/assets/lootbox.png",
      description: "Случайная жаба или предмет",
      rarity: "rare",
      price: 50,
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.lootbox],
    },
  ];

  const updateShopStateAmount = (keyString: string) => {
    console.log({ keyString });

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

  const shopItems = _shopItems.map((s) => ({
    ...s,
    disabled: account?.[s.currency] < s.price || s.left === 0,
    onClick: handleBuyItem(
      { [s.key]: s.quantity },
      { [s.currency]: s.price },
      s.left === Infinity
    ),
  })) as ShopItem[];

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
  const calculateBuyPrice = (toad: Toad) =>
    Math.ceil(calculateSellPrice(toad) * 2.5);

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

    // Помечаем жабу как купленную
    const newShopState: ShopState = {
      ...shopState,
      availableToads: shopState.availableToads.filter((t) => t.id !== toad.id),
    };

    setShopState(newShopState);
    saveShopState(newShopState);
  };
  const allToadsPurchased = shopState.availableToads.length === 0;

  return {
    shopItems,
    handleInstantRefresh,
    handleBuyToad,
    handleRefreshShop,
    timeLeft,
    canRefresh,
    allToadsPurchased,
    calculateBuyPrice,
    shopState,
  };
};
