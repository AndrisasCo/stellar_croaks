import { getPregnancyDuration, HOURS_TO_GROW_UP, Toad } from "../models/Toad";
import { Items } from "../models/user";
import { isToadSick } from "../models/disease";
import {
  createToads,
  updateToadById,
  updateToadsByIds,
  updateUser,
  updateUserStorage,
} from "../backend";
import { generateChildToad } from "./calculate-genetics";
import { getHoursFromNow } from "./date";
import { getGameState } from "../backend/localStorage";
import { completeAchivement } from "../backend/achivements-manager";
import { assignToadsToScenes } from "./housing";
import {
  getToadEnclosureId,
  getToadHomeId,
  getToadRoomId,
} from "./toad-location";
import { getToadGrowthInfo } from "./toad-growth";
import { NEST_ROOM_ID } from "./constants";
import {
  getBreedCooldownMs,
  getBreedPairBiomassCost,
  getEnergyCost,
  getToadEnergy,
  isToadReadyToBreed,
} from "./gamification-config";
import { isToadDown } from "./expedition-config";
import { isToadBusyOnExpedition } from "./expedition-manager";

/**
 * Голодающие головастики, о которых уже предупредили в этой сессии.
 * Тик роста идёт раз в минуту, и без этой защиты игрок получал бы одно и то же
 * уведомление каждую минуту, пока не покормит головастика.
 */
const warnedStarvingToadpoles = new Set<number>();

/** Одно и то же предупреждение о голодном головастике — не чаще раза за сессию. */
const warnStarvingToadpole = (toad: Toad, addNotification: any) => {
  if (warnedStarvingToadpoles.has(toad.id)) {
    return;
  }

  warnedStarvingToadpoles.add(toad.id);
  addNotification({
    content: `${toad.name} не растёт: головастик голоден. Покормите его!`,
    type: "warn",
    timeout: 9000,
  });
};

export class TimeManager {
  lastPlayTime: string | number;
  currentTime: number;

  constructor() {
    this.lastPlayTime = new Date(
      getGameState().lastSaved || Date.now(),
    ).getTime();
    this.currentTime = Date.now();
  }

  getTimePassed() {
    const realTimeDiff = this.currentTime - +this.lastPlayTime;
    const gameDaysPassed =
      Math.floor((realTimeDiff / (60 * 60 * 1000)) * 100) / 100; // 1 час

    return Math.min(gameDaysPassed, 90); // максимум 90 "дней" оффлайн
  }
}

export const processBreeding = (addNotification: any) => {
  const toadsByScene = groupToadsByScene(getGameState().toads);

  // Обрабатываем каждую сцену отдельно
  Object.values(toadsByScene).forEach((sceneToads) => {
    processSceneBreeding(sceneToads, addNotification);
  });
};

/** Жабы по домам: id биопода (`homeId`) → его жабы */
const groupToadsByScene = (toads: Toad[]): Record<string, Toad[]> => {
  return toads
    .filter((toad) => getToadHomeId(toad) != null)
    .reduce(
      (groups, toad) => {
        const sceneId = String(getToadHomeId(toad));
        if (!groups[sceneId]) {
          groups[sceneId] = [];
        }
        groups[sceneId].push(toad);
        return groups;
      },
      {} as Record<string, Toad[]>,
    );
};

