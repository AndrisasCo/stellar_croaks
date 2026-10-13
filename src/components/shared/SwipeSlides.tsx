import { ReactNode, useCallback, useEffect, useRef } from "react";
import { ClickButton } from "./ClickButton";

/**
 * Горизонтальный слайдер «одна страница — один слайд».
 *
 * Лента — обычный `overflow-x-auto` со scroll-snap: свайп пальцем, прокрутка трекпадом
 * и перетаскивание работают нативно, а стрелки ‹ › и точки внизу нужны для десктопа и для
 * точного перехода на нужную страницу. Активная страница **управляемая**: слайдер её не
 * хранит, а сообщает `onIndexChange` — в модалке походов это выбор сектора, поэтому
 * «страница на экране» и «сектор, который отправят» не могут разойтись.
 *
 * Пока идёт программная прокрутка (стрелка, точка, смена индекса снаружи), промежуточные
 * страницы не считаются выбором игрока: иначе плавный проезд через пять страниц
 * «прощёлкивал» бы все промежуточные сектора. Пока палец на ленте, страница тоже не
 * выбирается — выбор происходит по финальной позиции, куда ленту докрутил snap.
 */
interface SwipeSlidesProps {
  /** Страницы: одна страница — один слайд шириной с ленту */
  slides: ReactNode[];
  /** Активная страница */
  index: number;
  /** Новая страница: свайп, стрелки и точки сообщают её наверх */
  onIndexChange: (index: number) => void;
  /** Подписи страниц — подсказки точек и стрелок */
  labels?: string[];
  className?: string;
  /** Подсказка над лентой (например «листайте вправо-влево») */
  hint?: ReactNode;
}

/** Пауза без прокрутки, после которой считаем, что лента остановилась, мс */
const SETTLE_MS = 120;

export const SwipeSlides = ({
  slides,
  index,
  onIndexChange,
  labels,
  className = "",
  hint,
}: SwipeSlidesProps) => {
  const trackRef = useRef<HTMLDivElement | null>(null);

  /** Свежий индекс для обработчиков прокрутки: они живут вне цикла рендера */
  const indexRef = useRef(index);
  indexRef.current = index;

  /** Идёт программная прокрутка: промежуточные страницы — не выбор игрока */
  const programmaticRef = useRef(false);
  /** Палец/мышь на ленте: пока тянут, страницу не выбираем — ждём, куда встанет snap */
  const draggingRef = useRef(false);
  /** Первый проход — доезжаем до активной страницы без анимации */
  const firstRef = useRef(true);
  const settleTimerRef = useRef<number | null>(null);

  const lastIndex = slides.length - 1;

  const scrollToPage = useCallback((page: number, behavior: ScrollBehavior) => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const target = page * track.clientWidth;

    if (Math.abs(track.scrollLeft - target) < 2) {
      return;
    }

    programmaticRef.current = true;
    track.scrollTo({ left: target, behavior });
  }, []);

  // Страницу сменили снаружи (стрелка, точка, смена данных) — подтягиваем ленту к ней
  useEffect(() => {
    scrollToPage(index, firstRef.current ? "auto" : "smooth");
    firstRef.current = false;
  }, [index, scrollToPage]);

  // Поворот экрана и ресайз меняют ширину страницы — возвращаемся на активную
  useEffect(() => {
    const handleResize = () => scrollToPage(indexRef.current, "auto");

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [scrollToPage]);

  useEffect(
    () => () => {
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    []
  );

  /** Лента остановилась: сообщаем страницу, у которой она встала */
  const handleScroll = () => {
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;

      const track = trackRef.current;

      if (!track) {
        return;
      }

      if (draggingRef.current) {
        // Палец ещё на ленте: страницу выберем, когда он её отпустит (snap докрутит ленту)
        return;
      }

      if (programmaticRef.current) {
        programmaticRef.current = false;
        return;
      }

      const width = Math.max(1, track.clientWidth);
      const page = Math.min(
        lastIndex,
        Math.max(0, Math.round(track.scrollLeft / width))
      );

      if (page !== indexRef.current) {
        onIndexChange(page);
      }
    }, SETTLE_MS);
  };

  /** Шаг на страницу вперёд/назад — стрелки и клавиши ←/→ */
  const step = (delta: number) => {
    const next = Math.min(lastIndex, Math.max(0, indexRef.current + delta));

    if (next !== indexRef.current) {
      onIndexChange(next);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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

      <div className="relative">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onTouchStart={() => {
            draggingRef.current = true;
          }}
          onTouchEnd={() => {
            draggingRef.current = false;
          }}
          onTouchCancel={() => {
            draggingRef.current = false;
          }}
          onMouseDown={() => {
            draggingRef.current = true;
          }}
          onMouseUp={() => {
            draggingRef.current = false;
          }}
          onMouseLeave={() => {
            draggingRef.current = false;
          }}
          tabIndex={0}
          role="group"
          aria-label="Слайдер: одна страница на слайд, листайте вправо-влево"
          className="no-overscroll flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60"
        >
          {slides.map((slide, page) => (
            <div key={page} className="w-full shrink-0 snap-start">
              {slide}
            </div>
          ))}
        </div>

        {/* Стрелки для десктопа: на краю ленты их просто нет */}
        {index > 0 && (
          <ClickButton
            onClick={() => step(-1)}
            aria-label="Предыдущая страница"
            title={labels?.[index - 1]}
            className="absolute left-0.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-500/40 bg-slate-900/80 text-lg leading-none text-amber-100 transition-colors duration-300 hover:bg-slate-800/90"
          >
            ‹
          </ClickButton>
        )}
        {index < lastIndex && (
          <ClickButton
            onClick={() => step(1)}
            aria-label="Следующая страница"
            title={labels?.[index + 1]}
            className="absolute right-0.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-500/40 bg-slate-900/80 text-lg leading-none text-amber-100 transition-colors duration-300 hover:bg-slate-800/90"
          >
            ›
          </ClickButton>
        )}
      </div>

      {/* Точки-навигатор: тап переносит сразу на нужную страницу */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center gap-1.5">
          {slides.map((_, page) => (
            <ClickButton
              key={page}
              onClick={() => onIndexChange(page)}
              aria-label={`Страница ${page + 1}`}
              title={labels?.[page]}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                page === index
                  ? "w-4 bg-amber-400"
                  : "w-1.5 bg-gray-600 hover:bg-gray-500"
              }`}
            />
          ))}
        </div>
        <span className="text-3xs text-gray-400">
          {index + 1} / {slides.length}
        </span>
      </div>
    </div>
  );
};
