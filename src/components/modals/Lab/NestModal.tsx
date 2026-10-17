import { useEffect, useMemo, useState } from "react";
import { EMPTY_COLONY } from "../../../models/colony";
import { Toad, getRarityConfig } from "../../../models/Toad";
import { useGameState } from "../../../hooks/use-game-state";
import { useNotifications } from "../../../hooks/use-notification";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  MATING_MAX_MINUTES,
  MATING_MIN_MINUTES,
  MAX_ENERGY,
  NEST_ROOM_TOAD_SLOTS,
  getBreedPairBiomassCost,
  getEnergyCost,
  getMatingTimeLeft,
  getToadEnergy,
} from "../../../utils/gamification-config";
import {
  NEST_SLOT_SEXES,
  abortMating,
  checkNestCourtship,
  getNestSlotCandidates,
  getNestSlotLabel,
  getNestSlotRejectReason,
  getNestSlotSex,
  startNestCourtship,
} from "../../../utils/breeding-manager";
import { placeToadInRoom, sendToadHome } from "../../../backend/colony";
import {
  getToadHomeId,
  isToadFromEnclosure,
} from "../../../utils/toad-location";
import {
  CURRENCY_CONFIG,
  NEST_ROOM_ID,
  TYPE_ICONS,
} from "../../../utils/constants";
import {
  ASTRO_PRICES,
  acceleratePregnancy,
  getAstroBalance,
  resetBreedCooldown,
} from "../../../utils/astro-shop";
import { getToadDisease } from "../../../utils/disease-manager";
import { completeAchivement } from "../../../backend/achivements-manager";
import { resolveColonyRooms } from "../../HexMap/colony-build";
import { ClickButton } from "../../shared/ClickButton";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
import { ToadPicker } from "../../shared/ToadPicker";
import { RoomConfig } from "../../HexMap/rooms-config";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "../RoomDataTab";
import { useToads } from "../../ToadContext";
import {
  TOAD_PICKER_REJECTED_GROUP,
  getToadSexIcon,
} from "../../../utils/toad-picker";
import { ProgressBar } from "../ToadInfoModal/ProgressBar";

/**
 * Модалка репродуктора (Часть 3.2).
 *
 * Репродуктор — сектор на пару, и у пары места разные: первый слот занимает самка,
 * второй — самец. Слот — выпадающий список жаб **своего пола** (`shared/ToadPicker`):
 * тап по строке слота открывает всех, кого можно позвать, — взрослых, не в походе,
 * не выбитых, не больных и без беременности (`breeding-manager.ts` → `getNestSlotCandidates`).
 * У жабы в списке видно её краткую сводку (пол, стадия, силы ⚡, сытость 🍽, редкость)
 * и где она живёт сейчас, а жаб, которых слот не берёт, можно посмотреть с причиной отказа
 * (переключатель «Не подходят») — чтобы не искать ответ, почему жабы нет в списке.
 *
 * Ухаживание заводит игрок: посадил самку в первый слот, самца во второй — и нажал
 * «Начать ухаживание». Кнопка активна не всегда: пока пара отдыхает, не хватает
 * биомассы или заняты родильные слоты биопода, под кнопкой висит причина
 * (`checkNestCourtship`). Беременность приходит через 15–30 минут, и из репродуктора
 * жабы не уходят сами — их выносит игрок.
 *
 * Табы — общие для всех секторов (`shared/ModalTabs`): пары репродуктора первыми, «Данные
 * сектора» (`modals/RoomDataTab.tsx`) — последним. Репродуктор открывают и из лаборатории
 * (тогда гекса нет и таб один), и с гекса карты — тогда у модалки есть данные сектора.
 */

/** «12м» / «1ч 05м» — отсчёт ухаживания в репродукторе */
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

/**
 * Готовность жабы к паре — строка под именем в списке слота: по ней видно, кого звать
 * первым (готова), а кого слот возьмёт только после отдыха или кормления.
 */
