import { ButtonHTMLAttributes } from "react";
import { useSoundEffects } from "../../hooks/use-sound-effects";

export const ClickButton = (props: ButtonHTMLAttributes<{}>) => {
  const { playClick } = useSoundEffects();
  const onClick = (e: any) => {
    props?.onClick?.(e);
    if (props.disabled) {
      return;
    }
    playClick();
  };
  return <button {...props} onClick={onClick} />;
};
