import { ReactElement } from "react";
import {
  getRarityConfig,
  getGeneticFaultConfig,
  Toad,
} from "../../models/toad";
import { ToadGender } from "./ToadGender";
import { PregnancyIcon } from "../../assets/icons";

const HungerIcon = ({ level }: { level: number }) => {
  const getHungerColor = (level: number) => {
    if (level >= 80) return "text-green-400";
    if (level >= 50) return "text-yellow-400";
    if (level >= 20) return "text-orange-400";
    return "text-red-400";
  };

  const getHungerIcon = (level: number) => {
    if (level >= 80) return "🤤";
    if (level >= 50) return "😐";
    if (level >= 20) return "😟";
    return "😵";
  };

  return (
    <div className={`flex items-center gap-1 ${getHungerColor(level)}`}>
      <span className="text-xs">{getHungerIcon(level)}</span>
      <span className="text-[10px] font-medium">{level}%</span>
    </div>
  );
};

const GeneticFaultIcon = ({ fault }: { fault: number }) => {
  const config = getGeneticFaultConfig(fault);

  return (
    <div className={`flex items-center gap-1 ${config.color}`}>
      <span>{config.icon}</span>
      <span>{fault}%</span>
    </div>
  );
};

export const ToadItem = ({
  toad,
  button,
  onClick,
  isSelected,
  showHunger,
}: {
  toad: Toad;
  button: ReactElement;
  onClick?: () => void;
  isSelected?: boolean;
  showHunger?: boolean;
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

        {/* Редкость и генетика в одной строке */}
        {/* Характеристики */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className={`${getRarityConfig(toad.genes?.rarity).color}`}>
            <span className="text-gray-500">Редкость:</span>{" "}
            {getRarityConfig(toad.genes?.rarity).icon}{" "}
            <span className="font-semibold">
              {toad.genes?.rarity.toFixed(1)}
            </span>
          </div>

          <div className="text-gray-400 flex gap-1">
            <span className="text-gray-500">Поломки ДНК:</span>
            <GeneticFaultIcon fault={toad.state?.genetic_fault || 0} />
          </div>

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
      {showHunger && (
        <div className="flex w-full mt-2 items-center justify-between gap-3">
          <HungerIcon level={toad.state.hunger} />
          {/* Прогресс-бар голода */}
          <div className="flex-1 h-1.5 bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                toad.state.hunger >= 80
                  ? "bg-green-500"
                  : toad.state.hunger >= 50
                  ? "bg-yellow-500"
                  : toad.state.hunger >= 20
                  ? "bg-orange-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${toad.state.hunger}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
