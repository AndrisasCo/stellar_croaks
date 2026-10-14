import { useState } from "react";
import { SortByType, FilterByType } from "../components/shared/Filters";
import { calculateSellPrice, Toad } from "../models/Toad";
import { ToadTypes } from "../models/Toad/toad-species";

/**
 * Сортировка и фильтрация списка жаб.
 * Фильтры работают по тому списку, который передали (`toads`): список биопода приходит
 * от гекса (`sceneId`), поэтому «текущего биопода» здесь больше нет.
 */
export const useFilters = (toads: Toad[]) => {
  const [sortBy, setSortBy] = useState<SortByType>("rarity");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterBy, setFilterBy] = useState<FilterByType>("all");
  // Сортировка жаб
  const getSortedToads = (toads: Toad[]) => {
    return [...toads].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "type":
          aValue = Object.values(ToadTypes).includes(a.type as ToadTypes)
            ? a.type
            : ToadTypes.hybrid;
          bValue = Object.values(ToadTypes).includes(b.type as ToadTypes)
            ? b.type
            : ToadTypes.hybrid;
          break;
        case "price":
          aValue = calculateSellPrice(a);
          bValue = calculateSellPrice(b);
          break;
        case "rarity":
          aValue = a.genes.rarity;
          bValue = b.genes.rarity;
          break;
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;
        case "hunger":
          aValue = a.state.hunger;
          bValue = b.state.hunger;
          break;
        case "genetic_fault":
          aValue = a.state.genetic_fault || 0;
          bValue = b.state.genetic_fault || 0;
          break;
        case "size":
          aValue = a.genes.weight;
          bValue = b.genes.weight;
          break;
        case "speed":
          aValue = a.genes.speed;
          bValue = b.genes.speed;
          break;
        case "fertility":
          aValue = a.genes.fertility;
          bValue = b.genes.fertility;
          break;
        case "appetite":
          aValue = a.genes.hungerRate;
          bValue = b.genes.hungerRate;
          break;
        default:
          return 0;
      }

      if (sortDirection === "desc") {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });
  };

  // Фильтрация жаб
  const getFilteredToads = () => {
    switch (filterBy) {
      case "males":
        return toads.filter((t) => t.sex === "male");
      case "females":
        return toads.filter((t) => t.sex === "female");
      case "toadpoles":
        return toads.filter((t) => t.stage === "toadpole");
      case "all":
      default:
        return toads;
    }
  };

  const filteredAndSortedToads = getSortedToads(getFilteredToads());
  return {
    filteredAndSortedToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  };
};
