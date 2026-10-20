import { getRarityConfig, Toad } from "../../models/Toad";
import {
  getDissolveBatchYield,
  getDissolveWarnings,
  getDissolveYield,
} from "../../utils/dissolve-manager";
import { ToadGender } from "./ToadGender";

interface DissolveConfirmProps {
  /** Жабы, которые уйдут в переработку */
  toads: Toad[];
  /** Заголовок окна */
  title?: string;
  /** Текст кнопки подтверждения */
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Единственное подтверждение необратимого разбора жаб в биомассу
 * (Диссоциатор). Используется из модалки Диссоциатора, карточки жабы
 * и склада — чтобы текст и предупреждения совпадали.
 */
export const DissolveConfirm = ({
  toads,
  title = "Жабы уйдут в переработку",
  confirmLabel = "Разобрать на биомассу",
  onConfirm,
  onCancel,
}: DissolveConfirmProps) => {
  const total = getDissolveBatchYield(toads);
  const warnings = getDissolveWarnings(toads);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-color-main rounded-2xl border-2 border-amber-500/50 p-5 max-w-sm w-full mx-auto max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-3">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
            ♻️
          </div>
          <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
          <p className="text-slate-200 text-sm leading-snug">
            Диссоциатор мгновенно переработает выбранных жаб в биомассу. Жабы
            исчезнут навсегда — вернуть их будет невозможно.
          </p>
        </div>

        <div className="mb-3 rounded-xl bg-amber-900/25 border border-amber-500/40 p-2 text-left max-h-[30vh] overflow-y-auto">
          <div className="text-1xs text-amber-200/90 mb-1">
            Уйдут в переработку {toads.length}:
          </div>
          <ul className="text-xs text-white flex flex-col gap-1">
            {toads.map((toad) => (
              <li key={toad.id} className="flex items-center gap-2">
                <ToadGender gender={toad.sex} />
                <span
                  className={`truncate font-medium ${getRarityConfig(
                    toad.genes?.rarity
                  ).color}`}
                >
                  {toad.name}
                </span>
                <span className="text-slate-400 text-2xs shrink-0">
                  {toad.stage === "adult" ? "" : "🐛 "}
                  {toad.sex === "neuter" ? "⚪ " : ""}
                </span>
                <span className="text-amber-300 text-2xs shrink-0 ml-auto">
                  +{getDissolveYield(toad)} 🧪
                </span>
                {toad.pregnancy?.isPregnant && (
                  <span className="text-2xs text-pink-300 shrink-0">
                    🍼 потомство пропадёт
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {warnings.length > 0 && (
          <div className="mb-3 rounded-xl bg-red-900/25 border border-red-500/40 p-2">
            <ul className="text-2xs text-red-200 flex flex-col gap-1">
              {warnings.map((warning) => (
                <li key={warning.text} className="flex gap-1">
                  <span>{warning.icon}</span>
                  <span>{warning.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-600/30 px-3 py-2">
          <span className="text-slate-200 text-sm">Лаборатория получит</span>
          <span className="text-amber-300 font-bold">+{total} 🧪</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-medium py-3 rounded-xl transition-all duration-300"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
