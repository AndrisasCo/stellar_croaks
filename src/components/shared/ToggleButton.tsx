import { ButtonHTMLAttributes } from "react";

/**
 * Круглый переключатель «ON / OFF» для тумблеров игры.
 *
 * Единственное место, где интерфейс позволяет себе радиус: круг читается как
 * физическая кнопка-клавиша прибора, поэтому её не спутать с обычной кнопкой
 * действия (те остаются острыми, `rounded-none`). Состояние видно по подписи
 * внутри круга и по заливке: включён — цветной корпус с тёмной надписью и
 * свечением, выключен — серый корпус с приглушённой надписью.
 *
 * Роль `switch` + `aria-checked` оставляют поведение прежним для скринридеров
 * и клавиатуры, а `label` уходит в `aria-label`/`title`, чтобы подсказка
 * называла именно то, что переключают.
 */
export type ToggleTone = "emerald" | "cyan";

/** Заливка включённого состояния: цвет сектора, где живёт переключатель */
const TONE_CLASSES: Record<ToggleTone, string> = {
  emerald:
    "border-emerald-300/70 bg-emerald-500 text-slate-950 shadow-[0_0_16px_-2px_rgba(52,211,153,0.7)]",
  cyan: "border-cyan-200/70 bg-cyan-400 text-slate-950 shadow-[0_0_16px_-2px_rgba(34,211,238,0.65)]",
};

/** Выключенное состояние общее для всех тонов: цветного пятна быть не должно */
const OFF_CLASSES =
  "border-white/15 bg-slate-800/80 text-slate-400 hover:border-white/30 hover:text-slate-200";

interface ToggleButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "className"
  > {
  /** Текущее состояние переключателя */
  checked: boolean;
  /** Клик по кругу: переключить состояние */
  onChange: () => void;
  /** Что переключаем — подпись для подсказки и скринридера */
  label: string;
  /** Цвет включённого состояния под палитру модалки */
  tone?: ToggleTone;
  className?: string;
}

export const ToggleButton = ({
  checked,
  onChange,
  label,
  tone = "emerald",
  className = "",
  ...props
}: ToggleButtonProps) => (
  <button
    {...props}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={`${label}: ${checked ? "включено" : "выключено"}`}
    onClick={onChange}
    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-2xs font-bold tracking-[0.06em] transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
      checked ? TONE_CLASSES[tone] : OFF_CLASSES
    } ${className}`.trim()}
  >
    {checked ? "ON" : "OFF"}
  </button>
);
