export type User = {
  tg_id: number;
  username: string;
  id: string;
  tokens: number;
  astro_quax: number;
  storage: {
    battery?: number;
    food: number;
    lootbox?: number;
    sparkleFlys?: number;
    worms?: number;
  };
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
