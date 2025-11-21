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

  // Компонент для отображения информации о редкой жабе (оптимизированный для мобилок)
  const RarestToadInfo = ({
    player,
    isUser,
  }: {
    player: LeaderboardItemType;
    isUser: boolean;
  }) => {
    if (!player.rarest_toad) return null;

    const rarityConfig = getRarityConfig(player.rarest_toad.genes.rarity);

    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          {/* Аватар жабы */}
          <div
            className="w-8 h-8 rounded-full border-2 flex-shrink-0 mt-1"
            style={{
              backgroundColor: player.rarest_toad.genes.colors[0],
              borderColor: isUser
                ? "#60A5FA"
                : rarityConfig?.borderColor
                    .replace("border-", "")
                    .replace("/50", ""),
              boxShadow: isUser ? "0 0 8px rgba(96, 165, 250, 0.5)" : "none",
            }}
          />

          {/* Информация о жабе - компактно */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              <span
                className={`text-xs font-medium truncate max-w-[180px] ${
                  isUser ? "text-blue-200" : "text-white"
                }`}
              >
                {player.rarest_toad.name}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                  rarityConfig?.color || "text-gray-400"
                } ${rarityConfig?.borderColor || "border-gray-500"}`}
              >
                {rarityConfig?.label || "Обычная"}
              </span>
            </div>

            {/* Компактные характеристики */}
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <div className="flex items-center gap-1">
                <span className="text-purple-400">⭐</span>
                <span>{player.rarest_toad.genes.rarity.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-blue-400">⚖️</span>
                <span>{player.rarest_toad.genes.weight.toFixed(0)}</span>
              </div>
              {player.rarest_toad.stage === "toadpole" && (
                <span className="text-blue-300 text-[9px] bg-blue-500/20 px-1 rounded">
                  Головастик
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} icon={icon} title="Лидерборд">
      {/* Заголовок с редактируемым никнеймом */}
      <div className="bg-gray-800 py-3 px-2 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="text-yellow-400 text-sm font-bold">
            Рейтинг: {getRank()}
          </div>

          {/* Поле редактирования никнейма */}
          <div className="flex items-center gap-1">
            {editingUsername ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveUsername();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="bg-gray-700 outline-none border border-blue-400 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
                  placeholder="Введите ник"
                  autoFocus
                  maxLength={15}
                />
                <button
                  onClick={handleSaveUsername}
                  className="bg-green-600 hover:bg-green-500 text-white p-1 rounded transition-colors"
                  title="Сохранить"
                >
                  <svg
                    className="w-3 h-3"
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
              <div className="flex items-center gap-1">
                <span className="text-blue-300 font-semibold text-xs">
                  {account?.username || "Без имени"}
                </span>
                <button
                  onClick={() => {
                    playClick();
                    setEditingUsername(true);
                  }}
                  className="text-gray-400 hover:text-blue-400 transition-colors p-0.5 rounded hover:bg-blue-900/20"
                  title="Изменить никнейм"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Статистика текущего пользователя */}
        <div className="flex justify-between text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-purple-400">⭐</span>
            <span className="text-gray-300">
              {players
                .find((p) => p.user_id === account.id)
                ?.rarest_toad.genes.rarity.toFixed(1) || "0.0"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">
              {CURRENCY_CONFIG.tokens.icon}
            </span>
            <span className="text-gray-300">
              {account?.tokens?.toLocaleString() || "0"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-400">🐸</span>
            <span className="text-gray-300">{allToads.length || "0"}</span>
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
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            activeTab === "rarest_toad"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Редкие
        </button>
        <button
          onClick={() => {
            playClick();
            setActiveTab("tokens");
          }}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
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
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            activeTab === "total_toads"
              ? "text-green-400 border-b-2 border-green-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Коллекции
        </button>
      </div>

      {/* Контент */}
      <div className="py-3 px-1 overflow-y-auto h-[calc(80vh-180px)]">
        {/* Заголовок и описание вкладки */}
        <div className="text-center mb-4">
          <h3 className="text-white px-2 font-semibold text-sm mb-1">
            {getTabTitle()}
          </h3>
          <p className="text-gray-400 text-xs">{getTabDescription()}</p>
        </div>

        {/* Список лидеров */}
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => {
            const isUser = isCurrentUser(player);

            return (
              <div
                key={player.user_id}
                className={`
                  relative rounded-lg py-2 px-2 border transition-all overflow-hidden
                  ${
                    isUser
                      ? `
                        bg-gradient-to-r from-blue-900/30 to-purple-900/30 
                        border-blue-400/50 shadow-md shadow-blue-500/20
                      `
                      : index <= 2
                      ? "border-yellow-500/30 bg-gradient-to-r from-gray-800 to-yellow-900/10"
                      : "border-gray-600 bg-gray-800"
                  }
                `}
              >
                {/* Эффект свечения для текущего пользователя */}
                {isUser && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10" />
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 to-purple-400" />
                  </>
                )}

                <div className="flex items-center justify-between relative z-10">
                  {/* Место и имя игрока */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`
                        text-sm font-bold flex-shrink-0
                        ${
                          isUser
                            ? "text-blue-400"
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
                      <div className="flex items-center gap-1 mb-1">
                        <p
                          className={`
                            font-semibold text-xs truncate max-w-[180px]
                            ${isUser ? "text-blue-300" : "text-white"}
                          `}
                        >
                          {player.username}
                        </p>
                        {isUser && (
                          <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                            ВЫ
                          </span>
                        )}
                      </div>

                      {/* Информация в зависимости от вкладки */}
                      {activeTab === "rarest_toad" && (
                        <RarestToadInfo player={player} isUser={isUser} />
                      )}

                      {activeTab === "tokens" && (
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-sm font-bold ${
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
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-sm font-bold ${
                              isUser ? "text-green-300" : "text-green-400"
                            }`}
                          >
                            {player.total_toads}
                          </span>
                          <span
                            className={`text-xs ${
                              isUser ? "text-green-200" : "text-gray-400"
                            }`}
                          >
                            жаб
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Дополнительная информация - только для неактивных вкладок */}
                  <div
                    className={`text-right text-[10px] space-y-0.5 flex-shrink-0 ${
                      isUser ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {activeTab !== "tokens" && player.tokens && (
                      <div className="flex items-center justify-end gap-0.5">
                        <span>
                          {player.tokens > 1000
                            ? `${(player.tokens / 1000).toFixed(1)}k`
                            : player.tokens.toLocaleString()}
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
    </Modal>
  );
};

export default LeaderboardModal;
