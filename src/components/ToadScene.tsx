import { useRef, useState } from "react";

import { useToads } from "./ToadContext";
import { SceneIcons } from "../assets/icons";
import ToadInfo from "./modals/ToadInfoModal";
import { ArrowLeftButtonCompact } from "./shared/ArrowLeft";
import { ArrowRightButtonCompact } from "./shared/ArrowRight";
import ToadCanvas from "./ToadCanvas";
import ToadListModal from "./modals/ToadListModal";
import SceneInfoModal from "./modals/SceneInfoModal";
import { useFlyingNumbers } from "../hooks/use-flying-numbers";
import FlyingNumber from "./shared/FlyingNumbers";
import { triggerNotification } from "../hooks/use-notification";

export default function ToadScene() {
  const {
    selectedToad,
    toads,
    selectToad,
    currentScene,
    setCurrentSceneId,
    ownedScenes,
    currentSceneIndex,
    handleFeedToads,
    account,
  } = useToads();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const { flyingNumbers, addFlyingNumber, removeFlyingNumber } =
    useFlyingNumbers();

  const isFoodAvailable = (account?.storage?.food || 0) >= toads.length;

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isSceneInfoOpen, setIsSceneInfoOpen] = useState(false);
  const [isFoodActive, setIsFoodActive] = useState(false);

  const onToadSelect = (toadId: number) => {
    selectToad(toadId);
    setIsInfoOpen(true);
  };

  const isFirstScene = currentSceneIndex === 0;
  const isLastScene = currentSceneIndex === ownedScenes.length - 1;

  const onNextScene = () => {
    setCurrentSceneId(currentSceneIndex + 1);
  };

  const onPrevScene = () => {
    setCurrentSceneId(currentSceneIndex - 1);
  };

  // Функции для панели управления (заглушки)
  const handleSceneInfo = () => {
    console.log("📊 Открыть данные о сцене:", currentScene?.name);
    setIsSceneInfoOpen(true);
  };

  const handleSetFood = () => {
    if (isFoodActive) {
      return;
    }
    if (!isFoodAvailable) {
      // Показываем временное уведомление

      triggerNotification("Недостаточно корма на складе!");
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: 0,
      };

      addFlyingNumber(`-${toads.length}`, "red", position);
    }
    setIsFoodActive(true);
    handleFeedToads(toads.map((t) => t.id));
    console.log("🍽️ Покормить жаб на сцене:", currentScene?.name);
  };

  const handleViewToads = () => {
    console.log("👀 Посмотреть список жаб на сцене");
    setIsListOpen(true);
  };

  if (!currentScene) {
    return null;
  }

  return (
    <div className="relative">
      {/* Заголовок с иконкой и панелью управления */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
        {/* Левая часть - название сцены */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="text-green-400 flex-shrink-0">{SceneIcons.pond}</div>
          <h2 className="text-white font-bold text-sm truncate">
            {currentScene.name}
          </h2>
        </div>

        {/* Правая часть - панель управления */}
        <div className="flex gap-1 sm:gap-2 items-center flex-shrink-0">
          {/* Кнопка информации о выбранной жабе */}
          {selectedToad && (
            <button
              onClick={() => setIsInfoOpen(true)}
              className="
                flex items-center justify-center gap-2 
                px-3 py-2 h-10 rounded-xl font-medium text-xs
                transition-all duration-300 transform
                text-gray-300 hover:text-white hover:scale-105
                active:scale-95 bg-gray-700/50 hover:bg-gray-600/50
                border border-gray-600/50 hover:border-green-500/50
              "
            >
              <span className="truncate max-w-[80px]">
                {selectedToad?.name}
              </span>
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}

          {/* Кнопка кормления жаб - ИКОНКА ЕДЫ */}

          <button
            ref={buttonRef}
            onClick={handleSetFood}
            // disabled={isFoodActive}
            className="
              flex items-center justify-center 
              w-10 h-10 rounded-lg 
              transition-all duration-300 transform
              border-2 backdrop-blur-sm
              bg-yellow-900/30 text-yellow-400 border-yellow-600/50 
              hover:border-yellow-400 hover:bg-yellow-800/50 
              hover:scale-105 active:scale-95
              disabled:opacity-60
            "
            title="Покормить жаб"
          >
            🍎
          </button>
          {flyingNumbers.map(({ id, value, color, position }) => (
            <FlyingNumber
              key={id}
              value={value}
              color={color}
              position={position}
              onComplete={() => removeFlyingNumber(id)}
              duration={2000}
            />
          ))}
          {/* Кнопка информации о сцене - ИКОНКА ГРАФИКА */}
          <button
            onClick={handleSceneInfo}
            className="
              flex items-center justify-center 
              w-10 h-10 rounded-lg 
              transition-all duration-300 transform
              border-2 backdrop-blur-sm
              bg-blue-900/30 text-blue-400 border-blue-600/50 
              hover:border-blue-400 hover:bg-blue-800/50 
              hover:scale-105 active:scale-95
              hover:text-blue-300
            "
            title="Статистика сцены"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </button>

          {/* Кнопка списка жаб - ИКОНКА СПИСКА */}
          <button
            onClick={handleViewToads}
            className="
              flex items-center justify-center 
              w-10 h-10 rounded-lg 
              transition-all duration-300 transform
              border-2 backdrop-blur-sm
              bg-green-900/30 text-green-400 border-green-600/50 
              hover:border-green-400 hover:bg-green-800/50 
              hover:scale-105 active:scale-95
              hover:text-green-300
            "
            title="Список жаб"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Основной канвас с жабами */}
      <ToadCanvas
        isFoodActive={isFoodActive}
        setIsFoodActive={setIsFoodActive}
      />

      {/* Навигация между сценами */}
      <div className="flex items-center gap-4 mt-2 justify-between">
        <ArrowLeftButtonCompact onClick={onPrevScene} disabled={isFirstScene} />

        <div className="flex items-center gap-2 px-4 py-2 text-gray-400">
          <span className="font-bold text-sm">{currentSceneIndex + 1}</span>
          <span className="text-sm">/</span>
          <span className="font-bold text-sm">{ownedScenes.length}</span>
        </div>

        <ArrowRightButtonCompact onClick={onNextScene} disabled={isLastScene} />
      </div>

      {/* Модальные окна */}
      {isInfoOpen && <ToadInfo onClose={() => setIsInfoOpen(false)} />}

      <ToadListModal
        toads={toads}
        isOpen={isListOpen}
        onClose={() => setIsListOpen(false)}
        onToadSelect={onToadSelect}
      />

      {/* Модальное окно информации о сцене */}
      {isSceneInfoOpen && (
        <SceneInfoModal
          isOpen={isSceneInfoOpen}
          onClose={() => setIsSceneInfoOpen(false)}
        />
      )}
    </div>
  );
}
