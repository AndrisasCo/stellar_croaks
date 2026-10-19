import React, { useState } from "react";
import { getRarityConfig, Toad } from "../../models/Toad";
import { CURRENCY_CONFIG } from "../../utils/constants";
import Modal from "../shared/Header";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import {
  getAllLeaderboards,
  LeaderboardItemType,
  ToadCollection,
  updateLeaderbord,
} from "../../backend/db";
import useSWR from "swr";
import { useToads } from "../ToadContext";
import { getGameState, updateGameState } from "../../backend/localStorage";
import { ToadAvatar } from "../shared/ToadAvatar";
import { ToadTypes } from "../../models/Toad/toad-species";
import { HorizontalScroll } from "../shared/HorizontalScroll";
import { CurrencyIcon, CurrencyText } from "../shared/CurrencyIcon";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LeaderboardTabType =
  | "rarity" // Самая редкая жаба
  | "weight_max" // Самая большая жаба (макс вес)
  | "weight_min" // Самая маленькая жаба (мин вес)
  | "fertility_max" // Самая плодовитая жаба (макс фертильность)
  | "fertility_min" // Самая стерильная жаба (мин фертильность)
  | "speed_max" // Самая быстрая жаба (макс скорость)
  | "speed_min" // Самая медленная жаба (мин скорость)
  | "hunger_max" // Самая прожорливая жаба (макс голод)
  | "hunger_min" // Самая неголодная жаба (мин голод)
  | "tokens" // Богатство (кваксы)
  | "species"; // Разнообразие видов

