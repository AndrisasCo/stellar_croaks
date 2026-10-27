import { getPregnancyDuration, Toad } from "../models/Toad";
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
import { MINUTE_MS, hoursSince } from "./date";
import { getGameState } from "../backend/localStorage";
import { completeAchivement } from "../backend/achivements-manager";
import { assignToadsToScenes } from "./housing";
import {
  getToadEnclosureId,
  getToadHomeId,
  getToadRoomId,
} from "./toad-location";
import { getToadGrowthInfo } from "./toad-growth";
import { getPregnancyDueAt, getPregnancyInfo } from "./pregnancy";
import { NEST_ROOM_ID } from "./constants";
import {
  HOURS_TO_GROW_UP,
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
    content: `${toad.name ?? "Головастик"} не растёт: головастик голоден. Покормите его!`,
    type: "warn",
    timeout: 9000,
  });
};

export interface BreedingTickOptions {
  /**
   * Не проверять рост в этом тике. Оффлайн-догон сначала рожает, затем кормит
   * новорождённых автокормушкой и только потом растит (`MainScreen` → `catchUp`):
   * иначе головастик, родившийся в оффлайне, успел бы «проголодаться» до кормления
   * и получил бы ложное предупреждение.
   */
  skipGrowth?: boolean;
}

export const processBreeding = (
  addNotification: any,
  options: BreedingTickOptions = {},
) => {
  const { toads } = getGameState();

  // Роды: срок беременности считается у каждой жабы, где бы она ни ждала. Дом
  // (`homeId`) для этого не нужен — жаба из старого сейва без дома тоже рожает,
  // а потомство раскладывается по биоподам в `endPregnancy`.
  toads.forEach((toad) => {
    if (getPregnancyInfo(toad)?.isDue) {
      endPregnancy(toad, addNotification);
    }
  });

  // Рост идёт после родов и по всем жабам: новорождённые этого тика тоже попадают
  // в проверку (без кормления они просто ждут кормушку или игрока).
  if (!options.skipGrowth) {
    processToadpoleGrowth(addNotification);
  }
};

/**
 * Тик роста головастиков.
 *
 * Таймер запускает первое кормление (`growthStartedAt`), а не роды. Ходим по всем
 * жабам, а не по домам: рост не зависит от места, и головастик без `homeId` (старый
 * сейв) иначе не вырос бы никогда.
 *
 * Вызывается и отдельно от родов (`MainScreen` → `catchUp`), потому что оффлайн-догон
 * сначала рожает, затем кормит новорождённых автокормушкой (она ставит таймер роста
 * на время рождения), и только потом проверяет, не вырос ли головастик за оффлайн.
 *
 * Рост без ускорений: бонусы биопода («ускоренный рост») — легаси и удалены.
 */
export const processToadpoleGrowth = (
  addNotification: any,
  now = Date.now(),
): void => {
  const { toads } = getGameState();
  const grownToadpoles: number[] = [];

  toads.forEach((toad) => {
    const growth = getToadGrowthInfo(toad, now);

    if (!growth) {
      return;
    }

    if (growth.notStarted) {
      // Головастика ещё не кормили — он и не растёт. Предупреждаем, когда он уже
      // мог бы вырасти: новорождённый с `hunger: 0` не должен ругаться сразу.
      if (hoursSince(toad.created_at, now) >= HOURS_TO_GROW_UP) {
        warnStarvingToadpole(toad, addNotification);
      }
      return;
    }

    if (!growth.isDue) {
      return;
    }

    if (growth.hungry) {
      warnStarvingToadpole(toad, addNotification);
      return;
    }

    warnedStarvingToadpoles.delete(toad.id);
    grownToadpoles.push(toad.id);
  });

  if (grownToadpoles.length > 0) {
    updateToadsByIds(grownToadpoles, { stage: "adult" }, true);
  }
};

/**
 * Ухаживание в репродукторе (Часть 3.2).
 *
 * Жабы беременеют только в репродукторе: самец и самка сидят там парой, и ухаживание
 * заводит игрок — кнопкой «Начать ухаживание» в модалке репродуктора
 * (`startNestCourtship`). Само репродуктор пару не берёт, а ухаживание мгновенное:
 * пара сразу беременеет, и дальше самка вынашивает потомство до родов. Её нельзя
 * отселить до родов (только ускорить мушкой ✨), а самец после ухаживания свободен.
 *
 * Старого таймера ухаживания (`Toad.mating`, 15–30 минут) больше нет: такие записи
 * старых сейвов снимает миграция при загрузке (`backend/localStorage.ts`). Поэтому
 * роды не могут начаться «сами» — только после действия игрока.
 */

/** Больше пяти головастиков за роды не бывает */
const MAX_OFFSPRING = 5;

/**
 * Забеременеть. Срок пишется в сейв сразу, поэтому тик родов и карточка жабы читают
 * одно и то же поле.
 *
 * Беременность без ускорений: бонусы биопода («ускоренная беременность») — легаси
 * и удалены. Срок — 0–4 часа: база 0–4 ч плюс качество, но не больше 8 «половин».
 */