const readinessNote = (toad: Toad): string => {
  const cooldownLeft = (toad.breedCooldownUntil ?? 0) - Date.now();
  const energy = getToadEnergy(toad);
  const cost = getEnergyCost(toad);

  if (cooldownLeft > 0) {
    return `отдых: ${formatCooldown(cooldownLeft)}`;
  }

  if (energy < cost) {
    return `нужно ⚡${cost}`;
  }

  return "готова к паре";
};

/** Что слот ищет — подсказка вверху раскрытого списка жаб */
const slotHint = (slotIndex: number): string => {
  const sex = getNestSlotSex(slotIndex);
  const who = sex === "female" ? "самку" : "самца";

  return `${getNestSlotLabel(
    slotIndex,
  )} берёт взрослую ${who} колонии: не в походе, не выбитую, не больную и без беременности. Сверху — самые редкие, под именем — готовность к паре и место жабы.`;
};

/** Что сказать, когда слот никого не может позвать */
const slotEmptyText = (slotIndex: number): string =>
  getNestSlotSex(slotIndex) === "female"
    ? "Свободных самок нет: у остальных есть причина отказа — раскройте список ниже."
    : "Свободных самцов нет: у остальных есть причина отказа — раскройте список ниже.";

interface NestModalProps {
  /** id гекса-репродуктора, из которого открыли модалку: репродукторов в колонии может быть несколько */
  roomId?: string;
  /** Гекс, из которого открыли модалку: по нему появляется последний таб «Данные сектора» */
  room?: RoomConfig;
}

/** Табы репродуктора: пары первыми, «Данные сектора» — последним */
type NestTab = "nest" | RoomDataTabId;

