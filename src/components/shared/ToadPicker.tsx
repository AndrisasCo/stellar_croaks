import React, { useEffect, useMemo, useRef, useState } from "react";
import { getRarityConfig, Toad } from "../../models/Toad";
import {
  getToadPickerBrief,
  getToadRarityLine,
  getToadSexIcon,
} from "../../utils/toad-picker";
import { ClickButton } from "./ClickButton";

/**
 * Общий список жаб и выпадающая панель со всеми доступными жабами.
 *
 * Жабу сажают в слот в нескольких местах: репродуктор (`NestModal`), коллайдер
 * (`ToadColliderModal`) и Медотсек (`HospitalModal`) открывают список модалкой
 * (`shared/ToadSlotGrid` → `ToadPickerList`), а энергосектор ⚡ (`PowerRoomModal`) и роль
 * в походе (`ExpeditionModal`) — выпадающей панелью (`ToadPicker`). Раньше у каждого места
 * был свой список: где-то кнопка с панелью, где-то цветные карточки. Теперь место описывает
 * только **свои правила** (кого вообще можно взять и почему нет), а вид строки, сортировка,
 * краткая информация и поведение списка — здесь, одни на всех.
 *
 * Строка слота — кнопка: жаба в слоте (имя, Качество, `pickedSummary`) или приглашение; тап
 * раскрывает панель. В строке списка у каждой жабы одна и та же краткая информация
 * (`utils/toad-picker.ts` → `getToadPickerBrief`: пол, стадия, силы ⚡ и сытость 🍽), Качество
 * строкой и место в колонии (📍, если место передало `locationOf`), а ниже — своя заметка
 * слота (сила роли, готовность к паре) и, если нужно, полоска-показатель.
 *
 * Жабы, которых взять нельзя, из панели не исчезают: они спрятаны за переключателем
 * «Не подходят» **с причиной отказа** у каждой — игрок видит, почему его жабы нет в списке,
 * и не ищет ответ в другом месте.
 *
 * Поведение панели: закрывается тапом мимо и клавишей Esc (Esc гасим в capture-фазе, иначе
 * нажатие закрыло бы всю модалку — `ModalProvider` слушает ту же клавишу), а если снизу
 * не хватает места — раскрывается вверх, не уезжая за край экрана.
 */

/** Строка списка: жаба и её краткая информация в контексте слота */
export interface ToadPickerItem {
  toad: Toad;
  /**
   * Место в списке: больше — выше (Качество, сила роли, сытость).
   * Без места строка остаётся там, куда её поставил слот (порядок не переставляется).
   */
  rank?: number;
  /** Текст под именем: своё у каждого места (сила роли, готовность к паре, сытость) */
  note?: React.ReactNode;
  /** Показатель справа: полоска с подписью (проценты силы роли) */
  meter?: { value: number; label: string };
  /** Подсветка строки: жаба в слоте или занята другим слотом */
  tone?: "default" | "selected" | "warn";
  /** Почему жабу взять нельзя: строка гаснет и не нажимается */
  reason?: string | null;
}

/** Группа строк списка с заголовком */
export interface ToadPickerGroup {
  label: string;
  items: ToadPickerItem[];
}

/** Высота панели списка (max-h-60 = 15rem) — по ней решаем, открывать список вверх или вниз */
const MENU_HEIGHT = 240;

/** Строки по убыванию места в списке; при равных местах порядок не трогаем (sort стабилен) */
const sortItems = (items: ToadPickerItem[]): ToadPickerItem[] =>
  [...items].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

/** Цвет полоски-показателя: зелёный — хорошо, янтарный — середина, красный — плохо */
const getMeterColor = (percent: number): string =>
  percent >= 70
    ? "bg-emerald-400"
    : percent >= 40
      ? "bg-amber-400"
      : "bg-red-400";

