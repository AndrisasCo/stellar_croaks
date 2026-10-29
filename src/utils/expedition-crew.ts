import { ExpeditionRole, EXPEDITION_ROLE_ORDER } from "../models/expedition";
import { Toad } from "../models/Toad";
import { getRolePower } from "./expedition-config";

/**
 * Сборка команды похода из жаб сектора «Разведка».
 *
 * Сектор «Разведка» держит до 5 взрослых жаб (`EXPEDITION_TEAM_SIZE`) — это ровно состав
 * команды, поэтому команду собирают не по всей колонии, а из жильцов гекса: в модалке
 * походов список жаб сектора стоит первым, а тап по жабе ставит её на её сильную роль.
 *
 * Здесь только арифметика слотов (без React и без сохранения): роль → id жабы. Модалка
 * рисует то, что вернут эти функции, поэтому правила «одна жаба — одна роль» и «кому
 * какая роль выгоднее» проверяются smoke-тестом (`tmp-verify-expedition-crew.mjs`).
 */

/** Кто занял какую роль: id жабы или пустая строка, если роль свободна. */
export type ExpeditionSlots = Record<ExpeditionRole, number | "">;

/** Пустые слоты команды: все пять ролей свободны. */
export const emptyExpeditionSlots = (): ExpeditionSlots => ({
  scout: "",
  tank: "",
  medic: "",
  hacker: "",
  negotiator: "",
});

/** Какая роль занята этой жабой (undefined — жаба не в команде). */
export const getAssignedRole = (
  slots: ExpeditionSlots,
  toadId: number
): ExpeditionRole | undefined =>
  EXPEDITION_ROLE_ORDER.find((role) => slots[role] === toadId);

/**
 * Сильнейшая роль жабы: где её характеристика даёт больше силы (0..1).
 * `roles` сужает выбор (например, только свободные роли), по умолчанию — все пять.
 */
export const getBestRole = (
  toad: Toad,
  roles: ExpeditionRole[] = EXPEDITION_ROLE_ORDER
): ExpeditionRole =>
  (roles.length > 0 ? roles : EXPEDITION_ROLE_ORDER).reduce((best, role) =>
    getRolePower(toad, role) > getRolePower(toad, best) ? role : best
  );

/** Сила роли в процентах — так её показывает модалка похода. */
export const getRolePowerPercent = (
  toad: Toad,
  role: ExpeditionRole
): number => Math.round(getRolePower(toad, role) * 100);

/**
 * Жабы, отсортированные по силе роли: сверху те, кому роль подходит больше.
 *
 * Нужна выпадающим спискам роли в модалке похода: игрок сразу видит лучших кандидатов,
 * а не порядок колонии. Исходный массив не трогаем — сортируем копию; `Array.sort`
 * стабилен, поэтому жабы с равной силой остаются в порядке колонии.
 */
export const sortToadsByRolePower = (
  toads: Toad[],
  role: ExpeditionRole
): Toad[] =>
  [...toads].sort((a, b) => getRolePower(b, role) - getRolePower(a, role));

/**
 * Куда встанет жаба сектора по тапу: на сильнейшую из свободных ролей, а если все
 * разобрали — на сильнейшую вообще (место в слоте переходит ей, прежний жилец выходит
 * из команды — ровно как при выборе жабы в списке роли).
 */
export const getCrewTapRole = (
  slots: ExpeditionSlots,
  toad: Toad
): ExpeditionRole => {
  const free = EXPEDITION_ROLE_ORDER.filter(
    (role) => slots[role] === "" || slots[role] === toad.id
  );

  return getBestRole(toad, free.length > 0 ? free : EXPEDITION_ROLE_ORDER);
};

/**
 * Поставить жабу на роль. Одну жабу в две роли не берут: из прежней роли она уходит,
 * а прежний жилец выбранной роли освобождает слот (роль одна, а жабу выбирают одну).
 */
