import { SortArrowIcon } from "./SortArrowIcon";
import { Toad } from "../../models/Toad";
import { HudPanel } from "./DataGrid";

export type SortDirection = "asc" | "desc";

export type SortByType =
  | "rarity"
  | "name"
  | "hunger"
  | "type"
  | "size"
  | "speed"
  | "fertility"
  | "price"
  | "genetic_fault"
  | "appetite"
  | "health";

export type FilterByType = "all" | "males" | "females" | "toadpoles";

export interface FilterProps {
  toads: Toad[];
  setSortDirection: (direction: SortDirection) => void;
  setSortBy: (sortBy: SortByType) => void;
  setFilterBy: (filterBy: FilterByType) => void;
  filterBy: FilterByType;
  sortBy: SortByType;
  sortDirection: SortDirection;
  addPrice?: boolean;
  addHunger?: boolean;
  /** Сортировка по HP: включают списки, где видно здоровье жабы */
  addHealth?: boolean;
}
export const Filters = ({
  toads,
  setSortDirection,
  setSortBy,
  filterBy,
  setFilterBy,
  sortBy,
  sortDirection,
  addPrice,
  addHunger,
  addHealth,
}: FilterProps) => {
  // Обработчик сортировки
  const handleSort = (type: SortByType) => {
    if (sortBy === type) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      // HP по умолчанию от худшего к лучшему: первыми идут раненые и больные
      setSortDirection(type === "health" ? "asc" : "desc");
    }
  };

  // Статистика для фильтров
  const malesCount = toads.filter((t) => t.sex === "male").length;
  const femalesCount = toads.filter((t) => t.sex === "female").length;
  const toadPolesCount = toads.filter((t) => t.stage === "toadpole").length;

  /**
   * Сортировки, доступные этому списку. На мобилке они живут в нативном
   * `select`: так видно все варианты без невидимого горизонтального скролла,
   * а на десктопе остаются привычные чипы.
   */
  const sortOptions: { key: SortByType; label: string }[] = [
    { key: "rarity", label: "Качество" },
    ...(addPrice ? [{ key: "price" as const, label: "Цена" }] : []),
    { key: "name", label: "Имя" },
    { key: "type", label: "Вид" },
    { key: "fertility", label: "Плодовитость" },
    { key: "appetite", label: "Аппетит" },
    { key: "size", label: "Вес" },
    { key: "speed", label: "Скорость" },
    { key: "genetic_fault", label: "Генетика" },
    ...(addHunger ? [{ key: "hunger" as const, label: "Голод" }] : []),
    ...(addHealth ? [{ key: "health" as const, label: "HP" }] : []),
  ];

  const filterOptions: { key: FilterByType; label: string; count: number }[] = [
    { key: "all", label: "Все", count: toads.length },
    { key: "females", label: "Самки", count: femalesCount },
    { key: "males", label: "Самцы", count: malesCount },
    { key: "toadpoles", label: "Головастики", count: toadPolesCount },
  ];

  const sortLabel =
    sortOptions.find((option) => option.key === sortBy)?.label ?? "Качество";

  return (
    <HudPanel className="mb-3 p-3">
      <div className="space-y-2">
        {/* Мобильная сортировка: один компактный select и направление стрелкой */}
        <div className="flex items-center gap-2 sm:hidden">
          <span className="shrink-0 text-cyan-300">
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6L8 2L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 10L8 14L4 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <div className="relative min-w-0 flex-1">
            <select
              aria-label="Сортировка жаб"
              value={sortBy}
              onChange={(event) =>
                handleSort(event.target.value as SortByType)
              }
              className="w-full appearance-none border border-cyan-500/20 bg-slate-950/50 px-2 py-1.5 pr-7 text-xs font-medium text-slate-200 outline-none transition-colors [color-scheme:dark] focus:border-cyan-400"
            >
              {sortOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-cyan-300"
            >
              ▾
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setSortDirection(sortDirection === "asc" ? "desc" : "asc")
            }
            aria-label={`Направление сортировки: ${
              sortDirection === "asc" ? "по возрастанию" : "по убыванию"
            }`}
            title={`${sortLabel}: ${
              sortDirection === "asc" ? "по возрастанию" : "по убыванию"
            }`}
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-cyan-500/30 bg-slate-950/50 text-cyan-200 transition-colors hover:border-cyan-300 hover:text-cyan-100"
          >
            <SortArrowIcon direction={sortDirection} />
          </button>
        </div>

        {/* Десктопная сортировка: те же чипы, но без горизонтального скролла */}
        <div className="hidden items-start gap-2 sm:flex">
          <span className="mt-1.5 shrink-0 text-cyan-300">
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6L8 2L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 10L8 14L4 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {sortOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => handleSort(option.key)}
                aria-pressed={sortBy === option.key}
                className={`flex items-center gap-1 border px-2 py-1 text-xs font-medium transition-all ${
                  sortBy === option.key
                    ? "border-cyan-400/60 bg-cyan-600 text-white shadow-sm shadow-cyan-500/30"
                    : "border-transparent text-slate-200 hover:border-cyan-400/30 hover:text-cyan-300"
                }`}
              >
                {option.label}
                <SortArrowIcon
                  direction={sortBy === option.key ? sortDirection : null}
                />
              </button>
            ))}
          </div>
        </div>

        {/*
          Фильтры пола и стадии. На мобилке это сетка 2×2: все четыре варианта
          видны сразу, ничего не прячется за краем экрана. На десктопе — строка.
        */}
        {!addPrice && (
          <div className="flex items-start gap-2">
            <span className="mt-1.5 hidden shrink-0 text-cyan-300 sm:block">
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 2H2L6 8V14L10 12V8L14 2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>

            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:flex sm:flex-wrap">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setFilterBy(option.key)}
                  aria-pressed={filterBy === option.key}
                  className={`border px-2 py-1.5 text-center text-xs font-medium transition-all sm:py-1 ${
                    filterBy === option.key
                      ? "border-cyan-400/60 bg-cyan-600 text-white shadow-sm shadow-cyan-500/30"
                      : "border-transparent text-slate-200 hover:border-cyan-400/30 hover:text-cyan-300"
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </HudPanel>
  );
};
