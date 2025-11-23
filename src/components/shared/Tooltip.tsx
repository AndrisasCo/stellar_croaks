export const Tooltip = ({ children, isOpen, onClose, title, revert }) => {
  if (!isOpen) {
    return null;
  }
  return (
    <div
      className={`absolute ${
        revert ? "bottom-0" : "top-full"
      }  left-0 right-0 z-10 bg-gray-800 border border-purple-500/50 rounded-xl p-3 mt-1 shadow-lg`}
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-purple-400 font-semibold text-sm">{title}</h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg"
        >
          ×
        </button>
      </div>

      {children}
    </div>
  );
};
