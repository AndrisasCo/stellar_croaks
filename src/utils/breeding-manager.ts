import {
  getPregnancyDuration,
  HOURS_TO_GROW_UP,
  MatingState,
  Toad,
} from "../models/Toad";
import {
  createToads,
  updateScene,
  updateToadById,
  updateToadsByIds,
  updateUser,
} from "../backend";
import { generateChildToad } from "./calculate-genetics";
import { getHoursFromNow } from "./date";
import { getGameState } from "../backend/localStorage";
import { getHunger } from "./state-manager";
import { completeAchivement } from "../backend/achivements-manager";
import { assignToadsToScenes } from "./housing";
import { NEST_ROOM_ID } from "./constants";
import {
  canUpgradeNest,
  getBreedCooldownMs,
  getBreedPairBiomassCost,
  getEnergyCost,
  getMatingMinutes,
  getNestSlotUpgradeCost,
  getNestSlots,
  getToadEnergy,
  isToadReadyToBreed,
  MATING_MAX_MINUTES,
  MATING_MIN_MINUTES,
  NEST_MAX_SLOTS,
} from "./gamification-config";
import { isToadDown } from "./expedition-config";
import { isToadOnExpedition } from "./expedition-manager";

export class TimeManager {
  lastPlayTime: string | number;
  currentTime: number;