/** Строка жабы в раскрытом списке: имя, Качество, краткая сводка и место в колонии */
const ToadPickerRow: React.FC<{
  item: ToadPickerItem;
  /** Название слота — идёт в подсказку строки */
  label: string;
  locationOf?: (toad: Toad) => string | null;
  onPick: (toad: Toad) => void;
}> = ({ item, label, locationOf, onPick }) => {
  const { toad } = item;
  const rarity = getRarityConfig(toad.genes.rarity);
  const blocked = Boolean(item.reason);
  const location = locationOf?.(toad) ?? null;
  const percent = item.meter ? Math.max(0, Math.min(100, item.meter.value)) : 0;
  const tone = blocked
    ? ""
    : item.tone === "selected"
      ? "bg-emerald-900/40 hover:bg-emerald-800/50"
      : item.tone === "warn"
        ? "bg-amber-900/30 hover:bg-amber-800/40"
        : "hover:bg-slate-700/60";

  return (
    <ClickButton
      type="button"
      disabled={blocked}
      onClick={() => onPick(toad)}
      title={
        blocked
          ? `${toad.name}: ${item.reason}`
          : `Взять ${toad.name} в «${label}»`
      }
      className={`flex w-full items-center gap-2 border-b border-slate-700/30 px-2 py-1.5 text-left transition-colors duration-300 last:border-0 ${
        blocked ? "cursor-not-allowed opacity-60" : tone
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-2xs font-semibold ${
              blocked ? "text-slate-400" : "text-slate-100"
            }`}
          >
            {getToadSexIcon(toad.sex)} {toad.name}
          </span>
          <span className={`shrink-0 text-2xs ${rarity.color}`}>
            {getToadRarityLine(toad)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-2xs text-slate-400">
          <div className="truncate">
            {blocked ? item.reason : getToadPickerBrief(toad)}
          </div>
          {location && <div className="shrink-0">· 📍{location}</div>}
          {/* Заметка места — своя разметка (сила роли, полоски), поэтому держим её блоком */}
          {item.note && <div className="min-w-0 flex-1">· {item.note}</div>}
        </div>
      </div>

      {item.meter && (
        <div className="w-12 shrink-0 text-right">
          <p className="text-2xs font-bold text-amber-200">
            {item.meter.label}
          </p>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className={`h-full rounded-full ${getMeterColor(percent)}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </ClickButton>
  );
};

/** Содержимое панели списка: общее для выпадающего `ToadPicker` и модалки слота */
export interface ToadPickerListProps {
  /** Название слота — идёт в подсказку строки */
  label: string;
  /** Группы жаб, которых можно взять (пустые группы не рисуются) */
  groups: ToadPickerGroup[];
  /** Жабы, которых взять нельзя: за переключателем, у каждой — причина отказа */
  rejected?: ToadPickerGroup;
  /** Подсказка вверху списка: правила слота */
  hint?: React.ReactNode;
  /** Что сказать, когда взять некого */
  emptyText?: string;
  /** Пункт «убрать жабу из слота» (показывается, когда жаба выбрана) */
  clear?: { label: string; onClear: () => void };
  /** Где жаба живёт сейчас — строкой списка (нет функции — места не видно) */
  locationOf?: (toad: Toad) => string | null;
  /** Куда сообщить выбор жабы */
  onPick: (toad: Toad) => void;
}

/**
 * Список жаб с группами и причинами отказа — без оболочки панели.
 *
 * Его используют и выпадающий `ToadPicker` (внутри панели под строкой слота),
 * и модалка выбора из `ToadSlotGrid`: строки, сортировка и «Не подходят»
 * у всех одни и те же.
 */
export const ToadPickerList: React.FC<ToadPickerListProps> = ({
  label,
  groups,
  rejected,
  hint,
  emptyText = "Свободных жаб нет.",
  clear,
  locationOf,
  onPick,
}) => {
  /** Отсеянные жабы спрятаны: список открывается теми, кого можно взять */
  const [showRejected, setShowRejected] = useState(false);

  const sortedGroups = useMemo(
    () =>
      groups
        .map((group) => ({ ...group, items: sortItems(group.items) }))
        .filter((group) => group.items.length > 0),
    [groups],
  );

  const rejectedItems = useMemo(
    () =>
      sortItems(rejected?.items ?? []).filter((item) => Boolean(item.reason)),
    [rejected],
  );

  const availableCount = sortedGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  return (
    <>
      {hint && (
        <p className="sticky top-0 z-10 bg-slate-900/95 px-2 py-1.5 text-2xs leading-snug text-slate-400">
          {hint}
        </p>
      )}

      {clear && (
        <ClickButton
          type="button"
          onClick={clear.onClear}
          className="w-full border-b border-slate-700/40 px-2 py-1.5 text-left text-2xs text-slate-400 transition-colors duration-300 hover:bg-slate-700/60"
        >
          ✕ {clear.label}
        </ClickButton>
      )}

      {availableCount === 0 && (
        <p className="px-2 py-3 text-2xs leading-snug text-slate-400">
          {emptyText}
        </p>
      )}

      {sortedGroups.map((group) => (
        <div key={group.label}>
          <p className="bg-slate-800/80 px-2 py-1 text-2xs uppercase tracking-wide text-amber-200/80">
            {group.label}
          </p>
          {group.items.map((item) => (
            <ToadPickerRow
              key={item.toad.id}
              item={item}
              label={label}
              locationOf={locationOf}
              onPick={onPick}
            />
          ))}
        </div>
      ))}

      {rejectedItems.length > 0 && (
        <div className="border-t border-slate-700/40">
          <ClickButton
            type="button"
            onClick={() => setShowRejected((prev) => !prev)}
            className={`w-full px-2 py-1.5 text-left text-2xs transition-colors duration-300 hover:bg-slate-700/60 ${
              showRejected ? "text-slate-300" : "text-slate-400"
            }`}
          >
            {showRejected ? "▾" : "▸"} {rejected?.label ?? "Не подходят"}:{" "}
            {rejectedItems.length}
          </ClickButton>

          {showRejected &&
            rejectedItems.map((item) => (
              <ToadPickerRow
                key={`rejected-${item.toad.id}`}
                item={item}
                label={label}
                locationOf={locationOf}
                onPick={onPick}
              />
            ))}
        </div>
      )}
    </>
  );
};

export interface ToadPickerProps {
  /** Значок слота (♀, ♂, 🥷) — стоит перед подписью, как на карте */
  icon?: string;
  /** Подпись слота («Слот самки», «Энергосектор») — серая, перед именем жабы */
  caption?: string;
  /** Название слота целиком: идёт в подсказки и aria-атрибуты */
  label: string;
  /** Жаба, которая уже стоит в слоте: без неё строка показывает приглашение */
  picked?: Toad | null;
  /**
   * Не повторять в строке слота имя и Качество выбранной жабы: их показывает
   * карточка рядом (`shared/ToadListCard`). Строка остаётся кнопкой «Заменить».
   */
  hidePickedDetails?: boolean;
  /** Текст строки, когда жабы в слоте нет */
  placeholder?: string;
  /** Краткая информация о выбранной жабе в строке слота (⚡, проценты роли) */
  pickedSummary?: React.ReactNode;
  /** Группы жаб, которых можно взять (пустые группы не рисуются) */
  groups: ToadPickerGroup[];
  /** Жабы, которых взять нельзя: за переключателем, у каждой — причина отказа */
  rejected?: ToadPickerGroup;
  /** Подсказка вверху раскрытого списка: правила слота */
  hint?: React.ReactNode;
  /** Что сказать, когда взять некого */
  emptyText?: string;
  /** Пункт «убрать жабу из слота» (показывается, когда жаба выбрана) */
  clear?: { label: string; onClear: () => void };
  /** Где жаба живёт сейчас — строкой списка (нет функции — места не видно) */
  locationOf?: (toad: Toad) => string | null;
  /** Куда сообщить выбор жабы */
  onPick: (toad: Toad) => void;
  /** Слот недоступен: строка гаснет и не раскрывается */
  disabled?: boolean;
  className?: string;
}

/** Выпадающий список жаб: строка слота + панель со всеми доступными жабами */
export const ToadPicker: React.FC<ToadPickerProps> = ({
  icon,
  caption,
  label,
  picked,
  hidePickedDetails = false,
  placeholder = "— выбрать жабу —",
  pickedSummary,
  groups,
  rejected,
  hint,
  emptyText = "Свободных жаб нет.",
  clear,
  locationOf,
  onPick,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  /** Не хватает места снизу — список раскрывается вверх: иначе он уходит за край экрана */
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const measure = () => {
      const rect = rootRef.current?.getBoundingClientRect();

      if (rect) {
        setDropUp(window.innerHeight - rect.bottom < MENU_HEIGHT);
      }
    };

    measure();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", measure);
    // Тело модалки скроллится: список едет вместе с ним, поэтому направление пересчитываем
    window.addEventListener("scroll", measure, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  const toggleOpen = () => {
    setOpen((prev) => !prev);
  };

  const pick = (toad: Toad) => {
    onPick(toad);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 flex-1 ${className ?? ""}`}>
      <ClickButton
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={
          picked ? `Заменить жабу в «${label}»` : `Взять жабу в «${label}»`
        }
        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors duration-300 ${
          disabled
            ? "cursor-not-allowed border-slate-600/30 opacity-60"
            : open
              ? "border-amber-400/60 bg-slate-800/90"
              : "border-slate-600/40 bg-slate-800/70 hover:bg-slate-700/70"
        }`}
      >
        {icon && <span className="shrink-0 text-2xs">{icon}</span>}
        {caption && (
          <span className="shrink-0 text-2xs text-slate-400">{caption}</span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-left text-2xs ${
            picked ? "text-slate-100" : "text-slate-400"
          }`}
        >
          {picked
            ? hidePickedDetails
              ? "Заменить"
              : picked.name
            : placeholder}
        </span>
        {picked && !hidePickedDetails && (
          <span
            className={`shrink-0 text-2xs ${
              getRarityConfig(picked.genes.rarity).color
            }`}
          >
            {getToadRarityLine(picked)}
          </span>
        )}
        {picked && !hidePickedDetails && pickedSummary}
        <span
          className={`shrink-0 text-3xs text-slate-400 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </ClickButton>

      {open && (
        <div
          className={`no-overscroll absolute left-0 right-0 z-30 max-h-60 overflow-y-auto rounded-xl border border-slate-600/50 bg-slate-900/95 shadow-xl backdrop-blur-md ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <ToadPickerList
            label={label}
            groups={groups}
            rejected={rejected}
            hint={hint}
            emptyText={emptyText}
            clear={
              clear && picked
                ? {
                    label: clear.label,
                    onClear: () => {
                      clear.onClear();
                      setOpen(false);
                    },
                  }
                : undefined
            }
            locationOf={locationOf}
            onPick={pick}
          />
        </div>
      )}
    </div>
  );
};
