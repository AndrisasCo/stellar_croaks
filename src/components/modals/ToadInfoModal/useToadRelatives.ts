// hooks/useToadRelatives.ts
import { useMemo } from "react";
import { getToadHomeId, isToadSamePlace } from "../../../utils/toad-location";

export const useToadRelatives = (toad: any, allToads: any[]) => {
  return useMemo(() => {
    if (!toad) return { relatives: [], inbreedingRisk: false };

    const relatives = new Map();

    // Helper to add relative
    const addRel = (t: any, relation: string) => {
      if (!t || relatives.has(t.id)) return;
      relatives.set(t.id, {
        id: t.id,
        name: t.name,
        sex: t.sex,
        // Дом родственника (`homeId`) — он же подпись «где живёт»; вместе они могут быть
        // и в секторе колонии (пара в репродукторе) — это `isInSameEnclosure`
        sceneId: getToadHomeId(t),
        isInSameEnclosure: isToadSamePlace(t, toad),
        relation,
      });
    };

    // 1. Parents
    toad.parents?.forEach((parentId: number) => {
      addRel(
        allToads.find((t) => t.id === parentId),
        "parent"
      );
    });

    // 2. Children & Siblings
    allToads.forEach((other) => {
      if (other.id === toad.id) return;

      // Is Child?
      if (other.parents?.includes(toad.id)) {
        addRel(other, "child");
      }
      // Is Sibling?
      else if (toad.parents?.length && other.parents?.length) {
        const isSibling = toad.parents.some((p: number) =>
          other.parents.includes(p)
        );
        if (isSibling) addRel(other, "sibling");
      }
    });

    const relativesArray = Array.from(relatives.values());
    const inbreedingRisk = relativesArray.some(
      (rel) =>
        rel.isInSameEnclosure &&
        rel.sex !== toad.sex &&
        rel.sex !== "neuter" &&
        toad.sex !== "neuter" &&
        rel.relation !== "child"
    );

    return {
      relatives: relativesArray.filter((rel) => rel.isInSameEnclosure),
      inbreedingRisk,
    };
  }, [toad, allToads]);
};
