import React, { useEffect, useState } from "react";

interface FlyingNumberProps {
  value: number | string;
  onComplete?: () => void;
  duration?: number;
  color?: "red" | "green" | "yellow" | "purple" | "blue";
  size?: "sm" | "md" | "lg";
  position?: { x: number; y: number };
}

const FlyingNumber: React.FC<FlyingNumberProps> = ({
  value,
  onComplete,
  duration = 2000,
  color = "red",
  size = "md",
  position,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const colorClasses = {
    red: "text-red-400  ",
    green: "text-green-400  ",
    yellow: "text-yellow-400  ",
    purple: "text-purple-400 ",
    blue: "text-blue-400 ",
  };

  const sizeClasses = {
    sm: "text-sm px-1.5 py-0.5",
    md: "text-lg px-2 py-1",
    lg: "text-xl px-3 py-1.5",
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div
        className={`
          font-bold
          animate-fly-up
          ${colorClasses[color]}
          ${sizeClasses[size]}
        `}
        style={{
          animation: `flyUp ${duration}ms ease-out forwards`,
        }}
      >
        {value}
      </div>

      <style>{`
        @keyframes flyUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
          }
          20% {
            opacity: 1;
            transform: translateY(-10px) scale(1.1) rotate(-2deg);
          }
          50% {
            opacity: 0.8;
            transform: translateY(-25px) scale(1.05) rotate(1deg);
          }
          80% {
            opacity: 0.4;
            transform: translateY(-35px) scale(0.9) rotate(-1deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-50px) scale(0.8) rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
};

export default FlyingNumber;
