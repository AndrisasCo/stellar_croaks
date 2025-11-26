import React, { useState } from "react";
import { useToads } from "../ToadContext";
import Modal from "../shared/Modal";
import { getGameState, updateGameState } from "../../backend/localStorage";
import { InfoIcons } from "../../assets/icons";
import { bonuses, BonusType, INITIAL_CAPACITY } from "../../models/scene";
import { updateScene, updateUser } from "../../backend";
import { CURRENCY_CONFIG } from "../../utils/constants";
import { useNotifications } from "../../hooks/use-notification";

interface SceneInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SceneInfoModal: React.FC<SceneInfoModalProps> = ({ isOpen, onClose }) => {
  const { currentScene, toads, account } = useToads();
  const [isEditing, setIsEditing] = useState(false);
  const [sceneName, setSceneName] = useState(currentScene?.name || "");
  const { addNotification } = useNotifications();

  if (!isOpen) return null;

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

  // Обработчик улучшения уровня вольера
  const handleUpgrade = () => {
    const newTokens = account.tokens - upgradeCost;

    if (isMaxLevel) {
      return;
    }

    if (newTokens < 0) {
      addNotification({
        type: "danger",
        content: `Не хватает ${Math.abs(newTokens)} ${
          CURRENCY_CONFIG.tokens.icon
        }`,
      });
      return;
    }

    // Здесь будет логика списания токенов и улучшения уровня
    console.log(
      `Улучшаем вольер до уровня ${sceneLevel + 1} за ${upgradeCost} токенов`
    );
    updateScene(currentScene.id, { capacity: currentScene.capacity + 10 });
    updateUser({ tokens: newTokens });
  };

