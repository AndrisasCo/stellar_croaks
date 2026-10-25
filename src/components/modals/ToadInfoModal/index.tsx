import { useMemo, useState } from "react";
import { TYPE_ICONS } from "../../../utils/constants";
import {
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
import { moveToadToAviary } from "../../../backend/colony";
import { getToadHomeId } from "../../../utils/toad-location";
import { completeAchivement } from "../../../backend/achivements-manager";
import { nameGenerator } from "../../../utils/name-generator";
import { Tooltip } from "../../shared/Tooltip";
import { getGameState } from "../../../backend/localStorage";
import { useNotifications } from "../../../hooks/use-notification";
import { endPregnancy } from "../../../utils/breeding-manager";
import {
  BIOMASS_PER_TOAD_HOUR,
  PRODUCTION_HUNGRY_FACTOR,
  PRODUCTION_MIN_HUNGER,
  UPKEEP_PER_TOAD_HOUR,
  getBiomassPotentialRate,
  getBiomassRate,
  getEnergyCost,
  getPersonalityCooldownMultiplier,
  getProductionFactor,
  getToadEnergy,
  getToadMaxEnergy,
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
  getHospitalRoomIds,
  isToadInHospital,
} from "../../../utils/hospital";
import {
  getEnergyRegenPerHour,
  getToadEnergyRegenPlace,
} from "../../../utils/energy";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../../utils/expedition-manager";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { DiseaseBar } from "../../shared/DiseaseBar";
import { ProgressBar } from "./ProgressBar";
import { StatCard } from "./StatCard";
import { useToadRelatives } from "./useToadRelatives";
import { useToadTimers } from "./useToadTimers";
import { Colors } from "./Colors";
import { useModal } from "../../ModalContext";
import { DissolveConfirm } from "../../shared/DissolveConfirm";
import { DissolveBlockedModal } from "../../shared/DissolveBlockedModal";
import { useDissociator } from "../../../hooks/use-dissociator";
import { ClickButton } from "../../shared/ClickButton";
import { useColony } from "../../../hooks/use-colony";
import {
  getToadDestinationGroups,
  type ToadDestination,
} from "../../HexMap/toad-move-destinations";
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

/** Рост головастика стартует с первого кормления — без него «Ускорить» нельзя. */
const GROWTH_FEED_FIRST_REASON =
  "Сначала покормите головастика: кормление запускает рост.";

export const ToadInfo = () => {
  const {
    selectedToad: toad,
    allToads,
    selectToad,
    handleFeedToads,
    ownedScenes,
    account,
  } = useToads();
  const { playCrunchShort, playBubblesLong, playSuccess, playError } =
    useSoundEffects();
  const { addNotification } = useNotifications();
  const { closeModal } = useModal();
  // Секторы карты и сеть нужны, чтобы меню «Переместить» знало все места,
  // которые принимают жаб, а не только биоподы.
  const { rooms, powerGrid, toadsByRoom, placeToad, releaseToad } = useColony();

  /**
   * Жабы для листания карточки стрелками: вся колония, самые редкие — первыми.
   * Раньше листались только жабы «текущего биопода», но карточку открывают с любого
   * гекса, в том числе из списка чужого биопода.
   */
  const toads = useMemo(
    () => [...allToads].sort((a, b) => b.genes.rarity - a.genes.rarity),
    [allToads],
  );

  // Local State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(toad?.name || "");
  const [tooltips, setTooltips] = useState<Record<string, boolean>>({});
  // Разбор жабы в биомассу (Диссоциатор) — необратимо, подтверждаем отдельно
  const [showDissolve, setShowDissolve] = useState(false);
  /** Диссоциатор не готов: вместо подтверждения показываем окно-подсказку */
  const [showBlockedDissolve, setShowBlockedDissolve] = useState(false);

  // Logic Hooks
  const { relatives, inbreedingRisk } = useToadRelatives(toad, allToads);
  const { age, pregnancy, mating, growth } = useToadTimers(toad);

  // Диссоциатор принимает жаб, только когда его сектор построен и под током
  const { ready: dissociatorReady, built: dissociatorBuilt } = useDissociator();

  /** Жаба в походе (в пути или ждёт разбора добычи): обычные действия с ней запрещены */
  const onExpedition = toad ? isToadBusyOnExpedition(toad) : false;

  /**
   * Куда жабу можно переместить: биоподы и секторы, которые её принимают
   * (Медотсек, КОНТУР, энергосектор, репродуктор). Проверки — те же, что при
   * переносе жабы по карте: места, ток, возраст и занятость в походе.
   */
  const destinationGroups = useMemo(
    () =>
      toad
        ? getToadDestinationGroups({
            toad,
            scenes: ownedScenes,
            rooms,
            toads: allToads,
            toadsByRoom,
            powerGrid,
            onExpedition,
          })
        : [],
    [toad, ownedScenes, rooms, allToads, toadsByRoom, powerGrid, onExpedition],
  );

  if (!toad) return null;

  // Derived Data
  const rarityConfig = getRarityConfig(toad.genes?.rarity || 1);
  const geneticFault = getGeneticFaultConfig(toad.state?.genetic_fault);
  const personality = toad.genes?.personality
    ? personalities[toad.genes.personality as keyof typeof personalities]
    : null;

  /**
   * Кибер-болезнь: на койке Медотсека срок идёт в `HOSPITAL_DISEASE_SPEED` раза
   * быстрее, поэтому прогресс и прогноз выздоровления считаем с учётом койки.
   */
  const colony = getGameState().colony;
  const hospitalIds = getHospitalRoomIds(colony);
  const inHospital = isToadInHospital(toad, hospitalIds);

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
  const maxEnergy = getToadMaxEnergy(toad);
  const energyCost = getEnergyCost(toad);
  const isEnergyFull = energy >= maxEnergy;
  const energyRegen = getEnergyRegenPerHour(toad, colony);
  const energyRegenRate = Math.round(energyRegen * 10) / 10;
  const energyRegenPlace = getToadEnergyRegenPlace(toad, colony);
  const energyRegenPlaceLabel =
    energyRegenPlace === "biopod"
      ? "биоподе"
      : energyRegenPlace === "hospital"
        ? "Медотсеке"
        : null;
  const energyRegenHint = isEnergyFull
    ? "Силы уже полны."
    : energyRegen > 0 && energyRegenPlaceLabel
      ? `Сейчас жаба в ${energyRegenPlaceLabel}: +${energyRegenRate} ⚡ в час.`
      : energyRegenPlace === null
        ? toad.status === "out"
          ? "Сейчас жаба в походе — силы не восстанавливаются."
          : "Сейчас жаба не в биоподе и не в Медотсеке — силы не восстанавливаются."
        : hunger < 1
          ? "Сейчас жаба голодна (сытость 0 %) — силы не восстанавливаются."
          : "Сейчас силы не восстанавливаются.";
  const cooldownLeft = Math.max(0, (toad.breedCooldownUntil ?? 0) - Date.now());
  const isPregnant = Boolean(toad.pregnancy?.isPregnant);
  const isCourting = Boolean(toad.mating);
  const cooldownMult = getPersonalityCooldownMultiplier(
    toad.genes?.personality,
  );
  const breedStatus = isPregnant
    ? "🍼 вынашивает"
    : isCourting
      ? `🫧 ухаживает${mating ? ` ${mating.timeLeft} мин` : ""}`
      : cooldownLeft > 0
        ? `🛏️ отдых ${formatCooldownLeft(cooldownLeft)}`
        : energy >= energyCost
          ? "✅ возможно"
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

  /** Единая причина отказа для действий с жабой в походе */
  const warnExpeditionBusy = () =>
    addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });

  const handleRename = () => {
    if (onExpedition) {
      setIsEditingName(false);
      warnExpeditionBusy();
      return;
    }

    if (editedName.trim() && editedName !== toad.name) {
      updateToadById(toad.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleAccelerate = (type: "growth" | "pregnancy") => {
    if (onExpedition) {
      warnExpeditionBusy();
      return;
    }

    // Рост запускает первое кормление: без него ускорение сделало бы головастика
    // взрослым в обход таймера роста и обучения («сначала накорми»).
    if (type === "growth" && growth?.notStarted) {
      addNotification({
        type: "warn",
        content: GROWTH_FEED_FIRST_REASON,
      });
      return;
    }

    const resource = type === "growth" ? "worms" : "sparkleFlys";
    const resourceName =
      type === "growth" ? "Протеиновых Червей 🪱" : "Сияющих Мушек ✨";

    const resourceAmount = account.storage[resource] || 0;

    if (resourceAmount > 0) {
      updateUserStorage({ [resource]: resourceAmount - 1 });
      if (type === "growth") {
        updateToadById(toad.id, { stage: "adult" });
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
    if (onExpedition) {
      setTooltips({});
      warnExpeditionBusy();
      return;
    }

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

    // Карточка остаётся на той же жабе: после переезда игрок продолжает смотреть её
    // характеристики, а не перелистывается на следующую (раньше это выглядело как
    // «нажала Переместить — открылась другая жаба»).
    setTooltips({});
  };

  /**
   * Перемещение из меню: биопод — переезд с новым домом (`moveToadToAviary`),
   * сектор — посадка на гекс (`placeToadInRoom`). Доступность уже проверил
   * `getToadDestinationGroups` — теми же правилами, что и перенос по карте.
   */
  const handleMoveToDestination = (destination: ToadDestination) => {
    if (onExpedition) {
      setTooltips({});
      warnExpeditionBusy();
      return;
    }

    if (!destination.check.ok) {
      playError();
      addNotification({
        type: "warn",
        content: destination.check.reason ?? "Жабу нельзя переместить сюда.",
      });
      return;
    }

    // Биопод: он становится местом и новым домом жабы
    if (destination.sceneId != null) {
      handleMove(destination.sceneId);
      return;
    }

    if (!destination.roomId) {
      return;
    }

    placeToad(toad.id, destination.roomId);
    setTooltips({});
    playSuccess();
  };

  /**
   * Вернуть жабу домой — в биопод, который она помнит (`homeId`). Дом не бронируется:
   * пока жаба работала в секторе, места там могли закончиться; тогда `releaseToad`
   * отправит её в любой свободный биопод под током.
   */
  const handleSendHome = () => {
    if (onExpedition) {
      warnExpeditionBusy();
      return;
    }

    // Беременная самка остаётся в репродукторе до родов — даже если кнопку вызвали мимо UI
    if (isPregnant) {
      playError();
      addNotification({
        type: "warn",
        content: `${toad.name} вынашивает потомство и останется в репродукторе до родов — ускорьте беременность Сияющей мушкой ✨.`,
      });
      return;
    }

    const result = releaseToad(toad.id);

    if (!result.ok) {
      playError();
      addNotification({
        type: "warn",
        content: "Свободных мест в биоподах нет",
        timeout: 9000,
      });
      return;
    }

    playSuccess();
  };

  /** Разбор жабы в биомассу: жаба исчезает навсегда */
  const handleDissolve = () => {
    setShowDissolve(false);

    // Жаба ещё в команде похода — сначала возвращение и разбор добычи
    if (onExpedition) {
      warnExpeditionBusy();
      return;
    }

    // Без построенного и запитанного сектора жаба в биомассу не уйдёт
    if (!dissociatorReady) {
      setShowBlockedDissolve(true);
      return;
    }

    // Разбор в биомассу — тот же звук пузырей, что и в диссоциаторе
    playBubblesLong();
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

  /** Жаб в инкубаторе коллайдера и в походе разбирать нельзя */
  const incubatingIds = getIncubatingToadIds();
  const incubating = incubatingIds.includes(toad.id);
  const cannotDissolve = onExpedition || !canDissolveToad(toad, incubatingIds);
  const dissolveBlockedReason = onExpedition
    ? EXPEDITION_TOAD_BUSY_REASON
    : incubating
      ? "Жаба находится в инкубаторе — разбор недоступен"
      : null;

  return (
    <>
      <Modal>
        {/* Возврат ровно туда, откуда открыли карточку: ядро, список биопода или карта.
            Это именно закрытие верхней модалки, а не новый экран поверх стека, поэтому
            фильтры, сортировка и скролл предыдущего списка остаются как были.

            Кнопка закреплена сверху: карточка длинная, и «Назад» должна оставаться
            под рукой при прокрутке. Sticky, а не fixed, — чтобы на десктопе кнопка
            не выезжала за пределы карточки и не висела над картой. */}
        <div className="sticky -top-4 z-30 -mx-1 -mt-4 mb-4 flex w-auto items-center border-b border-white/5 bg-slate-950/95 px-10 py-2 backdrop-blur-md md:-top-5 md:-mx-6 md:-mt-5 md:mb-5">
          <ClickButton
            onClick={closeModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/50 bg-amber-500/20 px-4 py-2 text-base font-bold text-amber-100 shadow-lg shadow-amber-950/30 transition-colors duration-300 hover:bg-amber-500/30 hover:text-amber-50"
            title="Вернуться к предыдущему экрану"
          >
            ‹ Назад
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
                className="bg-color-second border border-slate-600 rounded-lg px-2 py-1 text-white w-full"
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
            <h2 className="flex gap-2 font-bold">
              <span className="brand-text text-lg">{toad.name}</span>
              <button
                className="text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  setEditedName(toad.name ?? "");
                  setIsEditingName(true);
                }}
                disabled={onExpedition}
                title={
                  onExpedition
                    ? EXPEDITION_TOAD_BUSY_REASON
                    : "Переименовать жабу"
                }
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
              className={`absolute top-full z-10 bg-color-main border border-cyan-500/40 rounded-xl p-2  shadow-lg`}
            >
              <ToadAvatar toad={toad} size={75} />
            </div>
          )}
          <div className="flex flex-col gap-1 mr-auto text-sm text-slate-300">
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
              {TYPE_ICONS[toad.sex === "male" ? "male" : "female"]}
            </div>
          )}
        </div>

        {onExpedition && (
          <div className="mx-2 mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2">
            <p className="text-xs font-semibold text-amber-100">
              🧭 Жаба в походе
            </p>
            <p className="mt-0.5 text-2xs leading-snug text-amber-200/90">
              {EXPEDITION_TOAD_BUSY_REASON}
            </p>
          </div>
        )}

        <div className="w-full">
          {/* --- MAIN CONTENT COLUMN --- */}
          <div className="flex w-full flex-col px-2">
            {/* STATS GRID */}
            <div className="grid grid-cols-2 gap-2 mb-3 ">
              <StatCard
                icon={InfoIcons.rarity}
                label="Качество"
                value={`${rarityConfig.label} (${toad.genes?.rarity?.toFixed(
                  1,
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
                      <p className="text-sm text-slate-200">
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
                value={`${Math.round(energy)} / ${maxEnergy}`}
                colorClass={
                  energy >= energyCost ? "text-lime-400" : "text-red-400"
                }
                onClick={() => toggleTooltip("energy")}
                tooltip={
                  tooltips["energy"] && (
                    <Tooltip
                      title="Силы"
                      isOpen
                      onClose={() => toggleTooltip("energy")}
                      className="left-0 w-[200%]"
                    >
                      <p className="text-sm text-slate-200">
                        Силы ⚡ — личный запас жабы, максимум {maxEnergy}{" "}
                        (растёт с качеством). Спаривание в «Репродукторе» стоит{" "}
                        {energyCost} ⚡, а поход за Периметр — от{" "}
                        {EXPEDITION_ENERGY_BASE} ⚡ за ближний сектор и на{" "}
                        {EXPEDITION_ENERGY_PER_DEPTH} ⚡ дороже за каждый
                        следующий (силы тратит каждая жаба команды). Биомасса на
                        снаряжение платится со склада и к силам отношения не
                        имеет. Силы восстанавливаются только в биоподе или
                        Медотсеке, при сытости выше 0; чем выше аппетит, тем
                        быстрее. {energyRegenHint} Снять отдых после спаривания
                        можно за 1 Астро-квакс.
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
                      <p className="text-sm text-slate-200">
                        Сейчас жаба {hpStatusLabel}. Походы за Периметр ранят
                        жаб: провалы событий снимают HP. Дома здоровье капает
                        очень медленно (+{HP_REGEN_PER_HOUR} в час), на койке
                        «Медотсека» оно идёт +{HOSPITAL_HP_REGEN_PER_HOUR} в
                        час, а срок болезни там короче в{" "}
                        {HOSPITAL_DISEASE_SPEED} раза. Мгновенно поднять жабу
                        можно за {getHealCost(toad) || 0} Кваксов — это самый
                        дорогой способ. Раненая жаба даёт вдвое меньше биомассы,
                        выбитая — не работает совсем и не может идти в поход.
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
                    ? "text-slate-400"
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
                      <p className="text-sm text-slate-200">
                        Биомасса 🧪 — топливо колонии: корм жаб, снаряжение
                        походов, содержание биоподов. Взрослая жаба даёт базовые{" "}
                        {BIOMASS_PER_TOAD_HOUR} 🧪/ч, а её Качество, вес,
                        характер и кибер-болезнь меняют это число.
                      </p>
                      <div className="mt-2 space-y-0.5 text-xs text-slate-300">
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
                              netBiomass >= 0
                                ? "text-emerald-300"
                                : "text-red-300"
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
                      <p className="mt-2 text-xs text-slate-300">
                        {hunger <= PRODUCTION_MIN_HUNGER
                          ? `Жаба голодает (сытость ≤ ${PRODUCTION_MIN_HUNGER} %) и работает на ${Math.round(
                              PRODUCTION_HUNGRY_FACTOR * 100,
                            )} %: покормите или поставьте автокормушку в секторе.`
                          : `Сытость умножает выработку на ${productionFactor.toFixed(
                              2,
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
                colorClass={
                  inbreedingRisk ? "text-yellow-400" : "text-blue-400"
                }
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
                            className={`p-1 text-xs border-b border-slate-700  ${
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
                      <p className="text-xs italic text-slate-300">
                        {personality.description}
                      </p>
                      {/* Влияние характера на гены и отдых */}
                      <div className="mt-2 text-xs text-slate-300 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Аппетит</span>
                          <span className="text-white">
                            ×{personality.hungerRate}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Плодовитость</span>
                          <span className="text-white">
                            ×{personality.fertility}
                          </span>
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

            {/* Кибер-болезнь: полоса выздоровления и точный остаток срока */}
            <DiseaseBar toad={toad} inHospital={inHospital} className="mb-3" />

            {growth && (
              <>
                <ProgressBar
                  label="Рост"
                  current={growth.progress}
                  max={100}
                  color="purple"
                  valueLabel={growth.hungry ? "нужен корм" : undefined}
                  action={{
                    label: "Ускорить",
                    handler: () => handleAccelerate("growth"),
                    timeLeft: growth.timeLeft,
                    disabled: onExpedition || growth.notStarted,
                    disabledReason: onExpedition
                      ? EXPEDITION_TOAD_BUSY_REASON
                      : growth.notStarted
                        ? GROWTH_FEED_FIRST_REASON
                        : undefined,
                  }}
                />
                {growth.hungry && (
                  <p className="-mt-2 mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-2xs leading-snug text-amber-200">
                    🍽️ Голодный головастик не растёт. Покормите его, чтобы
                    запустить рост.
                  </p>
                )}
              </>
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
                  disabled: onExpedition,
                  disabledReason: onExpedition
                    ? EXPEDITION_TOAD_BUSY_REASON
                    : undefined,
                }}
              />
            )}

            {/* ACTIONS */}
            <div className="bg-color-main rounded-xl p-2 border border-slate-600/50 mt-1 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (onExpedition) {
                    warnExpeditionBusy();
                    return;
                  }

                  playCrunchShort();
                  handleFeedToads([toad.id]);
                  completeAchivement("feed-one");
                }}
                disabled={onExpedition}
                title={onExpedition ? EXPEDITION_TOAD_BUSY_REASON : undefined}
                className="bg-green-600/30 hover:bg-green-600/40 rounded-lg py-2 text-xs flex justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-600/30"
              >
                <span>🍎</span> Накормить
              </button>
              <div className="relative">
                <button
                  onClick={() => toggleTooltip("scenes")}
                  disabled={onExpedition}
                  title={onExpedition ? EXPEDITION_TOAD_BUSY_REASON : undefined}
                  className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 py-2 text-xs text-cyan-100 transition-colors hover:bg-cyan-500/25 w-full flex justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cyan-500/15"
                >
                  <span>🏠</span> Переместить
                </button>
                {tooltips["scenes"] && (
                  <Tooltip
                    revert
                    title="Куда"
                    isOpen
                    onClose={() => toggleTooltip("scenes")}
                    className="right-0 w-[min(18rem,calc(100vw-4rem))]"
                  >
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {destinationGroups.map((group) =>
                        group.destinations.length === 0 ? null : (
                          <div key={group.kind}>
                            <p className="px-2 pb-1 text-3xs font-semibold uppercase tracking-wide text-slate-400">
                              {group.icon} {group.label}
                            </p>
                            <div className="space-y-0.5">
                              {group.destinations.map((destination) => (
                                <button
                                  key={destination.key}
                                  onClick={() =>
                                    handleMoveToDestination(destination)
                                  }
                                  disabled={!destination.check.ok}
                                  title={
                                    destination.check.ok
                                      ? `Переместить в «${destination.name}»`
                                      : destination.check.reason
                                  }
                                  className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                                    destination.check.ok
                                      ? "hover:bg-slate-600"
                                      : "cursor-not-allowed opacity-50"
                                  }`}
                                >
                                  <span className="block truncate text-slate-100">
                                    {destination.icon} {destination.name}
                                  </span>
                                  <span
                                    className={`block truncate text-3xs ${
                                      destination.check.ok
                                        ? "text-slate-400"
                                        : "text-amber-300"
                                    }`}
                                  >
                                    {destination.check.ok
                                      ? destination.hint
                                      : destination.check.reason}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ),
                      )}

                      {destinationGroups.every(
                        (group) => group.destinations.length === 0,
                      ) && (
                        <p className="px-2 py-1 text-2xs text-slate-400">
                          Нет доступных мест для переноса.
                        </p>
                      )}
                    </div>
                  </Tooltip>
                )}
              </div>

              {/* Быстрый возврат домой: жаба в секторе колонии дома не занимает, но помнит
                его (`homeId`) — одна кнопка, чтобы вернуть её в свой биопод (с проверкой места) */}
              {typeof toad.scene_id === "string" && (
                <button
                  onClick={handleSendHome}
                  disabled={onExpedition || isPregnant}
                  title={
                    isPregnant
                      ? "Жаба вынашивает потомство и останется в репродукторе до родов — ускорьте беременность Сияющей мушкой ✨."
                      : onExpedition
                        ? EXPEDITION_TOAD_BUSY_REASON
                        : toadScene
                          ? `Вернуть жабу в «${toadScene.name}»`
                          : "Вернуть жабу в её биопод"
                  }
                  className="col-span-2 bg-cyan-600/30 hover:bg-cyan-600/40 rounded-lg py-2 text-xs flex justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cyan-600/30"
                >
                  <span>🏠</span> Домой
                </button>
              )}

              {/* Быстрый разбор жабы в биомассу (Диссоциатор) */}
              <button
                onClick={() =>
                  dissociatorReady
                    ? setShowDissolve(true)
                    : setShowBlockedDissolve(true)
                }
                disabled={cannotDissolve}
                title={
                  dissolveBlockedReason ??
                  "Переработать жабу в биомассу навсегда"
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

      {/* Диссоциатор ещё не готов: окно-подсказка вместо подтверждения разбора */}
      {showBlockedDissolve && (
        <DissolveBlockedModal
          unpowered={dissociatorBuilt && !dissociatorReady}
          onClose={() => setShowBlockedDissolve(false)}
        />
      )}
    </>
  );
};
