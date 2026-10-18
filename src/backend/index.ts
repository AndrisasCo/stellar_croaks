import { Scene } from "../models/scene";
import { Toad } from "../models/Toad";
import { User } from "../models/user";
import { getHunger } from "../utils/state-manager";
import { getSceneWithFreeSlot } from "../utils/housing";
import {
  ENERGY_REGEN_PER_HOUR,
  MAX_ENERGY,
  getToadEnergy,
} from "../utils/gamification-config";
import {
  addToadToCollection,
  checkGeneticAchievements,
} from "./achivements-manager";
import { getGameState, updateGameState } from "./localStorage";

export const createScene = (sceneData: Partial<Scene>): Scene[] => {
  const state = getGameState();
  const newScene: Scene = {
    id: Date.now(),
    created_at: new Date().toISOString(),
    ...sceneData,
  } as Scene;

  const newScenes = [...state.scenes, newScene];
  updateGameState({ scenes: newScenes });

  return [newScene];
};

export const getScenes = (): Scene[] => {
  const state = getGameState();
  return state.scenes;
};

// Toad operations

/**
 * Биопод для новой жабы. Склада жаб больше нет: биопод у жабы всегда есть,
 * поэтому если вызвавший код не указал (или указал несуществующий) биопод,
 * берём первый, где есть место, иначе — первый биопод колонии (страховка от
 * сейвов старых версий; переполнение лечится постройкой нового биопода на карте).
 */
const resolveSceneId = (sceneId?: number | null): number => {
  const state = getGameState();

  if (sceneId && state.scenes.some((scene) => scene.id === sceneId)) {
    return sceneId;
  }

  return getSceneWithFreeSlot()?.id ?? state.scenes[0]?.id ?? 1;
};

/**
 * Место новой жабы:
 *  - жаба, которую создают в биоподе (покупка, награда, лутбокс, потомство дома),
 *    живёт в нём же, и он становится её домом;
 *  - жаба, которую создают сразу в секторе колонии (головастик, родившийся в
 *    репродукторе), в биоподе не числится: её `scene_id` — id сектора, место там не
 *    занято. Дом ей всё равно нужен — по нему её вернут кнопкой «Домой»
 *    (`sendToadHome`), и тогда место проверят.
 */
const resolveToadPlacement = (
  toadData: Partial<Toad>,
): { scene_id: number | string | null; homeId: number } => {
  // Дом — биопод, в который жаба вернётся: у жабы в секторе это `homeId` (например,
  // биопод матери у головастика), у жильца биопода — сам биопод. Явный дом не теряем.
  const homeId = resolveSceneId(
    typeof toadData.scene_id === "number"
      ? toadData.scene_id
      : toadData.homeId ?? null,
  );

  // Жаба, созданная сразу в секторе колонии, остаётся в нём (`scene_id` — id комнаты),
  // но домом ей всё равно служит биопод: туда её вернёт кнопка «Домой».
  return {
    scene_id:
      typeof toadData.scene_id === "string" ? toadData.scene_id : homeId,
    homeId,
  };
};

export const createToad = (toadData: Partial<Toad>): Toad[] => {
  const state = getGameState();
  const newToad: Toad = {
    id: Math.round(Date.now() * Math.random()),
    created_at: new Date().toISOString(),
    ...toadData,
    ...resolveToadPlacement(toadData),
  } as Toad;

  const newToads = [...state.toads, newToad];
  updateGameState({ toads: newToads });

  checkGeneticAchievements(newToad);

  if (newToad.type) {
    addToadToCollection(newToad.type);
  }

  return [newToad];
};

export const createToads = (
  toadsData: Partial<Toad>[],
  syntetic?: boolean,
): Toad[] => {
  const state = getGameState();
  const newToads: Toad[] = toadsData.map((toadData) => {
    checkGeneticAchievements(toadData as Toad);

    if (toadData.type) {
      addToadToCollection(toadData.type);
    }

    return {
      id: Math.round(Math.random() * Date.now()),
      created_at: new Date().toISOString(),
      ...toadData,
      ...resolveToadPlacement(toadData),
    } as Toad;
  });

  const allToads = [...state.toads, ...newToads];
  updateGameState({ toads: allToads }, syntetic);

  return newToads;
};

