import { ButtonHTMLAttributes } from "react";
import { useSoundEffects } from "../../hooks/use-sound-effects";

export const ClickButton = ({
  className = "",
  onClick,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { playClick } = useSoundEffects();
  const handleClick = (e: any) => {
    onClick?.(e);
    if (disabled) {
      return;
    }
    playClick();
  };
  // click-button — единое disabled-состояние для всех кнопок игры
  // (приглушённые цвета, без hover/active-эффектов, см. src/index.css).
  return (
    <button
      {...props}
      disabled={disabled}
      onClick={handleClick}
      className={`click-button ${className}`.trim()}
    />
  );
};
