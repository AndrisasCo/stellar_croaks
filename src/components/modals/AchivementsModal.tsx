import React from "react";
import Modal from "../shared/Modal";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import {
  achievementGroups,
  claimReward,
  getAchievementState,
} from "../../backend/achivements-manager";
import { createToad } from "../../backend";
import {
  triggerNotification,
  useNotifications,
} from "../../hooks/use-notification";

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

    if (group.groupReward.reward.type === "toad") {
      createToad({
        ...group.groupReward.reward.content,
        created_at: new Date().toISOString(),
      });
      playClick();
      claimReward(group.id);
      addNotification({
        type: "success",
        content: `На склад добавлена новая жаба: ${group.groupReward.reward.content.name}`,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} icon={icon} title="Достижения">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-green-500/20">
          <div className="text-green-400 text-lg font-bold">
            {
              achievementGroups
                .flatMap((g) => g.achievements)
                .filter((a) => achivements.completed.includes(a.id)).length
            }
          </div>
          <div className="text-gray-400 text-xs">Выполнено</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-blue-500/20">
          <div className="text-blue-400 text-lg font-bold">
            {achievementGroups.flatMap((g) => g.achievements).length}
          </div>
          <div className="text-gray-400 text-xs">Всего</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-purple-500/20">
          <div className="text-purple-400 text-lg font-bold">
            {achivements.rewards.length}
          </div>
          <div className="text-gray-400 text-xs">Наград </div>
        </div>
      </div>

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
                    <p className="text-gray-400 text-sm">{group.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold ${getTextColor(group.color)}`}
                  >
                    {progress.completed}/{progress.total}
                  </div>
                  <div className="text-gray-400 text-xs">выполнено</div>
                </div>
              </div>

              {/* Прогресс бар */}
              <div className="w-full bg-gray-700/50 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(
                    group.color
                  )}`}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              {/* Достижения группы */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {group.achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`
                        flex items-center gap-3 p-2 rounded-lg border transition-all
                        ${
                          getIsCompleted(achievement.id)
                            ? "bg-gray-700/30  border-green-500/30 "
                            : "bg-gray-800/20 border-gray-600/30 opacity-60"
                        }
                      `}
                  >
                    <div className="text-xl">{achievement.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          getIsCompleted(achievement.id)
                            ? "text-white"
                            : "text-gray-400"
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
                        w-5 h-5 rounded border-2 flex items-center justify-center
                        ${
                          getIsCompleted(achievement.id)
                            ? "bg-green-500 border-green-500"
                            : "bg-gray-700 border-gray-500"
                        }
                      `}
                    >
                      {getIsCompleted(achievement.id) && (
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
                      )}
                    </div>
                  </div>
                ))}
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
                      : "bg-gray-800/30 border-gray-600/30"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {isGroupCompleted ? (
                      group.groupReward.icon
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center border border-gray-500">
                        <span className="text-gray-300 text-lg">?</span>
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
                          : "text-gray-400"
                      }`}
                    >
                      {isGroupCompleted ? "" : "Секретная награда"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isGroupCompleted
                        ? ""
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

      {/* Информация о системе достижений */}
      <div className="mt-6 p-4 bg-gray-800/30 rounded-xl border border-gray-600/30">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-blue-400">💡</div>
          <h4 className="text-white font-semibold">О системе достижений</h4>
        </div>
        <p className="text-gray-400 text-sm">
          Выполняйте достижения, чтобы отслеживать свой прогресс в игре.
          Завершите все достижения в группе, чтобы получить специальную награду!
        </p>
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
