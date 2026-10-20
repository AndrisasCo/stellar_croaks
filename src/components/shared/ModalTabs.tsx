import { useSoundEffects } from "../../hooks/use-sound-effects";

/**
 * Табы модалки — один вид на все секторы карты колонии.
 *
 * Раньше каждая модалка рисовала переключатель по-своему: где-то «пилюли» в строке,
 * где-то сетка кнопок. Теперь вид один — тот же, что у «Космического рынка»
 * (`modals/ShopMenu/index.tsx`): полоска во всю ширину, у активного таба циановый текст
 * и нижняя граница, у остальных — серый текст с подсветкой при наведении.
 *
 * Табы описывает сама модалка: id (по нему она выбирает содержимое) и подпись.
 * Активный таб всегда один — общий циановый акцент (`text-cyan-300` + полоска
 * `border-cyan-400`). Последний таб у секторов всегда один — «Данные сектора»
 * (`modals/RoomDataTab.tsx` → `ROOM_DATA_TAB`).
 */
export interface ModalTabItem<T extends string> {
  id: T;
  label: string;
  /** Таб недоступен: у обесточенного сектора так закрыты все рабочие вкладки. */
  disabled?: boolean;
  /** Почему таб недоступен — показывается в `title` и подсказывает игроку причину. */
  disabledHint?: string;
}

interface ModalTabsProps<T extends string> {
  tabs: ModalTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function ModalTabs<T extends string>({
  tabs,
  active,
  onChange,
}: ModalTabsProps<T>) {
  const { playClick } = useSoundEffects();

  return (
    <div className="flex border-b border-slate-700/60">
      {tabs.map((tab) => {
        const disabled = tab.disabled === true;

        return (
          <button
            key={tab.id}
            type="button"
            disabled={disabled}
            aria-disabled={disabled}
            title={disabled ? tab.disabledHint : undefined}
            onClick={() => {
              if (disabled) {
                return;
              }

              playClick();
              onChange(tab.id);
            }}
            className={`flex-1 py-3 relative text-sm font-medium transition-colors ${
              disabled
                ? "cursor-not-allowed text-slate-600 opacity-50"
                : tab.id === active
                  ? "text-cyan-300 border-b-2 border-cyan-400"
                  : "text-slate-300 hover:text-slate-100"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default ModalTabs;
