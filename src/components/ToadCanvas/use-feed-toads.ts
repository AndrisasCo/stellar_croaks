import { useMemo, useState } from "react";
import { useToads } from "../ToadContext";
import { completeAchivement } from "../../backend/achivements-manager";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { getFeedCost } from "../../utils/feeding";

/**
 * Кормление жаб из HUD карты.
 *
 * Чип 🍎 кормит всю колонию: раньше он кормил жаб «текущего биопода» и считал корм
 * по бонусу этого биопода, но общего биопода у карты больше нет. Стоимость корма
 * считает `getFeedCost`: один корм на жабу (автокормушка секторов кормит сама —
 * см. `utils/auto-feeder.ts`).
 */
export const useFeedToads = () => {
  const [isFoodActive, setIsFoodActive] = useState(false);
  const [showFoodTooltip, setShowFoodTooltip] = useState(false);
  const { allToads, handleFeedToads, account } = useToads();

  /** Кого кормит чип: все жабы колонии, кроме тех, кто в походе — их дома нет. */
  const feedableToads = useMemo(
    () => allToads.filter((toad) => toad.status !== "out"),
    [allToads],
  );
  const feedCost = getFeedCost(feedableToads);

  const { playCrunch, playExited } = useSoundEffects();

  const handleShowFoodTooltip = () => {
    setShowFoodTooltip(true);
  };

  const getTooltipMessage = () => {
    if ((account?.storage?.food || 0) < feedCost) {
      return {
        message: `Не хватает: ${Math.abs(
          (account?.storage?.food || 0) - feedCost,
        )} корма`,
        disabled: true,
      };
    }

    return { message: `Потратить: ${feedCost} корма?`, disabled: false };
  };

  const handleConfirmFeed = () => {
    if (isFoodActive) {
      return;
    }

    if ((account?.storage?.food || 0) < feedCost) {
      return;
    }
    completeAchivement("feed-all");
    setIsFoodActive(true);
    setShowFoodTooltip(false);
    handleFeedToads(feedableToads.map((t) => t.id));
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
