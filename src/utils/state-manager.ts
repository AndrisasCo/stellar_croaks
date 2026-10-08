import {
  updateToadById,
  updateToadsBulkHunger,
  updateToadsByIds,
} from "../backend";
import { getGameState } from "../backend/localStorage";
import { HUNGER_PER_DAY } from "./gamification-config";

export const getHunger = (
  currentHunger: number,
  hungerRate: number,
  hoursPassed: number
) => {
  return (
    Math.round(
      Math.max(
        0,
        (currentHunger -
          (hoursPassed / 24) * HUNGER_PER_DAY * Math.max(0, hungerRate)) *
          10
      )
    ) / 10
  );
};

export const processHunger = (hoursPassed: number) => {
  updateToadsBulkHunger(hoursPassed, true);
};
