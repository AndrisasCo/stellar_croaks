import React, { useEffect, useMemo, useRef, useState } from "react";
import { getRarityConfig, Toad } from "../../models/Toad";
import { useColony } from "../../hooks/use-colony";
import { useGameState } from "../../hooks/use-game-state";
import {
  ToadPickerLocation,
  getToadPickerLocation,
  getToadRarityLine,
  getToadSexIcon,
} from "../../utils/toad-picker";
import { ClickButton } from "./ClickButton";
import { IconText } from "./CurrencyIcon";
import { ToadAvatar } from "./ToadAvatar";
import { ToadLocationBadge } from "./ToadLocationBadge";
import { getToadEnergy } from "../../utils/gamification-config";

/**
 * Общий список жаб и выпадающая панель со всеми доступными жабами.
 *
 * Жабу сажают в слот в нескольких местах: репродуктор (`NestModal`), коллайдер
 * (`ToadColliderModal`), Медотсек (`HospitalModal`) и энергосектор ⚡ (`PowerRoomModal`)
 * открывают список модалкой (`shared/ToadSlotGrid` → `ToadPickerList`), а роль
 * в походе (`ExpeditionModal`) — выпадающей панелью (`ToadPicker`). Раньше у каждого места
 * был свой список: где-то кнопка с панелью, где-то цветные карточки. Теперь место описывает
 * только **свои правила** (кого вообще можно взять и почему нет), а вид плитки, сортировка,
 * краткая информация и поведение списка — здесь, одни на всех.
 *
 * Строка слота — кнопка: жаба в слоте (имя, Качество, `pickedSummary`) или приглашение; тап
 * раскрывает панель. Жабы в списке — не строки во всю ширину, а плитки сетки: сверху аватар,
 * имя и Качество, под ними силы ⚡ и место в колонии (`getToadPickerLocation`: сектор или
 * биопод), ниже — своя заметка слота (здоровье, готовность к паре) и, если нужно,
 * показатель с подписью (процент соответствия роли и характеристика). Колонки сетка
 * подбирает по ширине панели, поэтому в модалке видно 2–3 жабы в ряд, а в узком списке —
 * одну. Место видно у всех мест одинаково, поэтому список не теряет его, когда модалка
 * передаёт свои правила отбора.
 *
 * Жабы, которых взять нельзя, из панели не исчезают: они спрятаны за переключателем
 * «Не подходят» **с причиной отказа** у каждой — игрок видит, почему его жабы нет в списке,
 * и не ищет ответ в другом месте.
 *
 * Поведение панели: закрывается тапом мимо и клавишей Esc (Esc гасим в capture-фазе, иначе
 * нажатие закрыло бы всю модалку — `ModalProvider` слушает ту же клавишу), а если снизу
 * не хватает места — раскрывается вверх, не уезжая за край экрана.
 */

/** Плитка списка: жаба и её краткая информация в контексте слота */
export interface ToadPickerItem {
  toad: Toad;
  /**
   * Место в списке: больше — выше (Качество, сила роли, сытость).
   * Без места плитка остаётся там, куда её поставил слот (порядок не переставляется).
   */
  rank?: number;
  /** Текст под именем: своё у каждого места (здоровье, готовность к паре, сытость) */
  note?: React.ReactNode;
  /** Показатель внизу плитки: полоска с подписью (проценты силы роли) */
  meter?: {
    value: number;
    label: string;
    /** Характеристика рядом с процентом: «Скорость 1.55» */
    detail?: string;
    /** Подпись под полоской: «Соответствует роли» */
    caption?: string;
  };
  /** Подсветка плитки: жаба в слоте или занята другим слотом */
  tone?: "default" | "selected" | "warn";
  /**
   * Жаба не пройдёт проверку места, хотя взять её можно (КОНТУР: мало сил на выбранный
   * сектор). Плитка краснеет, а причина встаёт отдельной красной строкой: зелёная
   * «выбрано» больше не обещает то, чего место не примет.
   */
  issue?: string | null;
  /** Почему жабу взять нельзя: плитка гаснет и не нажимается */
  reason?: string | null;
}

/** Группа плиток списка с заголовком */
export interface ToadPickerGroup {
  label: string;
  items: ToadPickerItem[];
}

