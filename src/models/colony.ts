/**
 * Состояние колонии: комнаты, которые игрок возвёл сам на гексагональной карте.
 *
 * Базовые комнаты (ядро, вольер, гнездо) считаются построенными всегда и в
 * сохранении не лежат — так старые сейвы остаются валидными, а карта не ломается.
 *
 * Каталог построек (цвет, цена, «единственная в колонии», действия) живёт в
 * `components/HexMap/rooms-config.ts` — модель хранит только вид комнаты и время постройки.
 */

/**
 * Виды комнат, которые игрок может построить на свободном гексе карты.
 *
 * «Ядро» сюда не входит: оно стоит в центре колонии с самого начала. Коллайдер, магазин
 * и диссоциатор строятся в единственном экземпляре (флаг `unique` в черновике комнаты),
 * остальные виды — сколько угодно раз.
 */
export type ColonyRoomKind =
  | "aviary"
  | "breeding"
  | "incubator"
  | "collider"
  | "scout"
  | "storage"
  | "shop"
  | "hospital"
  | "dissociator"
  | "power";

export interface ColonyRoomState {
  /** id слота карты — совпадает с RoomConfig.id из rooms-config. */
  id: string;
  kind: ColonyRoomKind;
  /** Когда комната была построена. */
  builtAt: string;
  /**
   * Вольер-комната: id вольера (`Scene`), который она открыла.
   * Раньше вольеры покупали в магазине, теперь каждый построенный на гексе «Вольер»
   * создаёт свой вольер с местами для жаб (см. `backend/colony.ts`).
   */
  sceneId?: number;
}

export interface ColonyState {
  rooms: ColonyRoomState[];
}

/** Пустая колония: кроме базовых комнат ничего не построено. */
export const EMPTY_COLONY: ColonyState = { rooms: [] };

/** Названия построек для текстов уведомлений. */
export const COLONY_ROOM_TITLES: Record<ColonyRoomKind, string> = {
  aviary: "Вольер",
  breeding: "Гнездо",
  incubator: "Инкубатор",
  collider: "Коллайдер",
  scout: "Разведка",
  storage: "Склад",
  shop: "Магазин",
  hospital: "Лазарет",
  dissociator: "Диссоциатор",
  power: "Энергокомната",
};
