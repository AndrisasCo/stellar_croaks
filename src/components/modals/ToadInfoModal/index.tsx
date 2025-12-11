import { useState } from "react";
import { TYPE_ICONS } from "../../../utils/constants";
import {
  getPersonalityMultipliers,
  getRarityConfig,
  personalities,
  getPersonalityLabel,
  getGeneticFaultConfig,
  getToadTypeLabel,
} from "../../../models/toad";
import { useToads } from "../../ToadContext";
import { InfoIcons } from "../../../assets/icons";
import Modal from "../../shared/Modal";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { updateToadById, updateUserStorage } from "../../../backend";
import { completeAchivement } from "../../../backend/achivements-manager";
import { nameGenerator } from "../../../utils/name-generator";
import { Tooltip } from "../../shared/Tooltip";
import { getGameState } from "../../../backend/localStorage";
import { useNotifications } from "../../../hooks/use-notification";
import { endPregnancy } from "../../../utils/breeding-manager";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { ProgressBar } from "./ProgressBar";
import { StatCard } from "./StatCard";
import { useToadRelatives } from "./useToadRelatives";
import { useToadTimers } from "./useToadTimers";

export const ToadInfo = ({ onClose }: { onClose: () => void }) => {
  const {
    selectedToad: toad,
    toads,
    allToads,
    selectToad,
    handleFeedToads,
    ownedScenes,
    currentScene,
    account,
  } = useToads();
  const { playCrunchShort } = useSoundEffects();
  const { addNotification } = useNotifications();

  // Local State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(toad?.name || "");
  const [tooltips, setTooltips] = useState<Record<string, boolean>>({});

  // Logic Hooks
  const { relatives, inbreedingRisk } = useToadRelatives(toad, allToads);
  const { age, pregnancy, growth } = useToadTimers(toad);

  if (!toad) return null;

  // Derived Data
  const rarityConfig = getRarityConfig(toad.genes?.rarity || 1);
  const geneticFault = getGeneticFaultConfig(toad.state?.genetic_fault);
  const personality = toad.genes?.personality
    ? personalities[toad.genes.personality]
    : null;

  // Handlers
  const toggleTooltip = (key: string) =>
    setTooltips((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleNav = (direction: "next" | "prev") => {
    setTooltips({});
    const idx = toads.findIndex((t) => t.id === toad.id);
    if (idx === -1) {
      return;
    }
    const target =
      direction === "next"
        ? toads[(idx + 1) % toads.length]
        : toads[(idx - 1 + toads.length) % toads.length];
    selectToad(target.id);
  };

  const handleRename = () => {
    if (editedName.trim() && editedName !== toad.name) {
      updateToadById(toad.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleAccelerate = (type: "growth" | "pregnancy") => {
    const resource = type === "growth" ? "worms" : "sparkleFlys";
    const resourceName =
      type === "growth" ? "Протеиновых Червей 🪱" : "Сияющих Мушек ✨";

    if ((account.storage[resource] || 0) > 0) {
      updateUserStorage({ [resource]: account.storage[resource] - 1 });
      if (type === "growth") {
        updateToadById(toad.id, { stage: "adult" });
        addNotification({ type: "success", content: "Успех!" });
      } else {
        updateToadById(toad.id, { stage: "adult" }); // Ensure adult before birth?
        endPregnancy(toad, addNotification);
      }
    } else {
      addNotification({
        type: "warn",
        content: `У вас нет ${resourceName} для ускорения`,
      });
    }
  };

  const handleMove = (sceneId: number | null) => {
    if (sceneId !== null) {
      const scene = getGameState().scenes.find((s) => s.id === sceneId);
      const count = getGameState().toads.filter(
        (t) => t.scene_id === sceneId
      ).length;
      if (!scene || scene.capacity <= count) {
        addNotification({ type: "warn", content: "Вольер переполнен!" });
        return;
      }
    }
    updateToadById(toad.id, { scene_id: sceneId });
    handleNav("next");
  };

  console.log(tooltips);

  return (
    <Modal isOpen onClose={onClose}>
      <div className="flex w-full items-center pb-1 px-10 ">
        {isEditingName ? (
          <div className="flex w-full items-center gap-2">
            <button
              className="text-xl"
              onClick={() => setEditedName(nameGenerator.generate())}
            >
              🎲
            </button>
            <input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-white w-full"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <button onClick={handleRename} className="text-green-400">
              ✓
            </button>
            <button
              onClick={() => setIsEditingName(false)}
              className="text-red-400"
            >
              ✕
            </button>
          </div>
        ) : (
          <h2 className="font-bold flex gap-2 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-500">
            <span className="text-lg">{toad.name}</span>
            <button
              onClick={() => {
                setEditedName(toad.name);
                setIsEditingName(true);
              }}
            >
              {InfoIcons.pencil}
            </button>
          </h2>
        )}
      </div>

      {/* AVATAR & BASIC INFO */}
      <div className="flex gap-4 items-start mb-4 px-10">
        <ToadAvatar toad={toad} size={20} />
        <div className="flex flex-col gap-1 mr-auto text-sm text-gray-400">
          <p>{getToadTypeLabel(toad.type)}</p>
          <p>Поколение {toad.generation}</p>
          <p>
            {toad.stage === "adult" ? "Взрослый" : "Детеныш"}: {age} дней
          </p>
        </div>
        {/* Sex Icon */}
        {toad.sex !== "neuter" && (
          <div
            className={`flex items-center justify-center w-8 rounded-xl border-2 ${
              toad.sex === "male"
                ? "bg-blue-900/50 border-blue-500"
                : "bg-pink-900/50 border-pink-500"
            }`}
          >
            {TYPE_ICONS[toad.sex]}
          </div>
        )}
      </div>

      <div className="flex">
        {/* Navigation Left */}
        <button
          onClick={() => handleNav("prev")}
          className="text-gray-400 hover:text-white p-1"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* --- MAIN CONTENT COLUMN --- */}
        <div className="flex flex-col w-full px-2 ">
          {/* STATS GRID */}
          <div className="grid grid-cols-2 gap-2 mb-3 ">
            <StatCard
              icon={InfoIcons.rarity}
              label="Редкость"
              value={`${rarityConfig.label} (${toad.genes?.rarity?.toFixed(
                1
              )})`}
              colorClass={rarityConfig.color}
            />
            <StatCard
              icon={<span>{geneticFault.icon}</span>}
              label="Генетика"
              value={`${geneticFault.label} (${
                toad.state?.genetic_fault || 0
              }%)`}
              colorClass={geneticFault.color}
              onClick={() => toggleTooltip("genetic")}
              tooltip={
                tooltips["genetic"] && (
                  <Tooltip
                    title="Генетика"
                    isOpen
                    onClose={() => toggleTooltip("genetic")}
                    className="right-0 w-[200%]"
                  >
                    <p className="text-sm text-gray-300">
                      {geneticFault.description}
                    </p>
                  </Tooltip>
                )
              }
            />
            <StatCard
              icon={InfoIcons.fertility}
              label="Плодовитость"
              value={`${toad.genes?.fertility?.toFixed(1)}x`}
              colorClass={
                toad.genes?.fertility > 1 ? "text-green-400" : "text-red-400"
              }
            />
            <StatCard
              icon={InfoIcons.hunger}
              label="Аппетит"
              value={`${toad.genes?.hungerRate?.toFixed(1)}x`}
              colorClass={
                toad.genes?.hungerRate < 1 ? "text-green-400" : "text-red-400"
              }
            />
            <StatCard
              icon={InfoIcons.weight}
              label="Размер"
              value={toad.genes?.weight?.toFixed(2)}
              colorClass="text-blue-400"
            />
            <StatCard
              icon={InfoIcons.speed}
              label="Скорость"
              value={toad.genes?.speed?.toFixed(2)}
              colorClass="text-blue-400"
            />
          </div>

          {/* RELATIVES & PERSONALITY */}
          <div className="space-y-2 mb-3">
            <StatCard
              icon={<span>🔸</span>}
              label="Родственники"
              value={`${
                relatives.length > 0 ? relatives.length + " найдено" : "Нет"
              } ${inbreedingRisk ? "(Риск)" : ""}`}
              colorClass={inbreedingRisk ? "text-yellow-400" : "text-blue-400"}
              onClick={() => toggleTooltip("relatives")}
              tooltip={
                tooltips["relatives"] && (
                  <Tooltip
                    title="Родственники"
                    isOpen
                    onClose={() => toggleTooltip("relatives")}
                  >
                    {/* Relatives list logic here (simplified for brevity) */}
                    <div className="max-h-40 overflow-y-auto">
                      {relatives.map((rel: any) => (
                        <div
                          key={rel.id}
                          className={`p-1 text-xs border-b border-gray-700  ${
                            rel.sex !== toad.sex ? "bg-yellow-500/20 " : ""
                          }`}
                        >
                          {rel.sex !== toad.sex ? "🔸 " : " "} {rel.name}
                        </div>
                      ))}
                      {relatives.length === 0 && (
                        <p>Безопасно для разведения</p>
                      )}
                    </div>
                  </Tooltip>
                )
              }
            />

            <StatCard
              icon={InfoIcons.personality}
              label="Характер"
              value={getPersonalityLabel(toad.genes?.personality)}
              colorClass="text-purple-400"
              onClick={() => personality && toggleTooltip("personality")}
              tooltip={
                tooltips["personality"] &&
                personality && (
                  <Tooltip
                    title="Характер"
                    isOpen
                    onClose={() => toggleTooltip("personality")}
                  >
                    <p className="text-xs italic text-gray-400">
                      {personality.description}
                    </p>
                    {/* Personality stats */}
                  </Tooltip>
                )
              }
            />
          </div>

          {/* PROGRESS BARS */}
          <ProgressBar
            label="Сытость"
            current={toad.state?.hunger || 0}
            max={100}
            color={(toad.state?.hunger || 0) < 30 ? "red" : "green"}
            icon={InfoIcons.hunger}
          />

          {growth && (
            <ProgressBar
              label="Рост"
              current={growth.progress}
              max={100}
              color="purple"
              action={{
                label: "Ускорить",
                handler: () => handleAccelerate("growth"),
                timeLeft: growth.timeLeft,
              }}
            />
          )}

          {pregnancy && (
            <ProgressBar
              label="Беременность"
              current={pregnancy.progress}
              max={100}
              color="red"
              action={{
                label: "Ускорить",
                handler: () => handleAccelerate("pregnancy"),
                timeLeft: pregnancy.timeLeft,
              }}
            />
          )}

          {/* ACTIONS */}
          <div className="bg-gray-800/50 rounded-xl p-2 border border-gray-600/50 mt-1 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                playCrunchShort();
                handleFeedToads([toad.id]);
                completeAchivement("feed-one");
              }}
              className="bg-green-600/30 hover:bg-green-600/40 rounded-lg py-2 text-xs flex justify-center gap-2"
            >
              <span>🍎</span> Накормить
            </button>
            <div className="relative">
              <button
                onClick={() => toggleTooltip("scenes")}
                className="bg-blue-600/30 hover:bg-blue-600/40 rounded-lg py-2 text-xs w-full flex justify-center gap-2"
              >
                <span>🏠</span> Переместить
              </button>
              {tooltips["scenes"] && (
                <Tooltip
                  revert
                  title="Куда"
                  isOpen
                  onClose={() => toggleTooltip("scenes")}
                >
                  <button
                    onClick={() => handleMove(null)}
                    className="w-full text-left p-2 hover:bg-gray-600 rounded text-xs"
                  >
                    📦 На склад
                  </button>
                  {ownedScenes
                    .filter((s) => s.id !== currentScene.id)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleMove(s.id)}
                        className="w-full text-left p-2 hover:bg-gray-600 rounded text-xs"
                      >
                        🏠 {s.name}
                      </button>
                    ))}
                </Tooltip>
              )}
            </div>
          </div>

          {/* COLORS */}
          {toad.genes?.colors?.length > 0 && (
            <div className="flex gap-1 mt-2 justify-center">
              {toad.genes.colors.map((c: string, i: number) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border border-white/30"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Navigation Right */}
        <button
          onClick={() => handleNav("next")}
          className="text-gray-400 hover:text-white p-1"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <button
        onClick={onClose}
        className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl mt-4"
      >
        Закрыть
      </button>
    </Modal>
  );
};