const processSceneBreeding = async (
  sceneToads: Toad[],
  addNotification: any,
) => {
  const pregnant = sceneToads.filter((t) => t.pregnancy);

  // Роды идут по таймеру беременности: где бы самка ни ждала, она родит в свой сектор
  pregnant.forEach((toad) => {
    if (
      toad.pregnancy &&
      getHoursFromNow(toad.pregnancy.pregnancyStart) >= // часы
        toad.pregnancy.pregnancyDuration
    ) {
      endPregnancy(toad, addNotification);
    }
  });

  // Устаревшее ухаживание из старых сейвов: тик сразу доигрывает его беременностью
  // (`finishMating`) либо срывает, если пара распалась (поход, выбывание, разбор партнёра).
  sceneToads
    .filter((t) => t.mating)
    .forEach((toad) => processMating(toad, sceneToads, addNotification));

  // смотрим нужно ли жабе вырасти
  const toadpoles = sceneToads.filter((t) => t.stage === "toadpole");

  // Рост без ускорений: бонусы биопода («ускоренный рост») — легаси и удалены.
  // Таймер запускает первое кормление (`growthStartedAt`): новорождённый появляется
  // с hunger: 0, поэтому без кормления он не начнёт расти (`getToadGrowthInfo`).
  const grownToadpoles: number[] = [];
  const startedToadpoles: number[] = [];
  toadpoles.forEach((t) => {
    const growth = getToadGrowthInfo(t);

    if (!growth) {
      return;
    }

    if (growth.notStarted) {
      if (!growth.hungry) {
        // Старый сейв или головастик из Торговая Капсулаа: он уже сыт, можно запускать таймер.
        startedToadpoles.push(t.id);
      } else if (getHoursFromNow(t.created_at) >= HOURS_TO_GROW_UP) {
        warnStarvingToadpole(t, addNotification);
      }
      return;
    }

    if (!growth.isDue) {
      return;
    }

    if (growth.hungry) {
      warnStarvingToadpole(t, addNotification);
      return;
    }

    warnedStarvingToadpoles.delete(t.id);
    grownToadpoles.push(t.id);
  });

  if (startedToadpoles.length > 0) {
    updateToadsByIds(startedToadpoles, { growthStartedAt: Date.now() }, true);
  }

  if (grownToadpoles.length > 0) {
    updateToadsByIds(grownToadpoles, { stage: "adult" }, true);
  }
};

/**
 * Ухаживание в репродукторе (Часть 3.2).
 *
 * Жабы беременеют только в репродукторе: самец и самка сидят там парой, и ухаживание заводит
 * игрок — кнопкой «Начать ухаживание» в модалке репродуктора (`startNestCourtship`); само
 * репродуктор пару не берёт. Ухаживание мгновенное: пара сразу беременеет, и дальше самка
 * вынашивает потомство в репродукторе до родов. Её нельзя отселить до родов (только ускорить
 * беременность мушкой ✨), а самца после ухаживания игрок может забрать в биопод — он больше
 * не занят парой.
 *
 * `Toad.mating` остался только для старых сейвов: тик `processBreeding` доигрывает такую пару
 * в беременность сразу (`processMating`), поэтому игрок не ждёт устаревший таймер.
 */

/** Пол жаб, который «ведёт» пару: беременность стартует у самки */
const MATING_LEAD_SEX = "female";

/**
 * Жаба перестала ухаживать, но осталась в репродукторе: выносит её только игрок
 * (перенос на карте или кнопка в модалке «Репродуктор»).
 */
const clearMating = (toad: Toad) =>
  updateToadById(toad.id, { mating: null }, true);

/** Почему пара распалась — текст для уведомления */
const getMatingBreakReason = (toad: Toad, partner: Toad | null): string => {
  if (!partner) {
    return "партнёр пропал";
  }

  if (isToadBusyOnExpedition(toad) || isToadBusyOnExpedition(partner)) {
    return "жаба ушла в поход";
  }

  if ((toad.hp ?? 1) <= 0 || (partner.hp ?? 1) <= 0) {
    return "жаба выбита из строя";
  }

  return "партнёр больше не ухаживает";
};

/**
 * Старый сейв: ухаживание завершается сразу — у самки стартует беременность, оба остаются
 * в репродукторе (из него жабу выносит игрок, сама она никуда не уходит).
 */
const finishMating = (female: Toad, male: Toad) => {
  const mother: Toad = { ...female, mating: null };

  // startPregnancy пишет мать синхронно; `scene_id` у обоих не трогаем: из репродуктора
  // жабу выносит игрок, сама она никуда не уходит
  void startPregnancy(mother, male);
  clearMating(male);
};

/**
 * Тик устаревшего ухаживания (старые сейвы): пара больше не ждёт 15–30 минут — беременность
 * стартует на первом же тике. Срыв (поход, 0 HP, пропавший партнёр) гасит ухаживание
 * у обоих, но жабы остаются в репродукторе.
 */
