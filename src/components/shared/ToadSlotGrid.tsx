import React from "react";
import {
  getGeneticFaultConfig,
  getPersonalityLabel,
  getRarityConfig,
  Toad,
} from "../../models/Toad";
import { getToadDisease, isToadSick } from "../../models/disease";
import {
  getToadHp,
  getToadHpStatusLabel,
  getToadMaxHp,
} from "../../utils/expedition-config";
import {
  getToadEnergy,
  getToadMaxEnergy,
  PRODUCTION_MIN_HUNGER,
} from "../../utils/gamification-config";
import { getToadRarityLine } from "../../utils/toad-picker";
import { getHungerBarColor, getHungerTextColor } from "../../utils/hunger";
import { useModal } from "../ModalContext";
import { ClickButton } from "./ClickButton";
import Modal from "./Header";
import { ToadAvatar } from "./ToadAvatar";
import { getMeterColor, ToadPickerGroup, ToadPickerList } from "./ToadPicker";

/**
 * Сетка слотов для жаб — один вид на репродуктор, коллайдер, Медотсек, энергосектор и КОНТУР.
 *
 * Пустой слот — квадрат с пунктирной обводкой и «+» по центру; занятый — аватар жабы,
 * её имя и характеристики, важные именно этому месту (`vitals`), а в углу крестик, если
 * жабу можно убрать. Тап по пустому слоту открывает модалку выбора (`ToadPickerList`),
 * тап по занятому — карточку жабы. Выпадающих списков внутри этих модалок больше нет:
 * список жаб живёт в отдельном окне, где ему хватает места и на группы, и на причины отказа.
 *
 * Место описывает только свои правила выбора (`pickerFor`), свои характеристики (`vitals`)
 * и свои действия (`onPick`, `onOpen`, `onRemove`), а вид слотов и модалки — здесь, один на всех.
 */

/** Правила выбора жаб для слота: те же группы, что у выпадающего списка */
export interface ToadSlotPickerConfig {
  /** Жабы, которых можно взять (пустые группы не рисуются) */
  groups: ToadPickerGroup[];
  /** Жабы, которых взять нельзя: за переключателем, у каждой — причина отказа */
  rejected?: ToadPickerGroup;
  /** Подсказка вверху списка: правила слота */
  hint?: React.ReactNode;
  /** Что сказать, когда взять некого */
  emptyText?: string;
}

/** Какие характеристики показывает занятый слот: у каждого места они свои */
export interface ToadSlotVitals {
  /** ❤️ здоровье с полоской */
  hp?: boolean;
  /** ⚡ силы с полоской */
  energy?: boolean;
  /** 🍽 сытость с полоской (энергосектор: по ней жаба даёт ток) */
  hunger?: boolean;
  /** Качество строкой (репродуктор: пару собирают из лучших жаб) */
  rarity?: boolean;
  /**
   * Полный набор характеристик (коллайдер: по ним сравнивают жаб):
   * качество, поломка, поколение, вес, скорость, аппетит, плодовитость и характер.
   * Качество уже входит в набор, поэтому вместе с `rarity` его не дублируем.
   */
  genetics?: boolean;
  /** Болезнь: плашка с названием, если жаба болеет */
  disease?: boolean;
}

/**
 * Показатель под характеристиками слота: подпись, проценты и полоска — тот же вид,
 * что у плитки в списке выбора (`shared/ToadPicker`), чтобы сила роли читалась одинаково.
 */
export interface ToadSlotMeter {
  /** Заполнение полоски, 0..100 */
  value: number;
  /** Подпись справа: «68%» */
  label: string;
  /** Характеристика слева, обычно сокращённо: «Скор. 1.55» */
  detail?: string;
  /** Полное название характеристики для подсказки: «Скорость 1.55» */
  detailTitle?: string;
  /** Подпись под полоской: «Подходит» */
  caption?: string;
}