/** Высота панели списка (max-h-60 = 15rem) — по ней решаем, открывать список вверх или вниз */
const MENU_HEIGHT = 240;

/** Плитки по убыванию места в списке; при равных местах порядок не трогаем (sort стабилен) */
const sortItems = (items: ToadPickerItem[]): ToadPickerItem[] =>
  [...items].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

/**
 * Цвет полоски-показателя: зелёный — хорошо, янтарный — середина, красный — плохо.
 * Один на список выбора и слоты секторов: силу роли сравнивают по одной шкале.
 */
export const getMeterColor = (percent: number): string =>
  percent >= 70
    ? "bg-emerald-400"
    : percent >= 40
      ? "bg-amber-400"
      : "bg-red-400";

/**
 * Сетка плиток: колонки подбираются по ширине панели (`auto-fill`), а не по брейкпоинтам
 * окна. Список жаб открывается и в широкой модалке слота, и в узкой выпадающей панели —
 * в первой помещается 2–3 жабы в ряд, во второй одна, и ни там, ни там не приходится
 * ужимать карточку до нечитаемого вида.
 */
const PICKER_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5 p-1.5";

/**
 * Плитка жабы в сетке списка: аватар, имя, Качество, силы, место в колонии и показатель.
 *
 * Раньше жаба занимала строку во всю ширину панели: на десктопе 600+ px уходило на имя
 * и место, а на телефоне те же поля не помещались и обрезались. Плитка держит ту же
 * информацию компактно, а сетка показывает несколько жаб сразу — сравнивать пару или
 * команду по Качеству и показателю слота так проще. Высота плиток в ряду одна (`h-full`),
 * поэтому длинная заметка или подпись показателя не «пляшут» по сетке.
 */