export const assignToadToRole = (
  slots: ExpeditionSlots,
  toadId: number,
  role: ExpeditionRole
): ExpeditionSlots => {
  const next: ExpeditionSlots = { ...slots };

  EXPEDITION_ROLE_ORDER.forEach((item) => {
    if (next[item] === toadId) {
      next[item] = "";
    }
  });

  next[role] = toadId;
  return next;
};

/** Убрать жабу из команды: её роль снова свободна. */
export const removeToadFromTeam = (
  slots: ExpeditionSlots,
  toadId: number
): ExpeditionSlots => {
  if (getAssignedRole(slots, toadId) === undefined) {
    return slots;
  }

  const next: ExpeditionSlots = { ...slots };

  EXPEDITION_ROLE_ORDER.forEach((role) => {
    if (next[role] === toadId) {
      next[role] = "";
    }
  });

  return next;
};

/**
 * Собрать команду из жаб сектора: свободные роли занимают самые сильные пары
 * «жаба — роль». Подбор жадный — сначала занимается самая сильная пара, потом
 * следующая свободная, — поэтому жаба всегда оказывается там, где она сильнее
 * оставшихся кандидатов, а занятые роли и уже выбранные жабы не трогаются.
 */
export const fillTeamFromCrew = (
  slots: ExpeditionSlots,
  crew: Toad[]
): ExpeditionSlots => {
  const next: ExpeditionSlots = { ...slots };
  const taken = new Set<number>(
    EXPEDITION_ROLE_ORDER.map((role) => next[role]).filter(
      (id): id is number => id !== ""
    )
  );

  const pairs = EXPEDITION_ROLE_ORDER.filter((role) => next[role] === "")
    .flatMap((role) =>
      crew
        .filter((toad) => !taken.has(toad.id))
        .map((toad) => ({ toad, role, power: getRolePower(toad, role) }))
    )
    .sort((a, b) => b.power - a.power);

  pairs.forEach((pair) => {
    if (next[pair.role] !== "" || taken.has(pair.toad.id)) {
      return;
    }

    next[pair.role] = pair.toad.id;
    taken.add(pair.toad.id);
  });

  return next;
};

/**
 * Слоты команды и жильцы «Разведки» — одно и то же: жаба стоит в контуре, пока занят
 * её слот. Функция приводит слоты к составу сектора, чтобы модалка могла держать это
 * правило без ручных «поставить / снять»:
 *
 *   1. роль жабы, которой в секторе больше нет, освобождается (жабу вернули в биопод,
 *      она ушла в другой сектор или её забрал поход);
 *   2. жабы сектора без роли занимают свободные роли тем же жадным подбором, что и
 *      `fillTeamFromCrew`: сильнейшие пары «жаба — роль» первыми. Так вернувшаяся из
 *      похода команда сама встаёт на свои места, как только добыча разобрана.
 *
 * Слоты не мутируются: если приводить нечего, возвращается тот же объект — React-состояние
 * не меняется, и лишней перерисовки (а с ней и нового круга синхронизации) не будет.
 */
export const syncSlotsWithCrew = (
  slots: ExpeditionSlots,
  crew: Toad[]
): ExpeditionSlots => {
  const crewIds = new Set(crew.map((toad) => toad.id));
  const inside: ExpeditionSlots = { ...slots };
  let changed = false;

  EXPEDITION_ROLE_ORDER.forEach((role) => {
    const toadId = inside[role];

    if (toadId !== "" && !crewIds.has(toadId)) {
      inside[role] = "";
      changed = true;
    }
  });

  const next = fillTeamFromCrew(inside, crew);

  if (
    !changed &&
    EXPEDITION_ROLE_ORDER.every((role) => next[role] === slots[role])
  ) {
    return slots;
  }

  return next;
};

/** Сколько ролей ещё свободно: 0 — команда собрана (`EXPEDITION_TEAM_SIZE` ролей). */
export const countFreeRoles = (slots: ExpeditionSlots): number =>
  EXPEDITION_ROLE_ORDER.filter((role) => slots[role] === "").length;
