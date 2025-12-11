import React, { useState, useRef, useEffect } from "react";
import {
  RARITY_GROUPS_TRESHOLD,
  Toad,
  getGeneticFaultConfig,
  getRarityConfig,
} from "../../models/toad";
import Modal from "../shared/Modal";
import { PregnancyIcon, ToadpoleIcon } from "../../assets/icons";
import { updateToadById, updateToadsByIds } from "../../backend";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { ToadGender } from "../shared/ToadGender";
import { useToads } from "../ToadContext";
import { completeAchivement } from "../../backend/achivements-manager";
import { ToadItem } from "../shared/ToadItem";
import { FilterByType, Filters, SortByType } from "../shared/Filters";
import { useFilters } from "../../hooks/use-filters";
import { Tooltip } from "../shared/Tooltip";
import { getGameState } from "../../backend/localStorage";
import { useNotifications } from "../../hooks/use-notification";
import { ClickButton } from "../shared/ClickButton";
import { ArrowLeftButtonCompact } from "../shared/ArrowLeft";
import { ArrowRightButtonCompact } from "../shared/ArrowRight";

interface ToadListModalProps {
  isOpen: boolean;
  onClose: () => void;
  toads: Toad[];
  onToadSelect: (toadId: number) => void;
}

// Неоновые цвета в стиле игры для родственных связей (25 цветов)
const RELATIONSHIP_COLORS = [
  "rgba(255, 20, 147, 0.15)", // Neon Pink
  "rgba(0, 255, 255, 0.15)", // Neon Cyan
  "rgba(50, 255, 50, 0.15)", // Neon Green
  "rgba(255, 255, 0, 0.15)", // Neon Yellow
  "rgba(255, 0, 255, 0.15)", // Neon Magenta
  "rgba(0, 191, 255, 0.15)", // Deep Sky Blue
  "rgba(124, 252, 0, 0.15)", // Lawn Green
  "rgba(255, 69, 0, 0.15)", // Red-Orange
  "rgba(138, 43, 226, 0.15)", // Blue Violet
  "rgba(64, 224, 208, 0.15)", // Turquoise
  "rgba(255, 105, 180, 0.15)", // Hot Pink
  "rgba(0, 250, 154, 0.15)", // Medium Spring Green
  "rgba(255, 215, 0, 0.15)", // Gold
  "rgba(30, 144, 255, 0.15)", // Dodger Blue
  "rgba(255, 140, 0, 0.15)", // Dark Orange
  "rgba(148, 0, 211, 0.15)", // Dark Violet
  "rgba(0, 255, 127, 0.15)", // Spring Green
  "rgba(255, 0, 127, 0.15)", // Rose
  "rgba(70, 130, 180, 0.15)", // Steel Blue
  "rgba(255, 99, 71, 0.15)", // Tomato
  "rgba(106, 90, 205, 0.15)", // Slate Blue
  "rgba(60, 179, 113, 0.15)", // Medium Sea Green
  "rgba(255, 165, 0, 0.15)", // Orange
  "rgba(147, 112, 219, 0.15)", // Medium Purple
  "rgba(32, 178, 170, 0.15)", // Light Sea Green
];

// Функция для получения цвета по ID родственной группы
const getRelationshipColor = (familyId: number) => {
  return RELATIONSHIP_COLORS[familyId % RELATIONSHIP_COLORS.length];
};

// Функция для определения родственных групп
const getFamilyGroups = (toads: Toad[]) => {
  const families = new Map<number, number>(); // toadId -> familyId
  let nextFamilyId = 0;

  const connectRelatives = (toad1Id: number, toad2Id: number) => {
    const family1 = families.get(toad1Id);
    const family2 = families.get(toad2Id);

    if (family1 === undefined && family2 === undefined) {
      const newFamilyId = nextFamilyId++;
      families.set(toad1Id, newFamilyId);
      families.set(toad2Id, newFamilyId);
    } else if (family1 === undefined) {
      families.set(toad1Id, family2!);
    } else if (family2 === undefined) {
      families.set(toad2Id, family1!);
    } else if (family1 !== family2) {
      // Объединяем семьи
      for (const [id, famId] of families.entries()) {
        if (famId === family2) {
          families.set(id, family1);
        }
      }
    }
  };

  // Строим связи родитель-ребенок
  toads.forEach((toad) => {
    if (toad.parents && toad.parents.length > 0) {
      toad.parents.forEach((parentId) => {
        const parent = toads.find((t) => t.id === parentId);
        if (parent) {
          connectRelatives(toad.id, parentId);
        }
      });
    }
  });

  return families;
};

