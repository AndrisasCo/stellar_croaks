import { useEffect, useState } from "react";
import { useToads } from "../ToadContext";
import { completeAchivement } from "../../backend/achivements-manager";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { getAutoHunger } from "../../utils/get-auto-hunger";

export const useFeedToads = () => {
  const [isFoodActive, setIsFoodActive] = useState(false);
  const [showFoodTooltip, setShowFoodTooltip] = useState(false);
  const { toads, handleFeedToads, account, currentScene } = useToads();

  useEffect(() => {
    setIsFoodActive(false);
    setShowFoodTooltip(false);
  }, [currentScene.id]);

  const { playCrunch, playExited } = useSoundEffects();

  const handleShowFoodTooltip = () => {
    setShowFoodTooltip(true);
  };

  const getTooltipMessage = () => {
    const newFood = currentScene.bonuses?.autoFeeder
      ? getAutoHunger(toads)
      : toads.length;

    if ((account?.storage?.food || 0) < newFood) {
      return {
        message: `Не хватает: ${Math.abs(
          (account?.storage?.food || 0) - newFood
        )} корма`,
        disabled: true,
      };
    }

    return { message: `Потратить: ${newFood} корма?`, disabled: false };
  };

  const handleConfirmFeed = () => {
    if (isFoodActive) {
      return;
    }
    const newFood = currentScene.bonuses?.autoFeeder
      ? getAutoHunger(toads)
      : toads.length;

    if ((account?.storage?.food || 0) < newFood) {
      return;
    }
    completeAchivement("feed-all");
    setIsFoodActive(true);
    setShowFoodTooltip(false);
    handleFeedToads(toads.map((t) => t.id));
    playExited();
    setTimeout(() => {
      playCrunch();
    }, 500);

    setTimeout(() => {
      setIsFoodActive(false);
    }, 10000);
  };

  const handleCancelFeed = () => {
    setShowFoodTooltip(false);
  };

  return {
    showFoodTooltip,
    handleCancelFeed,
    handleConfirmFeed,
    handleShowFoodTooltip,
    isFoodActive,
    getTooltipMessage,
  };
};
