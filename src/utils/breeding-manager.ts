import { getPregnancyDuration, HOURS_TO_GROW_UP, Toad } from "../models/toad";
import { createToads, updateToadById, updateToadsByIds } from "../backend";
import { generateChildToad } from "./calculate-genetics";
import { getHoursFromNow } from "./date";
import { getGameState } from "../backend/localStorage";
import { getHunger } from "./state-manager";
import { completeAchivement } from "../backend/achivements-manager";
import { getBoostByScene } from "../models/scene";

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
      const sceneId = toad.scene_id || "inv";
      if (!groups[sceneId]) {
        groups[sceneId] = [];
      }
      groups[sceneId].push(toad);
      return groups;
    }, {} as Record<string, Toad[]>);
};

const MIN_HUNGER_TO_BREED = 30;

const processSceneBreeding = async (
  sceneId: string,
  sceneToads: Toad[],
  hoursPassed: number,
  addNotification: any
) => {
  const pregnant = sceneToads.filter((t) => t.pregnancy);

  // рожаем
  pregnant.forEach((toad) => {
    if (
      toad.pregnancy &&
      getHoursFromNow(toad.pregnancy.pregnancyStart) >= // часы
        toad.pregnancy.pregnancyDuration
    ) {
      endPregnancy(toad, addNotification);
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

  if (hoursPassed > 0.09) {
    let pregnantCounter = 0;
    // ограничение по количеству самцов 1 на 5, это его предел
    // Обрабатываем каждую самку
    females.slice(0, males.length * 5).forEach((female) => {
      // Вычисляем общий шанс беременности для этой самки
      const pregnancyChance = calculatePregnancyChance(
        female,
        males,
        hoursPassed
      );

      console.log(`Female ${female.id} pregnancy chance: ${pregnancyChance}`);

      if (Math.random() < pregnancyChance) {
        // Выбираем отца на основе вероятностей
        const father = selectFather(males);
        startPregnancy(female, father);
        console.log(
          `Pregnancy started for female ${female.id} with father ${father.id}`
        );
        pregnantCounter += 1;
      }
    });

    pregnantCounter > 0 &&
      addNotification({
        content: `Ваши жабы беременны: ${pregnantCounter} `,
        type: "success",
      });
  }

  // смотрим нужно ли жабе вырасти
  const toadpoles = sceneToads.filter((t) => t.stage === "toadpole");

  const boost = getBoostByScene(toadpoles[0]?.scene_id, "grow");

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

const calculatePregnancyChance = (
  female: Toad,
  males: Toad[],
  hoursPassed: number
): number => {
  let baseChance = (female.genes?.fertility || 1) * 0.8;

  const rarityFactor = 1 / female.genes.rarity;
  baseChance *= Math.max(rarityFactor, 0.1);

  const timeFactor = Math.min(hoursPassed / 2, 1);
  baseChance *= 0.6 + timeFactor * 0.4;

  const maleFactor = Math.min(males.length / 2, 1);
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

export const startPregnancy = async (toad: Toad, father: Toad) => {
  const boost = getBoostByScene(toad.scene_id, "pregnancy");
  toad.pregnancy = {
    isPregnant: true,
    pregnancyStart: Date.now(),
    pregnancyDuration:
      Math.min(getPregnancyDuration() + toad.genes.rarity / 2, 12) / boost,
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
    Math.random() * 2 + female.genes.fertility / 10
  );
  return Math.min(baseCount + bonusCount, 10);
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

  const currentSceneId = children[0].scene_id;
  const currentScene = getGameState().scenes.find(
    (s) => s.id === currentSceneId
  );

  if (!currentScene) {
    throw Error("Scene for toads birth not found!");
  }

  const allToadsOnScene =
    getGameState().toads.filter((t) => t.scene_id === currentSceneId).length +
    children.length;

  if (currentScene.capacity < allToadsOnScene) {
    children.slice(0, allToadsOnScene - currentScene.capacity).forEach((c) => {
      c.scene_id = null;
    });
    addNotification({
      type: "warn",
      content:
        "Ваши жабы родили, но не все дети поместились в вольер! Часть была перемещена на склад.",
    });
  } else {
    addNotification({
      content: `Ваши жабы родили головастиков: ${children.length} `,
      type: "success",
    });
  }

  createToads(children, true);
  completeAchivement("first-offspring");
  // обновляем мать
  updateToadById(toad.id, { ...toad, pregnancy: null }, true);
};