const processMating = (
  toad: Toad,
  sceneToads: Toad[],
  addNotification: any,
) => {
  const mating = toad.mating;

  if (!mating) {
    return;
  }

  const partner = sceneToads.find((t) => t.id === mating.partnerId) ?? null;
  const pairBroken =
    !partner || !partner.mating || partner.mating.partnerId !== toad.id;
  const unavailable =
    isToadBusyOnExpedition(toad) ||
    (toad.hp ?? 1) <= 0 ||
    !partner ||
    isToadBusyOnExpedition(partner) ||
    (partner.hp ?? 1) <= 0;

  if (pairBroken || unavailable) {
    // Уведомляем один раз на пару: говорит тот, кто её ведёт (самка)
    const leads = toad.sex === MATING_LEAD_SEX || !partner;
    const reason = getMatingBreakReason(toad, partner);
    const names = [toad.name, partner?.name].filter(Boolean).join(" ♥ ");

    if (partner?.mating) {
      clearMating(partner);
    }

    clearMating(toad);

    if (leads) {
      addNotification?.({
        type: "warn",
        content: `Ухаживание ${names} прервано: ${reason}.`,
        timeout: 6000,
      });
    }

    return;
  }

  if (toad.sex !== MATING_LEAD_SEX) {
    return;
  }

  // Таймера больше нет: старое ухаживание доигрывается беременностью на первом тике
  finishMating(toad, partner);
};

export const startPregnancy = async (toad: Toad, father: Toad) => {
  // Беременность без ускорений: бонус биопода («ускоренная беременность») — легаси
  toad.pregnancy = {
    isPregnant: true,
    pregnancyStart: Date.now(),
    pregnancyDuration: Math.min(
      getPregnancyDuration() + toad.genes.rarity / 2,
      8,
    ),
    fatherId: father.id,
    father,
    offspringCount: calculateOffspringCount(toad),
  };

  updateToadById(toad.id, toad, true);
};

const calculateOffspringCount = (female: Toad): number => {
  // Базовое количество + влияние fertility
  const baseCount = Math.ceil(female.genes.fertility / female.genes.rarity);
  const bonusCount = Math.floor(
    Math.random() * 1 + female.genes.fertility / 10,
  );
  return Math.min(baseCount + bonusCount, 5);
};

export const endPregnancy = async (toad: Toad, addNotification: any) => {
  if (!toad.pregnancy) {
    return;
  }
  const { offspringCount } = toad.pregnancy;

  const father = toad.pregnancy.father;

  // Мать остаётся там, где рожала: из репродуктора её выносит игрок, а не игра
  const finishBirth = () =>
    updateToadById(toad.id, { ...toad, pregnancy: null, mating: null }, true);

  if (!father) {
    finishBirth();
    return;
  }

  const children = new Array(offspringCount)
    .fill(1)
    .map(() => generateChildToad([toad, father], false));

  const currentSceneId = getToadEnclosureId(toad) ?? getToadHomeId(toad);

  // Роды в репродукторе: головастики остаются рядом с матерью, даже если репродуктор
  // переполнен — игрок сам разнесёт их по биоподам. Склада жаб нет, поэтому
  // репродуктор остаётся единственным местом, где потомство может подождать места:
  // головастик в секторе место в биоподе не занимает, а дом помнит (`homeId`).
  const nestRoomId = typeof toad.scene_id === "string" ? toad.scene_id : null;

  if (isNestRoomId(nestRoomId)) {
    const born = children.map(
      (child): Partial<Toad> => ({
        ...child,
        homeId: currentSceneId,
        scene_id: nestRoomId,
      }),
    );

    createToads(born, true);

    completeAchivement("first-offspring");
    finishBirth();
    return;
  }

  // Биопод матери мог пропасть (её дом — снесли карту/сейв): тогда потомство просто
  // раскладывается по любым свободным биоподам — «предпочтительный» тогда не находится.
  const homeSceneExists = getGameState().scenes.some(
    (scene) => scene.id === currentSceneId,
  );

  // Склада жаб больше нет: потомство раскладываем по биоподам, начиная с биопода матери.
  // Тем, кому места не хватило, биопод придётся построить — они не появляются на свет.
  const { assigned, rejected } = assignToadsToScenes(
    children,
    homeSceneExists ? currentSceneId : null,
  );

  if (rejected > 0) {
    addNotification({
      type: "warn",
      content: `${toad.name} родила ${assigned.length} головастиков, ещё ${rejected} не поместились: постройте биопод на карте колонии. Покормите новорождённых — кормление запустит рост.`,
    });
  }

  if (assigned.length > 0) {
    createToads(assigned, true);
  }

  completeAchivement("first-offspring");
  finishBirth();
};

