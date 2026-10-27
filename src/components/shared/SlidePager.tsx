import { KeyboardEvent, ReactNode } from "react";
import { ClickButton } from "./ClickButton";

/**
 * Постраничный слайдер «одна страница — один слайд».
 *
 * Листается только явными действиями: стрелками ‹ › под лентой, точками и
 * клавишами ←/→. Свайпов и инерционной прокрутки нет — лента не скроллится
 * вообще, страницы едут на `transform`, поэтому случайный жест не уведёт
 * слайд и не потащит за собой модалку. Активная страница **управляемая**:
 * компонент её не хранит, а сообщает `onIndexChange` — в модалке походов это
 * выбор сектора, поэтому «страница на экране» и «сектор, который отправят»
 * не могут разойтись.
 */
interface SlidePagerProps {
  /** Страницы: одна страница — один слайд шириной с ленту */
  slides: ReactNode[];
  /** Активная страница */
  index: number;
  /** Новая страница: стрелки и точки сообщают её наверх */
  onIndexChange: (index: number) => void;
  /** Подписи страниц — подсказки точек и стрелок */
  labels?: string[];
  className?: string;
  /** Подсказка над лентой */
  hint?: ReactNode;
}

/** Кнопка-стрелка под лентой: заметная, но приглушённая на краях */
const arrowClass = (disabled: boolean) =>
  `flex h-10 w-10 shrink-0 items-center justify-center rounded-none border text-2xl leading-none transition-colors duration-300 ${
    disabled
      ? "border-slate-700/40 bg-slate-900/40 text-slate-600"
      : "border-amber-400/60 bg-slate-800/90 text-amber-100 hover:bg-slate-700/90 active:bg-slate-600"
  }`;

export const SlidePager = ({
  slides,
  index,
  onIndexChange,
  labels,
  className = "",
  hint,
}: SlidePagerProps) => {
  const lastIndex = slides.length - 1;

  /** Шаг на страницу вперёд/назад — стрелки и клавиши ←/→ */
  const step = (delta: number) => {
    const next = Math.min(lastIndex, Math.max(0, index + delta));

    if (next !== index) {
      onIndexChange(next);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {hint}

      {/* overflow-hidden — не скролл-контейнер с snap, а просто окно ленты:
          страницы едут трансформом, вертикальный жест проходит к модалке */}
      <div
        role="group"
        aria-label="Страницы: переключайте стрелками"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="overflow-hidden rounded-none outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60"
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, page) => (
            <div
              key={page}
              aria-hidden={page !== index}
              className="w-full shrink-0"
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {/* Стрелки на одной линии с точками: главный способ листать */}
      <div className="flex items-center justify-center gap-3">
        <ClickButton
          onClick={() => step(-1)}
          disabled={index === 0}
          aria-label="Предыдущая страница"
          title={labels?.[index - 1] ?? "Предыдущая страница"}
          className={arrowClass(index === 0)}
        >
          ‹
        </ClickButton>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {slides.map((_, page) => (
              <ClickButton
                key={page}
                onClick={() => onIndexChange(page)}
                aria-label={`Страница ${page + 1}`}
                title={labels?.[page]}
                className={`h-2 rounded-none transition-all duration-300 ${
                  page === index
                    ? "w-5 bg-amber-400"
                    : "w-2 bg-slate-600 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>
          <span
            aria-live="polite"
            className="text-2xs tabular-nums text-slate-400"
          >
            {index + 1} / {slides.length}
          </span>
        </div>

        <ClickButton
          onClick={() => step(1)}
          disabled={index === lastIndex}
          aria-label="Следующая страница"
          title={labels?.[index + 1] ?? "Следующая страница"}
          className={arrowClass(index === lastIndex)}
        >
          ›
        </ClickButton>
      </div>
    </div>
  );
};
