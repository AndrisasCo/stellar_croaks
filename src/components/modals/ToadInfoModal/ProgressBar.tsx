export const ProgressBar = ({
  label,
  current,
  max,
  color,
  icon,
  action,
  /** Значение справа от подписи: «62 %», «4/10». Без него полоса остаётся немой */
  valueLabel,
}: any) => (
  <div
    className={`mb-3 rounded-none border border-${color}-500/50 bg-${color}-900/20 p-2`}
  >
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <p
          className={`text-${color}-400 font-mono text-2xs font-medium uppercase tracking-[0.1em]`}
        >
          {label}
        </p>
        {valueLabel && (
          <span
            className={`text-${color}-300 font-mono text-xs font-semibold tabular-nums`}
          >
            {valueLabel}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={action.handler}
          disabled={action.disabled}
          title={action.disabledReason}
          className={`flex items-center gap-1 rounded-none border border-white/10 bg-gradient-to-r from-${color}-600 to-${color}-500 px-3 py-1 font-mono text-2xs font-semibold uppercase tracking-[0.08em] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 disabled:active:scale-100`}
        >
          {/* Значок ⚡ убран: ускорение роста и беременности платится червями/мушками, а ⚡ — силы жабы */}
          <span className="text-white">{action.label}</span>
        </button>
      )}
    </div>
    <div className="h-1.5 w-full overflow-hidden bg-slate-900/70">
      <div
        className={`h-full bg-${color}-500 transition-[width] duration-300`}
        style={{ width: `${Math.min((current / max) * 100, 100)}%` }}
      />
    </div>
    {action && (
      <p
        className={`text-${color}-300 mt-1 font-mono text-2xs tabular-nums tracking-[0.04em]`}
      >
        Осталось: {action.timeLeft} мин
      </p>
    )}
  </div>
);
