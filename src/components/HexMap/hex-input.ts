import { Point } from "./hex-geometry";

/**
 * Жесты карты: тап, двойной тап и попадание пальцем в жабу.
 *
 * Логика чистая — канвас только подключает её к событиям указателя, поэтому
 * правила («что считается двойным тапом») проверяются тестом без Pixi.
 */

/** Сдвиг пальца, после которого тап превращается в панораму (экранные пиксели). */
export const TAP_SLOP = 9;

/** Удержание жабы, после которого её можно нести (мс). */
export const LONG_PRESS_MS = 260;

/**
 * Двойной тап приближает обзорный вид к гексу — окно между тапами и разброс точек.
 * Пока окно открыто, одиночный тап ждёт: иначе первый тап успеет открыть комнату.
 */
export const DOUBLE_TAP_MS = 260;
export const DOUBLE_TAP_SLOP = 26;

/**
 * Допуск попадания пальцем в жабу поверх её собственного радиуса (экранные пиксели).
 * В обзорном виде жабы мелкие — без допуска в них не попасть.
 */
export const TOAD_TOUCH_SLOP = 18;

/** Тап, запомненный для распознавания двойного. */
export interface TapRecord {
  /** Время тапа (performance.now, мс). */
  time: number;
  /** Точка тапа в экранных координатах. */
  point: Point;
}

/** Второй тап достаточно быстрый и рядом с первым — значит это двойной тап. */
export const isDoubleTap = (
  previous: TapRecord | null,
  next: TapRecord,
  window: number = DOUBLE_TAP_MS,
  slop: number = DOUBLE_TAP_SLOP
) => {
  if (!previous) {
    return false;
  }

  const elapsed = next.time - previous.time;

  return (
    elapsed >= 0 &&
    elapsed <= window &&
    Math.hypot(
      next.point.x - previous.point.x,
      next.point.y - previous.point.y
    ) <= slop
  );
};

/**
 * Радиус попадания по жабе в мировых пикселях: её собственный радиус плюс допуск
 * пальца, пересчитанный из экранных пикселей в мировые тем же масштабом камеры.
 */
export const getToadPickRadius = (hitRadius: number, scale: number) =>
  hitRadius + TOAD_TOUCH_SLOP / Math.max(scale, 0.001);
