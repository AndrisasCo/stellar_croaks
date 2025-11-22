// hooks/useGameState.ts
import { useState, useEffect } from "react";
import { getGameState } from "../backend/localStorage";

export const useGameState = () => {
  const [gameState, setGameState] = useState(getGameState());

  const handleStorageChange = () => {
    setGameState(getGameState());
  };

  // Слушаем изменения в localStorage
  useEffect(() => {
    window.addEventListener("gameStateUpdated", handleStorageChange);

    // Или слушаем изменения localStorage (менее надежно)
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("gameStateUpdated", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return gameState;
};
