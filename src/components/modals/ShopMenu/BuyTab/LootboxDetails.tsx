import {
  LootboxRarity,
  UNIQUE_TOADS_BY_RARITY,
} from "../../../../models/Toad/lootbox";
import { ToadAvatar } from "../../../shared/ToadAvatar";

export const LootboxDetails: React.FC = () => {
  return (
    <>
      <div className="flex items-center gap-2 pb-4 ">
        <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
          <div className="text-2xl font-bold text-white flex gap-6 items-center">
            <img src="assets/lootbox.webp" width={180} />
            Жаббокс
          </div>
        </h2>
      </div>
      <div>
        <div className="p-6">
          <p className="text-gray-200 mb-6">
            В лутбоксе можно получить уникальных жаб разной редкости.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-color-main p-4 rounded-xl border border-gray-700">
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

            <div className="bg-color-main p-4 rounded-xl border border-blue-700">
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

            <div className="bg-color-main p-4 rounded-xl border border-purple-700">
              <h4 className="text-purple-400 font-bold mb-2">
                🟣 Редкие (20%)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.rare].map((toad, idx) => (
                  <ToadAvatar size={15} toad={toad} />
                ))}
              </div>
            </div>

            <div className="bg-color-main p-4 rounded-xl border border-yellow-700">
              <h4 className="text-yellow-400 font-bold mb-2">
                🟡 Эпические (7%)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.epic].map((toad, idx) => (
                  <ToadAvatar size={15} toad={toad} />
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-color-main p-4 rounded-xl border border-orange-700">
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
        </div>
      </div>
    </>
  );
};
