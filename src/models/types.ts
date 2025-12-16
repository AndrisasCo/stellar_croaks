import { Toad } from "./Toad";

export interface BreedingResult {
  success: boolean;
  child: Toad;
  message: string;
}

export interface BreedingSlot {
  id: number;
  child: Toad | null;
  startTime: number | null;
  duration: number; // в миллисекундах
  isReady: boolean;
}

export interface ColliderState {
  slots: BreedingSlot[];
  maxSlots: number;
  speedMultiplier: number; // множитель скорости (для улучшений)
}
