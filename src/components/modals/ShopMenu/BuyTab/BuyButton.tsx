import { useState } from "react";
import { CURRENCY_CONFIG } from "../../../../utils/constants";
import { ShopItem } from "./use-shop";
import { LootboxDetails } from "./LootboxDetails";

export const BuyButton = (props: { item: ShopItem }) => {
  const { item } = props;
  const [showLootboxDetails, setShowLootboxDetails] = useState(false);

  const mapRarityStyles = {
    common: {
      border: "bg-gray-800 border-gray-700",
      icon: "border-green-400",
      shadow: "0 0  1px  1px #00ff5233",
    },
    uncommon: {
      border: "bg-gray-800 border-blue-700",
      icon: "border-blue-400",
      shadow: "0 0  1px  1px #0067ff33",
    },
    rare: {
      border:
        "bg-gradient-to-br from-gray-800 to-gray-900   border-purple-700 relative overflow-hidden",
      icon: "border-purple-400",
      shadow: "0 0  1px  1px #eb00ff33",
    },
  };

  const className = mapRarityStyles[item.rarity];

  return (
    <>
      {showLootboxDetails && (
        <LootboxDetails onClose={() => setShowLootboxDetails(false)} />
      )}

      <div className={` rounded-xl py-4 px-2 border mb-3 ${className.border} `}>
        {item.rarity === "rare" && (
          <>
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-purple-500/5 rounded-full translate-y-8 -translate-x-8" />
          </>
        )}

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-6">
            <div
              style={{
                boxShadow: className.shadow + " inset",
              }}
              className={`min-w-14 min-h-14 flex items-center justify-center relative rounded-full shadow-[inset_${className.shadow}]`}
            >
              <div
                style={{
                  boxShadow: className.shadow,
                }}
                className={`absolute w-14 h-14 inset-0  rounded-full`}
              />
              <img
                src={item.icon}
                className="max-w-14 max-h-14 relative m-auto z-10"
                alt="icon"
              />
            </div>
            <div>
              <p className="text-white font-medium text-base">{item.name}</p>
              <p className="text-sm text-gray-400 font-medium ">
                {item.description}
              </p>
              <p
                className={`text-xs mt-1 ${
                  item.left === 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {item.left === 0
                  ? "❌ Куплено"
                  : `✅ ${item.left === Infinity ? "∞" : item.left} доступно`}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-1">
            <button
              className={`px-3 min-w-[99px] py-1.5 rounded-lg disabled:bg-gray-600 disabled:bg-none text-sm font-medium text-white whitespace-nowrap transition-colors bg-gradient-to-r from-emerald-600 to-emerald-800 text-white"
              }`}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {item.price} {CURRENCY_CONFIG[item.currency].icon}
            </button>
            {item.key === "lootbox" && (
              <button
                onClick={() => setShowLootboxDetails(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
              >
                Подробнее
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// <div className="bg-gray-800 rounded-2xl py-4 px-2 border border-gray-700 mb-3">
//   <div className="flex items-center justify-between">
//     <div className="flex items-center gap-3">
//       <div className="w-14 h-14 flex items-center justify-center rounded-full border-2 border-green-400 bg-gray-900">
//         <img src="/assets/food2.png" className="max-w-14 max-h-14" />
//       </div>
//       <div>
//         <p className="text-white font-medium text-base">
//           Большая упаковка корма
//         </p>
//         <p className="text-gray-400 text-sm mt-1">х100 порций</p>
//         <div className="flex items-center gap-2 mt-1">
//           <span className="text-red-400 text-xs line-through">
//             100 {CURRENCY_CONFIG.tokens.icon}
//           </span>
//           <span className="text-green-400 text-xs font-medium">
//             -10%
//           </span>
//         </div>
//         <p
//           className={`text-xs mt-1 ${
//             !shopState.items.food ? "text-red-400" : "text-green-400"
//           }`}
//         >
//           {!shopState.items.food
//             ? "❌ Куплено"
//             : `✅ ${shopState.items.food} доступно`}
//         </p>
//       </div>
//     </div>
//     <BuyButton
//       onClick={handleBuyItem({ food: 100 }, { tokens: 90 })}
//       disabled={tokens < 90 || !shopState.items.food}
//     >
//       90 {CURRENCY_CONFIG.tokens.icon}
//     </BuyButton>
//   </div>
// </div>

// <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-purple-700 relative overflow-hidden">

//   <div className="relative z-10">
//     <div className="flex items-center justify-between">
//       <div className="flex items-center gap-3">
//         <div className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-purple-400 bg-gray-900">
//           <img
//             src="/assets/lootbox.png"
//             className="max-w-14 max-h-14"
//           />
//         </div>
//         <div>
//           <p className="text-white font-semibold text-base">
//             Таинственный лутбокс
//           </p>
//           <p className="text-gray-400 text-xs mt-1">
//             Случайная жаба или предмет
//           </p>
//           <p className="text-yellow-400 text-xs mt-1">
//             Редкие и эксклюзивные награды!
//           </p>
//           <p
//             className={`text-xs mt-2 ${
//               shopState.items.lootbox === 0
//                 ? "text-red-400"
//                 : "text-green-400"
//             }`}
//           >
//             {shopState.items.lootbox === 0
//               ? "❌ Куплено"
//               : `✅ ${shopState.items.lootbox} доступно`}
//           </p>
//         </div>
//       </div>

//       <div className="flex flex-col gap-2">
//         <button
//           onClick={handleBuyItem({ lootbox: 1 }, { astro_quax: 50 })}
//           disabled={astro_quax < 50 || !shopState.items.lootbox}
//           className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
//             astro_quax >= 50 && shopState.items.lootbox
//               ? "bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white"
//               : "bg-gray-700 text-gray-400 cursor-not-allowed"
//           }`}
//         >
//           50 {CURRENCY_CONFIG.astro_quax.icon}
//         </button>

//       </div>
//     </div>
//   </div>
// </div>
