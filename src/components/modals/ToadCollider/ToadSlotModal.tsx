import { useState, useEffect } from "react";
import { ColliderIcons } from "../../../assets/icons";
import { completeAchivement } from "../../../backend/achivements-manager";
import { BreedingSlot } from "../../../models/types";
import { useToads } from "../../ToadContext";
import { useModal } from "../../ModalContext";

let interval;

export default function ToadSlotModal() {
  const [slotProgress, setSlotProgress] = useState(0);
  const { collectChild, setSlotReady, colliderState } = useToads();
  const { closeModal } = useModal();

  const activeSlot = colliderState.slots.find((slot) => slot.child);

  const handleCollectChild = () => {
    if (!activeSlot?.id) {
      return;
    }
    completeAchivement("collider-hybrid");
    collectChild(activeSlot.id);
    setSlotProgress(0);
    closeModal();
  };

  const formatTime = (ms: number): string => {
    if (ms < 0) {
      return "0";
    }
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

  return (
    <>
      <div className="flex w-full justify-center items-center relative">
        <div className="flex items-center gap-2 pb-4 ">
          {ColliderIcons.collider}
          <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
            Генетический Коллайдер
          </h2>
        </div>
      </div>

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
      <div className="relative bg-color-second rounded-full h-7 mb-4 overflow-hidden border border-gray-600">
        <div
          className="bg-gradient-to-r from-green-400 via-purple-500 to-green-400 h-full rounded-full transition-all duration-1000 shadow-lg"
          style={{ width: `${activeSlot.isReady ? 100 : slotProgress}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-sm font-bold drop-shadow-lg">
            {activeSlot.isReady ? "Готово!" : `${Math.round(slotProgress)}%`}
          </span>
        </div>
      </div>

      {/* Информация о процессе */}
      <div className="mb-4">
        <div className="text-sm text-gray-200 mb-2"></div>
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
    </>
  );
}
