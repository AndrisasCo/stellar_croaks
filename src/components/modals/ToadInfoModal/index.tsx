import { useMemo, useState } from "react";
import { TYPE_ICONS } from "../../../utils/constants";
import {
  getPersonalityMultipliers,
  getRarityConfig,
  personalities,
  getPersonalityLabel,
  getGeneticFaultConfig,
  getToadTypeLabel,
} from "../../../models/Toad";
import { useToads } from "../../ToadContext";
import { InfoIcons } from "../../../assets/icons";
import Modal from "../../shared/Header";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { updateToadById, updateUserStorage } from "../../../backend";
import { moveToadToAviary, sendToadHome } from "../../../backend/colony";
import { getToadHomeId } from "../../../utils/toad-location";
import { completeAchivement } from "../../../backend/achivements-manager";
import { nameGenerator } from "../../../utils/name-generator";
import { Tooltip } from "../../shared/Tooltip";
import { getGameState } from "../../../backend/localStorage";
import { useNotifications } from "../../../hooks/use-notification";
import { endPregnancy } from "../../../utils/breeding-manager";
import {
  BIOMASS_PER_TOAD_HOUR,
  ENERGY_REGEN_PER_HOUR,
  MAX_ENERGY,
  PRODUCTION_HUNGRY_FACTOR,
  PRODUCTION_MIN_HUNGER,
  UPKEEP_PER_TOAD_HOUR,
  getBiomassPotentialRate,
  getBiomassRate,
  getEnergyCost,
  getPersonalityCooldownMultiplier,
  getProductionFactor,
  getToadEnergy,
} from "../../../utils/gamification-config";
import {
  EXPEDITION_ENERGY_BASE,
  EXPEDITION_ENERGY_PER_DEPTH,
  getToadHp,
  getToadMaxHp,
  getToadHpRatio,
  getToadHpStatusLabel,
  getHealCost,
  HP_REGEN_PER_HOUR,
} from "../../../utils/expedition-config";
import {
  HOSPITAL_DISEASE_SPEED,
  HOSPITAL_HP_REGEN_PER_HOUR,
} from "../../../utils/hospital";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { ProgressBar } from "./ProgressBar";
import { StatCard } from "./StatCard";
import { useToadRelatives } from "./useToadRelatives";
import { useToadTimers } from "./useToadTimers";
import { Colors } from "./Colors";
import { useModal } from "../../ModalContext";
import { DissolveConfirm } from "../../shared/DissolveConfirm";
import { ClickButton } from "../../shared/ClickButton";
import ToadListModal from "../ToadListModal";
import {
  canDissolveToad,
  dissolveToads,
  getDissolveYield,
  getIncubatingToadIds,
} from "../../../utils/dissolve-manager";

