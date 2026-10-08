import { updateToadById } from "../backend";
import { getGameState } from "../backend/localStorage";
import {
  DISEASES,
  DiseaseDef,
  getDiseaseByIndex,
  getDiseaseIndex,
  getDiseasePenaltyMultiplier,
} from "../models/disease";
import { Toad } from "../models/Toad";

/**
 * КИБЕР-БОЛЕЗНИ (Часть 3.6).
 * Заражают соседей по вольеру, режут выработку биомассы, лечатся карантином
 * (астро-кваксы, Часть 3.7) или сами затухают по таймеру.
 */

/** Текущая болезнь жабы (или null) */
export const getToadDisease = (toad: Toad): DiseaseDef | null => {
  const id = toad.state?.diseaseId;
  if (id === undefined || id === null || id < 0) {
    return null;
  }
  return getDiseaseByIndex(id);
};

/** Больна ли жаба прямо сейчас */
export const isToadSick = (toad: Toad, now = Date.now()): boolean => {
  const disease = getToadDisease(toad);
  if (!disease) {
    return false;
  }
  return (toad.state?.diseaseUntil ?? 0) > 0 && (toad.state?.diseaseUntil ?? 0) > now;
};

/** Множитель выработки биомассы с учётом болезни (1 = здорова) */
export const getDiseaseProductionMultiplier = (toad: Toad): number =>
  getDiseasePenaltyMultiplier(toad.state?.diseaseId);

/** Заражение жабы (только если она ещё не больна) */
export const infectToad = (toadId: number, diseaseId?: string): boolean => {
  const toad = getGameState().toads.find((t) => t.id === toadId);
  if (!toad || isToadSick(toad)) {
    return false;
  }

  const disease =
    (diseaseId ? DISEASES.find((d) => d.id === diseaseId) : undefined) ??
    DISEASES[Math.floor(Math.random() * DISEASES.length)];

  updateToadById(
    toadId,
    {
      state: {
        ...toad.state,
        diseaseId: getDiseaseIndex(disease.id),
        diseaseUntil: Date.now() + disease.durationHours * 60 * 60 * 1000,
      },
    },
    true
  );

  return true;
};

/** Лечение жабы */
export const cureToad = (toadId: number): boolean => {
  const toad = getGameState().toads.find((t) => t.id === toadId);
  if (!toad || !getToadDisease(toad)) {
    return false;
  }

  updateToadById(
    toadId,
    { state: { ...toad.state, diseaseId: -1, diseaseUntil: 0 } },
    true
  );

  return true;
};

/** Карантин вольера: лечит всех жаб сцены (стоимость в астро считает astro-shop) */
export const quarantineScene = (sceneId: number | null): number => {
  const sick = getGameState().toads.filter(
    (toad) => toad.scene_id === sceneId && getToadDisease(toad)
  );

  sick.forEach((toad) => cureToad(toad.id));

  return sick.length;
};

export interface DiseaseTickResult {
  cured: number;
  infected: number;
  sick: number;
}

/**
 * Тик болезней: затухание по таймеру + заражение соседей по вольеру.
 * Возвращает статистику для уведомлений.
 */
export const processDiseases = (hoursPassed: number): DiseaseTickResult => {
  const state = getGameState();
  const now = Date.now();
  let cured = 0;
  let infected = 0;

  // 1. Затухание
  state.toads.forEach((toad) => {
    if (!getToadDisease(toad)) {
      return;
    }
    if (!isToadSick(toad, now)) {
      cured += 1;
      cureToad(toad.id);
    }
  });

  // 2. Контакт: больные заражают соседей по вольеру
  state.toads.forEach((toad) => {
    const disease = getToadDisease(toad);
    if (!disease || !toad.scene_id) {
      return;
    }

    const roll = disease.contagionPerHour * Math.max(0, hoursPassed);
    if (Math.random() >= roll) {
      return;
    }

    const neighbours = state.toads.filter(
      (neighbour) =>
        neighbour.scene_id === toad.scene_id &&
        neighbour.id !== toad.id &&
        !getToadDisease(neighbour)
    );

    if (neighbours.length === 0) {
      return;
    }

    const victim =
      neighbours[Math.floor(Math.random() * neighbours.length)];
    if (infectToad(victim.id, disease.id)) {
      infected += 1;
    }
  });

  return {
    cured,
    infected,
    sick: getGameState().toads.filter((toad) => getToadDisease(toad)).length,
  };
};