/** Один слот сетки: жаба в нём (или пусто) и подпись места */
export interface ToadSlotItem {
  toad: Toad | null;
  /** Подпись слота: «Слот самки», «Койка 3», «Жаба 2» */
  label: string;
  /** Значок слота перед подписью (♀, ♂, 🛏️) */
  icon?: React.ReactNode;
  /** Показатель с полоской на занятом слоте: сила роли в КОНТУРе и т.п. */
  meter?: ToadSlotMeter;
  /** Почему слот нельзя заполнить — подсказка пустого слота */
  disabledHint?: string;
}

export interface ToadSlotGridProps {
  slots: ToadSlotItem[];
  /** Колонок на широком экране; на телефоне сетка переносит слоты сама */
  columns?: 2 | 3 | 4 | 5 | 6;
  /** Что показывать на занятом слоте: без набора — HP и силы, как было у всех мест */
  vitals?: ToadSlotVitals;
  /** Заголовок блока */
  title?: React.ReactNode;
  /** Подпись справа от заголовка: имя сектора, свободные места */
  headerRight?: React.ReactNode;
  /** Правила выбора для слота: без них слот не открывает список */
  pickerFor?: (slotIndex: number) => ToadSlotPickerConfig | null;
  /** Куда сообщить выбранную жабу */
  onPick?: (toad: Toad, slotIndex: number) => void;
  /** Тап по занятому слоту — открыть карточку жабы */
  onOpen?: (toad: Toad, slotIndex: number) => void;
  /** Крестик в углу занятого слота — убрать жабу из слота */
  onRemove?: (toad: Toad, slotIndex: number) => void;
  /** Подсказка крестика: «Вернуть в биопод», «Выписать» и т.п. */
  removeLabel?: string;
  /** Содержимое под сеткой: описание ролей, сводка по слотам и т.п. */
  footer?: React.ReactNode;
  /** Весь блок недоступен: идёт смешивание или у сектора нет тока */
  disabled?: boolean;
  /** Размер аватара жабы в слоте (ToadAvatar умножает его на 4) */
  avatarSize?: number;
  className?: string;
}

/** Классы сетки: на телефоне слотов меньше в ряд, чтобы квадраты оставались крупными */
const GRID_COLUMNS: Record<
  NonNullable<ToadSlotGridProps["columns"]>,
  string
> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-6",
};

/** Без набора характеристик слот показывает то же, что и раньше: здоровье и силы */
const DEFAULT_VITALS: ToadSlotVitals = { hp: true, energy: true };

interface ToadSlotPickerModalProps {
  /** Подпись слота: «Слот самки», «Койка 3» */
  slotLabel: string;
  /** Значок слота для заголовка */
  icon?: React.ReactNode;
  picker: ToadSlotPickerConfig;
  onPick: (toad: Toad) => void;
}

/** Модалка выбора жабы в слот: тот же список, что у выпадающего `ToadPicker` */
const ToadSlotPickerModal: React.FC<ToadSlotPickerModalProps> = ({
  slotLabel,
  icon,
  picker,
  onPick,
}) => {
  const { closeModal } = useModal();
  const pick = (toad: Toad) => {
    onPick(toad);
    closeModal?.();
  };

  return (
    <Modal title={`Выбрать жабу · ${slotLabel}`} icon={icon}>
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-600/50 bg-slate-900/70">
        <ToadPickerList
          label={slotLabel}
          groups={picker.groups}
          rejected={picker.rejected}
          hint={picker.hint}
          emptyText={picker.emptyText}
          onPick={pick}
        />
      </div>
    </Modal>
  );
};

/**
 * Показатель в слоте: значок и число, под ними — полоска запаса.
 *
 * Слот — маленький квадрат, поэтому вместо подписи «HP 168/168» здесь только число:
 * текущее значение, а максимум и статус живут в подсказке. Цвет полоски и числа
 * задаёт вызывающий — у HP и энергии разные шкалы (`hpBarClass` / `energyBarClass`).
 */
