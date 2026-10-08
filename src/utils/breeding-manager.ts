import { getPregnancyDuration, HOURS_TO_GROW_UP, Toad } from "../models/Toad";
import {
  createToads,
  updateScene,
  updateToadById,
  updateToadsByIds,
  updateUser,
} from "../backend";
import { generateChildToad } from "./calculate-genetics";
import { getHoursFromNow } from "./date";
import { getGameState } from "../backend/localStorage";
import { getHunger } from "./state-manager";
import { completeAchivement } from "../backend/achivements-manager";
import { BonusType, getBoostByScene } from "../models/scene";
import { MAX_STORED_TOADS } from "./constants";
import {
  canUpgradeNest,
  getBreedCooldownMs,
  getBreedPairBiomassCost,
  getEnergyCost,
  getNestSlotUpgradeCost,
  getNestSlots,
  getToadEnergy,
  isToadReadyToBreed,
  NEST_MAX_SLOTS,
} from "./gamification-config";
import { isToadDown } from "./expedition-config";
import { isToadOnExpedition } from "./expedition-manager";

export class TimeManager {
  lastPlayTime: string | number;
  currentTime: number;

  constructor() {
    this.lastPlayTime = new Date(
      getGameState().lastSaved || Date.now()
    ).getTime();
    this.currentTime = Date.now();
  }

  getTimePassed() {
    const realTimeDiff = this.currentTime - +this.lastPlayTime;
    const gameDaysPassed =
      Math.floor((realTimeDiff / (60 * 60 * 1000)) * 100) / 100; // 1 час

    return Math.min(gameDaysPassed, 90); // максимум 90 "дней" оффлайн
  }
}

export const processBreeding = (hoursPassed: number, addNotification: any) => {
  const toads = getGameState().toads.filter((t) => t.scene_id !== null);

  // Группируем жаб по сценам
  const toadsByScene = groupToadsByScene(toads);

  // Обрабатываем каждую сцену отдельно
  Object.entries(toadsByScene).forEach(([sceneId, sceneToads]) => {
    processSceneBreeding(sceneId, sceneToads, hoursPassed, addNotification);
  });
};

const groupToadsByScene = (toads: Toad[]): Record<string, Toad[]> => {
  return toads
    .filter((t) => t.scene_id)
    .reduce((groups, toad) => {
      const sceneId = toad.scene_id || "0";
      if (!groups[sceneId]) {
        groups[sceneId] = [];
      }
      groups[sceneId].push(toad);
      return groups;
    }, {} as Record<string, Toad[]>);
};

const processSceneBreeding = async (
  sceneId: string,
  sceneToads: Toad[],
  hoursPassed: number,
  addNotification: any
) => {
  const pregnant = sceneToads.filter((t) => t.pregnancy);

  // рожаем уже начатые беременности (таймер дожидаем — ок)
  pregnant.forEach((toad) => {
    if (
      toad.pregnancy &&
      getHoursFromNow(toad.pregnancy.pregnancyStart) >= // часы
        toad.pregnancy.pregnancyDuration
    ) {
      endPregnancy(toad, addNotification);
    }
  });

  // Часть 3.2: авто-беременность по таймеру удалена.
  // Новые беременности запускаются ТОЛЬКО вручную через «Гнездо»
  // (см. performManualBreeding). Здесь остаются роды и рост головастиков.

  // смотрим нужно ли жабе вырасти
  const toadpoles = sceneToads.filter((t) => t.stage === "toadpole");

  const boost = getBoostByScene(toadpoles[0]?.scene_id, BonusType.grow);

  const boostedTimeToGrow = HOURS_TO_GROW_UP / boost;

  const grownToadpoles: number[] = [];
  toadpoles.forEach((t) => {
    if (getHoursFromNow(t.created_at) >= boostedTimeToGrow) {
      const hunger = getHunger(
        t.state.hunger,
        t.genes.hungerRate,
        boostedTimeToGrow
      );

      if (t.state.hunger - hunger < 0) {
        addNotification({
          content: `${t.name}  был слишком голодный и не смог вырасти!`,
          type: "warn",
        });
      } else {
        console.log(`Toad ${t.name} has grown up!`);
        grownToadpoles.push(t.id);
      }
    }
  });

  if (grownToadpoles.length > 0) {
    updateToadsByIds(grownToadpoles, { stage: "adult" }, true);
  }
};

