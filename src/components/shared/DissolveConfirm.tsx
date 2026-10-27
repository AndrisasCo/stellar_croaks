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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="ui-panel relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-none border-amber-400/40 bg-slate-950/90 p-4 sm:p-5">
        <div className="mb-3 border-b border-amber-400/20 pb-3 text-left">
          <p className="ui-kicker text-amber-300/80">
            // необратимая операция
          </p>
          <div className="mt-1.5 flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber-400/40 bg-amber-500/15 text-xl"
            >
              ♻️
            </span>
            <div className="min-w-0">
              <h3 className="font-mono text-base font-bold uppercase leading-tight tracking-[0.04em] text-white">
                {title}
              </h3>
              <p className="mt-1 text-2xs leading-snug text-slate-400">
                Диссоциатор мгновенно переработает выбранных жаб в биомассу.
                Жабы исчезнут навсегда — вернуть их будет невозможно.
              </p>
            </div>
          </div>
        </div>

        <div className="ui-panel mb-3 max-h-[30vh] overflow-y-auto rounded-none border-amber-400/30 bg-amber-500/5 p-2 text-left">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-3xs font-semibold uppercase tracking-[0.14em] text-amber-200/80">
              Уйдут в переработку
            </span>
            <span className="ui-badge border-amber-400/30 bg-amber-500/10 text-amber-200">
              {toads.length} шт.
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-xs text-white">
            {toads.map((toad) => (
              <li
                key={toad.id}
                className="flex items-center gap-2 border-t border-white/5 pt-1 first:border-0 first:pt-0"
              >
                <ToadGender gender={toad.sex} />
                <span
                  className={`truncate font-medium ${getRarityConfig(
                    toad.genes?.rarity,
                  ).color}`}
                >
                  {toad.name}
                </span>
                <span className="shrink-0 text-2xs text-slate-400">
                  {toad.stage === "adult" ? "" : "🐛 "}
                  {toad.sex === "neuter" ? "⚪ " : ""}
                </span>
                <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-amber-300">
                  +{getDissolveYield(toad)} 🧪
                </span>
                {toad.pregnancy?.isPregnant && (
                  <span className="shrink-0 text-3xs text-pink-300">
                    🍼 потомство пропадёт
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {warnings.length > 0 && (
          <div className="ui-panel mb-3 rounded-none border-rose-400/30 bg-rose-500/10 p-2">
            <ul className="flex flex-col gap-1 text-2xs text-rose-200">
              {warnings.map((warning) => (
                <li key={warning.text} className="flex gap-1.5">
                  <span aria-hidden="true">{warning.icon}</span>
                  <span>{warning.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="ui-panel mb-4 flex items-center justify-between gap-3 rounded-none bg-slate-900/70 px-3 py-2">
          <span className="text-2xs uppercase tracking-[0.12em] text-slate-400">
            Лаборатория получит
          </span>
          <span className="font-mono text-sm font-bold tabular-nums text-amber-300">
            +{total} 🧪
          </span>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="click-button ui-button-secondary flex-1 py-3"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="click-button ui-button-danger flex-1 py-3"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
