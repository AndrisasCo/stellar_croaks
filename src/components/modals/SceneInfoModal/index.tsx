import React, { useState } from "react";
import { useToads } from "../../ToadContext";
import Modal from "../../shared/Header";
import { getGameState, updateGameState } from "../../../backend/localStorage";
import { InfoIcons } from "../../../assets/icons";

/**
 * «Статистика вольера» — карточка гекса-вольера: название, население и средние гены.
 *
 * Улучшений здесь больше нет: улучшение комнаты одно (автокормушка) и ставится из модалки
 * «Улучшение комнаты» — её открывает ядро карты (`modals/RoomUpgradeModal.tsx`). Прежние
 * панели «Улучшение вольера» (+10 мест за Кваксы) и «Буст» (ускоренный рост, ускоренная
 * беременность, кормушка с автопроцессором) удалены как легаси.
 */
const SceneInfoModal: React.FC<{ sceneId: number }> = ({ sceneId }) => {
  const { ownedScenes, allToads } = useToads();
  /**
   * Вольер, статистику которого открыли. Общего «текущего вольера» больше нет: id вольера
   * приходит от гекса карты (`RoomConfig.sceneId`) — его помнит модалка списка жаб вольера.
   */
  const currentScene =
    ownedScenes.find((scene) => scene.id === sceneId) ?? null;
  /** Жабы вольера: дом жабы — её `scene_id` (по нему же считается вместимость) */
  const toads = allToads.filter((toad) => toad.scene_id === sceneId);
  const [isEditing, setIsEditing] = useState(false);
  const [sceneName, setSceneName] = useState(currentScene?.name || "");

  // Вольера может уже не быть (сейв сменился, пока модалка была открыта)
  if (!currentScene) {
    return null;
  }

  // Обработчик сохранения названия
  const handleSaveName = () => {
    if (!sceneName.trim() || sceneName === currentScene.name) {
      setIsEditing(false);
      setSceneName(currentScene.name || "");
      return;
    }

    try {
      const allScenes = getGameState().scenes;
      const foundScene = allScenes.find((s) => s.id === currentScene.id);
      if (!foundScene) {
        return;
      }
      foundScene.name = sceneName.trim();
      updateGameState({ scenes: allScenes });

      setIsEditing(false);
    } catch (error) {
      console.error("Ошибка при обновлении названия:", error);
      setSceneName(currentScene.name || ""); // Возвращаем старое название при ошибке
    }
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = () => {
    setIsEditing(false);
    setSceneName(currentScene.name || "");
  };

  // Обработчик нажатия Enter / Escape
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
      return;
    }

    if (e.key === "Escape") {
      // Esc в правке имени отменяет её, а не закрывает окно (см. ModalProvider).
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const icon = (
    <svg
      className="w-6 h-6 text-blue-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );

  // Статистика по жабам на сцене
  const toadStats = {
    total: toads.length,
    male: toads.filter((t) => t.stage === "adult" && t.sex === "male").length,
    female: toads.filter((t) => t.stage === "adult" && t.sex === "female")
      .length,
    neuter: toads.filter((t) => t.stage === "adult" && t.sex === "neuter")
      .length,

    toadpole: toads.filter((t) => t.stage === "toadpole").length,
    pregnant: toads.filter((t) => t.pregnancy?.isPregnant).length,
  };

  // Средние характеристики
  const averageStats = {
    rarity:
      toads.length > 0
        ? (
            toads.reduce((sum, t) => sum + t.genes.rarity, 0) / toads.length
          ).toFixed(1)
        : "0.0",
    weight:
      toads.length > 0
        ? (
            toads.reduce((sum, t) => sum + t.genes.weight, 0) / toads.length
          ).toFixed(1)
        : "0.0",
    speed:
      toads.length > 0
        ? (
            toads.reduce((sum, t) => sum + t.genes.speed, 0) / toads.length
          ).toFixed(1)
        : "0.0",
  };

  const StatItem = ({
    label,
    value,
    color = "text-white",
    icon,
  }: {
    label: string;
    value: string | number;
    color?: string;
    icon?: React.ReactNode;
  }) => (
    <div className="flex justify-between items-center p-3 bg-color-main rounded-lg border border-gray-600/50">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-300">{icon}</span>}
        <span className="text-gray-200 text-sm">{label}</span>
      </div>
      <span className={`${color} font-medium text-sm`}>{value}</span>
    </div>
  );

  return (
    <Modal icon={icon} title="Статистика вольера">
      {/* Основная информация о сцене */}
      <div className="space-y-3 mb-6 ">
        <div className="flex justify-between items-center p-3 bg-color-main rounded-lg border border-gray-600/50">
          <div className="flex items-center gap-2 flex-1">
            <svg
              className="w-4 h-4 text-gray-300 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={sceneName}
                  onChange={(e) => setSceneName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="flex-1 bg-gray-600/50 border border-blue-500/50 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-400"
                  placeholder="Введите название вольера"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleSaveName}
                    className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50"
                    title="Сохранить"
                  >
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                    title="Отмена"
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="text-gray-200 text-sm">Название</span>
                <span className="text-white font-medium text-sm ml-2 flex-1 overflow-auto">
                  {currentScene.name}
                </span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-300 hover:text-blue-400 transition-colors flex-shrink-0"
                  title="Редактировать название"
                >
                  {InfoIcons.pencil}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Статистика по жабам */}
        <div className="mb-4">
          <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Население жаб
          </h4>
          <div className="space-y-2">
            <StatItem
              label="Всего жаб"
              value={toadStats.total}
              color="text-white"
            />
            <StatItem
              label="Мест в вольере"
              value={`${toads.length}/${currentScene.capacity}`}
              color="text-cyan-400"
            />

            <div className="grid grid-cols-3 gap-2">
              <StatItem
                label="Самцы"
                value={toadStats.male}
                color="text-blue-400"
              />
              <StatItem
                label="Самки"
                value={toadStats.female}
                color="text-pink-400"
              />
              <StatItem
                label="Бесполые"
                value={toadStats.neuter}
                color="text-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatItem
                label="Головастики"
                value={toadStats.toadpole}
                color="text-cyan-400"
              />
              <StatItem
                label="Беременные"
                value={toadStats.pregnant}
                color="text-pink-400"
              />
            </div>
          </div>
        </div>

        {/* Средние характеристики */}
        <div>
          <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-yellow-400"
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
            Средние показатели
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-color-main rounded-lg p-3 text-center border border-gray-600/50">
              <div className="text-purple-400 text-lg font-bold">
                {averageStats.rarity}
              </div>
              <div className="text-gray-300 text-2xs mt-1">Редкость</div>
            </div>
            <div className="bg-color-main rounded-lg p-3 text-center border border-gray-600/50">
              <div className="text-blue-400 text-lg font-bold">
                {averageStats.weight}
              </div>
              <div className="text-gray-300 text-2xs mt-1">Размер</div>
            </div>
            <div className="bg-color-main rounded-lg p-3 text-center border border-gray-600/50">
              <div className="text-green-400 text-lg font-bold">
                {averageStats.speed}
              </div>
              <div className="text-gray-300 text-2xs mt-1">Скорость</div>
            </div>
          </div>
        </div>

        {/* Улучшения комнаты живут в отдельной модалке: их ставит ядро карты */}
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-2xs leading-snug text-amber-100">
          Улучшение комнаты — автокормушка: жабы комнаты кормятся со склада сами.
          Поставить её можно из модалки «Улучшение комнаты» — тап по ядру в центре
          карты.
        </p>
      </div>
    </Modal>
  );
};

export default SceneInfoModal;
