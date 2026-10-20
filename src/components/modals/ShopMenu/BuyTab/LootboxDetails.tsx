import {
  LOOTBOX_RARITY_CHANCES,
  LootboxRarity,
  UNIQUE_TOADS_BY_RARITY,
} from "../../../../models/Toad/lootbox";
import { ToadAvatar } from "../../../shared/ToadAvatar";

/** Шанс тира для подписи: целые — без дробной части, редкие тиры — с одной цифрой */
const formatChance = (rarity: LootboxRarity): string => {
  const chance = LOOTBOX_RARITY_CHANCES[rarity];

  return `${Number.isInteger(chance) ? chance : chance.toFixed(1)}%`;
};

export const LootboxDetails: React.FC = () => {
  return (
    <>
      <div className="flex items-center gap-2 pb-4 ">
        <h2 className="text-xl font-bold">
          <div className="brand-text flex items-center gap-6 text-2xl font-bold">
            <img src="assets/lootbox.webp" width={180} />
            Жаббокс
          </div>
        </h2>
      </div>
      <div>
        <div className="p-6">
          <p className="text-slate-200 mb-2">
            В лутбоксе можно получить уникальных жаб разной редкости.
          </p>
          <p className="text-xs text-slate-400 mb-6">
            Базовые шансы указаны без гарантий: счётчик неудач даёт редкую жабу
            не позже 10-го открытия, а эпическую — не позже 50-го.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-color-main p-4 rounded-xl border border-slate-700">
              <h4 className="text-green-400 font-bold mb-2">
                🟢 Обычные ({formatChance(LootboxRarity.common)})
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.common].map(
                  (toad, idx) => (
                    <ToadAvatar
                      key={`${toad.name}-${idx}`}
                      size={15}
                      toad={toad}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="bg-color-main p-4 rounded-xl border border-blue-700">
              <h4 className="text-blue-400 font-bold mb-2">
                🔵 Необычные ({formatChance(LootboxRarity.uncommon)})
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.uncommon].map(
                  (toad, idx) => (
                    <ToadAvatar
                      key={`${toad.name}-${idx}`}
                      size={15}
                      toad={toad}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="bg-color-main p-4 rounded-xl border border-purple-700">
              <h4 className="text-purple-400 font-bold mb-2">
                🟣 Редкие ({formatChance(LootboxRarity.rare)})
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.rare].map((toad, idx) => (
                  <ToadAvatar
                    key={`${toad.name}-${idx}`}
                    size={15}
                    toad={toad}
                  />
                ))}
              </div>
            </div>

            <div className="bg-color-main p-4 rounded-xl border border-yellow-700">
              <h4 className="text-yellow-400 font-bold mb-2">
                🟡 Эпические ({formatChance(LootboxRarity.epic)})
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.epic].map((toad, idx) => (
                  <ToadAvatar
                    key={`${toad.name}-${idx}`}
                    size={15}
                    toad={toad}
                  />
                ))}
              </div>
            </div>

            <div className="md:col-span-2 bg-color-main p-4 rounded-xl border border-orange-700">
              <h4 className="text-orange-400 font-bold mb-2">
                🟠 Легендарные ({formatChance(LootboxRarity.legendary)})
              </h4>
              <div className="flex gap-2 flex-wrap">
                {UNIQUE_TOADS_BY_RARITY[LootboxRarity.legendary].map(
                  (toad, idx) => (
                    <ToadAvatar
                      key={`${toad.name}-${idx}`}
                      size={15}
                      toad={toad}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
