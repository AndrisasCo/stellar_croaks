import { ClickButton } from "./ClickButton";

interface ArrowRightButtonCompactProps {
  onClick: () => void;
  disabled: boolean;
  className?: string;
}

export const ArrowRightButtonCompact = ({
  onClick,
  disabled = false,
  className = "w-12 h-12",
}: ArrowRightButtonCompactProps) => (
  <ClickButton
    onClick={onClick}
    disabled={disabled}
    className={`bg-[url('/assets/back.png')] disabled:opacity-50 rotate-180 cover ${className}`}
  />
);
