import { useEffect, useState } from "react";
import { COLONY_ROOM_TITLES } from "../../../models/colony";
import { Toad, getRarityConfig } from "../../../models/Toad";
import { useGameState } from "../../../hooks/use-game-state";
import { useNotifications } from "../../../hooks/use-notification";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  MATING_MAX_MINUTES,
  MATING_MIN_MINUTES,
  MAX_ENERGY,
  NEST_MAX_SLOTS,
  NEST_ROOM_TOAD_SLOTS,
  canUpgradeNest,
  getBreedPairBiomassCost,
  getEnergyCost,
  getMatingTimeLeft,
  getNestSlotUpgradeCost,
  getToadEnergy,
} from "../../../utils/gamification-config";
import {
  abortMating,
  checkNestCourtship,
  getNestOccupancy,
  isNestRoomId,
  startNestCourtship,
  upgradeNestSlots,
} from "../../../utils/breeding-manager";
import { placeToadInRoom, releaseToadFromRoom } from "../../../backend/colony";
import { CURRENCY_CONFIG, NEST_ROOM_ID, TYPE_ICONS } from "../../../utils/constants";
import {
  ASTRO_PRICES,
  acceleratePregnancy,
  buyQuarantine,
  getAstroBalance,
  resetBreedCooldown,
} from "../../../utils/astro-shop";
import { getToadDisease } from "../../../utils/disease-manager";
import { completeAchivement } from "../../../backend/achivements-manager";
import { HEX_ROOM_BY_ID } from "../../HexMap/rooms-config";
import { ClickButton } from "../../shared/ClickButton";
import { useToads } from "../../ToadContext";

/**
 * Модалка гнезда (Часть 3.2).
 *
 * Гнездо — комната на пару (2 взрослые жабы). Здесь видно, кто в нём сидит прямо
 * сейчас, а пустой слот открывает список ВСЕХ половозрелых жаб колонии (кроме тех,
 * что в походе) с указанием комнаты, где жаба находится: нажатие переносит её в гнездо.
 *
 * Ухаживание заводит игрок: посадил самца и самку — и нажал «Начать ухаживание».
 * Кнопка активна не всегда: пока пара отдыхает, не хватает биомассы или заняты
 * родильные слоты вольера, под кнопкой висит причина (`checkNestCourtship`).
 * Беременность приходит через 15–30 минут, и из гнезда жабы не уходят сами —
 * их выносит игрок.
 */

/** «12м» / «1ч 05м» — отсчёт ухаживания в гнезде */
const formatWait = (ms: number): string => {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
};

/** «5м 20с» — отдых жабы после спаривания */
const formatCooldown = (ms: number): string => {
  if (ms <= 0) {
    return "готова";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}м ${seconds}с` : `${seconds}с`;
};

const EnergyBar = ({ value }: { value: number }) => (
  <div className="w-full h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-lime-400 to-emerald-500"
      style={{ width: `${Math.min(100, (value / MAX_ENERGY) * 100)}%` }}
    />
  </div>
);

/** Строка жабы в списке свободного слота: имя, редкость, комната и готовность */
const CandidateRow = ({
  toad,
  room,
  onPick,
}: {
  toad: Toad;
  room: string;
  onPick: () => void;
}) => {
  const rarity = getRarityConfig(toad.genes.rarity);
  const energy = getToadEnergy(toad);
  const cost = getEnergyCost(toad);
  const cooldownLeft = (toad.breedCooldownUntil ?? 0) - Date.now();
  const isDown = (toad.hp ?? 1) <= 0;
  const isPregnant = Boolean(toad.pregnancy?.isPregnant);
  const isReady = !isDown && !isPregnant && cooldownLeft <= 0 && energy >= cost;

  const status = isDown
    ? "выбита из строя"
    : isPregnant
    ? "🍼 вынашивает"
    : cooldownLeft > 0
    ? `отдых: ${formatCooldown(cooldownLeft)}`
    : energy < cost
    ? `нужно ⚡${cost}`
    : "готова к паре";

  return (
    <button
      type="button"
      disabled={isDown}
      onClick={onPick}
      className={`w-full text-left rounded-lg p-2 border transition-all ${
        isDown
          ? "opacity-50 cursor-not-allowed border-gray-600/40 bg-color-main"
          : isReady
          ? "border-emerald-500/40 bg-color-main hover:border-emerald-400"
          : "border-gray-600/50 bg-color-main hover:border-emerald-400/50"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`text-xs font-semibold truncate ${rarity.color}`}>
          {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS] ?? "○"} {toad.name}
        </span>
        <span className="text-2xs text-gray-400 shrink-0">
          {toad.genes.rarity.toFixed(1)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-2xs text-lime-300 shrink-0">
          ⚡{Math.round(energy)}
        </span>
        <EnergyBar value={energy} />
      </div>
      <div className="mt-1 text-2xs text-gray-400 truncate">
        {room} · {rarity.label} · {status}
      </div>
    </button>
  );
};

