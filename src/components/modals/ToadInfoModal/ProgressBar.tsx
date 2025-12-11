export const ProgressBar = ({
  label,
  current,
  max,
  color,
  icon,
  action,
}: any) => (
  <div
    className={`bg-${color}-900/20 rounded-xl p-2 mb-3 border border-${color}-500/50`}
  >
    <div className="flex justify-between items-center mb-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className={`text-${color}-400 text-xs font-medium uppercase`}>
          {label}
        </p>
      </div>
      {action && (
        <button
          onClick={action.handler}
          className={`flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-${color}-600 to-${color}-500 hover:brightness-110 rounded-lg transition-all text-xs font-semibold shadow-lg active:scale-95`}
        >
          <span className="text-white">⚡</span>
          <span className="text-white">{action.label}</span>
        </button>
      )}
    </div>
    <div className="w-full bg-gray-600/50 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full bg-${color}-500`}
        style={{ width: `${Math.min((current / max) * 100, 100)}%` }}
      />
    </div>
    {action && (
      <p className={`text-${color}-300 text-sm mt-1`}>
        Осталось: {action.timeLeft} мин
      </p>
    )}
  </div>
);
