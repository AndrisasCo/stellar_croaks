import { useEffect, useState } from "react";
import { ColliderIcons } from "../../../assets/icons";
import { completeAchivement } from "../../../backend/achivements-manager";
import { Toad } from "../../../models/Toad";
import { ToadTypes } from "../../../models/Toad/toad-species";
import { useModal } from "../../ModalContext";
import { useToads } from "../../ToadContext";

/** Колба инкубатора: id бывает и числом (ColliderState), и строкой (старый сейв). */
type IncubatorSlot = {
  id: string | number;
  child: Toad | null;
  startTime: number | null;
  duration: number;
  isReady: boolean;
};

/**
 * Инкубатор 🧫 — вкладка коллайдера, где дозревает гибрид.
 *
 * Раньше инкубатор был отдельным сектором карты со своей модалкой. Теперь он живёт внутри
 * коллайдера: смешивание и колбы — две вкладки одной модалки (`ToadColliderModal`), а данные
 * сектора коллайдера остаются третьим табом, когда модалка открыта по гексу на карте.
 */
export default function IncubatorTab() {
  const [slotProgress, setSlotProgress] = useState(0);
  const { collectChild, setSlotReady, colliderState } = useToads();
  const { closeModal } = useModal();

  const activeSlot = colliderState.slots.find((slot) => slot.child);

  const handleCollectChild = () => {
    if (!activeSlot?.id) {
      return;
    }
    completeAchivement("collider-hybrid");
    // id колбы в старом сейве мог сохраниться строкой: контекст ищет её по тому же id
    collectChild(activeSlot.id as number);
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

  const getSlotProgress = (slot: IncubatorSlot): number => {
    if (!slot.startTime || slot.isReady) return 100;
    const elapsed = Date.now() - slot.startTime;
    return Math.min(100, (elapsed / slot.duration) * 100);
  };

  useEffect(() => {
    if (!activeSlot) {
      return;
    }

    setSlotProgress(getSlotProgress(activeSlot));

    const timer = window.setInterval(() => {
      const progress = getSlotProgress(activeSlot);

      setSlotProgress(progress);

      if (progress >= 100) {
        // `setSlotReady` обновляет состояние контекста: у уже готовой колбы его не трогаем,
        // иначе таб перерисовывался бы каждую секунду до самого закрытия модалки
        if (!activeSlot.isReady) {
          setSlotReady(activeSlot.id as number);
        }
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
    // Колба обновляется вместе с состоянием коллайдера: этого достаточно для тика прогресса
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot]);

  const getToadSrc = (toad: Toad) => {
    const type =
      toad.type && Object.values(ToadTypes).includes(toad.type)
        ? toad.type
        : ToadTypes.hybrid;

    return `/sprites/${type}.webp`;
  };

  return (
    <div className="relative flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-none border border-cyan-400/20">
      {/* Фон инкубатора и силуэт гибрида в колбе — как в прежней отдельной модалке */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/bg/incubator.webp')] bg-center bg-cover bg-no-repeat" />
      <div
        style={{
          backgroundImage: activeSlot?.child
            ? `url('${getToadSrc(activeSlot.child)}')`
            : "none",
          backgroundPositionX: "50%",
          backgroundPositionY: "100%",
          backgroundSize: "300% 200%",
          aspectRatio: 1.779 / 1.4,
        }}
        className="incubate pointer-events-none absolute left-[35%] top-[43%] w-[30%] overflow-hidden bg-no-repeat opacity-65"
      />

      <div className="relative flex flex-1 flex-col p-2">
        {activeSlot ? (
          <div className="flex flex-1 flex-col">
            {!activeSlot.isReady && (
              <div className="flex items-center justify-center gap-2 text-green-300">
                Осталось:{" "}
                {formatTime(
                  activeSlot.duration - (Date.now() - activeSlot.startTime!)
                )}
              </div>
            )}

            {/* Прогресс бар */}
            <div className="relative bg-color-second mt-6 rounded-none h-10 mb-4 overflow-hidden border border-slate-600">
              <div
                className="brand-bar h-full rounded-none shadow-lg transition-all duration-1000"
                style={{ width: `${activeSlot.isReady ? 100 : slotProgress}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-lg font-bold drop-shadow-lg">
                  {activeSlot.isReady
                    ? "Готово!"
                    : `${Math.round(slotProgress)}%`}
                </span>
              </div>
            </div>

            {activeSlot.isReady && (
              <button
                onClick={handleCollectChild}
                className="ui-button-primary mt-auto w-full py-3 text-base"
              >
                <div className="flex items-center justify-center gap-2">
                  {ColliderIcons.arrow}
                  <span className="text-lg">Забрать гибрида</span>
                </div>
              </button>
            )}
          </div>
        ) : (
          // Заглушка для пустого инкубатора
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-white">
            <h3 className="text-xl font-bold mb-3">Инкубатор пуст</h3>

            <p className="max-w-sm leading-relaxed">
              Смешайте жаб во вкладке «Коллайдер» — гибрид появится здесь и
              дозреет до переселения в биопод.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
