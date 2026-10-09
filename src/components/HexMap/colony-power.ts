import { Toad } from "../../models/Toad";
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
 *  - новая комната строится рядом с уже построенной, но сразу обесточена;
 *  - ток комнате даёт только соседний источник: ядро или энергокомната ⚡;
 *  - ядро — безусловный источник, жаб в нём держать не нужно;
 *  - энергокомната даёт по одной единице тока на каждую работающую жабу,
 *    поэтому 6 жаб закрывают все 6 соседних гексов;
 *  - обесточенная энергокомната сама никого не питает: сеть расходится от ядра
 *    наружу, поэтому для дальних колец нужны энергокомнаты в ближних.
 *
 * Формулы держим отдельно от рендера, чтобы проверять их без Pixi.
 */

/** Сколько соседних комнат обеспечивает ядро (у гекса ровно 6 соседей). */
export const CORE_POWER_CAPACITY = 6;

/** Сколько жаб-энергетиков влезает в энергокомнату (по одной на соседа). */
export const POWER_ROOM_TOAD_SLOTS = 6;

/** При голоде ниже порога жаба не вырабатывает ток (тот же порог, что у фермы). */
export const POWER_MIN_HUNGER = 1;

/** Типы комнат, которые питают соседей. */
export const isPowerSource = (kind: string): boolean =>
  kind === "core" || kind === "power";

/** Узел энергосети: построенная комната с её координатой и мощностью. */
export interface PowerNode {
  id: string;
  coord: AxialCoord;
  kind: string;
  /** Сколько соседних комнат питает комната (0 — не источник). */
  capacity: number;
}

export interface PowerGrid {
  /** id комнаты → есть ли ток. */
  powered: Record<string, boolean>;
  /** Израсходованная мощность источников: id → сколько соседей запитано. */
  usage: Record<string, number>;
  /** Построенные комнаты, оставшиеся без тока. */
  unpowered: string[];
  /** Суммарная мощность источников и её использованная часть. */
  capacityTotal: number;
  capacityUsed: number;
}

/** Чем жаба не годится для работы в энергокомнате (null — годится). */
export const getToadPowerIssue = (toad: Toad): string | null => {
  if (toad.stage !== "adult") {
    return "Нужна взрослая жаба";
  }

  if ((toad.hp ?? 1) <= 0) {
    return "Жаба выбита из строя";
  }

  return null;
};

/** Даёт ли жаба ток прямо сейчас: взрослая, живая, не в походе и не голодная. */
export const isToadPowering = (toad: Toad): boolean =>
  !getToadPowerIssue(toad) && toad.state.hunger > POWER_MIN_HUNGER;

/** Мощность энергокомнаты: одна единица тока на каждую работающую жабу. */
export const getToadPowerCapacity = (toads: Toad[]): number =>
  Math.min(
    POWER_ROOM_TOAD_SLOTS,
    toads.filter((toad) => isToadPowering(toad)).length,
  );

/** Мощность комнаты как источника: ядро работает всегда, ⚡ — от жаб. */
export const getSourceCapacity = (kind: string, toads: Toad[]): number => {
  if (kind === "core") {
    return CORE_POWER_CAPACITY;
  }

  if (kind === "power") {
    return getToadPowerCapacity(toads);
  }

  return 0;
};

/** Обход комнат от ядра наружу: ближние кольца питают дальние. */
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
 * Распределяет ток по колонии: идёт от ядра наружу, каждую комнату питает
 * ближайший источник со свободной мощностью. Функция чистая и детерминированная —
 * при одном и том же наборе комнат и жаб сеть всегда собирается одинаково.
 */
export const computePowerGrid = (nodes: PowerNode[]): PowerGrid => {
  const order = [...nodes].sort(comparePowerNodes);
  const byCoord = new Map<string, PowerNode>();

  order.forEach((node) => byCoord.set(hexCoordKey(node.coord), node));

  const powered: Record<string, boolean> = {};
  const usage: Record<string, number> = {};

  // Ядро — безусловный источник: с него начинается сеть.

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

        return neighbour.capacity >= usage[neighbour.id];
      })
      .sort(
        (a, b) =>
          b.capacity - a.capacity || order.indexOf(a) - order.indexOf(b),
      );

  // Проходы повторяем, пока находятся комнаты, которым хватает тока:
  // так энергокомната, получившая питание, успевает запитать своё кольцо.
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
