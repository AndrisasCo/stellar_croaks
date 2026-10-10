import { getGameState } from "../backend/localStorage";
import { INITIAL_CAPACITY, Scene } from "../models/scene";
import { Toad } from "../models/Toad";

/**
 * Жильё жаб. Склада жаб больше нет: у каждой жабы всегда есть вольер (`Toad.scene_id`),
 * поэтому любые новые жабы — покупка на рынке, потомство гнезда, гибрид коллайдера,
 * образец из похода, награда за достижение — сначала ищут свободное место в вольерах.
 *
 * Вольеры — это `Scene` игры. Раньше их покупали в магазине; теперь вольер строится
 * гексом «Вольер» на карте колонии (`backend/colony.ts`): каждая постройка добавляет
 * вольер с `INITIAL_CAPACITY` мест.
 *
 * Если свободного места нет, жабу НЕ создаём (её нельзя «положить на склад»):
 * вызывающий код обязан сказать игроку «постройте вольер».
 */

export interface HousingInfo {
  /** Мест во всех вольерах */
  capacity: number;
  /** Сколько жаб живёт в вольерах */
  used: number;
  /** Сколько мест свободно */
  free: number;
  /** Сколько вольеров в колонии */
  enclosures: number;
}

/** Жабы конкретного вольера */
export const getEnclosureToads = (sceneId: number): Toad[] =>
  getGameState().toads.filter((toad) => toad.scene_id === sceneId);

/** Сколько мест осталось в вольере */
export const getSceneFreeSlots = (scene: Scene): number =>
  Math.max(0, scene.capacity - getEnclosureToads(scene.id).length);

/** Общая картина по жилью: места, занятость и число вольеров */
export const getHousingInfo = (): HousingInfo => {
  const state = getGameState();
  const capacity = state.scenes.reduce((sum, scene) => sum + scene.capacity, 0);
  const used = state.toads.length;

  return {
    capacity,
    used,
    free: Math.max(0, capacity - used),
    enclosures: state.scenes.length,
  };
};

/** Вольер, в котором есть свободное место (или null, если все полны) */
export const getSceneWithFreeSlot = (): Scene | null => {
  const state = getGameState();

  return (
    state.scenes.find(
      (scene) =>
        state.toads.filter((toad) => toad.scene_id === scene.id).length <
        scene.capacity,
    ) ?? null
  );
};

/**
 * Вольер для новой жабы: сначала желаемый (обычно тот, что открыт у игрока),
 * потом любой свободный. null — мест нет.
 */
export const pickSceneForNewToad = (
  preferredSceneId?: number | null,
): Scene | null => {
  const state = getGameState();
  const preferred = state.scenes.find((scene) => scene.id === preferredSceneId);

  if (preferred && getSceneFreeSlots(preferred) > 0) {
    return preferred;
  }

  return getSceneWithFreeSlot();
};

export interface ToadPlacement<T extends Partial<Toad>> {
  /** Жабы, которым нашлось место (с уже проставленным `scene_id`) */
  assigned: T[];
  /** Сколько жаб осталось без места */
  rejected: number;
}

/**
 * Раскладывает жаб по вольерам: вольеры заполняются по порядку, лишние остаются без
 * места (`rejected`) — их не создаём, о них игроку надо сообщить.
 * Занятость считается на лету: пачка жаб не «видит» саму себя в сохранении.
 * `preferredSceneId` (например, вольер матери или текущий вольер игрока) идёт первым.
 */
export const assignToadsToScenes = <T extends Partial<Toad>>(
  toads: T[],
  preferredSceneId?: number | null,
): ToadPlacement<T> => {
  const state = getGameState();
  const occupancy = new Map<number, number>();

  state.scenes.forEach((scene) => {
    occupancy.set(
      scene.id,
      state.toads.filter((toad) => toad.scene_id === scene.id).length,
    );
  });

  const scenes = preferredSceneId
    ? [
        ...state.scenes.filter((scene) => scene.id === preferredSceneId),
        ...state.scenes.filter((scene) => scene.id !== preferredSceneId),
      ]
    : state.scenes;

  const assigned: T[] = [];

  toads.forEach((toad) => {
    const scene = scenes.find(
      (candidate) => (occupancy.get(candidate.id) ?? 0) < candidate.capacity,
    );

    if (!scene) {
      return;
    }

    occupancy.set(scene.id, (occupancy.get(scene.id) ?? 0) + 1);
    assigned.push({ ...toad, scene_id: scene.id });
  });

  return { assigned, rejected: toads.length - assigned.length };
};

/** Влезет ли столько жаб в вольеры колонии */
export const canHouseToads = (count = 1): boolean =>
  getHousingInfo().free >= count;

/** Вместимость нового вольера — то, что прибавляет постройка «Вольер» */
export const NEW_ENCLOSURE_CAPACITY = INITIAL_CAPACITY;
