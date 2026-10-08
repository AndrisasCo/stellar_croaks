import { updateToadById, updateUser } from "../backend";
import { getGameState } from "../backend/localStorage";
import {
  CyberEventDef,
  CYBER_EVENT_CHANCE_PER_HOUR,
  pickCyberEvent,
} from "./cyber-events";
import { infectToad } from "./disease-manager";

// === ЧАСТЬ 3.6. Кибер-события (техногенные риски и удачи) ===

/** Случайная жаба в вольере (её и триггерит событие) */
const pickSceneToad = () => {
  const inScenes = getGameState().toads.filter((toad) => toad.scene_id !== null);
  const pool = inScenes.length > 0 ? inScenes : getGameState().toads;
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Применяет эффект события к сохранению.
 * Возвращает человекочитаемое описание применённых эффектов.
 */
export const applyCyberEvent = (event: CyberEventDef): string => {
  const state = getGameState();
  const { effect } = event;
  const parts: string[] = [];

  if (effect.biomass) {
    const next = Math.max(0, (state.user.biomass || 0) + effect.biomass);
    updateUser({ biomass: Math.round(next * 100) / 100 });
    parts.push(`биомасса ${effect.biomass > 0 ? "+" : ""}${effect.biomass}`);
  }

  if (effect.tokens) {
    updateUser({ tokens: state.user.tokens + effect.tokens });
    parts.push(`${effect.tokens > 0 ? "+" : ""}${effect.tokens} Кваксов`);
  }

  if (effect.food) {
    const food = Math.max(0, (state.user.storage?.food || 0) + effect.food);
    updateUser({ storage: { ...state.user.storage, food } });
    parts.push(`корм ${effect.food > 0 ? "+" : ""}${effect.food}`);
  }

  if (effect.hunger) {
    const toad = pickSceneToad();
    if (toad) {
      const hunger = Math.max(
        0,
        Math.min(100, Math.round((toad.state.hunger + effect.hunger) * 10) / 10)
      );
      updateToadById(toad.id, { state: { ...toad.state, hunger } }, true);
      parts.push(`${toad.name}: голод ${effect.hunger > 0 ? "+" : ""}${effect.hunger}`);
    }
  }

  if (effect.infect) {
    const toad = pickSceneToad();
    if (toad && infectToad(toad.id)) {
      parts.push(`${toad.name} заражена`);
    }
  }

  return parts.join(", ");
};

/**
 * Прокрутка кибер-событий за прошедшие часы.
 * Не более одного события за тик (оффлайн-абузы не страшны).
 */
export const processCyberEvents = (
  hoursPassed: number,
  addNotification?: (notification: any) => void
): CyberEventDef[] => {
  if (hoursPassed <= 0) {
    return [];
  }

  const applied: CyberEventDef[] = [];
  let remaining = Math.min(hoursPassed, 24);

  while (remaining > 0) {
    const chunk = Math.min(1, remaining);
    remaining -= chunk;

    if (Math.random() >= CYBER_EVENT_CHANCE_PER_HOUR * chunk) {
      continue;
    }

    const event = pickCyberEvent();
    const description = applyCyberEvent(event);
    applied.push(event);

    addNotification?.({
      type: event.kind === "positive" ? "success" : "warn",
      content: `⚡ ${event.title}: ${event.message}${
        description ? ` (${description})` : ""
      }`,
    });

    break;
  }

  return applied;
};