  constructor() {
    this.lastPlayTime = new Date(
      getGameState().lastSaved || Date.now()
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

export const processBreeding = (hoursPassed: number, addNotification: any) => {
  // Ухаживание заводит игрок кнопкой «Начать ухаживание» в модалке гнезда — тик пару не
  // берёт сам. Он только ведёт уже начатое ухаживание (`processMating`: беременность по
  // таймеру или срыв) и играет беременности. Оффлайн-догон ухаживание не запускает: без
  // игрока пары не спариваются.

  const toads = getGameState().toads.filter((t) => t.scene_id !== null);

  // Группируем жаб по сценам
  const toadsByScene = groupToadsByScene(toads);

  // Обрабатываем каждую сцену отдельно
  Object.entries(toadsByScene).forEach(([sceneId, sceneToads]) => {
    processSceneBreeding(sceneId, sceneToads, hoursPassed, addNotification);
  });
};

const groupToadsByScene = (toads: Toad[]): Record<string, Toad[]> => {
  return toads
    .filter((t) => t.scene_id)
    .reduce((groups, toad) => {
      const sceneId = toad.scene_id || "0";
      if (!groups[sceneId]) {
        groups[sceneId] = [];
      }
      groups[sceneId].push(toad);
      return groups;
    }, {} as Record<string, Toad[]>);
};

const processSceneBreeding = async (
  sceneId: string,
  sceneToads: Toad[],
  hoursPassed: number,
  addNotification: any
) => {
  const pregnant = sceneToads.filter((t) => t.pregnancy);

  // Роды идут по таймеру беременности: где бы самка ни ждала, она родит в свою комнату
  pregnant.forEach((toad) => {
    if (
      toad.pregnancy &&
      getHoursFromNow(toad.pregnancy.pregnancyStart) >= // часы
        toad.pregnancy.pregnancyDuration
    ) {
      endPregnancy(toad, addNotification);
    }
  });

  // Ухаживание пары в гнезде: тик либо завершает его беременностью (`finishMating`),
  // либо срывает, если пара распалась (поход, выбывание, разбор партнёра).
  sceneToads
    .filter((t) => t.mating)
    .forEach((toad) => processMating(toad, sceneToads, addNotification));

  // смотрим нужно ли жабе вырасти
  const toadpoles = sceneToads.filter((t) => t.stage === "toadpole");

  // Рост без ускорений: бонусы вольера («ускоренный рост») — легаси и удалены
  const grownToadpoles: number[] = [];
  toadpoles.forEach((t) => {
    if (getHoursFromNow(t.created_at) >= HOURS_TO_GROW_UP) {
      const hunger = getHunger(
        t.state.hunger,
        t.genes.hungerRate,
        HOURS_TO_GROW_UP
      );

      if (t.state.hunger - hunger < 0) {
        addNotification({
          content: `${t.name}  был слишком голодный и не смог вырасти!`,
          type: "warn",
        });
      } else {
        console.log(`Toad ${t.name} has grown up!`);
        grownToadpoles.push(t.id);
      }
    }
  });

  if (grownToadpoles.length > 0) {
    updateToadsByIds(grownToadpoles, { stage: "adult" }, true);
  }
};

/**
 * Ухаживание в гнезде (Часть 3.2).
 *
 * Жабы беременеют только в гнезде: самец и самка сидят там парой, и ухаживание заводит игрок
 * — кнопкой «Начать ухаживание» в модалке гнезда (`startNestCourtship`); само гнездо пару не
 * берёт. Пара живёт в гнезде (`roomId` = гекс-гнездо) и ухаживает случайные 15–30 минут, после
 * чего у самки начинается беременность. Из гнезда жабы не уходят сами: и после ухаживания,
 * и после родов их выносит только игрок. Пару «ведёт» самка — её таймер запускает
 * беременность, поэтому уведомление приходит один раз.
 *
 * Если кто-то из пары ушёл в поход, выбит или пропал (разбор/продажа), ухаживание
 * срывается с уведомлением: игрок не должен ждать беременность, которой не будет.
 */

/** Пол жаб, который «ведёт» пару: беременность стартует у самки */
const MATING_LEAD_SEX = "female";

/**
 * Жаба перестала ухаживать, но осталась в гнезде: выносит её только игрок
 * (перенос на карте или кнопка в модалке «Гнездо»).
 */
const clearMating = (toad: Toad) => updateToadById(toad.id, { mating: null }, true);

/** «2 ч 15 мин» из длительности беременности в часах */
const formatPregnancyEta = (hours: number): string => {
  const totalMinutes = Math.max(1, Math.round(hours * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;

  return hh > 0 ? `${hh} ч ${mm} мин` : `${mm} мин`;
};

/** Почему пара распалась — текст для уведомления */
const getMatingBreakReason = (toad: Toad, partner: Toad | null): string => {
  if (!partner) {
    return "партнёр пропал";
  }

  if (toad.status === "out" || partner.status === "out") {
    return "жаба ушла в поход";
  }

  if ((toad.hp ?? 1) <= 0 || (partner.hp ?? 1) <= 0) {
    return "жаба выбита из строя";
  }

  return "партнёр больше не ухаживает";
};

/**
 * Низкоуровневый старт ухаживания: сажает пару в гнездо и вешает обоим `mating`.
 * Энергия, биомасса и отдых списываются на входе (`startNestCourtship` — кнопка игрока),
 * а беременность стартует по таймеру (`processMating`). Возвращает минуты ожидания — их
 * показывают в интерфейсе.
 *
 * Наружу не отдаём: пару заводит только кнопка «Начать ухаживание» в модалке гнезда.
 */
const startMating = (
  female: Toad,
  male: Toad,
  nestRoomId: string = NEST_ROOM_ID
): { minutes: number; startAt: number } => {
  const now = Date.now();
  const minutes = getMatingMinutes(female, male);
  const startAt = now + minutes * 60_000;

  const femaleMating: MatingState = {
    startedAt: now,
    startAt,
    partnerId: male.id,
  };
  const maleMating: MatingState = {
    startedAt: now,
    startAt,
    partnerId: female.id,
  };

  updateToadById(female.id, {
    ...female,
    mating: femaleMating,
    roomId: nestRoomId,
  });
  updateToadById(male.id, { mating: maleMating, roomId: nestRoomId });

  return { minutes, startAt };
};

/** Время вышло: у самки стартует беременность, пара остаётся жить в гнезде */
const finishMating = (female: Toad, male: Toad, addNotification: any) => {
  const mother: Toad = { ...female, mating: null };

  // startPregnancy пишет мать синхронно; `roomId` у обоих не трогаем: из гнезда
  // жабу выносит игрок, сама она никуда не уходит
  void startPregnancy(mother, male);
  clearMating(male);

  addNotification?.({
    type: "success",
    content: `♥ ${male.name ?? "Самец"} ♥ ${female.name ?? "Самка"}: ухаживание удалось, беременность началась! Роды примерно через ${formatPregnancyEta(
      mother.pregnancy?.pregnancyDuration ?? 0
    )}.`,
    timeout: 9000,
  });
};

/**
 * Тик ухаживания: пара ждёт в гнезде. Завершает ухаживание по таймеру либо срывает
 * его, если жаба ушла в поход, выбита или партнёр пропал. Вызывается из
 * `processBreeding` (раз в минуту и при оффлайн-догоне).
 */
/**
 * Тик ухаживания: пара ждёт в гнезде 15–30 минут, потом у самки стартует беременность.
 * Срыв (поход, 0 HP, пропавший партнёр) гасит ухаживание у обоих, но жабы остаются в гнезде.
 */
const processMating = (
  toad: Toad,
  sceneToads: Toad[],
  addNotification: any
) => {
  const mating = toad.mating;

  if (!mating) {
    return;
  }

  const partner = sceneToads.find((t) => t.id === mating.partnerId) ?? null;
  const pairBroken =
    !partner || !partner.mating || partner.mating.partnerId !== toad.id;
  const unavailable =
    toad.status === "out" ||
    (toad.hp ?? 1) <= 0 ||
    !partner ||
    partner.status === "out" ||
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

  if (Date.now() < mating.startAt) {
    return;
  }

  finishMating(toad, partner, addNotification);
};

export const startPregnancy = async (toad: Toad, father: Toad) => {
  // Беременность без ускорений: бонус вольера («ускоренная беременность») — легаси
  toad.pregnancy = {
    isPregnant: true,
    pregnancyStart: Date.now(),
    pregnancyDuration: Math.min(
      getPregnancyDuration() + toad.genes.rarity / 2,
      8
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
    Math.random() * 1 + female.genes.fertility / 10
  );
  return Math.min(baseCount + bonusCount, 5);
};

export const endPregnancy = async (toad: Toad, addNotification: any) => {
  console.log("Female end pregnancy: ", toad.name);

  if (!toad.pregnancy) {
    return;
  }
  const { offspringCount } = toad.pregnancy;

  const father = toad.pregnancy.father;

  // Мать остаётся там, где рожала: из гнезда её выносит игрок, а не игра
  const finishBirth = () =>
    updateToadById(toad.id, { ...toad, pregnancy: null, mating: null }, true);

  if (!father) {
    finishBirth();
    return;
  }

  const children = new Array(offspringCount)
    .fill(1)
    .map(() => generateChildToad([toad, father], false));

  const currentSceneId = toad.scene_id;

  // Роды в гнезде: головастики остаются рядом с матерью, даже если гнездо
  // переполнено — игрок сам разнесёт их по вольерам. Склада жаб нет, поэтому
  // гнездо остаётся единственным местом, где потомство может подождать места.
  if (isNestRoomId(toad.roomId)) {
    const born = children.map(
      (child): Partial<Toad> => ({
        ...child,
        scene_id: currentSceneId,
        roomId: toad.roomId,
      })
    );

    createToads(born, true);

    addNotification({
      type: "success",
      content: `${toad.name} родила головастиков в гнезде: ${born.length}. Перенесите их в вольер.`,
      timeout: 9000,
    });

    completeAchivement("first-offspring");
    finishBirth();
    return;
  }

  const currentScene = getGameState().scenes.find(
    (s) => s.id === currentSceneId
  );

  if (!currentScene) {
    throw Error("Scene for toads birth not found!");
  }

  // Склада жаб больше нет: потомство раскладываем по вольерам, начиная с вольера матери.
  // Тем, кому места не хватило, вольер придётся построить — они не появляются на свет.
  const { assigned, rejected } = assignToadsToScenes(children, currentSceneId);

  if (rejected > 0) {
    addNotification({
      type: "warn",
      content: `${toad.name} родила ${assigned.length} головастиков, ещё ${rejected} не поместились: постройте вольер на карте колонии.`,
    });
  } else {
    addNotification({
      type: "success",
      content: `${toad.name} родила головастиков: ${assigned.length}`,
    });
  }

  if (assigned.length > 0) {
    createToads(assigned, true);
  }

  completeAchivement("first-offspring");
  finishBirth();
};

/**
 * Занятость родильных слотов вольера (Часть 3.2).
 * used — число занятых слотов: ухаживание в гнезде (пара) и беременность,
 * limit — лимит слотов купола.
 */
export const getNestOccupancy = (
  sceneId: number | null
): { used: number; limit: number } => {
  const state = getGameState();
  const scene = state.scenes.find((s) => s.id === sceneId) ?? null;
  // Слот занят и пока идёт ухаживание (жаба в гнезде), и пока она вынашивает
  const used = state.toads.filter(
    (t) => t.scene_id === sceneId && (t.mating || t.pregnancy?.isPregnant)
  ).length;

  return { used, limit: getNestSlots(scene) };
};

/** Результат действия в гнезде: прерывание ухаживания, апгрейд слотов */
export interface NestActionResult {
  success: boolean;
  message: string;
}

/**
 * Досрочно прерывает ухаживание (кнопка «Прервать» в гнезде): пара перестаёт
 * ухаживать, но остаётся в гнезде — вынести жаб может только игрок.
 * Потраченные на спаривание энергия и биомасса не возвращаются.
 */
export const abortMating = (toadId: number): NestActionResult => {
  const state = getGameState();
  const toad = state.toads.find((t) => t.id === toadId);
  const mating = toad?.mating;

  if (!toad || !mating) {
    return { success: false, message: "Эта жаба не ухаживает в гнезде" };
  }

  const partner = state.toads.find((t) => t.id === mating.partnerId);

  if (partner?.mating) {
    clearMating(partner);
  }

  clearMating(toad);

  return {
    success: true,
    message: `Ухаживание ${
      toad.name ?? "жабы"
    } прервано: жабы остались в гнезде`,
  };
};

/**
 * Апгрейд постройки «Гнездо» (Часть 3.2): +1 родильный слот за Кваксы.
 * Цена растёт с каждым апгрейдом, максимум — NEST_MAX_SLOTS.
 */
export const upgradeNestSlots = (
  sceneId: number | null
): NestActionResult => {
  const state = getGameState();
  const scene = state.scenes.find((s) => s.id === sceneId);

  if (!scene) {
    return { success: false, message: "Вольер для апгрейда не найден" };
  }

  if (!canUpgradeNest(scene)) {
    return {
      success: false,
      message: `Гнездо уже расширено до предела (${NEST_MAX_SLOTS} слотов)`,
    };
  }

  const cost = getNestSlotUpgradeCost(scene);
  const tokens = state.user.tokens || 0;

  if (tokens < cost) {
    return {
      success: false,
      message: `Не хватает Кваксов на Гнездо: нужно ${cost}, есть ${Math.floor(
        tokens
      )}`,
    };
  }

  const slots = getNestSlots(scene) + 1;

  updateScene(scene.id, { nestSlots: slots });
  updateUser({ tokens: tokens - cost });

  return {
    success: true,
    message: `Гнездо расширено: ${slots} родильных слотов`,
  };
};

/**
 * Гнездо ли это на карте: базовое гнездо колонии (`NEST_ROOM_ID`) или гекс «Гнездо»,
 * построенный игроком. Только в гнезде жабы могут забеременеть — в вольере нет.
 */
export const isNestRoomId = (roomId?: string | null): boolean => {
  if (!roomId) {
    return false;
  }

  if (roomId === NEST_ROOM_ID) {
    return true;
  }

  return (getGameState().colony?.rooms ?? []).some(
    (room) => room.id === roomId && room.kind === "breeding"
  );
};

/** Взрослые жабы, которые прямо сейчас сидят в комнате-гнезде */
export const getNestToads = (roomId: string = NEST_ROOM_ID): Toad[] =>
  getGameState().toads.filter(
    (toad) => toad.roomId === roomId && toad.stage === "adult"
  );

/** Результат нажатия кнопки «Начать ухаживание» в модалке гнезда */
export interface CourtshipResult {
  started: boolean;
  /** Почему ухаживание не началось — текст для интерфейса гнезда */
  message: string;
}

/** Состояние пары гнезда: активна ли кнопка ухаживания и чего не хватает */
export interface CourtshipCheck {
  /** Можно ли начинать ухаживание прямо сейчас */
  ready: boolean;
  /** Чего не хватает — или что пара готова делать: текст под кнопкой гнезда */
  message: string;
  /** Пара, которой кнопка заведёт ухаживание (есть всегда, когда `ready`) */
  pair: { male: Toad; female: Toad } | null;
}

/**
 * Жабы гнезда: все взрослые (по ним видно, что ухаживание или беременность уже идут)
 * и свободная пара — самец и самка без ухаживания и беременности. Ходим через неё и в
 * проверке кнопки, и в запуске пары, чтобы проверки и старт не разъезжались.
 */
const getNestPair = (
  roomId: string
): { adults: Toad[]; male: Toad | null; female: Toad | null } => {
  const free = (toad: Toad) => !toad.mating && !toad.pregnancy?.isPregnant;
  const adults = getGameState().toads.filter(
    (toad) => toad.roomId === roomId && toad.stage === "adult"
  );

  return {
    adults,
    male: adults.find((toad) => toad.sex === "male" && free(toad)) ?? null,
    female: adults.find((toad) => toad.sex === "female" && free(toad)) ?? null,
  };
};

/**
 * Готова ли пара в гнезде к ухаживанию (кнопка «Начать ухаживание», Часть 3.2).
 *
 * Проверка без побочных эффектов: по ней кнопка решает, активна ли она, и объясняет,
 * чего не хватает — сил пары, биомассы, родильных слотов вольера. Пара берётся из тех,
 * кто ещё не ухаживает и не вынашивает, поэтому при идущем ухаживании (или уже
 * начавшейся беременности) кнопка ничего не запустит.
 */
export const checkNestCourtship = (
  roomId: string = NEST_ROOM_ID
): CourtshipCheck => {
  const state = getGameState();
  const { adults, male, female } = getNestPair(roomId);

  if (adults.length === 0) {
    return {
      ready: false,
      message: "Гнездо пусто: посадите сюда самца и самку.",
      pair: null,
    };
  }

  if (adults.some((toad) => toad.mating)) {
    return {
      ready: false,
      message: "Пара уже ухаживает — беременность придёт по таймеру.",
      pair: null,
    };
  }

  if (adults.some((toad) => toad.pregnancy?.isPregnant)) {
    return {
      ready: false,
      message: "В гнезде уже идёт беременность — дождитесь родов.",
      pair: null,
    };
  }

  if (!male || !female) {
    return {
      ready: false,
      message: "В гнезде нужны самец и самка — посадите обоих.",
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

  if (isToadOnExpedition(male.id) || isToadOnExpedition(female.id)) {
    return {
      ready: false,
      message: "Жаба в походе за Периметр — размножение только дома.",
      pair: null,
    };
  }

  if (!isToadReadyToBreed(male) || !isToadReadyToBreed(female)) {
    return {
      ready: false,
      message: "Пара ещё восстанавливает силы — кнопка оживёт после отдыха.",
      pair: null,
    };
  }

  const biomassCost = getBreedPairBiomassCost(male, female);
  const biomass = state.user.biomass || 0;

  if (biomass < biomassCost) {
    return {
      ready: false,
      message: `Не хватает биомассы на пару: нужно ${biomassCost}, есть ${Math.floor(
        biomass
      )}.`,
      pair: null,
    };
  }

  const { used, limit } = getNestOccupancy(female.scene_id);

  if (used >= limit) {
    return {
      ready: false,
      message: "Все родильные слоты вольера заняты — дождитесь родов.",
      pair: null,
    };
  }

  return {
    ready: true,
    message: `Пара готова: ухаживание ${MATING_MIN_MINUTES}–${MATING_MAX_MINUTES} мин.`,
    pair: { male, female },
  };
};

/**
 * Кнопка «Начать ухаживание» (Часть 3.2).
 *
 * Пару заводит игрок: посадил в гнездо самца и самку, нажал кнопку — здесь списываются
 * энергия, биомасса и отдых обоих, им вешается `mating` на случайные 15–30 минут
 * (`startMating`), после чего у самки стартует беременность (`processMating`). Само гнездо
 * пару не заводит: без нажатия пара просто ждёт в гнезде и ничего не тратит.
 *
 * Проверяет то же, что показывает кнопка (`checkNestCourtship`): если пара не готова,
 * возвращаем причину и говорим о ней уведомлением — для вызовов мимо интерфейса.
 */
export const startNestCourtship = (
  roomId: string = NEST_ROOM_ID,
  addNotification?: (notification: any) => void
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

  const updatedMale: Toad = {
    ...male,
    energy: getToadEnergy(male) - getEnergyCost(male),
    breedCooldownUntil: now + getBreedCooldownMs(male),
  };
  const updatedFemale: Toad = {
    ...female,
    energy: getToadEnergy(female) - getEnergyCost(female),
    breedCooldownUntil: now + getBreedCooldownMs(female),
  };

  updateToadById(updatedMale.id, updatedMale, true);
  updateUser({ biomass: Math.round((biomass - biomassCost) * 100) / 100 });

  // startMating дописывает обоим ухаживание и оставляет пару в её гнезде
  const { minutes } = startMating(updatedFemale, updatedMale, roomId);

  completeAchivement("first-manual-breed");

  addNotification?.({
    type: "success",
    content: `♥ ${updatedMale.name} ♥ ${updatedFemale.name}: ухаживание началось — беременность через ~${minutes} мин.`,
    timeout: 8000,
  });

  return {
    started: true,
    message: `Ухаживание в гнезде: беременность через ~${minutes} мин`,
  };
};

