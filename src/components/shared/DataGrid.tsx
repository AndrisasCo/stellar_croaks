import React, { createContext, useContext } from "react";

/**
 * HUD-сетка для статистики секторов и списков.
 *
 * Общий язык для всех числовых панелей игры: тонкие линии акцента, микро-узлы на
 * пересечениях и полупрозрачный `bg-slate-950/50` вместо глухих карточек.
 * Узлы намеренно непрозрачные: полупрозрачные квадратики терялись на фоне
 * модалки и выглядели как артефакты сглаживания. Цвет линий и узлов задаёт
 * `HudToneProvider`: Контур — изумруд, Репродуктор — розовый, лаборатория —
 * фиолетовый, Медотсек — небесный, энергия и торговля — янтарный.
 */

/** Один квадратный узел на линии сетки. */
export const DataNode: React.FC<{
  className?: string;
  /** Цвет узла: у цветных панелей он совпадает с акцентом панели. */
  tone?: string;
}> = ({ className = "", tone = "bg-cyan-300" }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute h-[3px] w-[3px] ${tone} ${className}`}
  />
);

/** Четыре узла по углам ячейки или панели. */
export const GridNodes: React.FC<{ tone?: string }> = ({
  tone = "bg-cyan-300",
}) => (
  <>
    <DataNode tone={tone} className="-left-px -top-px" />
    <DataNode tone={tone} className="-right-px -top-px" />
    <DataNode tone={tone} className="-bottom-px -left-px" />
    <DataNode tone={tone} className="-bottom-px -right-px" />
  </>
);

export type HudTone =
  | "cyan"
  | "rose"
  | "amber"
  | "lime"
  | "emerald"
  | "sky"
  | "violet";

/**
 * Тональность HUD-сектора.
 *
 * Общий каркас у всех панелей один (`bg-slate-950/50`, тонкие линии, узлы), но
 * акцент отличается: у Контура — глубокий изумруд, у Репродуктора — приглушённый
 * розовый, у лаборатории — фиолетовый. Так сектор читается с первого взгляда,
 * а интерфейс не превращается в радугу: цвет живёт в линиях, узлах и подписях,
 * фон остаётся нейтральным.
 */
export interface HudToneStyle {
  /** Рамка панели */
  box: string;
  /** Цвет узлов на пересечениях */
  node: string;
  /** Левая/верхняя линия сетки */
  line: string;
  /** Цвет линий у дочерних ячеек сетки */
  cellLine: string;
  /** Акцентный текст */
  text: string;
  /** Приглушённый акцент для подписей */
  softText: string;
  /** Начало градиента линии */
  gradient: string;
  /** Симметричный градиент: яркий центр и прозрачные края */
  gradientMirror: string;
  /** Свечение квадратного маркера */
  glow: string;
  /** Активный таб */
  tabText: string;
  /** Нижняя граница активного таба */
  tabBorder: string;
}

export const HUD_TONES: Record<HudTone, HudToneStyle> = {
  cyan: {
    box: "border-cyan-400/25 text-slate-100",
    node: "bg-cyan-300",
    line: "border-cyan-400/25",
    cellLine: "[&>*]:border-cyan-400/25",
    text: "text-cyan-200",
    softText: "text-cyan-500/80",
    gradient: "from-cyan-400/40",
    gradientMirror: "from-transparent via-cyan-400/50 to-transparent",
    glow: "shadow-[0_0_6px_rgba(34,211,238,0.8)]",
    tabText: "text-cyan-300",
    tabBorder: "border-cyan-400",
  },
  rose: {
    box: "border-rose-400/30 text-rose-50 shadow-[inset_0_0_24px_rgba(251,113,133,0.05)]",
    node: "bg-rose-300",
    line: "border-rose-400/25",
    cellLine: "[&>*]:border-rose-400/25",
    text: "text-rose-200",
    softText: "text-rose-400/75",
    gradient: "from-rose-400/40",
    gradientMirror: "from-transparent via-rose-400/50 to-transparent",
    glow: "shadow-[0_0_6px_rgba(251,113,133,0.65)]",
    tabText: "text-rose-200",
    tabBorder: "border-rose-400",
  },
  amber: {
    box: "border-amber-400/30 text-amber-50 shadow-[inset_0_0_24px_rgba(251,191,36,0.045)]",
    node: "bg-amber-300",
    line: "border-amber-400/25",
    cellLine: "[&>*]:border-amber-400/25",
    text: "text-amber-200",
    softText: "text-amber-400/75",
    gradient: "from-amber-400/40",
    gradientMirror: "from-transparent via-amber-400/50 to-transparent",
    glow: "shadow-[0_0_6px_rgba(251,191,36,0.65)]",
    tabText: "text-amber-200",
    tabBorder: "border-amber-400",
  },
  lime: {
    box: "border-lime-400/30 text-lime-50 shadow-[inset_0_0_24px_rgba(163,230,53,0.04)]",
    node: "bg-lime-300",
    line: "border-lime-400/25",
    cellLine: "[&>*]:border-lime-400/25",
    text: "text-lime-200",
    softText: "text-lime-400/75",
    gradient: "from-lime-400/40",
    gradientMirror: "from-transparent via-lime-400/50 to-transparent",
    glow: "shadow-[0_0_6px_rgba(163,230,53,0.6)]",
    tabText: "text-lime-200",
    tabBorder: "border-lime-400",
  },
  emerald: {
    box: "border-emerald-500/30 text-emerald-50 shadow-[inset_0_0_26px_rgba(16,185,129,0.06)]",
    node: "bg-emerald-300",
    line: "border-emerald-500/25",
    cellLine: "[&>*]:border-emerald-500/25",
    text: "text-emerald-200",
    softText: "text-emerald-500/80",
    gradient: "from-emerald-400/40",
    gradientMirror: "from-transparent via-emerald-400/50 to-transparent",
    glow: "shadow-[0_0_6px_rgba(52,211,153,0.7)]",
    tabText: "text-emerald-200",
    tabBorder: "border-emerald-400",
  },
  sky: {
    box: "border-sky-400/30 text-sky-50 shadow-[inset_0_0_24px_rgba(56,189,248,0.05)]",
    node: "bg-sky-300",
    line: "border-sky-400/25",
    cellLine: "[&>*]:border-sky-400/25",
    text: "text-sky-200",
    softText: "text-sky-400/75",
    gradient: "from-sky-400/40",
    gradientMirror: "from-transparent via-sky-400/50 to-transparent",
    glow: "shadow-[0_0_6px_rgba(56,189,248,0.65)]",
    tabText: "text-sky-200",
    tabBorder: "border-sky-400",
  },
  violet: {
    box: "border-violet-400/30 text-violet-50 shadow-[inset_0_0_24px_rgba(167,139,250,0.055)]",
    node: "bg-violet-300",
    line: "border-violet-400/25",
    cellLine: "[&>*]:border-violet-400/25",
    text: "text-violet-200",
    softText: "text-violet-400/75",
    gradient: "from-violet-400/40",
    gradientMirror: "from-transparent via-violet-400/50 to-transparent",
    glow: "shadow-[0_0_6px_rgba(167,139,250,0.65)]",
    tabText: "text-violet-200",
    tabBorder: "border-violet-400",
  },
};

const HudToneContext = createContext<HudTone>("cyan");

/** Задать акцент всем HUD-элементам внутри модалки сектора. */
export const HudToneProvider: React.FC<{
  tone: HudTone;
  children: React.ReactNode;
}> = ({ tone, children }) => (
  <HudToneContext.Provider value={tone}>{children}</HudToneContext.Provider>
);

/** Текущий акцент: его читают сетки, панели и заголовки без явного `tone`. */
export const useHudTone = (): HudTone => useContext(HudToneContext);

/** Готовые классы тона — один источник для всех HUD-компонентов. */
export const getHudTone = (tone: HudTone): HudToneStyle => HUD_TONES[tone];

/** Заголовок секции: квадратный маркер, линия и необязательная подпись справа. */
export const SectionTitle: React.FC<{
  children: React.ReactNode;
  aside?: React.ReactNode;
  /** Переопределить акцент, не меняя акцент всей модалки. */
  tone?: HudTone;
}> = ({ children, aside, tone }) => {
  const inherited = useHudTone();
  const style = HUD_TONES[tone ?? inherited];

  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className={`h-1.5 w-1.5 shrink-0 ${style.node} ${style.glow}`}
        aria-hidden="true"
      />
      <h4 className="text-3xs font-semibold uppercase tracking-[0.18em] text-slate-300">
        {children}
      </h4>
      <span
        className={`h-px min-w-4 flex-1 bg-gradient-to-r ${style.gradient} to-transparent`}
      />
      {aside && (
        <span
          className={`shrink-0 text-3xs uppercase tracking-[0.14em] ${style.softText}`}
        >
          {aside}
        </span>
      )}
    </div>
  );
};

/**
 * Прямоугольная панель в том же HUD-стиле, что и сетка.
 * Углы острые: карточки статистики и предупреждения не должны выбиваться
 * из общего ритма скруглёнными углами.
 */
export const HudPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: HudTone;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}> = ({ children, className = "", tone, onClick }) => {
  const inherited = useHudTone();
  const style = HUD_TONES[tone ?? inherited];

  return (
    <div
      onClick={onClick}
      className={`relative border bg-slate-950/50 ${style.box} ${className}`}
    >
      <GridNodes tone={style.node} />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${style.gradient} to-transparent`}
      />
      <HudToneProvider tone={tone ?? inherited}>{children}</HudToneProvider>
    </div>
  );
};

