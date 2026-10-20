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
  INSTANT_REFRESH_COOLDOWN,
} from "../../../../backend/shop-state";
import { useNotifications } from "../../../../hooks/use-notification";
import { useSoundEffects } from "../../../../hooks/use-sound-effects";
import { Items, itemsFull, User } from "../../../../models/user";
import { CurrencyType } from "../../../../utils/constants";
import { useToads } from "../../../ToadContext";
import { Toad, calculateSellPrice } from "../../../../models/Toad";
import { pickSceneForNewToad } from "../../../../utils/housing";
import {
  canFitInStorage,
  getStorageCapacityInfo,
} from "../../../../utils/storage";

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
  const { account } = useToads();

  const { tokens = 0, storage = { food: 0 } } = account || {};
  const [shopState, setShopState] = useState<ShopState>(getShopState());
  const [timeLeft, setTimeLeft] = useState<string>("");
  const { addNotification } = useNotifications();
  const { playBuy, playBeep } = useSoundEffects();

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
        (timeRemaining % (1000 * 60 * 60)) / (1000 * 60),
      );
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
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
      description: "Основной корм для жаб",
      rarity: "common",
      price: 60,
      currency: "tokens",
      left: Infinity,
      quantity: 10,
    },
    {
      key: Items.food,
      name: "Упаковка корма x100",
      description: "Большая упаковка корма",
      rarity: "common",
      price: 540,
      currency: "tokens",
      quantity: 100,
      left: shopState.items[Items.food],
    },

    {
      key: Items.battery,
      price: 3,
      name: "Батарейки х3",
      rarity: "common",
      currency: "astro_quax",
      quantity: 3,
      left: shopState.items[Items.battery],
    },
    {
      key: Items.sparkleFlys,
      price: 4,

      name: "Сияющие мушки",
      rarity: "uncommon",
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.sparkleFlys],
    },
    {
      key: Items.worms,
      price: 4,
      name: "Протеиновые черви",
      rarity: "uncommon",
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.worms],
    },
    {
      key: Items.lootbox,

      name: "Лутбокс",
      rarity: "rare",
      price: 10,
      currency: "astro_quax",
      quantity: 1,
      left: shopState.items[Items.lootbox],
    },
    {
      key: Items.pigmentRed,
      name: "Красный пигмент",
      rarity: "common",
      price: 5,
      currency: "astro_quax",
      left: Infinity,
      quantity: 1,
    },
    {
      key: Items.pigmentBlue,
      name: "Синий пигмент",
      rarity: "common",
      price: 5,
      currency: "astro_quax",
      left: Infinity,
      quantity: 1,
    },
    {
      key: Items.pigmentGreen,
      name: "Зеленый пигмент",
      rarity: "common",
      price: 5,
      currency: "astro_quax",
      left: Infinity,
      quantity: 1,
    },
    {
      key: Items.pigmentUnstable,
      name: "Нестабильный пигмент",
      rarity: "uncommon",
      price: 8,
      currency: "astro_quax",
      left: shopState.items[Items.pigmentUnstable],
      quantity: 1,
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
      noAmount?: boolean,
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

      // Склад предметов ограничен постройками «Склад» (Часть 3.7): без места покупка
      // не проходит — иначе игрок платил бы за предмет, который исчезнет.
      if (!canFitInStorage(storage, { [itemName]: item[itemName] })) {
        playBeep();
        addNotification({
          type: "warn",
          content: `На складе нет места (${getStorageCapacityInfo(storage).used}/${
            getStorageCapacityInfo(storage).capacity
          }): постройте склад на карте колонии`,
        });
        return;
      }

      playBuy();
      updateUser({
        [currency]: (account as any)[currency] - price[currency],
        storage: {
          ...storage,
          [itemName]: ((storage as any)?.[itemName] || 0) + item[itemName],
        } as User["storage"],
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
    ...itemsFull[s.key as Items],
    ...s,
    disabled:
      (account?.[s.currency as CurrencyType] ?? 0) < (s.price ?? 0) ||
      s.left === 0,
    onClick: handleBuyItem(
      { [s.key as string]: s.quantity ?? 1 },
      { [s.currency as string]: s.price ?? 0 },
      s.left === Infinity,
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

  const refreshShop = (cooldownMs = REFRESH_COOLDOWN): ShopState => {
    const allToads = getGameState().toads;

    const newToads = getNewToads();
    const averageLevel = Math.max(
      0,
      allToads.reduce((acc, t) => acc + t.genes.rarity, 0) /
        (allToads.length || 1) -
        3,
    );

    const now = Date.now();
    const newState = getShopState();
    newState.availableToads = newToads.map((t) => ({
      ...t,
      genes: { ...t.genes, rarity: averageLevel + (t.genes?.rarity ?? 1) },
    })) as Partial<Toad>[];
    newState.items = { ...initialItemsAmount };
    newState.lastRefresh = now;
    newState.nextRefresh = now + cooldownMs;

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
    // Платное обновление даёт короткий кулдаун (30 мин), а не полные 3 часа:
    // иначе обновления можно было фармить без ограничений (аудит P1).
    const newShopState = refreshShop(INSTANT_REFRESH_COOLDOWN);
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
    // Жаба всегда переезжает в биопод: склада жаб больше нет, поэтому сначала
    // проверяем место. Нет места — предлагаем построить биопод на карте колонии.
    // Желаемого биопода нет: покупка идёт из магазина, а не с гекса биопода.
    const scene = pickSceneForNewToad();

    if (!scene) {
      playBeep();
      addNotification({
        type: "warn",
        content: "В био-подах нет мест или недостаточно питания.",
      });
      return;
    }

    playBuy();
    completeAchivement("buy-toad");
    completeAchivementCounter("buyToad", 1);

    createToad({ ...toad, scene_id: scene.id });
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
