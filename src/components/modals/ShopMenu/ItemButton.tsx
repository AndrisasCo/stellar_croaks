import { CURRENCY_CONFIG } from "../../../utils/constants";
import { ClickButton } from "../../shared/ClickButton";

export const ItemButton = (props) => {
  const { item } = props;
  const mapColor = {
    common: "gray-300",
    uncommon: "blue-300",
    rare: "purple-300",
  };

  const color = mapColor[item.rarity];

  return (
    <div className="flex gap-4 leading-none ">
      <div className="w-20 h-20 relative rounded-md flex items-center justify-center">
        <div
          className={`absolute  border-l-[1px] border-t-[1px] rounded-ss-md top-0 left-0 w-4 h-4  border-${color}`}
        />
        <div
          className={`absolute border-l-[1px] border-t-[1px] rotate-90 rounded-ss-md top-0 right-0 w-4 h-4  border-${color}`}
        />
        <div
          className={`absolute border-l-[1px] border-t-[1px] rotate-180 rounded-ss-md bottom-0 right-0 w-4 h-4  border-${color}`}
        />
        <div
          className={`absolute border-l-[1px] border-t-[1px] rotate-[270deg] rounded-ss-md bottom-0 left-0 w-4 h-4  border-${color}`}
        />
        <div
          className="w-1 h-1 absolute"
          style={{
            boxShadow: "0px 0px 8px #c89ade inset, 0px 0px 8px #c89ade",
          }}
        />
        <img className="absolute max-w-[70px] max-h-[70px]" src={item.icon} />
      </div>

      <div className="flex flex-col justify-between">
        <span className="h-4">{item.name}</span>
        <span className="h-4">
          <span>
            {item.price} {CURRENCY_CONFIG[item.currency].icon}
          </span>

          <p
            className={`text-xs mt-1 ${
              item.left === 0 ? "text-red-400" : "text-green-400"
            }`}
          >
            {item.left === 0 ? "❌ Куплено" : `✅ ${item.left} доступно`}
          </p>
        </span>
        <ClickButton
          onClick={item.onClick}
          style={{
            boxShadow: "0px 0px 8px #c89ade inset, 0px 0px 8px #c89ade",
          }}
          className={`transition-colors flex items-center justify-center text-lg border-${color} border-[1px] text-white rounded-md p-1 `}
        >
          купить
        </ClickButton>
      </div>
    </div>
  );
};
