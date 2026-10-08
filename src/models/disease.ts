/**
 * КИБЕР-БОЛЕЗНИ (Часть 3.6).
 * Чистые описания дебаффов: заражение, контагиозность, срез выработки, длительность.
 * Состояние жаб хранится в `Toad.state.diseaseId` / `Toad.state.diseaseUntil`.
 */

export interface DiseaseDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Шанс передачи соседям по вольеру за час */
  contagionPerHour: number;
  /** Срез выработки биомассы (0.3 = −30 %) */
  productionPenalty: number;
  /** Длительность в часах */
  durationHours: number;
}

export const DISEASES: DiseaseDef[] = [
  {
    id: "firmware_glitch",
    name: "Сбой прошивки",
    icon: "🧬",
    description: "Жаба зависает в циклах самоочистки и почти не производит биомассу.",
    contagionPerHour: 0.03,
    productionPenalty: 0.3,
    durationHours: 6,
  },
  {
    id: "nano_infection",
    name: "Нанозаражение",
    icon: "🦠",
    description: "Наноспоры перестраивают метаболизм и воруют биомассу.",
    contagionPerHour: 0.08,
    productionPenalty: 0.5,
    durationHours: 10,
  },
  {
    id: "mutation_cascade",
    name: "Мутационный каскад",
    icon: "☣️",
    description: "Каскадный сбой генома: долгий, но не смертельный.",
    contagionPerHour: 0.12,
    productionPenalty: 0.75,
    durationHours: 16,
  },
];

export const getDiseaseById = (id: string): DiseaseDef | undefined =>
  DISEASES.find((disease) => disease.id === id);

/** Индекс болезни в таблице (для хранения в сейве) */
export const getDiseaseIndex = (id: string): number =>
  DISEASES.findIndex((disease) => disease.id === id);

export const getDiseaseByIndex = (index: number): DiseaseDef | null =>
  DISEASES[index] ?? null;

/**
 * Множитель выработки биомассы по индексу болезни (1 = здоров,
 * значение хранится в `Toad.state.diseaseId`).
 */
export const getDiseasePenaltyMultiplier = (
  diseaseId?: number | null
): number => {
  if (diseaseId === undefined || diseaseId === null || diseaseId < 0) {
    return 1;
  }
  const disease = getDiseaseByIndex(diseaseId);
  return disease ? Math.max(0, 1 - disease.productionPenalty) : 1;
};
