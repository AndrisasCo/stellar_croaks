import { useState } from "react";
import { SortArrowIcon } from "./SortArrowIcon";
import React from "react";
import { Toad } from "../../models/Toad";
import { useToads } from "../ToadContext";
import { HorizontalScroll } from "./HorizontalScroll";

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
  | "appetite";

export type FilterByType =
  | "all"
  | "males"
  | "females"
  | "toadpoles"
  | "enclosure"
  | "storage";

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
}: FilterProps) => {
  // Обработчик сортировки
  const handleSort = (
    type:
      | "rarity"
      | "name"
      | "price"
      | "type"
      | "size"
      | "speed"
      | "fertility"
      | "appetite"
      | "hunger"
  ) => {
    if (sortBy === type) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      setSortDirection("desc");
    }
  };

  const { currentScene, toads: currentToads } = useToads();

  // Статистика для фильтров
  const malesCount = toads.filter((t) => t.sex === "male").length;
  const femalesCount = toads.filter((t) => t.sex === "female").length;
  const toadPolesCount = toads.filter((t) => t.stage === "toadpole").length;
  const storageToads = toads.filter((t) => t.scene_id === null).length;

  return (
    <>
      {/* Панель фильтров и сортировки */}
      <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 border border-cyan-500/20  mb-3">
        <div className="space-y-2">
          {/* Селектор сортировки */}
          <div className="flex items-center gap-2">
            <span className="text-cyan-300 text-xs font-medium min-w-[20px]">
              <svg
                className="w-4 h-4"
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
            <HorizontalScroll className="flex bg-gray-700/50 rounded-lg p-1 border border-cyan-500/10">
              {[
                { key: "rarity", label: "Редкость" },
                addPrice ? { key: "price", label: "Цена" } : {},
                { key: "name", label: "Имя" },
                { key: "type", label: "Вид" },
                { key: "fertility", label: "Плодовитость" },
                { key: "appetite", label: "Аппетит" },
                { key: "size", label: "Размер" },
                { key: "speed", label: "Скорость" },
                { key: "genetic_fault", label: "Генетика" },
                addHunger ? { key: "hunger", label: "Голод" } : {},
              ]
                .filter((i) => i.key)
                .map((item, index) => (
                  <React.Fragment key={item.key}>
                    {index > 0 && (
                      <div className="w-px bg-cyan-500/20 my-1"></div>
                    )}
                    <button
                      onClick={() => handleSort(item.key as any)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                        sortBy === item.key
                          ? "bg-cyan-600 text-white shadow-sm shadow-cyan-500/30"
                          : "text-gray-300 hover:text-cyan-300"
                      }`}
                    >
                      {item.label}
                      <SortArrowIcon
                        direction={sortBy === item.key ? sortDirection : null}
                      />
                    </button>
                  </React.Fragment>
                ))}
            </HorizontalScroll>
          </div>

          {/* Селектор фильтрации */}
          {!addPrice && (
            <div className="flex items-center gap-2">
              <span className="text-purple-300 text-xs font-medium min-w-[20px]">
                <svg
                  className="w-4 h-4"
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
              <HorizontalScroll className="flex bg-gray-700/50 rounded-lg p-1 border text-nowrap border-purple-500/10">
                <button
                  onClick={() => setFilterBy("all")}
                  className={`px-2 py-1 text-nowrap rounded text-xs font-medium transition-all ${
                    filterBy === "all"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-gray-300 hover:text-purple-300"
                  }`}
                >
                  Все ({toads.length})
                </button>
                <div className="w-px bg-purple-500/20 my-1"></div>
                <button
                  onClick={() => setFilterBy("females")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    filterBy === "females"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-gray-300 hover:text-purple-300"
                  }`}
                >
                  Самки ({femalesCount})
                </button>
                <div className="w-px bg-purple-500/20 my-1"></div>
                <button
                  onClick={() => setFilterBy("males")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    filterBy === "males"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-gray-300 hover:text-purple-300"
                  }`}
                >
                  Самцы ({malesCount})
                </button>
                <div className="w-px bg-purple-500/20 my-1"></div>
                <button
                  onClick={() => setFilterBy("toadpoles")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    filterBy === "toadpoles"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-gray-300 hover:text-purple-300"
                  }`}
                >
                  Головастики ({toadPolesCount})
                </button>
              </HorizontalScroll>
            </div>
          )}

          {/* Селектор фильтрации */}
          {addPrice && (
            <div className="flex items-center gap-2">
              <span className="text-purple-300 text-xs font-medium min-w-[20px]">
                <svg
                  className="w-4 h-4"
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
              <HorizontalScroll className="flex bg-gray-700/50 rounded-lg p-1 border text-nowrap border-purple-500/10">
                <button
                  onClick={() => setFilterBy("all")}
                  className={`px-2 py-1 text-nowrap rounded text-xs font-medium transition-all ${
                    filterBy === "all"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-gray-300 hover:text-purple-300"
                  }`}
                >
                  Все ({toads.length})
                </button>
                <div className="w-px bg-purple-500/20 my-1"></div>
                <button
                  onClick={() => setFilterBy("enclosure")}
                  className={`px-2 py-1 truncate rounded text-xs font-medium transition-all ${
                    filterBy === "enclosure"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-gray-300 hover:text-purple-300"
                  }`}
                >
                  {currentScene.name} ({currentToads.length})
                </button>
                <div className="w-px bg-purple-500/20 my-1"></div>
                <button
                  onClick={() => setFilterBy("storage")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    filterBy === "storage"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "text-gray-300 hover:text-purple-300"
                  }`}
                >
                  Склад ({storageToads})
                </button>
              </HorizontalScroll>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
