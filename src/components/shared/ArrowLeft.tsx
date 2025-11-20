interface ArrowLeftButtonCompactProps {
  onClick: () => void;
  disabled: boolean;
}

export const ArrowLeftButtonCompact = ({
  onClick,
  disabled = false,
}: ArrowLeftButtonCompactProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center justify-center 
      w-10 h-10 rounded-lg 
      transition-all duration-300 transform
      border-2 backdrop-blur-sm
      ${
        disabled
          ? "bg-gray-600/30 text-gray-500 border-gray-500/30 cursor-not-allowed"
          : "bg-gray-700/50 text-green-400 hover:text-white border-gray-600/50 hover:border-green-500/50 hover:bg-gray-600/50 hover:scale-105 active:scale-95"
      }
    `}
  >
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  </button>
);
