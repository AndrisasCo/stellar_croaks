import { Toad } from "../models/Toad";

/** «Поля места» жабы: дом, текущий биопод и сектор колонии */
type ToadPlacement = Partial<Pick<Toad, "homeId" | "scene_id">>;

export const getToadHomeId = (toad: ToadPlacement): number | null =>
  toad.homeId ?? null;

/** Жаба стоит в секторе колонии (id гекса — строка), а не в биоподе. */
export const isToadInRoom = (
  toad: ToadPlacement,
): toad is ToadPlacement & { scene_id: string } =>
  typeof toad.scene_id === "string";

/** Жаба живёт в биоподе (числовой `scene_id`), а не в секторе колонии. */
export const isToadInEnclosure = (
  toad: ToadPlacement,
): toad is ToadPlacement & { scene_id: number } =>
  typeof toad.scene_id === "number";

/** id сектора, в котором жаба сидит прямо сейчас (`null` — она не в секторе). */
export const getToadRoomId = (toad: ToadPlacement): string | null =>
  isToadInRoom(toad) ? toad.scene_id : null;

/** id биопода, в котором жаба живёт прямо сейчас (`null` — она не в биоподе). */
export const getToadEnclosureId = (toad: ToadPlacement): number | null =>
  isToadInEnclosure(toad) ? toad.scene_id : null;

/** Дом этой жабы — указанный биопод (где бы она ни работала сейчас) */
export const isToadFromEnclosure = (
  toad: ToadPlacement,
  sceneId: number | null | undefined,
): boolean => sceneId === toad.homeId;

/**
 * Жаба в походе, хотя этот биопод — её дом.
 *
 * На время похода место в биоподе освобождается (`scene_id` пуст или указывает на
 * «Разведку»), поэтому в список жильцов она не попадает. Дом (`homeId`) при этом
 * остаётся, и меню биопода показывает таких жаб отдельной плашкой «В походе».
 * Старые сейвы могли оставить в `scene_id` сам биопод — его тоже считаем совпадением.
 *
 * `onExpedition` — жаба уже вернулась, но команда ждёт разбора добычи: место в биоподе
 * ещё считается занятым ею, поэтому из жильцов её тоже исключают.
 */
export const isToadAwayFromEnclosure = (
  toad: ToadPlacement & { status?: Toad["status"] },
  sceneId: number | null | undefined,
  onExpedition = false,
): boolean =>
  sceneId != null &&
  (toad.status === "out" || onExpedition) &&
  (getToadHomeId(toad) === sceneId || toad.scene_id === sceneId);

/**
 * Жабы в одном месте прямо сейчас: обе в биоподах одного дома или обе в одном секторе
 * колонии. Нужно там, где важно «встречаются ли они»: родня на карточке жабы и риск
 * инбридинга — пара в репродукторе живёт вместе, даже если это разные биоподы.
 */
export const isToadSamePlace = (
  a: ToadPlacement,
  b: ToadPlacement,
): boolean => {
  return a.scene_id === b.scene_id;
};
