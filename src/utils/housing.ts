import { getGameState } from "../backend/localStorage";
import { INITIAL_CAPACITY, Scene } from "../models/scene";
import { Toad } from "../models/Toad";
import { isToadInEnclosure } from "./toad-location";

/**
 * Жильё жаб.
 *
 * У жабы всегда ровно одно место: биопод (`Toad.scene_id`) или сектор колонии
 см. `toad-location.ts`. Поэтому здесь считаются только «местные»:
 * жаба, ушедшая работать в репродуктор или ⚡-энергосектор, место в биоподе не занимает
 * (её `scene_id` — id сектора), а вернут её домой кнопкой «Домой» — с проверкой
 * свободного места (`backend/colony.ts` → `sendToadHome`).
 *
 * Склада жаб нет: биопод у жабы всегда есть, поэтому любые новые жабы — покупка на рынке,
 * потомство репродуктора, гибрид коллайдера, образец из похода, награда за достижение —
 * сначала ищут свободное место в биоподах.
 *
 * Биоподы — это `Scene` игры. Раньше их покупали в Торговая Капсулае; теперь биопод строится
 * гексом «Биопод» на карте колонии (`backend/colony.ts`): каждая постройка добавляет
 * биопод с `INITIAL_CAPACITY` мест.
 *
 * Если свободного места нет, жабу НЕ создаём (её нельзя «положить на склад»):
 * вызывающий код обязан сказать игроку «постройте биопод».
 */

export interface HousingInfo {
  /** Мест во всех биоподах */
  capacity: number;
  /** Сколько мест занято жабами, которые живут в биоподах */
  used: number;
  /** Сколько мест свободно */
  free: number;
  /** Сколько биоподов в колонии */
  enclosures: number;
}

/** Жабы конкретного биопода: живут в нём сейчас (ушедшие в сектора не в счёт) */
export const getEnclosureToads = (sceneId: number): Toad[] =>
  getGameState().toads.filter((toad) => toad.scene_id === sceneId);

/** Сколько мест осталось в биоподе */
export const getSceneFreeSlots = (scene: Scene): number =>
  Math.max(0, scene.capacity - getEnclosureToads(scene.id).length);

/** Общая картина по жилью: места, занятость и число биоподов */
export const getHousingInfo = (): HousingInfo => {
  const state = getGameState();
  const capacity = state.scenes.reduce((sum, scene) => sum + scene.capacity, 0);
  // Жабы в секторах колонии (репродуктор, ⚡, «Разведка», Медотсек) биопод не занимают:
  // их `scene_id` — строка с id сектора, а не число с id биопода
  const used = state.toads.filter(isToadInEnclosure).length;

  return {
    capacity,
    used,
    free: Math.max(0, capacity - used),
    enclosures: state.scenes.length,
  };
};

/** Биопод, в котором есть свободное место (или null, если все полны) */
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
 * Биопод для новой жабы: сначала желаемый (обычно тот, что открыт у игрока),
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
  /** Жабы, которым нашлось место (с уже проставленным `scene_id` и домом `homeId`) */
  assigned: T[];
  /** Сколько жаб осталось без места */
  rejected: number;
}

/**
 * Раскладывает жаб по биоподам: биоподы заполняются по порядку, лишние остаются без
 * места (`rejected`) — их не создаём, о них игроку надо сообщить.
 * Занятость считается на лету: пачка жаб не «видит» саму себя в сохранении, а жабы
 * в секторах колонии места не занимают (см. `getEnclosureToads`).
 * `preferredSceneId` (например, биопод матери или текущий биопод игрока) идёт первым.
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
    // Биопод, в который жаба встала, сразу становится и её домом: место занято,
    // «Домой» вернёт её сюда же
    assigned.push({ ...toad, scene_id: scene.id, homeId: scene.id });
  });

  return { assigned, rejected: toads.length - assigned.length };
};

/** Влезет ли столько жаб в биоподы колонии */
export const canHouseToads = (count = 1): boolean =>
  getHousingInfo().free >= count;

/** Вместимость нового биопода — то, что прибавляет постройка «Биопод» */
export const NEW_ENCLOSURE_CAPACITY = INITIAL_CAPACITY;
