import { ReactElement } from "react";
import { getRarityConfig, RARITY_CONFIG, Toad } from "../../../models/toad";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../../utils/constants";
import { ToadGender } from "../../shared/ToadGender";
import { PregnancyIcon } from "../../../assets/icons";

export const ToadItem = ({
  toad,
  button,
  onClick,
  isSelected,
}: {
  toad: Toad;
  button: ReactElement;
  onClick?: () => void;
  isSelected?: boolean;
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-2xl py-4 px-2 border ${
        isSelected
          ? "border-yellow-400 bg-yellow-500/10 shadow-sm shadow-yellow-500/20"
          : "border-gray-600/30 hover:border-gray-500/50"
      } `}
    >
      <div className="flex flex-col gap-3">
        {/* Верхняя часть с аватаркой и кнопкой */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 relative">
            <div
              className="w-10 h-10 rounded-full border-2 border-green-400"
              style={{ backgroundColor: toad.genes?.colors[0] }}
            />
            {toad.pregnancy?.isPregnant && (
              <span className="absolute -bottom-1 -left-1 text-sm text-pink-400 bg-gray-800 rounded-full p-0.5">
                <PregnancyIcon />
              </span>
            )}
            <div>
              <p className="text-white font-medium text-base">{toad.name}</p>
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                <ToadGender gender={toad.sex} />

                <span>•</span>
                <span>
                  {toad.stage === "adult" ? "Взрослый" : "Головастик"}
                </span>
              </div>
            </div>
          </div>

          {button}
        </div>
        <div className={`${getRarityConfig(toad.genes?.rarity).color}`}>
          <span className="text-gray-500">Редкость:</span>{" "}
          {getRarityConfig(toad.genes?.rarity).icon}{" "}
          {toad.genes?.rarity.toFixed(1)}
        </div>
        {/* Характеристики */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-400">
            <span className="text-gray-500">Размер:</span>{" "}
            {toad.genes?.weight.toFixed(1)}
          </div>
          <div className="text-gray-400">
            <span className="text-gray-500">Скорость:</span>{" "}
            {toad.genes?.speed.toFixed(1)}
          </div>

          <div className="text-gray-400">
            <span className="text-gray-500">Аппетит:</span>{" "}
            {toad.genes.hungerRate.toFixed(1)}
          </div>
          <div className="text-gray-400">
            <span className="text-gray-500">Плодовитость:</span>{" "}
            {toad.genes.fertility.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};
