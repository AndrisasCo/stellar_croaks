import React from "react";
import Modal from "../shared/Header";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import {
  claimReward,
  getAchievementState,
} from "../../backend/achivements-manager";
import {
  achievementGroups,
  type Achievement,
} from "../../backend/achivements-manager/achivements-list";
import { createToad, updateUser } from "../../backend";
import { useNotifications } from "../../hooks/use-notification";
import { getGameState } from "../../backend/localStorage";
import { CurrencyIcon } from "../shared/CurrencyIcon";
import { pickSceneForNewToad } from "../../utils/housing";

const AchievementModal: React.FC = () => {
  const { playClick } = useSoundEffects();
  const { addNotification } = useNotifications();

  const achivements = getAchievementState();
  const gameState = getGameState();

  const icon = (
    <svg
      className="w-6 h-6 text-cyan-300"
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
  const getAchievementProgress = (achievement: Achievement) => {
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

  const getColorClasses = (_color: string) =>
    "from-slate-900/40 to-slate-900/20 border-white/10";

  const getTextColor = (_color: string) => "text-cyan-300";

  const getProgressColor = (_color: string) => "brand-bar";

  const calculateGroupProgress = (_achievements: Achievement[]) => {
    const completed = _achievements.filter((a) =>
      achivements.completed.includes(a.id),
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
      const content = reward.content;

      if (reward.type === "toad" && typeof content === "object" && content) {
        // Склада жаб больше нет: награда ищет место в биоподах, иначе остаётся невыданной
        const scene = pickSceneForNewToad();

        if (!scene) {
          addNotification({
            type: "danger",
            content: "В био-подах нет мест или недостаточно питания.",
          });
          return;
        }

        createToad({
          ...content,
          scene_id: scene.id,
          created_at: new Date().toISOString(),
        });

        addNotification({
          type: "success",
          content: `Новая жаба поселилась в «${scene.name}»: ${content.name}`,
        });
      }

      if (reward.type === "lootbox" && typeof reward.content === "number") {
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
    <Modal icon={icon} title="Достижения">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="ui-panel p-3 text-center">
          <div className="text-emerald-300 text-lg font-bold">
            {
              achievementGroups
                .flatMap((g) => g.achievements)
                .filter((a) => achivements.completed.includes(a.id)).length
            }
          </div>
          <div className="ui-hint">Выполнено</div>
        </div>
        <div className="ui-panel p-3 text-center">
          <div className="text-cyan-300 text-lg font-bold">
            {achievementGroups.flatMap((g) => g.achievements).length}
          </div>
          <div className="ui-hint">Всего</div>
        </div>
        <div className="ui-panel p-3 text-center">
          <div className="text-amber-300 text-lg font-bold">
            {achivements.rewards.length}
          </div>
          <div className="ui-hint">Наград</div>
        </div>
      </div>

      {/* Счетчики прогресса */}
      {Object.keys(achivements.counter || {}).length > 0 && (
        <div className="mb-6 p-3 bg-color-main rounded-xl border border-slate-600/30">
          <h4 className="text-white font-semibold mb-3 text-sm">
            Прогресс по категориям:
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(achivements.counter || {}).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-2 bg-color-second/30 rounded"
              >
                <span className="text-slate-200 text-xs capitalize">
                  {key === "earn" ? (
                    <>
                      Заработано{" "}
                      <CurrencyIcon
                        currency="tokens"
                        className="h-3.5 w-3.5"
                      />
                    </>
                  ) : key === "buyToad" ? (
                    "Куплено жаб"
                  ) : key === "sellToad" ? (
                    "Продано жаб"
                  ) : (
                    key
                  )}
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
            group.id,
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
                        group.color,
                      )}`}
                    >
                      {group.title}
                    </h3>
                    <p className="text-slate-300 text-sm">{group.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold ${getTextColor(group.color)}`}
                  >
                    {progress.completed}/{progress.total}
                  </div>
                  <div className="text-slate-300 text-xs">выполнено</div>
                </div>
              </div>

              {/* Прогресс бар группы */}
              <div className="w-full bg-slate-900/70 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(
                    group.color,
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
                              ? "bg-emerald-950/20 border-emerald-400/25"
                              : "bg-slate-950/40 border-white/10"
                          }
                        `}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xl">{achievement.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium ${
                              isCompleted ? "text-white" : "text-slate-300"
                            }`}
                          >
                            {achievement.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {achievement.description}
                          </div>
                        </div>
                        <div
                          className={`
                            w-6 h-6 rounded-full border-2 flex items-center justify-center
                            ${
                              isCompleted
                                ? "bg-green-500 border-green-500"
                                : "bg-color-second border-slate-500"
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
                            <span className="text-xs text-slate-200">
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
                                isCompleted ? "text-green-300" : "text-slate-300"
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
                        <div className="text-xs text-slate-500 text-center italic">
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
                      : "bg-color-main border-slate-600/30"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {isGroupCompleted ? (
                      group.groupReward?.icon
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center border border-slate-500">
                        <span className="text-slate-200 text-lg">?</span>
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
                          : "text-slate-300"
                      }`}
                    >
                      {isGroupCompleted
                        ? group.groupReward?.name
                        : "Секретная награда"}
                    </div>
                    <div className="text-sm text-slate-500">
                      {isGroupCompleted
                        ? group.groupReward?.description
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
                      className="ui-button-primary px-4 py-2"
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
      <div className="mt-6 p-4 bg-color-main rounded-xl border border-slate-600/30">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-cyan-300">📈</div>
          <h4 className="text-white font-semibold">О прогрессе достижений</h4>
        </div>
        <p className="text-slate-300 text-sm mb-2">
          Некоторые достижения требуют выполнения нескольких действий. Прогресс
          сохраняется автоматически.
        </p>
        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Завершённое достижение</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span>Достижение с прогрессом</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-500"></div>
            <span>Ещё не начато</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AchievementModal;
