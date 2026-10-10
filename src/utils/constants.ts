export const TYPE_ICONS = {
  male: "♂",
  female: "♀",
  neuter: "○",
};

export const MIXING_DURATION = 5000;

export type CurrencyType = "tokens" | "astro_quax";

export const CURRENCY_CONFIG = {
  tokens: {
    name: "Кваксы",
    icon: "🔷",
    color: "text-yellow-400",
    description: "Основная валюта",
  },
  astro_quax: {
    name: "Астро-кваксы",
    icon: "💎",
    color: "text-purple-400",
    description: "Космическая валюта для элитных сделок",
  },
};

export const MAX_OWNED_SCENES = 10;
