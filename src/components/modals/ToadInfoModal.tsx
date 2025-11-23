import { TYPE_ICONS } from "../../utils/constants";
import {
  getPersonalityLabel,
  getPersonalityDescription,
  getPersonalityMultipliers,
  getRarityConfig,
  personalities,
  Toad,
  HOURS_TO_GROW_UP,
} from "../../models/toad";
import { useToads } from "../ToadContext";
import { InfoIcons } from "../../assets/icons";
import Modal from "../shared/Modal";
import { useState } from "react";
import { Tooltip } from "../shared/Tooltip";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { updateToadById } from "../../backend";

interface ToadInfoProps {
  onClose: () => void;
}

export default function ToadInfo({ onClose }: ToadInfoProps) {
  const {
    selectedToad: toad,
    toads,
    selectToad,
    handleFeedToads,
    ownedScenes,
    currentScene,
  } = useToads();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(toad?.name || "");
  const [showPersonalityTooltip, setShowPersonalityTooltip] = useState(false);
  const [showScenesTooltip, setShowScenesTooltip] = useState(false);
  const { playCrunchShort } = useSoundEffects();

  const allScenes = ownedScenes.filter((s) => s.id !== currentScene.id);

  if (!toad) {
    return null;
  }

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== toad.name) {
      updateToadById(toad.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const calculateAge = () => {
    const created = new Date(toad.created_at).getTime();
    const now = Date.now();
    const diff = now - created;
    return Math.floor(diff / (1000 * 60 * 60 * 24)); // дни
  };

  const calculatePregnancyProgress = () => {
    if (!toad.pregnancy?.isPregnant) {
      return null;
    }

    const start = toad.pregnancy.pregnancyStart;
    const duration = toad.pregnancy.pregnancyDuration * 60 * 60 * 1000;
    const now = Date.now();
    const elapsed = now - start;
    const progress = (elapsed / duration) * 100;
    const timeLeft = Math.max(Math.ceil((duration - elapsed) / (60 * 1000)), 0);

    return { progress: Math.min(progress, 100), timeLeft };
  };

  const pregnancyInfo = calculatePregnancyProgress();

  const calculateGrowProgress = () => {
    if (toad.stage !== "toadpole") {
      return null;
    }

    const start = new Date(toad.created_at).getTime();
    const duration = HOURS_TO_GROW_UP * 60 * 60 * 1000;
    const now = Date.now();
    const elapsed = now - start;
    const progress = (elapsed / duration) * 100;
    const timeLeft = Math.max(Math.ceil((duration - elapsed) / (60 * 1000)), 0);

    return { progress: Math.min(progress, 100), timeLeft };
  };

  const growInfo = calculateGrowProgress();

  const handleNextToad = () => {
    setShowScenesTooltip(false);
    const currIndex = toads.findIndex((t) => t.id === toad.id);
    if (currIndex === -1) return;
    selectToad(toads[(currIndex + 1) % toads.length].id);
  };

  const handlePrevToad = () => {
    setShowScenesTooltip(false);

    const currIndex = toads.findIndex((t) => t.id === toad.id);
    if (currIndex === -1) return;
    selectToad(toads[(currIndex - 1 + toads.length) % toads.length].id);
  };

  const rarityConfig = getRarityConfig(toad.genes?.rarity || 1);
  const personalityData = toad.genes?.personality
    ? personalities[toad.genes.personality as keyof typeof personalities]
    : null;
  const personalityMultipliers = getPersonalityMultipliers(
    toad.genes?.personality || null
  );

  const icon = (
    <div
      style={{ display: toad.sex === "neuter" ? "none" : "flex" }}
      className={`flex items-center justify-center w-9 rounded-xl ${
        toad.sex === "male"
          ? "bg-blue-900/50 border-blue-500/50"
          : toad.sex === "female"
          ? "bg-pink-900/50 border-pink-500/50"
          : "bg-gray-900/50 border-gray-500/50"
      } border-2`}
    >
      <span className="text-xl">
        {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS]}
      </span>
    </div>
  );

  const feedToad = async (toadId: number) => {
    playCrunchShort();
    handleFeedToads([toadId]);
  };

  const handleMoveToScene = (scene_id: number | null) => () => {
    updateToadById(toad.id, { scene_id });
    handleNextToad();
  };

  return (
    <Modal
      isOpen
      icon={icon}
      title={
        <div className="flex items-center justify-between w-full px-2">
          <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2 max-w-full">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="bg-gray-700 outline-none border border-gray-600 rounded-lg px-3 py-2 text-white text-lg font-semibold w-full max-w-40"
                  autoFocus
                  onBlur={handleNameSave}
                  onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 max-w-full">
                <span className="text-lg px-2 py-1 font-semibold truncate max-w-40">
                  {toad.name}
                </span>
                <button
                  onClick={() => {
                    setEditedName(toad.name || "");
                    setIsEditingName(true);
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
                >
                  {InfoIcons.pencil}
                </button>
              </div>
            )}
          </div>
        </div>
      }
      onClose={onClose}
    >
      <div className="flex justify-between items-center mb-4 px-10">
        <p className="text-gray-400 text-xs">Поколение {toad.generation}</p>
        <p className="text-gray-400 text-xs">
          {toad.stage === "adult" ? "Взрослый" : "Детеныш"}: {calculateAge()}{" "}
          дней
        </p>
      </div>

      <div className="flex">
        <button
          onClick={handlePrevToad}
          className="text-gray-400 hover:text-white transition-colors p-1 touch-manipulation active:scale-95"
          title="Предыдущая жаба"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="min-w-8 min-h-8"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="flex flex-col w-full overflow-y-auto h-[calc(80vh-100px)]">
          {/* РЕДКОСТЬ - на всю ширину */}
          <div className="bg-gray-700/50 rounded-xl p-2 mb-3 border border-gray-600/50">
            <div className="flex items-center gap-2 mb-1">
              {InfoIcons.rarity}
              <p className="text-gray-400 text-xs font-medium">РЕДКОСТЬ</p>
            </div>
            <p className={`text-sm font-semibold ${rarityConfig.color}`}>
              {rarityConfig.label} ({toad.genes?.rarity?.toFixed(1) || "1.0"})
            </p>
          </div>

          {/* ПЛОДОВИТОСТЬ и HUNGER RATE - колонки */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.fertility}
                <p className="text-gray-400 text-xs font-medium">
                  ПЛОДОВИТОСТЬ
                </p>
              </div>
              <p
                className={`
                          ${
                            toad.genes?.fertility > 1
                              ? "text-green-400"
                              : "text-red-400"
                          } text-sm font-semibold`}
              >
                {toad.genes?.fertility?.toFixed(1) || "1.0"}x
              </p>
            </div>

            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.hunger}
                <p className="text-gray-400 text-xs font-medium">HUNGER RATE</p>
              </div>
              <p
                className={`
                          ${
                            toad.genes?.hungerRate < 1
                              ? "text-green-400"
                              : "text-red-400"
                          } text-sm font-semibold`}
              >
                {toad.genes?.hungerRate?.toFixed(1) || "1.0"}x
              </p>
            </div>
          </div>

          {/* РАЗМЕР и СКОРОСТЬ - колонки */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.weight}
                <p className="text-gray-400 text-xs font-medium">РАЗМЕР</p>
              </div>
              <p className="text-blue-400 text-sm font-semibold">
                {toad.genes?.weight?.toFixed(1) || "0.0"}
              </p>
            </div>

            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.speed}
                <p className="text-gray-400 text-xs font-medium">СКОРОСТЬ</p>
              </div>
              <p className="text-blue-400 text-sm font-semibold">
                {toad.genes?.speed?.toFixed(1) || "0.0"}
              </p>
            </div>
          </div>

          {/* ХАРАКТЕР */}
          <div className="relative">
            <div
              onClick={() =>
                personalityData &&
                setShowPersonalityTooltip(!showPersonalityTooltip)
              }
              className={`bg-gray-700/50 rounded-xl p-2 mb-3 border border-gray-600/50 transition-colors ${
                personalityData ? "cursor-pointer hover:bg-gray-600/50" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {InfoIcons.personality}
                <p className="text-gray-400 text-xs font-medium">ХАРАКТЕР</p>
              </div>
              <p
                className={`text-sm  ${
                  toad.genes?.personality ? "text-purple-400" : "text-gray-400"
                }`}
              >
                {getPersonalityLabel(toad.genes?.personality || null)}
              </p>
              {personalityData && (
                <p className="text-gray-500 text-xs mt-1">
                  {getPersonalityDescription(toad.genes?.personality)}
                </p>
              )}
            </div>

            {showPersonalityTooltip && personalityData && (
              <Tooltip
                title="Влияние характера"
                isOpen={showPersonalityTooltip && personalityData}
                onClose={() => setShowPersonalityTooltip(false)}
              >
                <>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Аппетит:</span>
                      <span
                        className={
                          personalityData.hungerRate > 1
                            ? "text-red-400"
                            : "text-green-400"
                        }
                      >
                        {personalityData.hungerRate.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Плодовитость:</span>
                      <span
                        className={
                          personalityData.fertility > 1
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {personalityData.fertility.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Размер:</span>
                      <span>
                        {personalityMultipliers.weightMultiplier.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Скорость:</span>
                      <span>
                        {personalityMultipliers.speedMultiplier.toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-600">
                    <p className="text-gray-400 text-xs italic">
                      {personalityData.description}
                    </p>
                  </div>
                </>
              </Tooltip>
            )}
          </div>

          {/* СЫТОСТЬ */}
          <div className="bg-gray-700/50 min-h-14  justify-between rounded-xl p-2 mb-3 border flex-col border-gray-600/50 items-center flex gap-2">
            <div className="flex w-full justify-between items-center">
              <div className="flex items-center gap-4 justify-between">
                <div className="flex items-center gap-2">
                  {InfoIcons.hunger}
                  <p className="text-gray-400 text-xs font-medium">СЫТОСТЬ</p>
                </div>
                <p className="text-gray-400 text-xs">
                  {toad.state?.hunger || 0}/100
                </p>
              </div>
            </div>

            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  (toad.state?.hunger || 0) < 30
                    ? "bg-red-500"
                    : (toad.state?.hunger || 0) < 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${toad.state?.hunger || 0}%` }}
              />
            </div>
          </div>

          {/* РОСТ */}
          {growInfo && (
            <div className="bg-purple-900/20 rounded-xl p-2 mb-3 border border-purple-500/50">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-purple-400 text-xs font-medium">РОСТ</p>
              </div>
              <div className="space-y-2">
                <p className="text-purple-300 text-sm">
                  Осталось: {growInfo.timeLeft} минут
                </p>
                <div className="w-full bg-purple-900/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${growInfo.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* БЕРЕМЕННОСТЬ */}
          {toad.pregnancy?.isPregnant && pregnancyInfo && (
            <div className="bg-pink-900/20 rounded-xl p-2 mb-3 border border-pink-500/50">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-pink-400 text-xs font-medium">
                  БЕРЕМЕННОСТЬ
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-pink-300 text-sm">
                  Осталось: {pregnancyInfo.timeLeft} минут
                </p>
                <div className="w-full bg-pink-900/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-pink-500"
                    style={{ width: `${pregnancyInfo.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ОПИСАНИЕ */}
          <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
            <div className="flex items-center gap-2 mb-2">
              {InfoIcons.description}
              <p className="text-gray-400 text-xs font-medium">ОПИСАНИЕ</p>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              {toad.description || "Описание отсутствует"}
            </p>
          </div>

          {/* ПАНЕЛЬ УПРАВЛЕНИЯ */}
          <div className="bg-gray-800/50 rounded-xl p-2 border border-gray-600/50 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-gray-400 text-xs font-medium">УПРАВЛЕНИЕ</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => feedToad(toad.id)}
                className="flex items-center justify-center gap-1 py-2 px-2 bg-green-600/30 hover:bg-green-600/40 rounded-lg transition-all text-xs"
              >
                <span>🍎</span>
                <span>Накормить</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowScenesTooltip(!showScenesTooltip)}
                  className="flex items-center justify-center gap-1 py-2 px-2 bg-blue-600/30 hover:bg-blue-600/40 rounded-lg transition-all text-xs w-full"
                >
                  <span>🏠</span>
                  <span>Переместить</span>
                </button>

                {showScenesTooltip && (
                  <Tooltip
                    revert
                    title="Куда"
                    isOpen={showScenesTooltip}
                    onClose={() => setShowScenesTooltip(false)}
                  >
                    <div className="space-y-1">
                      <button
                        onClick={handleMoveToScene(null)}
                        className="w-full text-left p-2 hover:bg-gray-600 truncate rounded text-xs"
                      >
                        📦 На склад
                      </button>
                      {/* Здесь будет список вольеров из Scene[] */}
                      {allScenes.map((s) => (
                        <button
                          key={s.id}
                          onClick={handleMoveToScene(s.id)}
                          className="w-full text-left p-2 rounded text-xs"
                        >
                          🏠 {s.name}
                        </button>
                      ))}
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
          {/* ЦВЕТА */}
          {toad.genes?.colors && toad.genes.colors.length > 0 && (
            <div className="my-3">
              <p className="text-gray-400 text-xs font-medium mb-2">ЦВЕТА</p>
              <div className="flex gap-1">
                {toad.genes.colors.map((color, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full border-2 border-white/30 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={`Цвет ${index + 1}: ${color}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleNextToad}
          className="text-gray-400 hover:text-white transition-colors p-1 touch-manipulation active:scale-95"
          title="Следующая жаба"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="min-w-8 min-h-8"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <button
        onClick={onClose}
        className="flex-1 w-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white py-3 text-base rounded-xl transition-all duration-300 border border-gray-600 touch-manipulation active:scale-95"
      >
        Закрыть
      </button>
    </Modal>
  );
}
