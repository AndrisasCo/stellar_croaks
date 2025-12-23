import { useSoundEffects } from "../../../../hooks/use-sound-effects";
import {
  LootboxRarity,
  UNIQUE_TOADS_BY_RARITY,
} from "../../../../models/Toad/lootbox";
import { ToadAvatar } from "../../../shared/ToadAvatar";

export const LootboxDetails: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="bg-gray-900 border-2 border-purple-500 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white flex gap-2 items-center">
              <img src="assets/lootbox.png" width={80} />
              Жаббокс
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <p className="text-gray-300 mb-6">
            В лутбоксе можно получить уникальных жаб разной редкости.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <h4 className="text-green-400 font-bold mb-2">
                🟢 Обычные (40%)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.common].map(
                  (toad, idx) => (
                    <ToadAvatar size={15} toad={toad} />
                  )
                )}
              </div>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-blue-700">
              <h4 className="text-blue-400 font-bold mb-2">
                🔵 Необычные (30%)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.uncommon].map(
                  (toad, idx) => (
                    <ToadAvatar size={15} toad={toad} />
                  )
                )}
              </div>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-purple-700">
              <h4 className="text-purple-400 font-bold mb-2">
                🟣 Редкие (20%)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.rare].map((toad, idx) => (
                  <ToadAvatar size={15} toad={toad} />
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-yellow-700">
              <h4 className="text-yellow-400 font-bold mb-2">
                🟡 Эпические (7%)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.epic].map((toad, idx) => (
                  <ToadAvatar size={15} toad={toad} />
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-gray-800/50 p-4 rounded-xl border border-orange-700">
              <h4 className="text-orange-400 font-bold mb-2">
                🟠 Легендарные (3%)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.legendary].map(
                  (toad, idx) => (
                    <ToadAvatar size={15} toad={toad} />
                  )
                )}
              </div>
            </div>
          </div>

          <div className="text-center"></div>
        </div>
      </div>
    </div>
  );
};
