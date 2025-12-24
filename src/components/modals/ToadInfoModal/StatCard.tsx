export const StatCard = ({
  icon,
  label,
  value,
  colorClass,
  onClick,
  tooltip,
}: any) => {
  return (
    <div
      onClick={onClick}
      className={`bg-color-main rounded-xl p-2 border border-gray-600/50 relative ${
        onClick ? "cursor-pointer hover:bg-gray-600/50" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-gray-300 text-xs font-medium uppercase">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${colorClass}`}>{value}</p>
      {tooltip}
    </div>
  );
};
