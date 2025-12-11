import { useRef, useState } from "react";
import { useToads } from "./ToadContext";
import ToadInfo from "./modals/ToadInfoModal";
import { ArrowLeftButtonCompact } from "./shared/ArrowLeft";
import { ArrowRightButtonCompact } from "./shared/ArrowRight";
import ToadCanvas from "./ToadCanvas";
import ToadListModal from "./modals/ToadListModal";
import SceneInfoModal from "./modals/SceneInfoModal";
import { useNotifications } from "../hooks/use-notification";
import { completeAchivement } from "../backend/achivements-manager";
import { ClickButton } from "./shared/ClickButton";

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
  const { addNotification } = useNotifications();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isFoodAvailable = (account?.storage?.food || 0) >= toads.length;

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isSceneInfoOpen, setIsSceneInfoOpen] = useState(false);
  const [isFoodActive, setIsFoodActive] = useState(false);
  const [showFoodTooltip, setShowFoodTooltip] = useState(false);
  const [lastToadId, setLastToadId] = useState(null);

  const onToadSelect = (toadId: number) => {
    selectToad(toadId);
    setIsInfoOpen(true);
  };

  const onInfoClose = () => {
    setIsInfoOpen(false);

    if (lastToadId) {
      setIsListOpen(true);
    }
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

  const handleShowFoodTooltip = () => {
    if (!isFoodAvailable) {
      addNotification({
        content: `Недостаточно корма на складе! Не хватает: ${Math.abs(
          (account?.storage?.food || 0) - toads.length
        )}`,
        type: "warn",
      });
      return;
    }
    setShowFoodTooltip(true);
  };

  const handleConfirmFeed = () => {
    if (isFoodActive) {
      return;
    }
    completeAchivement("feed-all");
    setIsFoodActive(true);
    setShowFoodTooltip(false);
    handleFeedToads(toads.map((t) => t.id));
  };

  const handleCancelFeed = () => {
    setShowFoodTooltip(false);
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
          {/* Кнопка информации о сцене - ИКОНКА ГРАФИКА */}
          <ClickButton
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
            title="Статистика сцене"
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
          </ClickButton>
          <h2 className="text-white font-bold text-sm truncate">
            {currentScene.name}
          </h2>
        </div>

        {/* Правая часть - панель управления */}
        <div className="flex gap-1 sm:gap-2 items-center flex-shrink-0">
          {/* Кнопка информации о выбранной жабе */}
          {selectedToad && (
            <ClickButton
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
            </ClickButton>
          )}

          {/* Кнопка кормления жаб - ИКОНКА ЕДЫ */}
          <div className="relative">
            <ClickButton
              ref={buttonRef}
              onClick={handleShowFoodTooltip}
              disabled={isFoodActive}
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
            </ClickButton>

            {/* Тултип подтверждения */}
            {showFoodTooltip && (
              <div className="absolute bottom-full right-2 transform  mb-2 z-50">
                <div
                  className="
                  bg-gray-800 border border-gray-600 rounded-lg p-3 
                  shadow-lg min-w-[200px] backdrop-blur-sm
                "
                >
                  <div className="text-white text-sm text-center mb-2">
                    Вы потратите{" "}
                    <span className="text-yellow-400 font-bold">
                      {toads.length}
                    </span>{" "}
                    корма
                  </div>
                  <div className="flex gap-2">
                    <ClickButton
                      onClick={handleCancelFeed}
                      className="
                        flex-1 py-2 px-3 rounded text-sm
                        bg-gray-600 hover:bg-gray-500 text-white
                        transition-colors duration-200
                      "
                    >
                      Отмена
                    </ClickButton>
                    <ClickButton
                      onClick={handleConfirmFeed}
                      className="
                        flex-1 py-2 px-3 rounded text-sm
                        bg-yellow-600 hover:bg-yellow-500 text-white
                        transition-colors duration-200
                        flex items-center justify-center gap-1
                      "
                    >
                      <span>🍎</span>
                      Покормить
                    </ClickButton>
                  </div>
                </div>

                {/* Стрелка тултипа */}
                <div
                  className="
                  absolute top-full left-1/2 transform -translate-x-1/2
                  w-0 h-0 border-l-4 border-r-4 border-t-4
                  border-l-transparent border-r-transparent border-t-gray-800
                "
                ></div>
              </div>
            )}
          </div>

          {/* Кнопка списка жаб - ИКОНКА СПИСКА */}
          <ClickButton
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
          </ClickButton>
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
      {isInfoOpen && <ToadInfo onClose={onInfoClose} />}

      <ToadListModal
        toads={toads}
        isOpen={isListOpen}
        onClose={() => setIsListOpen(false)}
        onToadSelect={onToadSelect}
        lastToadId={lastToadId}
        setLastToadId={setLastToadId}
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
