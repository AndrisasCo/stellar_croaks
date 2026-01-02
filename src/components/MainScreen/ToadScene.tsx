import { useRef, useState } from "react";
import SceneInfoModal from "../modals/SceneInfoModal";
import { ToadInfo } from "../modals/ToadInfoModal";
import ToadListModal from "../modals/ToadListModal";
import { ArrowLeftButtonCompact } from "../shared/ArrowLeft";
import { ArrowRightButtonCompact } from "../shared/ArrowRight";
import { ClickButton } from "../shared/ClickButton";
import ToadCanvas from "../ToadCanvas";
import { useToads } from "../ToadContext";
import ColliderButton from "../modals/Lab/ColliderButton";
import { useModal } from "../ModalContext";

export default function ToadScene() {
  const { openModal } = useModal();
  const {
    selectedToad,
    currentScene,
    setCurrentSceneId,
    ownedScenes,
    currentSceneIndex,
  } = useToads();

  const isFirstScene = currentSceneIndex === 0;
  const isLastScene = currentSceneIndex === ownedScenes.length - 1;

  const onNextScene = () => {
    setCurrentSceneId(currentSceneIndex + 1);
  };

  const onPrevScene = () => {
    setCurrentSceneId(currentSceneIndex - 1);
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
              onClick={() => openModal(() => <ToadInfo />)}
              className="
                relative h-8  my-auto
            border-[#00e1ff] border-[1px]
                flex items-center justify-center gap-2  backdrop-blur-sm
                px-3 py-1  rounded-md  text-sm
                transition-all duration-300 transform
                text-white 
                active:scale-95 bg-color-main hover:bg-gray-600/50
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
      <ToadCanvas />
      <div className="w-[100vw] h-[200px] absolute left-[-8px]  bg-[url('/bg/main-end.webp')] cover max-w-2xl  " />
      <div className="flex border-b-2 ml-[-8px] max-w-2xl border-[#00e1ff] w-[100vw]  items-center gap-2 justify-between  relative  bg-slate-800/50 backdrop-blur-sm rounded-md p-2">
        <ClickButton
          onClick={() => openModal(() => <SceneInfoModal />)}
          className="
             bg-[url('/assets/cage-btn.webp')] bg-contain bg-no-repeat bg-center
          w-[100px] h-[64px]
              transition-all duration-300 transform
              hover:scale-105 active:scale-95
            "
          title="Статистика сцене"
        />

        <ColliderButton />

        <ClickButton
          onClick={() => openModal(() => <ToadListModal />)}
          className="
             bg-[url('/assets/list-btn.webp')] bg-contain bg-no-repeat bg-center
                             w-[100px] h-[64px]

              transition-all duration-300 transform
              hover:scale-105 active:scale-95
            "
          title="Список жаб"
        />
      </div>
    </div>
  );
}
