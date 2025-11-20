import { updateToadById } from "../backend";
import { Toad } from "../models/toad";

export const processHunger = (hoursPassed: number, toads: Toad[]) => {
  // с hunger rate 1 24 часа держится сытость
  toads.forEach((t) => {
    const hunger =
      Math.round(
        Math.max(
          0,
          (t.state.hunger - (hoursPassed / 24) * 100 * t.genes.hungerRate) * 10
        )
      ) / 10;
    console.log(`Toad ${t.name} hunger ${t.state.hunger} to ${hunger}`);

    updateToadById(t.id, {
      state: {
        hunger,
      },
    });
  });
};
