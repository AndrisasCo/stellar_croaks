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
    /**
     * Эмодзи-маркер для строк, собранных в утилитах. `CurrencyText`
     * (`components/shared/CurrencyIcon.tsx`) заменяет его на SVG при рендере.
     */
    icon: "🔷",
    /** SVG-иконка в стиле пропуска КОНТУРа — для карточек и HUD */
    asset: "/assets/quax.svg",
    color: "text-yellow-400",
    description: "Основная валюта",
  },
  astro_quax: {
    name: "Астро-кваксы",
    /** Эмодзи-маркер для текстовых строк — см. `CurrencyText` */
    icon: "💎",
    /** SVG-иконка в стиле пропуска КОНТУРа — для карточек и HUD */
    asset: "/assets/astro-quax.svg",
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
 * Уникальный числовой хвост id сектора.
 *
 * Формат id сектора — `вид_уникальноеЧисло` (`aviary_1729250000000001`): по id видно,
 * что это за сектор, а число исключает совпадение двух построек одного вида. Счётчик
 * внутри миллисекунды защищает от двух построек в одном тике, `Date.now()` — от
 * совпадения между перезагрузками страницы.
 */
let roomIdSequence = 0;

export const uniqueRandomNumber = (): number => {
  roomIdSequence = (roomIdSequence + 1) % 1000;

  return Date.now() * 1000 + roomIdSequence;
};

/** id сектора: вид плюс уникальное число — `kind_1234567890123`. */
export const createRoomId = (kind: string): string =>
  `${kind}_${uniqueRandomNumber()}`;

/**
 * id базовых секторов карты (`HexMap/rooms-config.ts`).
 *
 * Базовые секторы стоят с начала игры и в сохранении не лежат, поэтому их id должны быть
 * одинаковыми после каждой перезагрузки: по ним `demolished`, апгрейды и жабы в секторах
 * находят свой гекс. Числа фиксированные, но формат тот же, что у построек игрока.
 *
 * `NEST_ROOM_ID` остался от базового Репродуктора: теперь его нет, но исторический гекс
 * `breeding` помнит этот id. Первый построенный там Репродуктор получает его же
 * (`backend/colony.ts`).
 */
export const CORE_ROOM_ID = "core_100000000";
export const NEST_ROOM_ID = "breeding_100000001";
export const AVIARY_ROOM_ID = "aviary_100000002";
