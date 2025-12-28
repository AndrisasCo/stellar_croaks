import { Toad } from "../models/Toad";

export const getAutoHunger = (toads: Toad[]) => {
  return (
    Math.ceil(
      toads.reduce((acc, curr) => {
        return acc + (100 - curr.state.hunger);
      }, 0) / 100
    ) || 1
  );
};
