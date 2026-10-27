import { updateToadsBulkHunger } from "../backend";

/**
 * Тик голода: `hoursPassed` — сколько реальных часов прошло. Формула сытости
 * живёт в чистом модуле `utils/hunger.ts`; здесь только запись в сейв.
 */
export const processHunger = (hoursPassed: number) => {
  updateToadsBulkHunger(hoursPassed, true);
};