/** Результат действия в репродукторе (ускорение беременности) */
export interface NestActionResult {
  success: boolean;
  message: string;
}

/**
 * Досрочные роды в репродукторе: кнопка «Ускорить» в модалке репродуктора платит
 * Сияющей мушкой ✨ со склада (`Items.sparkleFlys`) и сразу завершает беременность
 * (`endPregnancy`). Без мушки действие не списывает ничего и возвращает причину —
 * игрок не платит за пустое ускорение.
 */
export const accelerateNestPregnancy = async (
  toadId: number,
  addNotification?: (notification: any) => void,
): Promise<NestActionResult> => {
  const state = getGameState();
  const toad = state.toads.find((item) => item.id === toadId);

  if (!toad?.pregnancy?.isPregnant) {
    return { success: false, message: "Эта жаба не вынашивает потомство." };
  }

  const flies = state.user.storage?.[Items.sparkleFlys] || 0;

  if (flies < 1) {
    const message = "Для ускорения беременности нужна Сияющая мушка ✨.";
    addNotification?.({ type: "warn", content: message });

    return { success: false, message };
  }

  updateUserStorage({ [Items.sparkleFlys]: flies - 1 });
  await endPregnancy(toad, addNotification);

  return {
    success: true,
    message: `${toad.name ?? "Самка"} родила: головастики ждут рядом, в репродукторе.`,
  };
};

/**
 * Репродуктор ли это на карте: гекс «Репродуктор», построенный игроком, или историческое
 * место `breeding`/`NEST_ROOM_ID` из старого сейва. Только в репродукторе жабы могут
 * забеременеть — в биоподе нет.
 */
export const isNestRoomId = (roomId?: string | null): boolean => {
  if (!roomId) {
    return false;
  }

  const room = (getGameState().colony?.rooms ?? []).find(
    (item) =>
      item.id === roomId ||
      item.slotId === roomId ||
      // Карта зовёт исторический гекс `NEST_ROOM_ID`, а сейв постройки — `breeding`.
      (roomId === NEST_ROOM_ID && item.slotId === "breeding") ||
      (roomId === "breeding" && item.id === NEST_ROOM_ID),
  );

  // Нет постройки — нет и репродуктора: на старте этот гекс свободен.
  return room?.kind === "breeding";
};

/**
 * Репродуктор — сектор на пару, но места у пары разные: самка садится в первый слот,
 * самец во второй. Пол слота решает, кого предложит список жаб, поэтому в репродуктор
 * не посадить двух самцов и сразу видно, кого паре не хватает.
 */
export const NEST_SLOT_SEXES = ["female", "male"] as const;

export type NestSlotSex = (typeof NEST_SLOT_SEXES)[number];

/** Пол слота репродуктора: слотов всего два (`NEST_ROOM_TOAD_SLOTS`), дальше слотов нет */
export const getNestSlotSex = (slotIndex: number): NestSlotSex | null =>
  NEST_SLOT_SEXES[slotIndex] ?? null;

/** Как называется слот в интерфейсе репродуктора */
export const getNestSlotLabel = (slotIndex: number): string => {
  const sex = getNestSlotSex(slotIndex);

  if (sex === "female") {
    return "Слот самки";
  }

  if (sex === "male") {
    return "Слот самца";
  }

  return "Слот репродуктора";
};

/**
 * Чем жаба не годится для слота репродуктора (`null` — годится).
 *
 * Репродуктор берёт только взрослую жабу нужного пола: не в походе, не выбитую,
 * без кибер-болезни и не вынашивающую потомство. Правила одни и те же для списка жаб
 * (`getNestSlotCandidates`) и для причины, почему жабу в список не позвали.
 */
