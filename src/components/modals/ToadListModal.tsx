import React, { useState, useRef, useEffect } from "react";
import { RARITY_CONFIG, RARITY_GROUPS_TRESHOLD, Toad } from "../../models/toad";
import { TYPE_ICONS } from "../../utils/constants";
import Modal from "../shared/Modal";
import { PregnancyIcon } from "../../assets/icons";
import { updateToadById } from "../../backend";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { ToadGender } from "../shared/ToadGender";
import { useToads } from "../ToadContext";
import { completeAchivement } from "../../backend/achivements-manager";

interface ToadListModalProps {
  isOpen: boolean;
  onClose: () => void;
  toads: Toad[];
  onToadSelect: (toadId: number) => void;
}

const ToadListModal: React.FC<ToadListModalProps> = ({
  isOpen,
  onClose,
  toads,
  onToadSelect,
}) => {
  const { playClick, playCrunchShort } = useSoundEffects();
  const [activeActionMenu, setActiveActionMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { handleFeedToads, account } = useToads();

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveActionMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToadClick = (toad: Toad) => {
    onToadSelect(toad.id);
    onClose();
  };

  // Функция для перемещения жабы на склад
  const toStorage = async (toadId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    playClick();
    setActiveActionMenu(null);

    updateToadById(toadId, { scene_id: null });
  };

  // Функция для кормления жабы
  const feedToad = async (toadId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    playCrunchShort();
    setActiveActionMenu(null);

    handleFeedToads([toadId]);
    completeAchivement("feed-one");
  };

  if (!isOpen) return null;

  // Группируем жаб по всем типам редкости
  const groupedToads = {
    common: toads.filter(
      (toad) => toad.genes.rarity < RARITY_GROUPS_TRESHOLD.uncommon
    ),
    uncommon: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.uncommon &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.rare
    ),
    rare: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.rare &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.epic
    ),
    epic: toads.filter(
      (toad) =>
        toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.epic &&
        toad.genes.rarity < RARITY_GROUPS_TRESHOLD.legendary
    ),
    legendary: toads.filter(
      (toad) => toad.genes.rarity >= RARITY_GROUPS_TRESHOLD.legendary
    ),
  };

  const icon = (
    <svg
      className="w-6 h-6 text-green-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );

  // Иконка голода
  const HungerIcon = ({ level }: { level: number }) => {
    const getHungerColor = (level: number) => {
      if (level >= 80) return "text-green-400";
      if (level >= 50) return "text-yellow-400";
      if (level >= 20) return "text-orange-400";
      return "text-red-400";
    };

    const getHungerIcon = (level: number) => {
      if (level >= 80) return "🤤";
      if (level >= 50) return "😐";
      if (level >= 20) return "😟";
      return "😵";
    };

    return (
      <div className={`flex items-center gap-1 ${getHungerColor(level)}`}>
        <span className="text-xs">{getHungerIcon(level)}</span>
        <span className="text-[10px] font-medium">{level}%</span>
      </div>
    );
  };

  // Иконка головастика
  const tadpoleIcon = (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-3 h-3 text-white"
    >
      <path
        d="M32 12C28 12 24 16 24 22V36C24 38 26 40 28 40C28 44 30 46 32 46C34 46 36 44 36 40C38 40 40 38 40 36V22C40 16 36 12 32 12Z"
        stroke="white"
        strokeWidth="4"
      />
      <path d="M24 30H40" stroke="white" strokeWidth="2" />
    </svg>
  );

  const ToadItem = ({
    groupedToads,
    rarity,
  }: {
    groupedToads: Toad[];
    rarity: keyof typeof RARITY_CONFIG;
  }) => (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`${RARITY_CONFIG[rarity].color} text-lg`}>
          {RARITY_CONFIG[rarity].icon}
        </span>
        <h3 className={`${RARITY_CONFIG[rarity].color} font-bold text-sm`}>
          {RARITY_CONFIG[rarity].label}
        </h3>
        <span className={`${RARITY_CONFIG[rarity].color} text-sm font-medium`}>
          {groupedToads.length}
        </span>
      </div>
      <div className="space-y-2">
        {groupedToads.map((toad) => {
          return (
            <div
              key={toad.id}
              onClick={() => handleToadClick(toad)}
              className={`bg-gradient-to-r ${RARITY_CONFIG[rarity].bgColor} rounded-xl py-3 px-2 border transition-colors cursor-pointer opacity-90 relative group mx-1`}
            >
              <button
                onClick={(e) => toStorage(toad.id, e)}
                className="rounded-xl absolute text-xs right-2 top-2 whitespace-nowrap min-w-[67px] flex gap-1 py-2 px-2 bg-gray-400 bg-opacity-30 bg-blur-sm"
              >
                <span>Cклад</span>

                <span className="text-blue-400">📦</span>
              </button>

              <button
                onClick={(e) => feedToad(toad.id, e)}
                className="rounded-xl text-xs absolute right-2 bottom-2 justify-between whitespace-nowrap min-w-[67px] flex gap-1 py-2 px-2 bg-red-400 bg-opacity-30 bg-blur-sm"
              >
                <span>Дать</span>
                <span className="text-green-400">🍎</span>
              </button>

              <div className="flex items-center gap-3 pr-20">
                <div className="relative">
                  <div
                    className={`rounded-full border-2 ${
                      RARITY_CONFIG[rarity].borderColor
                    } shadow-lg ${
                      toad.stage === "toadpole" ? "w-7 h-7" : "w-10 h-10"
                    }`}
                    style={{ backgroundColor: toad.genes.colors[0] }}
                  />
                  {toad.pregnancy?.isPregnant && (
                    <div className="absolute -top-1 -right-1 bg-pink-500 rounded-full p-1 shadow-lg">
                      <PregnancyIcon />
                    </div>
                  )}
                  {toad.stage === "toadpole" && (
                    <div className="absolute -bottom-1 -left-1 bg-blue-500 rounded-full p-1 shadow-lg">
                      {tadpoleIcon}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-sm truncate max-w-[120px]">
                      {toad.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <ToadGender gender={toad.sex} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <span className={`${RARITY_CONFIG[rarity].color}`}>
                      {toad.genes.rarity.toFixed(1)}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-300">
                      Поколение {toad.generation}
                    </span>
                    {toad.stage === "toadpole" && (
                      <span className="text-blue-400 font-medium">
                        Головастик
                      </span>
                    )}
                  </div>
                  {/* Индикатор голода */}
                  <div className="flex w-full items-center justify-between gap-3">
                    <HungerIcon level={toad.state.hunger} />
                    {/* Прогресс-бар голода */}
                    <div className="flex-1 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          toad.state.hunger >= 80
                            ? "bg-green-500"
                            : toad.state.hunger >= 50
                            ? "bg-yellow-500"
                            : toad.state.hunger >= 20
                            ? "bg-orange-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${toad.state.hunger}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Общая статистика по голоду
  const hungerStats = {
    wellFed: toads.filter((t) => t.state.hunger >= 80).length,
    normal: toads.filter((t) => t.state.hunger >= 50 && t.state.hunger < 80)
      .length,
    starving: toads.filter((t) => t.state.hunger < 50).length,
  };

  return (
    <Modal onClose={onClose} isOpen={isOpen} icon={icon} title={"Все жабы"}>
      {/* Контент с прокруткой */}
      <div className="overflow-y-auto h-[calc(80vh-160px)] px-1">
        {/* Легендарные жабы */}
        {groupedToads.legendary.length > 0 && (
          <ToadItem groupedToads={groupedToads.legendary} rarity="legendary" />
        )}
        {groupedToads.epic.length > 0 && (
          <ToadItem groupedToads={groupedToads.epic} rarity="epic" />
        )}
        {groupedToads.rare.length > 0 && (
          <ToadItem groupedToads={groupedToads.rare} rarity="rare" />
        )}
        {groupedToads.uncommon.length > 0 && (
          <ToadItem groupedToads={groupedToads.uncommon} rarity="uncommon" />
        )}
        {groupedToads.common.length > 0 && (
          <ToadItem groupedToads={groupedToads.common} rarity="common" />
        )}

        {/* Если жаб нет */}
        {toads.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-3">🐸</div>
            <p className="text-gray-400 text-sm">Пока нет жаб в коллекции</p>
          </div>
        )}
      </div>

      {/* Подвал с статистикой */}
      <div className="border-t border-gray-700/50 py-3 px-2 bg-gray-900/50 mx-1">
        <div className="grid grid-cols-5 gap-1 text-center text-xs mb-2">
          <div>
            <div className="text-green-400 font-bold">
              {groupedToads.common.length}
            </div>
            <div className="text-gray-400 text-[10px]">Обычные</div>
          </div>
          <div>
            <div className="text-blue-400 font-bold">
              {groupedToads.uncommon.length}
            </div>
            <div className="text-gray-400 text-[10px]">Необычные</div>
          </div>
          <div>
            <div className="text-purple-400 font-bold">
              {groupedToads.rare.length}
            </div>
            <div className="text-gray-400 text-[10px]">Редкие</div>
          </div>
          <div>
            <div className="text-orange-400 font-bold">
              {groupedToads.epic.length}
            </div>
            <div className="text-gray-400 text-[10px]">Эпические</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {groupedToads.legendary.length}
            </div>
            <div className="text-gray-400 text-[10px]">Легендарные</div>
          </div>
        </div>

        {/* Статистика голода */}
        <div className="flex justify-between text-center text-xs px-2">
          <div>
            <div className="text-green-400 font-bold">
              {hungerStats.wellFed}
            </div>
            <div className="text-gray-400 text-[10px]">Сытые</div>
          </div>
          <div>
            <div className="text-yellow-400 font-bold">
              {hungerStats.normal}
            </div>
            <div className="text-gray-400 text-[10px]">Норма</div>
          </div>
          <div>
            <div className="text-red-400 font-bold">{hungerStats.starving}</div>
            <div className="text-gray-400 text-[10px]">Голодные</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ToadListModal;
