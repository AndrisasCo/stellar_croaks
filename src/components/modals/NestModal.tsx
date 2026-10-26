import { useEffect, useMemo, useState } from "react";
import { EMPTY_COLONY } from "../../models/colony";
import { Toad } from "../../models/Toad";
import { useColony } from "../../hooks/use-colony";
import { useGameState } from "../../hooks/use-game-state";
import { useNotifications } from "../../hooks/use-notification";
import { useRoomPowerTab } from "../../hooks/use-room-power-tab";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import {
  NEST_ROOM_TOAD_SLOTS,
  getBreedPairBiomassCost,
  getEnergyCost,
  getToadEnergy,
} from "../../utils/gamification-config";
import {
  NEST_SLOT_SEXES,
  accelerateNestPregnancy,
  checkNestCourtship,
  getNestSlotCandidates,
  getNestSlotLabel,
  getNestSlotRejectReason,
  getNestSlotSex,
  startNestCourtship,
} from "../../utils/breeding-manager";
import { placeToadInRoom } from "../../backend/colony";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../utils/expedition-manager";
import { CURRENCY_CONFIG, NEST_ROOM_ID } from "../../utils/constants";
import { getAstroBalance } from "../../utils/astro-shop";
import { resolveColonyRooms } from "../HexMap/colony-build";
import { ClickButton } from "../shared/ClickButton";
import Modal from "../shared/Header";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import { ToadListCard } from "../shared/ToadListCard";
import { ToadSlotGrid } from "../shared/ToadSlotGrid";
import { RoomConfig } from "../HexMap/rooms-config";
import { useModal } from "../ModalContext";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "./RoomDataTab";
import { ToadInfo } from "./ToadInfoModal";
import { useToads } from "../ToadContext";
import {
  TOAD_PICKER_REJECTED_GROUP,
  getToadSexIcon,
} from "../../utils/toad-picker";
import { ProgressBar } from "./ToadInfoModal/ProgressBar";

/**
 * Модалка репродуктора (Часть 3.2).
 *
 * Репродуктор — сектор на пару, и у пары места разные: первый слот занимает самка,
 * второй — самец. Слоты — общая сетка жабыных мест (`shared/ToadSlotGrid`): квадрат с «+»
 * открывает модалку выбора (`shared/ToadPicker` → `ToadPickerList`), куда слот зовёт всех
 * **своего пола** — взрослых, не в походе, не выбитых, не больных и без беременности
 * (`breeding-manager.ts` → `getNestSlotCandidates`).
 * У жабы в списке видно её краткую сводку (только силы ⚡), Качество
 * и где она живёт сейчас, а жаб, которых слот не берёт, можно посмотреть с причиной отказа
 * (переключатель «Не подходят») — чтобы не искать ответ, почему жабы нет в списке.
 *
 * Ухаживание заводит игрок: посадил самку в первый слот, самца во второй — и нажал
 * «Начать ухаживание». Кнопка активна не всегда: пока пара отдыхает или не хватает
 * биомассы, под кнопкой висит причина (`checkNestCourtship`). Ухаживание мгновенное:
 * самка сразу беременеет и остаётся в репродукторе до родов (её нельзя отселить,
 * но можно ускорить беременность Сияющей мушкой ✨), а самца игрок может забрать
 * в биопод — он больше не занят парой.
 *
 * Табы — общие для всех секторов (`shared/ModalTabs`): пары репродуктора первыми, «Данные
 * сектора» (`modals/RoomDataTab.tsx`) — последним. Репродуктор открывают и из лаборатории
 * (тогда гекса нет и таб один), и с гекса карты — тогда у модалки есть данные сектора.
 */

/**
 * Сколько осталось до родов (мс): беременность хранится в часах (`pregnancyDuration`),
 * а не в абсолютном времени, поэтому считаем от `pregnancyStart`.
 */
const getPregnancyTimeLeft = (toad: Toad): number => {
  if (!toad.pregnancy) {
    return 0;
  }

  const durationMs = Math.max(1, toad.pregnancy.pregnancyDuration * 3_600_000);

  return Math.max(0, durationMs - (Date.now() - toad.pregnancy.pregnancyStart));
};

