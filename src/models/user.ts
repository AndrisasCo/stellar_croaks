export type User = {
  /**
   * id пользователя Telegram. `null` в веб-версии: ключом аккаунта он больше не
   * является (см. `id` ниже), остаётся только «визиткой» — уведомления из бота и
   * ссылка на профиль.
   */
  tg_id: number | null;
  username: string;
  /**
   * Ключ аккаунта во всех облачных таблицах (`game_state`, `leaderboard`,
   * `credits`): для игрока в Telegram — uuid Supabase Auth, выданный после
   * серверной проверки `initData`; для веб-игрока — uuid анонимной сессии.
   * До появления сессии здесь лежит локальный `user_<timestamp>`.
   */
  id: string;
  tokens: number;
  astro_quax: number;
  storage: Record<Items, number | undefined>;
  /** Биомасса — ресурс «фермы», вырабатывается жабами (Часть 3.3) */
  biomass?: number;
  /**
   * Уровень «Диспетчерской» (Часть 5.2): 1 команда + по одной за уровень.
   * Стоимость постройки — `DISPATCH_OFFICE_COST`.
   */
  dispatchLevel?: number;
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
  /** Крафтовая пыль — получается при разборе дубликатов (Часть 3.7) */
  craftDust = "craftDust",
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
    icon: "/assets/food.webp",
    description: "Основной корм для жаб",
    rarity: "common",
  },
  [Items.battery]: {
    key: Items.battery,
    name: "Батарейки",
    icon: "/assets/battery.webp",
    description: "Ускоряет созревание в инкубаторе",
    rarity: "common",
  },
  [Items.sparkleFlys]: {
    key: Items.sparkleFlys,
    name: "Сияющие мушки",
    icon: "/assets/flies.webp",
    description: "Ускоряют беременность",
    rarity: "uncommon",
  },
  [Items.worms]: {
    key: Items.worms,
    name: "Протеиновые черви",
    icon: "/assets/worms.webp",
    description: "Ускоряет рост головастика",
    rarity: "uncommon",
  },
  [Items.lootbox]: {
    key: Items.lootbox,
    name: "Лутбокс",
    icon: "/assets/lootbox.webp",
    description: "Случайная жаба или предмет",
    rarity: "rare",
  },
  [Items.pigmentRed]: {
    key: Items.pigmentRed,
    name: "Красный пигмент",
    icon: "/assets/p-red.webp",
    description: "Красный пигмент для покраски жаб",
    rarity: "common",
  },
  [Items.pigmentBlue]: {
    key: Items.pigmentBlue,
    name: "Синий пигмент",
    icon: "/assets/p-blue.webp",
    description: "Синий пигмент для покраски жаб",
    rarity: "common",
  },
  [Items.pigmentGreen]: {
    key: Items.pigmentGreen,
    name: "Зеленый пигмент",
    icon: "/assets/p-green.webp",
    description: "Зеленый пигмент для покраски жаб",
    rarity: "common",
  },
  [Items.pigmentUnstable]: {
    key: Items.pigmentUnstable,
    name: "Нестабильный пигмент",
    icon: "/assets/p-rainbow.webp",
    description: "Красит жабу в случайный цвет",
    rarity: "uncommon",
  },
  [Items.craftDust]: {
    key: Items.craftDust,
    name: "Крафтовая пыль",
    icon: "/assets/dust.webp",
    description: "Материал крафта: получается при разборе дубликатов жаб",
    rarity: "uncommon",
  },
};