export const startPregnancy = (toad: Toad, father: Toad): void => {
  const pregnancyDuration =
    Math.min(getPregnancyDuration() + toad.genes.rarity / 2, 8) / 2;

  updateToadById(
    toad.id,
    {
      pregnancy: {
        isPregnant: true,
        pregnancyStart: Date.now(),
        pregnancyDuration: Math.round(pregnancyDuration * 100) / 100,
        fatherId: father.id,
        father,
        offspringCount: calculateOffspringCount(toad),
      },
    },
    true,
  );
};

const calculateOffspringCount = (female: Toad): number => {
  // Базовое количество + влияние fertility
  const baseCount = Math.floor(Math.random() * 4) + 1;
  const bonusCount =
    Math.random() < Math.min(female.genes.fertility / 4, 1) ? 1 : 0;

  return Math.min(baseCount + bonusCount, MAX_OFFSPRING);
};

/**
 * Роды: дети появляются на свет, беременность снимается.
 *
 * `created_at` детей — **реальное** время родов: срок мог выйти, пока игра была
 * закрыта, и тогда роды «доигрываются» на входе, но родились дети раньше. По этой
 * метке считается возраст и оффлайн-рост головастика — автокормушка ставит таймер
 * роста на время рождения (`utils/auto-feeder.ts`), а не на вход в игру.
 *
 * Началом родов считается только что вышедший срок беременности: иначе
 * новорождённый «моложе» собственных родов и не растёт, пока его не накормят.
 */
export const endPregnancy = (toad: Toad, addNotification: any): void => {
  const pregnancy = toad.pregnancy;

  if (!pregnancy) {
    return;
  }

  const father = pregnancy.father;
  const dueAt = getPregnancyDueAt(pregnancy);
  const bornAt = new Date(
    dueAt == null ? Date.now() : Math.min(Date.now(), dueAt),
  ).toISOString();

  // Мать остаётся там, где рожала: из репродуктора её выносит игрок, а не игра
  const finishBirth = () => updateToadById(toad.id, { pregnancy: null }, true);

  // Битой записи (нет отца) рожать некого: снимаем беременность, а не зависаем в ней
  if (!father) {
    finishBirth();
    return;
  }

  const offspring = Number.isFinite(pregnancy.offspringCount)
    ? Math.min(Math.max(Math.floor(pregnancy.offspringCount), 0), MAX_OFFSPRING)
    : 0;

  const children = new Array(offspring).fill(1).map(() => ({
    ...generateChildToad([toad, father], false),
    created_at: bornAt,
  }));

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
  endPregnancy(toad, addNotification);

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
 * Жабы репродуктора: все взрослые (по ним видно, идёт ли беременность) и свободная
 * пара — самец и самка без беременности. Ходим через неё и в проверке кнопки, и в
 * запуске пары, чтобы проверки и старт не разъезжались.
 */
const getNestPair = (
  roomId: string,
): { adults: Toad[]; male: Toad | null; female: Toad | null } => {
  const free = (toad: Toad) => !toad.pregnancy?.isPregnant;

  const adults = getGameState().toads.filter(
    (toad) => toad.scene_id === roomId && toad.stage === "adult",
  );

  return {
    adults,
    male: adults.find((toad) => toad.sex === "male" && free(toad)) ?? null,
    female: adults.find((toad) => toad.sex === "female" && free(toad)) ?? null,
  };
};

/** Сколько ещё отдыхать паре: «7 мин», «1 ч 10 мин» */
const formatBreedCooldown = (msLeft: number): string => {
  const minutes = Math.max(0, Math.ceil(msLeft / MINUTE_MS));

  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const rest = minutes % 60;

  return rest === 0
    ? `${Math.floor(minutes / 60)} ч`
    : `${Math.floor(minutes / 60)} ч ${rest} мин`;
};

/**
 * Готова ли пара в репродукторе к ухаживанию (кнопка «Начать ухаживание», Часть 3.2).
 *
 * Проверка без побочных эффектов: по ней кнопка решает, активна ли она, и объясняет,
 * чего не хватает — сил пары, биомассы, беременности. Пара берётся из тех, кто ещё
 * не вынашивает, поэтому при идущей беременности кнопка ничего не запустит.
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
    const restMs =
      Math.max(male.breedCooldownUntil ?? 0, female.breedCooldownUntil ?? 0) -
      Date.now();

    return {
      ready: false,
      // Отдых и силы — разные причины: иначе игрок видел бы «через -12 с»
      message:
        restMs > 0
          ? `Пара ещё восстанавливает силы — ухаживание будет доступно через ${formatBreedCooldown(restMs)}.`
          : "Паре не хватает сил на ухаживание — покормите жаб и дождитесь отдыха.",
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

  // Пара из сейва могла прийти с устаревшим `mating`: миграция его уже сняла,
  // а оплата и отдых пишутся только по текущим полям
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
  updateToadById(updatedFemale.id, updatedFemale, true);
  updateUser({ biomass: Math.round((biomass - biomassCost) * 100) / 100 });

  // Ухаживание мгновенное: беременность пишется синхронно, ждать её старт не нужно.
  // Оба остаются в репродукторе, но самец уже свободен — его можно забрать в биопод.
  startPregnancy(updatedFemale, updatedMale);

  completeAchivement("first-manual-breed");

  return {
    started: true,
    message:
      "Самка сразу забеременела — ускорьте беременность мушкой ✨ или дождитесь родов",
  };
};
