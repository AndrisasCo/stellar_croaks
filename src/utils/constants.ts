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

/**
 * Снос постройки колонии: цена в Кваксах 🔷 (кнопка «Уничтожить» в списке секторов ядра,
 * `modals/RoomUpgradeModal.tsx` → подтверждение в `modals/RoomDemolishModal.tsx`).
 *
 * Плата берётся только за работу: Кваксы за постройку не возвращаются, а здание уходит
 * с карты навсегда. Взамен гекс становится **свободным слотом** — на нём можно построить
 * заново, — и дешевеет следующий сектор того же вида: её цена считается по числу
 * построенных (`HexMap/colony-build.ts` → `getRoomCost`), поэтому снос возвращает цену
 * на шаг назад. Снос всегда подтверждается модалкой (`RoomDemolishModal`): сектор с
 * жабами внутри не снести вовсе.
 */
export const DEMOLISH_ROOM_COST = 100;

/**
 * id гекса «Репродуктор» в базовой карте колонии (`HexMap/rooms-config.ts`).
 * Репродукторов на карте может быть несколько, но спаривание идёт в базовом: именно в него
 * уходит пара на ухаживание (15–30 мин), поэтому id держим константой, а не строкой
 * в двух местах.
 */
export const NEST_ROOM_ID = "breeding";
