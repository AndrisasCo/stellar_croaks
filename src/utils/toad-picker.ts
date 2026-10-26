import { getRarityConfig, Toad } from "../models/Toad";
import type { Scene } from "../models/scene";
import type { RoomConfig } from "../components/HexMap/rooms-config";
import { getToadEnergy } from "./gamification-config";
import { TYPE_ICONS } from "./constants";
import { getToadHomeId, isToadInRoom } from "./toad-location";

/**
 * Общий список жаб: одна «краткая информация» и одно правило отбора строк на все места,
 * где жабу сажают в слот — репродуктор, энергосектор ⚡, Медотсек и роль в походе.
 *
 * Список рисует `components/shared/ToadPicker.tsx` (выпадающий список), а этот модуль
 * держит то, что можно проверить без React: подписи пола/стадии, строку редкости, краткую
 * сводку жабы (только силы ⚡) и разделение жаб на «можно взять» и «не подходят» с причинами отказа.
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

/** Качество одной строкой — «Легендарная · 9.5»: подпись группы и само число */
export const getToadRarityLine = (toad: Toad): string => {
  const rarity = getRarityConfig(toad.genes.rarity);

  return `${rarity.label} · ${toad.genes.rarity.toFixed(1)}`;
};

/**
 * Краткая сводка жабы строкой списка: только силы ⚡.
 *
 * Пол и стадию в списке не дублируем: пол уже виден значком рядом с именем, а в слоты
 * и так берут только взрослых — строка нужна для выбора, а не для паспорта. Сытость
 * сюда тоже не входит: в списке жаб сажают в слот, и голод — не то, по чему выбирают
 * пару или работника. Сытость остаётся в карточке жабы, а причины отказа (голодная
 * жаба не даёт ток и т.п.) места по-прежнему объясняют сами.
 */
export const getToadPickerBrief = (toad: Toad): string =>
  `⚡${Math.round(getToadEnergy(toad))}`;

/** Откуда жаба: иконка и название места — сектора колонии или её биопода. */
export interface ToadPickerLocation {
  icon: string;
  label: string;
}

/**
 * Где жаба живёт сейчас — строкой списка.
 *
 * Место — общее для всех списков, поэтому его считает не каждая модалка, а этот
 * хелпер: сектор ищем по id и по id гекса (`scene_id` у жабы в секторе — id гекса),
 * а жильца биопода подписываем именем его дома (`homeId`), а если адрес дома
 * потерян — текущего числового `scene_id`. Снесённый сектор и старый сейв без
 * биопода не остаются без подписи: у них есть общее название.
 */
export const getToadPickerLocation = (
  toad: Toad,
  rooms: RoomConfig[],
  scenes: Scene[],
): ToadPickerLocation => {
  if (isToadInRoom(toad)) {
    const room = rooms.find(
      (item) => item.id === toad.scene_id || item.slotId === toad.scene_id,
    );

    return {
      icon: room?.icon ?? "📍",
      label: room?.name || "Сектор колонии",
    };
  }

  const sceneId =
    getToadHomeId(toad) ??
    (typeof toad.scene_id === "number" ? toad.scene_id : null);
  const scene = scenes.find((item) => item.id === sceneId);

  return {
    icon: "🏠",
    label: scene?.name || "Биопод",
  };
};

/** Заголовок группы жаб, которых можно взять в слот */
export const TOAD_PICKER_AVAILABLE_GROUP = "Можно взять";

/** Заголовок группы жаб, которых в слот не пускают (с причиной у каждой) */
export const TOAD_PICKER_REJECTED_GROUP = "Не подходят";

/** Строка списка жаб: жаба, её место в списке и причина отказа */
export interface ToadPickerCandidate {
  toad: Toad;
  /** Место в списке: больше — выше (Качество, сила роли, сытость) */
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
 * Обе группы идут по убыванию места в списке (Качество, сила роли, сытость), а при равных
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
