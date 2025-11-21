import { useState } from "react";
import { updateToadsByIds, updateUser, updateToadById } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  Toad,
  getRarityConfig,
  getPersonalityLabel,
  calculateSellPrice,
} from "../../../models/toad";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../../utils/constants";
import { useToads } from "../../ToadContext";
import { PregnancyIcon } from "../../../assets/icons";
import { ToadItem } from "./ToadItem";

const SellTab: React.FC = () => {
  const { allToads: activeToads, account } = useToads();
  const { playCell } = useSoundEffects();
  const [selectedToads, setSelectedToads] = useState<number[]>([]);
  const { tokens = 0 } = account || {};

  const totalSellPrice = selectedToads.reduce((total, toadId) => {
    const toad = activeToads.find((t) => t.id === toadId);
    return total + (toad ? calculateSellPrice(toad) : 0);
  }, 0);

  const handleSellToads = async () => {
    playCell();
    updateToadsByIds(selectedToads, { is_off: true });
    updateUser({ tokens: tokens + totalSellPrice });
    setSelectedToads([]);
  };

  const handleSellSingleToad = async (toadId: number) => {
    playCell();
    const toad = activeToads.find((t) => t.id === toadId);
    if (toad) {
      const price = calculateSellPrice(toad);
      updateToadById(toadId, { is_off: true });
      updateUser({ tokens: tokens + price });
      setSelectedToads(selectedToads.filter((id) => id !== toadId));
    }
  };

  const handleSelectAll = () => {
    if (selectedToads.length === activeToads.length) {
      setSelectedToads([]);
    } else {
      setSelectedToads(activeToads.map((toad) => toad.id));
    }
  };

  const isAllSelected =
    selectedToads.length === activeToads.length && activeToads.length > 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Header with buttons */}
      <div className="flex justify-between items-center h-12 mb-3">
        {selectedToads.length > 0 ? (
          <button
            onClick={handleSellToads}
            className="bg-yellow-600 hover:bg-yellow-500 text-white px-1 py-0 rounded-xl text-sm font-medium transition-colors flex-1 mr-3"
          >
            Продать ({selectedToads.length})
            <div className="text-sm">
              {totalSellPrice} {CURRENCY_CONFIG.tokens.icon}
            </div>
          </button>
        ) : (
          <h3 className="text-white h-12 px-2 flex items-center font-semibold text-lg">
            Ваши жабы ({activeToads.length})
          </h3>
        )}
        {activeToads.length > 0 && (
          <button
            onClick={handleSelectAll}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
          >
            {isAllSelected ? "Снять всех" : "Выбрать Всех"}
          </button>
        )}
      </div>

      {/* Toads list */}
      {activeToads.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-base">
          У вас пока нет жаб
        </p>
      ) : (
        <div className="space-y-3">
          {activeToads.map((toad) => {
            const price = calculateSellPrice(toad);
            const isSelected = selectedToads.includes(toad.id);
            const rarityConfig = getRarityConfig(toad.genes.rarity);

            return (
              <ToadItem
                isSelected={isSelected}
                onClick={() => {
                  if (isSelected) {
                    setSelectedToads(
                      selectedToads.filter((id) => id !== toad.id)
                    );
                  } else {
                    setSelectedToads([...selectedToads, toad.id]);
                  }
                }}
                toad={toad}
                button={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSellSingleToad(toad.id);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors bg-yellow-600  text-white min-w-[80px]`}
                  >
                    {price} {CURRENCY_CONFIG.tokens.icon}
                  </button>
                }
              />

              // <div
              //   key={toad.id}
              //   className={`bg-gray-800 rounded-2xl py-4 px-2 border  transition-all ${
              //     isSelected
              //       ? "border-yellow-400 bg-yellow-900/20"
              //       : "border-gray-700 hover:border-gray-600"
              //   }`}
              // >
              //   <div className="flex flex-col gap-3">
              //     {/* Top row with avatar and selection */}
              //     <div className="flex items-center justify-between">
              //       <div
              //         className="flex items-center gap-3 flex-1 cursor-pointer"
              //         onClick={() => {
              //           if (isSelected) {
              //             setSelectedToads(
              //               selectedToads.filter((id) => id !== toad.id)
              //             );
              //           } else {
              //             setSelectedToads([...selectedToads, toad.id]);
              //           }
              //         }}
              //       >
              //         <div className="relative">
              //           <div
              //             className="w-14 h-14 rounded-full border-2"
              //             style={{
              //               backgroundColor: toad.genes.colors[0],
              //               borderColor: rarityConfig.borderColor
              //                 .replace("border-", "")
              //                 .replace("/50", ""),
              //             }}
              //           />
              //           <span className="absolute -top-1 -right-1 text-sm bg-gray-800 rounded-full p-0.5">
              //             {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS]}
              //           </span>
              //           {toad.pregnancy?.isPregnant && (
              //             <span className="absolute -bottom-1 -left-1 text-sm text-pink-400 bg-gray-800 rounded-full p-0.5">
              //               <PregnancyIcon />
              //             </span>
              //           )}
              //         </div>
              //         <div className="flex-1 min-w-0">
              //           <div className="flex items-center gap-2 mb-1">
              //             <p className="text-white font-medium text-base truncate">
              //               {toad.name || "Без имени"}
              //             </p>
              //           </div>
              //           <div className={`text-sm ${rarityConfig.color} mb-1`}>
              //             {rarityConfig.label} {toad.genes.rarity.toFixed(2)}
              //           </div>
              //         </div>
              //       </div>

              //       {/* Sell button */}
              // <button
              //   onClick={(e) => {
              //     e.stopPropagation();
              //     handleSellSingleToad(toad.id);
              //   }}
              //   className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors bg-green-600 hover:bg-green-500 text-white min-w-[80px]`}
              // >
              //   {price} {CURRENCY_CONFIG.tokens.icon}
              // </button>
              //     </div>

              //     {/* Characteristics */}
              //     <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-400">
              //       <div>
              //         <span className="text-gray-500">Тип:</span>{" "}
              //         {toad.stage === "adult" ? "Взрослый" : "Головастик"}
              //       </div>
              //       <div>
              //         <span className="text-gray-500">Размер:</span>{" "}
              //         {toad.genes.weight.toFixed(1)}
              //       </div>
              //       <div>
              //         <span className="text-gray-500">Скорость:</span>{" "}
              //         {toad.genes.speed.toFixed(1)}
              //       </div>
              //       <div>
              //         <span className="text-gray-500">Поколение:</span>{" "}
              //         {toad.generation}
              //       </div>
              //       <div>
              //         <span className="text-gray-500">Сытость:</span>{" "}
              //         {toad.state.hunger}/100
              //       </div>
              //       {toad.genes.personality && (
              //         <div className="text-purple-400">
              //           <span className="text-gray-500">Характер:</span>{" "}
              //           {getPersonalityLabel(toad.genes.personality)}
              //         </div>
              //       )}
              //     </div>
              //   </div>
              // </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellTab;