/** Прогресс беременности (0…100) — полоса вместо старого прогресса ухаживания */
const getPregnancyProgress = (toad: Toad): number => {
  if (!toad.pregnancy) {
    return 0;
  }

  const durationMs = Math.max(1, toad.pregnancy.pregnancyDuration * 3_600_000);

  return Math.min(
    100,
    ((Date.now() - toad.pregnancy.pregnancyStart) / durationMs) * 100,
  );
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

/** Что слот ищет — подсказка вверху списка жаб */
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
    ? "Свободных самок нет: у остальных есть причина отказа — откройте «Не подходят»."
    : "Свободных самцов нет: у остальных есть причина отказа — откройте «Не подходят».";

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
  const { allToads, account, selectToad } = useToads();
  const { addNotification } = useNotifications();
  const { openModal } = useModal();
  const { playSuccess, playError } = useSoundEffects();
  const gameState = useGameState();
  const { powerGrid, releaseToad } = useColony();
  // Раз в секунду обновляем обратные отсчёты: ухаживание, отдых, статусы жаб
  const [, setTick] = useState(0);
  /** Состояние сектора: пары репродуктора (по умолчанию) или данные сектора */
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<NestTab>({ room, powerGrid, defaultTab: "nest" });

  /** Табы: пары репродуктора и, если модалку открыл гекс, «Данные сектора» */
  const tabs: ModalTabItem<NestTab>[] = [
    {
      id: "nest",
      label: "Пары",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    ...(room ? [{ ...ROOM_DATA_TAB }] : []),
  ];

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
    (toad) => toad.scene_id === roomId && !isToadBusyOnExpedition(toad),
  );
  /** Взрослые занимают места репродуктора… */
  const nestAdults = nestToads.filter((toad) => toad.stage === "adult");
  /** …а головастики, рождённые в репродукторе, живут поверх мест, пока их не вынесут */
  const nestChildren = nestToads.filter((toad) => toad.stage !== "adult");

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

  /** Статус жабы в репродукторе: вынашивает (до родов) / ждёт пару */
  const toadStatus = (toad: Toad): string => {
    if (toad.pregnancy?.isPregnant) {
      return ``;
    }

    // Устаревшее ухаживание из старого сейва живёт до ближайшего тика
    if (toad.mating) {
      return "ухаживает";
    }

    if (toad.stage !== "adult") {
      return "головастик из этого репродуктора";
    }

    return "готов";
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
      .filter((toad) => toad.scene_id !== roomId)
      .map((toad) => ({
        toad,
        rank: toad.genes.rarity,
        reason: getNestSlotRejectReason(toad, slotIndex),
      }))
      .filter((item) => Boolean(item.reason)),
  });

  /**
   * Открыть карточку жабы поверх репродуктора: модалки складываются в стек,
   * поэтому «Закрыть» вернёт к тем же слотам и списку головастиков.
   */
  const openToadCard = (toad: Toad) => {
    selectToad(toad.id);
    openModal(() => <ToadInfo />);
  };

  /** Название репродуктора, из которого открыли модалку (базовое или построенное) */
  const nestRoomTitle =
    mapRooms.find((room) => room.id === roomId || room.slotId === roomId)
      ?.name || "Репродуктор";

  const biomass = Math.floor(account?.biomass || 0);
  const astro = Math.floor(getAstroBalance());

  // Пара в репродукторе может быть неполной: по ней считаем цену ухаживания и подсказки
  const nestMale = nestAdults.find((toad) => toad.sex === "male") ?? null;
  const nestFemale = nestAdults.find((toad) => toad.sex === "female") ?? null;
  const pregnantInNest =
    nestAdults.find((toad) => toad.pregnancy?.isPregnant) ?? null;
  /** Сияющие мушки ✨ — цена ускорения беременности в репродукторе */
  const sparkleFlys = account?.storage?.sparkleFlys || 0;
  const pairEnergyCost =
    (nestMale ? getEnergyCost(nestMale) : 0) +
    (nestFemale ? getEnergyCost(nestFemale) : 0);
  const pairBiomassCost =
    nestMale && nestFemale ? getBreedPairBiomassCost(nestMale, nestFemale) : 0;

  /** Пара репродуктора для кнопки ухаживания: активна ли кнопка и чего не хватает */
  const courtship = checkNestCourtship(roomId);

  /** Что сейчас происходит в репродукторе — подсказка рядом с кнопкой ухаживания */
  const nestHint = ((): string | null => {
    if (pregnantInNest) {
      return ``;
    }

    // Устаревшее ухаживание из старого сейва: первый тик сразу даст беременность
    if (nestAdults.some((toad) => toad.mating)) {
      return "Ухаживание завершается";
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
    if (isToadBusyOnExpedition(toad)) {
      playError();
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    placeToadInRoom(toad.id, roomId);
    // Ухаживание не стартует само: игрок сначала сажает пару, а потом жмёт
    // «Начать ухаживание» в блоке ниже (кнопка объяснит, чего не хватает)
    setTick((t) => t + 1);
  };

  /** Кнопка «Начать ухаживание»: ухаживание мгновенное — самка сразу беременеет */
  const handleStartCourtship = () => {
    const result = startNestCourtship(roomId, addNotification);

    // О причине отказа менеджер уже сказал уведомлением, и её же видно под кнопкой
    if (result.started) {
      playSuccess();
    } else {
      playError();
    }
    setTick((t) => t + 1);
  };

  /** Вынести жабу из репродуктора домой — в её биопод (беременную самку не выпускаем) */
  const handleRelease = (toad: Toad) => {
    if (isToadBusyOnExpedition(toad)) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    // Самка остаётся в репродукторе до родов: ускорить их можно мушкой ✨
    if (toad.pregnancy?.isPregnant) {
      playError();
      addNotification({
        type: "warn",
        content: `${toad.name} вынашивает потомство и останется в репродукторе до родов — ускорьте беременность Сияющей мушкой ✨ или дождитесь их.`,
        timeout: 9000,
      });
      return;
    }

    // Дом жабы помнит её биопод (`homeId`), но места там может уже не быть: тогда
    // releaseToad отправит её в любой свободный биопод под током.
    const result = releaseToad(toad.id);

    if (!result.ok) {
      playError();
      addNotification({
        type: "warn",
        content: "Свободных мест в биоподах нет",
        timeout: 9000,
      });
      setTick((t) => t + 1);
      return;
    }

    setTick((t) => t + 1);
  };

  /** «Ускорить беременность»: 1 Сияющая мушка ✨ — и головастики рождаются сразу */
  const handleAcceleratePregnancy = async () => {
    if (!pregnantInNest) {
      return;
    }

    const result = await accelerateNestPregnancy(
      pregnantInNest.id,
      addNotification,
    );

    if (result.success) {
      playSuccess();
      addNotification({ type: "success", content: result.message });
    } else {
      playError();
    }
    setTick((t) => t + 1);
  };

  return (
    <Modal
      title={room?.name ?? "Репродуктор"}
      icon={<span className="text-xl">🥚</span>}
    >
      {/* Переключение вкладок: вид один на все секторы (`shared/ModalTabs`) */}
      {tabs.length > 1 && (
        <ModalTabs tabs={tabs} active={tab} onChange={setTab} />
      )}

      {tab === "nest" && (
        <>
          <div className="flex flex-col gap-3">
            {/* Сводка */}
            <div className="flex items-center justify-between text-xs bg-color-main rounded-xl px-3 py-2 border border-slate-500/30">
              <span className="text-cyan-300">
                👥 В репродукторе: {nestAdults.length}/{NEST_ROOM_TOAD_SLOTS}
              </span>
              <span className="text-lime-300">🧪 {biomass}</span>
              <span className="text-purple-300">
                {CURRENCY_CONFIG.astro_quax.icon} {astro}
              </span>
            </div>

            {/* Слоты пары: квадраты с «+», выбор жабы — модалкой своего пола */}
            <div className="bg-color-main rounded-xl px-3 py-2 border border-purple-500/40 flex flex-col gap-2">
              <ToadSlotGrid
                slots={slots.map((toad, index) => ({
                  toad,
                  label: getNestSlotLabel(index),
                  icon: getToadSexIcon(NEST_SLOT_SEXES[index]),
                }))}
                columns={2}
                title="Слоты репродуктора"
                headerRight={nestRoomTitle}
                pickerFor={(index) => {
                  const picker = getSlotPicker(index);

                  return {
                    groups: [
                      {
                        label: `Можно взять (${picker.available.length})`,
                        items: picker.available,
                      },
                    ],
                    rejected: {
                      label: TOAD_PICKER_REJECTED_GROUP,
                      items: picker.rejected,
                    },
                    hint: slotHint(index),
                    emptyText: slotEmptyText(index),
                  };
                }}
                onPick={(toad) => handlePlace(toad)}
                onOpen={(toad) => openToadCard(toad)}
                onRemove={(toad) => handleRelease(toad)}
                removeLabel="Вернуть в биопод"
              />

              {slots.map((toad, index) =>
                toad ? (
                  <ToadListCard
                    key={`nest-slot-card-${index}`}
                    toad={toad}
                    onOpen={() => openToadCard(toad)}
                    variant="full"
                    showHunger={false}
                    showHp={false}
                    showEnergy
                    status={{
                      icon: toad.pregnancy?.isPregnant
                        ? ""
                        : toad.mating
                          ? "🫧"
                          : "⏳",
                      label: toadStatus(toad).trim(),
                      className:
                        toad.mating || toad.pregnancy?.isPregnant
                          ? "text-pink-300"
                          : "text-slate-300",
                    }}
                    actions={
                      toad.pregnancy?.isPregnant ? (
                        <span className="rounded-md border border-pink-500/50 bg-color-main px-2 py-1 text-2xs text-pink-200">
                          Беременность
                        </span>
                      ) : (
                        <ClickButton
                          onClick={() => handleRelease(toad)}
                          className="rounded-md border border-slate-500/50 bg-color-main px-2 py-1 text-2xs text-slate-200"
                        >
                          Вернуть в биопод
                        </ClickButton>
                      )
                    }
                  />
                ) : null,
              )}

              {/* Показываем их отдельно — жаба не пропадает с экрана */}
              {extraNestAdults.length > 0 && (
                <div className="rounded-lg p-2 bg-black/20 border border-red-500/40 flex flex-col gap-1.5">
                  <div className="text-2xs text-red-200 leading-snug">
                    Репродуктор переполнен, очистите слоты прежде чем начать
                    ухаживание.
                  </div>

                  {extraNestAdults.map((toad) => (
                    <ToadListCard
                      key={`nest-extra-${toad.id}`}
                      toad={toad}
                      onOpen={() => openToadCard(toad)}
                      variant="brief"
                      showHunger={false}
                      showHp={false}
                      showEnergy
                      status={{
                        icon: "⚠️",
                        label: "лишняя в репродукторе",
                        className: "text-red-200",
                      }}
                      actions={
                        <ClickButton
                          onClick={() => handleRelease(toad)}
                          className="shrink-0 rounded-lg border border-slate-500/50 bg-color-main px-2 py-1 text-2xs text-slate-200"
                        >
                          Вынести в биопод
                        </ClickButton>
                      }
                    />
                  ))}
                </div>
              )}

              {nestHint && (
                <div className="text-2xs text-amber-200 leading-snug">
                  {nestHint}
                </div>
              )}
            </div>

            {pregnantInNest && (
              <>
                <ProgressBar
                  label="Беременность"
                  current={getPregnancyProgress(pregnantInNest)}
                  max={100}
                  color="red"
                  valueLabel={`${Math.round(
                    getPregnancyProgress(pregnantInNest),
                  )} %`}
                  action={{
                    label: "Ускорить",
                    handler: handleAcceleratePregnancy,
                    timeLeft: Math.max(
                      0,
                      Math.ceil(getPregnancyTimeLeft(pregnantInNest) / 60_000),
                    ),
                    disabled: sparkleFlys < 1,
                    disabledReason:
                      sparkleFlys < 1
                        ? "Нет Сияющей мушки ✨ — ускорение недоступно"
                        : "Родить сразу: 1 Сияющая мушка ✨",
                  }}
                />

                <p className="-mt-1 text-2xs text-slate-400">
                  Ускорение стоит 1 Сияющую мушку ✨ · у вас: {sparkleFlys}
                </p>
              </>
            )}

            {!pregnantInNest && (
              <ClickButton
                disabled={!courtship.ready || !!extraNestAdults.length}
                onClick={handleStartCourtship}
                className={`w-full rounded-lg px-3 py-2 text-xs border transition-all ${
                  courtship.ready
                    ? "border-pink-500/60 text-pink-100 hover:border-pink-400"
                    : "opacity-50 cursor-not-allowed border-slate-600/50 text-slate-400"
                }`}
              >
                Начать ухаживание: (
                <span className="text-lime-300">⚡ {pairEnergyCost}</span>{" "}
                <span className="text-cyan-300">🧪 {pairBiomassCost}</span>)
              </ClickButton>
            )}

            <div
              className={`text-2xs leading-snug ${
                courtship.ready ? "text-emerald-200" : "text-amber-200"
              }`}
            >
              {courtship.message}
            </div>

            {/* Головастики, рождённые в репродукторе: переполнение разрешено, их выносит игрок */}
            {nestChildren.length > 0 && (
              <div className="bg-color-main rounded-xl px-3 py-2 border border-amber-500/40 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-200 font-semibold">
                    🐸 Головастики в репродукторе: {nestChildren.length}
                  </span>
                  <span className="text-2xs text-slate-400">
                    мест: {NEST_ROOM_TOAD_SLOTS}
                  </span>
                </div>
                <div className="text-2xs text-slate-400 leading-snug">
                  Перенесите их в биопод на карте колонии
                </div>
                <div className="space-y-1.5">
                  {nestChildren.map((child) => (
                    <ToadListCard
                      key={child.id}
                      toad={child}
                      onOpen={() => openToadCard(child)}
                      variant="full"
                      showHunger={false}
                      showHp={false}
                      showEnergy
                      status={{
                        icon: "🐸",
                        label: toadStatus(child).trim(),
                        className: "text-amber-200",
                      }}
                      actions={
                        <ClickButton
                          onClick={() => handleRelease(child)}
                          disabled={(child.hp ?? 1) <= 0}
                          className="shrink-0 rounded-lg border border-slate-600/50 bg-color-main px-2 py-1 text-2xs text-slate-200 transition-colors hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          В биопод
                        </ClickButton>
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ВКЛАДКА «Данные сектора»: описание, улучшения и снос гекса репродуктора */}
      {tab === "room-data" && room && <RoomDataTab room={room} />}
    </Modal>
  );
}
