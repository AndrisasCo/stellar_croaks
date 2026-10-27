import { useSoundEffects } from "../../hooks/use-sound-effects";
import { HUD_TONES, useHudTone } from "./DataGrid";

/**
 * Табы модалки — один вид на все секторы карты колонии.
 *
 * Раньше каждая модалка рисовала переключатель по-своему: где-то «пилюли» в строке,
 * где-то сетка кнопок. Теперь вид один — тот же, что у «Космического рынка»
 * (`modals/ShopMenu/index.tsx`): полоска во всю ширину, у активного таба циановый текст
 * и нижняя граница, у остальных — серый текст с подсветкой при наведении.
 *
 * Табы описывает сама модалка: id (по нему она выбирает содержимое) и подпись.
 * Активный таб окрашен в акцент сектора (`HudToneProvider` в шапке модалки):
 * у Контура — изумруд, у Репродуктора — розовый, у лаборатории — фиолетовый.
 * На телефоне полоска табов скроллится по горизонтали, поэтому длинные подписи
 * не сжимаются в нечитаемые столбики. `shrink-0` обязателен: в колонке `#modal`
 * элемент с `overflow-x-auto` иначе сжимается по высоте до 1px, и табы выглядят
 * пропавшими. Последний таб у секторов всегда один — «Данные сектора»
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
  const tone = useHudTone();
  const style = HUD_TONES[tone];

  return (
    <div className="mb-4 flex shrink-0 overflow-x-auto border-b border-slate-700/60">
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
            className={`relative min-w-0 flex-none whitespace-nowrap px-3 py-2.5 text-xs font-medium transition-colors sm:flex-1 sm:py-3 sm:text-sm ${
              disabled
                ? "cursor-not-allowed text-slate-600 opacity-50"
                : tab.id === active
                  ? `${style.tabText} border-b-2 ${style.tabBorder}`
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
