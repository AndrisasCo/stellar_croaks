import { Toad } from "../models/Toad";

/**
 * МЕСТО ЖАБЫ: у жабы всегда ровно одно место — биопод или сектор колонии.
 *
 *  - `scene_id` — биопод, в котором жаба **сейчас**: он непустой, пока жаба живёт дома.
 *  - `roomId` — сектор колонии (репродуктор, ⚡-энергосектор, «Разведка», лазарет), куда
 *    жабу посадили руками. Жаба в секторе в биоподе **уже не числится**: `scene_id` пуст,
 *    и место в биоподе свободно (`utils/housing.ts` → `getEnclosureToads`).
 *  - `homeId` — дом жабы, **последний** биопод. Он помнит его, даже пока работает в секторе,
 *    чтобы одним действием вернуться домой (`backend/colony.ts` → `sendToadHome`), а
 *    интерфейс мог показать биопод, из которого жаба вышла.
 *
 * Модуль чистый: принимает жабу (или её поля), ничего не читает из сохранения, поэтому
 * правила проверяются без запуска игры.
 */

/** «Поля места» жабы: дом, текущий биопод и сектор колонии */
type ToadPlacement = Partial<
  Pick<Toad, "homeId" | "scene_id" | "roomId">
>;

/**
 * Дом жабы — последний биопод (`homeId`).
 *
 * Легаси-сейвы `homeId` не знали: у них домом был `scene_id` (тогда жаба из биопода не
 * выходила), поэтому старый сейв читается по нему — миграция проставляет `homeId` при загрузке
 * (`backend/localStorage.ts` → `migrateGameState`).
 */
export const getToadHomeId = (toad: ToadPlacement): number | null =>
  toad.homeId ?? toad.scene_id ?? null;

/** Жаба сейчас живёт в секторе колонии (репродуктор, ⚡, «Разведка», лазарет) */
export const isToadStationed = (toad: ToadPlacement): boolean =>
  Boolean(toad.roomId);

/** Жаба сейчас в своём биоподе: биопод известен, сектора нет */
export const isToadInEnclosure = (toad: ToadPlacement): boolean =>
  !toad.roomId && toad.scene_id != null;

/** Дом этой жабы — указанный биопод (где бы она ни работала сейчас) */
export const isToadFromEnclosure = (
  toad: ToadPlacement,
  sceneId: number | null | undefined
): boolean => sceneId != null && getToadHomeId(toad) === sceneId;

/**
 * Жабы в одном месте прямо сейчас: обе в биоподах одного дома или обе в одном секторе
 * колонии. Нужно там, где важно «встречаются ли они»: родня на карточке жабы и риск
 * инбридинга — пара в репродукторе живёт вместе, даже если это разные биоподы.
 */
export const isToadSamePlace = (a: ToadPlacement, b: ToadPlacement): boolean => {
  if (a.roomId || b.roomId) {
    return Boolean(a.roomId) && a.roomId === b.roomId;
  }

  return a.scene_id != null && a.scene_id === b.scene_id;
};