export const startPregnancy = async (toad: Toad, father: Toad) => {
  const boost = getBoostByScene(toad.scene_id, BonusType.pregnancy);
  toad.pregnancy = {
    isPregnant: true,
    pregnancyStart: Date.now(),
    pregnancyDuration:
      Math.min(getPregnancyDuration() + toad.genes.rarity / 2, 8) / boost,
    fatherId: father.id,
    father,
    offspringCount: calculateOffspringCount(toad),
  };

  updateToadById(toad.id, toad, true);
};

const calculateOffspringCount = (female: Toad): number => {
  // Базовое количество + влияние fertility
  const baseCount = Math.ceil(female.genes.fertility / female.genes.rarity);
  const bonusCount = Math.floor(
    Math.random() * 1 + female.genes.fertility / 10
  );
  return Math.min(baseCount + bonusCount, 5);
};

export const endPregnancy = async (toad: Toad, addNotification: any) => {
  console.log("Female end pregnancy: ", toad.name);

  if (!toad.pregnancy) {
    return;
  }
  const { offspringCount } = toad.pregnancy;

  const father = toad.pregnancy.father;

  if (!father) {
    updateToadById(toad.id, { ...toad, pregnancy: null }, true);
    return;
  }

  const children = new Array(offspringCount)
    .fill(1)
    .map(() => generateChildToad([toad, father], false));

  const currentSceneId = toad.scene_id;
  const currentScene = getGameState().scenes.find(
    (s) => s.id === currentSceneId
  );

  if (!currentScene) {
    throw Error("Scene for toads birth not found!");
  }

  const allToadsAtStorage = getGameState().toads.filter(
    (t) => !t.scene_id
  ).length;
  const allToadsOnScene =
    getGameState().toads.filter((t) => t.scene_id === currentSceneId).length +
    children.length;

  if (currentScene.capacity < allToadsOnScene) {
    children.slice(0, allToadsOnScene - currentScene.capacity).forEach((c) => {
      c.scene_id = null;
    });

    if (
      allToadsAtStorage + children.filter((c) => c.scene_id === null).length >
      MAX_STORED_TOADS
    ) {
      addNotification({
        type: "danger",
        content: `${toad.name} не смогла родить, все хранилища переполнены`,
      });
      return;
    }

    addNotification({
      type: "warn",
      content: `${toad.name} родила головастиков, но они не поместились в вольер! Часть была перемещена на склад.`,
    });
  } else {
    addNotification({
      content: `${toad.name} родила  головастиков: ${children.length} `,
      type: "success",
    });
  }

  createToads(children, true);
  completeAchivement("first-offspring");
  // обновляем мать
  updateToadById(toad.id, { ...toad, pregnancy: null }, true);
};

/**
 * Занятость родильных слотов вольера (Часть 3.2).
 * used — число беременных жаб, limit — лимит слотов купола.
 */
export const getNestOccupancy = (
  sceneId: number | null
): { used: number; limit: number } => {
  const state = getGameState();
  const scene = state.scenes.find((s) => s.id === sceneId) ?? null;
  const used = state.toads.filter(
    (t) => t.scene_id === sceneId && t.pregnancy?.isPregnant
  ).length;

  return { used, limit: getNestSlots(scene) };
};

export interface ManualBreedingResult {
  success: boolean;
  message: string;
}

/**
 * Апгрейд постройки «Гнездо» (Часть 3.2): +1 родильный слот за Кваксы.
 * Цена растёт с каждым апгрейдом, максимум — NEST_MAX_SLOTS.
 */
