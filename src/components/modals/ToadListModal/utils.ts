import { Toad } from "../../../models/Toad";
import { getToadHomeId, isToadSamePlace } from "../../../utils/toad-location";

// Неоновые цвета в стиле игры для родственных связей (25 цветов)
export const RELATIONSHIP_COLORS = [
  "rgba(255, 20, 147, 0.15)", // Neon Pink
  "rgba(0, 255, 255, 0.15)", // Neon Cyan
  "rgba(50, 255, 50, 0.15)", // Neon Green
  "rgba(255, 255, 0, 0.15)", // Neon Yellow
  "rgba(255, 0, 255, 0.15)", // Neon Magenta
  "rgba(0, 191, 255, 0.15)", // Deep Sky Blue
  "rgba(124, 252, 0, 0.15)", // Lawn Green
  "rgba(255, 69, 0, 0.15)", // Red-Orange
  "rgba(138, 43, 226, 0.15)", // Blue Violet
  "rgba(64, 224, 208, 0.15)", // Turquoise
  "rgba(255, 105, 180, 0.15)", // Hot Pink
  "rgba(0, 250, 154, 0.15)", // Medium Spring Green
  "rgba(255, 215, 0, 0.15)", // Gold
  "rgba(30, 144, 255, 0.15)", // Dodger Blue
  "rgba(255, 140, 0, 0.15)", // Dark Orange
  "rgba(148, 0, 211, 0.15)", // Dark Violet
  "rgba(0, 255, 127, 0.15)", // Spring Green
  "rgba(255, 0, 127, 0.15)", // Rose
  "rgba(70, 130, 180, 0.15)", // Steel Blue
  "rgba(255, 99, 71, 0.15)", // Tomato
  "rgba(106, 90, 205, 0.15)", // Slate Blue
  "rgba(60, 179, 113, 0.15)", // Medium Sea Green
  "rgba(255, 165, 0, 0.15)", // Orange
  "rgba(147, 112, 219, 0.15)", // Medium Purple
  "rgba(32, 178, 170, 0.15)", // Light Sea Green
];

// Функция для получения цвета по ID родственной группы
export const getRelationshipColor = (familyId: number) => {
  return RELATIONSHIP_COLORS[familyId % RELATIONSHIP_COLORS.length];
};

// Функция для определения родственных групп
export const getFamilyGroups = (toads: Toad[]) => {
  const families = new Map<number, number>(); // toadId -> familyId
  let nextFamilyId = 0;

  const connectRelatives = (toad1Id: number, toad2Id: number) => {
    const family1 = families.get(toad1Id);
    const family2 = families.get(toad2Id);

    if (family1 === undefined && family2 === undefined) {
      const newFamilyId = nextFamilyId++;
      families.set(toad1Id, newFamilyId);
      families.set(toad2Id, newFamilyId);
    } else if (family1 === undefined) {
      families.set(toad1Id, family2!);
    } else if (family2 === undefined) {
      families.set(toad2Id, family1!);
    } else if (family1 !== family2) {
      // Объединяем семьи
      for (const [id, famId] of families.entries()) {
        if (famId === family2) {
          families.set(id, family1);
        }
      }
    }
  };

  // Строим связи родитель-ребенок
  toads.forEach((toad) => {
    if (toad.parents && toad.parents.length > 0) {
      toad.parents.forEach((parentId) => {
        const parent = toads.find((t) => t.id === parentId);
        if (parent) {
          connectRelatives(toad.id, parentId);
        }
      });
    }
  });

  return families;
};

// Функция для получения информации о родственниках конкретной жабы
export const getToadRelatives = (toad: Toad, allToads: Toad[]) => {
  if (!toad) {
    return { relatives: [], inbreedingRisk: false };
  }

  const relatives = new Map();

  // 1. Находим родителей текущей жабы
  if (toad.parents && toad.parents.length > 0) {
    toad.parents.forEach((parentId) => {
      const parent = allToads.find((t) => t.id === parentId);
      if (parent) {
        relatives.set(parent.id, {
          id: parent.id,
          name: parent.name,
          sex: parent.sex,
          // Дом (`homeId`) — подпись «где живёт»; вместе они могут быть и в секторе
          // колонии (пара в репродукторе) — это `isInSameEnclosure`
          sceneId: getToadHomeId(parent),
          isInSameEnclosure: isToadSamePlace(parent, toad),
          relation: "parent",
        });
      }
    });
  }

  // 2. Находим детей текущей жабы
  const children = allToads.filter(
    (t) => t.parents && t.parents.includes(toad.id)
  );

  children.forEach((child) => {
    if (!relatives.has(child.id)) {
      relatives.set(child.id, {
        id: child.id,
        name: child.name,
        sex: child.sex,
        sceneId: getToadHomeId(child),
        isInSameEnclosure: isToadSamePlace(child, toad),
        relation: "child",
      });
    }
  });

  // 3. Находим братьев и сестер (жабы с общими родителями)
  const siblings = allToads.filter((otherToad) => {
    // Пропускаем текущую жабу
    if (otherToad.id === toad.id) return false;

    // Если у обоих есть родители и есть общие родители
    if (toad.parents && otherToad.parents) {
      return toad.parents.some((parentId) =>
        otherToad.parents?.includes(parentId)
      );
    }
    return false;
  });

  siblings.forEach((sibling) => {
    if (!relatives.has(sibling.id)) {
      relatives.set(sibling.id, {
        id: sibling.id,
        name: sibling.name,
        sex: sibling.sex,
        sceneId: getToadHomeId(sibling),
        isInSameEnclosure: isToadSamePlace(sibling, toad),
        relation: "sibling",
      });
    }
  });

  const relativesArray = Array.from(relatives.values());

  // Проверяем риск имбридинга: есть ли родственники другого пола в том же биоподе
  // (кроме детей, так как дети обычно не представляют риска имбридинга)
  const inbreedingRisk = relativesArray.some(
    (rel) =>
      rel &&
      rel.isInSameEnclosure &&
      rel.sex !== toad.sex &&
      rel.sex !== "neuter" &&
      toad.sex !== "neuter" &&
      rel.relation !== "child" // Исключаем детей из проверки риска
  );

  return {
    relatives: relativesArray,
    inbreedingRisk,
    parentsCount: Array.from(relatives.values()).filter(
      (r) => r.relation === "parent"
    ).length,
    siblingsCount: Array.from(relatives.values()).filter(
      (r) => r.relation === "sibling"
    ).length,
    childrenCount: Array.from(relatives.values()).filter(
      (r) => r.relation === "child"
    ).length,
  };
};
