import { useNow } from "../../hooks/use-now";
import { Toad } from "../../models/Toad";
import {
  HOSPITAL_DISEASE_SPEED,
  formatDiseaseTimeLeft,
  getDiseaseRecoveryInfo,
} from "../../utils/hospital";

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

  if (!recovery) {
    return null;
  }

  const percent = Math.round(recovery.progress);
  const speedNote = inHospital
    ? `На койке срок идёт в ${HOSPITAL_DISEASE_SPEED} раза быстрее`
    : `В Медотсеке срок идёт в ${HOSPITAL_DISEASE_SPEED} раза быстрее`;

  return (
    <div
      className={`rounded-xl border border-orange-500/50 bg-orange-950/30 p-2 ${
        className || ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-orange-300">
          <span>{recovery.disease.icon}</span>
          <span>{recovery.disease.name}</span>
        </p>
        <span className="text-2xs font-semibold text-orange-200">
          {percent} %
        </span>
      </div>

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
        <span className="text-orange-200/70">{speedNote}</span>
      </div>
    </div>
  );
};

export default DiseaseBar;
