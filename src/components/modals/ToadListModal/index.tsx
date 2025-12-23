import React, { useState, useRef, useEffect } from "react";
import { RARITY_GROUPS_TRESHOLD, Toad } from "../../../models/Toad";
import Modal from "../../shared/Modal";
import { updateToadById, updateToadsByIds } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { useToads } from "../../ToadContext";
import { completeAchivement } from "../../../backend/achivements-manager";
import { ToadItem } from "../../shared/ToadItem";
import { Filters } from "../../shared/Filters";
import { useFilters } from "../../../hooks/use-filters";
import { Tooltip } from "../../shared/Tooltip";
import { getGameState } from "../../../backend/localStorage";
import { useNotifications } from "../../../hooks/use-notification";
import { ClickButton } from "../../shared/ClickButton";
import { ArrowLeftButtonCompact } from "../../shared/ArrowLeft";
import { ArrowRightButtonCompact } from "../../shared/ArrowRight";
import { getFamilyGroups, getRelationshipColor } from "./utils";
import { CompactToadItem } from "./CompactToadItem";

interface ToadListModalProps {
  isOpen: boolean;
  onClose: () => void;
  toads: Toad[];
  onToadSelect: (toadId: number) => void;
  setLastToadId: (toadId: number) => void;
  lastToadId: number;
}

