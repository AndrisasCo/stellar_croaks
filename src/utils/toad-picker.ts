import { getRarityConfig, Toad } from "../models/Toad";
import { getToadEnergy } from "./gamification-config";
import { TYPE_ICONS } from "./constants";

/**
 * Общий список жаб: одна «краткая информация» и одно правило отбора строк на все места,
 * где жабу сажают в слот — репродуктор, энергосектор ⚡, роль в походе.
 *
 * Список рисует `components/shared/ToadPicker.tsx` (выпадающий список), а этот модуль
 * держит то, что можно проверить без React: подписи пола/стадии, строку редкости, краткую
 * сводку жабы и разделение жаб на «можно взять» и «не подходят» с причинами отказа.
 * Местам остаются только их собственные правила (`getNestSlotRejectReason`,
 * `getToadPowerIssue`, `canSendToad`) — вид строки у всех один.
 */

/** Подписи пола: одни на весь интерфейс, чтобы список не придумывал свои */
export const TOAD_SEX_LABELS: Record<string, string> = {
  male: "самец",
  female: "самка",
  neuter: "нейтрал",
};

/** Значок пола (♂/♀/○) — тем же набором значков подписаны жабы на карте */
export const getToadSexIcon = (sex: string): string =>
  TYPE_ICONS[sex as keyof typeof TYPE_ICONS] ?? "○";

/** Пол жабы словом */
export const getToadSexLabel = (sex: string): string =>
  TOAD_SEX_LABELS[sex] ?? "жаба";

/** Стадия жабы словом: в слоты берут взрослых, головастики ждут в биоподе */
export const getToadStageLabel = (stage: string, sex: string): string => {
  if (stage !== "adult") {
    return "головастик";
  }

  // Согласуем со словом пола: «самка · взрослая», «самец · взрослый»
  return sex === "female" ? "взрослая" : "взрослый";
};

/** качество одной строкой — «Легендарная · 9.5»: подпись группы и само число */
export const getToadRarityLine = (toad: Toad): string => {
  const rarity = getRarityConfig(toad.genes.rarity);

  return `${rarity.label} · ${toad.genes.rarity.toFixed(1)}`;
};

/**
 * Краткая сводка жабы строкой списка: пол, стадия, силы и сытость.
 * Одна и та же у всех мест — по ней игрок сравнивает жаб, не открывая карточку.
 */
export const getToadPickerBrief = (toad: Toad): string =>
  [
    getToadSexLabel(toad.sex),
    getToadStageLabel(toad.stage, toad.sex),
    `⚡${Math.round(getToadEnergy(toad))}`,
    `🍽${Math.round(toad.state?.hunger ?? 0)}%`,
  ].join(" · ");

/** Заголовок группы жаб, которых можно взять в слот */
export const TOAD_PICKER_AVAILABLE_GROUP = "Можно взять";

/** Заголовок группы жаб, которых в слот не пускают (с причиной у каждой) */
export const TOAD_PICKER_REJECTED_GROUP = "Не подходят";

/** Строка списка жаб: жаба, её место в списке и причина отказа */
export interface ToadPickerCandidate {
  toad: Toad;
  /** Место в списке: больше — выше (качество, сила роли, сытость) */
  rank: number;
  /** Почему жабу взять нельзя; пусто — можно */
  reason?: string | null;
}

/** Список жаб, разложенный по группам выпадающего списка */
export interface ToadPickerCandidateGroups {
  /** Жабы, которых можно взять: сверху самые подходящие */
  available: ToadPickerCandidate[];
  /** Жабы, которых взять нельзя, — с причиной отказа у каждой */
  rejected: ToadPickerCandidate[];
}

/**
 * Раскладывает жаб по двум группам списка: «можно взять» и «не подходят» с причинами.
 *
 * Обе группы идут по убыванию места в списке (качество, сила роли, сытость), а при равных
 * местах сохраняется порядок колонии — `Array.sort` стабилен, поэтому список не «дрожит»
 * от перерисовки к перерисовке.
 */
export const splitToadPickerCandidates = (
  candidates: ToadPickerCandidate[],
): ToadPickerCandidateGroups => {
  const byRankDesc = (a: ToadPickerCandidate, b: ToadPickerCandidate) =>
    b.rank - a.rank;

  return {
    available: candidates.filter((item) => !item.reason).sort(byRankDesc),
    rejected: candidates
      .filter((item) => Boolean(item.reason))
      .sort(byRankDesc),
  };
};
