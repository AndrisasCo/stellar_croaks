interface TooltipProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  revert?: boolean; // для позиционирования (сверху/снизу)
}

export const Tooltip = ({
  children,
  isOpen,
  onClose,
  title,
  revert,
  className,
}: TooltipProps) => {
  if (!isOpen) {
    return null;
  }
  return (
    <div
      className={`absolute ${revert ? "bottom-0" : "top-full"} ${
        className ? className : "left-0 right-0"
      }  z-10 bg-color-main border border-cyan-500/40 rounded-xl p-3 mt-1 shadow-lg`}
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-cyan-300 font-semibold text-sm">{title}</h4>
        <button
          onClick={onClose}
          className="text-slate-300 hover:text-white text-lg"
        >
          ×
        </button>
      </div>

      {children}
    </div>
  );
};
