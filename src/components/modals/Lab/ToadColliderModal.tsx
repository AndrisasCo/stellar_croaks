import { useState } from "react";
import { ColliderIcons } from "../../../assets/icons";
import { deleteToadsByIds } from "../../../backend";
import { hasIncubatingChild } from "../../../backend/collider-manager";
import { useColony } from "../../../hooks/use-colony";
import { useNotifications } from "../../../hooks/use-notification";
import { useRoomPowerTab } from "../../../hooks/use-room-power-tab";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  Toad,
  getRarityConfig,
  getGeneticFaultConfig,
} from "../../../models/Toad";
import { ToadTypes } from "../../../models/Toad/toad-species";
import { itemsFull, Items } from "../../../models/user";
import { BreedingResult } from "../../../models/types";
import {
  generateChildToad,
  calculateRarityBonus,
} from "../../../utils/calculate-genetics";
import { MIXING_DURATION } from "../../../utils/constants";
import {
  GENE_DUST_MAX_PER_MIX,
  applyGeneDustToRarity,
  getGeneDustBonusPercent,
  getGeneDustCount,
  spendGeneDust,
} from "../../../utils/gene-dust";
import { nameGenerator } from "../../../utils/name-generator";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../../utils/expedition-manager";
import { TOAD_PICKER_REJECTED_GROUP } from "../../../utils/toad-picker";
import { ClickButton } from "../../shared/ClickButton";
import Modal from "../../shared/Header";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { ToadGender } from "../../shared/ToadGender";
import { ToadSlotGrid } from "../../shared/ToadSlotGrid";
import { useToads } from "../../ToadContext";
import { useModal } from "../../ModalContext";
import { ToadInfo } from "../ToadInfoModal";
import { MixingInProgress } from "./MixingInProgress";
import IncubatorTab from "./IncubatorTab";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
import { RoomConfig } from "../../HexMap/rooms-config";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "../RoomDataTab";

/**
 * Генетический коллайдер 🧬 — сектор, где из нескольких жаб собирают одного гибрида.
 *
 * Инкубатор больше не отдельный сектор карты: его колбы — вкладка этой же модалки. Модалка
 * живёт в двух местах: из лаборатории и по гексу коллайдера на карте — тогда в ней есть и
 * последний таб «Данные сектора», как у остальных секторов (`shared/ModalTabs`).
 */
type ColliderTab = "collider" | "incubator" | RoomDataTabId;

/** Иконка генной пыли — та же, что на складе и в добыче похода (не эмодзи). */
const GENE_DUST_ICON = itemsFull[Items.geneDust].icon;

// Функция для определения цвета редкости
const getRarityColor = (rarity: number): string => {
  return getRarityConfig(rarity).color;
};

// Функция для определения бейджа редкости
const getRarityBadge = (rarity: number): string => {
  return getRarityConfig(rarity).icon;
};

// Склонение слова «жаба» для предупреждения о безвозвратной потере
const pluralizeToads = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "жаба";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "жабы";
  }
  return "жаб";
};