export const getNestSlotRejectReason = (
  toad: Toad,
  slotIndex: number,
): string | null => {
  const sex = getNestSlotSex(slotIndex);

  if (!sex) {
    return "В репродукторе всего два слота: самки и самца.";
  }

  if (toad.stage !== "adult") {
    return "В репродуктор берут только взрослых жаб.";
  }

  if (toad.sex !== sex) {
    return sex === "female"
      ? "Первый слот репродуктора занимает самка."
      : "Второй слот репродуктора занимает самец.";
  }

  if (isToadBusyOnExpedition(toad)) {
    return "Жаба в походе за Периметр — размножение только дома.";
  }

  if (isToadDown(toad)) {
    return "Выбитая жаба не может размножаться — сначала подлечите её.";
  }

  if (isToadSick(toad)) {
    return "Больная жаба не может размножаться — сначала вылечите её.";
  }

  // В репродукторе жаба стоит в секторе (`scene_id` — строка): второго места у неё нет,
  // поэтому её не предлагают ни этому репродуктору, ни другому.
  if (isNestRoomId(getToadRoomId(toad))) {
    return "Жаба уже сидит в репродукторе — вынесите её оттуда, чтобы позвать снова.";
  }

  if (toad.pregnancy?.isPregnant) {
    return "Жаба уже вынашивает потомство — дождитесь родов.";
  }

  return null;
};

/**
 * Кого можно позвать в слот репродуктора: взрослые жабы нужного пола, здоровые и свободные —
 * не в походе, не выбитые, не больные, без беременности и не из другого репродуктора.
 * Сверху — самые редкие: пару собирают из лучших жаб колонии.
 */
export const getNestSlotCandidates = (slotIndex: number): Toad[] =>
  getGameState()
    .toads.filter((toad) => getNestSlotRejectReason(toad, slotIndex) === null)
    .sort((a, b) => b.genes.rarity - a.genes.rarity);

/** Результат нажатия кнопки «Начать ухаживание» в модалке репродуктора */
export interface CourtshipResult {
  started: boolean;
  /** Почему ухаживание не началось — текст для интерфейса репродуктора */
  message: string;
}

/** Состояние пары репродуктора: активна ли кнопка ухаживания и чего не хватает */
export interface CourtshipCheck {
  /** Можно ли начинать ухаживание прямо сейчас */
  ready: boolean;
  /** Чего не хватает — или что пара готова делать: текст под кнопкой репродуктора */
  message: string;
  /** Пара, которой кнопка заведёт ухаживание (есть всегда, когда `ready`) */
  pair: { male: Toad; female: Toad } | null;
}

/**
 * Жабы репродуктора: все взрослые (по ним видно, что ухаживание или беременность уже идут)
 * и свободная пара — самец и самка без ухаживания и беременности. Ходим через неё и в
 * проверке кнопки, и в запуске пары, чтобы проверки и старт не разъезжались.
 */
const getNestPair = (
  roomId: string,
): { adults: Toad[]; male: Toad | null; female: Toad | null } => {
  const free = (toad: Toad) => !toad.mating && !toad.pregnancy?.isPregnant;
  const adults = getGameState().toads.filter(
    (toad) => toad.scene_id === roomId && toad.stage === "adult",
  );

  return {
    adults,
    male: adults.find((toad) => toad.sex === "male" && free(toad)) ?? null,
    female: adults.find((toad) => toad.sex === "female" && free(toad)) ?? null,
  };
};

/**
 * Готова ли пара в репродукторе к ухаживанию (кнопка «Начать ухаживание», Часть 3.2).
 *
 * Проверка без побочных эффектов: по ней кнопка решает, активна ли она, и объясняет,
 * чего не хватает — сил пары, биомассы, беременности. Пара берётся из тех, кто ещё
 * не ухаживает и не вынашивает, поэтому при идущей беременности кнопка ничего не запустит.
 */
