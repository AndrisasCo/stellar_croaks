import { PregnancyIcon, ToadpoleIcon } from "../../../assets/icons";
import {
  Toad,
  getRarityConfig,
  getGeneticFaultConfig,
} from "../../../models/Toad";
import { ToadGender } from "../../shared/ToadGender";

export const CompactToadItem = ({
  toad,
  isSelected,
  onSelect,
  familyColor,
  onProfileClick,
}: {
  toad: Toad;
  isSelected: boolean;
  onSelect: (toadId: number) => void;
  familyColor?: string;
  onProfileClick: (toad: Toad) => void;
}) => {
  const rarityConfig = getRarityConfig(toad.genes.rarity);
  const geneticFaultConfig = getGeneticFaultConfig(toad.state?.genetic_fault);

  const getHungerColor = (level: number) => {
    if (level >= 80) return "bg-green-500";
    if (level >= 50) return "bg-yellow-500";
    if (level >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div
      id={String(toad.id)}
      onClick={() => onSelect(toad.id)}
      className={`bg-color-main flex flex-col gap-1.5 rounded-xl p-1 border transition-colors cursor-pointer ${
        isSelected
          ? "border-yellow-400 bg-yellow-500/10 shadow-sm shadow-yellow-500/20"
          : "border-slate-600/30 hover:border-slate-500/50"
      }`}
      style={{
        backgroundColor: familyColor ? familyColor : undefined,
        backgroundImage: familyColor ? "none" : undefined,
      }}
    >
      {/* Верхняя строка: пол + имя + индикатор родственников */}
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm flex-shrink-0">
            <ToadGender gender={toad.sex} />
          </span>
          <span className="text-white font-medium text-sm truncate">
            {toad.name}
          </span>
          {toad.pregnancy?.isPregnant && (
            <span className="text-pink-400 flex-shrink-0 text-xs">
              <PregnancyIcon />
            </span>
          )}
          {toad.stage === "toadpole" && (
            <span className="text-blue-400 flex-shrink-0 text-xs">
              <ToadpoleIcon />
            </span>
          )}
        </div>
      </div>

      {/* Средняя строка: шкала голода */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${getHungerColor(
              toad.state.hunger,
            )}`}
            style={{ width: `${toad.state.hunger}%` }}
          />
        </div>
        <span className="text-slate-300 text-xs font-medium w-6 text-right">
          {Math.round(toad.state.hunger)}%
        </span>
      </div>

      {/* Нижняя строка: Качество + поломка + кнопка профиля */}
      <div className="flex items-center justify-between text-xs">
        <div className={`flex items-center gap-1 ${rarityConfig.color}`}>
          <span>{rarityConfig.icon}</span>
          <span className="font-medium">{toad.genes.rarity.toFixed(1)}</span>
        </div>

        <div className={`flex items-center gap-1 ${geneticFaultConfig.color}`}>
          <span>{geneticFaultConfig.icon}</span>
          <span className="font-medium">{toad.state?.genetic_fault || 0}%</span>
        </div>

        {/* Кнопка перехода в профиль */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(toad);
          }}
          className="flex-shrink-0 p-1 text-slate-300 hover:text-white transition-colors"
          title="Перейти в профиль"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
