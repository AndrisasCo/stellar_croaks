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
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-color-main rounded-2xl border-2 border-amber-500/50 p-5 max-w-sm w-full mx-auto max-h-[90vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
          🚫
        </div>
        <h3 className="text-white font-bold text-lg mb-2">
          Диссоциатор недоступен
        </h3>
        <p className="text-slate-200 text-sm leading-snug">
          Чтобы разобрать жабу на биомассу необходимо построить диссоциатор.
        </p>
        {unpowered && (
          <p className="text-2xs text-amber-200 mt-2 leading-snug">
            ⚡ Сектор уже стоит, но обесточен: подведите к нему ток — и разбор
            заработает.
          </p>
        )}
      </div>

      <ClickButton
        className="w-full bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold py-3 rounded-xl transition-all duration-300"
        onClick={onClose}
      >
        Ок
      </ClickButton>
    </div>
  </div>
);
