import { ClickButton } from "./ClickButton";

interface DissolveBlockedModalProps {
  /** Сектор уже стоит, но обесточен: к подсказке добавляется строка про ток */
  unpowered?: boolean;
  onClose: () => void;
}

/**
 * Окно-подсказка «Диссоциатор недоступен».
 *
 * Разбор жабы в биомассу возможен только в построенном и запитанном секторе
 * (`hooks/use-dissociator.ts`): пока сектора нет, кнопки разбора показывают это окно
 * вместо подтверждения, а не молча ничего не делают. Кнопка одна — ок-модалка ничего
 * не решает, а объясняет, чего не хватает.
 */
export const DissolveBlockedModal = ({
  unpowered = false,
  onClose,
}: DissolveBlockedModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="ui-panel relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-none border-amber-400/40 bg-slate-950/90 p-4 sm:p-5">
      <div className="border-b border-amber-400/20 pb-3">
        <p className="ui-kicker text-amber-300/80">// сектор недоступен</p>
        <div className="mt-1.5 flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber-400/40 bg-amber-500/15 text-xl"
          >
            🚫
          </span>
          <div className="min-w-0">
            <h3 className="font-mono text-base font-bold uppercase leading-tight tracking-[0.04em] text-white">
              Диссоциатор недоступен
            </h3>
            <p className="mt-1 text-2xs leading-snug text-slate-400">
              Чтобы разобрать жабу на биомассу, необходимо построить
              диссоциатор.
            </p>
          </div>
        </div>

        {unpowered && (
          <p className="mt-3 border-l-2 border-amber-400/60 bg-amber-500/10 px-2.5 py-1.5 text-2xs leading-snug text-amber-200">
            ⚡ Сектор уже стоит, но обесточен: подведите к нему ток — и разбор
            заработает.
          </p>
        )}
      </div>

      <ClickButton
        className="click-button ui-button-secondary mt-4 w-full py-3"
        onClick={onClose}
      >
        Ок
      </ClickButton>
    </div>
  </div>
);
