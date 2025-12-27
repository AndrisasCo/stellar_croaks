export type User = {
  tg_id: number;
  username: string;
  id: string;
  tokens: number;
  astro_quax: number;
  storage: Record<Items, number | undefined>;
};

export enum Items {
  battery = "battery",
  food = "food",
  lootbox = "lootbox",
  sparkleFlys = "sparkleFlys",
  worms = "worms",
  pigmentGreen = "pigmentGreen",
  pigmentRed = "pigmentRed",
  pigmentBlue = "pigmentBlue",
  pigmentUnstable = "pigmentUnstable",
}

export type InventoryItem = {
  key: Items;
  name: string;
  icon: string;
  description: string;
  rarity: string;
};

export const itemsFull: Record<Items, InventoryItem> = {
  [Items.food]: {
    key: Items.food,
    name: "Жабий корм",
    icon: "/assets/food.png",
    description: "Основной корм для жаб",
    rarity: "common",
  },
  [Items.battery]: {
    key: Items.battery,
    name: "Батарейки",
    icon: "/assets/battery.png",
    description: "Ускоряет созревание в инкубаторе",
    rarity: "common",
  },
  [Items.sparkleFlys]: {
    key: Items.sparkleFlys,
    name: "Сияющие мушки",
    icon: "/assets/flies.png",
    description: "Ускоряют беременность",
    rarity: "uncommon",
  },
  [Items.worms]: {
    key: Items.worms,
    name: "Протеиновые черви",
    icon: "/assets/worms.png",
    description: "Ускоряет рост головастика",
    rarity: "uncommon",
  },
  [Items.lootbox]: {
    key: Items.lootbox,
    name: "Лутбокс",
    icon: "/assets/lootbox.png",
    description: "Случайная жаба или предмет",
    rarity: "rare",
  },
  [Items.pigmentRed]: {
    key: Items.pigmentRed,
    name: "Красный пигмент",
    icon: "/assets/p-red.png",
    description: "Красный пигмент для покраски жаб",
    rarity: "common",
  },
  [Items.pigmentBlue]: {
    key: Items.pigmentBlue,
    name: "Синий пигмент",
    icon: "/assets/p-blue.png",
    description: "Синий пигмент для покраски жаб",
    rarity: "common",
  },
  [Items.pigmentGreen]: {
    key: Items.pigmentGreen,
    name: "Зеленый пигмент",
    icon: "/assets/p-green.png",
    description: "Зеленый пигмент для покраски жаб",
    rarity: "common",
  },
  [Items.pigmentUnstable]: {
    key: Items.pigmentUnstable,
    name: "Нестабильный пигмент",
    icon: "/assets/p-rainbow.png",
    description: "Красит жабу в случайный цвет",
    rarity: "uncommon",
  },
};
