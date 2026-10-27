import React, { useState } from "react";
import { Toad } from "../../models/Toad";
import { CURRENCY_CONFIG } from "../../utils/constants";
import Modal from "../shared/Header";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import {
  getLeaderboardPage,
  getLeaderboardRank,
  LEADERBOARD_PAGE_SIZE,
  LeaderboardItemType,
  LeaderboardTabType,
  ToadCollection,
} from "../../backend/db";
import useSWR from "swr";
import { useToads } from "../ToadContext";
import { ToadAvatar } from "../shared/ToadAvatar";
import { ToadTypes } from "../../models/Toad/toad-species";
import { HorizontalScroll } from "../shared/HorizontalScroll";
import { CurrencyIcon, CurrencyText } from "../shared/CurrencyIcon";

const LeaderboardModal: React.FC = () => {
  const { account } = useToads();
  const [activeTab, setActiveTab] = useState<LeaderboardTabType>("rarity");
  const [page, setPage] = useState(0);
  const { playClick } = useSoundEffects();

  // Витрина листается по 10 строк: сортировку и лимит делает сервер, поэтому
  // ключ кэша — вкладка + страница (при смене вкладки страница сбрасывается).
  const { data: pageData } = useSWR(
    ["leaderboard", activeTab, page],
    () => getLeaderboardPage(activeTab, page),
    {
      dedupingInterval: 30000,
    },
  );

  // Своё место считаем отдельно: игрок может быть и за пределами первой десятки.
  const { data: myRank } = useSWR(
    ["leaderboard-rank", activeTab],
    () => getLeaderboardRank(activeTab),
    {
      dedupingInterval: 30000,
      keepPreviousData: true,
    },
  );

  if (!account) {
    return null;
  }

  // Строки уже отсортированы и ограничены сервером — сортировать нечего.
  const players = pageData?.rows ?? [];
  // Номера мест считаем от страницы, которую реально вернул сервер: если
  // запрошенная страница «схлопнулась», он отдаст начало списка.
  const displayPage = pageData?.page ?? 0;

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
      className="w-6 h-6 text-cyan-300"
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
        label = "Качество";
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
        color = isUser ? "text-slate-200" : "text-slate-300";
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
        color = isUser ? "text-slate-200" : "text-slate-300";
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
        color = isUser ? "text-slate-200" : "text-slate-300";
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

              <span className="text-slate-300 text-sm">{label}</span>
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
          // Новая вкладка — снова с первой страницы: у неё свой порядок и объём.
          setPage(0);
        }}
        className={`flex flex-col items-center py-2 text-xs font-medium transition-all ${
          isActive
            ? "text-cyan-300 border-t-2 border-cyan-400"
            : "text-slate-300 hover:text-slate-100"
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
      {/* Заголовок: своё место и имя (ник меняется в настройках) */}
      <div className="py-3 px-2 border-b border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <div className="text-cyan-300 text-sm font-bold shrink-0">
            Рейтинг: {myRank ?? "—"}
          </div>

          <div className="text-right min-w-0">
            <div className="text-cyan-300 font-semibold text-sm truncate">
              {account.username || "Без имени"}
            </div>
            <div className="text-slate-400 text-xs leading-tight">
              имя меняется в настройках
            </div>
          </div>
        </div>
      </div>

      {/* Горизонтальные табы с прокруткой */}
      <div className="border-b border-slate-700  ">
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
          <p className="text-slate-300 text-xs">
            <CurrencyText text={getTabDescription()} />
          </p>
        </div>

        {/* Список лидеров */}
        <div className="space-y-2 ">
          {!pageData && (
            <div className="py-6 text-center text-slate-300 text-sm">
              Загружаем рейтинг…
            </div>
          )}

          {pageData && players.length === 0 && (
            <div className="py-6 text-center text-slate-300 text-sm">
              Здесь пока никого нет — станьте первым!
            </div>
          )}

          {players.map((player, index) => {
            const isUser = isCurrentUser(player);
            // Место в общем рейтинге: страница сдвигает нумерацию, а не сбрасывает.
            const rank = displayPage * LEADERBOARD_PAGE_SIZE + index;

            return (
              <div
                key={player.user_id}
                className={`
                  relative rounded-none py-2 px-2 border transition-all overflow-hidden
                  ${
                    isUser
                      ? `
                        bg-gradient-to-r from-cyan-950/40 to-emerald-950/30
                        border-cyan-300/40 shadow-md shadow-cyan-950/30
                      `
                      : rank <= 2
                        ? "border-yellow-500/30 bg-gradient-to-r from-slate-800 to-yellow-900/10"
                        : "border-slate-600 bg-color-main"
                  }
                `}
              >
                {isUser && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10" />
                    <div className="absolute left-0 top-0 h-0.5 w-full brand-bar" />
                  </>
                )}

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`
                        text-md font-bold flex-shrink-0
                        ${
                          isUser
                            ? "text-cyan-300"
                            : rank === 0
                              ? "text-yellow-400"
                              : rank === 1
                                ? "text-slate-200"
                                : rank === 2
                                  ? "text-orange-400"
                                  : "text-slate-300"
                        }
                      `}
                    >
                      {getRankIcon(rank)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <p
                          className={`
                            font-semibold text-sm truncate max-w-[150px]
                            ${isUser ? "text-cyan-200" : "text-white"}
                          `}
                        >
                          {player.username}
                        </p>
                        {isUser && (
                          <span className="bg-cyan-500/20 text-cyan-200 px-1.5 py-0.5 rounded-none text-xs font-medium">
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
                          <span className="text-slate-300 text-sm ml-2">
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
                              isUser ? "text-green-200" : "text-slate-300"
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
                      isUser ? "text-cyan-200" : "text-slate-300"
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

        {/* Пагинация: по 10 строк на страницу, чтобы витрина не тянула всю таблицу */}
        {pageData && pageData.pageCount > 1 && (
          <div className="flex items-center justify-between gap-2 py-3 px-1">
            <button
              type="button"
              onClick={() => {
                playClick();
                setPage((current) => Math.max(0, current - 1));
              }}
              disabled={displayPage === 0}
              className="ui-button-secondary px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Назад
            </button>

            <span className="text-slate-300 text-xs tabular-nums">
              {displayPage + 1} / {pageData.pageCount}
            </span>

            <button
              type="button"
              onClick={() => {
                playClick();
                setPage((current) =>
                  Math.min(pageData.pageCount - 1, current + 1),
                );
              }}
              disabled={displayPage + 1 >= pageData.pageCount}
              className="ui-button-secondary px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Вперёд →
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default LeaderboardModal;