interface NestModalProps {
  /** id гекса-гнезда, из которого открыли модалку: гнёзд в колонии может быть несколько */
  roomId?: string;
}

export default function NestModal({ roomId = NEST_ROOM_ID }: NestModalProps) {
  const { allToads, account } = useToads();
  const { addNotification } = useNotifications();
  const { playOk, playExited } = useSoundEffects();
  const gameState = useGameState();
  // Раз в секунду обновляем обратные отсчёты: ухаживание, отдых, статусы жаб
  const [, setTick] = useState(0);
  /** Открыт ли список жаб для свободного слота */
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const colonyRooms = gameState.colony?.rooms ?? [];
  const scenes = gameState.scenes ?? [];

  /** Жабы, которые физически стоят в этом гнезде: их и показывают слоты */
  const nestToads = allToads.filter(
    (toad) => toad.roomId === roomId && toad.status !== "out"
  );
  /** Взрослые занимают места гнезда… */
  const nestAdults = nestToads.filter((toad) => toad.stage === "adult");
  /** …а головастики, рождённые в гнезде, живут поверх мест, пока их не вынесут */
  const nestChildren = nestToads.filter((toad) => toad.stage !== "adult");

  /**
   * Вольер, к которому относится гнездо: родильные слоты, карантин и апгрейды — свойства
   * вольера, а пара приходит в гнездо из своего дома. Раньше это был «текущий вольер»
   * игрока; теперь берём дом пары в гнезде, а если гнездо пусто — первый вольер колонии.
   */
  const hostScene =
    scenes.find((scene) => scene.id === nestAdults[0]?.scene_id) ??
    scenes[0] ??
    null;

  /** Два места гнезда: занятые жабами и пустые (нажатие на пустое открывает список) */
  const slots = Array.from(
    { length: NEST_ROOM_TOAD_SLOTS },
    (_, index) => nestAdults[index] ?? null
  );
  const hasFreeSlot = nestAdults.length < NEST_ROOM_TOAD_SLOTS;

  /** Статус жабы в гнезде: ухаживает / вынашивает / ждёт пару */
  const toadStatus = (toad: Toad): string => {
    if (toad.mating) {
      const partner = allToads.find((item) => item.id === toad.mating?.partnerId);

      return `🫧 ухаживает: ${formatWait(getMatingTimeLeft(toad))} с ${
        partner?.name ?? "партнёром"
      }`;
    }

    if (toad.pregnancy?.isPregnant) {
      return "🍼 вынашивает потомство — роды придут сами";
    }

    if (toad.stage !== "adult") {
      return "головастик из этого гнезда";
    }

    return "ждёт пару";
  };

  /** Список для пустого слота: ВСЕ половозрелые жабы, кроме похода и тех, кто уже в гнезде */
  const candidates = allToads
    .filter(
      (toad) =>
        toad.stage === "adult" &&
        toad.status !== "out" &&
        !isNestRoomId(toad.roomId)
    )
    .sort((a, b) => b.genes.rarity - a.genes.rarity);

  /** В какой комнате жаба живёт сейчас (для списка жаб) */
  const roomLabelOf = (toad: Toad): string => {
    if (!toad.roomId) {
      const scene = scenes.find((s) => s.id === toad.scene_id);
      return scene?.name ?? "Вольер";
    }

    const baseRoom = HEX_ROOM_BY_ID[toad.roomId];

    if (baseRoom && baseRoom.kind !== "empty") {
      return baseRoom.title;
    }

    const builtRoom = colonyRooms.find((room) => room.id === toad.roomId);

    return builtRoom ? COLONY_ROOM_TITLES[builtRoom.kind] : "Комната колонии";
  };

  /** Название гнезда, из которого открыли модалку (базовое или построенное) */
  const nestRoomTitle = (() => {
    const baseRoom = HEX_ROOM_BY_ID[roomId];

    if (baseRoom && baseRoom.kind !== "empty") {
      return baseRoom.title;
    }

    const builtRoom = colonyRooms.find((room) => room.id === roomId);

    return builtRoom ? COLONY_ROOM_TITLES[builtRoom.kind] : "Гнездо";
  })();

  const occupancy = getNestOccupancy(hostScene?.id ?? null);
  const nestSlotsFull = occupancy.used >= occupancy.limit;
  const pregnant = allToads.filter(
    (toad) =>
      toad.scene_id === (hostScene?.id ?? null) &&
      Boolean(toad.pregnancy?.isPregnant)
  );
  const courting = nestAdults.filter(
    (toad) => toad.sex === "female" && toad.mating
  );
  const biomass = Math.floor(account?.biomass || 0);
  const astro = Math.floor(getAstroBalance());
  const tokens = Math.floor(account?.tokens || 0);
  const canUpgrade = canUpgradeNest(hostScene);
  const nestUpgradeCost = getNestSlotUpgradeCost(hostScene);

  // Пара в гнезде может быть неполной: по ней считаем цену ухаживания и подсказки
  const nestMale = nestAdults.find((toad) => toad.sex === "male") ?? null;
  const nestFemale = nestAdults.find((toad) => toad.sex === "female") ?? null;
  const courtingToad = nestAdults.find((toad) => toad.mating) ?? null;
  const pregnantInNest =
    nestAdults.find((toad) => toad.pregnancy?.isPregnant) ?? null;
  const pairEnergyCost =
    (nestMale ? getEnergyCost(nestMale) : 0) +
    (nestFemale ? getEnergyCost(nestFemale) : 0);
  const pairBiomassCost =
    nestMale && nestFemale ? getBreedPairBiomassCost(nestMale, nestFemale) : 0;
  const enoughBiomass = biomass >= pairBiomassCost;

  /** Пара гнезда для кнопки ухаживания: активна ли кнопка и чего не хватает */
  const courtship = checkNestCourtship(roomId);

  /** Что сейчас происходит в гнезде — подсказка рядом с кнопкой ухаживания */
  const nestHint = ((): string | null => {
    if (courtingToad) {
      const partner = allToads.find(
        (toad) => toad.id === courtingToad.mating?.partnerId
      );
      return `🫧 Ухаживание идёт: ${partner?.name ?? "пара"} — старт беременности через ${formatWait(
        getMatingTimeLeft(courtingToad)
      )}`;
    }

    if (pregnantInNest) {
      return `🍼 ${pregnantInNest.name} вынашивает потомство — роды придут сами`;
    }

    if (nestAdults.length === 0) {
      return "Посадите в гнездо самца и самку — потом жмите «Начать ухаживание».";
    }

    if (!nestMale || !nestFemale) {
      return "В гнезде нужны самец и самка — посадите жабу в свободный слот.";
    }

    return null;
  })();

  /** Посадить жабу из списка в гнездо: пару заводит кнопка, а не посадка */
  const handlePlace = (toad: Toad) => {
    placeToadInRoom(toad.id, roomId);
    playOk();
    setPickerOpen(false);
    // Ухаживание не стартует само: игрок сначала сажает пару, а потом жмёт
    // «Начать ухаживание» в блоке ниже (кнопка объяснит, чего не хватает)
    setTick((t) => t + 1);
  };

  /** Кнопка «Начать ухаживание»: пара в гнезде начинает ждать беременность */
  const handleStartCourtship = () => {
    const result = startNestCourtship(roomId, addNotification);

    // О причине отказа менеджер уже сказал уведомлением, и её же видно под кнопкой
    result.started ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Вынести жабу из гнезда в её вольер (ухаживание при этом прерывается) */
  const handleRelease = (toad: Toad) => {
    const wasCourting = Boolean(toad.mating);

    if (wasCourting) {
      abortMating(toad.id);
    }

    releaseToadFromRoom(toad.id);
    playOk();
    addNotification({
      type: wasCourting ? "warn" : "success",
      content: wasCourting
        ? `${toad.name} в вольере: ухаживание прервано`
        : `${toad.name} вернулась в вольер`,
      timeout: 4000,
    });
    setTick((t) => t + 1);
  };

  /** Сброс отдыха жабы после спаривания (астро-кваксы) */
  const handleResetCooldown = (toad: Toad) => {
    const result = resetBreedCooldown(toad.id);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Прервать ухаживание: жабы перестают ухаживать, но остаются в гнезде */
  const handleAbortMating = (toad: Toad) => {
    const result = abortMating(toad.id);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Кваксы: апгрейд постройки «Гнездо» — больше родильных слотов вольера */
  const handleUpgradeNest = () => {
    const result = upgradeNestSlots(hostScene?.id ?? null);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Астро-кваксы: ускорить роды (Часть 3.7) */
  const handleAccelerate = (toad: Toad) => {
    const result = acceleratePregnancy(toad.id);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Астро-кваксы: карантин вольера (Часть 3.6/3.7) */
  const handleQuarantine = () => {
    const result = buyQuarantine(hostScene?.id ?? null);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    if (result.success && (result.cured || 0) > 0) {
      completeAchivement("quarantine-cure");
    }
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  return (
    <>
      {/* Заголовок */}
      <div className="flex w-full justify-center items-center relative">
        <div className="flex items-center gap-2 pb-4">
          <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
            Гнездо
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Сводка */}
        <div className="flex items-center justify-between text-xs bg-color-main rounded-xl px-3 py-2 border border-gray-500/30">
          <span className="text-emerald-300">
            🪺 Слоты вольера: {occupancy.used}/{occupancy.limit}
          </span>
          <span className="text-cyan-300">
            👥 В гнезде: {nestAdults.length}/{NEST_ROOM_TOAD_SLOTS}
          </span>
          <span className="text-lime-300">🧪 {biomass}</span>
          <span className="text-purple-300">★ {astro}</span>
        </div>

        <p className="text-1xs text-gray-400 text-center leading-snug">
          Посадите в гнездо самца и самку и нажмите «Начать ухаживание»: ухаживание
          занимает {MATING_MIN_MINUTES}–{MATING_MAX_MINUTES} мин, и только потом у
          самки стартует беременность. Из гнезда жабы не уходят — и после ухаживания,
          и после родов их выносит игрок. Головастики, рождённые в гнезде, остаются
          рядом с матерью, даже если гнездо переполнено.
        </p>

        {/* Места гнезда: занятые жабы и пустые слоты */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-purple-500/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-200 font-semibold">
              🪺 Места гнезда
            </span>
            <span className="text-2xs text-gray-400">{nestRoomTitle}</span>
          </div>

          {slots.map((toad, index) =>
            toad ? (
              <div
                key={toad.id}
                className="rounded-lg p-2 bg-black/20 border border-purple-500/30 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold truncate ${
                      getRarityConfig(toad.genes.rarity).color
                    }`}
                  >
                    {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS] ?? "○"}{" "}
                    {toad.name}
                  </span>
                  <span className="text-2xs text-gray-400 shrink-0">
                    {getRarityConfig(toad.genes.rarity).label} ·{" "}
                    {toad.genes.rarity.toFixed(1)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-2xs text-lime-300 shrink-0">
                    ⚡{Math.round(getToadEnergy(toad))}
                  </span>
                  <EnergyBar value={getToadEnergy(toad)} />
                </div>

                <div className="text-2xs text-gray-300 truncate">
                  {toadStatus(toad)}
                </div>

                {getToadDisease(toad) && (
                  <div className="text-2xs text-red-300 truncate">
                    {getToadDisease(toad)?.icon} {getToadDisease(toad)?.name}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <ClickButton
                    onClick={() => handleRelease(toad)}
                    className="px-2 py-1 rounded-md text-2xs bg-color-main border border-gray-500/50 text-gray-200"
                  >
                    {toad.mating ? "Прервать и вынести" : "Вынести в вольер"}
                  </ClickButton>
                  {toad.mating && (
                    <ClickButton
                      onClick={() => handleAbortMating(toad)}
                      className="px-2 py-1 rounded-md text-2xs bg-color-main border border-amber-500/50 text-amber-200"
                    >
                      Только прервать
                    </ClickButton>
                  )}
                  {(toad.breedCooldownUntil ?? 0) > Date.now() && (
                    <ClickButton
                      onClick={() => handleResetCooldown(toad)}
                      className="px-2 py-1 rounded-md text-2xs bg-color-main border border-purple-500/50 text-purple-200"
                    >
                      Сбросить отдых ★{ASTRO_PRICES.resetCooldown}
                    </ClickButton>
                  )}
                </div>
              </div>
            ) : (
              <button
                key={`nest-free-slot-${index}`}
                type="button"
                onClick={() => setPickerOpen((open) => !open)}
                className="w-full rounded-lg p-2 border border-dashed border-emerald-500/50 text-2xs text-emerald-200 hover:border-emerald-400 transition-all"
              >
                ＋ Свободный слот — посадить жабу
              </button>
            )
          )}

          {nestHint && (
            <div className="text-2xs text-amber-200 leading-snug">{nestHint}</div>
          )}
        </div>

        {/* Кнопка ухаживания: пару заводит игрок, а не гнездо само (Часть 3.2) */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-pink-500/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-pink-200 font-semibold">
              ♥ Ухаживание пары
            </span>
            <span className="text-2xs text-gray-400">
              {MATING_MIN_MINUTES}–{MATING_MAX_MINUTES} мин
            </span>
          </div>

          <div className="flex items-center justify-between text-2xs">
            <span className="text-lime-300">⚡ пара: {pairEnergyCost}</span>
            <span
              className={enoughBiomass ? "text-cyan-300" : "text-amber-300"}
            >
              🧪 {pairBiomassCost}
            </span>
            <span
              className={nestSlotsFull ? "text-amber-300" : "text-emerald-300"}
            >
              🪺 слоты: {occupancy.used}/{occupancy.limit}
            </span>
          </div>

          <ClickButton
            disabled={!courtship.ready}
            onClick={handleStartCourtship}
            className={`w-full rounded-lg px-3 py-2 text-xs border transition-all ${
              courtship.ready
                ? "border-pink-500/60 text-pink-100 hover:border-pink-400"
                : "opacity-50 cursor-not-allowed border-gray-600/50 text-gray-400"
            }`}
          >
            ♥ Начать ухаживание
          </ClickButton>

          <div
            className={`text-2xs leading-snug ${
              courtship.ready ? "text-emerald-200" : "text-amber-200"
            }`}
          >
            {courtship.message}
          </div>
        </div>

        {/* Головастики, рождённые в гнезде: переполнение разрешено, их выносит игрок */}
        {nestChildren.length > 0 && (
          <div className="bg-color-main rounded-xl px-3 py-2 border border-amber-500/40 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-200 font-semibold">
                🐸 Головастики в гнезде: {nestChildren.length}
              </span>
              <span className="text-2xs text-gray-400">
                мест: {NEST_ROOM_TOAD_SLOTS}
              </span>
            </div>
            <div className="text-2xs text-gray-400 leading-snug">
              Они родились здесь и переполняют гнездо. Перенесите их в вольер на
              карте колонии — гнездо примет ещё пару.
            </div>
            <div className="flex flex-col gap-1">
              {nestChildren.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  disabled={(child.hp ?? 1) <= 0}
                  onClick={() => handleRelease(child)}
                  className="w-full text-left rounded-lg px-2 py-1 border border-gray-600/50 bg-black/20 text-2xs text-gray-200 hover:border-amber-400/60 transition-all"
                >
                  <span className={getRarityConfig(child.genes.rarity).color}>
                    {child.name}
                  </span>{" "}
                  · {toadStatus(child)} · вынести в вольер
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Список всех половозрелых жаб на свободный слот гнезда */}
        {pickerOpen && hasFreeSlot && (
          <div className="bg-color-main rounded-xl px-3 py-2 border border-emerald-500/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-200 font-semibold">
                Кого позвать в гнездо
              </span>
              <span className="text-2xs text-gray-400">
                {candidates.length} жаб · комната указана у каждой
              </span>
            </div>

            {candidates.length === 0 ? (
              <div className="text-2xs text-gray-400">
                Половозрелых жаб нет: все в походах или уже сидят в гнезде.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[36vh] overflow-y-auto pr-1">
                {candidates.map((toad) => (
                  <CandidateRow
                    key={toad.id}
                    toad={toad}
                    room={roomLabelOf(toad)}
                    onPick={() => handlePlace(toad)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Цена ухаживания: её списывает кнопка «Начать ухаживание», когда пара готова */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-gray-500/30 text-xs flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Энергия пары за ухаживание</span>
            <span className="text-lime-300">⚡ {pairEnergyCost}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Биомасса за пару</span>
            <span
              className={enoughBiomass ? "text-emerald-300" : "text-red-400"}
            >
              🧪 {pairBiomassCost}
            </span>
          </div>
          <div className="text-2xs text-gray-500 leading-snug">
            Списывается один раз — когда гнездо начинает ухаживание. Отдых после
            пары считается у каждой жабы отдельно.
          </div>
        </div>

        {/* Кваксы: расширение гнезда вольера (Часть 3.2) */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-gray-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Родильные слоты вольера</span>
            <span className="text-emerald-300">
              {occupancy.used}/{occupancy.limit}
            </span>
          </div>

          {canUpgrade ? (
            <ClickButton
              disabled={tokens < nestUpgradeCost}
              onClick={handleUpgradeNest}
              className={`w-full rounded-lg px-3 py-2 text-xs border transition-all ${
                tokens < nestUpgradeCost
                  ? "opacity-50 cursor-not-allowed border-gray-600/50 text-gray-400"
                  : "border-emerald-500/50 text-emerald-200 hover:border-emerald-400"
              }`}
            >
              Расширить гнездо: +1 слот · {CURRENCY_CONFIG.tokens.icon}{" "}
              {nestUpgradeCost} · {CURRENCY_CONFIG.tokens.icon} у вас {tokens}
            </ClickButton>
          ) : (
            <div className="text-2xs text-gray-400">
              Гнездо расширено до предела: {NEST_MAX_SLOTS} родильных слотов на
              вольер.
            </div>
          )}

          <div className="text-2xs text-gray-500 leading-snug">
            Слот занимают и ухаживание в гнезде, и беременность: пока все слоты
            вольера заняты, новая пара не заведётся.
          </div>
        </div>

        {/* Разовые ускорения за астро-кваксы (Часть 3.7) */}
        <div className="bg-color-main rounded-xl px-3 py-2 border border-purple-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-200 font-semibold">Астро-кваксы</span>
            <span className="text-purple-300">★ {astro}</span>
          </div>

          {courting.map((toad) => (
            <ClickButton
              key={`courtship-${toad.id}`}
              disabled={astro < ASTRO_PRICES.acceleratePregnancy}
              onClick={() => handleAccelerate(toad)}
              className="w-full rounded-lg px-3 py-2 text-xs border border-purple-500/40 text-purple-200 hover:border-purple-400 disabled:opacity-50"
            >
              Ускорить ухаживание · {toad.name} (★
              {ASTRO_PRICES.acceleratePregnancy})
            </ClickButton>
          ))}

          {pregnant.map((toad) => (
            <ClickButton
              key={`pregnancy-${toad.id}`}
              disabled={astro < ASTRO_PRICES.acceleratePregnancy}
              onClick={() => handleAccelerate(toad)}
              className="w-full rounded-lg px-3 py-2 text-xs border border-green-500/40 text-green-200 hover:border-green-400 disabled:opacity-50"
            >
              Ускорить роды · {toad.name} (★{ASTRO_PRICES.acceleratePregnancy})
            </ClickButton>
          ))}

          <ClickButton
            disabled={astro < ASTRO_PRICES.quarantine}
            onClick={handleQuarantine}
            className="w-full rounded-lg px-3 py-2 text-xs border border-sky-500/40 text-sky-200 hover:border-sky-400 disabled:opacity-50"
          >
            Карантин вольера: лечит всех жаб (★{ASTRO_PRICES.quarantine})
          </ClickButton>
        </div>
      </div>
    </>
  );
}
