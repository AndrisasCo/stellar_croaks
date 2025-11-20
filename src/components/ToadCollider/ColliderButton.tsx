import { useEffect, useState } from "react";
import { useToads } from "../ToadContext";
import ToadCollider from "../modals/ToadColliderModal";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { BreedingSlot } from "../../models/types";

let interval;

export default function ColliderButton() {
  const { colliderState, collectChild, setSlotReady, toads } = useToads();
  const [isColliderOpen, setIsColliderOpen] = useState(false);
  const { playClickCollider } = useSoundEffects();

  const handleCollectChild = () => {
    if (!activeSlot?.id) {
      return;
    }
    collectChild(activeSlot.id);
    setSlotProgress(0);
  };

  const [slotProgress, setSlotProgress] = useState(0);

  const openCollider = () => {
    setIsColliderOpen(true);
    playClickCollider();
  };

  const formatTime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms / 1000) % 60);
    return `${hours}ч ${minutes}м ${seconds}с`;
  };

  const getSlotProgress = (slot: BreedingSlot): number => {
    if (!slot.startTime || slot.isReady) return 100;
    const elapsed = Date.now() - slot.startTime;
    return Math.min(100, (elapsed / slot.duration) * 100);
  };

  const activeSlot = colliderState.slots.find((slot) => slot.child);
  const freeSlots = colliderState.slots.filter((slot) => slot.child);

  useEffect(() => {
    if (activeSlot) {
      interval = setInterval(() => {
        const progress = getSlotProgress(activeSlot);
        if (progress < 100) {
          setSlotProgress(progress);
        } else {
          setSlotReady(activeSlot.id);
          clearInterval(interval);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [activeSlot]);

  // SVG иконки для коллайдера
  const ColliderIcons = {
    dna: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
        />
      </svg>
    ),
    flask: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    parents: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {/* Контур жабы */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 20c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8z"
        />
        {/* Глаза */}
        <circle cx="9" cy="11" r="1" fill="currentColor" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
        {/* Рот */}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 15h6"
        />
      </svg>
    ),
    rarity: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    ),
    ready: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    time: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return (
    <div className="text-center my-6">
      {!activeSlot ? (
        // Кнопка для начала скрещивания
        <button
          onClick={openCollider}
          className="bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-500 hover:to-green-500 text-white font-bold py-5 px-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 w-full max-w-md border-2 border-white/20"
        >
          <div className="flex items-center justify-center gap-4">
            <div className="text-green-300">{ColliderIcons.dna}</div>
            <div className="text-left">
              <div className="text-lg font-bold text-white">
                ГЕНЕТИЧЕСКИЙ КОЛЛАЙДЕР
              </div>
              <div className="text-green-200 text-xs font-medium mt-1">
                Свободно: {freeSlots.length}/{colliderState.slots.length} слотов
              </div>
            </div>
            <div className="text-green-300">{ColliderIcons.flask}</div>
          </div>
        </button>
      ) : (
        // Колба с процессом скрещивания
        <div className="bg-gray-800/90 rounded-2xl p-2 border-2 border-green-500/50 shadow-2xl max-w-md mx-auto backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="text-green-400">{ColliderIcons.dna}</div>
              <h3 className="text-white font-bold text-lg">Инкубатор</h3>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-green-300 text-sm">
                {ColliderIcons.parents}
                <span>{activeSlot.child.parents.length} родителя</span>
              </div>
            </div>
          </div>

          {/* Прогресс бар */}
          <div className="relative bg-gray-700 rounded-full h-7 mb-4 overflow-hidden border border-gray-600">
            <div
              className="bg-gradient-to-r from-green-400 via-purple-500 to-green-400 h-full rounded-full transition-all duration-1000 shadow-lg"
              style={{ width: `${activeSlot.isReady ? 100 : slotProgress}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-sm font-bold drop-shadow-lg">
                {activeSlot.isReady
                  ? "Готово!"
                  : `${Math.round(slotProgress)}%`}
              </span>
            </div>
          </div>

          {/* Информация о процессе */}
          <div className="mb-4">
            <div className="text-sm text-gray-300 mb-2">
              {/* Родители: {activeSlot.parents.map((p) => p.name).join(" × ")} */}
            </div>
            {!activeSlot.isReady && (
              <div className="flex items-center justify-center gap-2 text-green-300 text-sm">
                {ColliderIcons.time}
                <span>
                  Осталось:{" "}
                  {formatTime(
                    activeSlot.duration - (Date.now() - activeSlot.startTime!)
                  )}
                </span>
              </div>
            )}
          </div>

          {activeSlot.isReady && (
            <button
              onClick={handleCollectChild}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 border-2 border-white/20 shadow-lg"
            >
              <div className="flex items-center justify-center gap-2">
                {ColliderIcons.ready}
                <span className="text-lg">Забрать гибрида</span>
              </div>
            </button>
          )}
        </div>
      )}

      <ToadCollider
        isOpen={isColliderOpen}
        onClose={() => setIsColliderOpen(false)}
        availableToads={toads.filter((t) => t.stage === "adult")}
      />
    </div>
  );
}
