import { useState } from "react";

import { useToads } from "../ToadContext";
import { MixingInProgress } from "../ToadCollider/MixingInProgress";
import {
  generateChildToad,
  calculateRarityBonus,
} from "../../utils/calculate-genetics";
import { MIXING_DURATION, TYPE_ICONS } from "../../utils/constants";
import {
  getRarityConfig,
  getRarityGroup,
  Toad,
  ToadTypes,
} from "../../models/toad";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { BreedingResult } from "../../models/types";
import { ColliderIcons, PregnancyIcon } from "../../assets/icons";
import Modal from "../shared/Modal";
import { deleteToadsByIds, updateToadsByIds } from "../../backend";
import { ToadGender } from "../shared/ToadGender";
import { nameGenerator } from "../../utils/name-generator";
import { getGeneticFaultConfig } from "../../models/toad";
import { ToadAvatar } from "../shared/ToadAvatar";

interface ToadColliderProps {
  isOpen: boolean;
  onClose: () => void;
  availableToads: Toad[];
}

// Функция для определения цвета редкости
const getRarityColor = (rarity: number): string => {
  return getRarityConfig(rarity).color;
};

// Функция для определения бейджа редкости
const getRarityBadge = (rarity: number): string => {
  return getRarityConfig(rarity).icon;
};

// Функция для определения фона редкости
const getRarityBackground = (rarity: number): string => {
  return getRarityConfig(rarity).bgColor;
};