export default function ToadCollider({ room }: { room?: RoomConfig }) {
  const [selectedToads, setSelectedToads] = useState<(Toad | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);

  const [isMixing, setIsMixing] = useState(false);
  // Сколько генной пыли добавить в этот запуск: 0…10, каждая пылинка = +1% качества.
  const [dustAmount, setDustAmount] = useState(0);
  // Коллайдер уничтожает исходных жаб безвозвратно — смешиваем только
  // после явного подтверждения.
  const [showWarning, setShowWarning] = useState(false);

  const {
    startBreeding,
    updateBreeding,
    allToads,
    colliderState,
    selectToad,
    account,
  } = useToads();
  const { addNotification } = useNotifications();
  const { openModal } = useModal();
  const { powerGrid } = useColony();
  /** Состояние сектора: смешивание жаб (по умолчанию), инкубатор или данные сектора */
  const {
    tab,
    setTab,
    issue: powerIssue,
  } = useRoomPowerTab<ColliderTab>({
    room,
    powerGrid,
    defaultTab: "collider",
  });

  /**
   * Табы коллайдера: смешивание, колбы инкубатора и — только у гекса на карте —
   * «Данные сектора» последним табом, как у остальных секторов.
   */
  const tabs: ModalTabItem<ColliderTab>[] = [
    {
      id: "collider",
      label: "🧬 Коллайдер",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    {
      id: "incubator",
      label: "🧫 Инкубатор",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    ...(room ? [{ ...ROOM_DATA_TAB }] : []),
  ];

  // Часть 5: жабы в походе недоступны для коллайдера (они на Периметре).
  // Список — вся колония: коллайдер работает с генами, а не с биоподом.
  const availableToads = allToads.filter(
    (t) => t.stage === "adult" && !isToadBusyOnExpedition(t),
  );
  /** Гибрид в колбе блокирует новое смешивание, пока его не заберут в биопод. */
  const incubatingChild =
    colliderState.slots.find((slot) => slot.child)?.child ?? null;
  const incubatorBusy = hasIncubatingChild(colliderState);
  const { playBubble2 } = useSoundEffects();
  const [breedingResult, setBreedingResult] = useState<BreedingResult | null>(
    null,
  );
  const [customName, setCustomName] = useState("");

  const currentToads = selectedToads.filter(Boolean) as Toad[];

  const isDisabled = currentToads.length < 2;

  /**
   * Ползунок генной пыли. Больше 10 пылинок за запуск не нужно, а больше,
   * чем лежит на складе, взять нельзя. `dustForMix` — фактический выбор,
   * который уходит и в бонус качества, и в списание.
   */
  const availableDust = getGeneDustCount(account?.storage);
  const maxDust = Math.min(GENE_DUST_MAX_PER_MIX, availableDust);
  const dustForMix = Math.min(dustAmount, maxDust);
  const dustBonus = getGeneDustBonusPercent(dustForMix);

  const handlePickToad = (toad: Toad, slotIndex: number) => {
    if (isToadBusyOnExpedition(toad)) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    // Одна жаба — одна колба: если её взяли в другой слот, старый слот освобождается
    const newSlots = selectedToads.map((item) =>
      item && item.id === toad.id ? null : item,
    );
    newSlots[slotIndex] = toad;
    setSelectedToads(newSlots);
    playBubble2();
  };

  const handleRemoveToad = (index: number) => {
    const newToads = [...selectedToads];
    newToads[index] = null;
    setSelectedToads(newToads);
    playBubble2();
  };

  /**
   * Кого берёт пустая колба: взрослых жаб колонии не в походе и ещё не выбранных
   * в другие колбы. Остальные видны в «Не подходят» с причиной отказа.
   */
  const getPickerFor = () => {
    const selectedIds = new Set(currentToads.map((toad) => toad.id));

    return {
      groups: [
        {
          label: `Можно взять (${availableToads.filter((toad) => !selectedIds.has(toad.id)).length})`,
          items: availableToads
            .filter((toad) => !selectedIds.has(toad.id))
            .map((toad) => ({
              toad,
              rank: toad.genes.rarity,
              note: toad.state?.genetic_fault
                ? `генетическая поломка: ${toad.state.genetic_fault}%`
                : undefined,
            })),
        },
      ],
      rejected: {
        label: TOAD_PICKER_REJECTED_GROUP,
        items: allToads
          .map((toad) => ({
            toad,
            rank: toad.genes.rarity,
            reason: selectedIds.has(toad.id)
              ? "уже в коллайдере"
              : toad.stage !== "adult"
                ? "в коллайдер берут только взрослых жаб"
                : isToadBusyOnExpedition(toad)
                  ? EXPEDITION_TOAD_BUSY_REASON
                  : null,
          }))
          .filter((item) => Boolean(item.reason)),
      },
      hint: "Сверху — самые редкие. В коллайдер берут взрослых жаб колонии: не в походе и не занятых в другой колбе.",
      emptyText:
        "Свободных жаб нет: все взрослые жабы колонии уже в коллайдере.",
    };
  };

  const openToadCard = (toad: Toad) => {
    selectToad(toad.id);
    openModal(() => <ToadInfo />);
  };

  const handleBreed = async () => {
    if (isDisabled || isMixing || incubatorBusy) {
      return;
    }

    // Жабу могли отправить в поход, пока модалка открыта: смешивание ждёт возвращения
    if (currentToads.some((toad) => isToadBusyOnExpedition(toad))) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    setIsMixing(true);

    // Фиксируем пыль на момент запуска: бонус и списание должны совпадать.
    const dustToUse = Math.min(dustAmount, getGeneDustCount());

    // Мутация - шанс на повышенную Качество
    const mutationChance = Math.random() < 0.1;
    const genesBreakChance = Math.random() < 0.1;
    const isMutant = Math.random() < 0.1;

    const child = generateChildToad(currentToads, true, {
      mutationChance,
      genesBreakChance,
      isMutant,
    }) as Toad;

    // Генная пыль улучшает именно качество (редкость) гибрида: +1% за пылинку.
    child.genes.rarity = applyGeneDustToRarity(child.genes.rarity, dustToUse);

    await new Promise<void>((resolve) =>
      setTimeout(resolve, MIXING_DURATION + 500),
    );

    let message = `✨ Новый гибрид создан!`;

    if (genesBreakChance) {
      message = " Неудачное смешивание генов: жаба будет бесполой.";
    }

    if (mutationChance) {
      message += " Идельное смешивание генов! Ее Качество повышена";
    }

    if (dustToUse > 0) {
      message += ` Генная пыль добавила +${getGeneDustBonusPercent(dustToUse)}% к качеству.`;
    }

    if (isMutant) {
      message += " Жаба мутировала! Ее облик изменен...";
    }

    // Колбу могли занять, пока шло смешивание (например, в другой вкладке):
    // не удаляем родителей, если ребёнку некуда лечь.
    if (!startBreeding(child)) {
      setIsMixing(false);
      addNotification({
        type: "danger",
        content:
          "Инкубатор занят: сначала заберите гибрида, потом смешивайте жаб снова.",
      });
      return;
    }

    // Пыль списываем только после успешного старта: при занятой колбе
    // смешивание отменяется и расходник остаётся на складе.
    if (dustToUse > 0) {
      spendGeneDust(dustToUse);
      setDustAmount(0);
    }

    setBreedingResult({
      success: !genesBreakChance,
      child,
      message: message,
    });

    setIsMixing(false);

    deleteToadsByIds(currentToads.map((t) => t.id));
    setSelectedToads([null, null, null, null, null]);
  };

  const handleConfirm = () => {
    if (!breedingResult) {
      return;
    }
    const { child } = breedingResult;
    if (customName.trim()) {
      child.name = customName.trim();
      updateBreeding(child);
    }

    setCustomName("");
    setBreedingResult(null);
    // Гибрид уже в колбе (`startBreeding`): показываем инкубатор в этой же модалке,
    // а не открываем отдельное окно — инкубатор больше не отдельная комната.
    setTab("incubator");
  };

  /** Подтверждение: жабы уходят в коллайдер навсегда */
  const handleConfirmMixing = () => {
    setShowWarning(false);
    void handleBreed();
  };

  const handleReset = () => {
    setSelectedToads([null, null, null, null, null]);
    setBreedingResult(null);
    setCustomName("");
    setDustAmount(0);
  };

  // Функция для генерации случайного имени
  const generateRandomName = () => {
    const randomName = nameGenerator.generate();
    setCustomName(randomName);
  };

  return (
    <Modal
      title={room?.name ?? "Генетический Коллайдер"}
      icon={ColliderIcons.collider}
    >
      {/* Переключение вкладок: вид один на все секторы (`shared/ModalTabs`) */}
      {tabs.length > 1 && (
        <ModalTabs tabs={tabs} active={tab} onChange={setTab} />
      )}

      {tab === "collider" && (
        <>
          {!breedingResult ? (
            incubatorBusy ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-5 text-center">
                <h3 className="mt-2 text-lg font-bold text-amber-200">
                  Коллайдер заблокирован
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-200">
                  Инкубатор занят
                  {incubatingChild ? ` «${incubatingChild.name}»` : ""}.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("incubator")}
                  className="ui-button-primary mt-4 px-6 py-2"
                >
                  Перейти в инкубатор
                </button>
              </div>
            ) : (
              <>
                <div className="bg-color-second  rounded-lg p-3 mb-4  border border-slate-600">
                  <div className="text-xs sm:text-sm text-white font-medium mb-2  text-center flex items-center justify-center gap-2">
                    <span className="text-yellow-400">⭐</span>
                    Бонусы редкости
                    <span className="text-yellow-400">⭐</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[
                      {
                        count: 2,
                        colors: "from-green-400 to-green-600",
                        shadow: "shadow-green-500/40",
                      },
                      {
                        count: 3,
                        colors: "from-blue-400 to-blue-600",
                        shadow: "shadow-blue-500/40",
                      },
                      {
                        count: 4,
                        colors: "from-purple-500 to-pink-500",
                        shadow: "shadow-purple-500/40",
                      },
                      {
                        count: 5,
                        colors: "from-yellow-400 to-red-500",
                        shadow: "shadow-yellow-500/40",
                      },
                    ].map(({ count, colors, shadow }) => (
                      <div
                        key={count}
                        className={`text-center p-1 sm:p-2 rounded-xl transition-all duration-500 transform ${
                          currentToads.length >= count
                            ? `bg-gradient-to-br ${colors} text-white shadow-lg ${shadow} scale-105 border-2 border-white border-opacity-30 animate-gradient-x`
                            : "bg-color-main text-slate-300 border-2 border-transparent "
                        }`}
                      >
                        <div className="text-1xs font-bold">{count} жаб</div>
                        <div
                          className={`mt-1 text-2xs font-bold ${
                            currentToads.length >= count
                              ? "text-yellow-300"
                              : "text-slate-200"
                          }`}
                        >
                          +{calculateRarityBonus(count)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Генная пыль: ползунок 0…10, каждая пылинка — +1% к качеству гибрида */}
                <div className="mb-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-950/15 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-fuchsia-200">
                        <img
                          src={GENE_DUST_ICON}
                          alt=""
                          draggable={false}
                          className="h-4 w-4 shrink-0 select-none object-contain"
                        />
                        Добавить генную пыль
                      </div>
                      <div className="text-2xs text-slate-400">
                        1 шт = +1% к качеству · на складе {availableDust}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-bold text-fuchsia-200 tabular-nums">
                        {dustForMix} / {GENE_DUST_MAX_PER_MIX}
                      </div>
                      <div className="text-2xs font-bold text-emerald-300">
                        +{dustBonus}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max={maxDust}
                      step="1"
                      value={dustForMix}
                      onChange={(event) =>
                        setDustAmount(Number(event.target.value))
                      }
                      disabled={isMixing || maxDust <= 0}
                      aria-label="Сколько генной пыли добавить в коллайдер"
                      title="Ползунок: сколько генной пыли добавить (0–10)"
                      className="h-2 flex-1 rounded-lg bg-slate-600 accent-fuchsia-500 disabled:opacity-50"
                    />
                    <span
                      className={`inline-flex w-16 shrink-0 items-center justify-end gap-1 text-xs font-medium ${
                        dustForMix > 0 ? "text-fuchsia-200" : "text-slate-500"
                      }`}
                    >
                      <img
                        src={GENE_DUST_ICON}
                        alt=""
                        draggable={false}
                        className="h-3.5 w-3.5 shrink-0 select-none object-contain"
                      />
                      {dustForMix}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-2xs text-slate-400">
                    <span>+0%</span>
                    <span>+{GENE_DUST_MAX_PER_MIX}% к качеству</span>
                  </div>

                  {availableDust === 0 && (
                    <p className="ui-hint mt-2">
                      Генная пыль не найдена: её приносят походы за Периметр.
                    </p>
                  )}
                </div>

                {/* Колбы: квадраты с «+», выбор жабы — модалкой */}
                <ToadSlotGrid
                  slots={selectedToads.map((toad, index) => ({
                    toad,
                    label: `Колба ${index + 1}`,
                    icon: "🧪",
                  }))}
                  columns={5}
                  title="Колбы коллайдера"
                  headerRight={`${currentToads.length}/5`}
                  pickerFor={getPickerFor}
                  onPick={handlePickToad}
                  onOpen={(toad) => openToadCard(toad)}
                  onRemove={(_toad, index) => handleRemoveToad(index)}
                  removeLabel="Убрать из колбы"
                  disabled={isMixing}
                  className="mb-3"
                />

                {/* Кнопка скрещивания */}
                {isMixing && (
                  <div className="pb-4 my-auto h-full">
                    <MixingInProgress />
                  </div>
                )}

                {/* Единственное предупреждение о необратимости — финальное
                  подтверждение после нажатия «Смешать» (см. showWarning ниже) */}
                {!isMixing && (
                  <div className="text-center mb-6 h-full">
                    <button
                      onClick={() => setShowWarning(true)}
                      disabled={isDisabled}
                      className="ui-button-primary px-4 py-2"
                    >
                      <div className="flex items-center justify-center gap-2 px-6">
                        {ColliderIcons.mix}
                        <span>Смешать</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Кнопки управления */}

                <ClickButton
                  className="w-full mt-auto bg-color-second hover:bg-slate-600 text-slate-200 py-3 rounded-xl "
                  onClick={handleReset}
                  disabled={isMixing}
                >
                  Очистить
                </ClickButton>
              </>
            )
          ) : (
            <div className="text-center">
              {/* Сообщение о результате */}
              <div
                className={`rounded-xl p-4 mb-4 border-2 ${
                  breedingResult.success
                    ? "bg-green-900/30 border-green-500/50 text-green-300"
                    : "bg-red-900/30 border-red-500/50 text-red-300"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <div className="text-left">
                    <div className="font-bold text-sm mb-1">
                      {breedingResult.success &&
                      breedingResult.child.type !== ToadTypes.mutant
                        ? "Успешное скрещивание!"
                        : "Особый результат"}
                    </div>
                    <div className="text-sm leading-relaxed">
                      {breedingResult.message}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-color-main rounded-xl p-2 border border-slate-600/50">
                {/* Верхний блок: аватар + Качество + имя */}
                <div className="flex items-center gap-4 mb-4">
                  {/* Поле ввода имени */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 ">
                      <button
                        className="text-xl p-2 hover:bg-slate-600/50 rounded-xl transition-colors flex-shrink-0"
                        onClick={generateRandomName}
                        title="Сгенерировать имя"
                      >
                        🎲
                      </button>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Введите имя для жабы..."
                        className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-center text-sm text-white placeholder-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                      />
                    </div>
                  </div>

                  <ToadAvatar size={10} toad={breedingResult.child} />
                </div>
                {/* Пол и поколение */}
                <div className="flex items-center justify-center gap-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <ToadGender gender={breedingResult.child.sex} />
                    <span>
                      {breedingResult.child.sex === "neuter"
                        ? "Бесполый"
                        : breedingResult.child.sex === "male"
                          ? "Самец"
                          : "Самка"}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-slate-500"></div>
                  <div>Поколение: {breedingResult.child!.generation}</div>
                </div>
                {/* Качество */}
                <div
                  className={`text-center my-3 ${getRarityColor(
                    breedingResult.child!.genes.rarity,
                  )}`}
                >
                  <span className="text-slate-500 text-sm">Качество:</span>{" "}
                  {getRarityBadge(breedingResult.child!.genes.rarity)}{" "}
                  <span className="font-semibold">
                    {breedingResult.child!.genes.rarity.toFixed(1)}
                  </span>
                </div>

                {/* Таблица характеристик */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="text-slate-300 bg-slate-600/30 rounded-lg p-2 text-center">
                    <div className="text-slate-500 text-xs mb-1">Размер</div>
                    <div className="font-semibold">
                      {breedingResult.child!.genes.weight.toFixed(1)}
                    </div>
                  </div>
                  <div className="text-slate-300 bg-slate-600/30 rounded-lg p-2 text-center">
                    <div className="text-slate-500 text-xs mb-1">Скорость</div>
                    <div className="font-semibold">
                      {breedingResult.child!.genes.speed.toFixed(1)}
                    </div>
                  </div>
                  <div className="text-slate-300 bg-slate-600/30 rounded-lg p-2 text-center">
                    <div className="text-slate-500 text-xs mb-1">Аппетит</div>
                    <div className="font-semibold">
                      {breedingResult.child!.genes.hungerRate.toFixed(1)}
                    </div>
                  </div>
                  <div className="text-slate-300 bg-slate-600/30 rounded-lg p-2 text-center">
                    <div className="text-slate-500 text-xs mb-1">
                      Плодовитость
                    </div>
                    <div className="font-semibold">
                      {breedingResult.child!.genes.fertility.toFixed(1)}
                    </div>
                  </div>
                </div>

                {/* Генетическая поломка */}
                {breedingResult.child!.state?.genetic_fault !== undefined && (
                  <div className="mb-3">
                    <div
                      className={`rounded-xl p-3 border-2 ${
                        getGeneticFaultConfig(
                          breedingResult.child!.state?.genetic_fault,
                        ).bgColor
                      } ${
                        getGeneticFaultConfig(
                          breedingResult.child!.state?.genetic_fault,
                        ).borderColor
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-lg">
                          {
                            getGeneticFaultConfig(
                              breedingResult.child!.state?.genetic_fault,
                            ).icon
                          }
                        </span>
                        <span className="text-slate-300 text-sm font-semibold">
                          ГЕНЕТИКА
                        </span>
                      </div>
                      <div
                        className={`text-base font-bold ${
                          getGeneticFaultConfig(
                            breedingResult.child!.state?.genetic_fault,
                          ).color
                        } mb-1`}
                      >
                        {
                          getGeneticFaultConfig(
                            breedingResult.child!.state?.genetic_fault,
                          ).label
                        }{" "}
                        ({breedingResult.child!.state?.genetic_fault}%)
                      </div>
                      <div className="text-slate-500 text-xs leading-relaxed">
                        {
                          getGeneticFaultConfig(
                            breedingResult.child!.state?.genetic_fault,
                          ).description
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Кнопка подтверждения */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  className="ui-button-primary mt-4 flex-1 py-3 text-base"
                >
                  Поместить в инкубатор
                </button>
              </div>
            </div>
          )}

          {/* Подтверждение: жабы исчезнут навсегда (действие нельзя отменить) */}
          {showWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
              <div className="ui-panel-raised mx-auto w-full max-w-sm border-rose-400/30 p-5">
                <div className="mb-3 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
                    <svg
                      className="h-8 w-8 text-rose-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">
                    Жабы исчезнут навсегда
                  </h3>
                  <p className="text-slate-200 text-sm leading-snug">
                    Генетический коллайдер разберёт выбранных жаб на гены и
                    соберёт из них одного нового гибрида. Вернуть исходных жаб
                    будет невозможно.
                  </p>
                </div>

                <div className="mb-4 rounded-xl bg-red-900/25 border border-red-500/40 p-2 text-left max-h-[30vh] overflow-y-auto">
                  <div className="text-1xs text-red-200/90 mb-1">
                    Исчезнут безвозвратно {currentToads.length}{" "}
                    {pluralizeToads(currentToads.length)}:
                  </div>
                  <ul className="text-xs text-white flex flex-col gap-1">
                    {currentToads.map((toad) => (
                      <li key={toad.id} className="flex items-center gap-2">
                        <ToadGender gender={toad.sex} />
                        <span
                          className={`truncate font-medium ${getRarityColor(
                            toad.genes.rarity,
                          )}`}
                        >
                          {toad.name}
                        </span>
                        <span className="text-slate-400 text-2xs shrink-0">
                          {getRarityBadge(toad.genes.rarity)}{" "}
                          {toad.genes.rarity.toFixed(1)}
                        </span>
                        {toad.pregnancy?.isPregnant && (
                          <span className="text-2xs text-pink-300 shrink-0">
                            🍼 потомство пропадёт
                          </span>
                        )}
                        {toad.mating && (
                          <span className="text-2xs text-pink-300 shrink-0">
                            🫧 ухаживание прервётся
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWarning(false)}
                    className="ui-button-secondary flex-1 py-3"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMixing}
                    disabled={isDisabled}
                    className="ui-button-danger flex-1 py-3"
                  >
                    Разобрать и смешать
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ВКЛАДКА «Инкубатор»: те же колбы, что раньше были отдельным сектором карты */}
      {tab === "incubator" && <IncubatorTab />}

      {/* ВКЛАДКА «Данные сектора»: описание, улучшения и снос гекса коллайдера */}
      {tab === "room-data" && room && <RoomDataTab room={room} />}
    </Modal>
  );
}
