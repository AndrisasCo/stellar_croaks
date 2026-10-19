import { Toad } from "./Toad";

/**
 * КИБЕР-БОЛЕЗНИ (Часть 3.6).
 * Чистые описания дебаффов: заражение, контагиозность, срез выработки, длительность
 * и цена мгновенного курса лечения.
 * Состояние жаб хранится в `Toad.state.diseaseId` / `Toad.state.diseaseUntil`, поэтому
 * селекторы «больна ли жаба» живут здесь же (без обращения к сохранению): их читают и
 * `utils/disease-manager.ts`, и `utils/hospital.ts` — Медотсек ускоряет срок болезни
 * и изолирует пациента от биопода.
 */

export interface DiseaseDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Шанс передачи соседям по биоподу за час */
  contagionPerHour: number;
  /** Срез выработки биомассы (0.3 = −30 %) */
  productionPenalty: number;
  /** Длительность в часах */
  durationHours: number;
  /** Сколько Кваксов стоит мгновенный курс лечения от этой болезни */
  cureTokens: number;
}

export const DISEASES: DiseaseDef[] = [
  {
    id: "firmware_glitch",
    name: "Сбой прошивки",
    icon: "🧬",
    description:
      "Жаба зависает в циклах самоочистки и почти не производит биомассу.",
    contagionPerHour: 0.03,
    productionPenalty: 0.3,
    durationHours: 6,
    cureTokens: 150,
  },
  {
    id: "nano_infection",
    name: "Нанозаражение",
    icon: "🦠",
    description: "Наноспоры перестраивают метаболизм и воруют биомассу.",
    contagionPerHour: 0.08,
    productionPenalty: 0.5,
    durationHours: 10,
    cureTokens: 250,
  },
  {
    id: "mutation_cascade",
    name: "Мутационный каскад",
    icon: "☣️",
    description: "Каскадный сбой генома: долгий, но не смертельный.",
    contagionPerHour: 0.12,
    productionPenalty: 0.75,
    durationHours: 16,
    cureTokens: 400,
  },
];

export const getDiseaseById = (id: string): DiseaseDef | undefined =>
  DISEASES.find((disease) => disease.id === id);

/** Индекс болезни в таблице (для хранения в сейве) */
export const getDiseaseIndex = (id: string): number =>
  DISEASES.findIndex((disease) => disease.id === id);

export const getDiseaseByIndex = (index: number): DiseaseDef | null =>
  DISEASES[index] ?? null;

/** Текущая болезнь жабы (или null) */
export const getToadDisease = (toad: Toad): DiseaseDef | null => {
  const id = toad.state?.diseaseId;
  if (id === undefined || id === null || id < 0) {
    return null;
  }
  return getDiseaseByIndex(id);
};

/** Больна ли жаба прямо сейчас (срок болезни ещё не вышел) */
export const isToadSick = (toad: Toad, now = Date.now()): boolean => {
  const disease = getToadDisease(toad);
  if (!disease) {
    return false;
  }
  return (
    (toad.state?.diseaseUntil ?? 0) > 0 && (toad.state?.diseaseUntil ?? 0) > now
  );
};

/**
 * Сколько Кваксов стоит мгновенный курс лечения (0 — жаба здорова).
 * Цена живёт в таблице болезней (`cureTokens`): долгие и злые болезни дороже.
 */
export const getDiseaseCureCost = (toad: Toad, now = Date.now()): number =>
  isToadSick(toad, now) ? (getToadDisease(toad)?.cureTokens ?? 0) : 0;

/**
 * Множитель выработки биомассы по индексу болезни (1 = здоров,
 * значение хранится в `Toad.state.diseaseId`).
 */
export const getDiseasePenaltyMultiplier = (
  diseaseId?: number | null,
): number => {
  if (diseaseId === undefined || diseaseId === null || diseaseId < 0) {
    return 1;
  }
  const disease = getDiseaseByIndex(diseaseId);
  return disease ? Math.max(0, 1 - disease.productionPenalty) : 1;
};
