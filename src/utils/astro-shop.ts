import { updateToadById, updateUser } from "../backend";
import { getGameState } from "../backend/localStorage";
import { Toad } from "../models/Toad";
import { quarantineScene } from "./disease-manager";

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
  /** Карантин вольера: лечит всех жаб сцены */
  quarantine: 2,
} as const;

export interface AstroPurchaseResult {
  success: boolean;
  message: string;
  /** Сколько жаб вылечено (только для карантина) */
  cured?: number;
}

export const getAstroBalance = (): number => getGameState().user.astro_quax || 0;

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
  const toad: Toad | undefined = getGameState().toads.find((t) => t.id === toadId);

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
      message: `Нужно ${ASTRO_PRICES.resetCooldown} ★, у вас ${balance}`,
    };
  }

  updateToadById(toadId, { breedCooldownUntil: 0 }, true);
  return {
    success: true,
    message: `${toad.name} снова полна сил (−${ASTRO_PRICES.resetCooldown} ★)`,
  };
};

/** Ускорение беременности вдвое за астро-кваксы (и ухаживания — до нуля) */
export const acceleratePregnancy = (toadId: number): AstroPurchaseResult => {
  const state = getGameState();
  const toad = state.toads.find((t) => t.id === toadId);
  const mating = toad?.mating ?? null;

  if (!toad) {
    return { success: false, message: "Жаба не найдена" };
  }

  if (!mating && !toad.pregnancy?.isPregnant) {
    return {
      success: false,
      message: "Эта жаба не ухаживает и не вынашивает потомство",
    };
  }
  if (!spendAstro(ASTRO_PRICES.acceleratePregnancy)) {
    return {
      success: false,
      message: `Нужно ${ASTRO_PRICES.acceleratePregnancy} ★, у вас ${getAstroBalance()}`,
    };
  }

  // Ухаживание: за астро-кваксы оно заканчивается сразу — беременность стартует
  // в ближайший тик `processBreeding` (раз в минуту), с обычным уведомлением
  if (mating) {
    updateToadById(toadId, { mating: { ...mating, startAt: Date.now() } }, true);

    return {
      success: true,
      message: `Ухаживание ${toad.name} ускорено: беременность вот-вот начнётся (−${ASTRO_PRICES.acceleratePregnancy} ★)`,
    };
  }

  if (!toad.pregnancy) {
    return { success: false, message: "Эта жаба не вынашивает потомство" };
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
    true
  );

  return {
    success: true,
    message: `Инкубация ${toad.name} ускорена вдвое (−${ASTRO_PRICES.acceleratePregnancy} ★)`,
  };
};

/** Карантин вольера: лечит всех заражённых жаб сцены */
export const buyQuarantine = (sceneId: number | null): AstroPurchaseResult => {
  if (!spendAstro(ASTRO_PRICES.quarantine)) {
    return {
      success: false,
      message: `Нужно ${ASTRO_PRICES.quarantine} ★, у вас ${getAstroBalance()}`,
    };
  }

  const cured = quarantineScene(sceneId);
  return {
    success: true,
    cured,
    message:
      cured > 0
        ? `Карантин проведён, вылечено жаб: ${cured}`
        : "Карантин проведён: больных жаб не найдено",
  };
};
