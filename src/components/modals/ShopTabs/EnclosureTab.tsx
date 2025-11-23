import React from "react";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { CURRENCY_CONFIG } from "../../../utils/constants";
import { useToads } from "../../ToadContext";
import { getGameState, updateGameState } from "../../../backend/localStorage";
import { DEFAULT_SCENE } from "../../../models/scene";

const EnclosureTab: React.FC = () => {
  const { allToads: activeToads, account, ownedScenes } = useToads();
  const { playBuy } = useSoundEffects();
  const { tokens = 0 } = account || {};
  const scenePrice = ownedScenes.length * 100;

  const handleBuyEnclosure = () => {
    if (tokens - scenePrice < 0) {
      return;
    }
    playBuy();
    const newScene = {
      ...DEFAULT_SCENE,
      id: Date.now(),
      name: ` Вольер #${ownedScenes.length + 1}`,
      description: `Стандартный вольер для разведения жаб`,
    };
    updateGameState({
      scenes: [...getGameState().scenes, newScene],
      user: { ...account, tokens: tokens - scenePrice },
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold px-2 mb-3">Вольеры</h3>
      <div className="bg-gray-800 rounded-xl py-4 px-2 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-white font-semibold">Новый вольер</h4>
            <p className="text-gray-400 text-sm">
              +{DEFAULT_SCENE.capacity} мест для жаб
            </p>
          </div>
          <div className="text-blue-400 font-bold">
            {scenePrice} {CURRENCY_CONFIG.tokens.icon}
          </div>
        </div>
        <button
          onClick={handleBuyEnclosure}
          disabled={tokens < scenePrice}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            tokens >= scenePrice
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {tokens >= scenePrice ? "Купить вольер" : "Недостаточно средств"}
        </button>
      </div>
    </div>
  );
};

export default EnclosureTab;