const LeaderboardModal: React.FC = () => {
  const { account, allToads } = useToads();
  const [activeTab, setActiveTab] = useState<LeaderboardTabType>("rarity");
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(account?.username || "");
  const { playClick } = useSoundEffects();

  if (!account) {
    return null;
  }

  const { data: players, mutate } = useSWR(
    "leaderbord" + account.username,
    () => getAllLeaderboards(),
    {
      dedupingInterval: 30000,
      keepPreviousData: true,
      fallbackData: account.id
        ? [
            {
              username: account.username,
              tg_id: account.tg_id,
              user_id: account.id,
              tokens: account.tokens,
              total_toads: allToads.length,
              total_species: new Set(allToads.map((t) => t.type)).size,
              toads_collection: {
                rarest_toad: allToads.sort(
                  (a, b) => b.genes.rarity - a.genes.rarity,
                )[0],
                weight_max_toad: allToads.sort(
                  (a, b) => b.genes.weight - a.genes.weight,
                )[0],
                weight_min_toad: allToads.sort(
                  (a, b) => a.genes.weight - b.genes.weight,
                )[0],
                fertility_max_toad: allToads.sort(
                  (a, b) => b.genes.fertility - a.genes.fertility,
                )[0],
                fertility_min_toad: allToads.sort(
                  (a, b) => a.genes.fertility - b.genes.fertility,
                )[0],
                speed_max_toad: allToads.sort(
                  (a, b) => b.genes.speed - a.genes.speed,
                )[0],
                speed_min_toad: allToads.sort(
                  (a, b) => a.genes.speed - b.genes.speed,
                )[0],
                hunger_max_toad: allToads.sort(
                  (a, b) => b.genes.hungerRate - a.genes.hungerRate,
                )[0],
                hunger_min_toad: allToads.sort(
                  (a, b) => a.genes.hungerRate - b.genes.hungerRate,
                )[0],
              },
            },
          ]
        : [],
    },
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
        mutate();
      } catch (error) {
        console.error("Error updating username:", error);
      }
    } else {
      setEditingUsername(false);
    }
  };

  const handleCancelEdit = () => {
    setNewUsername(account?.username || "");
    setEditingUsername(false);
  };

  // Функция для получения данных в зависимости от активной вкладки
  const getSortedPlayers = (): LeaderboardItemType[] => {
    const playersWithData = players.filter((player) => {
      switch (activeTab) {
        case "rarity":
          return player.toads_collection.rarest_toad;
        case "weight_max":
          return player.toads_collection.weight_max_toad;
        case "weight_min":
          return player.toads_collection.weight_min_toad;
        case "fertility_max":
          return player.toads_collection.fertility_max_toad;
        case "fertility_min":
          return player.toads_collection.fertility_min_toad;
        case "speed_max":
          return player.toads_collection.speed_max_toad;
        case "speed_min":
          return player.toads_collection.speed_min_toad;
        case "hunger_max":
          return player.toads_collection.hunger_max_toad;
        case "hunger_min":
          return player.toads_collection.hunger_min_toad;
        case "tokens":
          return player.tokens > 0;
        case "species":
          return player.total_species > 0;
        default:
          return true;
      }
    });

    return [...playersWithData].sort((a, b) => {
      switch (activeTab) {
        case "rarity":
          return (
            (b.toads_collection.rarest_toad?.genes.rarity || 0) -
            (a.toads_collection.rarest_toad?.genes.rarity || 0)
          );
        case "weight_max":
          return (
            (b.toads_collection.weight_max_toad?.genes.weight || 0) -
            (a.toads_collection.weight_max_toad?.genes.weight || 0)
          );
        case "weight_min":
          return (
            (a.toads_collection.weight_min_toad?.genes.weight || Infinity) -
            (b.toads_collection.weight_min_toad?.genes.weight || Infinity)
          );
        case "fertility_max":
          return (
            (b.toads_collection.fertility_max_toad?.genes.fertility || 0) -
            (a.toads_collection.fertility_max_toad?.genes.fertility || 0)
          );
        case "fertility_min":
          return (
            (a.toads_collection.fertility_min_toad?.genes.fertility ||
              Infinity) -
            (b.toads_collection.fertility_min_toad?.genes.fertility || Infinity)
          );
        case "speed_max":
          return (
            (b.toads_collection.speed_max_toad?.genes.speed || 0) -
            (a.toads_collection.speed_max_toad?.genes.speed || 0)
          );
        case "speed_min":
          return (
            (a.toads_collection.speed_min_toad?.genes.speed || Infinity) -
            (b.toads_collection.speed_min_toad?.genes.speed || Infinity)
          );
        case "hunger_max":
          return (
            (b.toads_collection.hunger_max_toad?.genes.hungerRate || 0) -
            (a.toads_collection.hunger_max_toad?.genes.hungerRate || 0)
          );
        case "hunger_min":
          return (
            (a.toads_collection.hunger_min_toad?.genes.hungerRate || Infinity) -
            (b.toads_collection.hunger_min_toad?.genes.hungerRate || Infinity)
          );
        case "tokens":
          return (b.tokens || 0) - (a.tokens || 0);
        case "species":
          return (b.total_species || 0) - (a.total_species || 0);
        default:
          return 0;
      }
    });
  };

  const sortedPlayers = getSortedPlayers();

  const isCurrentUser = (player: LeaderboardItemType): boolean => {
    // Сравниваем по ключу аккаунта, а не по tg_id: в вебе его нет вовсе, и «моя»
    // строка раньше не подсвечивалась.
    return Boolean(account?.id) && account?.id === player.user_id;
  };

  // Функция для получения заголовка вкладки
  const getTabTitle = (): string => {
    switch (activeTab) {
      case "rarity":
        return "Самые редкие жабы";
      case "weight_max":
        return "Самые большие жабы";
      case "weight_min":
        return "Самые маленькие жабы";
      case "fertility_max":
        return "Самые плодовитые жабы";
      case "fertility_min":
        return "Самые стерильные жабы";
      case "speed_max":
        return "Самые быстрые жабы";
      case "speed_min":
        return "Самые медленные жабы";
      case "hunger_max":
        return "Самые прожорливые жабы";
      case "hunger_min":
        return "Самые неголодные жабы";
      case "tokens":
        return "Богатейшие игроки";
      case "species":
        return "Разнообразие видов";
      default:
        return "Лидерборд";
    }
  };

  // Функция для получения описания вкладки
  const getTabDescription = (): string => {
    switch (activeTab) {
      case "rarity":
        return "Игроки с самыми редкими жабами";
      case "weight_max":
        return "Игроки с самыми большими жабами";
      case "weight_min":
        return "Игроки с самыми маленькими жабами";
      case "fertility_max":
        return "Игроки с самыми плодовитыми жабами";
      case "fertility_min":
        return "Игроки с самыми скромными жабами";
      case "speed_max":
        return "Игроки с самыми быстрыми жабами";
      case "speed_min":
        return "Игроки с самыми медленными жабами";
      case "hunger_max":
        return "Игроки с самыми прожорливыми жабами";
      case "hunger_min":
        return "Игроки с самыми экономными жабами";
      case "tokens":
        return `Игроки с наибольшим количеством ${CURRENCY_CONFIG.tokens.icon}`;
      case "species":
        return "Игроки с наибольшим разнообразием видов жаб";
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

  const getTabIcon = (tab: LeaderboardTabType): string => {
    switch (tab) {
      case "rarity":
        return "⭐️";
      case "weight_max":
        return "🐘";
      case "weight_min":
        return "🐭";
      case "fertility_max":
        return "🐣";
      case "fertility_min":
        return "🚫";
      case "speed_max":
        return "⚡";
      case "speed_min":
        return "🐌";
      case "hunger_max":
        return "🍽️";
      case "hunger_min":
        return "🫠";
      case "tokens":
        return "💰";
      case "species":
        return "🌈";
      default:
        return "🏆";
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

  // Компонент для отображения информации о жабе по параметру
  const ParameterInfo = ({
    player,
    isUser,
    parameter,
  }: {
    player: ToadCollection;
    isUser: boolean;
    parameter: LeaderboardTabType;
  }) => {
    let toad: Toad | undefined;
    let value: number = 0;
    let label: string = "";
    let color: string = isUser ? "text-blue-300" : "text-white";

    switch (parameter) {
      case "rarity":
        toad = player.rarest_toad;
        value = toad?.genes.rarity || 0;
        label = "качество";
        color = isUser ? "text-purple-300" : "text-purple-400";
        break;
      case "weight_max":
        toad = player.weight_max_toad;
        value = toad?.genes.weight || 0;
        label = "Размер";
        color = isUser ? "text-yellow-300" : "text-yellow-400";
        break;
      case "weight_min":
        toad = player.weight_min_toad;
        value = toad?.genes.weight || 0;
        label = "Размер";
        color = isUser ? "text-gray-200" : "text-gray-300";
        break;
      case "fertility_max":
        toad = player.fertility_max_toad;
        value = toad?.genes.fertility || 0;
        label = "Фертильность";
        color = isUser ? "text-pink-300" : "text-pink-400";
        break;
      case "fertility_min":
        toad = player.fertility_min_toad;
        value = toad?.genes.fertility || 0;
        label = "Фертильность";
        color = isUser ? "text-gray-200" : "text-gray-300";
        break;
      case "speed_max":
        toad = player.speed_max_toad;
        value = toad?.genes.speed || 0;
        label = "Скорость";
        color = isUser ? "text-blue-300" : "text-blue-400";
        break;
      case "speed_min":
        toad = player.speed_min_toad;
        value = toad?.genes.speed || 0;
        label = "Скорость";
        color = isUser ? "text-gray-200" : "text-gray-300";
        break;
      case "hunger_max":
        toad = player.hunger_max_toad;
        value = toad?.genes.hungerRate || 0;
        label = "Аппетит";
        color = isUser ? "text-red-300" : "text-red-400";
        break;
      case "hunger_min":
        toad = player.hunger_min_toad;
        value = toad?.genes.hungerRate || 0;
        label = "Аппетит";
        color = isUser ? "text-green-300" : "text-green-400";
        break;
    }

    if (!toad) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              <span
                className={`text-sm font-medium truncate max-w-[150px] ${color}`}
              >
                {toad.name}
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <span className={`font-bold ${color}`}>{value.toFixed(1)}</span>
              </div>

              <span className="text-gray-300 text-sm">{label}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TabButton = ({
    tab,
    label,
  }: {
    tab: LeaderboardTabType;
    label: string;
  }) => {
    const isActive = activeTab === tab;
    const tabIcon = getTabIcon(tab);

    return (
      <button
        onClick={() => {
          playClick();
          setActiveTab(tab);
        }}
        className={`flex flex-col items-center py-2 text-xs font-medium transition-all ${
          isActive
            ? "text-white border-t-2 border-white"
            : "text-gray-300 hover:text-gray-200"
        }`}
        style={{ minWidth: "70px" }}
      >
        <span className="text-base mb-1">{tabIcon}</span>
        <span className="text-xs">{label}</span>
      </button>
    );
  };

  return (
    <Modal icon={icon} title="Лидерборд">
      {/* Заголовок с редактируемым никнеймом */}
      <div className=" py-3 px-2 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="text-yellow-400 text-sm font-bold">
            Рейтинг: {getRank()}
          </div>

          <div className="flex items-center gap-1">
            {editingUsername ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveUsername();

                    if (e.key === "Escape") {
                      // Esc в правке ника отменяет её, а не закрывает окно (см. ModalProvider).
                      e.preventDefault();
                      handleCancelEdit();
                    }
                  }}
                  className="bg-color-second outline-none border border-blue-400 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
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
                <span className="text-blue-300 font-semibold text-sm">
                  {account?.username || "Без имени"}
                </span>
                <button
                  onClick={() => {
                    playClick();
                    setEditingUsername(true);
                  }}
                  className="text-gray-300 hover:text-blue-400 transition-colors p-0.5 rounded hover:bg-blue-900/20"
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
      </div>

      {/* Горизонтальные табы с прокруткой */}
      <div className="border-b border-gray-700  ">
        <HorizontalScroll className="gap-2">
          <TabButton tab="tokens" label="Богатство" />
          <TabButton tab="species" label="Виды" />
          <TabButton tab="rarity" label="Редкие" />
          <TabButton tab="weight_max" label="Большие" />
          <TabButton tab="weight_min" label="Маленькие" />
          <TabButton tab="fertility_max" label="Плодовитые" />
          <TabButton tab="fertility_min" label="Стерильные" />
          <TabButton tab="speed_max" label="Быстрые" />
          <TabButton tab="speed_min" label="Медленные" />
          <TabButton tab="hunger_max" label="Прожорливые" />
          <TabButton tab="hunger_min" label="Экономные" />
        </HorizontalScroll>
      </div>

      {/* Контент */}
      <div className="px-1">
        <div className="text-center my-3">
          <h3 className="text-white px-2 font-semibold text-sm mb-1">
            {getTabTitle()}
          </h3>
          <p className="text-gray-300 text-xs">
            <CurrencyText text={getTabDescription()} />
          </p>
        </div>

        {/* Список лидеров */}
        <div className="space-y-2 ">
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
                        : "border-gray-600 bg-color-main"
                  }
                `}
              >
                {isUser && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10" />
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 to-purple-400" />
                  </>
                )}

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`
                        text-md font-bold flex-shrink-0
                        ${
                          isUser
                            ? "text-blue-400"
                            : index === 0
                              ? "text-yellow-400"
                              : index === 1
                                ? "text-gray-200"
                                : index === 2
                                  ? "text-orange-400"
                                  : "text-gray-300"
                        }
                      `}
                    >
                      {getRankIcon(index)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <p
                          className={`
                            font-semibold text-sm truncate max-w-[150px]
                            ${isUser ? "text-blue-300" : "text-white"}
                          `}
                        >
                          {player.username}
                        </p>
                        {isUser && (
                          <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full text-xs font-medium">
                            ВЫ
                          </span>
                        )}
                      </div>

                      {/* Информация в зависимости от вкладки */}
                      {[
                        "rarity",
                        "weight_max",
                        "weight_min",
                        "fertility_max",
                        "fertility_min",
                        "speed_max",
                        "speed_min",
                        "hunger_max",
                        "hunger_min",
                      ].includes(activeTab) && (
                        <ParameterInfo
                          player={player.toads_collection}
                          isUser={isUser}
                          parameter={activeTab}
                        />
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
                          <CurrencyIcon
                            currency="tokens"
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-gray-300 text-sm ml-2">
                            {player.total_toads} жаб
                          </span>
                        </div>
                      )}

                      {activeTab === "species" && (
                        <div className="flex items-center gap-1">
                          Открыто
                          <span
                            className={`text-sm font-bold ${
                              isUser ? "text-green-300" : "text-green-400"
                            }`}
                          >
                            {player.total_species}
                          </span>
                          <span
                            className={`text-sm ${
                              isUser ? "text-green-200" : "text-gray-300"
                            }`}
                          >
                            / {Object.values(ToadTypes).length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`text-right text-sm space-y-0.5 flex-shrink-0 ${
                      isUser ? "text-blue-200" : "text-gray-300"
                    }`}
                  >
                    {activeTab !== "tokens" && activeTab !== "species" && (
                      <ToadAvatar
                        toad={
                          activeTab === "rarity"
                            ? player.toads_collection.rarest_toad
                            : activeTab === "weight_max"
                              ? player.toads_collection.weight_max_toad
                              : activeTab === "weight_min"
                                ? player.toads_collection.weight_min_toad
                                : activeTab === "fertility_max"
                                  ? player.toads_collection.fertility_max_toad
                                  : activeTab === "fertility_min"
                                    ? player.toads_collection.fertility_min_toad
                                    : activeTab === "speed_max"
                                      ? player.toads_collection.speed_max_toad
                                      : activeTab === "speed_min"
                                        ? player.toads_collection.speed_min_toad
                                        : activeTab === "hunger_max"
                                          ? player.toads_collection
                                              .hunger_max_toad
                                          : player.toads_collection
                                              .hunger_min_toad
                        }
                        size={20}
                      />
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
