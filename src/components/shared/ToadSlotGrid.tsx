import React from "react";
import { getRarityConfig, Toad } from "../../models/Toad";
import { useModal } from "../ModalContext";
import { ClickButton } from "./ClickButton";
import Modal from "./Header";
import { ToadAvatar } from "./ToadAvatar";
import { ToadPickerGroup, ToadPickerList } from "./ToadPicker";

/**
 * Сетка слотов для жаб — один вид на репродуктор, коллайдер, Медотсек и КОНТУР.
 *
 * Пустой слот — квадрат с пунктирной обводкой и «+» по центру; занятый — аватар жабы,
 * её имя и Качество, а в углу крестик, если жабу можно убрать. Тап по пустому слоту
 * открывает модалку выбора (`ToadPickerList`), тап по занятому — карточку жабы.
 * Выпадающих списков внутри этих модалок больше нет: список жаб живёт в отдельном окне,
 * где ему хватает места и на группы, и на причины отказа.
 *
 * Место описывает только свои правила выбора (`pickerFor`) и свои действия (`onPick`,
 * `onOpen`, `onRemove`), а вид слотов и модалки — здесь, один на всех.
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
  /** Где жаба живёт сейчас — строкой списка */
  locationOf?: (toad: Toad) => string | null;
}

/** Один слот сетки: жаба в нём (или пусто) и подпись места */
export interface ToadSlotItem {
  toad: Toad | null;
  /** Подпись слота: «Слот самки», «Койка 3», «Жаба 2» */
  label: string;
  /** Значок слота перед подписью (♀, ♂, 🛏️) */
  icon?: React.ReactNode;
  /**
   * Короткая подпись на занятом слоте поверх Качества: сила роли в КОНТУРе,
   * готовность к паре и т.п. На пустом слоте не показывается.
   */
  badge?: React.ReactNode;
  /** Почему слот нельзя заполнить — подсказка пустого слота */
  disabledHint?: string;
}

export interface ToadSlotGridProps {
  slots: ToadSlotItem[];
  /** Колонок на широком экране; на телефоне сетка переносит слоты сама */
  columns?: 2 | 3 | 4 | 5 | 6;
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
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-slate-600/50 bg-slate-900/70">
        <div className="max-h-[60vh] overflow-y-auto">
          <ToadPickerList
            label={slotLabel}
            groups={picker.groups}
            rejected={picker.rejected}
            hint={picker.hint}
            emptyText={picker.emptyText}
            locationOf={picker.locationOf}
            onPick={pick}
          />
        </div>
      </div>
    </Modal>
  );
};

/**
 * Сетка слотов: пустой слот открывает модалку выбора, занятый — карточку жабы,
 * крестик убирает жабу из слота. Все модалки секторов описывают только правила.
 */
export const ToadSlotGrid: React.FC<ToadSlotGridProps> = ({
  slots,
  columns = 2,
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
          const rarity = toad ? getRarityConfig(toad.genes.rarity) : null;

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
              className={`relative max-w-[250px] flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition-colors duration-300 ${
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
                  <span className={`text-3xs ${rarity?.color ?? ""}`}>
                    {rarity?.icon} {toad.genes.rarity.toFixed(1)}
                  </span>
                  {slot.badge != null && (
                    <span className="max-w-full truncate text-3xs font-semibold text-amber-200">
                      {slot.badge}
                    </span>
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
