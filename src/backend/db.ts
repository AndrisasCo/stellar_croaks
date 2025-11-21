import { createClient } from "@supabase/supabase-js";
import { Toad } from "../models/toad";
import { getGameState } from "./localStorage";

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

  const leaderbordData = {
    username: user.username,
    rarest_toad: toads.sort((a, b) => b.genes.rarity - a.genes.rarity)[0],
    biggest_toad: toads.sort((a, b) => b.genes.weight - a.genes.weight)[0],
    tokens: user.tokens,
    astro_quax: user.astro_quax,
    total_toads: toads.length,
  };

  const { data, error } = await supabase
    .from("leaderboard")
    .update(leaderbordData)
    .eq("user_id", user.id)
    .select();

  console.log("Updated leaderboard");
  return { data, error };
};

export const getAllLeaderboards = async () => {
  const { data } = await supabase.from("leaderboard").select();

  return data;
};