export default function ToadCollider({
  isOpen,
  onClose,
  availableToads,
}: ToadColliderProps) {
  const [selectedToads, setSelectedToads] = useState<(Toad | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);

  const [isMixing, setIsMixing] = useState(false);

  const { startBreeding, updateBreeding } = useToads();
  const { playBubble2 } = useSoundEffects();
  const [breedingResult, setBreedingResult] = useState<BreedingResult | null>(
    null
  );
  const [customName, setCustomName] = useState("");

  const currentToads = selectedToads.filter(Boolean) as Toad[];

  const isDisabled = currentToads.length < 2;

  const handleSelectToad = (toad: Toad) => {
    const currentToadIndex = selectedToads.findIndex(
      (t) => t && t.id === toad.id
    );

    if (currentToadIndex !== -1) {
      const newSlots = [...selectedToads];
      newSlots[currentToadIndex] = null;
      setSelectedToads(newSlots);
      playBubble2();
      return;
    }

    if (currentToads.length < 5) {
      const emptySlotIndex = selectedToads.findIndex((slot) => slot === null);
      if (emptySlotIndex !== -1) {
        const newSlots = [...selectedToads];
        newSlots[emptySlotIndex] = toad;
        setSelectedToads(newSlots);
        playBubble2();
      }
    }
  };

  const handleRemoveToad = (index: number) => {
    const newToads = [...selectedToads];
    newToads[index] = null;
    setSelectedToads(newToads);
    playBubble2();
  };

  const handleBreed = async () => {
    if (isDisabled || isMixing) {
      return;
    }
    setIsMixing(true);

    // Мутация - шанс на повышенную редкость
    const mutationChance = Math.random() < 0.1;
    const genesBreakChance = Math.random() < 0.1;
    const isMutant = Math.random() < 0.3;

    const child = generateChildToad(currentToads, true, {
      mutationChance,
      genesBreakChance,
      isMutant,
    }) as Toad;

    await new Promise<void>((resolve) =>
      setTimeout(resolve, MIXING_DURATION + 500)
    );

    let message = `✨ Новый гибрид создан!`;

    if (genesBreakChance) {
      message = " Неудачное смешивание генов: жаба будет бесполой.";
    }

    if (mutationChance) {
      message += " Идельное смешивание генов! Ее редкость повышена";
    }

    if (isMutant) {
      message += " Жаба мутировала! Ее облик изменен...";
    }

    setBreedingResult({
      success: !genesBreakChance,
      child,
      message: message,
    });

    setIsMixing(false);

    startBreeding(child as Toad);
    deleteToadsByIds(currentToads.map((t) => t.id));
    setSelectedToads([null, null, null, null, null]);
  };

  const handleConfirm = () => {
    if (!breedingResult) {
      return;
    }
    const { child } = breedingResult;
    if (customName.trim()) {
      child.name = customName.trim();
      updateBreeding(child);
    }

    setCustomName("");
    setBreedingResult(null);
    onClose();
  };

  const handleReset = () => {
    setSelectedToads([null, null, null, null, null]);
    setBreedingResult(null);
    setCustomName("");
  };

  // Функция для генерации случайного имени
  const generateRandomName = () => {
    const randomName = nameGenerator.generate();
    setCustomName(randomName);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      icon={ColliderIcons.collider}
      title="Генетический Коллайдер"
    >
      {!breedingResult ? (
        <>
          <div className="bg-gray-700  rounded-lg p-3 mb-4 sm:mb-6 border border-gray-600">
            <div className="text-xs sm:text-sm text-white font-medium mb-2 sm:mb-3 text-center flex items-center justify-center gap-2">
              <span className="text-yellow-400">⭐</span>
              Бонусы редкости
              <span className="text-yellow-400">⭐</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                {
                  count: 2,
                  colors: "from-green-400 to-green-600",
                  shadow: "shadow-green-500/40",
                },
                {
                  count: 3,
                  colors: "from-blue-400 to-blue-600",
                  shadow: "shadow-blue-500/40",
                },
                {
                  count: 4,
                  colors: "from-purple-500 to-pink-500",
                  shadow: "shadow-purple-500/40",
                },
                {
                  count: 5,
                  colors: "from-yellow-400 to-red-500",
                  shadow: "shadow-yellow-500/40",
                },
              ].map(({ count, colors, shadow }) => (
                <div
                  key={count}
                  className={`text-center p-1 sm:p-2 rounded-xl transition-all duration-500 transform ${
                    currentToads.length >= count
                      ? `bg-gradient-to-br ${colors} text-white shadow-lg ${shadow} scale-105 border-2 border-white border-opacity-30 animate-gradient-x`
                      : "bg-gray-600 text-gray-400 border-2 border-transparent hover:border-gray-500"
                  }`}
                >
                  <div className="font-bold text-[10px] sm:text-[11px]">
                    {count} жаб
                  </div>
                  <div
                    className={`font-bold text-[9px] sm:text-[10px] mt-1 ${
                      currentToads.length >= count
                        ? "text-yellow-300"
                        : "text-gray-300"
                    }`}
                  >
                    +{calculateRarityBonus(count)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Слоты-колбы для жаб */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-3">
            {[0, 1, 2, 3, 4].map((slot: number) => (
              <div
                key={slot}
                className={`relative w-14 h-16 sm:w-16 sm:h-20 md:w-18 md:h-22 border-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                  selectedToads[slot]
                    ? "border-green-400 bg-green-900/30"
                    : "border-green-400/50 border-dashed bg-green-900/10"
                }`}
              >
                {selectedToads[slot] ? (
                  <>
                    <div
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full mb-1  border-2 border-white/80 shadow-sm"
                      style={{
                        backgroundColor: selectedToads[slot]!.genes.colors[0],
                      }}
                    />
                    <p className="text-white text-[10px]  text-center px-1 truncate w-full">
                      {selectedToads[slot]!.name}
                    </p>

                    {!isMixing && (
                      <button
                        onClick={() => handleRemoveToad(slot)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                      >
                        {ColliderIcons.close}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-green-400/70 text-xl ">+</div>
                )}
              </div>
            ))}
          </div>

          {/* Стрелка между слотами */}
          <div className="flex justify-center mb-4">
            <div className="text-green-400">{ColliderIcons.arrow}</div>
          </div>

          {/* Кнопка скрещивания */}
          {isMixing && (
            <div className="pb-4 my-auto">
              <MixingInProgress />
            </div>
          )}

          {!isMixing && (
            <div className="text-center mb-6">
              <button
                onClick={handleBreed}
                disabled={isDisabled}
                className={`px-4 py-2  rounded-xl text-sm sm:text-base font-bold transition-all duration-300 ${
                  currentToads.length > 1
                    ? "bg-gradient-to-r from-green-600 to-purple-600 hover:from-green-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105 border-2 border-white/20"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed border-2 border-transparent"
                }`}
              >
                <div className="flex items-center justify-center gap-2 px-6">
                  {ColliderIcons.mix}
                  <span>Смешать</span>
                </div>
              </button>
            </div>
          )}

          {/* Список доступных жаб */}
          {!isMixing && (
            <div className="mb-4">
              <p className="text-gray-300 text-xs sm:text-sm mb-2 text-center">
                Нажмите на жаб, чтобы добавить в колбы:
              </p>
              <div className="min-h-24">
                <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
                  {availableToads.length === 0 && (
                    <div className="text-gray-500 text-sm py-4">
                      Нет доступных жаб
                    </div>
                  )}
                  {availableToads.map((toad) => {
                    const geneticFaultConfig = getGeneticFaultConfig(
                      toad.state?.genetic_fault
                    );

                    return (
                      <button
                        key={toad.id}
                        onClick={() => handleSelectToad(toad)}
                        className={`p-2 relative rounded-lg text-xs text-center transition-all flex flex-col items-center w-[100px] max-w-[100px] border ${
                          currentToads.find((t) => t.id === toad.id)
                            ? "bg-purple-600/50 text-white cursor-not-allowed border-purple-500/50"
                            : `text-gray-300 cursor-pointer ${getRarityBackground(
                                toad.genes.rarity
                              )} hover:bg-gray-600/30`
                        }`}
                      >
                        <ToadAvatar size={6} toad={toad} />

                        {toad.pregnancy && (
                          <span className="absolute -top-1 -right-1">
                            <PregnancyIcon />
                          </span>
                        )}

                        <div className="flex items-center gap-1 mb-1 w-full justify-center min-h-[20px]">
                          <ToadGender gender={toad.sex} />
                          <span className="truncate font-medium text-[11px]">
                            {toad.name}
                          </span>
                        </div>

                        {/* Редкость */}
                        <div
                          className={`text-xs font-bold ${getRarityColor(
                            toad.genes.rarity
                          )} flex items-center gap-1 mb-1`}
                        >
                          <span className="text-[10px]">
                            {getRarityBadge(toad.genes.rarity)}
                          </span>
                          <span>{toad.genes.rarity.toFixed(1)}</span>
                        </div>

                        {/* Генетическая поломка */}
                        <div
                          className={`w-full rounded px-1 py-0.5 text-[9px] font-medium border ${geneticFaultConfig.bgColor} ${geneticFaultConfig.borderColor} ${geneticFaultConfig.color}`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{geneticFaultConfig.icon}</span>
                            <span>{toad.state?.genetic_fault || 0}%</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Кнопки управления */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleReset}
              disabled={isMixing}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white py-2 text-sm sm:text-base rounded-xl transition-all duration-300 border border-gray-600"
            >
              Очистить
            </button>
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white py-2 text-sm sm:text-base rounded-xl transition-all duration-300 border border-gray-600"
            >
              Закрыть
            </button>
          </div>
        </>
      ) : (
        <div className="text-center">
          {/* Сообщение о результате */}
          <div
            className={`rounded-xl p-4 mb-4 border-2 ${
              breedingResult.success
                ? "bg-green-900/30 border-green-500/50 text-green-300"
                : "bg-red-900/30 border-red-500/50 text-red-300"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div className="text-left">
                <div className="font-bold text-sm mb-1">
                  {breedingResult.success &&
                  breedingResult.child.type !== ToadTypes.mutant
                    ? "Успешное скрещивание!"
                    : "Особый результат"}
                </div>
                <div className="text-sm leading-relaxed">
                  {breedingResult.message}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
            {/* Верхний блок: аватар + редкость + имя */}
            <div className="flex items-center gap-4 mb-4">
              {/* Поле ввода имени */}
              <div className="flex-1">
                <div className="flex items-center gap-2 ">
                  <button
                    className="text-xl p-2 hover:bg-gray-600/50 rounded-xl transition-colors flex-shrink-0"
                    onClick={generateRandomName}
                    title="Сгенерировать имя"
                  >
                    🎲
                  </button>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Введите имя для жабы..."
                    className="bg-gray-600/50 border border-gray-500 text-white rounded-xl px-3 py-2 text-center w-full text-sm placeholder-gray-400 focus:outline-none focus:border-green-500/50"
                  />
                </div>
              </div>

              <ToadAvatar size={10} toad={breedingResult.child} />
            </div>
            {/* Пол и поколение */}
            <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <ToadGender gender={breedingResult.child.sex} />
                <span>
                  {breedingResult.child.sex === "neuter"
                    ? "Бесполый"
                    : breedingResult.child.sex === "male"
                    ? "Самец"
                    : "Самка"}
                </span>
              </div>
              <div className="w-px h-4 bg-gray-500"></div>
              <div>Поколение: {breedingResult.child!.generation}</div>
            </div>
            {/* Редкость */}
            <div
              className={`text-center my-3 ${getRarityColor(
                breedingResult.child!.genes.rarity
              )}`}
            >
              <span className="text-gray-500 text-sm">Редкость:</span>{" "}
              {getRarityBadge(breedingResult.child!.genes.rarity)}{" "}
              <span className="font-semibold">
                {breedingResult.child!.genes.rarity.toFixed(1)}
              </span>
            </div>

            {/* Таблица характеристик */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-gray-400 bg-gray-600/30 rounded-lg p-2 text-center">
                <div className="text-gray-500 text-xs mb-1">Размер</div>
                <div className="font-semibold">
                  {breedingResult.child!.genes.weight.toFixed(1)}
                </div>
              </div>
              <div className="text-gray-400 bg-gray-600/30 rounded-lg p-2 text-center">
                <div className="text-gray-500 text-xs mb-1">Скорость</div>
                <div className="font-semibold">
                  {breedingResult.child!.genes.speed.toFixed(1)}
                </div>
              </div>
              <div className="text-gray-400 bg-gray-600/30 rounded-lg p-2 text-center">
                <div className="text-gray-500 text-xs mb-1">Аппетит</div>
                <div className="font-semibold">
                  {breedingResult.child!.genes.hungerRate.toFixed(1)}
                </div>
              </div>
              <div className="text-gray-400 bg-gray-600/30 rounded-lg p-2 text-center">
                <div className="text-gray-500 text-xs mb-1">Плодовитость</div>
                <div className="font-semibold">
                  {breedingResult.child!.genes.fertility.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Генетическая поломка */}
            {breedingResult.child!.state?.genetic_fault !== undefined && (
              <div className="mb-3">
                <div
                  className={`rounded-xl p-3 border-2 ${
                    getGeneticFaultConfig(
                      breedingResult.child!.state?.genetic_fault
                    ).bgColor
                  } ${
                    getGeneticFaultConfig(
                      breedingResult.child!.state?.genetic_fault
                    ).borderColor
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-lg">
                      {
                        getGeneticFaultConfig(
                          breedingResult.child!.state?.genetic_fault
                        ).icon
                      }
                    </span>
                    <span className="text-gray-400 text-sm font-semibold">
                      ГЕНЕТИКА
                    </span>
                  </div>
                  <div
                    className={`text-base font-bold ${
                      getGeneticFaultConfig(
                        breedingResult.child!.state?.genetic_fault
                      ).color
                    } mb-1`}
                  >
                    {
                      getGeneticFaultConfig(
                        breedingResult.child!.state?.genetic_fault
                      ).label
                    }{" "}
                    ({breedingResult.child!.state?.genetic_fault}%)
                  </div>
                  <div className="text-gray-500 text-xs leading-relaxed">
                    {
                      getGeneticFaultConfig(
                        breedingResult.child!.state?.genetic_fault
                      ).description
                    }
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Кнопка подтверждения */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              className="flex-1 bg-gradient-to-r mt-4 from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-3 text-base rounded-xl transition-all duration-300 transform hover:scale-105 border-2 border-white/20 shadow-lg font-bold"
            >
              Поместить в инкубатор
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
