import { createClient } from "@supabase/supabase-js";
import { Toad } from "../models/toad";
import { getGameState, updateGameState } from "./localStorage";
import {
  getAchievementState,
  saveAchievementState,
  updateAchivementsState,
} from "./achivements-manager";
import { loadColliderState, saveColliderState } from "./collider-manager";

const REACT_APP_SUPABASE_URL = "https://fltghltrbknxqvdngnda.supabase.co";
const REACT_APP_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdGdobHRyYmtueHF2ZG5nbmRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTc1OTMsImV4cCI6MjA3ODQzMzU5M30.pED4_xBj5Xa9yPPsV_Vg24vtON0zzAmI5ng__AF2Gis";
// Create a single supabase client for interacting with your database
export const supabase = createClient<any>(
  REACT_APP_SUPABASE_URL,
  REACT_APP_SUPABASE_ANON_KEY
);

export type LeaderboardItemType = {
  tg_id: number;
  user_id: string;
  username: string;
  rarest_toad: Toad;
  biggest_toad: Toad;
  tokens: number;
  astro_quax: number;
  total_toads: number;
};

export const createLeaderbord = async () => {
  const { user, toads } = getGameState();
  if (!user.tg_id) {
    return;
  }
  const ldData = await getLeaderboardByTg();

  if (ldData?.data) {
    return;
  }
  const leaderbordData = {
    username: user.username,
    tg_id: user.tg_id,
    user_id: user.id,
    rarest_toad: toads.sort((a, b) => b.genes.rarity - a.genes.rarity)[0],
    biggest_toad: toads.sort((a, b) => b.genes.weight - a.genes.weight)[0],
    tokens: user.tokens,
    astro_quax: user.astro_quax,
    total_toads: toads.length,
  };

  const { data, error } = await supabase
    .from("leaderboard")
    .insert([leaderbordData])
    .select();
  console.log("Created leaderboard");

  return { data, error };
};

export const updateLeaderbord = async () => {
  const { user, toads } = getGameState();
  if (!user.tg_id) {
    return;
  }

  const ldData = await getLeaderboardByTg();
  if (!ldData?.data) {
    await createLeaderbord();
    return;
  }

  const leaderbordData = {
    username: user.username,
    rarest_toad: toads.sort((a, b) => b.genes.rarity - a.genes.rarity)[0],
    biggest_toad: toads.sort((a, b) => b.genes.weight - a.genes.weight)[0],
    tokens: user.tokens,
    astro_quax: user.astro_quax,
    total_toads: toads.length,
  };

  await supabase
    .from("leaderboard")
    .update(leaderbordData)
    .eq("tg_id", user.tg_id);

  console.log("Updated leaderboard");
};

export const getAllLeaderboards = async () => {
  await updateLeaderbord();
  const { data } = await supabase.from("leaderboard").select();

  return data;
};

export const getLeaderboardByTg = async () => {
  const { user } = getGameState();

  if (!user.tg_id) {
    return;
  }
  const data = await supabase
    .from("leaderboard")
    .select()
    .eq("tg_id", user.tg_id)
    .maybeSingle();

  return data;
};

export const createGameStateDB = async () => {
  const { user } = getGameState();

  if (!user.tg_id) {
    return;
  }

  const gameData = {
    tg_id: user.tg_id,
    content: getGameState(),
    achievements: getAchievementState(),
    collider: loadColliderState(),
  };

  const { data, error } = await supabase
    .from("game_state")
    .insert([gameData])
    .select();

  console.log("Created game state!");

  return { data, error };
};

export const updateGameStateDB = async () => {
  const { user } = getGameState();

  const allState = {
    ...getGameState(),
  };

  if (!user.tg_id) {
    return;
  }

  const { data, error } = await supabase
    .from("game_state")
    .update({
      content: allState,
      achievements: getAchievementState(),
      collider: loadColliderState(),
    })
    .eq("tg_id", user.tg_id)
    .select();

  console.log("updated GameState");
  return { data, error };
};

export const getGameStateDB = async () => {
  const { user } = getGameState();

  if (!user.tg_id) {
    return;
  }

  const { data, error } = await supabase
    .from("game_state")
    .select()
    .eq("tg_id", user.tg_id)
    .maybeSingle();

  console.log("get GameState");

  return { data, error };
};

export const syncGameState = async () => {
  const currentGS = getGameState();
  const { user } = currentGS;

  if (!user.tg_id) {
    return;
  }

  const data = await getGameStateDB();

  if (data?.error) {
    return;
  }

  if (!data?.data) {
    await createGameStateDB();

    return;
  }

  const gameStateStored = data.data;

  const accountCreated = currentGS.createdAt
    ? new Date(currentGS.createdAt).getTime()
    : Date.now();

  // аккаунт создался в лс, но он уже есть в бд
  if (new Date(gameStateStored.created_at).getTime() < accountCreated) {
    // перезаписываем игру через дб
    updateGameState({
      ...gameStateStored.content,
      createdAt: gameStateStored.created_at,
    });
    if (Object.keys(gameStateStored.achievements).length) {
      saveAchievementState(gameStateStored.achievements);
    }
    if (Object.keys(gameStateStored.collider).length) {
      saveColliderState(gameStateStored.collider);
      window.dispatchEvent(new Event("colliderChanged"));
    }
    console.log("sync GameState");

    return;
  }

  // смотрим какое сохранение более свежее
  const lastVisitLs = new Date(currentGS.lastSaved).getTime();
  const lastVisitDb = new Date(gameStateStored.content.lastSaved).getTime();

  console.log(
    `last saved ls: ${currentGS.lastSaved}, last saved db: ${gameStateStored.content.lastSaved}`
  );

  // последний синк меньше чем 3 минуты - много багов у пользователй, может какие-то тормоза мешают
  if (Math.abs(lastVisitLs - lastVisitDb) < 1000 * 60 * 3) {
    console.log("sync Data is fresh");
    return;
  }

  if (lastVisitLs > lastVisitDb) {
    console.log("sync GameState db");
    await updateGameStateDB();
    return;
  }

  console.log("sync GameState ls");
  updateGameState({
    ...gameStateStored.content,
  });

  if (Object.keys(gameStateStored.achievements).length) {
    saveAchievementState(gameStateStored.achievements);
  }
  if (Object.keys(gameStateStored.collider).length) {
    saveColliderState(gameStateStored.collider);
    window.dispatchEvent(new Event("colliderChanged"));
  }
};