  // Обработчик покупки бонусов
  const handleBuyBonus = (
    bonusType: BonusType,
    level: number,
    price: number
  ) => {
    const newQuax = account.astro_quax - price;
    if (newQuax < 0) {
      addNotification({
        type: "danger",
        content: `Не хватает ${Math.abs(newQuax)} ${
          CURRENCY_CONFIG.astro_quax.icon
        }`,
      });
      return;
    }
    console.log(`Покупаем бонус ${bonusType} уровня ${level}`);
    const bonuses = currentScene.bonuses || {};
    bonuses[bonusType] = level; // Устанавливаем конкретный уровень

    updateScene(currentScene.id, { bonuses });
    updateUser({ astro_quax: newQuax });
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = () => {
    setIsEditing(false);
    setSceneName(currentScene.name || "");
  };

  // Обработчик нажатия Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
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

  // Уровень вольера и стоимость улучшения
  const sceneLevel = (currentScene.capacity - INITIAL_CAPACITY) / 10 || 0;
  const isMaxLevel = sceneLevel >= 3;
  const baseCapacity = INITIAL_CAPACITY;
  const capacity = baseCapacity + sceneLevel * 10;

  // Стоимость улучшения в зависимости от текущего уровня
  const upgradeCost = (sceneLevel + 1) * 10;

  // Получение текущего уровня бонуса
  const getCurrentBonusLevel = (bonusType: BonusType) => {
    return currentScene.bonuses?.[bonusType] || 0;
  };

  // Проверка доступности уровня бонуса
  const isBonusLevelAvailable = (bonusType: BonusType, targetLevel: number) => {
    const currentLevel = getCurrentBonusLevel(bonusType);
    return currentLevel >= targetLevel - 1;
  };

  // Проверка, куплен ли уровень бонуса
  const isBonusLevelPurchased = (bonusType: BonusType, targetLevel: number) => {
    const currentLevel = getCurrentBonusLevel(bonusType);
    return currentLevel >= targetLevel;
  };

  const icons = [
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
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>,
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>,
  ];

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
    <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg border border-gray-600/50">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-gray-300 text-sm">{label}</span>
      </div>
      <span className={`${color} font-medium text-sm`}>{value}</span>
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      isOpen={isOpen}
      icon={icon}
      title="Статистика вольера"
    >
      {/* Основная информация о сцене */}
      <div className="space-y-3 mb-6 ">
        <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg border border-gray-600/50">
          <div className="flex items-center gap-2 flex-1">
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
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
                <span className="text-gray-300 text-sm">Название</span>
                <span className="text-white font-medium text-sm ml-2 flex-1 truncate">
                  {currentScene.name}
                </span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
                  title="Редактировать название"
                >
                  {InfoIcons.pencil}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Плашка улучшения вольера */}
        <div
          className={`relative overflow-hidden rounded-lg border-2 ${
            isMaxLevel
              ? "border-purple-500/50 bg-gradient-to-r from-purple-600/20 to-indigo-600/20"
              : "border-green-500/50 bg-gradient-to-r from-green-600/20 to-cyan-600/20"
          }`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    isMaxLevel ? "bg-purple-500/20" : "bg-green-500/20"
                  }`}
                >
                  {isMaxLevel ? (
                    <svg
                      className="w-6 h-6 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <h3
                    className={`font-bold text-sm ${
                      isMaxLevel ? "text-purple-200" : "text-green-200"
                    }`}
                  >
                    {isMaxLevel ? "Максимальный уровень" : "Улучшение вольера"}
                  </h3>
                  <p
                    className={`text-sm ${
                      isMaxLevel ? "text-purple-300" : "text-green-300"
                    }`}
                  >
                    Вместимость {capacity} жаб
                  </p>
                </div>
              </div>

              <div
                className={`text-right ${
                  isMaxLevel ? "text-purple-300" : "text-green-300"
                }`}
              >
                <div className="text-lg font-bold">Ур. {sceneLevel}</div>
                <div className="text-xs">
                  {isMaxLevel ? "Макс." : "След.: " + (sceneLevel + 1)}
                </div>
              </div>
            </div>

            {!isMaxLevel && (
              <button
                onClick={handleUpgrade}
                className="w-full bg-gradient-to-r mt-3 from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-green-500/25 flex gap-3 items-center text-left justify-between"
              >
                <svg
                  className="w-5 h-5 animate-bounce"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Улучшить +10 к вместимости
                <span className="text-green-200 text-xs bg-green-700/30 px-2 py-1 rounded">
                  {upgradeCost} {CURRENCY_CONFIG.tokens.icon}
                </span>
              </button>
            )}
          </div>

          {/* Анимированные элементы фона */}
          {!isMaxLevel && (
            <>
              <div className="absolute top-0 left-0 w-20 h-20 bg-green-400/10 rounded-full -translate-x-10 -translate-y-10"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-cyan-400/10 rounded-full translate-x-8 translate-y-8"></div>
              <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-green-400/30 rounded-full animate-ping"></div>
            </>
          )}

          {isMaxLevel && (
            <>
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-400/10 rounded-full translate-x-12 -translate-y-12"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-indigo-400/10 rounded-full -translate-x-10 translate-y-10"></div>
            </>
          )}
        </div>
      </div>

      {/* Плашка бонусов вольера */}
      <div className="mb-6">
        <div className="relative overflow-hidden rounded-lg border-2 border-amber-500/50 bg-gradient-to-r from-amber-600/20 to-orange-600/20">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <svg
                  className="w-6 h-6 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-200">Буст</h3>
                <p className="text-xs text-amber-300">
                  Улучшите характеристики вольера
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {bonuses.map((bonus, index) => {
                const currentLevel = getCurrentBonusLevel(bonus.type);

                return (
                  <div
                    key={bonus.type}
                    className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-amber-400">{icons[index]}</div>
                        <span className="text-amber-200 text-sm font-medium">
                          {bonus.name}
                        </span>
                      </div>
                      <span className="text-amber-300 text-xs">
                        {currentLevel > 0
                          ? `Ур. ${currentLevel}`
                          : "Не улучшено"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {bonus.levels.map((bonusLevel) => {
                        const isPurchased = isBonusLevelPurchased(
                          bonus.type,
                          bonusLevel.level
                        );
                        const isAvailable = isBonusLevelAvailable(
                          bonus.type,
                          bonusLevel.level
                        );
                        const isDisabled = !isAvailable || isPurchased;

                        return (
                          <button
                            key={bonusLevel.level}
                            onClick={() =>
                              handleBuyBonus(
                                bonus.type,
                                bonusLevel.level,
                                bonusLevel.cost
                              )
                            }
                            disabled={isDisabled}
                            className={`
                                relative text-xs font-bold py-2 px-1 rounded   shadow
                                bg-gradient-to-br  text-white from-amber-500 to-orange-500
                              `}
                          >
                            {isPurchased && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center">
                                <svg
                                  className="w-2 h-2 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}

                            <div className="font-bold text-sm">
                              +{bonusLevel.bonus}%
                            </div>
                            {!isPurchased && (
                              <div
                                className={`text-sm ${
                                  isAvailable
                                    ? "text-amber-100"
                                    : "text-gray-300"
                                }`}
                              >
                                {bonusLevel.cost}{" "}
                                {CURRENCY_CONFIG.astro_quax.icon}
                              </div>
                            )}

                            {!isAvailable && (
                              <div className="absolute inset-0 bg-gray-600/50 backdrop-blur-sm  rounded flex items-center justify-center">
                                <svg
                                  className="w-6 h-6 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                  />
                                </svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Анимированные элементы фона */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-400/10 rounded-full translate-x-10 -translate-y-10"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-orange-400/10 rounded-full -translate-x-8 translate-y-8"></div>
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-amber-400/40 rounded-full animate-pulse"></div>
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
              color="text-gray-400"
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
          <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600/50">
            <div className="text-purple-400 text-lg font-bold">
              {averageStats.rarity}
            </div>
            <div className="text-gray-400 text-[10px] mt-1">Редкость</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600/50">
            <div className="text-blue-400 text-lg font-bold">
              {averageStats.weight}
            </div>
            <div className="text-gray-400 text-[10px] mt-1">Размер</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600/50">
            <div className="text-green-400 text-lg font-bold">
              {averageStats.speed}
            </div>
            <div className="text-gray-400 text-[10px] mt-1">Скорость</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SceneInfoModal;
