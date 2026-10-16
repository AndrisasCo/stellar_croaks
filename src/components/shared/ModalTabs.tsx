import { useSoundEffects } from "../../hooks/use-sound-effects";

/**
 * Табы модалки — один вид на все секторы карты колонии.
 *
 * Раньше каждая модалка рисовала переключатель по-своему: где-то «пилюли» в строке,
 * где-то сетка кнопок. Теперь вид один — тот же, что у «Космического рынка»
 * (`modals/ShopMenu/index.tsx`): полоска во всю ширину, у активного таба цветной текст
 * и нижняя граница того же цвета, у остальных — серый текст с подсветкой при наведении.
 *
 * Табы описывает сама модалка: id (по нему она выбирает содержимое), подпись и, если
 * нужно, свой цвет. Последний таб у секторов всегда один — «Данные сектора»
 * (`modals/RoomDataTab.tsx` → `ROOM_DATA_TAB`).
 */
export interface ModalTabItem<T extends string> {
  id: T;
  label: string;
  /** Цвет активного таба: класс `text-*`; полоска берёт из него же цвет `border-*`. */
  color?: string;
}

/** Цвет активного таба по умолчанию — янтарный, как у карточки сектора */
const DEFAULT_TAB_COLOR = "text-amber-400";

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
    <div className="flex border-b border-gray-700">
      {tabs.map((tab) => {
        const color = tab.color ?? DEFAULT_TAB_COLOR;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              playClick();
              onChange(tab.id);
            }}
            className={`flex-1 py-3 relative text-sm font-medium transition-colors ${
              tab.id === active
                ? `${color} border-b-2 ${color.replace("text", "border")}`
                : "text-gray-300 hover:text-gray-200"
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