export default function NestModal({
  roomId = NEST_ROOM_ID,
  room,
}: NestModalProps) {
  const { allToads, account } = useToads();
  const { addNotification } = useNotifications();
  const { playOk, playExited } = useSoundEffects();
  const gameState = useGameState();
  // Раз в секунду обновляем обратные отсчёты: ухаживание, отдых, статусы жаб
  const [, setTick] = useState(0);
  /** Состояние сектора: пары репродуктора (по умолчанию) или данные сектора */
  const [tab, setTab] = useState<NestTab>("nest");

  /** Табы: пары репродуктора и, если модалку открыл гекс, «Данные сектора» */
  const tabs: ModalTabItem<NestTab>[] = [
    { id: "nest", label: "🪺 Пары", color: "text-purple-400" },
    ...(room ? [{ ...ROOM_DATA_TAB }] : []),
  ];

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const scenes = gameState.scenes ?? [];
  /**
   * Сектора карты: у каждого гекса своё имя с номером экземпляра — «Репродуктор #2»
   * (`components/HexMap/room-names.ts`). Собираем ту же карту, что рисует экран колонии,
   * чтобы подписи списка жаб сходились с ней: своего состояния карты у модалки нет.
   */
  const mapRooms = useMemo(
    () =>
      resolveColonyRooms(
        gameState.colony ?? EMPTY_COLONY,
        gameState.scenes ?? [],
      ),
    [gameState.colony, gameState.scenes],
  );

  /** Жабы, которые физически стоят в этом репродукторе: их и показывают слоты */
  const nestToads = allToads.filter(
    (toad) => toad.roomId === roomId && toad.status !== "out",
  );
  /** Взрослые занимают места репродуктора… */
  const nestAdults = nestToads.filter((toad) => toad.stage === "adult");
  /** …а головастики, рождённые в репродукторе, живут поверх мест, пока их не вынесут */
  const nestChildren = nestToads.filter((toad) => toad.stage !== "adult");

  /**
   * Биопод, к которому относится репродуктор: родильные слоты, карантин и апгрейды — свойства
   * биопода, а пара приходит в репродуктор из своего дома. Дом жабы — её `homeId`: пока пара
   * сидит в репродукторе, места в биоподе она не занимает (`utils/toad-location.ts`).
   * Раньше это был «текущий биопод» игрока; теперь берём дом пары в репродукторе,
   * а если репродуктор пуст — первый биопод колонии.
   */
  const hostScene =
    scenes.find((scene) => scene.id === getToadHomeId(nestAdults[0] ?? {})) ??
    scenes[0] ??
    null;

  /**
   * Два места репродуктора: первый слот — самка, второй — самец (Часть 3.2). Слота два,
   * поэтому жабы раскладываются по полу, а не по порядку: пара всегда встаёт на свои места
   * (и слоты, и список жаб читают одни и те же правила, `breeding-manager.ts`).
   */
  const slots = NEST_SLOT_SEXES.map(
    (sex) => nestAdults.find((toad) => toad.sex === sex) ?? null,
  );
  /**
   * Взрослые, которым пол не дал слота: сейв, где в репродуктор посадили не пару
   * (нейтрал или двое одного пола). Они видны отдельным списком — жаба не пропадает с экрана.
   */
  const extraNestAdults = nestAdults.filter((toad) => !slots.includes(toad));

  /** Статус жабы в репродукторе: ухаживает / вынашивает / ждёт пару */
  const toadStatus = (toad: Toad): string => {
    if (toad.mating) {
      const partner = allToads.find(
        (item) => item.id === toad.mating?.partnerId,
      );

      return ` ухаживает: ${formatWait(getMatingTimeLeft(toad))} с ${
        partner?.name ?? "партнёром"
      }`;
    }

    if (toad.pregnancy?.isPregnant) {
      return " вынашивает потомство — роды придут сами";
    }

    if (toad.stage !== "adult") {
      return "головастик из этого репродуктора";
    }

    return "ждёт пару";
  };

  /**
   * Строки списка слота: кого слот берёт — `getNestSlotCandidates` (взрослые жабы его пола,
   * не в походе, не выбитые, не больные, без беременности; сверху самые редкие), и кого нет —
   * с причиной отказа `getNestSlotRejectReason`. Отбор и причины живут в менеджере
   * репродуктора: теми же правилами пользуются подсказки, проверки пары и эта модалка.
   */
  const getSlotPicker = (slotIndex: number) => ({
    available: getNestSlotCandidates(slotIndex).map((toad) => ({
      toad,
      // Место в списке: пару собирают из самых редких жаб колонии
      rank: toad.genes.rarity,
      note: readinessNote(toad),
    })),
    // Жабы самого репродуктора и так видны в слотах — в «не подходят» им делать нечего
    rejected: allToads
      .filter((toad) => toad.roomId !== roomId)
      .map((toad) => ({
        toad,
        rank: toad.genes.rarity,
        reason: getNestSlotRejectReason(toad, slotIndex),
      }))
      .filter((item) => Boolean(item.reason)),
  });

  /** В каком секторе жаба живёт сейчас (для списка жаб) */
  const roomLabelOf = (toad: Toad): string => {
    if (!toad.roomId) {
      const scene = scenes.find((s) => s.id === getToadHomeId(toad));
      return scene?.name ?? "Биопод";
    }

    // Сектора с таким id в карте нет только у сейва со снесённым гексом — тогда имя общее
    return (
      mapRooms.find((room) => room.id === toad.roomId)?.name || "Сектор колонии"
    );
  };

  /** Название репродуктора, из которого открыли модалку (базовое или построенное) */
  const nestRoomTitle =
    mapRooms.find((room) => room.id === roomId)?.name || "Репродуктор";

  const biomass = Math.floor(account?.biomass || 0);
  const astro = Math.floor(getAstroBalance());

  // Пара в репродукторе может быть неполной: по ней считаем цену ухаживания и подсказки
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

  /** Пара репродуктора для кнопки ухаживания: активна ли кнопка и чего не хватает */
  const courtship = checkNestCourtship(roomId);

  /** Что сейчас происходит в репродукторе — подсказка рядом с кнопкой ухаживания */
  const nestHint = ((): string | null => {
    if (courtingToad) {
      const partner = allToads.find(
        (toad) => toad.id === courtingToad.mating?.partnerId,
      );
      return `Ухаживание запущено`;
    }

    if (pregnantInNest) {
      return ` ${pregnantInNest.name} вынашивает потомство`;
    }

    if (nestAdults.length === 0) {
      return "Посадите пару";
    }

    if (!nestFemale) {
      return "Не хватает самки";
    }

    if (!nestMale) {
      return "Не хватает самца";
    }

    return null;
  })();

  /** Посадить жабу из списка в репродуктор: пару заводит кнопка, а не посадка */
  const handlePlace = (toad: Toad) => {
    placeToadInRoom(toad.id, roomId);
    playOk();
    // Ухаживание не стартует само: игрок сначала сажает пару, а потом жмёт
    // «Начать ухаживание» в блоке ниже (кнопка объяснит, чего не хватает)
    setTick((t) => t + 1);
  };

  /** Кнопка «Начать ухаживание»: пара в репродукторе начинает ждать беременность */
  const handleStartCourtship = () => {
    const result = startNestCourtship(roomId, addNotification);

    // О причине отказа менеджер уже сказал уведомлением, и её же видно под кнопкой
    result.started ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  /** Вынести жабу из репродуктора домой — в её биопод (ухаживание при этом прерывается) */
  const handleRelease = (toad: Toad) => {
    const wasCourting = Boolean(toad.mating);

    if (wasCourting) {
      abortMating(toad.id);
    }

    // Дом жабы помнит её биопод (`homeId`), но места там может уже не быть: пока пара жила
    // в репродукторе, биопод мог заполниться — тогда жаба остаётся в репродукторе
    const result = sendToadHome(toad.id);

    if (!result.ok) {
      playExited();
      addNotification({
        type: "warn",
        content:
          result.reason === "no-space"
            ? `${toad.name} не вернулась: в биоподе «${result.scene?.name}» нет места — постройте биопод или переселите её в другой («🏠 Переместить» в карточке жабы).`
            : `${toad.name} не вернулась: биопод, в котором она жила, не найден — переселите её в другой («🏠 Переместить» в карточке жабы).`,
        timeout: 9000,
      });
      setTick((t) => t + 1);
      return;
    }

    playOk();
    addNotification({
      type: wasCourting ? "warn" : "success",
      content: wasCourting
        ? `${toad.name} в биоподе: ухаживание прервано`
        : `${toad.name} вернулась в биопод`,
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

  /** Прервать ухаживание: жабы перестают ухаживать, но остаются в репродукторе */
  const handleAbortMating = (toad: Toad) => {
    const result = abortMating(toad.id);
    addNotification({
      type: result.success ? "success" : "warn",
      content: result.message,
    });
    result.success ? playOk() : playExited();
    setTick((t) => t + 1);
  };

  return (
    <>
      {/* Заголовок */}
      <div className="flex w-full justify-center items-center relative">
        <div className="flex items-center gap-2 pb-4">
          <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
            Репродуктор
          </h2>
        </div>
      </div>

      {/* Переключение вкладок: вид один на все секторы (`shared/ModalTabs`) */}
      {tabs.length > 1 && (
        <ModalTabs tabs={tabs} active={tab} onChange={setTab} />
      )}

      {tab === "nest" && (
        <>
          <div className="flex flex-col gap-3">
            {/* Сводка */}
            <div className="flex items-center justify-between text-xs bg-color-main rounded-xl px-3 py-2 border border-gray-500/30">
              <span className="text-cyan-300">
                👥 В репродукторе: {nestAdults.length}/{NEST_ROOM_TOAD_SLOTS}
              </span>
              <span className="text-lime-300">🧪 {biomass}</span>
              <span className="text-purple-300">★ {astro}</span>
            </div>

            <p className="text-1xs text-gray-400 text-center leading-snug">
              Репродуктор — на пару: самка садится в первый слот, самец во
              второй. Посадите пару и нажмите «Начать ухаживание»: ухаживание
              занимает {MATING_MIN_MINUTES}–{MATING_MAX_MINUTES} мин, и только
              потом у самки стартует беременность. Из репродуктора жабы не
              уходят — и после ухаживания, и после родов их выносит игрок.
              Головастики, рождённые в репродукторе, остаются рядом с матерью,
              даже если репродуктор переполнено.
            </p>

            {/* Слоты пары: каждый слот — выпадающий список жаб своего пола */}
            <div className="bg-color-main rounded-xl px-3 py-2 border border-purple-500/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-200 font-semibold">
                  🪺 Места репродуктора
                </span>
                <span className="text-2xs text-gray-400">{nestRoomTitle}</span>
              </div>

              {slots.map((toad, index) => {
                const picker = getSlotPicker(index);

                return (
                  <div
                    key={`nest-slot-${index}`}
                    className={`rounded-lg p-2 bg-black/20 border flex flex-col gap-1.5 ${
                      toad
                        ? "border-purple-500/30"
                        : "border-dashed border-emerald-500/40"
                    }`}
                  >
                    {/*
                     * Слот — выпадающий список жаб своего пола: тап по строке открывает всех,
                     * кого слот возьмёт, а жаба в слоте меняется выбором из того же списка.
                     */}
                    <ToadPicker
                      icon={getToadSexIcon(NEST_SLOT_SEXES[index])}
                      caption={getNestSlotLabel(index)}
                      label={getNestSlotLabel(index)}
                      picked={toad}
                      placeholder="＋ посадить жабу"
                      pickedSummary={
                        toad ? (
                          <span className="shrink-0 text-2xs text-lime-300">
                            ⚡{Math.round(getToadEnergy(toad))}
                          </span>
                        ) : undefined
                      }
                      groups={[
                        {
                          label: `Можно взять (${picker.available.length})`,
                          items: picker.available,
                        },
                      ]}
                      rejected={{
                        label: TOAD_PICKER_REJECTED_GROUP,
                        items: picker.rejected,
                      }}
                      hint={slotHint(index)}
                      emptyText={slotEmptyText(index)}
                      locationOf={roomLabelOf}
                      onPick={handlePlace}
                    />

                    {toad && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xs text-lime-300 shrink-0">
                            ⚡{Math.round(getToadEnergy(toad))}
                          </span>
                          {/* Полоска сил: видно, дотянет ли жаба до пары (`getEnergyCost`) */}
                          <div className="w-full h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-lime-400 to-emerald-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (getToadEnergy(toad) / MAX_ENERGY) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="text-2xs text-gray-300 truncate">
                          {toadStatus(toad)}
                        </div>

                        {getToadDisease(toad) && (
                          <div className="text-2xs text-red-300 truncate">
                            {getToadDisease(toad)?.icon}{" "}
                            {getToadDisease(toad)?.name}
                          </div>
                        )}
                      </>
                    )}

                    {toad && (
                      <div className="flex flex-wrap gap-1.5">
                        <ClickButton
                          onClick={() => handleRelease(toad)}
                          className="px-2 py-1 rounded-md text-2xs bg-color-main border border-gray-500/50 text-gray-200"
                        >
                          {toad.mating
                            ? "Прервать и вынести"
                            : "Вынести в биопод"}
                        </ClickButton>
                        {toad.mating && (
                          <ClickButton
                            onClick={() => handleAbortMating(toad)}
                            className="px-2 py-1 rounded-md text-2xs bg-color-main border border-amber-500/50 text-amber-200"
                          >
                            Только прервать
                          </ClickButton>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Не пара: сейв с жабами не того пола. Показываем их отдельно — жаба не пропадает с экрана */}
              {extraNestAdults.length > 0 && (
                <div className="rounded-lg p-2 bg-black/20 border border-amber-500/40 flex flex-col gap-1.5">
                  <div className="text-2xs text-amber-200 leading-snug">
                    Ещё в репродукторе: {extraNestAdults.length} — слоты заняты
                    парой (самка и самец). Эти жабы места пары не занимают, но и
                    пару не образуют.
                  </div>

                  {extraNestAdults.map((toad) => (
                    <div
                      key={`nest-extra-${toad.id}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span
                        className={`text-2xs font-semibold truncate ${
                          getRarityConfig(toad.genes.rarity).color
                        }`}
                      >
                        {TYPE_ICONS[toad.sex as keyof typeof TYPE_ICONS] ?? "○"}{" "}
                        {toad.name}
                      </span>
                      <ClickButton
                        onClick={() => handleRelease(toad)}
                        className="px-2 py-1 rounded-md text-2xs bg-color-main border border-gray-500/50 text-gray-200 shrink-0"
                      >
                        Вынести в биопод
                      </ClickButton>
                    </div>
                  ))}
                </div>
              )}

              {nestHint && (
                <div className="text-2xs text-amber-200 leading-snug">
                  {nestHint}
                </div>
              )}
            </div>

            {/* Кнопка ухаживания: пару заводит игрок, а не репродуктор само (Часть 3.2) */}
            <div className="bg-color-main rounded-xl px-3 py-2 border border-pink-500/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-pink-200 font-semibold">
                  Ухаживание
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
              </div>

              {courtingToad && (
                <ProgressBar
                  label="Прогресс"
                  current={
                    MATING_MAX_MINUTES * 60000 - getMatingTimeLeft(courtingToad)
                  }
                  max={MATING_MAX_MINUTES * 60000}
                  color={"red"}
                />
              )}

              {!courtingToad && (
                <ClickButton
                  disabled={!courtship.ready}
                  onClick={handleStartCourtship}
                  className={`w-full rounded-lg px-3 py-2 text-xs border transition-all ${
                    courtship.ready
                      ? "border-pink-500/60 text-pink-100 hover:border-pink-400"
                      : "opacity-50 cursor-not-allowed border-gray-600/50 text-gray-400"
                  }`}
                >
                  Начать ухаживание
                </ClickButton>
              )}

              <div
                className={`text-2xs leading-snug ${
                  courtship.ready ? "text-emerald-200" : "text-amber-200"
                }`}
              >
                {courtship.message}
              </div>
            </div>

            {/* Головастики, рождённые в репродукторе: переполнение разрешено, их выносит игрок */}
            {nestChildren.length > 0 && (
              <div className="bg-color-main rounded-xl px-3 py-2 border border-amber-500/40 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-200 font-semibold">
                    🐸 Головастики в репродукторе: {nestChildren.length}
                  </span>
                  <span className="text-2xs text-gray-400">
                    мест: {NEST_ROOM_TOAD_SLOTS}
                  </span>
                </div>
                <div className="text-2xs text-gray-400 leading-snug">
                  Перенесите их в биопод на карте колонии
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
                      <span
                        className={getRarityConfig(child.genes.rarity).color}
                      >
                        {child.name}
                      </span>{" "}
                      · {toadStatus(child)} · вынести в биопод
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Цена ухаживания: её списывает кнопка «Начать ухаживание», когда пара готова */}
            <div className="bg-color-main rounded-xl px-3 py-2 border border-gray-500/30 text-xs flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">
                  Энергия пары за ухаживание
                </span>
                <span className="text-lime-300">⚡ {pairEnergyCost}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Биомасса за пару</span>
                <span
                  className={
                    enoughBiomass ? "text-emerald-300" : "text-red-400"
                  }
                >
                  🧪 {pairBiomassCost}
                </span>
              </div>
              <div className="text-2xs text-gray-500 leading-snug">
                Списывается один раз — когда репродуктор начинает ухаживание.
                Отдых после пары считается у каждой жабы отдельно.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ВКЛАДКА «Данные сектора»: описание, улучшения и снос гекса репродуктора */}
      {tab === "room-data" && room && <RoomDataTab room={room} />}
    </>
  );
}