/** Отдых после спаривания: «8м 20с» / «готова» */
const formatCooldownLeft = (ms: number): string => {
  if (ms <= 0) {
    return "готова";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}м ${seconds}с` : `${seconds}с`;
};

export const ToadInfo = () => {
  const {
    selectedToad: toad,
    allToads,
    selectToad,
    handleFeedToads,
    ownedScenes,
    account,
  } = useToads();
  const { playCrunchShort, playCrunch, playOk, playBeep } = useSoundEffects();
  const { addNotification } = useNotifications();
  const { closeModal, openModal } = useModal();

  /**
   * Жабы для листания карточки стрелками: вся колония, самые редкие — первыми.
   * Раньше листались только жабы «текущего биопода», но карточку открывают с любого
   * гекса, в том числе из списка чужого биопода.
   */
  const toads = useMemo(
    () => [...allToads].sort((a, b) => b.genes.rarity - a.genes.rarity),
    [allToads]
  );

  // Local State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(toad?.name || "");
  const [tooltips, setTooltips] = useState<Record<string, boolean>>({});
  // Разбор жабы в биомассу (Диссоциатор) — необратимо, подтверждаем отдельно
  const [showDissolve, setShowDissolve] = useState(false);

  // Logic Hooks
  const { relatives, inbreedingRisk } = useToadRelatives(toad, allToads);
  const { age, pregnancy, mating, growth } = useToadTimers(toad);

  if (!toad) return null;

  // Derived Data
  const rarityConfig = getRarityConfig(toad.genes?.rarity || 1);
  const geneticFault = getGeneticFaultConfig(toad.state?.genetic_fault);
  const personality = toad.genes?.personality
    ? personalities[toad.genes.personality]
    : null;

  /**
   * Дом жабы — её биопод (`homeId`): карточку открывают и с карты, и из списка другого
   * биопода, поэтому идём в дом именно этой жабы, а не туда, откуда открыли. Жаба в секторе
   * колонии дома не занимает, но помнит его — по `homeId` видно, откуда она вышла.
   */
  const toadScene =
    ownedScenes.find((scene) => scene.id === getToadHomeId(toad)) ?? null;

  // Выработка биомассы (Часть 3.6): сколько жаба даёт за час и насколько её режет голод
  const hunger = toad.state?.hunger ?? 0;
  const biomassRate = getBiomassRate(toad);
  const biomassPotential = getBiomassPotentialRate(toad);
  const productionFactor = getProductionFactor(hunger);
  /** Чистая прибыль за час: выработка минус содержание (`UPKEEP_PER_TOAD_HOUR`) */
  const netBiomass = biomassRate - UPKEEP_PER_TOAD_HOUR;

  // Ручное размножение (Репродуктор): силы жабы, отдых и готовность (Часть 3.2)
  const energy = getToadEnergy(toad);
  const energyCost = getEnergyCost(toad);
  const cooldownLeft = Math.max(0, (toad.breedCooldownUntil ?? 0) - Date.now());
  const isPregnant = Boolean(toad.pregnancy?.isPregnant);
  const isCourting = Boolean(toad.mating);
  const cooldownMult = getPersonalityCooldownMultiplier(
    toad.genes?.personality
  );
  const breedStatus = isPregnant
    ? "🍼 вынашивает"
    : isCourting
    ? `🫧 ухаживает${mating ? ` ${mating.timeLeft} мин` : ""}`
    : cooldownLeft > 0
    ? `🛏️ отдых ${formatCooldownLeft(cooldownLeft)}`
    : energy >= energyCost
    ? "✅ готова"
    : `нужно ⚡${energyCost}`;

  // Разведка (Часть 5): HP жабы, состояние и стоимость лечения
  const hpValue = Math.round(getToadHp(toad));
  const hpMax = getToadMaxHp(toad);
  const hpRatio = getToadHpRatio(toad);
  const hpStatusLabel = getToadHpStatusLabel(toad);
  const hpIcon = hpRatio <= 0 ? "💀" : hpRatio < 0.7 ? "🩹" : "❤️";
  const hpColor =
    hpRatio >= 0.7
      ? "text-green-400"
      : hpRatio > 0
      ? "text-amber-400"
      : "text-red-400";

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

  /**
   * Переселение жабы в другой биопод: он становится её местом и новым домом
   * (`scene_id` и `homeId`), а сектор колонии освобождается — физически жаба идёт в биопод.
   * Место проверяет сам биопод (`moveToadToAviary`): в полный жаба не влезет.
   */
  const handleMove = (sceneId: number) => {
    const result = moveToadToAviary(toad.id, sceneId);

    if (!result.ok) {
      addNotification({
        type: "warn",
        content:
          result.reason === "no-space"
            ? `В биоподе «${result.scene?.name}» нет свободных мест!`
            : "Биопод не найден — возможно, его снесли.",
      });
      return;
    }

    handleNav("next");
  };

  /**
   * Вернуть жабу домой — в биопод, который она помнит (`homeId`). Дом не бронируется:
   * пока жаба работала в секторе, места там могли закончиться — тогда она остаётся на месте.
   */
  const handleSendHome = () => {
    const result = sendToadHome(toad.id);

    if (!result.ok) {
      playBeep();
      addNotification({
        type: "warn",
        content:
          result.reason === "no-space"
            ? `${toad.name}: в биоподе «${result.scene?.name}» нет места — постройте биопод или выберите другой («🏠 Переместить»).`
            : `${toad.name}: биопод, в котором она жила, не найден — выберите другой («🏠 Переместить»).`,
        timeout: 9000,
      });
      return;
    }

    playOk();
    addNotification({
      type: "success",
      content: `${toad.name} вернулась в биопод «${result.scene.name}» 🏠`,
      timeout: 4000,
    });
  };

  /** Разбор жабы в биомассу: жаба исчезает навсегда */
  const handleDissolve = () => {
    setShowDissolve(false);
    playCrunch();
    const result = dissolveToads([toad.id]);

    if (!result.success) {
      addNotification({ type: "warn", content: result.message });
      return;
    }

    addNotification({ type: "success", content: result.message });

    // Переходим к следующей жабе этого биопода, чтобы карточка осталась полезной
    const nextToad = toads.find((item) => item.id !== toad.id);

    if (nextToad) {
      selectToad(nextToad.id);
    } else {
      closeModal();
    }
  };

  /** Жаб в инкубаторе коллайдера разбирать нельзя */
  const cannotDissolve = !canDissolveToad(toad, getIncubatingToadIds());

  return (
    <>
      <Modal>
      {/* Возврат к списку жаб биопода: карточка — это «глубже» по клику из списка/с гекса */}
      <div className="flex w-full items-center pb-1 px-10">
        <ClickButton
          onClick={() =>
            openModal(() => <ToadListModal sceneId={getToadHomeId(toad)} />)
          }
          className="flex items-center gap-1 rounded-md bg-color-second px-2 py-1 text-2xs font-medium text-gray-200 transition-colors duration-300 hover:text-cyan-200"
          title={
            toadScene
              ? `Открыть биопод «${toadScene.name}» со списком жаб`
              : "Открыть список жаб биопода"
          }
        >
          ‹ Биопод{toadScene ? `: ${toadScene.name}` : ""}
        </ClickButton>
      </div>

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
              className="bg-color-second border border-gray-600 rounded-lg px-2 py-1 text-white w-full"
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
              className="text-gray-300"
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
      <div className="flex gap-4 items-start mb-4 px-10 relative">
        <ToadAvatar
          toad={toad}
          size={20}
          onClick={() => toggleTooltip("avatar")}
        />

        {tooltips["avatar"] && (
          <div
            onClick={() => toggleTooltip("avatar")}
            className={`absolute top-full z-10 bg-color-main border border-purple-500/50 rounded-xl p-2  shadow-lg`}
          >
            <ToadAvatar toad={toad} size={75} />
          </div>
        )}
        <div className="flex flex-col gap-1 mr-auto text-sm text-gray-300">
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
          className="text-gray-300 hover:text-white p-1"
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
                    <p className="text-sm text-gray-200">
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
            <StatCard
              icon={<span>⚡</span>}
              label="Силы"
              value={`${Math.round(energy)} / ${MAX_ENERGY}`}
              colorClass={energy >= energyCost ? "text-lime-400" : "text-red-400"}
              onClick={() => toggleTooltip("energy")}
              tooltip={
                tooltips["energy"] && (
                  <Tooltip
                    title="Силы"
                    isOpen
                    onClose={() => toggleTooltip("energy")}
                    className="right-0 w-[200%]"
                  >
                    <p className="text-sm text-gray-200">
                      Силы ⚡ — личный запас жабы, максимум {MAX_ENERGY}.
                      Спаривание в «Репродукторе» стоит {energyCost} ⚡, а поход за
                      Периметр — от {EXPEDITION_ENERGY_BASE} ⚡ за ближний сектор и
                      на {EXPEDITION_ENERGY_PER_DEPTH} ⚡ дороже за каждый
                      следующий (силы тратит каждая жаба команды). Биомасса на
                      снаряжение платится со склада и к силам отношения не имеет.
                      Восстанавливаются силы сами: +{ENERGY_REGEN_PER_HOUR} в час.
                      Снять отдых после спаривания можно за 1 Астро-квакс.
                    </p>
                  </Tooltip>
                )
              }
            />
            <StatCard
              icon={<span>{hpIcon}</span>}
              label="Здоровье"
              value={`${hpValue} / ${hpMax}`}
              colorClass={hpColor}
              onClick={() => toggleTooltip("hp")}
              tooltip={
                tooltips["hp"] && (
                  <Tooltip
                    title="Здоровье и походы"
                    isOpen
                    onClose={() => toggleTooltip("hp")}
                    className="right-0 w-[200%]"
                  >
                    <p className="text-sm text-gray-200">
                      Сейчас жаба {hpStatusLabel}. Походы за Периметр ранят жаб:
                      провалы событий снимают HP. Дома здоровье капает очень
                      медленно (+{HP_REGEN_PER_HOUR} в час), на койке «Лазарета»
                      оно идёт +{HOSPITAL_HP_REGEN_PER_HOUR} в час, а срок
                      болезни там короче в {HOSPITAL_DISEASE_SPEED} раза.
                      Мгновенно поднять жабу можно за{" "}
                      {getHealCost(toad) || 0} Кваксов — это самый дорогой
                      способ. Раненая жаба даёт вдвое
                      меньше биомассы, выбитая — не работает совсем и не может
                      идти в поход.
                    </p>
                  </Tooltip>
                )
              }
            />
            <StatCard
              icon={<span>🛏️</span>}
              label="Разведение"
              value={breedStatus}
              colorClass={
                isPregnant || isCourting || cooldownLeft > 0
                  ? "text-amber-400"
                  : energy >= energyCost
                  ? "text-green-400"
                  : "text-red-400"
              }
            />
            {/* Выработка биомассы: голод режет её до трети, содержание съедает часть дохода */}
            <StatCard
              icon={<span>🧪</span>}
              label="Биомасса"
              value={
                toad.stage === "adult"
                  ? `${biomassRate.toFixed(1)} 🧪/ч`
                  : "ещё не взрослая"
              }
              colorClass={
                toad.stage !== "adult"
                  ? "text-gray-400"
                  : productionFactor >= 1
                  ? "text-emerald-400"
                  : "text-orange-400"
              }
              onClick={() => toggleTooltip("biomass")}
              tooltip={
                tooltips["biomass"] && (
                  <Tooltip
                    title="Выработка биомассы"
                    isOpen
                    onClose={() => toggleTooltip("biomass")}
                    className="right-0 w-[200%]"
                  >
                    <p className="text-sm text-gray-200">
                      Биомасса 🧪 — топливо колонии: корм жаб, снаряжение
                      походов, содержание биоподов. Взрослая жаба даёт базовые{" "}
                      {BIOMASS_PER_TOAD_HOUR} 🧪/ч, а её редкость, вес, характер
                      и кибер-болезнь меняют это число.
                    </p>
                    <div className="mt-2 space-y-0.5 text-xs text-gray-300">
                      <div className="flex justify-between">
                        <span>Сейчас (сытость {Math.round(hunger)} %)</span>
                        <span className="text-white">
                          {biomassRate.toFixed(2)} 🧪/ч
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Содержание жабы</span>
                        <span className="text-white">
                          −{UPKEEP_PER_TOAD_HOUR.toFixed(2)} 🧪/ч
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Чистыми в час</span>
                        <span
                          className={
                            netBiomass >= 0 ? "text-emerald-300" : "text-red-300"
                          }
                        >
                          {netBiomass.toFixed(2)} 🧪/ч
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Потенциал сытой и здоровой</span>
                        <span className="text-white">
                          {biomassPotential.toFixed(2)} 🧪/ч
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-300">
                      {hunger <= PRODUCTION_MIN_HUNGER
                        ? `Жаба голодает (сытость ≤ ${PRODUCTION_MIN_HUNGER} %) и работает на ${Math.round(
                            PRODUCTION_HUNGRY_FACTOR * 100
                          )} %: покормите или поставьте автокормушку в секторе.`
                        : `Сытость умножает выработку на ${productionFactor.toFixed(
                            2
                          )} — кормить всегда выгоднее, чем морить.`}
                    </p>
                  </Tooltip>
                )
              }
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
                    <p className="text-xs italic text-gray-300">
                      {personality.description}
                    </p>
                    {/* Влияние характера на гены и отдых */}
                    <div className="mt-2 text-xs text-gray-300 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Аппетит</span>
                        <span className="text-white">×{personality.hungerRate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Плодовитость</span>
                        <span className="text-white">×{personality.fertility}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Вес</span>
                        <span className="text-white">
                          ×{personality.weightMultiplier}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Скорость</span>
                        <span className="text-white">
                          ×{personality.speedMultiplier}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Отдых после спаривания</span>
                        <span className="text-white">×{cooldownMult}</span>
                      </div>
                    </div>
                  </Tooltip>
                )
              }
            />
          </div>

          {/* PROGRESS BARS */}
          {/* Сытость: подписана цифрой — голод режет выработку биомассы (см. карточку «Биомасса») */}
          <ProgressBar
            label="Сытость"
            current={hunger}
            max={100}
            color={hunger <= PRODUCTION_MIN_HUNGER ? "red" : "green"}
            valueLabel={`${Math.round(hunger)} %`}
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

          {mating && (
            <ProgressBar
              label="Ухаживание"
              current={mating.progress}
              max={100}
              color="pink"
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
          <div className="bg-color-main rounded-xl p-2 border border-gray-600/50 mt-1 grid grid-cols-2 gap-2">
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
                  {/* Склада жаб больше нет: у каждой жабы есть биопод, и он — её дом
                      (`homeId`): жаба в секторе колонии дома не занимает, но помнит его */}
                  {ownedScenes
                    .filter((s) => s.id !== getToadHomeId(toad))
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

            {/* Быстрый возврат домой: жаба в секторе колонии дома не занимает, но помнит
                его (`homeId`) — одна кнопка, чтобы вернуть её в свой биопод (с проверкой места) */}
            {toad.roomId && (
              <button
                onClick={handleSendHome}
                title={
                  toadScene
                    ? `Вернуть жабу в «${toadScene.name}»`
                    : "Вернуть жабу в её биопод"
                }
                className="col-span-2 bg-cyan-600/30 hover:bg-cyan-600/40 rounded-lg py-2 text-xs flex justify-center gap-2"
              >
                <span>🏠</span> Домой
              </button>
            )}

            {/* Быстрый разбор жабы в биомассу (Диссоциатор) */}
            <button
              onClick={() => setShowDissolve(true)}
              disabled={cannotDissolve}
              title={
                cannotDissolve
                  ? "Жаба находится в инкубаторе — разбор недоступен"
                  : "Переработать жабу в биомассу навсегда"
              }
              className="col-span-2 bg-amber-600/30 hover:bg-amber-600/40 rounded-lg py-2 text-xs flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>♻️</span> Разобрать на биомассу
              <span className="text-amber-300 font-semibold">
                +{getDissolveYield(toad)} 🧪
              </span>
            </button>
          </div>

          <Colors toad={toad} />
        </div>

        {/* Navigation Right */}
        <button
          onClick={() => handleNav("next")}
          className="text-gray-300 hover:text-white p-1"
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
      </Modal>

      {/* Подтверждение: жаба уйдёт в биомассу навсегда */}
      {showDissolve && (
        <DissolveConfirm
          toads={[toad]}
          onCancel={() => setShowDissolve(false)}
          onConfirm={handleDissolve}
        />
      )}
    </>
  );
};
