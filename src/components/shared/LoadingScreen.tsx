import { useEffect, useState } from "react";

interface LoadingScreenProps {
  /**
   * Реальный прогресс загрузки (0..100). Пока его нет, полоса анимируется
   * декоративно — как раньше.
   */
  progress?: number;
  /** Что именно происходит: «Авторизация...», «Загружаем прогресс...». */
  message?: string;
}

const LoadingScreen = ({ progress, message }: LoadingScreenProps) => {
  const [fakeProgress, setFakeProgress] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Декоративная анимация нужна только без реального прогресса: иначе полоса
    // «убегала» бы вперёд и врала о том, что игра почти загрузилась.
    if (progress !== undefined) {
      return;
    }

    const progressInterval = setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => {
      clearInterval(progressInterval);
    };
  }, [progress]);

  useEffect(() => {
    // Анимация точек
    const dotsInterval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);

    return () => {
      clearInterval(dotsInterval);
    };
  }, []);

  const shownProgress = Math.max(0, Math.min(100, progress ?? fakeProgress));

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#070c14] z-50">
      {/* Анимированный фон */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Плавающие элементы */}
        <div
          className="absolute h-4 w-4 animate-float-1 rounded-none bg-cyan-400/20"
          style={{ top: "20%", left: "10%" }}
        />
        <div
          className="absolute w-6 h-6 bg-purple-400/15 rounded-none animate-float-2"
          style={{ top: "60%", left: "85%" }}
        />
        <div
          className="absolute w-3 h-3 bg-emerald-400/25 rounded-none animate-float-3"
          style={{ top: "80%", left: "20%" }}
        />
        <div
          className="absolute h-5 w-5 animate-float-4 rounded-none bg-emerald-400/20"
          style={{ top: "30%", left: "70%" }}
        />

        {/* Волны */}
        <div className="absolute bottom-0 left-0 right-0 h-32 animate-wave bg-gradient-to-t from-cyan-500/10 to-transparent" />
      </div>

      {/* Основной контент */}
      <div className="text-center z-10">
        {/* Логотип и заголовок */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="relative">
              {/* Анимированная жаба */}
              <div
                style={{ backgroundImage: "url(/logo-2.webp)" }}
                className="w-24 h-24 bg-contain bg-no-repeat"
              >
                {/* Глаза */}
                <div className="absolute top-[32px] left-[32px] w-[10px] h-[10px] bg-white rounded-none animate-blink" />
                <div
                  className="absolute top-[32px] w-[10px] left-[54px] h-[10px] bg-white rounded-none animate-blink"
                  style={{ animationDelay: "0.2s" }}
                />
                {/* Рот */}
              </div>

              {/* Свечение */}
              <div className="absolute inset-0 h-24 w-24 animate-ping rounded-none bg-cyan-400 opacity-20" />
            </div>

            <h1 className="brand-text text-4xl font-bold">
              Stellar Croak
            </h1>
          </div>

          <p className="text-lg text-slate-300">Генетическая лаборатория жаб</p>
        </div>

        {/* Прогресс бар */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="mb-2 h-3 overflow-hidden rounded-none border border-slate-600/50 bg-slate-950/60">
            <div
              className="brand-bar h-full rounded-none shadow-lg shadow-cyan-500/20 transition-all duration-300 ease-out"
              style={{ width: `${shownProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-slate-300">
            <span>{message ?? "Загрузка"}{dots}</span>
            <span>{Math.round(shownProgress)}%</span>
          </div>
        </div>

        {/* Сообщение о загрузке */}
        <div className="text-sm text-slate-200">
          <p>Инициализация генетического коллайдера{dots}</p>
        </div>

        {/* Дополнительная информация */}
        <div className="mt-8 space-y-1 text-xs text-slate-500">
          <p>🐸 Создаем идеальную среду для ваших жаб</p>
          <p>⚡ Подготавливаем системы смешивания ДНК</p>
        </div>
      </div>

      {/* CSS анимации */}
      <style>{`
        @keyframes float-1 {
          0%,
          100% {
            transform: translateY(0px) translateX(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) translateX(10px) rotate(180deg);
          }
        }
        @keyframes float-2 {
          0%,
          100% {
            transform: translateY(0px) translateX(0px) scale(1);
          }
          50% {
            transform: translateY(15px) translateX(-5px) scale(1.1);
          }
        }
        @keyframes float-3 {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-10px) translateX(8px);
          }
        }
        @keyframes float-4 {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(25px) translateX(-8px);
          }
        }
        @keyframes wave {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-10px);
          }
          100% {
            transform: translateX(0);
          }
        }
        @keyframes blink {
          0%,
          90%,
          100% {
            opacity: 1;
            transform: scaleY(1);
          }
          95% {
            opacity: 0.3;
            transform: scaleY(0.1);
          }
        }
        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(34, 197, 94, 0.6),
              0 0 60px rgba(34, 197, 94, 0.3);
          }
        }
        .animate-float-1 {
          animation: float-1 6s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: float-2 8s ease-in-out infinite 1s;
        }
        .animate-float-3 {
          animation: float-3 5s ease-in-out infinite 2s;
        }
        .animate-float-4 {
          animation: float-4 7s ease-in-out infinite 3s;
        }
        .animate-wave {
          animation: wave 4s ease-in-out infinite;
        }
        .animate-blink {
          animation: blink 3s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
