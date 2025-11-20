import { getPregnancyDuration, HOURS_TO_GROW_UP, Toad } from "../models/toad";
import {
  createToads,
  getToadById,
  updateToadById,
  updateToadsByIds,
} from "../backend";
import { generateChildToad } from "./calculate-genetics";
import { getHoursFromNow } from "./date";
import { getGameState, updateGameState } from "../backend/localStorage";
import { triggerNotification } from "../hooks/use-notification";

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
    const gameDaysPassed = Math.floor(realTimeDiff / (60 * 60 * 1000)); // 1 час = 1 игровой день

    return Math.min(gameDaysPassed, 90); // максимум 90 "дней" оффлайн
  }
}

export const processBreeding = (daysPassed: number, toads: Toad[]) => {
  console.log("processBreeding started");

  // Группируем жаб по сценам
  const toadsByScene = groupToadsByScene(toads);

  // Обрабатываем каждую сцену отдельно
  Object.entries(toadsByScene).forEach(([sceneId, sceneToads]) => {
    processSceneBreeding(sceneId, sceneToads, daysPassed);
  });
};

const groupToadsByScene = (toads: Toad[]): Record<string, Toad[]> => {
  return toads
    .filter((t) => t.scene_id)
    .reduce((groups, toad) => {
      const sceneId = toad.scene_id || "inv";
      if (!groups[sceneId]) {
        groups[sceneId] = [];
      }
      groups[sceneId].push(toad);
      return groups;
    }, {} as Record<string, Toad[]>);
};

const MIN_HUNGER_TO_BREED = 50;

const processSceneBreeding = async (
  sceneId: string,
  sceneToads: Toad[],
  daysPassed: number
) => {
  const pregnant = sceneToads.filter((t) => t.pregnancy);

  // рожаем
  pregnant.forEach((toad) => {
    if (
      toad.pregnancy &&
      getHoursFromNow(toad.pregnancy.pregnancyStart) >= // часы
        toad.pregnancy.pregnancyDuration
    ) {
      endPregnancy(toad);
    }
  });

  // Фильтруем потенциальных партнеров
  const females = sceneToads
    .filter((t) => t.state.hunger > MIN_HUNGER_TO_BREED)
    .filter(
      (t) =>
        t.stage === "adult" && !t.pregnancy?.isPregnant && t.sex === "female"
    );

  const males = sceneToads
    .filter((t) => t.state.hunger > MIN_HUNGER_TO_BREED)
    .filter((t) => t.stage === "adult" && t.sex === "male");

  console.log(
    `Scene ${sceneId}: ${females.length} females, ${males.length} males`
  );

  // ограничение по количеству самцов 1 на 5, это его предел
  // Обрабатываем каждую самку
  females.slice(0, males.length * 5).forEach((female) => {
    // Вычисляем общий шанс беременности для этой самки
    const pregnancyChance = calculatePregnancyChance(female, males, daysPassed);

    console.log(`Female ${female.id} pregnancy chance: ${pregnancyChance}`);

    if (Math.random() < pregnancyChance) {
      // Выбираем отца на основе вероятностей
      const father = selectFather(males);
      startPregnancy(female, father.id);
      console.log(
        `Pregnancy started for female ${female.id} with father ${father.id}`
      );
    }
  });

  // смотрим нужно ли жабе вырасти
  const toadpoles = sceneToads
    .filter((t) => t.stage === "toadpole")
    .filter((t) => t.state.hunger > MIN_HUNGER_TO_BREED);

  const grownToadpoles: number[] = [];
  toadpoles.forEach((t) => {
    if (getHoursFromNow(t.created_at) >= HOURS_TO_GROW_UP) {
      console.log(`Toad ${t.name} has grown up!`);
      grownToadpoles.push(t.id);
    }
  });

  if (grownToadpoles.length > 0) {
    updateToadsByIds(grownToadpoles, { stage: "adult" });
  }
};

const calculatePregnancyChance = (
  female: Toad,
  males: Toad[],
  hoursPassed: number
): number => {
  let baseChance = (female.genes?.fertility || 1) * 0.8;

  const timeFactor = Math.min(hoursPassed / 2, 1);
  baseChance *= 0.6 + timeFactor * 0.4;

  const maleFactor = Math.min(males.length / 2, 1); // Было 3 самца
  baseChance *= 0.7 + maleFactor * 0.3;

  // Штраф за голод (новая механика)
  const hungerPenalty = female.state.hunger > 70 ? 1 : female.state.hunger / 70;
  baseChance *= hungerPenalty;

  return Math.min(baseChance, 0.9); // Почти гарантия при идеальных условиях
};

const selectFather = (males: Toad[]): Toad => {
  // Вычисляем вес для каждого самца на основе его fertility
  const maleWeights = males.map((male) => ({
    male,
    weight: male.genes.fertility * (0.8 + Math.random() * 0.4), // Небольшая случайность
  }));

  // Сортируем по весу (более плодовитые самцы имеют больше шансов)
  maleWeights.sort((a, b) => b.weight - a.weight);

  // Берем топ-2 самцов и выбираем случайно с учетом весов
  const topMales = maleWeights.slice(0, 2);
  const totalWeight = topMales.reduce((sum, m) => sum + m.weight, 0);

  let random = Math.random() * totalWeight;
  for (const { male, weight } of topMales) {
    if (random < weight) {
      return male;
    }
    random -= weight;
  }

  // Fallback - возвращаем первого из топ-3
  return topMales[0].male;
};

export const startPregnancy = async (toad: Toad, fatherId: number) => {
  toad.pregnancy = {
    isPregnant: true,
    pregnancyStart: Date.now(),
    pregnancyDuration: getPregnancyDuration(),
    fatherId,
    offspringCount: calculateOffspringCount(toad),
  };

  await updateToadById(toad.id, toad);
};

const calculateOffspringCount = (female: Toad): number => {
  // Базовое количество + влияние fertility
  const baseCount = 1;
  const bonusCount = Math.floor(female.genes.fertility * 3);
  return baseCount + bonusCount;
};

export const endPregnancy = async (toad: Toad) => {
  console.log("Female end pregnancy: ", toad.name);

  if (!toad.pregnancy) {
    return;
  }
  const { offspringCount, fatherId } = toad.pregnancy;

  const father = getToadById(fatherId);

  const children = new Array(offspringCount)
    .fill(1)
    .map(() => generateChildToad([toad, father], false));

  const currentSceneId = children[0].scene_id;
  const currentScene = getGameState().scenes.find(
    (s) => s.id === currentSceneId
  );

  if (!currentScene) {
    throw Error("Scene for toads birth not found!");
  }

  const allToadsOnScene =
    getGameState().toads.filter(
      (t) => !t.is_off && t.scene_id === currentSceneId
    ).length + children.length;

  if (currentScene.capacity < allToadsOnScene) {
    children.slice(0, allToadsOnScene - currentScene.capacity).forEach((c) => {
      c.scene_id = null;
    });
    triggerNotification(
      "Ваши жабы родили, но не все дети поместились в вольер! Часть была перемещена на склад."
    );
  }

  createToads(children);
  // обновляем мать
  toad.pregnancy = null;
  updateToadById(toad.id, toad);
};