/** Ячейка сетки: подпись сверху, крупное значение снизу. */
export const DataCell: React.FC<{
  /** Подпись ячейки. `ReactNode` — чтобы в начале стояла SVG-иконка (`ToadIcon`). */
  label: React.ReactNode;
  value: React.ReactNode;
  suffix?: string;
  color?: string;
  accent?: string;
  className?: string;
  /** Узкие отступы и мелкое значение — для сводок и подвала списка. */
  dense?: boolean;
  children?: React.ReactNode;
}> = ({
  label,
  value,
  suffix,
  color = "text-slate-100",
  accent,
  className = "",
  dense = false,
  children,
}) => {
  const tone = useHudTone();
  const style = HUD_TONES[tone];

  return (
    <div
      className={`relative bg-slate-950/50 ${
        dense ? "px-1.5 py-1.5" : "px-3 py-2.5"
      } ${className}`}
    >
      <GridNodes tone={style.node} />
      {accent && (
        <span
          aria-hidden="true"
          className={`absolute left-3 top-0 h-0.5 w-6 ${accent}`}
        />
      )}
      <div
        className={`text-3xs uppercase text-slate-500 ${
          dense ? "tracking-[0.06em]" : "tracking-[0.14em]"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-semibold leading-none tabular-nums ${
          dense ? "text-sm" : "text-lg"
        } ${color}`}
      >
        {value}
        {suffix && (
          <span className="ml-0.5 text-xs font-medium text-slate-500">
            {suffix}
          </span>
        )}
      </div>
      {children}
    </div>
  );
};

