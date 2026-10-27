import { HudPanel } from "../../shared/DataGrid";

export const StatCard = ({
  icon,
  label,
  value,
  colorClass,
  onClick,
  tooltip,
}: any) => {
  return (
    <HudPanel
      onClick={onClick}
      className={`p-2 ${
        onClick ? "cursor-pointer transition-colors hover:border-emerald-300/70" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-slate-300 text-xs font-medium uppercase">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${colorClass}`}>{value}</p>
      {tooltip}
    </HudPanel>
  );
};
