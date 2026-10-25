import { updateToadById, updateUser } from "../backend";
import { getGameState } from "../backend/localStorage";
import { Toad } from "../models/Toad";
import { CURRENCY_CONFIG } from "./constants";
import { getSceneSickCount, quarantineScene } from "./disease-manager";

/**
 * АСТРО-КВАКСЫ — «премиум-манипуляции» (Часть 3.7).
 * Кваксы тратятся на бытовое (биомасса, постройки, слоты),
 * Астро — на ускорения и сбросы: отдых, инкубация, карантин.
 */

export const ASTRO_PRICES = {
  /** Сброс отдыха (cooldown) после спаривания */
  resetCooldown: 1,
  /** Ускорение беременности вдвое */
  acceleratePregnancy: 2,
  /** Карантин биопода: лечит всех жаб сцены */
  quarantine: 2,
} as const;

export interface AstroPurchaseResult {
  success: boolean;
  message: string;
  /** Сколько жаб вылечено (только для карантина) */
  cured?: number;
}

export const getAstroBalance = (): number =>
  getGameState().user.astro_quax || 0;

const spendAstro = (amount: number): boolean => {
  const state = getGameState();
  const balance = state.user.astro_quax || 0;
  if (balance < amount) {
    return false;
  }
  updateUser({ astro_quax: balance - amount });
  return true;
};

/** Сброс отдыха жабы за астро-кваксы */
export const resetBreedCooldown = (toadId: number): AstroPurchaseResult => {
  const toad: Toad | undefined = getGameState().toads.find(
    (t) => t.id === toadId,
  );

  if (!toad) {
    return { success: false, message: "Жаба не найдена" };
  }
  if ((toad.breedCooldownUntil ?? 0) <= Date.now()) {
    return { success: false, message: `${toad.name} не нуждается в отдыхе` };
  }
  if (!spendAstro(ASTRO_PRICES.resetCooldown)) {
    const balance = getAstroBalance();
    return {
      success: false,
      message: `Нужно ${ASTRO_PRICES.resetCooldown} ${CURRENCY_CONFIG.astro_quax.icon}, у вас ${balance}`,
    };
  }

  updateToadById(toadId, { breedCooldownUntil: 0 }, true);
  return {
    success: true,
    message: `${toad.name} снова полна сил`,
  };
};

/**
 * Ускорение беременности вдвое за астро-кваксы.
 *
 * Ухаживания здесь больше нет: оно мгновенное, и старый сейв с `mating` доигрывается
 * беременностью на ближайшем тике `processBreeding` — платить за его ускорение нечего.
 */
export const acceleratePregnancy = (toadId: number): AstroPurchaseResult => {
  const state = getGameState();
  const toad = state.toads.find((t) => t.id === toadId);

  if (!toad) {
    return { success: false, message: "Жаба не найдена" };
  }

  if (!toad.pregnancy?.isPregnant) {
    return {
      success: false,
      message: toad.mating
        ? "Ухаживание мгновенное: беременность начнётся на ближайшем тике"
        : "Эта жаба не вынашивает потомство",
    };
  }
  if (!spendAstro(ASTRO_PRICES.acceleratePregnancy)) {
    return {
      success: false,
      message: `Нужно ${ASTRO_PRICES.acceleratePregnancy} ${CURRENCY_CONFIG.astro_quax.icon}, у вас ${getAstroBalance()}`,
    };
  }

  const { pregnancyStart, pregnancyDuration } = toad.pregnancy;
  // pregnancyDuration хранится в часах (см. getHoursFromNow в breeding-manager)
  const durationMs = pregnancyDuration * 60 * 60 * 1000;
  const elapsed = Date.now() - pregnancyStart;
  const remaining = Math.max(0, durationMs - elapsed);

  updateToadById(
    toadId,
    {
      pregnancy: {
        ...toad.pregnancy,
        pregnancyStart: Date.now() - (durationMs - remaining / 2),
      },
    },
    true,
  );

  return {
    success: true,
    message: `Инкубация ${toad.name} ускорена вдвое`,
  };
};

/**
 * Карантин биопода: лечит всех заражённых жаб сцены.
 * Больных нет — астро не списываем: игрок не должен платить за пустое действие.
 */
export const buyQuarantine = (sceneId: number | null): AstroPurchaseResult => {
  const sick = getSceneSickCount(sceneId);

  if (sick === 0) {
    return {
      success: false,
      message: "В этом биоподе нет больных жаб: карантин не нужен",
    };
  }

  if (!spendAstro(ASTRO_PRICES.quarantine)) {
    return {
      success: false,
      message: `Нужно ${ASTRO_PRICES.quarantine} ${CURRENCY_CONFIG.astro_quax.icon}, у вас ${getAstroBalance()}`,
    };
  }

  const cured = quarantineScene(sceneId);
  return {
    success: true,
    cured,
    message: `Карантин проведён, вылечено жаб: ${cured}`,
  };
};
