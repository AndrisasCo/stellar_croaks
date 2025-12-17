import { useEffect, useState } from "react";
import { useToads } from "../ToadContext";
import ToadCollider from "../modals/ToadColliderModal";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { BreedingSlot } from "../../models/types";
import { completeAchivement } from "../../backend/achivements-manager";
import { ColliderIcons } from "../../assets/icons";

let interval;

export default function ColliderButton() {
  const { colliderState, collectChild, setSlotReady, toads, allToads } =
    useToads();
  const [isColliderOpen, setIsColliderOpen] = useState(false);
  const { playClickCollider } = useSoundEffects();

  const handleCollectChild = () => {
    if (!activeSlot?.id) {
      return;
    }
    completeAchivement("collider-hybrid");
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
  const freeSlots = colliderState.slots.filter((slot) => !slot.child);

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

  const isColliderDisabled = allToads.length < 10;

  return (
    <div className="text-center my-6">
      {!activeSlot ? (
        // Кнопка для начала скрещивания
        <button
          disabled={isColliderDisabled}
          onClick={openCollider}
          className={`bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-500 hover:to-green-500 text-white font-bold py-5 px-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 w-full max-w-2xl border-2 border-white/20
    ${
      isColliderDisabled
        ? "opacity-80 cursor-not-allowed grayscale-50"
        : "cursor-pointer hover:shadow-2xl hover:scale-105"
    }`}
        >
          <div className="flex items-center justify-center gap-4">
            <div
              className={`${
                isColliderDisabled ? "text-white" : "text-green-300"
              }`}
            >
              {ColliderIcons.dna}
            </div>
            <div className="text-left">
              <div className={`text-lg font-bold text-white`}>
                ГЕНЕТИЧЕСКИЙ КОЛЛАЙДЕР
              </div>
              {isColliderDisabled ? (
                <div className="text-white text-sm font-medium mt-1">
                  Необходимо хотя бы 10 жаб для разблокирования коллайдера
                </div>
              ) : (
                <div className="text-green-200 text-xs font-medium mt-1">
                  Свободно: {freeSlots.length}/{colliderState.slots.length}{" "}
                  слотов
                </div>
              )}
            </div>
            <div
              className={`${
                isColliderDisabled ? "text-gray-400" : "text-green-300"
              }`}
            >
              {ColliderIcons.flask}
            </div>
          </div>
        </button>
      ) : (
        // Колба с процессом скрещивания
        <div className="bg-gray-800/90 rounded-2xl p-2 border-2 border-green-500/50 shadow-2xl max-w-2xl mx-auto backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="text-green-400">{ColliderIcons.dna}</div>
              <h3 className="text-white font-bold px-2 text-lg">Инкубатор</h3>
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
            <div className="text-sm text-gray-300 mb-2"></div>
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