const ToadListModal: React.FC<ToadListModalProps> = ({
  isOpen,
  onClose,
  onToadSelect,
  setLastToadId,
  lastToadId,
}) => {
  const { playCrunchShort } = useSoundEffects();
  const {
    handleFeedToads,
    ownedScenes,
    currentScene,
    currentSceneIndex,
    setCurrentSceneId,
    toads,
  } = useToads();
  const { addNotification } = useNotifications();
  const {
    filteredAndSortedToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  } = useFilters(toads);

  const [viewMode, setViewMode] = useState<"detailed" | "compact">("detailed");
  const [selectedToads, setSelectedToads] = useState<Set<number>>(new Set());
  const [showMoveTooltip, setShowMoveTooltip] = useState(false);
  const [familyGroups, setFamilyGroups] = useState<Map<number, number>>(
    new Map()
  );

  useEffect(() => {
    if (!lastToadId) {
      return;
    }
    const element = document.getElementById(lastToadId.toString());

    if (element) {
      element.scrollIntoView();
    }
  }, [lastToadId, isOpen]);

  // Вычисляем родственные группы при изменении списка жаб
  useEffect(() => {
    if (toads.length > 0) {
      const groups = getFamilyGroups(toads);
      setFamilyGroups(groups);
    }
  }, [toads]);

  const handleToadClick = (toad: Toad) => {
    onToadSelect(toad.id);
    setLastToadId(toad.id);
    onClose();
  };

  // Функция для выделения/снятия выделения жабы
  const handleSelectToad = (toadId: number) => {
    setSelectedToads((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(toadId)) {
        newSelected.delete(toadId);
      } else {
        newSelected.add(toadId);
      }
      return newSelected;
    });
  };

  // Выделить все
  const selectAll = () => {
    setSelectedToads(new Set(filteredAndSortedToads.map((toad) => toad.id)));
  };

  // Отменить выделение
  const clearSelection = () => {
    setSelectedToads(new Set());
  };

  // Покормить выделенных
  const feedSelected = () => {
    if (selectedToads.size === 0) return;

    playCrunchShort();
    handleFeedToads(Array.from(selectedToads));
    completeAchivement("feed-one");
    setSelectedToads(new Set());
  };

  // Переместить выделенных
  const moveSelected = (sceneId: number | null) => {
    if (selectedToads.size === 0) return;

    if (sceneId !== null) {
      const nextScene = getGameState().scenes.find((s) => s.id === sceneId);
      const nextSceneToads =
        getGameState().toads.filter((t) => t.scene_id === sceneId).length +
        selectedToads.size;
      if (!nextScene || nextScene.capacity < nextSceneToads) {
        addNotification({ type: "warn", content: "Данный вольер переполнен!" });
        return;
      }
    }

    updateToadsByIds(Array.from(selectedToads), { scene_id: sceneId });

    setSelectedToads(new Set());
    setShowMoveTooltip(false);
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

  const isFirstScene = currentSceneIndex === 0;
  const isLastScene = currentSceneIndex === ownedScenes.length - 1;

  const onNextScene = () => {
    setCurrentSceneId(currentSceneIndex + 1);
  };

  const onPrevScene = () => {
    setCurrentSceneId(currentSceneIndex - 1);
  };

  const TitleComponent = <ClickButton></ClickButton>;

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

      {/* Кнопки переключения режима просмотра */}
      <div className="px-1 pb-3 flex gap-2 ">
        <ClickButton
          onClick={() => setViewMode("detailed")}
          className={`px-3 py-1 rounded-md h-min text-xs font-medium transition-all ${
            viewMode === "detailed"
              ? "bg-green-500 text-white"
              : "bg-gray-700 text-gray-300 hover:text-white"
          }`}
          title="Подробный вид"
        >
          Подробно
        </ClickButton>
        <ClickButton
          onClick={() => setViewMode("compact")}
          className={`px-3 py-1 rounded-md h-min text-xs font-medium transition-all ${
            viewMode === "compact"
              ? "bg-blue-500 text-white"
              : "bg-gray-700 text-gray-300 hover:text-white"
          }`}
          title="Компактный вид"
        >
          Сетка
        </ClickButton>

        <div className="flex items-center justify-center gap-2 ml-auto">
          <ArrowLeftButtonCompact
            className="w-6 h-6"
            disabled={isFirstScene}
            onClick={onPrevScene}
          />
          <span className="text-sm truncate w-[90px]">{currentScene.name}</span>

          <ArrowRightButtonCompact
            className="w-6 h-6"
            onClick={onNextScene}
            disabled={isLastScene}
          />
        </div>
      </div>
      {/* Панель управления выделением (только для компактного режима) */}
      {viewMode === "compact" && (
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-600/50">
          <div className="flex items-center justify-between relative">
            <div className="text-sm text-white">
              Выбрано: <span className="font-bold">{selectedToads.size}</span>{" "}
              жаб
            </div>

            <div className="flex gap-2">
              {/* Выделить все */}
              <button
                onClick={selectAll}
                className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-medium transition-all border border-blue-500/30 hover:bg-blue-500/30"
                title="Выделить все"
              >
                ▼
              </button>

              {/* Отменить выделение */}
              <button
                onClick={clearSelection}
                className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded-lg text-xs font-medium transition-all border border-gray-500/30 hover:bg-gray-500/30"
                title="Отменить выделение"
              >
                ✕
              </button>

              {/* Покормить выделенных */}
              <button
                onClick={feedSelected}
                className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-xs font-medium transition-all border border-green-500/30 hover:bg-green-500/30"
                title="Покормить выделенных"
              >
                🍎
              </button>

              {/* Переместить выделенных */}
              <div className="">
                <button
                  onClick={() => setShowMoveTooltip(!showMoveTooltip)}
                  className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs font-medium transition-all border border-purple-500/30 hover:bg-purple-500/30"
                  title="Переместить выделенных"
                >
                  🏠
                </button>

                {showMoveTooltip && (
                  <Tooltip
                    title="Куда"
                    isOpen={true}
                    onClose={() => setShowMoveTooltip(false)}
                    className="right-0 "
                  >
                    <div className="space-y-1 h-40 overflow-auto">
                      <button
                        onClick={() => moveSelected(null)}
                        className="w-full text-left p-2 truncate  text-xs border-b-[1px] border-gray-500/10"
                      >
                        📦 На склад
                      </button>
                      {ownedScenes
                        .filter((s) => s.id !== currentScene.id)
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={() => moveSelected(s.id)}
                            className="w-full text-left p-2  text-xs truncate border-b-[1px] border-gray-500/10"
                          >
                            🏠 {s.name}
                          </button>
                        ))}
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Контент с прокруткой */}
      <div className="px-1">
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
        ) : viewMode === "detailed" ? (
          // Подробный режим (оставляем как было)
          <div className="space-y-2">
            {filteredAndSortedToads.map((toad) => {
              const familyId = familyGroups.get(toad.id);
              const familyColor =
                familyId !== undefined
                  ? getRelationshipColor(familyId)
                  : undefined;

              return (
                <div
                  key={toad.id}
                  style={{
                    backgroundColor: familyColor ? familyColor : undefined,
                    backgroundImage: familyColor ? "none" : undefined,
                  }}
                  className="rounded-2xl relative"
                >
                  <ToadItem
                    id={(toad.id || 0).toString()}
                    showHunger
                    isSelected={false}
                    onClick={() => handleToadClick(toad)}
                    toad={toad}
                    button={
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateToadById(toad.id, { scene_id: null });
                          }}
                          className="px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-medium transition-all border border-blue-500/30 hover:bg-blue-500/30"
                        >
                          📦
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playCrunchShort();
                            handleFeedToads([toad.id]);
                            completeAchivement("feed-one");
                          }}
                          className="px-3 py-2 bg-green-500/20 text-green-300 rounded-lg text-xs font-medium transition-all border border-green-500/30 hover:bg-green-500/30"
                        >
                          🍎
                        </button>
                      </div>
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Компактный режим (сетка) с выделением
          <div className="grid grid-cols-3 gap-2">
            {filteredAndSortedToads.map((toad) => {
              const familyId = familyGroups.get(toad.id);
              const familyColor =
                familyId !== undefined
                  ? getRelationshipColor(familyId)
                  : undefined;

              return (
                <CompactToadItem
                  key={toad.id}
                  toad={toad}
                  isSelected={selectedToads.has(toad.id)}
                  onSelect={handleSelectToad}
                  familyColor={familyColor}
                  onProfileClick={handleToadClick}
                  allToads={toads}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Подвал с статистикой */}
      <div className="border-t border-gray-700/50 py-3 px-2 bg-gray-900/50 mt-3">
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
