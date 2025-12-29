import { CURRENCY_CONFIG } from "../../../../utils/constants";
import { ShopItem } from "./use-shop";
import { LootboxDetails } from "./LootboxDetails";
import { useModal } from "../../../ModalContext";

export const BuyButton = (props: { item: ShopItem }) => {
  const { item } = props;
  const { openModal } = useModal();

  const mapRarityStyles = {
    common: {
      border: "bg-color-main border-gray-700",
      icon: "border-green-400",
      shadow: "0 0  1px  1px #00ff5233",
    },
    uncommon: {
      border: "bg-color-main border-blue-700",
      icon: "border-blue-400",
      shadow: "0 0  1px  1px #0067ff33",
    },
    rare: {
      border: "bg-color-main border-purple-700 relative overflow-hidden",
      icon: "border-purple-400",
      shadow: "0 0  1px  1px #eb00ff33",
    },
  };

  const className = mapRarityStyles[item.rarity];

  return (
    <>
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
              <p className="text-sm text-gray-300 font-medium ">
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
                onClick={() => {
                  openModal(() => <LootboxDetails />);
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-color-second hover:bg-gray-600 text-gray-200 hover:text-white transition-colors"
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