export const upgradeNestSlots = (
  sceneId: number | null
): ManualBreedingResult => {
  const state = getGameState();
  const scene = state.scenes.find((s) => s.id === sceneId);

  if (!scene) {
    return { success: false, message: "Вольер для апгрейда не найден" };
  }

  if (!canUpgradeNest(scene)) {
    return {
      success: false,
      message: `Гнездо уже расширено до предела (${NEST_MAX_SLOTS} слотов)`,
    };
  }

  const cost = getNestSlotUpgradeCost(scene);
  const tokens = state.user.tokens || 0;

  if (tokens < cost) {
    return {
      success: false,
      message: `Не хватает Кваксов на Гнездо: нужно ${cost}, есть ${Math.floor(
        tokens
      )}`,
    };
  }

  const slots = getNestSlots(scene) + 1;

  updateScene(scene.id, { nestSlots: slots });
  updateUser({ tokens: tokens - cost });

  return {
    success: true,
    message: `Гнездо расширено: ${slots} родильных слотов`,
  };
};

/**
 * Ручное спаривание через «Гнездо» (Часть 3.2).
 * Списывает энергию у обоих родителей и биомассу с аккаунта,
 * сажает обеих жаб на cooldown и запускает беременность самки.
 */
export const performManualBreeding = async (
  maleId: number,
  femaleId: number,
  addNotification?: (notification: any) => void
): Promise<ManualBreedingResult> => {
  const state = getGameState();

  const fail = (message: string): ManualBreedingResult => {
    addNotification?.({ type: "warn", content: message });
    return { success: false, message };
  };

  const male = state.toads.find((t) => t.id === maleId);
  const female = state.toads.find((t) => t.id === femaleId);

  if (!male || !female) {
    return fail("Жаба для спаривания не найдена");
  }
  if (male.sex !== "male") {
    return fail("В роли партнёра нужен самец");
  }
  if (female.sex !== "female") {
    return fail("Для спаривания нужна самка");
  }
  if (male.scene_id === null || female.scene_id !== male.scene_id) {
    return fail("Обе жабы должны находиться в одном вольере");
  }
  // Часть 5: выбитые (HP = 0) и ушедшие в поход жабы не размножаются
  if (isToadDown(male) || isToadDown(female)) {
    return fail("Выбитая жаба не может размножаться — сначала подлечите её");
  }
  if (
    isToadOnExpedition(male.id) ||
    isToadOnExpedition(female.id)
  ) {
    return fail("Жаба в походе за Периметр — размножение только дома");
  }
  if (female.pregnancy?.isPregnant) {
    return fail(`${female.name} уже вынашивает потомство`);
  }

  const { used, limit } = getNestOccupancy(female.scene_id);
  if (used >= limit) {
    return fail("Все гнёзда вольера заняты — дождитесь родов");
  }

  if (!isToadReadyToBreed(male)) {
    return fail(`${male.name} ещё не восстановил силы для спаривания`);
  }
  if (!isToadReadyToBreed(female)) {
    return fail(`${female.name} ещё не восстановила силы для спаривания`);
  }

  const biomassCost = getBreedPairBiomassCost(male, female);
  const biomass = state.user.biomass || 0;

  if (biomass < biomassCost) {
    return fail(
      `Не хватает биомассы для гнезда: нужно ${biomassCost}, есть ${Math.floor(
        biomass
      )}`
    );
  }

  const now = Date.now();

  const updatedMale: Toad = {
    ...male,
    energy: getToadEnergy(male) - getEnergyCost(male),
    breedCooldownUntil: now + getBreedCooldownMs(male),
  };

  const updatedFemale: Toad = {
    ...female,
    energy: getToadEnergy(female) - getEnergyCost(female),
    breedCooldownUntil: now + getBreedCooldownMs(female),
  };

  updateToadById(updatedMale.id, updatedMale, true);
  updateUser({ biomass: Math.round((biomass - biomassCost) * 100) / 100 });

  // startPregnancy сохранит самку вместе с новыми энергией и cooldown
  await startPregnancy(updatedFemale, updatedMale);

  addNotification?.({
    type: "success",
    content: `${updatedMale.name} ♥ ${updatedFemale.name}: беременность началась!`,
  });

  return { success: true, message: "Беременность началась" };
};
