import { ReactElement } from "react";
import {
  getRarityConfig,
  getGeneticFaultConfig,
  Toad,
} from "../../models/Toad";
import { ToadGender } from "./ToadGender";
import { PregnancyIcon } from "../../assets/icons";
import { ToadAvatar } from "./ToadAvatar";
import { isToadSick } from "../../utils/disease-manager";
import { isToadBusyOnExpedition } from "../../utils/expedition-manager";
import {
  getToadHp,
  getToadMaxHp,
  getToadHpRatio,
  getToadHpStatusLabel,
} from "../../utils/expedition-config";
import {
  PRODUCTION_HUNGRY_FACTOR,
  PRODUCTION_MIN_HUNGER,
} from "../../utils/gamification-config";

/** Полоска HP жабы (Часть 5: походы ранят жаб) */
const ToadHpRow = ({ toad }: { toad: Toad }) => {
  const maxHp = getToadMaxHp(toad);
  const hp = Math.round(getToadHp(toad));
  const ratio = getToadHpRatio(toad);
  const color =
    ratio <= 0
      ? "bg-red-600"
      : ratio < 0.35
        ? "bg-red-500"
        : ratio < 0.7
          ? "bg-yellow-500"
          : "bg-green-500";

  return (
    <div className="flex w-full mt-2 items-center justify-between gap-3">
      <span className="text-2xs text-slate-300 whitespace-nowrap">
        ❤️ {hp}/{maxHp}
      </span>
      <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Сытость жабы: подпись словами вместо эмодзи-лица.
 *
 * 😐/😵 читались как «настроение», а голод в игре — ресурс с порогом
 * `PRODUCTION_MIN_HUNGER`: ниже него жаба выдаёт треть биомассы (и её подхватывает
 * автокормушка сектора). Порог тот же, поэтому нижняя ступень цвета — оранжевая
 * ровно до 20 %, красная — уже голодный минимум.
 */
const HungerLabel = ({ level }: { level: number }) => {
  const color =
    level >= 80
      ? "text-green-400"
      : level >= 50
        ? "text-yellow-400"
        : level >= PRODUCTION_MIN_HUNGER
          ? "text-orange-400"
          : "text-red-400";

  return (
    <div
      className="flex items-center gap-1 whitespace-nowrap"
      title={
        level <= PRODUCTION_MIN_HUNGER
          ? `Голодный минимум: ниже ${PRODUCTION_MIN_HUNGER} % сытости жаба вырабатывает лишь ${Math.round(
              PRODUCTION_HUNGRY_FACTOR * 100,
            )} % биомассы`
          : "Сытость умножает выработку биомассы: корм на складе, автокормушка сектора кормит сама"
      }
    >
      <span className="text-2xs text-slate-400">Сытость</span>
      <span className={`text-2xs font-medium ${color}`}>
        {Math.round(level)}%
      </span>
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
  ...rest
}: {
  toad: Toad;
  button: ReactElement;
  onClick?: () => void;
  isSelected?: boolean;
  showHunger?: boolean;
  id?: string;
}) => {
  const isSick = isToadSick(toad);

  return (
    <div
      onClick={onClick}
      className={`bg-color-main rounded-2xl py-4 px-2 border ${
        isSelected
          ? "border-yellow-400 bg-yellow-500/10 shadow-sm shadow-yellow-500/20"
          : "border-slate-600/30 hover:border-slate-500/50"
      } `}
      {...rest}
    >
      <div className="flex flex-col gap-3">
        {/* Верхняя часть с аватаркой и кнопкой */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 relative">
            <ToadAvatar toad={toad} />
            {toad.pregnancy?.isPregnant && (
              <span className="absolute -bottom-1 -left-1 text-sm text-pink-400 bg-color-main rounded-full p-0.5">
                <PregnancyIcon />
              </span>
            )}
            {isSick && (
              <span
                className="absolute -top-1 -left-1 text-sm bg-color-main rounded-full p-0.5"
                title="Кибер-заражение: выработка биомассы снижена"
              >
                🦠
              </span>
            )}
            <div>
              <p className="text-white font-medium text-base">{toad.name}</p>
              <div className="flex items-center gap-2 text-sm text-slate-300 mt-1">
                <ToadGender gender={toad.sex} />

                <span>•</span>
                <span>
                  {toad.stage === "adult" ? "Взрослый" : "Головастик"}
                </span>

                {isToadBusyOnExpedition(toad) && (
                  <>
                    <span>•</span>
                    <span className="text-amber-300 text-2xs">🧭 в походе</span>
                  </>
                )}
                {toad.status === "injured" && (
                  <>
                    <span>•</span>
                    <span className="text-red-300 text-2xs">🩹 ранена</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {button}
        </div>

        {/* Качество и генетика в одной строке */}
        {/* Характеристики */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className={`${getRarityConfig(toad.genes?.rarity).color}`}>
            <span className="text-slate-500">Качество:</span>{" "}
            {getRarityConfig(toad.genes?.rarity).icon}{" "}
            <span className="font-semibold">
              {toad.genes?.rarity?.toFixed(1)}
            </span>
          </div>

          <div className="text-slate-300 flex gap-1">
            <span className="text-slate-500">Поломки ДНК:</span>
            <GeneticFaultIcon fault={toad.state?.genetic_fault || 0} />
          </div>

          <div className="text-slate-300">
            <span className="text-slate-500">Размер:</span>{" "}
            {toad.genes?.weight.toFixed(1)}
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">Скорость:</span>{" "}
            {toad.genes?.speed.toFixed(1)}
          </div>

          <div className="text-slate-300">
            <span className="text-slate-500">Аппетит:</span>{" "}
            {toad.genes.hungerRate.toFixed(1)}
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">Плодовитость:</span>{" "}
            {toad.genes.fertility.toFixed(1)}
          </div>
        </div>
      </div>
      {showHunger && (
        <div className="flex w-full mt-2 items-center justify-between gap-3">
          <HungerLabel level={toad.state.hunger} />
          {/* Прогресс-бар сытости: цвет той же лестницы, что у подписи */}
          <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                toad.state.hunger >= 80
                  ? "bg-green-500"
                  : toad.state.hunger >= 50
                    ? "bg-yellow-500"
                    : toad.state.hunger >= PRODUCTION_MIN_HUNGER
                      ? "bg-orange-500"
                      : "bg-red-500"
              }`}
              style={{ width: `${toad.state.hunger}%` }}
            />
          </div>
        </div>
      )}
      {(toad.hp !== undefined || toad.status === "injured") && (
        <ToadHpRow toad={toad} />
      )}
    </div>
  );
};
