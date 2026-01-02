import { useState, useRef, useEffect } from "react";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { MIXING_DURATION } from "../../../utils/constants";

export const MixingInProgress = () => {
  const [mixingProgress, setMixingProgress] = useState(0);
  const mixingTimeoutRef = useRef<NodeJS.Timeout>();
  const { playBubblesLong } = useSoundEffects();

  const startMixingAnimation = () => {
    playBubblesLong();

    // Анимация прогресса за указанную длительность
    const startTime = Date.now();
    const duration = MIXING_DURATION;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setMixingProgress(progress);

      if (progress < 1) {
        mixingTimeoutRef.current = setTimeout(updateProgress, 32);
      }
    };

    updateProgress();
  };

  useEffect(() => {
    startMixingAnimation();

    return () => {
      if (mixingTimeoutRef.current) {
        clearTimeout(mixingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full my-auto bg-color-main rounded-2xl shadow-2xl border-2 border-green-500/50 overflow-hidden backdrop-blur-sm">
      {/* Основной контейнер анимации */}
      <div className="relative h-40 rounded-xl bg-gradient-to-r from-green-900/40 to-emerald-900/40 overflow-hidden">
        {/* Фон с узором */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(circle at 25% 25%, rgba(34, 197, 94, 0.3) 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, rgba(34, 197, 94, 0.3) 0%, transparent 50%)
            `,
          }}
        />

        {/* Прогресс заполнения */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-200 bg-gradient-to-t from-green-500/80 to-emerald-400/90 rounded-t-xl"
          style={{ height: `${mixingProgress * 100}%` }}
        >
          {/* Эффект пузырьков на прогресс-баре */}
          <div className="absolute inset-0 overflow-hidden rounded-t-xl">
            <div
              className="absolute w-3 h-3 bg-white/30 rounded-full animate-bubble-1"
              style={{ top: "20%", left: "30%" }}
            />
            <div
              className="absolute w-2 h-2 bg-white/40 rounded-full animate-bubble-2"
              style={{ top: "40%", left: "60%" }}
            />
            <div
              className="absolute w-2.5 h-2.5 bg-white/20 rounded-full animate-bubble-3"
              style={{ top: "60%", left: "20%" }}
            />
          </div>
        </div>

        {/* Вращающиеся элементы и текст */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-center z-10 flex flex-row items-center justify-center gap-4">
            {/* Текст прогресса */}
            <div className="text-center">
              <div className="text-sm font-bold text-green-300 mb-1">
                СИНТЕЗ ДНК...
              </div>
              <div className="text-lg font-black text-white">
                {Math.round(mixingProgress * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Парящие частицы ДНК */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-1 h-1 bg-green-400/60 rounded-full animate-float-1"
            style={{ top: "30%", left: "15%" }}
          />
          <div
            className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-float-2"
            style={{ top: "60%", left: "85%" }}
          />
          <div
            className="absolute w-0.5 h-0.5 bg-green-300/50 rounded-full animate-float-3"
            style={{ top: "20%", left: "70%" }}
          />
        </div>
      </div>

      {/* CSS анимации */}
      <style>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes spin-slow-reverse {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }
        @keyframes bubble-1 {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.7;
          }
          50% {
            transform: translateY(-10px) scale(1.2);
            opacity: 1;
          }
        }
        @keyframes bubble-2 {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-15px) scale(1.1);
            opacity: 0.8;
          }
        }
        @keyframes bubble-3 {
          0%,
          100% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-8px) scale(1.3);
            opacity: 0.9;
          }
        }
        @keyframes float-1 {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
        @keyframes float-2 {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-15px) translateX(-5px);
          }
        }
        @keyframes float-3 {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-25px) translateX(8px);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
          transform-origin: center;
        }
        .animate-spin-slow-reverse {
          animation: spin-slow-reverse 3s linear infinite;
          transform-origin: center;
        }
        .animate-bubble-1 {
          animation: bubble-1 2s ease-in-out infinite;
        }
        .animate-bubble-2 {
          animation: bubble-2 2.5s ease-in-out infinite 0.5s;
        }
        .animate-bubble-3 {
          animation: bubble-3 3s ease-in-out infinite 1s;
        }
        .animate-float-1 {
          animation: float-1 4s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: float-2 5s ease-in-out infinite 1s;
        }
        .animate-float-3 {
          animation: float-3 3.5s ease-in-out infinite 2s;
        }
      `}</style>
    </div>
  );
};
