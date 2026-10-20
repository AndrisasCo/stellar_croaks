import { useEffect, useState } from "react";
import { useNow } from "../../hooks/use-now";
import { Toad } from "../../models/Toad";
import {
  HOSPITAL_DISEASE_SPEED,
  formatDiseaseTimeLeft,
  getDiseaseRecoveryInfo,
} from "../../utils/hospital";
import { Tooltip } from "./Tooltip";
import { CurrencyIcon } from "./CurrencyIcon";

/**
 * Полоса кибер-болезни: насколько жаба уже выздоровела и сколько ей осталось.
 *
 * Один компонент на карточку жабы и на списки Медотсека: в обоих местах игрок решает,
 * ждать или платить за мгновенный курс, поэтому прогресс и остаток должны считаться
 * одинаково. На койке Медотсека срок идёт в `HOSPITAL_DISEASE_SPEED` раза быстрее —
 * это видно и в отсчёте, и в подписи.
 *
 * Жаба здорова — компонент ничего не рисует.
 */
export const DiseaseBar: React.FC<{
  toad: Toad;
  /** Жаба лечится на койке Медотсека: срок болезни ускорен */
  inHospital?: boolean;
  className?: string;
}> = ({ toad, inHospital = false, className }) => {
  // Отсчёт в минутах: обновляем часы чаще, чем игровой тик болезней
  const now = useNow(30_000);
  const recovery = getDiseaseRecoveryInfo(toad, inHospital, now);
  /** Сводка по болезни: что происходит, заразна ли и чем лечится */
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // В карточке жабы можно листать жаб стрелками: сводка не должна «переезжать»
  // на следующую жабу открытой.
  useEffect(() => {
    setIsInfoOpen(false);
  }, [toad.id]);

  if (!recovery) {
    return null;
  }

  const percent = Math.round(recovery.progress);
  const contagionPercent = Math.round(recovery.disease.contagionPerHour * 100);
  const penaltyPercent = Math.round(recovery.disease.productionPenalty * 100);

  return (
    <div
      className={`relative rounded-xl border border-orange-500/50 bg-orange-950/30 p-2 ${
        className || ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {/* Название болезни — кнопка: по клику раскрывается краткая сводка */}
        <button
          type="button"
          onClick={() => setIsInfoOpen((open) => !open)}
          aria-expanded={isInfoOpen}
          title="Что это за болезнь, заразна ли она и как лечится"
          className="flex min-w-0 items-center gap-1.5 rounded-lg text-left text-xs font-medium uppercase text-orange-300 transition-colors hover:text-orange-100"
        >
          <span>{recovery.disease.icon}</span>
          <span className="truncate">{recovery.disease.name}</span>
          <span
            aria-hidden
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none ${
              isInfoOpen
                ? "border-orange-300/70 text-orange-100"
                : "border-orange-400/40 text-orange-300/80"
            }`}
          >
            i
          </span>
        </button>
        <span className="text-2xs font-semibold text-orange-200">
          {percent} %
        </span>
      </div>

      <Tooltip
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title={`${recovery.disease.icon} ${recovery.disease.name}`}
      >
        <p className="text-2xs leading-snug text-slate-300">
          {recovery.disease.description}
        </p>

        <div className="mt-2 space-y-1 text-2xs">
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-slate-400">Заразность</span>
            <span
              className={`text-right font-medium ${
                inHospital ? "text-emerald-300" : "text-orange-200"
              }`}
            >
              {inHospital
                ? "изолирована — соседей не заражает"
                : `${contagionPercent} % в час для соседей по биоподу`}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-slate-400">Выработка биомассы</span>
            <span className="text-right font-medium text-rose-200">
              −{penaltyPercent} %
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-slate-400">Срок</span>
            <span className="text-right text-slate-200">
              {recovery.disease.durationHours} ч · осталось{" "}
              {formatDiseaseTimeLeft(recovery.remainingMs)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0 text-slate-400">Мгновенный курс</span>
            <span className="inline-flex items-center gap-1 text-right font-medium text-sky-200">
              {recovery.disease.cureTokens}
              <CurrencyIcon currency="tokens" className="h-3 w-3" />
            </span>
          </div>
        </div>

        <p className="mt-2 text-2xs leading-snug text-slate-400">
          {inHospital
            ? `Пациент на койке: болезнь идёт в ${HOSPITAL_DISEASE_SPEED} раза быстрее и не передаётся соседям.`
            : `Изолируйте организм в медотсеке, это ускорит выздоровление и предотвратит распространение болезни`}
        </p>
      </Tooltip>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-600/50">
        <div
          className="h-2 rounded-full bg-orange-500 transition-all duration-500"
          style={{ width: `${recovery.progress}%` }}
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-2xs">
        <span className="text-orange-200">
          Осталось: {formatDiseaseTimeLeft(recovery.remainingMs)}
        </span>
        <span className="text-orange-200/70">
          идет выздоровление · {inHospital ? "не заразен" : "заразен"}
        </span>
      </div>
    </div>
  );
};

export default DiseaseBar;
