import React, { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  shape: "circle" | "square" | "triangle";
  rotation: number;
  rotationSpeed: number;
  velocityX: number;
  velocityY: number;
  life: number;
}

export const ConfettiAnimation: React.FC<{
  trigger: number;
  intensity?: number;
}> = ({ trigger, intensity = 1 }) => {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  const shapes = ["circle", "square", "triangle"] as const;
  const colors = [
    "#FF0000", // красный
    "#00FF00", // зеленый
    "#0000FF", // синий
    "#FFFF00", // желтый
    "#FF00FF", // пурпурный
    "#00FFFF", // голубой
    "#FFA500", // оранжевый
  ];

  useEffect(() => {
    if (trigger) {
      const pieces: ConfettiPiece[] = [];
      const count = Math.floor(50 * intensity);

      for (let i = 0; i < count; i++) {
        pieces.push({
          id: i,
          x: Math.random() * window.innerWidth,
          y: -10,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          velocityX: (Math.random() - 0.5) * 5,
          velocityY: 1 + Math.random() * 3,
          life: 1,
        });
      }

      setConfetti(pieces);

      const interval = setInterval(() => {
        setConfetti((prev) =>
          prev
            .map((piece) => ({
              ...piece,
              x: piece.x + piece.velocityX,
              y: piece.y + piece.velocityY,
              velocityY: piece.velocityY + 0.05, // гравитация
              rotation: piece.rotation + piece.rotationSpeed,
              life:
                piece.y < window.innerHeight ? piece.life : piece.life - 0.02,
            }))
            .filter((piece) => piece.life > 0)
        );
      }, 16);

      return () => clearInterval(interval);
    }
  }, [trigger]);

  if (confetti.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute"
          style={{
            left: piece.x,
            top: piece.y,
            width: 8,
            height: 8,
            backgroundColor: piece.color,
            opacity: piece.life,
            transform: `translate(-50%, -50%) rotate(${piece.rotation}deg)`,
            borderRadius:
              piece.shape === "circle"
                ? "50%"
                : piece.shape === "triangle"
                ? "50% 50% 0 50%"
                : "2px",
          }}
        />
      ))}
    </div>
  );
};
