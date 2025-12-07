import {
  updateToadById,
  updateToadsBulkHunger,
  updateToadsByIds,
} from "../backend";
import { getGameState } from "../backend/localStorage";

export const getHunger = (
  currentHunger: number,
  hungerRate: number,
  hoursPassed: number
) => {
  return (
    Math.round(
      Math.max(
        0,
        (currentHunger - (hoursPassed / 24) * 100 * Math.max(0, hungerRate)) *
          10
      )
    ) / 10
  );
};

export const processHunger = (hoursPassed: number) => {
  updateToadsBulkHunger(hoursPassed, true);
};
