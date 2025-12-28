import { useEffect, useState } from "react";
import { useNotifications } from "../../hooks/use-notification";
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

  const { addNotification } = useNotifications();
  const { playCrunch, playExited } = useSoundEffects();

  const handleShowFoodTooltip = () => {
    let newFood = (account?.storage?.food || 0) - toads.length;

    if (currentScene.bonuses?.autoFeeder) {
      const allHunger = getAutoHunger(toads);

      newFood = (account?.storage?.food || 0) - allHunger;
    }

    if (newFood < 0) {
      addNotification({
        content: `Недостаточно корма на складе! Не хватает: ${Math.abs(
          newFood
        )}`,
        type: "warn",
      });
      return;
    }
    setShowFoodTooltip(true);
  };

  const handleConfirmFeed = () => {
    if (isFoodActive) {
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
  };
};
