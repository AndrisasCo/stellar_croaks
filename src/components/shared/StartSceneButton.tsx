interface StartSceneButtonProps {
  onClick: () => void;
}

const StartSceneButton = ({ onClick }: StartSceneButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="group relative my-auto rounded-2xl border border-white/20 bg-gradient-to-r from-cyan-500 via-emerald-500 to-purple-600 px-12 py-6 font-bold text-white shadow-2xl shadow-cyan-500/25 backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:from-cyan-400 hover:via-emerald-400 hover:to-purple-500 hover:shadow-3xl hover:shadow-purple-500/40 active:scale-95"
    >
      {/* Анимированный градиентный фон */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-purple-600/20 animate-pulse-slow group-hover:from-cyan-400/30 group-hover:via-emerald-400/30 group-hover:to-purple-500/30" />

      {/* Основной контент */}
      <div className="relative z-10 flex items-center justify-center gap-4">
        {/* Иконка жабы */}
        <div className="relative">
          <div className="w-10 h-10 bg-white/20 rounded-full animate-bounce">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
        </div>

        {/* Текст */}
        <div className="text-center">
          <div className="text-2xl font-black tracking-wide">
            ОТКРЫТЬ ПЕРВЫЙ ЗАГОН
          </div>
          <div className="text-white/80 text-sm font-medium mt-1">
            Начать генетические эксперименты
          </div>
        </div>

        {/* Стрелка */}
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform duration-300">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </div>
      </div>

      {/* Блестящие частицы */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div
          className="absolute w-2 h-2 bg-white/40 rounded-full animate-sparkle-1"
          style={{ top: "20%", left: "10%" }}
        />
        <div
          className="absolute w-1 h-1 bg-white/60 rounded-full animate-sparkle-2"
          style={{ top: "60%", left: "85%" }}
        />
        <div
          className="absolute w-1.5 h-1.5 bg-white/30 rounded-full animate-sparkle-3"
          style={{ top: "80%", left: "20%" }}
        />
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes sparkle-1 {
          0%,
          100% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes sparkle-2 {
          0%,
          100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 0.8;
            transform: scale(1) rotate(180deg);
          }
        }
        @keyframes sparkle-3 {
          0%,
          100% {
            opacity: 0;
            transform: translateY(0);
          }
          50% {
            opacity: 0.6;
            transform: translateY(-5px);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        .animate-sparkle-1 {
          animation: sparkle-1 4s ease-in-out infinite;
        }
        .animate-sparkle-2 {
          animation: sparkle-2 5s ease-in-out infinite 1s;
        }
        .animate-sparkle-3 {
          animation: sparkle-3 6s ease-in-out infinite 2s;
        }
        .shadow-3xl {
          box-shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </button>
  );
};

export default StartSceneButton;
