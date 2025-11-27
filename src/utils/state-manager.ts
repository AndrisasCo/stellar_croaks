import { updateToadById } from "../backend";
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
  const toads = getGameState().toads.filter((t) => t.scene_id !== null);

  toads.forEach((t) => {
    const hunger = getHunger(t.state.hunger, t.genes.hungerRate, hoursPassed);
    console.log(`Toad ${t.name} hunger ${t.state.hunger} to ${hunger}`);

    updateToadById(
      t.id,
      {
        state: {
          ...t.state,
          hunger,
        },
      },
      true
    );
  });
};
