import { updateToadsBulkHunger } from "../backend";

// `getHunger` живёт в чистом модуле, но реэкспортируется отсюда: у него уже были
// потребители (`backend/index.ts`), и им не нужно менять импорт.
export { getHunger } from "./hunger";

export const processHunger = (hoursPassed: number) => {
  updateToadsBulkHunger(hoursPassed, true);
};