const GRID_COLUMNS: Record<number, string> = {
  2: "grid-cols-2 sm:grid-cols-3",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-5",
};

/**
 * Рамка сетки: тонкие линии между ячейками в акценте сектора.
 *
 * Фон живёт только на ячейках (`DataCell`), а не на обёртке: так `bg-slate-950/50`
 * остаётся именно полупрозрачным slate, без цветного подмеса от слоя линий. Линии
 * рисуют правые/нижние рамки ячеек, а левую/верхнюю — сама рамка сетки.
 */
export const DataGrid: React.FC<{
  children: React.ReactNode;
  /** Число колонок на мобилке; для 2 на десктопе автоматически 3. */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
  /** Переопределить раскладку, сохранив линии. */
  gridClassName?: string;
  /** Акцент сетки; без него наследуется акцент модалки. */
  tone?: HudTone;
}> = ({ children, columns = 2, className = "", gridClassName = "", tone }) => {
  const inherited = useHudTone();
  const style = HUD_TONES[tone ?? inherited];

  return (
    <HudToneProvider tone={tone ?? inherited}>
      <div className={`relative border-l border-t ${style.line} ${className}`}>
        <div
          className={`grid [&>*]:border-b [&>*]:border-r ${style.cellLine} ${
            GRID_COLUMNS[columns] ?? GRID_COLUMNS[2]
          } ${gridClassName}`}
        >
          {children}
        </div>
      </div>
    </HudToneProvider>
  );
};
