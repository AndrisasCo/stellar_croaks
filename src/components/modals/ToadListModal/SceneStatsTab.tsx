import React, { useEffect, useState } from "react";
import { Toad } from "../../../models/Toad";
import { Scene } from "../../../models/scene";
import { getGameState, updateGameState } from "../../../backend/localStorage";
import { InfoIcons } from "../../../assets/icons";
import { PRODUCTION_MIN_HUNGER } from "../../../utils/gamification-config";

/**
 * «Статистика биопода» — вторая вкладка модалки списка жаб (`ToadListModal/index.tsx`).
 *
 * Отдельной модалки статистики больше нет: у биопода два состояния — список жаб и его
 * статистика, и листать их нужно, не теряя выбор и фильтры (стрелки биоподов остаются
 * на месте в обоих состояниях). Поэтому панель — обычное содержимое модалки без `Modal`
 * (шапку рисует сам список), а биопод и его жабы приходят пропсами: их уже посчитал
 * родитель.
 *
 * Улучшений здесь нет: улучшение сектора одно (автокормушка) и ставится из модалки
 * «Улучшение сектора» — её открывает ядро карты (`modals/RoomUpgradeModal.tsx`). Прежние
 * панели «Улучшение биопода» (+10 мест за Кваксы) и «Буст» (ускоренный рост, ускоренная
 * беременность, кормушка с автопроцессором) удалены как легаси.
 */
export const SceneStatsTab: React.FC<{
  /** Биопод, статистику которого смотрим (его же листают стрелки) */
  scene: Scene;
  /** Жабы биопода — те, кто живёт в нём сейчас (`scene_id`); ушедшие в сектора не в счёте */
  toads: Toad[];
  /** Стоит ли у сектора автокормушка: по ней понятно, кормят жаб или кормят руками */
  hasAutoFeeder: boolean;
}> = ({ scene, toads, hasAutoFeeder }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [sceneName, setSceneName] = useState(scene.name || "");

  /**
   * Стрелки листают биоподы, не закрывая вкладку: чужое имя в поле ввода недопустимо,
   * а недописанное — тем более (имя сохраняется только кнопкой «Сохранить»).
   */
  useEffect(() => {
    setSceneName(scene.name || "");
    setIsEditing(false);
  }, [scene.id]);

  // Обработчик сохранения названия
  const handleSaveName = () => {
    if (!sceneName.trim() || sceneName === scene.name) {
      setIsEditing(false);
      setSceneName(scene.name || "");
      return;
    }

    try {
      const allScenes = getGameState().scenes;
      const foundScene = allScenes.find((item) => item.id === scene.id);
      if (!foundScene) {
        return;
      }
      foundScene.name = sceneName.trim();
      updateGameState({ scenes: allScenes });

      setIsEditing(false);
    } catch (error) {
      console.error("Ошибка при обновлении названия:", error);
      setSceneName(scene.name || ""); // Возвращаем старое название при ошибке
    }
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = () => {
    setIsEditing(false);
    setSceneName(scene.name || "");
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

  // Статистика по жабам биопода
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
    <div className="space-y-3 mb-6 px-1">
      {/* Название биопода: правится прямо здесь, сохранение — кнопкой галочки */}
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
                placeholder="Введите название биопода"
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
                {scene.name}
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

      {/* Население жаб: возраст, пол и беременность — вместимость биопода из шапки */}
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
            label="Мест в биоподе"
            value={`${toads.length}/${scene.capacity}`}
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

      {/* Улучшения сектора живут в отдельной модалке: их ставит ядро карты */}
      <p
        className={`mt-4 rounded-lg border p-3 text-2xs leading-snug ${
          hasAutoFeeder
            ? "border-lime-500/30 bg-lime-500/10 text-lime-100"
            : "border-amber-500/30 bg-amber-500/10 text-amber-100"
        }`}
      >
        {hasAutoFeeder
          ? `Автокормушка установлена: жабы биопода кормятся со склада сами, как только сытость падает до ${PRODUCTION_MIN_HUNGER} %.`
          : "Автокормушки нет: жаб кормят вручную (🍎 на карточке), иначе они работают вполсилы. Улучшение «Автокормушка» ставится на сектор — из модалки «Улучшение сектора» (тап по ядру в центре карты)."}
      </p>
    </div>
  );
};
