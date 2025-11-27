import { TYPE_ICONS } from "../../utils/constants";
import {
  getPersonalityMultipliers,
  getRarityConfig,
  personalities,
  HOURS_TO_GROW_UP,
  getPersonalityDescription,
  getPersonalityLabel,
  getGeneticFaultConfig,
} from "../../models/toad";
import { useToads } from "../ToadContext";
import { InfoIcons } from "../../assets/icons";
import Modal from "../shared/Modal";
import { useState, useMemo } from "react";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { updateToadById } from "../../backend";
import { completeAchivement } from "../../backend/achivements-manager";
import { getBoostByScene } from "../../models/scene";
import { nameGenerator } from "../../utils/name-generator";
import { Tooltip } from "../shared/Tooltip";
import { getGameState } from "../../backend/localStorage";
import { useNotifications } from "../../hooks/use-notification";

interface ToadInfoProps {
  onClose: () => void;
}

export default function ToadInfo({ onClose }: ToadInfoProps) {
  const {
    selectedToad: toad,
    toads,
    allToads,
    selectToad,
    handleFeedToads,
    ownedScenes,
    currentScene,
    setCurrentSceneId,
  } = useToads();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(toad?.name || "");
  const [showPersonalityTooltip, setShowPersonalityTooltip] = useState(false);
  const [showScenesTooltip, setShowScenesTooltip] = useState(false);
  const [showGeneticFaultTooltip, setShowGeneticFaultTooltip] = useState(false);
  const [showRelativesTooltip, setShowRelativesTooltip] = useState(false);
  const { addNotification } = useNotifications();
  const { playCrunchShort } = useSoundEffects();

  const allScenes = ownedScenes.filter((s) => s.id !== currentScene.id);

  if (!toad) {
    return null;
  }

  // Функция для получения информации о родственниках
  const relativesInfo = useMemo(() => {
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
  }, [toad, allToads]);

  // Функция для переключения на родственника
  const handleSelectRelative = (rel) => {
    if (!rel.sceneId) {
      return null;
    }
    if (rel.sceneId !== currentScene.id) {
      setCurrentSceneId(rel.sceneId);
    }
    selectToad(rel.id);
    setShowRelativesTooltip(false);
  };

  const handleNameSave = async () => {
    if (editedName.trim() && editedName !== toad.name) {
      updateToadById(toad.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  // Функция для генерации случайного имени
  const generateRandomName = () => {
    const randomName = nameGenerator.generate();
    setEditedName(randomName);
  };

  const calculateAge = () => {
    const created = new Date(toad.created_at).getTime();
    const now = Date.now();
    const diff = now - created;
    return Math.floor(diff / (1000 * 60 * 60 * 24)); // дни
  };

  const calculatePregnancyProgress = () => {
    if (!toad.pregnancy?.isPregnant) {
      return null;
    }

    const start = toad.pregnancy.pregnancyStart;
    const duration = toad.pregnancy.pregnancyDuration * 60 * 60 * 1000;
    const now = Date.now();
    const elapsed = now - start;
    const progress = (elapsed / duration) * 100;
    const timeLeft = Math.max(Math.ceil((duration - elapsed) / (60 * 1000)), 0);

    return { progress: Math.min(progress, 100), timeLeft };
  };

  const pregnancyInfo = calculatePregnancyProgress();

  const calculateGrowProgress = () => {
    if (toad.stage !== "toadpole") {
      return null;
    }
    const boost = getBoostByScene(toad.scene_id, "grow");

    const boostedTimeToGrow = HOURS_TO_GROW_UP / boost;
    const start = new Date(toad.created_at).getTime();
    const duration = boostedTimeToGrow * 60 * 60 * 1000;
    const now = Date.now();
    const elapsed = now - start;
    const progress = (elapsed / duration) * 100;
    const timeLeft = Math.max(Math.ceil((duration - elapsed) / (60 * 1000)), 0);

    return { progress: Math.min(progress, 100), timeLeft };
  };

  const growInfo = calculateGrowProgress();

  const handleNextToad = () => {
    setShowScenesTooltip(false);
    setShowGeneticFaultTooltip(false);
    setShowRelativesTooltip(false);
    const currIndex = toads.findIndex((t) => t.id === toad.id);
    if (currIndex === -1) return;
    selectToad(toads[(currIndex + 1) % toads.length].id);
  };

  const handlePrevToad = () => {
    setShowScenesTooltip(false);
    setShowGeneticFaultTooltip(false);
    setShowRelativesTooltip(false);
    const currIndex = toads.findIndex((t) => t.id === toad.id);
    if (currIndex === -1) return;
    selectToad(toads[(currIndex - 1 + toads.length) % toads.length].id);
  };

  const rarityConfig = getRarityConfig(toad.genes?.rarity || 1);
  const geneticFaultConfig = getGeneticFaultConfig(toad.state?.genetic_fault);
  const personalityData = toad.genes?.personality
    ? personalities[toad.genes.personality as keyof typeof personalities]
    : null;
  const personalityMultipliers = getPersonalityMultipliers(
    toad.genes?.personality || null
  );

  const icon = (
    <div
      style={{ display: toad.sex === "neuter" ? "none" : "flex" }}
      className={`flex items-center justify-center w-8 rounded-xl ${
        toad.sex === "male"
          ? "bg-blue-900/50 border-blue-500/50"
          : toad.sex === "female"
          ? "bg-pink-900/50 border-pink-500/50"
          : "bg-gray-900/50 border-gray-500/50"
      } border-2`}
    >
      <span className="text-lg">
        {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS]}
      </span>
    </div>
  );

  const feedToad = async (toadId: number) => {
    playCrunchShort();
    handleFeedToads([toadId]);
    completeAchivement("feed-one");
  };

  const handleMoveToScene = (scene_id: number | null) => () => {
    if (scene_id === null) {
      updateToadById(toad.id, { scene_id });
      handleNextToad();
      return;
    }

    const nextScene = getGameState().scenes.find((s) => s.id === scene_id);
    const nextSceneToads =
      getGameState().toads.filter((t) => t.scene_id === scene_id).length + 1;
    if (!nextScene || nextScene.capacity < nextSceneToads) {
      addNotification({ type: "warn", content: "Данный вольер переполнен!" });
      return;
    }
    updateToadById(toad.id, { scene_id });
    handleNextToad();
  };

  return (
    <Modal isOpen onClose={onClose}>
      <div className="flex w-full items-center pb-4 px-10 ">
        {isEditingName ? (
          <div className="flex w-full text-white bg-none items-center gap-2 max-w-full">
            <button className="text-xl" onClick={generateRandomName}>
              🎲
            </button>

            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="bg-gray-700 outline-none border border-gray-600 rounded-lg px-1 py-[7px] text-white text-sm w-full "
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              maxLength={33}
            />
            <div className="flex gap-1">
              <button
                onClick={handleNameSave}
                className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50"
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
              <button
                onClick={() => setIsEditingName(false)}
                className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                title="Отмена"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <h2 className="font-bold flex gap-2 bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
            <span className="text-lg py-1 font-semibold max-w-[260px] whitespace-break-spaces">
              {toad.name}
            </span>
            <button
              onClick={() => {
                setEditedName(toad.name || "");
                setIsEditingName(true);
              }}
              className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
            >
              {InfoIcons.pencil}
            </button>
          </h2>
        )}
      </div>

      <div className="flex gap-2 items-center mb-4 px-10">
        {icon}
        <p className="text-gray-400 text-xs">Поколение {toad.generation}</p>
        <p className="text-gray-400 text-xs ml-auto">
          {toad.stage === "adult" ? "Взрослый" : "Детеныш"}: {calculateAge()}{" "}
          дней
        </p>
      </div>

      <div className="flex">
        <button
          onClick={handlePrevToad}
          className="text-gray-400 hover:text-white transition-colors p-1 touch-manipulation active:scale-95"
          title="Предыдущая жаба"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="min-w-8 min-h-8"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="flex flex-col w-full ">
          {/* РЕДКОСТЬ и ГЕНЕТИЧЕСКАЯ ПОЛОМКА - колонки */}
          <div className="grid grid-cols-2 gap-2 mb-3 relative">
            {/* РЕДКОСТЬ */}
            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.rarity}
                <p className="text-gray-400 text-xs font-medium h-5">
                  РЕДКОСТЬ
                </p>
              </div>
              <p className={`text-sm font-semibold ${rarityConfig.color}`}>
                {rarityConfig.label} ({toad.genes?.rarity?.toFixed(1) || "1.0"})
              </p>
            </div>

            {/* ГЕНЕТИЧЕСКАЯ ПОЛОМКА */}
            <div
              className={`rounded-xl p-2 border ${geneticFaultConfig.bgColor} ${geneticFaultConfig.borderColor} cursor-pointer hover:opacity-90 transition-opacity`}
              onClick={() =>
                setShowGeneticFaultTooltip(!showGeneticFaultTooltip)
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{geneticFaultConfig.icon}</span>
                <p className="text-gray-400 text-xs font-medium">ГЕНЕТИКА</p>
              </div>
              <p
                className={`text-sm font-semibold ${geneticFaultConfig.color}`}
              >
                {geneticFaultConfig.label} ({toad.state?.genetic_fault || 0}%)
              </p>
            </div>

            {showGeneticFaultTooltip && (
              <Tooltip
                title="Генетика"
                isOpen={showGeneticFaultTooltip}
                onClose={() => setShowGeneticFaultTooltip(false)}
              >
                <div className="space-y-2 text-sm">
                  <p className="text-gray-300">
                    {geneticFaultConfig.description}
                  </p>
                </div>
              </Tooltip>
            )}
          </div>

          {/* ПЛОДОВИТОСТЬ и HUNGER RATE - колонки */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.fertility}
                <p className="text-gray-400 text-xs font-medium">
                  ПЛОДОВИТОСТЬ
                </p>
              </div>
              <p
                className={`
                          ${
                            toad.genes?.fertility > 1
                              ? "text-green-400"
                              : "text-red-400"
                          } text-sm font-semibold`}
              >
                {toad.genes?.fertility?.toFixed(1) || "1.0"}x
              </p>
            </div>

            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.hunger}
                <p className="text-gray-400 text-xs font-medium">АППЕТИТ</p>
              </div>
              <p
                className={`
                          ${
                            toad.genes?.hungerRate < 1
                              ? "text-green-400"
                              : "text-red-400"
                          } text-sm font-semibold`}
              >
                {toad.genes?.hungerRate?.toFixed(1) || "1.0"}x
              </p>
            </div>
          </div>

          {/* РАЗМЕР и СКОРОСТЬ - колонки */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.weight}
                <p className="text-gray-400 text-xs font-medium">РАЗМЕР</p>
              </div>
              <p className="text-blue-400 text-sm font-semibold">
                {toad.genes?.weight?.toFixed(1) || "0.0"}
              </p>
            </div>

            <div className="bg-gray-700/50 rounded-xl p-2 border border-gray-600/50">
              <div className="flex items-center gap-2 mb-1">
                {InfoIcons.speed}
                <p className="text-gray-400 text-xs font-medium">СКОРОСТЬ</p>
              </div>
              <p className="text-blue-400 text-sm font-semibold">
                {toad.genes?.speed?.toFixed(1) || "0.0"}
              </p>
            </div>
          </div>

          {/* РОДСТВЕННИКИ */}
          <div className="relative mb-3">
            <div
              onClick={() => setShowRelativesTooltip(!showRelativesTooltip)}
              className={`rounded-xl p-2 border cursor-pointer transition-colors ${
                relativesInfo.inbreedingRisk
                  ? "bg-yellow-900/20 border-yellow-500/50 hover:bg-yellow-900/30"
                  : relativesInfo.relatives.length > 0
                  ? "bg-blue-900/20 border-blue-500/50 hover:bg-blue-900/30"
                  : "bg-gray-700/50 border-gray-600/50 hover:bg-gray-600/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🔸</span>
                <p className="text-gray-400 text-xs font-medium">
                  РОДСТВЕННИКИ
                </p>
              </div>
              <p
                className={`text-sm font-semibold ${
                  relativesInfo.inbreedingRisk
                    ? "text-yellow-400"
                    : relativesInfo.relatives.length > 0
                    ? "text-blue-400"
                    : "text-gray-400"
                }`}
              >
                {relativesInfo.relatives.length > 0
                  ? `${relativesInfo.relatives.length} найдено`
                  : "Не обнаружено"}
                {relativesInfo.inbreedingRisk}
              </p>
            </div>

            {showRelativesTooltip && (
              <Tooltip
                title="Родственники"
                isOpen={showRelativesTooltip}
                onClose={() => setShowRelativesTooltip(false)}
              >
                <div className="space-y-2 text-sm max-w-xs">
                  {relativesInfo.relatives.length > 0 ? (
                    <>
                      <p className="text-gray-300 mb-2">
                        {relativesInfo.relatives.length} родственников найдено:
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {relativesInfo.relatives.map((rel: any) => (
                          <button
                            key={rel.id}
                            onClick={() => handleSelectRelative(rel)}
                            className={`flex items-center gap-2 p-2 rounded text-xs w-full text-left hover:bg-gray-600/50 transition-colors ${
                              rel.isInSameEnclosure && rel.sex !== toad.sex
                                ? "bg-yellow-900/20 border border-yellow-500/30"
                                : "bg-gray-700/30"
                            }`}
                          >
                            <span className="flex-shrink-0">
                              {TYPE_ICONS[rel.sex as keyof typeof TYPE_ICONS]}
                            </span>
                            <span className="truncate flex-1">{rel.name}</span>
                            {rel.isInSameEnclosure && (
                              <span
                                className={`px-1 rounded text-xs ${
                                  rel.sex !== toad.sex
                                    ? "bg-yellow-500/50 text-yellow-100"
                                    : "bg-gray-500/50 text-gray-300"
                                }`}
                              >
                                {rel.sex !== toad.sex ? "🔸" : ""}
                              </span>
                            )}
                            {!rel.sceneId && (
                              <span className="px-1 rounded text-xs">📦</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {relativesInfo.inbreedingRisk ? (
                        <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-xs">
                          <p className="text-yellow-300 font-semibold">
                            🔸 Обратите внимание
                          </p>
                          <p className="text-yellow-200 mt-1">
                            В этом вольере есть родственники другого пола.
                            Рекомендуется рассмотреть их перемещение для
                            предотвращения возможных генетических проблем у
                            потомства.
                          </p>
                        </div>
                      ) : (
                        <p>Родственники другого пола, риска ибридинга нет</p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-300">
                      Родственников данной жабы не обнаружено, разведение
                      безопасно.
                    </p>
                  )}
                </div>
              </Tooltip>
            )}
          </div>

          {/* ХАРАКТЕР */}
          <div className="relative">
            <div
              onClick={() =>
                personalityData &&
                setShowPersonalityTooltip(!showPersonalityTooltip)
              }
              className={`bg-gray-700/50 rounded-xl p-2 mb-3 border border-gray-600/50 transition-colors ${
                personalityData ? "cursor-pointer hover:bg-gray-600/50" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {InfoIcons.personality}
                <p className="text-gray-400 text-xs font-medium">ХАРАКТЕР</p>
              </div>
              <p
                className={`text-sm  ${
                  toad.genes?.personality ? "text-purple-400" : "text-gray-400"
                }`}
              >
                {getPersonalityLabel(toad.genes?.personality || null)}
              </p>
              {personalityData && (
                <p className="text-gray-500 text-xs mt-1">
                  {getPersonalityDescription(toad.genes?.personality)}
                </p>
              )}
            </div>

            {showPersonalityTooltip && personalityData && (
              <Tooltip
                title="Влияние характера"
                isOpen={showPersonalityTooltip && !!personalityData}
                onClose={() => setShowPersonalityTooltip(false)}
              >
                <>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Аппетит:</span>
                      <span
                        className={
                          personalityData.hungerRate > 1
                            ? "text-red-400"
                            : "text-green-400"
                        }
                      >
                        {personalityData.hungerRate.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Плодовитость:</span>
                      <span
                        className={
                          personalityData.fertility > 1
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {personalityData.fertility.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Размер:</span>
                      <span>
                        {personalityMultipliers.weightMultiplier.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Скорость:</span>
                      <span>
                        {personalityMultipliers.speedMultiplier.toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-600">
                    <p className="text-gray-400 text-xs italic">
                      {personalityData.description}
                    </p>
                  </div>
                </>
              </Tooltip>
            )}
          </div>

          {/* СЫТОСТЬ */}
          <div className="bg-gray-700/50 min-h-14  justify-between rounded-xl p-2 mb-3 border flex-col border-gray-600/50 items-center flex gap-2">
            <div className="flex w-full justify-between items-center">
              <div className="flex items-center gap-4 justify-between">
                <div className="flex items-center gap-2">
                  {InfoIcons.hunger}
                  <p className="text-gray-400 text-xs font-medium">СЫТОСТЬ</p>
                </div>
                <p className="text-gray-400 text-xs">
                  {toad.state?.hunger || 0}/100
                </p>
              </div>
            </div>

            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  (toad.state?.hunger || 0) < 30
                    ? "bg-red-500"
                    : (toad.state?.hunger || 0) < 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${toad.state?.hunger || 0}%` }}
              />
            </div>
          </div>

          {/* РОСТ */}
          {growInfo && (
            <div className="bg-purple-900/20 rounded-xl p-2 mb-3 border border-purple-500/50">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-purple-400 text-xs font-medium">РОСТ</p>
              </div>
              <div className="space-y-2">
                <p className="text-purple-300 text-sm">
                  Осталось: {growInfo.timeLeft} минут
                </p>
                <div className="w-full bg-purple-900/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${growInfo.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* БЕРЕМЕННОСТЬ */}
          {toad.pregnancy?.isPregnant && pregnancyInfo && (
            <div className="bg-pink-900/20 rounded-xl p-2 mb-3 border border-pink-500/50">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-pink-400 text-xs font-medium">
                  БЕРЕМЕННОСТЬ
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-pink-300 text-sm">
                  Осталось: {pregnancyInfo.timeLeft} минут
                </p>
                <div className="w-full bg-pink-900/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-pink-500"
                    style={{ width: `${pregnancyInfo.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ПАНЕЛЬ УПРАВЛЕНИЯ */}
          <div className="bg-gray-800/50 rounded-xl p-2 border border-gray-600/50 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-gray-400 text-xs font-medium">УПРАВЛЕНИЕ</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => feedToad(toad.id)}
                className="flex items-center justify-center gap-1 py-2 px-2 bg-green-600/30 hover:bg-green-600/40 rounded-lg transition-all text-xs"
              >
                <span>🍎</span>
                <span>Накормить</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowScenesTooltip(!showScenesTooltip)}
                  className="flex items-center justify-center gap-1 py-2 px-2 bg-blue-600/30 hover:bg-blue-600/40 rounded-lg transition-all text-xs w-full"
                >
                  <span>🏠</span>
                  <span>Переместить</span>
                </button>

                {showScenesTooltip && (
                  <Tooltip
                    revert
                    title="Куда"
                    isOpen={showScenesTooltip}
                    onClose={() => setShowScenesTooltip(false)}
                  >
                    <div className="space-y-1">
                      <button
                        onClick={handleMoveToScene(null)}
                        className="w-full text-left p-2 hover:bg-gray-600 truncate rounded text-xs"
                      >
                        📦 На склад
                      </button>
                      {/* Здесь будет список вольеров из Scene[] */}
                      {allScenes.map((s) => (
                        <button
                          key={s.id}
                          onClick={handleMoveToScene(s.id)}
                          className="w-full text-left p-2 rounded text-xs"
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
          {/* ЦВЕТА */}
          {toad.genes?.colors && toad.genes.colors.length > 0 && (
            <div className="my-3">
              <p className="text-gray-400 text-xs font-medium mb-2">ЦВЕТА</p>
              <div className="flex gap-1">
                {toad.genes.colors.map((color, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full border-2 border-white/30 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={`Цвет ${index + 1}: ${color}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleNextToad}
          className="text-gray-400 hover:text-white transition-colors p-1 touch-manipulation active:scale-95"
          title="Следующая жаба"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="min-w-8 min-h-8"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <button
        onClick={onClose}
        className="flex-1 w-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white py-3 text-base rounded-xl mt-4  border border-gray-600 touch-manipulation active:scale-95"
      >
        Закрыть
      </button>
    </Modal>
  );
}
