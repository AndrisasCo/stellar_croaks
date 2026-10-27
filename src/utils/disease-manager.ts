import { updateToadById, updateUser } from "../backend";
import { recordQuestEvent } from "../backend/quests-manager";
import { getGameState } from "../backend/localStorage";
import { Toad } from "../models/Toad";
import {
  DISEASES,
  getDiseaseCureCost,
  getDiseaseIndex,
  getDiseasePenaltyMultiplier,
  getToadDisease,
  isToadSick,
} from "../models/disease";
import { HOUR_MS } from "./date";
import {
  getHospitalDiseaseHours,
  getHospitalRoomIds,
  isToadInHospital,
} from "./hospital";
import { isToadInEnclosure } from "./toad-location";

/**
 * КИБЕР-БОЛЕЗНИ (Часть 3.6).
 * Заражают соседей по биоподу, режут выработку биомассы, лечатся карантином
 * (астро-кваксы, Часть 3.7), мгновенным курсом за Кваксы или сами затухают по таймеру.
 * В Медотсеке болезнь проходит втрое быстрее, и пациент никого не заражает:
 * он на койке, а не в биоподе.
 */

/**
 * Селекторы «больна ли жаба» живут в модели болезни (`models/disease.ts`) — их читает
 * и `utils/hospital.ts`. Реэкспорт оставлен, чтобы привычные пути импорта не менялись.
 */
export { getToadDisease, isToadSick };

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
        diseaseUntil: Date.now() + disease.durationHours * HOUR_MS,
      },
    },
    true,
  );

  // Вспышка — это новое заражение (не повторный вызов для уже больной жабы):
  // событие открывает медицинские задания журнала.
  recordQuestEvent("disease_outbreak", 1);

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
    true,
  );

  // Лечение считаем только при реальном переходе «больна → здорова»:
  // повторное нажатие на здоровую жабу задания не двигает.
  recordQuestEvent("toad_cured", 1);

  return true;
};

export interface DiseaseCurePurchase {
  success: boolean;
  message: string;
  /** Сколько Кваксов стоило лечение (0 — жаба была здорова) */
  cost: number;
}

/**
 * Мгновенный курс лечения за Кваксы — самый дорогой способ снять болезнь
 * (цена в таблице болезней, `DiseaseDef.cureTokens`). Дешевле положить жабу
 * в «Медотсек»: там срок болезни сгорает втрое быстрее, а HP идёт +24 в час.
 */
export const cureToadForTokens = (toadId: number): DiseaseCurePurchase => {
  const state = getGameState();
  const toad = state.toads.find((t) => t.id === toadId);

  if (!toad) {
    return { success: false, message: "Жаба не найдена", cost: 0 };
  }

  const cost = getDiseaseCureCost(toad);
  if (cost <= 0) {
    return {
      success: false,
      message: `${toad.name} здорова: болезни нет`,
      cost: 0,
    };
  }
  if ((state.user.tokens || 0) < cost) {
    return {
      success: false,
      message: `Нужно ${cost} 🔷 на курс лечения`,
      cost,
    };
  }

  updateUser({ tokens: state.user.tokens - cost });
  cureToad(toadId);

  return {
    success: true,
    message: `${toad.name}: болезнь снята за ${cost} 🔷`,
    cost,
  };
};

/** Больные жабы, которые живут в биоподе прямо сейчас (пациенты Медотсека не в счёте) */
export const getSceneSickCount = (
  sceneId: number | null,
  now = Date.now(),
): number =>
  getGameState().toads.filter(
    (toad) => toad.scene_id === sceneId && isToadSick(toad, now),
  ).length;

export interface DiseaseTickResult {
  cured: number;
  infected: number;
  sick: number;
}

/**
 * Тик болезней: затухание по таймеру (в Медотсеке — быстрее) + заражение соседей
 * по биоподу. Пациенты Медотсека изолированы: они не в биоподе, а на койке, поэтому
 * никого не заражают и сами ничего не подхватывают.
 * Возвращает статистику для уведомлений.
 */
export const processDiseases = (hoursPassed: number): DiseaseTickResult => {
  const state = getGameState();
  const now = Date.now();
  const hospitalIds = getHospitalRoomIds(state.colony);
  let cured = 0;
  let infected = 0;

  // 1. Затухание: дома срок болезни идёт сам по себе, на койке Медотсека сгорает быстрее
  state.toads.forEach((toad) => {
    if (!getToadDisease(toad)) {
      return;
    }

    const until = toad.state?.diseaseUntil ?? 0;
    const extraHours = getHospitalDiseaseHours(
      hoursPassed,
      isToadInHospital(toad, hospitalIds),
    );
    // Болезнь идёт по реальному времени (`diseaseUntil` — метка в будущем):
    // Медотсек лишь сдвигает эту метку ближе к «сейчас».
    const nextUntil = Math.max(now, until - extraHours * HOUR_MS);

    if (nextUntil !== until) {
      updateToadById(
        toad.id,
        { state: { ...toad.state, diseaseUntil: nextUntil } },
        true,
      );
    }

    if (nextUntil <= now) {
      cured += 1;
      cureToad(toad.id);
    }
  });

  // 2. Контакт: больные заражают соседей по биоподу. Жаба в секторе колонии
  // (`scene_id` — строка) живёт не в биоподе, а на рабочем месте, поэтому здесь
  // её не считаем: иначе зараза пошла бы по ⚡-сектору или «Разведке».
  state.toads.forEach((toad) => {
    const disease = getToadDisease(toad);
    if (
      !disease ||
      !isToadInEnclosure(toad) ||
      isToadInHospital(toad, hospitalIds)
    ) {
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
        !getToadDisease(neighbour) &&
        !isToadInHospital(neighbour, hospitalIds),
    );

    if (neighbours.length === 0) {
      return;
    }

    const victim = neighbours[Math.floor(Math.random() * neighbours.length)];
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
