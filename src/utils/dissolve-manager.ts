import { deleteToadsByIds, updateUser } from "../backend";
import { recordQuestEvent } from "../backend/quests-manager";
import {
  ExtendedColliderState,
  loadColliderState,
} from "../backend/collider-manager";
import { getGameState } from "../backend/localStorage";
import { getDiseasePenaltyMultiplier } from "../models/disease";
import { getPersonalityMultipliers, Toad } from "../models/Toad";
import {
  DISSOLVE_BASE_BIOMASS,
  DISSOLVE_NEUTER_FACTOR,
  DISSOLVE_RARITY_RATE,
  DISSOLVE_TADPOLE_FACTOR,
} from "./gamification-config";

/**
 * Менеджер Диссоциатора — прямой переработки жабы в биомассу.
 * Механика необратимая: жаба исчезает, лаборатория получает биомассу.
 */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Сколько биомассы даёт одна жаба при разборе */
export const getDissolveYield = (toad: Toad): number => {
  const { weightMultiplier } = getPersonalityMultipliers(
    toad.genes?.personality,
  );

  const stageFactor = toad.stage === "adult" ? 1 : DISSOLVE_TADPOLE_FACTOR;
  const sexFactor = toad.sex === "neuter" ? DISSOLVE_NEUTER_FACTOR : 1;

  const biomass =
    (DISSOLVE_BASE_BIOMASS + (toad.genes?.rarity || 1) * DISSOLVE_RARITY_RATE) *
    (1 + (toad.genes?.weight || 0) / 50) *
    weightMultiplier *
    getDiseasePenaltyMultiplier(toad.state?.diseaseId) *
    stageFactor *
    sexFactor;

  return Math.round(biomass * 10) / 10;
};

/** Суммарный выход биомассы за партию жаб (сумма округлённых значений) */
export const getDissolveBatchYield = (toads: Toad[]): number =>
  round2(toads.reduce((sum, toad) => sum + getDissolveYield(toad), 0));

/**
 * ID жаб, которые прямо сейчас находятся в инкубаторе коллайдера.
 * Их разбирать нельзя — иначе потомство исчезнет вместе с сейвом слота.
 */
export const getIncubatingToadIds = (): number[] => {
  const state = loadColliderState() as unknown as ExtendedColliderState;
  return state.slots
    .map((slot) => slot?.child?.id)
    .filter((id): id is number => typeof id === "number");
};

/**
 * ID жаб, которые прямо сейчас в походе за Периметр (Часть 5).
 * Их разбирать нельзя: команда ещё не вернулась домой.
 */
export const getExpeditionToadIds = (): number[] =>
  (getGameState().expeditions ?? []).flatMap((expedition) =>
    expedition.team.map((member) => member.toadId),
  );

/** Можно ли разобрать жабу в Диссоциаторе (жабы в инкубаторе — нет) */
export const canDissolveToad = (
  toad: Toad,
  incubatingIds?: number[],
  expeditionIds: number[] = getExpeditionToadIds(),
): boolean =>
  !(incubatingIds ?? getIncubatingToadIds()).includes(toad.id) &&
  !expeditionIds.includes(toad.id);

export interface DissolveWarning {
  icon: string;
  text: string;
}

/** Предупреждения для финального подтверждения разбора */
export const getDissolveWarnings = (toads: Toad[]): DissolveWarning[] => {
  if (toads.length === 0) {
    return [];
  }

  const warnings: DissolveWarning[] = [];
  const pregnantCount = toads.filter(
    (toad) => toad.pregnancy?.isPregnant,
  ).length;

  if (pregnantCount > 0) {
    warnings.push({
      icon: "🍼",
      text: `Беременных жаб: ${pregnantCount} — вынашиваемое потомство пропадёт`,
    });
  }

  // Часть 5: раненых жаб жалко разбирать — их можно подлечить в разведке
  const woundedCount = toads.filter((toad) => toad.status === "injured").length;

  if (woundedCount > 0) {
    warnings.push({
      icon: "🩹",
      text: `Раненых жаб: ${woundedCount} — HP восстанавливается само, а в «Медотсеке» жаб можно вылечить за Кваксы`,
    });
  }

  // Оставшаяся популяция
  const remaining = getGameState().toads.length - toads.length;
  if (remaining < 2) {
    warnings.push({
      icon: "🐸",
      text:
        remaining <= 0
          ? "В лаборатории не останется ни одной жабы"
          : `В лаборатории останется ${remaining} жаба — размножение станет невозможным (спасёт сброс прогресса)`,
    });
  }

  return warnings;
};

export interface DissolveResult {
  success: boolean;
  removed: number;
  biomassGained: number;
  message: string;
}

/**
 * Разбор жабы, которой ещё нет в колонии (лутбокс).
 *
 * Лутбокс создаёт жабу только после выбора биопода, поэтому «распылить» надо уметь
 * до `createToad`. Биомасса и прогресс журнала заданий начисляются по тем же
 * правилам, что и в `dissolveToads`, но удалять из сохранения нечего.
 */
export const dissolveNewToad = (toad: Toad): number => {
  const state = getGameState();
  const biomassGained = getDissolveYield(toad);

  updateUser({ biomass: round2((state.user.biomass || 0) + biomassGained) });
  recordQuestEvent("toad_dissolved", 1);

  return biomassGained;
};

/**
 * Необратимо перерабатывает жаб в биомассу.
 * Жабы в инкубаторе и несуществующие ID игнорируются.
 */
export const dissolveToads = (toadIds: number[]): DissolveResult => {
  const state = getGameState();
  const incubatingIds = getIncubatingToadIds();
  const expeditionIds = getExpeditionToadIds();

  const toads = state.toads.filter(
    (toad) =>
      toadIds.includes(toad.id) &&
      !incubatingIds.includes(toad.id) &&
      !expeditionIds.includes(toad.id),
  );

  if (toads.length === 0) {
    const requestedExists = state.toads.some((toad) =>
      toadIds.includes(toad.id),
    );
    const onExpedition = state.toads.some(
      (toad) => toadIds.includes(toad.id) && expeditionIds.includes(toad.id),
    );

    return {
      success: false,
      removed: 0,
      biomassGained: 0,
      message: requestedExists
        ? onExpedition
          ? "Жаба в походе за Периметр: дождитесь возвращения команды"
          : "Жабу в инкубаторе разобрать нельзя: дождитесь вылупления"
        : "Некого перерабатывать: жабы не найдены",
    };
  }

  const biomassGained = getDissolveBatchYield(toads);
  const biomass = round2((state.user.biomass || 0) + biomassGained);

  updateUser({ biomass });
  deleteToadsByIds(toads.map((toad) => toad.id));

  recordQuestEvent("toad_dissolved", toads.length);

  return {
    success: true,
    removed: toads.length,
    biomassGained,
    message: `Диссоциатор переработал ${toads.length} жаб: +${biomassGained} биомассы`,
  };
};
