import React, { useState } from "react";
import { Toad, getRarityConfig } from "../../models/toad";
import { CURRENCY_CONFIG } from "../../utils/constants";
import Modal from "../shared/Modal";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import {
  getAllLeaderboards,
  LeaderboardItemType,
  updateLeaderbord,
} from "../../backend/db";
import useSWR from "swr";
import { useToads } from "../ToadContext";
import { getGameState, updateGameState } from "../../backend/localStorage";
import { InfoIcons } from "../../assets/icons";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LeaderboardTabType = "rarest_toad" | "tokens" | "total_toads";

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { account, allToads } = useToads();
  const [activeTab, setActiveTab] = useState<LeaderboardTabType>("rarest_toad");
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(account?.username || "");
  const { playClick } = useSoundEffects();

  if (!account) {
    return null;
  }

  const { data: players, mutate } = useSWR(
    "leaderbord" + isOpen + account.username,
    getAllLeaderboards,
    {
      dedupingInterval: 30000,
      keepPreviousData: true,
      fallbackData: [
        {
          username: account.username,
          tg_id: account.tg_id,
          user_id: account.id,
          rarest_toad: allToads.sort(
            (a, b) => b.genes.rarity - a.genes.rarity
          )[0],
          biggest_toad: allToads.sort(
            (a, b) => b.genes.weight - a.genes.weight
          )[0],
          tokens: account.tokens,
          astro_quax: account.astro_quax,
          total_toads: allToads.length,
        },
      ],
    }
  );

  if (!players) {
    return null;
  }

  // Функция для сохранения нового никнейма
  const handleSaveUsername = async () => {
    const _newUsername = newUsername.trim();
    if (_newUsername && _newUsername !== account?.username) {
      try {
        updateGameState({
          user: { ...getGameState().user, username: _newUsername },
        });
        updateLeaderbord();
        setEditingUsername(false);
        // Обновляем данные лидерборда
        mutate();
      } catch (error) {
        console.error("Error updating username:", error);
      }
    } else {
      setEditingUsername(false);
    }
  };

  // Функция для отмены редактирования
  const handleCancelEdit = () => {
    setNewUsername(account?.username || "");
    setEditingUsername(false);
  };

  // Функция для получения данных в зависимости от активной вкладки
  const getSortedPlayers = (): LeaderboardItemType[] => {
    switch (activeTab) {
      case "rarest_toad":
        return [...players].sort(
          (a, b) =>
            (b.rarest_toad?.genes.rarity || 0) -
            (a.rarest_toad?.genes.rarity || 0)
        );
      case "tokens":
        return [...players].sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
      case "total_toads":
        return [...players].sort(
          (a, b) => (b.total_toads || 0) - (a.total_toads || 0)
        );
      default:
        return players;
    }
  };

  const sortedPlayers = getSortedPlayers();

  // Проверка, является ли игрок текущим пользователем
  const isCurrentUser = (player: LeaderboardItemType): boolean => {
    return account?.id === player.user_id;
  };

  // Функция для получения заголовка вкладки
  const getTabTitle = (): string => {
    switch (activeTab) {
      case "rarest_toad":
        return "Самые редкие жабы";
      case "tokens":
        return "Богатейшие игроки";
      case "total_toads":
        return "Коллекционеры жаб";
      default:
        return "Лидерборд";
    }
  };

  // Функция для получения описания вкладки
  const getTabDescription = (): string => {
    switch (activeTab) {
      case "rarest_toad":
        return "Игроки с самыми редкими жабами";
      case "tokens":
        return "Игроки с наибольшим количеством токенов";
      case "total_toads":
        return "Игроки с самой большой коллекцией жаб";
      default:
        return "";
    }
  };

  // Функция для получения иконки места
  const getRankIcon = (rank: number): string => {
    switch (rank) {
      case 0:
        return "🥇";
      case 1:
        return "🥈";
      case 2:
        return "🥉";
      default:
        return `#${rank + 1}`;
    }
  };

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
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );

  const getRank = () => {
    return 1 + sortedPlayers.findIndex((p) => p.user_id === account.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} icon={icon} title="Лидерборд">
      {/* Заголовок с редактируемым никнеймом */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-yellow-400 text-lg font-bold">
              Ваш рейтинг: {getRank()}
            </div>
          </div>

          {/* Поле редактирования никнейма */}
          <div className="flex items-center gap-2">
            {editingUsername ? (
              <div className="flex h-6 items-center gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveUsername();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="bg-gray-700 outline-none border border-blue-400 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                  placeholder="Введите никнейм"
                  autoFocus
                  maxLength={20}
                />
                <button
                  onClick={handleSaveUsername}
                  className="bg-green-600 hover:bg-green-500 text-white p-1 rounded transition-colors"
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
              </div>
            ) : (
              <div className="flex items-center gap-2 h-6">
                <span className="text-blue-300 font-semibold text-sm">
                  {account?.username || "Без имени"}
                </span>
                <button
                  onClick={() => {
                    playClick();
                    setEditingUsername(true);
                  }}
                  className="text-gray-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-blue-900/20"
                  title="Изменить никнейм"
                >
                  {InfoIcons.pencil}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Статистика текущего пользователя */}
        <div className="flex gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-purple-400">⭐</span>
            <span className="text-gray-300">
              Лучшая редкость:{" "}
              {players
                .find((p) => p.user_id === account.id)
                ?.rarest_toad.genes.rarity.toFixed(2) || "0.0"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">
              {CURRENCY_CONFIG.tokens.icon}
            </span>
            <span className="text-gray-300">
              Токены: {account?.tokens?.toLocaleString() || "0"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-400">🐸</span>
            <span className="text-gray-300">
              Жабы: {allToads.length || "0"}
            </span>
          </div>
        </div>
      </div>

      {/* Табы */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => {
            playClick();
            setActiveTab("rarest_toad");
          }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "rarest_toad"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Редкие жабы
        </button>
        <button
          onClick={() => {
            playClick();
            setActiveTab("tokens");
          }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "tokens"
              ? "text-yellow-400 border-b-2 border-yellow-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Богатство
        </button>
        <button
          onClick={() => {
            playClick();
            setActiveTab("total_toads");
          }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "total_toads"
              ? "text-green-400 border-b-2 border-green-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Коллекции
        </button>
      </div>

      {/* Контент */}
      <div className="p-4 overflow-y-auto h-[calc(80vh-196px)]">
        {/* Заголовок и описание вкладки */}
        <div className="text-center mb-6">
          <h3 className="text-white font-semibold text-lg mb-2">
            {getTabTitle()}
          </h3>
          <p className="text-gray-400 text-sm">{getTabDescription()}</p>
        </div>

        {/* Список лидеров */}
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const rarityConfig = player.rarest_toad
              ? getRarityConfig(player.rarest_toad.genes.rarity)
              : null;

            const isUser = isCurrentUser(player);

            return (
              <div
                key={player.user_id}
                className={`
                  relative rounded-xl p-4 border transition-all overflow-hidden
                  ${
                    isUser
                      ? `
                        bg-gradient-to-r from-blue-900/30 to-purple-900/30 
                        border-blue-400/50 shadow-lg shadow-blue-500/20
                        animate-pulse-glow
                      `
                      : index <= 2
                      ? "border-yellow-500/50 bg-gradient-to-r from-gray-800 to-yellow-900/10"
                      : "border-gray-700 bg-gray-800"
                  }
                `}
              >
                {/* Эффект свечения для текущего пользователя */}
                {isUser && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-400" />
                  </>
                )}

                <div className="flex items-center justify-between relative z-10">
                  {/* Место и имя игрока */}
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`
                        text-lg font-bold ${
                          isUser
                            ? "text-blue-400 animate-bounce"
                            : index === 0
                            ? "text-yellow-400"
                            : index === 1
                            ? "text-gray-300"
                            : index === 2
                            ? "text-orange-400"
                            : "text-gray-400"
                        }
                      `}
                    >
                      {getRankIcon(index)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p
                          className={`
                            font-semibold truncate
                            ${isUser ? "text-blue-300" : "text-white"}
                          `}
                        >
                          {player.username}
                        </p>
                        {isUser && (
                          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs font-medium animate-pulse">
                            👑 ВЫ
                          </span>
                        )}
                        {!isUser && index <= 2 && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                            Топ {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Информация в зависимости от вкладки */}
                      {activeTab === "rarest_toad" && player.rarest_toad && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full border-2 flex-shrink-0"
                              style={{
                                backgroundColor:
                                  player.rarest_toad.genes.colors[0],
                                borderColor: isUser
                                  ? "#60A5FA"
                                  : rarityConfig?.borderColor
                                      .replace("border-", "")
                                      .replace("/50", ""),
                                boxShadow: isUser
                                  ? "0 0 10px rgba(96, 165, 250, 0.5)"
                                  : "none",
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm font-medium ${
                                    isUser ? "text-blue-200" : "text-white"
                                  }`}
                                >
                                  {player.rarest_toad.name}
                                </span>
                                <span
                                  className={`text-xs ${rarityConfig?.color}`}
                                >
                                  {rarityConfig?.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span>
                                  Редкость:{" "}
                                  {player.rarest_toad.genes.rarity.toFixed(1)}
                                </span>
                                <span>
                                  Размер:{" "}
                                  {player.rarest_toad.genes.weight.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "tokens" && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-lg font-bold ${
                              isUser ? "text-yellow-300" : "text-yellow-400"
                            }`}
                          >
                            {player.tokens?.toLocaleString()}
                          </span>
                          <span
                            className={
                              isUser ? "text-yellow-300" : "text-yellow-400"
                            }
                          >
                            {CURRENCY_CONFIG.tokens.icon}
                          </span>
                        </div>
                      )}

                      {activeTab === "total_toads" && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-lg font-bold ${
                              isUser ? "text-green-300" : "text-green-400"
                            }`}
                          >
                            {player.total_toads}
                          </span>
                          <span
                            className={`text-sm ${
                              isUser ? "text-green-200" : "text-gray-400"
                            }`}
                          >
                            жаб
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Дополнительная информация */}
                  <div
                    className={`text-right text-xs space-y-1 ${
                      isUser ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {activeTab !== "tokens" && (
                      <div className="flex items-center justify-end gap-1">
                        <span>{player.tokens?.toLocaleString()}</span>
                        <span
                          className={
                            isUser ? "text-yellow-300" : "text-yellow-400"
                          }
                        >
                          {CURRENCY_CONFIG.tokens.icon}
                        </span>
                      </div>
                    )}
                    {activeTab !== "total_toads" && (
                      <div>{player.total_toads} жаб</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Статистика в подвале */}
      <div className="border-t border-gray-700/50 p-4 bg-gray-900/50">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="text-purple-400 font-bold">
              {sortedPlayers[0]?.rarest_toad?.genes.rarity.toFixed(1) || "0.0"}
            </div>
            <div className="text-gray-400 text-[10px]">Лучшая редкость</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {sortedPlayers[0]?.tokens?.toLocaleString() || "0"}
            </div>
            <div className="text-gray-400 text-[10px]">Макс. токены</div>
          </div>
          <div>
            <div className="text-green-400 font-bold">
              {sortedPlayers[0]?.total_toads || "0"}
            </div>
            <div className="text-gray-400 text-[10px]">Макс. жабы</div>
          </div>
        </div>
      </div>

      {/* CSS анимации */}
      <style>{`
        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.6);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </Modal>
  );
};

export default LeaderboardModal;
