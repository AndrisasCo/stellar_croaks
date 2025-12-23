import { useRef, useState } from "react";
import { completeAchivement } from "../../backend/achivements-manager";
import { useNotifications } from "../../hooks/use-notification";
import SceneInfoModal from "../modals/SceneInfoModal";
import { ToadInfo } from "../modals/ToadInfoModal";
import ToadListModal from "../modals/ToadListModal";
import { ArrowLeftButtonCompact } from "../shared/ArrowLeft";
import { ArrowRightButtonCompact } from "../shared/ArrowRight";
import { ClickButton } from "../shared/ClickButton";
import ToadCanvas from "../ToadCanvas";
import { useToads } from "../ToadContext";

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
      {/* Навигация между сценами */}
      <div className="flex items-center gap-4 mb-2 justify-between relative">
        <ArrowLeftButtonCompact
          onClick={onPrevScene}
          disabled={isFirstScene}
          className="w-12 h-12 flex-none"
        />

        <div className="flex flex-col min-h-16 justify-between gap-1">
          <h2 className="text-white font-bold text-lg text-center  leading-none whitespace-break-spaces">
            {currentScene.name}
          </h2>
          {!selectedToad && (
            <div className="text-center">
              <span className="font-bold text-sm">{currentSceneIndex + 1}</span>
              <span className="text-sm">/</span>
              <span className="font-bold text-sm">{ownedScenes.length}</span>
            </div>
          )}
          {/* Правая часть - панель управления */}
          {/* Кнопка информации о выбранной жабе */}
          {selectedToad && (
            <ClickButton
              onClick={() => setIsInfoOpen(true)}
              className="
                relative h-8  my-auto
            border-[#00e1ff] border-[1px]
                flex items-center justify-center gap-2  backdrop-blur-sm
                px-3 py-1  rounded-md  text-sm
                transition-all duration-300 transform
                text-white 
                active:scale-95 bg-gray-700/50 hover:bg-gray-600/50
              "
            >
              <span className="truncate max-w-[180px]">
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
        </div>

        <ArrowRightButtonCompact
          onClick={onNextScene}
          disabled={isLastScene}
          className="w-12 h-12 flex-none"
        />
      </div>

      {/* Основной канвас с жабами */}
      <ToadCanvas
        isFoodActive={isFoodActive}
        setIsFoodActive={setIsFoodActive}
      />
      <div className="w-[100vw] h-[350px] absolute left-[-8px]  bg-[url('/assets/main-end.png')] cover max-w-2xl  " />
      <div className="flex border-b-2 ml-[-8px] max-w-2xl border-[#00e1ff] w-[100vw]  items-center gap-2 justify-between  relative  bg-slate-800/50 backdrop-blur-sm rounded-md p-2">
        <ClickButton
          onClick={handleSceneInfo}
          className="
             bg-[url('/assets/cage-btn.png')] cover
              w-[100px] h-[60px]
              transition-all duration-300 transform
              hover:scale-105 active:scale-95
            "
          title="Статистика сцене"
        ></ClickButton>

        <ClickButton
          ref={buttonRef}
          onClick={handleShowFoodTooltip}
          disabled={isFoodActive}
          className="
             bg-[url('/assets/feed-btn.png')] cover
                            w-[100px] h-[60px]
              transition-all duration-300 transform
              hover:scale-105 active:scale-95
                disabled:opacity-60
              "
          title="Покормить жаб"
        ></ClickButton>

        {/* Тултип подтверждения */}
        {showFoodTooltip && (
          <div className="absolute bottom-full right-2 transform  mb-2 z-50">
            <div
              className="
                  bg-gray-800 border border-gray-600 rounded-lg p-3 
                  shadow-lg min-w-[250px] backdrop-blur-sm
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
                  <img src={"/assets/food.png"} width={30} />
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

        <ClickButton
          onClick={handleViewToads}
          className="
             bg-[url('/assets/list-btn.png')] cover
                            w-[100px] h-[60px]

              transition-all duration-300 transform
              hover:scale-105 active:scale-95
            "
          title="Список жаб"
        ></ClickButton>
      </div>

      {/* Модальные окна */}
      {isInfoOpen && <ToadInfo onClose={onInfoClose} />}

      <ToadListModal
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
