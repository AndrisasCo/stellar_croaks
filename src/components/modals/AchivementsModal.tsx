import React from "react";
import Modal from "../shared/Modal";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import {
  claimReward,
  getAchievementState,
} from "../../backend/achivements-manager";
import { achievementGroups } from "../../backend/achivements-manager/achivements-list";
import { createToad, updateUser } from "../../backend";
import { useNotifications } from "../../hooks/use-notification";
import { getGameState } from "../../backend/localStorage";
import { CURRENCY_CONFIG, MAX_STORED_TOADS } from "../../utils/constants";

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AchievementModal: React.FC<AchievementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { playClick } = useSoundEffects();
  const { addNotification } = useNotifications();

  const achivements = getAchievementState();
  const gameState = getGameState();

  const icon = (
    <svg
      className="w-6 h-6 text-yellow-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  const getIsCompleted = (achievementId: string) => {
    return achivements.completed.includes(achievementId);
  };

  // Функция для получения прогресса ачивки
  const getAchievementProgress = (achievement: any) => {
    if (!achievement.taskType || !achievement.taskValue) {
      return { current: 0, target: 0, percentage: 0 };
    }

    const counter = achivements.counter[achievement.taskType] || 0;
    const target = achievement.taskValue;
    const current = Math.min(counter, target); // Не превышаем цель
    const percentage = Math.min((current / target) * 100, 100);

    return { current, target, percentage };
  };

  // Функция для форматирования чисел
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const getColorClasses = (color: string) => {
    const colors = {
      green: "from-green-900/20 to-emerald-900/10 border-green-400/30",
      blue: "from-blue-900/20 to-cyan-900/10 border-blue-400/30",
      purple: "from-purple-900/20 to-violet-900/10 border-purple-400/30",
    };
    return colors[color as keyof typeof colors] || colors.green;
  };

  const getTextColor = (color: string) => {
    const colors = {
      green: "text-green-400",
      blue: "text-blue-400",
      purple: "text-purple-400",
    };
    return colors[color as keyof typeof colors] || colors.green;
  };

  const getProgressColor = (color: string) => {
    const colors = {
      green: "bg-green-500",
      blue: "bg-blue-500",
      purple: "bg-purple-500",
    };
    return colors[color as keyof typeof colors] || colors.green;
  };

  const calculateGroupProgress = (_achievements: any) => {
    const completed = _achievements.filter((a: any) =>
      achivements.completed.includes(a.id)
    ).length;
    const total = _achievements.length;
    return { completed, total, percentage: (completed / total) * 100 };
  };

  const handleClaimReward = (group: (typeof achievementGroups)[0]) => {
    if (!group.groupReward) {
      return;
    }
    playClick();

    const userStorage = gameState.user.storage;

    group.groupReward.reward.forEach((reward) => {
      if (reward.type === "toad") {
        if (
          getGameState().toads.filter((t) => t.scene_id === null).length + 1 >
          MAX_STORED_TOADS
        ) {
          addNotification({
            type: "danger",
            content: `Все хранилища переполнены`,
          });
          return;
        }

        createToad({
          ...reward.content,
          created_at: new Date().toISOString(),
        });

        addNotification({
          type: "success",
          content: `На склад добавлена новая жаба: ${reward.content.name}`,
        });
      }

      if (reward.type === "lootbox") {
        updateUser({
          storage: {
            ...userStorage,
            lootbox: (userStorage.lootbox || 0) + reward.content,
          },
        });

        addNotification({
          type: "success",
          content: `На склад добавлены лутбоксы: ${reward.content}`,
        });
      }
    });

    claimReward(group.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} icon={icon} title="Достижения">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-color-main rounded-lg p-3 text-center border border-green-500/20">
          <div className="text-green-400 text-lg font-bold">
            {
              achievementGroups
                .flatMap((g) => g.achievements)
                .filter((a) => achivements.completed.includes(a.id)).length
            }
          </div>
          <div className="text-gray-300 text-xs">Выполнено</div>
        </div>
        <div className="bg-color-main rounded-lg p-3 text-center border border-blue-500/20">
          <div className="text-blue-400 text-lg font-bold">
            {achievementGroups.flatMap((g) => g.achievements).length}
          </div>
          <div className="text-gray-300 text-xs">Всего</div>
        </div>
        <div className="bg-color-main rounded-lg p-3 text-center border border-purple-500/20">
          <div className="text-purple-400 text-lg font-bold">
            {achivements.rewards.length}
          </div>
          <div className="text-gray-300 text-xs">Наград </div>
        </div>
      </div>

      {/* Счетчики прогресса */}
      {Object.keys(achivements.counter || {}).length > 0 && (
        <div className="mb-6 p-3 bg-color-main rounded-xl border border-gray-600/30">
          <h4 className="text-white font-semibold mb-3 text-sm">
            Прогресс по категориям:
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(achivements.counter || {}).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-2 bg-color-second/30 rounded"
              >
                <span className="text-gray-200 text-xs capitalize">
                  {key === "earn"
                    ? `Заработано ${CURRENCY_CONFIG.tokens.icon}`
                    : key === "buyToad"
                    ? "Куплено жаб"
                    : key === "sellToad"
                    ? "Продано жаб"
                    : key}
                </span>
                <span className="text-yellow-400 font-bold text-sm">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Группы достижений */}
      <div className="space-y-4">
        {achievementGroups.map((group) => {
          const progress = calculateGroupProgress(group.achievements);
          const isGroupCompleted = progress.percentage === 100;
          const isRewardClaimed = getAchievementState().rewards.includes(
            group.id
          );

          return (
            <div
              key={group.id}
              className={`
                  rounded-xl p-4 border transition-all
                  bg-gradient-to-r ${getColorClasses(group.color)}
                  ${isGroupCompleted ? "neon-glow" : ""}
                `}
            >
              {/* Заголовок группы */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <h3
                      className={`font-semibold text-lg ${getTextColor(
                        group.color
                      )}`}
                    >
                      {group.title}
                    </h3>
                    <p className="text-gray-300 text-sm">{group.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold ${getTextColor(group.color)}`}
                  >
                    {progress.completed}/{progress.total}
                  </div>
                  <div className="text-gray-300 text-xs">выполнено</div>
                </div>
              </div>

              {/* Прогресс бар группы */}
              <div className="w-full bg-color-main rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(
                    group.color
                  )}`}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              {/* Достижения группы */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {group.achievements.map((achievement) => {
                  const isCompleted = getIsCompleted(achievement.id);
                  const hasProgress =
                    achievement.taskType && achievement.taskValue;
                  const progress = hasProgress
                    ? getAchievementProgress(achievement)
                    : null;

                  return (
                    <div
                      key={achievement.id}
                      className={`
                          flex flex-col gap-2 p-3 rounded-lg border transition-all
                          ${
                            isCompleted
                              ? "bg-color-second/30 border-green-500/30"
                              : "bg-color-main border-gray-600/30"
                          }
                        `}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xl">{achievement.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium ${
                              isCompleted ? "text-white" : "text-gray-300"
                            }`}
                          >
                            {achievement.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {achievement.description}
                          </div>
                        </div>
                        <div
                          className={`
                            w-6 h-6 rounded-full border-2 flex items-center justify-center
                            ${
                              isCompleted
                                ? "bg-green-500 border-green-500"
                                : "bg-color-second border-gray-500"
                            }
                          `}
                        >
                          {isCompleted ? (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <span className="text-xs text-gray-200">
                              {hasProgress ? "" : "?"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Прогресс бар для достижений с taskValue */}
                      {hasProgress && progress && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span
                              className={`${
                                isCompleted ? "text-green-300" : "text-gray-300"
                              }`}
                            >
                              {isCompleted ? "Выполнено!" : "Прогресс:"}
                            </span>
                            <span
                              className={`font-bold ${
                                isCompleted
                                  ? "text-green-300"
                                  : "text-yellow-300"
                              }`}
                            >
                              {formatNumber(progress.current)} /{" "}
                              {formatNumber(progress.target)}
                            </span>
                          </div>
                          <div className="w-full bg-color-main rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                isCompleted
                                  ? "bg-green-500"
                                  : getProgressColor(group.color)
                              }`}
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Статус выполнения */}
                      {!hasProgress && !isCompleted && (
                        <div className="text-xs text-gray-500 text-center italic">
                          Ещё не выполнено
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Награда за группу */}
              <div
                className={`
                  flex items-center justify-between p-3 rounded-lg border
                  ${
                    isGroupCompleted
                      ? isRewardClaimed
                        ? "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-400/50"
                        : "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-400/50"
                      : "bg-color-main border-gray-600/30"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {isGroupCompleted ? (
                      group.groupReward.icon
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center border border-gray-500">
                        <span className="text-gray-200 text-lg">?</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div
                      className={`font-semibold ${
                        isGroupCompleted
                          ? isRewardClaimed
                            ? "text-yellow-300"
                            : "text-green-300"
                          : "text-gray-300"
                      }`}
                    >
                      {isGroupCompleted
                        ? group.groupReward.name
                        : "Секретная награда"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isGroupCompleted
                        ? group.groupReward.description
                        : "Завершите все достижения группы чтобы открыть"}
                    </div>
                  </div>
                </div>

                {isGroupCompleted &&
                  (isRewardClaimed ? (
                    <div className="text-yellow-400 text-sm font-semibold">
                      🎉 Получено!
                    </div>
                  ) : (
                    <button
                      onClick={() => handleClaimReward(group)}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      Забрать награду
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Подсказка о прогрессивных ачивках */}
      <div className="mt-6 p-4 bg-color-main rounded-xl border border-gray-600/30">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-yellow-400">📈</div>
          <h4 className="text-white font-semibold">О прогрессе достижений</h4>
        </div>
        <p className="text-gray-300 text-sm mb-2">
          Некоторые достижения требуют выполнения нескольких действий. Прогресс
          сохраняется автоматически.
        </p>
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Завершённое достижение</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>Достижение с прогрессом</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
            <span>Ещё не начато</span>
          </div>
        </div>
      </div>

      {/* Кнопка закрытия */}
      <button
        onClick={() => {
          playClick();
          onClose();
        }}
        className="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
      >
        Продолжить игру
      </button>
    </Modal>
  );
};

export default AchievementModal;