const ToadPickerCard: React.FC<{
  item: ToadPickerItem;
  /** Название слота — идёт в подсказку плитки */
  label: string;
  /** Где жаба живёт сейчас: сектор колонии или её биопод */
  location: ToadPickerLocation;
  onPick: (toad: Toad) => void;
}> = ({ item, label, location, onPick }) => {
  const { toad } = item;
  const rarity = getRarityConfig(toad.genes.rarity);
  const blocked = Boolean(item.reason);
  const percent = item.meter ? Math.max(0, Math.min(100, item.meter.value)) : 0;
  const tone = blocked
    ? "border-slate-700/40 bg-slate-900/40"
    : item.issue
      ? "border-rose-500/50 bg-rose-950/40 hover:border-rose-300/60 hover:bg-rose-900/40"
      : item.tone === "selected"
        ? "border-emerald-500/40 bg-emerald-900/40 hover:bg-emerald-800/50"
        : item.tone === "warn"
          ? "border-amber-500/40 bg-amber-900/30 hover:bg-amber-800/40"
          : "border-slate-700/40 bg-slate-900/40 hover:border-cyan-300/40 hover:bg-slate-700/60";

  return (
    <ClickButton
      type="button"
      disabled={blocked}
      onClick={() => onPick(toad)}
      title={
        blocked
          ? `${toad.name}: ${item.reason}`
          : `Взять ${toad.name} в «${label}» · сейчас: ${location.label}${
              item.issue ? ` · ⚠️ ${item.issue}` : ""
            }`
      }
      className={`flex h-full min-w-0 flex-col gap-1 rounded-none border px-1.5 py-1.5 text-left transition-colors duration-300 ${
        blocked ? "cursor-not-allowed opacity-60" : tone
      }`}
    >
      {/* Шапка плитки: аватар, имя и Качество — по ним жабу и выбирают */}
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0">
          <ToadAvatar toad={toad} size={9} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={`truncate text-xs font-semibold ${
              blocked
                ? "text-slate-400"
                : item.issue
                  ? "text-rose-100"
                  : "text-slate-100"
            }`}
          >
            {getToadSexIcon(toad.sex)} {toad.name}
          </span>
          <span className={`truncate text-3xs ${rarity.color}`}>
            {getToadRarityLine(toad)}
          </span>
        </span>
      </div>

      {/* Силы и место: место общей плашкой (`ToadLocationBadge`), как в списках жаб */}
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span className="shrink-0 font-mono text-2xs font-semibold tabular-nums text-lime-300">
          ⚡ {Math.round(getToadEnergy(toad))}
        </span>
        <ToadLocationBadge
          icon={location.icon}
          label={location.label}
          title={`Сейчас: ${location.label}`}
        />
      </div>

      {/* Жаба не пройдёт проверку сектора: причина красным, заметка места остаётся ниже */}
      {!blocked && item.issue && (
        <div className="line-clamp-2 min-w-0 text-3xs leading-tight text-rose-300">
          ⚠️ {item.issue}
        </div>
      )}

      {/* Причина отказа важнее заметки места: у отсеянной жабы показываем её */}
      {(blocked || item.note) && (
        <div className="line-clamp-2 min-w-0 text-3xs leading-tight text-slate-400">
          {blocked ? item.reason : item.note}
        </div>
      )}

      {item.meter && (
        <div className="mt-auto flex w-full flex-col gap-0.5 pt-0.5">
          <div className="flex w-full items-baseline justify-between gap-1">
            {item.meter.detail && (
              <span
                className="min-w-0 flex-1 truncate text-3xs text-slate-400"
                title={item.meter.detail}
              >
                {item.meter.detail}
              </span>
            )}
            <span className="shrink-0 font-mono text-2xs font-bold tabular-nums text-amber-200">
              {item.meter.label}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden bg-slate-700">
            <div
              className={`h-full ${getMeterColor(percent)}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          {item.meter.caption && (
            <p className="text-3xs leading-tight text-slate-400">
              {item.meter.caption}
            </p>
          )}
        </div>
      )}
    </ClickButton>
  );
};

/** Содержимое панели списка: общее для выпадающего `ToadPicker` и модалки слота */
export interface ToadPickerListProps {
  /** Название слота — идёт в подсказку плитки */
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
  /** Куда сообщить выбор жабы */
  onPick: (toad: Toad) => void;
}

/**
 * Список жаб с группами и причинами отказа — без оболочки панели.
 *
 * Его используют и выпадающий `ToadPicker` (внутри панели под строкой слота),
 * и модалка выбора из `ToadSlotGrid`: плитки, сортировка и «Не подходят»
 * у всех одни и те же.
 */
export const ToadPickerList: React.FC<ToadPickerListProps> = ({
  label,
  groups,
  rejected,
  hint,
  emptyText = "Свободных жаб нет.",
  clear,
  onPick,
}) => {
  /** Место жабы — общее для всех списков: сектор карты или её биопод */
  const { rooms } = useColony();
  const { scenes = [] } = useGameState();
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
        <p className=" top-0 z-10 bg-slate-900/95 px-2 py-1.5 text-2xs leading-snug text-slate-400">
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
          {/* Жабы группы — плитки: сетка сама решает, сколько их влезет в ряд */}
          <div className={PICKER_GRID}>
            {group.items.map((item) => (
              <ToadPickerCard
                key={item.toad.id}
                item={item}
                label={label}
                location={getToadPickerLocation(item.toad, rooms, scenes)}
                onPick={onPick}
              />
            ))}
          </div>
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

          {showRejected && (
            <div className={PICKER_GRID}>
              {rejectedItems.map((item) => (
                <ToadPickerCard
                  key={`rejected-${item.toad.id}`}
                  item={item}
                  label={label}
                  location={getToadPickerLocation(item.toad, rooms, scenes)}
                  onPick={onPick}
                />
              ))}
            </div>
          )}
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
        className={`flex w-full items-center gap-2 rounded-none border px-2 py-1.5 transition-colors duration-300 ${
          disabled
            ? "cursor-not-allowed border-slate-600/30 opacity-60"
            : open
              ? "border-amber-400/60 bg-slate-800/90"
              : "border-slate-600/40 bg-slate-800/70 hover:bg-slate-700/70"
        }`}
      >
        {icon && (
          <span className="shrink-0 text-2xs">
            <IconText text={icon} />
          </span>
        )}
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
          className={`no-overscroll absolute left-0 right-0 z-30 max-h-60 overflow-y-auto rounded-none border border-slate-600/50 bg-slate-900/95 shadow-xl backdrop-blur-md ${
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
            onPick={pick}
          />
        </div>
      )}
    </div>
  );
};