const SlotVital: React.FC<{
  icon: string;
  value: number;
  max: number;
  barClassName: string;
  valueClassName: string;
  title: string;
}> = ({ icon, value, max, barClassName, valueClassName, title }) => {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <span
      title={title}
      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md border border-white/10 bg-slate-950/50 px-1 py-0.5"
    >
      <span
        className={`flex items-center gap-0.5 text-3xs font-semibold leading-none tabular-nums ${valueClassName}`}
      >
        <span aria-hidden>{icon}</span>
        {Math.round(value)}
      </span>
      <span
        aria-hidden
        className="h-0.5 w-full overflow-hidden rounded-full bg-slate-700/70"
      >
        <span
          className={`block h-full rounded-full transition-all duration-500 ${barClassName}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </span>
  );
};

/**
 * Одна характеристика в блоке генетики: подпись слева, значение справа.
 *
 * Слот узкий, поэтому длинные строки (плодовитость, характер) занимают обе
 * колонки, а полное значение всегда доступно в подсказке.
 */
const SlotGene: React.FC<{
  label: string;
  value: React.ReactNode;
  title: string;
  valueClassName?: string;
  className?: string;
}> = ({
  label,
  value,
  title,
  valueClassName = "text-slate-200",
  className = "",
}) => (
  <span
    title={title}
    className={`flex min-w-0 items-baseline justify-between gap-1 ${className}`}
  >
    <span className="shrink-0 text-slate-500">{label}</span>
    <span
      className={`min-w-0 truncate text-right font-semibold tabular-nums ${valueClassName}`}
    >
      {value}
    </span>
  </span>
);

/**
 * Полная генетика жабы для коллайдера: то, по чему игрок сравнивает жаб перед
 * смешиванием. Здоровье и силы сюда не входят — их место в других секторах.
 */
const SlotGenetics: React.FC<{ toad: Toad }> = ({ toad }) => {
  const rarity = getRarityConfig(toad.genes.rarity);
  const fault = getGeneticFaultConfig(toad.state?.genetic_fault);
  const faultValue = toad.state?.genetic_fault ?? 0;

  return (
    <div className="grid w-full grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-slate-400">
      <SlotGene
        label="Кач."
        value={toad.genes.rarity.toFixed(1)}
        title={`Качество: ${rarity.icon} ${rarity.label} · ${toad.genes.rarity.toFixed(1)}`}
        valueClassName={rarity.color}
      />
      <SlotGene
        label="Пол."
        value={`${faultValue}%`}
        title={`Поломка: ${fault.icon} ${fault.label} · ${faultValue}%`}
        valueClassName={fault.color}
      />

      <SlotGene
        label="Вес"
        value={toad.genes.weight.toFixed(1)}
        title={`Вес: ${toad.genes.weight.toFixed(1)}`}
      />
      <SlotGene
        label="Скор."
        value={toad.genes.speed.toFixed(1)}
        title={`Скорость: ${toad.genes.speed.toFixed(1)}`}
      />
      <SlotGene
        label="Апп."
        value={toad.genes.hungerRate.toFixed(1)}
        title={`Аппетит: ${toad.genes.hungerRate.toFixed(1)}`}
      />
      <SlotGene
        label="Плод."
        value={toad.genes.fertility.toFixed(1)}
        title={`Плодовитость: ${toad.genes.fertility.toFixed(1)}`}
      />
    </div>
  );
};

/**
 * Сетка слотов: пустой слот открывает модалку выбора, занятый — карточку жабы,
 * крестик убирает жабу из слота. Все модалки секторов описывают только правила.
 */
export const ToadSlotGrid: React.FC<ToadSlotGridProps> = ({
  slots,
  columns = 2,
  vitals: slotVitals,
  title,
  headerRight,
  pickerFor,
  onPick,
  onOpen,
  onRemove,
  removeLabel = "Убрать жабу",
  footer,
  disabled = false,
  avatarSize = 10,
  className = "",
}) => {
  const { openModal } = useModal();

  /** Пустой слот: список жаб открывается отдельной модалкой поверх сектора */
  const openPicker = (slot: ToadSlotItem, slotIndex: number) => {
    const picker = pickerFor?.(slotIndex);

    if (!picker || !onPick) {
      return;
    }

    openModal(
      () => (
        <ToadSlotPickerModal
          slotLabel={slot.label}
          icon={slot.icon}
          picker={picker}
          onPick={(toad) => onPick(toad, slotIndex)}
        />
      ),
      { className: "md:max-w-2xl", animation: "zoom" },
    );
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-slate-500/30 bg-color-main px-3 py-2 ${className}`}
    >
      {(title || headerRight) && (
        <div className="flex items-center justify-between gap-2">
          {title && (
            <span className="text-xs font-semibold text-cyan-200">{title}</span>
          )}
          {headerRight && (
            <span className="shrink-0 text-2xs text-slate-400">
              {headerRight}
            </span>
          )}
        </div>
      )}

      <div className={`grid gap-2 ${GRID_COLUMNS[columns]}`}>
        {slots.map((slot, index) => {
          const toad = slot.toad;
          const canOpenToad = !disabled && Boolean(toad) && Boolean(onOpen);
          const canOpenPicker =
            !disabled && !toad && Boolean(onPick) && Boolean(pickerFor);
          const canRemove = !disabled && Boolean(toad) && Boolean(onRemove);
          const clickable = canOpenToad || canOpenPicker;
          const hp = toad ? Math.round(getToadHp(toad)) : 0;
          const maxHp = toad ? getToadMaxHp(toad) : 0;
          const energy = toad ? Math.round(getToadEnergy(toad)) : 0;
          const maxEnergy = toad ? getToadMaxEnergy(toad) : 0;
          /** Характеристики места: без набора — прежние HP и силы */
          const vitals = slotVitals ?? DEFAULT_VITALS;
          const hunger = toad
            ? Math.max(0, Math.min(100, toad.state?.hunger ?? 0))
            : 0;
          const disease =
            toad && vitals.disease && isToadSick(toad)
              ? getToadDisease(toad)
              : null;
          const rarity = toad ? getRarityConfig(toad.genes.rarity) : null;
          const meterPercent = slot.meter
            ? Math.max(0, Math.min(100, slot.meter.value))
            : 0;

          // HP: та же шкала, что у `HpBar` и полоски в карточке жабы (зелёный → жёлтый → красный)
          const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
          const hpBarClass =
            hpRatio <= 0
              ? "bg-red-600"
              : hpRatio < 0.35
                ? "bg-red-500"
                : hpRatio < 0.7
                  ? "bg-yellow-500"
                  : "bg-green-500";
          const hpValueClass =
            hpRatio <= 0
              ? "text-red-300"
              : hpRatio < 0.7
                ? "text-rose-200"
                : "text-slate-200";

          // Энергия: изумрудный акцент проекта, ниже половины — янтарный, ниже 20% — розовый
          const energyRatio =
            maxEnergy > 0 ? Math.max(0, Math.min(1, energy / maxEnergy)) : 0;
          const energyBarClass =
            energyRatio >= 0.5
              ? "bg-lime-400"
              : energyRatio >= 0.2
                ? "bg-amber-400"
                : "bg-rose-500";
          const energyValueClass =
            energyRatio >= 0.5
              ? "text-lime-300"
              : energyRatio >= 0.2
                ? "text-amber-300"
                : "text-rose-300";

          // Сытость: те же цвета и пороги, что у полоски в карточке жабы
          const hungerBarClass = getHungerBarColor(hunger);
          const hungerValueClass = getHungerTextColor(hunger);

          return (
            <ClickButton
              key={`toad-slot-${index}`}
              type="button"
              disabled={!clickable && !canRemove}
              aria-disabled={!clickable && !canRemove}
              onClick={() => {
                if (toad) {
                  onOpen?.(toad, index);
                  return;
                }

                openPicker(slot, index);
              }}
              title={
                toad
                  ? `${toad.name} · ${slot.label}`
                  : (slot.disabledHint ?? `${slot.label}: выбрать жабу`)
              }
              className={`relative m-auto max-w-[250px] flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition-colors duration-300 ${
                toad
                  ? "border-solid border-emerald-500/40 bg-emerald-500/5 hover:border-cyan-300/60 hover:bg-emerald-500/10"
                  : "border-dashed border-slate-500/60 bg-slate-950/20 hover:border-cyan-300/60 hover:bg-slate-800/40"
              } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              {toad ? (
                <>
                  <ToadAvatar size={avatarSize} toad={toad} />
                  <span className="w-full truncate text-center text-2xs font-semibold text-slate-100">
                    {toad.name}
                  </span>

                  {/* Болезнь: название важнее остальных показателей — её лечат первой */}
                  {disease && (
                    <span
                      title={`${disease.name}: ${disease.description}`}
                      className="flex w-full min-w-0 items-center justify-center gap-0.5 rounded border border-orange-400/30 bg-orange-500/10 px-1 py-0.5 text-3xs leading-none text-orange-200"
                    >
                      <span aria-hidden>{disease.icon}</span>
                      <span className="truncate">{disease.name}</span>
                    </span>
                  )}

                  {/* Качество строкой: репродуктор и списки сравнивают жаб по нему */}
                  {vitals.rarity && !vitals.genetics && rarity && (
                    <span
                      className={`w-full truncate text-center text-3xs leading-tight ${rarity.color}`}
                    >
                      {getToadRarityLine(toad)}
                    </span>
                  )}

                  {/* Коллайдер: все гены и происхождение, без здоровья и сил */}
                  {vitals.genetics && <SlotGenetics toad={toad} />}

                  {(vitals.hp || vitals.energy || vitals.hunger) && (
                    <div className="flex w-full items-stretch gap-1">
                      {vitals.hp && (
                        <SlotVital
                          icon="❤️"
                          value={hp}
                          max={maxHp}
                          barClassName={hpBarClass}
                          valueClassName={hpValueClass}
                          title={`Здоровье: ${hp} / ${maxHp} · ${getToadHpStatusLabel(toad)}`}
                        />
                      )}
                      {vitals.energy && (
                        <SlotVital
                          icon="⚡️"
                          value={energy}
                          max={maxEnergy}
                          barClassName={energyBarClass}
                          valueClassName={energyValueClass}
                          title={`Силы: ${energy} / ${maxEnergy}`}
                        />
                      )}
                      {vitals.hunger && (
                        <SlotVital
                          icon="🍽"
                          value={hunger}
                          max={100}
                          barClassName={hungerBarClass}
                          valueClassName={hungerValueClass}
                          title={
                            hunger <= PRODUCTION_MIN_HUNGER
                              ? `Сытость: ${hunger} / 100 · ниже ${PRODUCTION_MIN_HUNGER}% жаба не даёт ток и хуже вырабатывает биомассу`
                              : `Сытость: ${hunger} / 100`
                          }
                        />
                      )}
                    </div>
                  )}

                  {/* Показатель места: та же полоска, что у плитки в списке выбора */}
                  {slot.meter && (
                    <div className="mt-auto flex w-full flex-col gap-0.5">
                      <div className="flex w-full items-baseline justify-between gap-1">
                        {slot.meter.detail && (
                          <span
                            title={slot.meter.detailTitle ?? slot.meter.detail}
                            className="min-w-0 flex-1 truncate text-3xs text-slate-400"
                          >
                            {slot.meter.detail}
                          </span>
                        )}
                        <span className="shrink-0 text-2xs font-bold text-amber-200">
                          {slot.meter.label}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-700">
                        <div
                          className={`h-full rounded-full ${getMeterColor(
                            meterPercent,
                          )}`}
                          style={{ width: `${meterPercent}%` }}
                        />
                      </div>
                      {slot.meter.caption && (
                        <p className="w-full truncate text-center text-3xs leading-tight text-slate-400">
                          {slot.meter.caption}
                        </p>
                      )}
                    </div>
                  )}

                  {canRemove && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`${removeLabel}: ${toad.name}`}
                      title={removeLabel}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove?.(toad, index);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();
                        onRemove?.(toad, index);
                      }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-rose-400/60 bg-rose-600/90 text-xs leading-none text-white transition-colors hover:bg-rose-500"
                    >
                      ×
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-2xl leading-none text-cyan-300/70">
                    +
                  </span>
                  <span className="w-full truncate text-center text-3xs text-slate-400">
                    {slot.icon && <span className="mr-1">{slot.icon}</span>}
                    {slot.label}
                  </span>
                </>
              )}
            </ClickButton>
          );
        })}
      </div>

      {footer}
    </div>
  );
};
