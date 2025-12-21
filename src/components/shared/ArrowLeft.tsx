import { ClickButton } from "./ClickButton";

interface ArrowLeftButtonCompactProps {
  onClick: () => void;
  disabled: boolean;
  className?: string;
}

export const ArrowLeftButtonCompact = ({
  onClick,
  disabled = false,
  className = "w-12 h-12",
}: ArrowLeftButtonCompactProps) => (
  <ClickButton
    onClick={onClick}
    disabled={disabled}
    className={`bg-[url('/assets/back.png')] disabled:opacity-50 cover ${className}`}
  />
);
