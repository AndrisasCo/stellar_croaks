import { useState } from "react";
import { ColliderIcons, PregnancyIcon } from "../../../assets/icons";
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
import { BreedingResult } from "../../../models/types";
import {
  generateChildToad,
  calculateRarityBonus,
} from "../../../utils/calculate-genetics";
import { MIXING_DURATION } from "../../../utils/constants";
import { nameGenerator } from "../../../utils/name-generator";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../../utils/expedition-manager";
import { ClickButton } from "../../shared/ClickButton";
import Modal from "../../shared/Header";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { ToadGender } from "../../shared/ToadGender";
import { useToads } from "../../ToadContext";
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

// Функция для определения цвета редкости
const getRarityColor = (rarity: number): string => {
  return getRarityConfig(rarity).color;
};

// Функция для определения бейджа редкости
const getRarityBadge = (rarity: number): string => {
  return getRarityConfig(rarity).icon;
};

// Функция для определения фона редкости
const getRarityBackground = (rarity: number): string => {
  return getRarityConfig(rarity).bgColor;
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
  // Коллайдер уничтожает исходных жаб безвозвратно — смешиваем только
  // после явного подтверждения.
  const [showWarning, setShowWarning] = useState(false);

  const { startBreeding, updateBreeding, allToads, colliderState } = useToads();
  const { addNotification } = useNotifications();
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

  const handleSelectToad = (toad: Toad) => {
    if (isToadBusyOnExpedition(toad)) {
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    const currentToadIndex = selectedToads.findIndex(
      (t) => t && t.id === toad.id,
    );

    if (currentToadIndex !== -1) {
      const newSlots = [...selectedToads];
      newSlots[currentToadIndex] = null;
      setSelectedToads(newSlots);
      playBubble2();
      return;
    }

    if (currentToads.length < 5) {
      const emptySlotIndex = selectedToads.findIndex((slot) => slot === null);
      if (emptySlotIndex !== -1) {
        const newSlots = [...selectedToads];
        newSlots[emptySlotIndex] = toad;
        setSelectedToads(newSlots);
        playBubble2();
      }
    }
  };

  const handleRemoveToad = (index: number) => {
    const newToads = [...selectedToads];
    newToads[index] = null;
    setSelectedToads(newToads);
    playBubble2();
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

    // Мутация - шанс на повышенную Качество
    const mutationChance = Math.random() < 0.1;
    const genesBreakChance = Math.random() < 0.1;
    const isMutant = Math.random() < 0.1;

    const child = generateChildToad(currentToads, true, {
      mutationChance,
      genesBreakChance,
      isMutant,
    }) as Toad;

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
                <div className="text-3xl">🧫</div>
                <h3 className="mt-2 text-lg font-bold text-amber-200">
                  Коллайдер заблокирован
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-200">
                  В инкубаторе уже дозревает гибрид
                  {incubatingChild ? ` «${incubatingChild.name}»` : ""}. Заберите
                  его в биопод — после этого можно снова смешивать жаб.
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
              {/* Слоты-колбы для жаб */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-3">
                {[0, 1, 2, 3, 4].map((slot: number) => (
                  <div
                    key={slot}
                    className={`relative w-14 h-16 sm:w-16 sm:h-20 md:w-18 md:h-22 border-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                      selectedToads[slot]
                        ? "border-green-400 bg-green-900/30"
                        : "border-green-400/50 border-dashed bg-green-900/10"
                    }`}
                  >
                    {selectedToads[slot] ? (
                      <>
                        <ToadAvatar size={8} toad={selectedToads[slot]} />
                        <p className="text-white text-2xs  text-center px-1 truncate w-full">
                          {selectedToads[slot]!.name}
                        </p>

                        {!isMixing && (
                          <button
                            onClick={() => handleRemoveToad(slot)}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                          >
                            {ColliderIcons.close}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-green-400/70 text-xl ">+</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Стрелка между слотами */}
              <div className="flex justify-center mb-4">
                <div className="text-green-400">{ColliderIcons.arrow}</div>
              </div>

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

              {/* Список доступных жаб */}
              {!isMixing && (
                <div className="mb-4 h-full">
                  <p className="text-slate-200 text-xs sm:text-sm mb-2 text-center">
                    Нажмите на жаб, чтобы добавить в колбы:
                  </p>
                  <div>
                    <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
                      {availableToads.length === 0 && (
                        <div className="text-slate-500 text-sm py-4">
                          Нет доступных жаб
                        </div>
                      )}
                      {availableToads.map((toad) => {
                        const geneticFaultConfig = getGeneticFaultConfig(
                          toad.state?.genetic_fault,
                        );

                        return (
                          <button
                            key={toad.id}
                            onClick={() => handleSelectToad(toad)}
                            className={`p-2 relative rounded-lg text-xs text-center transition-all flex flex-col items-center w-[100px] max-w-[100px] border ${
                              currentToads.find((t) => t.id === toad.id)
                                ? "bg-purple-600/50 text-white cursor-not-allowed border-purple-500/50"
                                : `text-slate-200 cursor-pointer ${getRarityBackground(
                                    toad.genes.rarity,
                                  )} hover:bg-slate-600/30`
                            }`}
                          >
                            <ToadAvatar size={6} toad={toad} />

                            {toad.pregnancy && (
                              <span className="absolute -top-1 -right-1">
                                <PregnancyIcon />
                              </span>
                            )}

                            {toad.mating && (
                              <span
                                className="absolute -top-1 -left-1 text-xs"
                                title="Ухаживает в репродукторе: беременность стартует через 15–30 мин"
                              >
                                🫧
                              </span>
                            )}

                            <div className="flex items-center gap-1 mb-1 w-full justify-center min-h-[20px]">
                              <ToadGender gender={toad.sex} />
                              <span className="truncate font-medium text-1xs">
                                {toad.name}
                              </span>
                            </div>

                            {/* Качество */}
                            <div
                              className={`text-xs font-bold ${getRarityColor(
                                toad.genes.rarity,
                              )} flex items-center gap-1 mb-1`}
                            >
                              <span className="text-2xs">
                                {getRarityBadge(toad.genes.rarity)}
                              </span>
                              <span>{toad.genes.rarity.toFixed(1)}</span>
                            </div>

                            {/* Генетическая поломка */}
                            <div
                              className={`w-full rounded border px-1 py-0.5 text-2xs font-medium ${geneticFaultConfig.bgColor} ${geneticFaultConfig.borderColor} ${geneticFaultConfig.color}`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>{geneticFaultConfig.icon}</span>
                                <span>{toad.state?.genetic_fault || 0}%</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