export const checkNestCourtship = (roomId: string): CourtshipCheck => {
  const state = getGameState();
  const { adults, male, female } = getNestPair(roomId);

  if (adults.length === 0) {
    return {
      ready: false,
      message: "Репродуктор пуст: посадите сюда самца и самку.",
      pair: null,
    };
  }

  if (adults.some((toad) => toad.mating)) {
    return {
      ready: false,
      message: "Пара в процессе ухаживания.",
      pair: null,
    };
  }

  if (adults.some((toad) => toad.pregnancy?.isPregnant)) {
    return {
      ready: false,
      message: "В репродукторе уже идёт беременность — дождитесь родов.",
      pair: null,
    };
  }

  if (!male || !female) {
    return {
      ready: false,
      message: "В репродукторе нужны самец и самка — посадите обоих.",
      pair: null,
    };
  }

  if (isToadDown(male) || isToadDown(female)) {
    return {
      ready: false,
      message: "Выбитая жаба не может размножаться — сначала подлечите её.",
      pair: null,
    };
  }

  // Кибер-болезнь (Часть 3.6): больных в пару не берут — как и в списке жаб репродуктора
  if (isToadSick(male) || isToadSick(female)) {
    return {
      ready: false,
      message: "Больная жаба не может размножаться — сначала вылечите её.",
      pair: null,
    };
  }

  if (isToadBusyOnExpedition(male) || isToadBusyOnExpedition(female)) {
    return {
      ready: false,
      message: "Жаба в походе за Периметр — размножение только дома.",
      pair: null,
    };
  }

  if (!isToadReadyToBreed(male) || !isToadReadyToBreed(female)) {
    return {
      ready: false,
      message: `Пара ещё восстанавливает силы — ухаживание будет доступно спустя время: ${Math.round(((male.breedCooldownUntil || female.breedCooldownUntil || 0) - Date.now()) / 1000)} с`,
      pair: null,
    };
  }

  const biomassCost = getBreedPairBiomassCost(male, female);
  const biomass = state.user.biomass || 0;

  if (biomass < biomassCost) {
    return {
      ready: false,
      message: `Не хватает биомассы на пару: нужно ${biomassCost}, есть ${Math.floor(
        biomass,
      )}.`,
      pair: null,
    };
  }

  return {
    ready: true,
    message: "Пара готова — ухаживание мгновенное: самка сразу забеременеет.",
    pair: { male, female },
  };
};

/**
 * Кнопка «Начать ухаживание» (Часть 3.2).
 *
 * Пару заводит игрок: посадил в репродуктор самца и самку, нажал кнопку — здесь списываются
 * энергия, биомасса и отдых обоих. Ухаживание мгновенное: самка сразу беременеет
 * (`startPregnancy`), самец больше не занят парой и его можно отселить, а самка остаётся
 * в репродукторе до родов — ускорить их можно мушкой ✨ (`accelerateNestPregnancy`).
 * Само репродуктор пару не заводит: без нажатия пара просто ждёт и ничего не тратит.
 *
 * Проверяет то же, что показывает кнопка (`checkNestCourtship`): если пара не готова,
 * возвращаем причину и говорим о ней уведомлением — для вызовов мимо интерфейса.
 */
export const startNestCourtship = (
  roomId: string,
  addNotification?: (notification: any) => void,
): CourtshipResult => {
  const check = checkNestCourtship(roomId);

  if (!check.ready || !check.pair) {
    addNotification?.({ type: "warn", content: check.message });

    return { started: false, message: check.message };
  }

  const { male, female } = check.pair;
  const state = getGameState();
  const now = Date.now();
  const biomassCost = getBreedPairBiomassCost(male, female);
  const biomass = state.user.biomass || 0;

  // Старое ухаживание снимаем на всякий случай: пара могла прийти из сейва с `mating`
  const updatedMale: Toad = {
    ...male,
    energy: getToadEnergy(male) - getEnergyCost(male),
    breedCooldownUntil: now + getBreedCooldownMs(male),
    mating: null,
  };
  const updatedFemale: Toad = {
    ...female,
    energy: getToadEnergy(female) - getEnergyCost(female),
    breedCooldownUntil: now + getBreedCooldownMs(female),
    mating: null,
  };

  updateToadById(updatedMale.id, updatedMale, true);
  updateUser({ biomass: Math.round((biomass - biomassCost) * 100) / 100 });

  // Ухаживание мгновенное: беременность пишется синхронно, ждать её старт не нужно.
  // Оба остаются в репродукторе, но самец уже свободен — его можно забрать в биопод.
  void startPregnancy(updatedFemale, updatedMale);

  completeAchivement("first-manual-breed");

  return {
    started: true,
    message:
      "Самка сразу забеременела — ускорьте беременность мушкой ✨ или дождитесь родов",
  };
};
