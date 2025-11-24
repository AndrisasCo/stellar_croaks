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
import { ToadItem } from "./ShopTabs/ToadItem";
import { FilterByType, Filters, SortByType } from "../shared/Filters";
import { useFilters } from "../../hooks/use-filters";

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
  const { handleFeedToads } = useToads();
  const {
    filteredAndSortedToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  } = useFilters(toads);

  const handleToadClick = (toad: Toad) => {
    onToadSelect(toad.id);
    onClose();
  };

  // Функция для перемещения жабы на склад
  const toStorage = async (toadId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    playClick();

    updateToadById(toadId, { scene_id: null });
  };

  // Функция для кормления жабы
  const feedToad = async (toadId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    playCrunchShort();

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

  // Общая статистика по голоду
  const hungerStats = {
    wellFed: toads.filter((t) => t.state.hunger >= 80).length,
    normal: toads.filter((t) => t.state.hunger >= 50 && t.state.hunger < 80)
      .length,
    starving: toads.filter((t) => t.state.hunger < 50).length,
  };

  return (
    <Modal onClose={onClose} isOpen={isOpen} icon={icon} title={"Все жабы"}>
      <Filters
        toads={toads}
        setSortDirection={setSortDirection}
        setSortBy={setSortBy}
        filterBy={filterBy}
        setFilterBy={setFilterBy}
        sortBy={sortBy}
        sortDirection={sortDirection}
        addHunger
      />

      {/* Контент с прокруткой */}
      <div className="overflow-y-auto h-[calc(80vh-280px)] px-1">
        {filteredAndSortedToads.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-3">🐸</div>
            <p className="text-gray-400 text-sm">
              {toads.length === 0
                ? "Пока нет жаб в коллекции"
                : "Жабы не найдены"}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {toads.length === 0
                ? "Приобретите жаб на рынке"
                : "Измените фильтры для отображения"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedToads.map((toad) => {
              const rarity =
                (Object.entries(RARITY_GROUPS_TRESHOLD).find(
                  ([_, threshold]) => toad.genes.rarity >= threshold
                )?.[0] as keyof typeof RARITY_CONFIG) || "common";

              return (
                <ToadItem
                  showHunger
                  key={toad.id}
                  isSelected={false}
                  onClick={() => handleToadClick(toad)}
                  toad={toad}
                  button={
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => toStorage(toad.id, e)}
                        className="px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-medium transition-all border border-blue-500/30 hover:bg-blue-500/30"
                      >
                        📦
                      </button>
                      <button
                        onClick={(e) => feedToad(toad.id, e)}
                        className="px-3 py-2 bg-green-500/20 text-green-300 rounded-lg text-xs font-medium transition-all border border-green-500/30 hover:bg-green-500/30"
                      >
                        🍎
                      </button>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Подвал с статистикой */}
      <div className="border-t border-gray-700/50 py-3 px-2 bg-gray-900/50 mx-1 mt-3">
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
