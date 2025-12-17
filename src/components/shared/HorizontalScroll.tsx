import { ReactNode } from "react";

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string;
}

export const HorizontalScroll = ({
  children,
  className = "",
}: HorizontalScrollProps) => {
  return (
    <div
      className={`overflow-x-auto flex flex-nowrap lg:flex-wrap ${className}`}
    >
      {children}
    </div>
  );
};
