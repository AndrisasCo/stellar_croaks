import { Expedition } from "../../models/expedition";
import { Toad } from "../../models/Toad";
import { isToadBusyOnExpedition } from "../../utils/expedition-manager";
import {
  AxialCoord,
  hexCoordKey,
  hexDistance,
  hexNeighbors,
} from "./hex-geometry";

/**
 * Чистая математика энергосистемы колонии (без Pixi и React).
 *
 * Правила энергосети:
 *  - любая новый сектор сразу обесточена: ток даёт только соседний источник —
 *    ядро или энергосектор ⚡;
 *  - ядро — безусловный источник, жаб в нём держать не нужно;
 *  - энергосектор даёт по одной единице тока на каждую работающую жабу,
 *    поэтому 6 жаб закрывают все 6 соседних гексов;
 *  - энергосектор с работающими жабами — источник сама по себе: внешнее питание
 *    ей не нужно, она питает и себя, и соседей. Пустая ⚡ (или с одними голодными
 *    жабами) не питает никого;
 *  - на любое питание нужна свободная мощность: жаба даёт соседу ровно одну
 *    единицу тока, и больше соседей, чем жаба вырабатывает, сектор не запитает.
 *
 * Формулы держим отдельно от рендера, чтобы проверять их без Pixi.
 */

/** Сколько соседних секторов обеспечивает ядро (у гекса ровно 6 соседей). */
export const CORE_POWER_CAPACITY = 6;

/** Сколько жаб-энергетиков влезает в энергосектор (по одной на соседа). */
export const POWER_ROOM_TOAD_SLOTS = 6;

/**
 * Порог сытости для выработки тока: жаба даёт ток, пока сытость выше порога.
 * Порог мягкий — в отличие от фермы (`PRODUCTION_MIN_HUNGER`), где на сытости ≤ порога
 * жаба уже работает на голодном минимуме (`PRODUCTION_HUNGRY_FACTOR`), энергосектор
 * гаснет только у совсем голодных жаб.
 */
export const POWER_MIN_HUNGER = 1;

/** Типы секторов, которые питают соседей. */
export const isPowerSource = (kind: string): boolean =>
  kind === "core" || kind === "power";

/** Узел энергосети: построенный сектор с её координатой и мощностью. */
export interface PowerNode {
  id: string;
  coord: AxialCoord;
  kind: string;
  /** Сколько соседних секторов питает сектор (0 — не источник). */
  capacity: number;
}

export interface PowerGrid {
  /** id сектора → есть ли ток. */
  powered: Record<string, boolean>;
  /** Израсходованная мощность источников: id → сколько соседей запитано. */
  usage: Record<string, number>;
  /** Построенные секторы, оставшиеся без тока. */
  unpowered: string[];
  /** Суммарная мощность источников и её использованная часть. */
  capacityTotal: number;
  capacityUsed: number;
}

/**
 * Чем жаба не годится для работы в энергосекторе (null — годится).
 * `expeditions` передают готовым списком в горячих циклах, чтобы не перечитывать сейв
 * на каждую жабу.
 */
export const getToadPowerIssue = (
  toad: Toad,
  expeditions?: Expedition[],
): string | null => {
  if (toad.stage !== "adult") {
    return "Нужна взрослая жаба";
  }

  // Жаба в пути или уже вернулась, но ещё держит добычу до разбора
  if (isToadBusyOnExpedition(toad, expeditions)) {
    return "Жаба в походе";
  }

  if ((toad.hp ?? 1) <= 0) {
    return "Жаба выбита из строя";
  }

  return null;
};

/** Даёт ли жаба ток прямо сейчас: взрослая, живая, не в походе и сытая выше порога. */
export const isToadPowering = (
  toad: Toad,
  expeditions?: Expedition[],
): boolean =>
  !getToadPowerIssue(toad, expeditions) &&
  toad.state.hunger > POWER_MIN_HUNGER;

/** Мощность энергосектора: одна единица тока на каждую работающую жабу. */
export const getToadPowerCapacity = (
  toads: Toad[],
  expeditions?: Expedition[],
): number =>
  Math.min(
    POWER_ROOM_TOAD_SLOTS,
    toads.filter((toad) => isToadPowering(toad, expeditions)).length,
  );

/** Мощность сектора как источника: ядро работает всегда, ⚡ — от жаб. */
export const getSourceCapacity = (
  kind: string,
  toads: Toad[],
  expeditions?: Expedition[],
): number => {
  if (kind === "core") {
    return CORE_POWER_CAPACITY;
  }

  if (kind === "power") {
    return getToadPowerCapacity(toads, expeditions);
  }

  return 0;
};

/** Обход секторов от ядра наружу: ближние кольца питают дальние. */
const comparePowerNodes = (a: PowerNode, b: PowerNode): number => {
  const ringDiff =
    hexDistance(a.coord, { q: 0, r: 0 }) - hexDistance(b.coord, { q: 0, r: 0 });

  if (ringDiff !== 0) {
    return ringDiff;
  }

  if (a.coord.q !== b.coord.q) {
    return a.coord.q - b.coord.q;
  }

  if (a.coord.r !== b.coord.r) {
    return a.coord.r - b.coord.r;
  }

  return a.id.localeCompare(b.id);
};

/**
 * Распределяет ток по колонии: идёт от ядра наружу, каждый сектор питает
 * ближайший источник со свободной мощностью. Функция чистая и детерминированная —
 * при одном и том же наборе секторов и жаб сеть всегда собирается одинаково.
 */
export const computePowerGrid = (nodes: PowerNode[]): PowerGrid => {
  const order = [...nodes].sort(comparePowerNodes);
  const byCoord = new Map<string, PowerNode>();

  order.forEach((node) => byCoord.set(hexCoordKey(node.coord), node));

  const powered: Record<string, boolean> = {};
  const usage: Record<string, number> = {};

  // Источники с мощностью сразу под током: ядро всегда, ⚡ — пока в ней работают жабы
  order.forEach((node) => {
    powered[node.id] = isPowerSource(node.kind) && node.capacity > 0;
    usage[node.id] = 0;
  });

  /** Соседние источники, у которых осталась свободная мощность. */
  const getFeeders = (node: PowerNode) =>
    hexNeighbors(node.coord)
      .map((coord) => byCoord.get(hexCoordKey(coord)))
      .filter((neighbour): neighbour is PowerNode => {
        if (!neighbour || !isPowerSource(neighbour.kind)) {
          return false;
        }

        // Свободная мощность: сосед уже занял `usage`, значит может взять ещё одного
        return neighbour.capacity > usage[neighbour.id];
      })
      .sort(
        (a, b) =>
          b.capacity - a.capacity || order.indexOf(a) - order.indexOf(b),
      );

  // Проходы повторяем, пока находятся секторы, которым хватает тока:
  // так энергосектор, получившая питание, успевает запитать своё кольцо.
  let changed = true;

  while (changed) {
    changed = false;

    order.forEach((node) => {
      if (powered[node.id]) {
        return;
      }

      const feeder = getFeeders(node)[0];

      if (!feeder) {
        return;
      }

      powered[node.id] = true;
      usage[feeder.id] += 1;
      changed = true;
    });
  }

  return {
    powered,
    usage,
    unpowered: order.filter((node) => !powered[node.id]).map((node) => node.id),
    capacityTotal: order.reduce(
      (sum, node) => sum + (isPowerSource(node.kind) ? node.capacity : 0),
      0,
    ),
    capacityUsed: order.reduce((sum, node) => sum + usage[node.id], 0),
  };
};