// Функция для получения информации о родственниках конкретной жабы
const getToadRelatives = (toad: Toad, allToads: Toad[]) => {
  if (!toad) {
    return { relatives: [], inbreedingRisk: false };
  }

  const relatives = new Map();

  // 1. Находим родителей текущей жабы
  if (toad.parents && toad.parents.length > 0) {
    toad.parents.forEach((parentId) => {
      const parent = allToads.find((t) => t.id === parentId);
      if (parent) {
        relatives.set(parent.id, {
          id: parent.id,
          name: parent.name,
          sex: parent.sex,
          sceneId: parent.scene_id,
          isInSameEnclosure: parent.scene_id === toad.scene_id,
          relation: "parent",
        });
      }
    });
  }

  // 2. Находим детей текущей жабы
  const children = allToads.filter(
    (t) => t.parents && t.parents.includes(toad.id)
  );

  children.forEach((child) => {
    if (!relatives.has(child.id)) {
      relatives.set(child.id, {
        id: child.id,
        name: child.name,
        sex: child.sex,
        sceneId: child.scene_id,
        isInSameEnclosure: child.scene_id === toad.scene_id,
        relation: "child",
      });
    }
  });

  // 3. Находим братьев и сестер (жабы с общими родителями)
  const siblings = allToads.filter((otherToad) => {
    // Пропускаем текущую жабу
    if (otherToad.id === toad.id) return false;

    // Если у обоих есть родители и есть общие родители
    if (toad.parents && otherToad.parents) {
      return toad.parents.some((parentId) =>
        otherToad.parents?.includes(parentId)
      );
    }
    return false;
  });

  siblings.forEach((sibling) => {
    if (!relatives.has(sibling.id)) {
      relatives.set(sibling.id, {
        id: sibling.id,
        name: sibling.name,
        sex: sibling.sex,
        sceneId: sibling.scene_id,
        isInSameEnclosure: sibling.scene_id === toad.scene_id,
        relation: "sibling",
      });
    }
  });

  const relativesArray = Array.from(relatives.values());

  // Проверяем риск имбридинга: есть ли родственники другого пола в том же вольере
  // (кроме детей, так как дети обычно не представляют риска имбридинга)
  const inbreedingRisk = relativesArray.some(
    (rel) =>
      rel &&
      rel.isInSameEnclosure &&
      rel.sex !== toad.sex &&
      rel.sex !== "neuter" &&
      toad.sex !== "neuter" &&
      rel.relation !== "child" // Исключаем детей из проверки риска
  );

  return {
    relatives: relativesArray,
    inbreedingRisk,
    parentsCount: Array.from(relatives.values()).filter(
      (r) => r.relation === "parent"
    ).length,
    siblingsCount: Array.from(relatives.values()).filter(
      (r) => r.relation === "sibling"
    ).length,
    childrenCount: Array.from(relatives.values()).filter(
      (r) => r.relation === "child"
    ).length,
  };
};

// Компонент для компактного отображения жабы
const CompactToadItem = ({
  toad,
  isSelected,
  onSelect,
  familyColor,
  onProfileClick,
  allToads,
}: {
  toad: Toad;
  isSelected: boolean;
  onSelect: (toadId: number) => void;
  familyColor?: string;
  onProfileClick: (toad: Toad) => void;
  allToads: Toad[];
}) => {
  const rarityConfig = getRarityConfig(toad.genes.rarity);
  const geneticFaultConfig = getGeneticFaultConfig(toad.state?.genetic_fault);

  // Получаем информацию о родственниках для этой жабы
  const relativesInfo = getToadRelatives(toad, allToads);

  const getHungerColor = (level: number) => {
    if (level >= 80) return "bg-green-500";
    if (level >= 50) return "bg-yellow-500";
    if (level >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div
      id={toad.id}
      onClick={() => onSelect(toad.id)}
      className={`bg-gray-800 flex flex-col gap-1.5 rounded-xl p-1 border transition-colors cursor-pointer ${
        isSelected
          ? "border-yellow-400 bg-yellow-500/10 shadow-sm shadow-yellow-500/20"
          : "border-gray-600/30 hover:border-gray-500/50"
      }`}
      style={{
        backgroundColor: familyColor ? familyColor : undefined,
        backgroundImage: familyColor ? "none" : undefined,
      }}
    >
      {/* Верхняя строка: пол + имя + индикатор родственников */}
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm flex-shrink-0">
             <ToadGender gender={toad.sex} />
          </span>
          <span className="text-white font-medium text-sm truncate">
            {toad.name}
          </span>
          {toad.pregnancy?.isPregnant && (
            <span className="text-pink-400 flex-shrink-0 text-xs">
              <PregnancyIcon />
            </span>
          )}
          {toad.stage === "toadpole" && (
            <span className="text-blue-400 flex-shrink-0 text-xs">
              <ToadpoleIcon />
            </span>
          )}
        </div>
      </div>

      {/* Средняя строка: шкала голода */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${getHungerColor(
              toad.state.hunger
            )}`}
            style={{ width: `${toad.state.hunger}%` }}
          />
        </div>
        <span className="text-gray-400 text-xs font-medium w-6 text-right">
          {Math.round(toad.state.hunger)}%
        </span>
      </div>

      {/* Нижняя строка: редкость + поломка + кнопка профиля */}
      <div className="flex items-center justify-between text-xs">
        <div className={`flex items-center gap-1 ${rarityConfig.color}`}>
          <span>{rarityConfig.icon}</span>
          <span className="font-medium">{toad.genes.rarity.toFixed(1)}</span>
        </div>

        <div className={`flex items-center gap-1 ${geneticFaultConfig.color}`}>
          <span>{geneticFaultConfig.icon}</span>
          <span className="font-medium">{toad.state?.genetic_fault || 0}%</span>
        </div>

        {/* Кнопка перехода в профиль */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(toad);
          }}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
          title="Перейти в профиль"
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

const ToadListModal: React.FC<ToadListModalProps> = ({
  isOpen,
  onClose,
  toads,
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
    const element = document.getElementById(lastToadId);

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
                    id={toad.id}
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
