import { useEffect, useState } from "react";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyText } from "../shared/CurrencyIcon";
import { useNarrator } from "../../hooks/use-narrator";
import {
  NARRATOR_TASKS,
  NarratorStoryStep,
  NarratorTaskStep,
} from "../../utils/narrator";
import { STATION_NAME } from "../../utils/lore";

/**
 * Голограмма КВАЗа — рассказчика станции «Титан-9».
 *
 * Аватар один на все карточки: зелёная точка — канал связи, кольцо — проекция
 * бортового интеллекта. Размер задаётся отдельным пропом, а не классовым
 * «хвостом»: в Tailwind два размера (`h-8` и `h-11`) конфликтуют, и порядок
 * классов в строке не решает, какой победит.
 */
const NarratorAvatar = ({
  sizeClass = "h-11 w-11",
}: {
  sizeClass?: string;
}) => (
  <div
    className={`relative flex flex-none ${sizeClass} shrink-0 items-center justify-center rounded-none border border-cyan-300/60 bg-gradient-to-br from-cyan-500/25 via-emerald-400/20 to-purple-500/25 shadow-[0_0_18px_rgba(34,211,238,0.35)]`}
  >
    <span className="absolute inset-1 animate-pulse rounded-none border border-cyan-200/20" />
    <img src="/assets/logo.webp" className="w-10 h-auto flex-none" />
  </div>
);

/** Полноэкранная карточка истории: лор и короткие объяснения механик. */
const StoryCard = ({
  step,
  onContinue,
  onSkip,
}: {
  step: NarratorStoryStep;
  onContinue: () => void;
  onSkip: () => void;
}) => (
  <div
    className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/75 p-3 backdrop-blur-sm md:items-center"
    role="dialog"
    aria-modal="true"
    aria-labelledby="narrator-title"
  >
    <div className="no-overscroll relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-none border border-cyan-400/30 bg-[#08141c]/95 text-white shadow-[0_24px_80px_-12px_rgba(34,211,238,0.3)]">
      <div className="brand-bar h-1 w-full" />
      <div className="relative p-4 md:p-5 overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-none bg-cyan-400/10 blur-2xl" />

        <div className="relative flex items-start gap-3">
          <NarratorAvatar />
          <div className="min-w-0">
            <p className="ui-kicker">
              Станция «{STATION_NAME}» · канал связи
            </p>
            <h2
              id="narrator-title"
              className="mt-1 text-lg font-bold leading-tight text-cyan-50"
            >
              {step.title}
            </h2>
          </div>
        </div>

        <p className="relative mt-3 text-sm leading-relaxed text-slate-200">
          <CurrencyText text={step.text} />
        </p>

        <div className="relative mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-2xs text-slate-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-rose-300"
          >
            Пропустить обучение
          </button>
          <ClickButton
            onClick={onContinue}
            className="ui-button-primary px-4 active:scale-95"
          >
            {step.actionLabel}
          </ClickButton>
        </div>
      </div>
    </div>
  </div>
);

/** Компактная подсказка-задание: не закрывает карту и не мешает строить. */
const TaskCard = ({
  step,
  taskNumber,
  onCollapse,
  onSkip,
}: {
  step: NarratorTaskStep;
  taskNumber: number;
  onCollapse: () => void;
  onSkip: () => void;
}) => (
  <div
    className="pointer-events-none fixed inset-x-0 bottom-[9.5rem] z-[65] flex justify-center px-3 md:bottom-4"
    role="status"
    aria-live="polite"
  >
    <div className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-none border border-cyan-400/35 bg-[#07141c]/95 p-3 text-white shadow-[0_18px_50px_-10px_rgba(6,182,212,0.35)] backdrop-blur-md">
      <div className="brand-bar absolute inset-x-0 top-0 h-0.5" />

      <div className="flex items-start gap-2.5">
        <NarratorAvatar sizeClass="h-10 w-10" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="ui-kicker">
                КВАЗ · задание {taskNumber}/{NARRATOR_TASKS.length}
              </p>
              <h3 className="mt-0.5 text-sm font-bold leading-tight text-cyan-50">
                {step.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Свернуть подсказку"
              title="Свернуть подсказку"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border border-white/10 bg-white/5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              −
            </button>
          </div>

          <p className="mt-1.5 text-xs leading-snug text-slate-300">
            <CurrencyText text={step.text} />
          </p>

          <p className="mt-2 flex items-start gap-1.5 rounded-none border border-cyan-400/20 bg-cyan-400/10 px-2 py-1.5 text-2xs leading-snug text-cyan-50">
            <span className="shrink-0">{step.icon}</span>
            <span>
              <CurrencyText text={step.hint} />
            </span>
          </p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {NARRATOR_TASKS.map((task, index) => (
                <span
                  key={task}
                  className={`h-1.5 rounded-none transition-all ${
                    index < taskNumber
                      ? "w-6 bg-cyan-400"
                      : "w-2.5 bg-slate-600"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="text-2xs text-slate-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-rose-300"
            >
              Пропустить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Рассказчик первого запуска. Показывается только поверх загруженной игры:
 * `MainScreen` монтирует его после `LoadingScreen`, чтобы вступление не мигало
 * за заставкой.
 */
const Narrator = () => {
  const { narrator, step, advance, skip } = useNarrator();
  const [collapsed, setCollapsed] = useState(false);

  // Новый шаг всегда раскрываем: иначе игрок пропустит следующую подсказку.
  useEffect(() => {
    setCollapsed(false);
  }, [step.id]);

  if (narrator.status !== "active") {
    return null;
  }

  if (step.kind === "story") {
    return <StoryCard step={step} onContinue={advance} onSkip={skip} />;
  }

  const taskNumber = Math.max(0, NARRATOR_TASKS.indexOf(step.id)) + 1;

  if (collapsed) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[9.5rem] z-[65] flex justify-center px-3 md:bottom-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="pointer-events-auto flex items-center gap-2 rounded-none border border-cyan-400/35 bg-[#07141c]/95 py-1.5 pl-1.5 pr-3 text-left shadow-[0_12px_36px_-8px_rgba(6,182,212,0.4)] backdrop-blur-md transition-transform active:scale-95"
        >
          <NarratorAvatar sizeClass="h-8 w-8" />
          <span className="min-w-0">
            <span className="ui-kicker block">
              КВАЗ · подсказка
            </span>
            <span className="block truncate text-xs font-bold text-cyan-50">
              {step.title}
            </span>
          </span>
          <span className="ml-1 text-cyan-300">▴</span>
        </button>
      </div>
    );
  }

  return (
    <TaskCard
      step={step}
      taskNumber={taskNumber}
      onCollapse={() => setCollapsed(true)}
      onSkip={skip}
    />
  );
};

export default Narrator;
