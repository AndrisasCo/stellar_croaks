import { ColonyState, EMPTY_COLONY } from "../models/colony";
import { getToadDisease, isToadSick } from "../models/disease";
import { Toad } from "../models/Toad";
import {
  getToadHp,
  getToadMaxHp,
  HP_REGEN_PER_HOUR,
} from "./expedition-config";

/**
 * ЛАЗАРЕТ: койки, скорость выздоровления и выборки жаб для интерфейса.
 *
 * Правила (сектор «Лазарет» на карте колонии, до `HOSPITAL_ROOM_TOAD_SLOTS` жаб):
 *  - на койке HP идёт на порядок быстрее домашнего регена, а срок кибер-болезни
 *    «сгорает» в `HOSPITAL_DISEASE_SPEED` раз быстрее: ×3 к реальному времени;
 *  - без лазарета всё очень медленно: дома капает `HP_REGEN_PER_HOUR` = 1 HP в час,
 *    а болезнь идёт ровно своим таймером (см. `models/disease.ts`);
 *  - пациент изолирован: он сидит в секторе, а не в биоподе, поэтому не заражает
 *    соседей и сам ничего не подхватывает (`processDiseases`);
 *  - попасть в лазарет можно только в сектор с током — это общее правило переноса
 *    (`HexMap/toad-move-rules.ts`). Само выздоровление уже лежащих жаб от тока не
 *    зависит: если свет в секторе позже пропадёт, лечение продолжится.
 *
 * Модуль чистый: состояние колонии и жабы приходят аргументами, никакого сохранения
 * и React — поэтому правила проверяются без запуска игры.
 */

/** Коек в одном лазарете колонии */
export const HOSPITAL_ROOM_TOAD_SLOTS = 6;
/** Восстановление HP в час на койке: ×24 к домашнему регену */
export const HOSPITAL_HP_REGEN_PER_HOUR = 24;
/** Во сколько раз быстрее идёт срок болезни под присмотром лазарета */
export const HOSPITAL_DISEASE_SPEED = 3;

/**
 * id построенных лазаретов колонии (по карте: их может быть несколько).
 *
 * Жаба помнит место по id гекса (`RoomConfig.id`), а постройка в сейве — по своему id
 * (`вид_число`), поэтому отдаём id гекса: по нему `Toad.scene_id` и находит койку.
 */
export const getHospitalRoomIds = (colony?: ColonyState | null): string[] =>
  (colony ?? EMPTY_COLONY).rooms
    .filter((room) => room.kind === "hospital")
    .map((room) => room.slotId ?? room.id);

/** Лежит ли жаба в лазарете прямо сейчас */
export const isToadInHospital = (
  toad: Toad,
  hospitalIds: readonly string[],
): boolean =>
  typeof toad.scene_id === "string" && hospitalIds.includes(toad.scene_id);

/** Раненая жаба: HP ниже максимума (выбитая тоже сюда попадает) */
export const isToadWounded = (toad: Toad): boolean =>
  getToadHp(toad) < getToadMaxHp(toad);

/** Нужен ли жабе лазарет: рана или активная кибер-болезнь */
export const needsHospitalCare = (toad: Toad, now = Date.now()): boolean =>
  isToadWounded(toad) || isToadSick(toad, now);

/** Жабы, которым нужна помощь: раненые и больные (для второго списка лазарета) */
export const getToadsNeedingCare = (toads: Toad[], now = Date.now()): Toad[] =>
  toads.filter((toad) => needsHospitalCare(toad, now));

/** Жабы, лежащие на койках лазарета (первый список) */
export const getHospitalPatients = (
  toads: Toad[],
  hospitalIds: readonly string[],
): Toad[] => toads.filter((toad) => isToadInHospital(toad, hospitalIds));

/** Сколько коек занято в лазарете */
export const getHospitalOccupancy = (
  roomId: string,
  toadsByRoom: Record<string, Toad[]>,
): number => (toadsByRoom[roomId] ?? []).length;

/** Лазареты, где есть свободная койка (по порядку карты) */
export const getHospitalsWithSpace = (
  hospitalIds: readonly string[],
  toadsByRoom: Record<string, Toad[]>,
): string[] =>
  hospitalIds.filter(
    (roomId) =>
      getHospitalOccupancy(roomId, toadsByRoom) < HOSPITAL_ROOM_TOAD_SLOTS,
  );

/** Восстановление HP в час: койка лазарета или обычная жизнь дома */
export const getHpRegenRate = (inHospital: boolean): number =>
  inHospital ? HOSPITAL_HP_REGEN_PER_HOUR : HP_REGEN_PER_HOUR;

/** Восстановление HP в час для конкретной жабы: койка лазарета или дом */
export const getHpRegenPerHour = (
  toad: Toad,
  hospitalIds: readonly string[],
): number => getHpRegenRate(isToadInHospital(toad, hospitalIds));

/**
 * Сколько часов займёт восстановление `missingHp` HP — на койке (`inHospital`) или дома.
 * Интерфейсу нужны оба прогноза сразу: «дома ~N ч · в лазарете ~M ч».
 */
export const getHoursToFullHp = (
  missingHp: number,
  inHospital: boolean,
): number => {
  const missing = Math.max(0, missingHp);

  if (missing <= 0) {
    return 0;
  }

  return Math.round((missing / getHpRegenRate(inHospital)) * 10) / 10;
};

/**
 * Сколько ДОПОЛНИТЕЛЬНЫХ часов болезни «съедает» койка лазарета за прошедшее время:
 * дома таймер болезни идёт сам по себе (0), на койке срок сгорает быстрее
 * во столько же раз, во сколько врач ускоряет выздоровление.
 */
export const getHospitalDiseaseHours = (
  hoursPassed: number,
  inHospital: boolean,
): number =>
  inHospital ? Math.max(0, hoursPassed) * (HOSPITAL_DISEASE_SPEED - 1) : 0;

/** Название болезни жабы для интерфейса (null — жаба здорова) */
export const getToadDiseaseLabel = (toad: Toad): string | null => {
  const disease = getToadDisease(toad);
  return disease ? `${disease.icon} ${disease.name}` : null;
};