export const getAllToads = (): Toad[] => {
  const state = getGameState();
  return state.toads;
};

export const getToadById = (toadId: number): Toad => {
  const state = getGameState();
  const toad = state.toads.find((t) => t.id === toadId);
  if (!toad) {
    throw new Error(`Toad with id ${toadId} not found`);
  }
  return toad;
};

// User operations
export const updateUser = (userData: Partial<User>): User => {
  const state = getGameState();
  const updatedUser = { ...state.user, ...userData };

  updateGameState({ user: updatedUser });

  return updatedUser;
};

export const updateUserStorage = (userData: Record<string, number>) => {
  const state = getGameState();
  const updatedUserStorage = { ...state.user.storage, ...userData };

  updateGameState({ user: { ...state.user, storage: updatedUserStorage } });
};

// Toad update operations
export const updateToadById = (
  toadId: number,
  toadData: Partial<Toad>,
  syntetic?: boolean,
): Toad[] => {
  const state = getGameState();
  const updatedToads = state.toads.map((toad) =>
    toad.id === toadId ? { ...toad, ...toadData } : toad,
  );

  updateGameState({ toads: updatedToads }, syntetic);
  const updatedToad = updatedToads.find((t) => t.id === toadId);

  return updatedToad ? [updatedToad] : [];
};

export const updateToadsByIds = (
  toadIds: number[],
  toadData: Partial<Toad>,
  syntetic?: boolean,
): Toad[] => {
  const state = getGameState();
  const updatedToads = state.toads.map((toad) =>
    toadIds.includes(toad.id) ? { ...toad, ...toadData } : toad,
  );

  updateGameState({ toads: updatedToads }, syntetic);
  const updatedToadsList = updatedToads.filter((t) => toadIds.includes(t.id));

  return updatedToadsList;
};

export const updateToadStateByIds = (
  toadIds: number[],
  toadStateData: Record<string, number>,
  syntetic?: boolean,
): Toad[] => {
  const state = getGameState();
  const updatedToads = state.toads.map((toad) =>
    toadIds.includes(toad.id)
      ? { ...toad, state: { ...toad.state, ...toadStateData } }
      : toad,
  );

  updateGameState({ toads: updatedToads }, syntetic);
  const updatedToadsList = updatedToads.filter((t) => toadIds.includes(t.id));

  return updatedToadsList;
};

export const updateToadsBulkHunger = (
  hoursPassed: number,
  syntetic?: boolean,
) => {
  const state = getGameState();
  // Голод идёт у всех жаб колонии — и дома, и в секторе (репродуктор, ⚡, лазарет):
  // место (`scene_id`)
  const updatedToads = state.toads.map((toad) =>
    toad.state?.hunger
      ? {
          ...toad,
          state: {
            ...toad.state,
            hunger: getHunger(
              toad.state.hunger,
              toad.genes.hungerRate,
              hoursPassed,
            ),
          },
        }
      : toad,
  );

  updateGameState({ toads: updatedToads }, syntetic);
};

/**
 * Пассивное восстановление «сил» (energy) у всех жаб.
 * Часть 3.2: жабы копят силы со временем (+ENERGY_REGEN_PER_HOUR в час).
 */
export const updateToadsBulkEnergy = (
  hoursPassed: number,
  syntetic?: boolean,
) => {
  const state = getGameState();
  const updatedToads = state.toads.map((toad) => ({
    ...toad,
    energy: Math.min(
      MAX_ENERGY,
      getToadEnergy(toad) + ENERGY_REGEN_PER_HOUR * hoursPassed,
    ),
  }));

  updateGameState({ toads: updatedToads }, syntetic);
};

export const deleteToadsByIds = (toadIds: number[]): Toad[] => {
  const state = getGameState();
  const updatedToads = state.toads.filter((toad) => !toadIds.includes(toad.id));

  updateGameState({ toads: updatedToads });

  return updatedToads;
};

// Scene operations
export const updateScene = (
  sceneId: number,
  sceneData: Partial<Scene>,
): Scene[] => {
  const state = getGameState();
  const updatedScenes = state.scenes.map((scene) =>
    scene.id === sceneId ? { ...scene, ...sceneData } : scene,
  );

  updateGameState({ scenes: updatedScenes });

  return updatedScenes;
};
