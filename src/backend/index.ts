import { Scene } from "../models/scene";
import { Toad } from "../models/toad";
import { User } from "../models/user";
import { getGameState, updateGameState, webAppData } from "./localStorage";

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
export const createToad = (toadData: Partial<Toad>): Toad[] => {
  const state = getGameState();
  const newToad: Toad = {
    id: Math.round(Date.now() * Math.random()),
    created_at: new Date().toISOString(),
    owner: state.user.id,
    ...toadData,
  } as Toad;

  const newToads = [...state.toads, newToad];
  updateGameState({ toads: newToads });

  return [newToad];
};

export const createToads = (
  toadsData: Partial<Toad>[],
  syntetic?: boolean
): Toad[] => {
  const state = getGameState();
  const newToads: Toad[] = toadsData.map(
    (toadData) =>
      ({
        id: Math.round(Math.random() * Date.now()),
        created_at: new Date().toISOString(),
        owner: state.user.id,
        ...toadData,
      } as Toad)
  );

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

// Toad update operations
export const updateToadById = (
  toadId: number,
  toadData: Partial<Toad>,
  syntetic?: boolean
): Toad[] => {
  const state = getGameState();
  const updatedToads = state.toads.map((toad) =>
    toad.id === toadId ? { ...toad, ...toadData } : toad
  );

  updateGameState({ toads: updatedToads }, syntetic);
  const updatedToad = updatedToads.find((t) => t.id === toadId);

  return updatedToad ? [updatedToad] : [];
};

export const updateToadsByIds = (
  toadIds: number[],
  toadData: Partial<Toad>,
  syntetic?: boolean
): Toad[] => {
  const state = getGameState();
  const updatedToads = state.toads.map((toad) =>
    toadIds.includes(toad.id) ? { ...toad, ...toadData } : toad
  );

  updateGameState({ toads: updatedToads }, syntetic);
  const updatedToadsList = updatedToads.filter((t) => toadIds.includes(t.id));

  return updatedToadsList;
};

export const updateToadStateByIds = (
  toadIds: number[],
  toadStateData: Record<string, number>,
  syntetic?: boolean
): Toad[] => {
  const state = getGameState();
  const updatedToads = state.toads.map((toad) =>
    toadIds.includes(toad.id)
      ? { ...toad, state: { ...toad.state, ...toadStateData } }
      : toad
  );

  updateGameState({ toads: updatedToads }, syntetic);
  const updatedToadsList = updatedToads.filter((t) => toadIds.includes(t.id));

  return updatedToadsList;
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
  sceneData: Partial<Scene>
): Scene[] => {
  const state = getGameState();
  const updatedScenes = state.scenes.map((scene) =>
    scene.id === sceneId ? { ...scene, ...sceneData } : scene
  );

  updateGameState({ scenes: updatedScenes });

  return updatedScenes;
};
