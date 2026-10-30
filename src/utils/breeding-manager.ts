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
import { HOUR_MS, MAX_OFFLINE_HOURS, MINUTE_MS, hoursSince } from "./date";
import { getGameState } from "../backend/localStorage";
import { getRoomUpgrades } from "../backend/colony";
import { assignToadsToScenes } from "./housing";
import { getEnergyRegenPerHour } from "./energy";
import { processNestDistributors } from "./nest-distributor";
import { processEnergyRegen } from "./production-manager";
import { isUpgradeActive } from "./room-upgrades";
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
  NEST_TADPOLE_CAPACITY,
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
   * Не проверять рост в этом тике. Нужно вызывающим, которые сами управляют
   * порядком «роды → кормление → рост» (например, тест автокормушки), чтобы
   * новорождённый не получил ложное предупреждение о голоде до кормления.
   */
  skipGrowth?: boolean;
}

export const processBreeding = (
  addNotification: any,
  options: BreedingTickOptions = {},
) => {
  // Тик репродуктора идёт в порядке «кормление (отдельным тиком) → распределение →
  // роды → ухаживание»: «Распределитель» освобождает место до родов, а «Инициатор»
  // запускает следующую пару сразу после них.
  processNestDistributors();

  const { toads } = getGameState();

  // Роды: срок беременности считается у каждой жабы, где бы она ни ждала. Дом
  // (`homeId`) для этого не нужен — жаба из старого сейва без дома тоже рожает,
  // а потомство раскладывается по биоподам в `endPregnancy`.
  toads.forEach((toad) => {
    if (getPregnancyInfo(toad)?.isDue) {
      endPregnancy(toad, addNotification);
    }
  });

  // «Инициатор»: после родов (и на каждом следующем тике) апгрейд сам заводит
  // свободную пару, если она уже отдохнула и на ухаживание хватает ресурсов.
  // Если условия не сложились, попытка просто повторится на следующем тике.
  processAutoBreeders(addNotification);

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
 * (`startNestCourtship`). С апгрейдом «Инициатор» то же самое делает тик
 * (`processAutoBreeders`): после родов и на каждом следующем тике он пробует
 * свободную пару, если условия соблюдены. Само ухаживание мгновенное:
 * пара сразу беременеет, и дальше самка вынашивает потомство до родов. Её нельзя
 * отселить до родов (только ускорить мушкой ✨), а самец после ухаживания свободен.
 *
 * Старого таймера ухаживания (`Toad.mating`, 15–30 минут) больше нет: такие записи
 * старых сейвов снимает миграция при загрузке (`backend/localStorage.ts`). Поэтому
 * роды не могут начаться «сами»: сначала должно пройти ухаживание — по кнопке
 * игрока или по «Инициатору».
 */

/** Больше пяти головастиков за роды не бывает: это же лимит комнаты */
const MAX_OFFSPRING = NEST_TADPOLE_CAPACITY;

/**
 * Забеременеть. Срок пишется в сейв сразу, поэтому тик родов и карточка жабы читают
 * одно и то же поле.
 *
 * Беременность без ускорений: бонусы биопода («ускоренная беременность») — легаси
 * и удалены. Срок — 0–4 часа: база 0–4 ч плюс качество, но не больше 8 «половин».
 */
export const startPregnancy = (
  toad: Toad,
  father: Toad,
  now = Date.now(),
): void => {
  const pregnancyDuration =
    Math.min(getPregnancyDuration() + toad.genes.rarity / 2, 8) / 2;

  updateToadById(
    toad.id,
    {
      pregnancy: {
        isPregnant: true,
        pregnancyStart: now,
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

export interface EndPregnancyOptions {
  /**
   * Игровой момент родов. Оффлайн-догон передаёт историческое время, чтобы
   * `created_at` детей и таймер роста считались от реальных родов, а не от входа.
   */
  now?: number;
  /**
   * Сообщать о родах уведомлением. Обычный тик молчит, а оффлайн-догон передаёт
   * `true` — событие попадёт в журнал «События колонии».
   */
  notify?: boolean;
  /** Сообщать, что роды отложены из-за нехватки места (не чаще раза на пару). */
  notifyBlocked?: boolean;
}

export interface EndPregnancyResult {
  /** Сколько головастиков реально появилось */
  born: number;
  /** true — роды отложены: в репродукторе не хватает места под весь приплод */
  blocked: boolean;
}

/**
 * Уже предупреждали об отложенных родах: тик идёт каждую минуту, и без этого
 * игрок получал бы одно и то же уведомление, пока не освободит репродуктор.
 * Ключ — конкретная самка в конкретном репродукторе.
 */
const warnedNestBirthBlocks = new Set<string>();

const getNestBirthBlockKey = (roomId: string, toadId: number): string =>
  `${roomId}:${toadId}`;

/**
 * Сколько головастиков сейчас в репродукторе (взрослая пара места не занимает).
 * Считаем по всем id комнаты: жаба могла быть записана как id постройки или id гекса.
 */
export const getNestTadpoleCount = (roomId: string): number => {
  const roomIds = getNestRoomIds(roomId);

  return getGameState().toads.filter(
    (toad) =>
      typeof toad.scene_id === "string" &&
      roomIds.has(toad.scene_id) &&
      toad.stage !== "adult",
  ).length;
};

/**
 * Помещается ли весь приплод в репродуктор.
 *
 * Лимит — `NEST_TADPOLE_CAPACITY` (он же максимальный разовый приплод). Если в комнате
 * уже есть головастики, роды ждут, пока для **всего** выводка не освободится место:
 * частичных родов нет, иначе лимит терял бы смысл. Самка остаётся беременной до этого
 * момента; «Распределитель» освобождает место автоматически.
 */
const getNestBirthBlockMessage = (
  toad: Toad,
  offspring: number,
): string | null => {
  const roomId = getToadRoomId(toad);

  if (!roomId || !isNestRoomId(roomId)) {
    return null;
  }

  const count = getNestTadpoleCount(roomId);

  if (count + offspring <= NEST_TADPOLE_CAPACITY) {
    return null;
  }

  return `Роды отложены: в репродукторе ${count}/${NEST_TADPOLE_CAPACITY} головастиков, а для всего приплода нужно ещё ${offspring}. Перенесите головастиков в биопод или включите «Распределитель» — самка останется беременной до освобождения места.`;
};

/**
 * Завершает беременность и создаёт потомство.
 *
 * **Репродуктор:** головастики остаются рядом с матерью, пока их не перенесут вручную
 * или «Распределитель». Если весь приплод не помещается в комнату
 * (`NEST_TADPOLE_CAPACITY`), роды не начинаются: беременность сохраняется, а игрок
 * получает одно предупреждение. Так лимит комнаты не нарушается даже старыми сейвами.
 *
 * **Вне репродуктора:** потомство раскладывается по свободным биоподам, а
 * `created_at` детей — реальное время родов: по нему автокормушка ставит таймер роста
 * (`utils/auto-feeder.ts`), даже если роды произошли в оффлайне.
 */
export const endPregnancy = (
  toad: Toad,
  addNotification: any,
  options: EndPregnancyOptions = {},
): EndPregnancyResult => {
  const pregnancy = toad.pregnancy;

  if (!pregnancy) {
    return { born: 0, blocked: false };
  }

  const father = pregnancy.father;
  const now = options.now ?? Date.now();
  const dueAt = getPregnancyDueAt(pregnancy);
  const bornAt = new Date(
    dueAt == null ? now : Math.min(now, dueAt),
  ).toISOString();

  // Мать остаётся там, где рожала: из репродуктора её выносит игрок, а не игра
  const finishBirth = () => updateToadById(toad.id, { pregnancy: null }, true);

  // Битой записи (нет отца) рожать некого: снимаем беременность, а не зависаем в ней
  if (!father) {
    finishBirth();
    return { born: 0, blocked: false };
  }

  const offspring = Number.isFinite(pregnancy.offspringCount)
    ? Math.min(Math.max(Math.floor(pregnancy.offspringCount), 0), MAX_OFFSPRING)
    : 0;

  const nestRoomId = getToadRoomId(toad);
  const inNest = isNestRoomId(nestRoomId);
  const blockMessage = inNest
    ? getNestBirthBlockMessage(toad, offspring)
    : null;

  if (blockMessage) {
    if (options.notifyBlocked !== false && nestRoomId) {
      const key = getNestBirthBlockKey(nestRoomId, toad.id);

      if (!warnedNestBirthBlocks.has(key)) {
        warnedNestBirthBlocks.add(key);
        addNotification({
          type: "warn",
          content: blockMessage,
          timeout: 12000,
        });
      }
    }

    return { born: 0, blocked: true };
  }

  const children = new Array(offspring).fill(1).map(() => ({
    ...generateChildToad([toad, father], false),
    created_at: bornAt,
  }));

  const currentSceneId = getToadEnclosureId(toad) ?? getToadHomeId(toad);

  if (inNest && nestRoomId) {
    const born = children.map(
      (child): Partial<Toad> => ({
        ...child,
        homeId: currentSceneId,
        scene_id: nestRoomId,
      }),
    );

    createToads(born, true);
    warnedNestBirthBlocks.delete(getNestBirthBlockKey(nestRoomId, toad.id));

    if (options.notify && born.length > 0) {
      addNotification({
        type: "success",
        content: `🐣 «${toad.name ?? "Самка"}» родила ${born.length} головастиков в репродукторе.`,
      });
    }

    finishBirth();
    return { born: born.length, blocked: false };
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
  } else if (options.notify && assigned.length > 0) {
    addNotification({
      type: "success",
      content: `🐣 «${toad.name ?? "Самка"}» родила ${assigned.length} головастиков — они размещены в биоподах.`,
    });
  }

  if (assigned.length > 0) {
    createToads(assigned, true);
  }

  if (nestRoomId) {
    warnedNestBirthBlocks.delete(getNestBirthBlockKey(nestRoomId, toad.id));
  }

  finishBirth();
  return { born: assigned.length, blocked: false };
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

  // Ускорение не должно тратить мушку, если роды всё равно отложены лимитом комнаты.
  const offspring = Number.isFinite(toad.pregnancy.offspringCount)
    ? Math.min(
        Math.max(Math.floor(toad.pregnancy.offspringCount), 0),
        MAX_OFFSPRING,
      )
    : 0;
  const blockMessage = getNestBirthBlockMessage(toad, offspring);

  if (blockMessage) {
    addNotification?.({ type: "warn", content: blockMessage, timeout: 12000 });

    return { success: false, message: blockMessage };
  }

  updateUserStorage({ [Items.sparkleFlys]: flies - 1 });
  endPregnancy(toad, addNotification);
  // Ускоренные роды — тоже роды: «Инициатор» сразу пробует следующее ухаживание.
  processAutoBreeders(addNotification);

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
  /**
   * Когда пара станет готова, если сейчас мешают только отдых или силы.
   * `null` — ждать нечего: нужна биомасса, лечение, поход или посадка пары.
   * Оффлайн-догон использует это, чтобы не перебирать каждую минуту.
   */
  retryAt?: number | null;
}

/** Когда у жабы восстановятся силы на ухаживание (`null` — силы не восстанавливаются) */
const getEnergyReadyAt = (
  toad: Toad,
  now: number,
  colony: ReturnType<typeof getGameState>["colony"],
): number | null => {
  const cost = getEnergyCost(toad);
  const energy = getToadEnergy(toad);

  if (energy >= cost) {
    return now;
  }

  const rate = getEnergyRegenPerHour(toad, colony);

  if (rate <= 0) {
    return null;
  }

  return now + ((cost - energy) / rate) * HOUR_MS;
};

/**
 * Все id, которыми адресуется этот репродуктор.
 *
 * Карта зовёт сектор по id гекса (`RoomConfig.id`), а сейв постройки помнит ещё
 * и канонический `ColonyRoomState.id`. Жаба могла быть посажена любым из них —
 * старый сейв или вызов мимо интерфейса, — поэтому пара ищется по обоим.
 */
const getNestRoomIds = (roomId: string): Set<string> => {
  const state = getGameState();
  const room = (state.colony?.rooms ?? []).find(
    (item) => item.id === roomId || item.slotId === roomId,
  );

  return new Set(
    [roomId, room?.id, room?.slotId].filter(
      (id): id is string => typeof id === "string",
    ),
  );
};

/**
 * Жабы репродуктора: все взрослые (по ним видно, идёт ли беременность) и свободная
 * пара — самец и самка без беременности. Ходим через неё и в проверке кнопки, и в
 * запуске пары, чтобы проверки и старт не разъезжались.
 */
const getNestPair = (
  roomId: string,
): { adults: Toad[]; male: Toad | null; female: Toad | null } => {
  const free = (toad: Toad) => !toad.pregnancy?.isPregnant;
  const roomIds = getNestRoomIds(roomId);

  const adults = getGameState().toads.filter(
    (toad) =>
      typeof toad.scene_id === "string" &&
      roomIds.has(toad.scene_id) &&
      toad.stage === "adult",
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
export const checkNestCourtship = (
  roomId: string,
  now = Date.now(),
): CourtshipCheck => {
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

  if (!isToadReadyToBreed(male, now) || !isToadReadyToBreed(female, now)) {
    const restUntil = Math.max(
      male.breedCooldownUntil ?? 0,
      female.breedCooldownUntil ?? 0,
    );
    const restMs = restUntil - now;
    const maleEnergyAt = getEnergyReadyAt(male, now, state.colony);
    const femaleEnergyAt = getEnergyReadyAt(female, now, state.colony);
    // Если силы не восстанавливаются вовсе (жаба не в биоподе/репродукторе или
    // голодна), ждать нечего: понадобится кормление или переезд.
    const retryAt =
      maleEnergyAt == null || femaleEnergyAt == null
        ? null
        : Math.max(now, restUntil, maleEnergyAt, femaleEnergyAt);

    return {
      ready: false,
      // Отдых и силы — разные причины: иначе игрок видел бы «через -12 с»
      message:
        restMs > 0
          ? `Пара ещё восстанавливает силы — ухаживание будет доступно через ${formatBreedCooldown(restMs)}.`
          : "Паре не хватает сил на ухаживание — покормите жаб и дождитесь отдыха.",
      pair: null,
      retryAt,
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
 * Без апгрейда «Инициатор» репродуктор пару не заводит: без нажатия пара просто ждёт
 * и ничего не тратит; с апгрейдом ту же проверку повторяет `processAutoBreeders`.
 *
 * Проверяет то же, что показывает кнопка (`checkNestCourtship`): если пара не готова,
 * возвращаем причину и говорим о ней уведомлением — для вызовов мимо интерфейса.
 */
export const startNestCourtship = (
  roomId: string,
  addNotification?: (notification: any) => void,
  options: { now?: number } = {},
): CourtshipResult => {
  const now = options.now ?? Date.now();
  const check = checkNestCourtship(roomId, now);

  if (!check.ready || !check.pair) {
    addNotification?.({ type: "warn", content: check.message });

    return { started: false, message: check.message };
  }

  const { male, female } = check.pair;
  const state = getGameState();
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
  startPregnancy(updatedFemale, updatedMale, now);

  return {
    started: true,
    message:
      "Самка сразу забеременела — ускорьте беременность мушкой ✨ или дождитесь родов",
  };
};

/** Что сделал «Инициатор» за один проход: для тика, тестов и уведомлений */
export interface AutoBreedingResult {
  /** Сколько пар реально начали ухаживание */
  started: number;
  /** Пары, которые запустились: по ним видно, кого поздравлять */
  pairs: { roomId: string; male: Toad; female: Toad }[];
}

/**
 * «Инициатор» — автоматическое ухаживание в репродукторе.
 *
 * Проходим все репродукторы с активным апгрейдом и повторяем ту же проверку, что
 * у кнопки (`checkNestCourtship`): пара должна быть в слотах, быть здоровой,
 * отдохнувшей, с достаточным запасом сил, а в кошельке — хватать биомассы.
 * Если условия не сложились, ничего не списываем и молчим: следующая попытка
 * будет на очередном тике. Поэтому после родов пара снова начнёт ухаживание,
 * как только восстановит силы.
 *
 * Вызывается из `processBreeding` (раз в минуту), сразу после ускоренных родов
 * (`accelerateNestPregnancy`) и после покупки/включения апгрейда. Успех
 * сопровождается уведомлением, чтобы автоматическая трата ресурсов не была
 * неожиданной.
 */
export const processAutoBreeders = (
  addNotification?: (notification: any) => void,
  options: { now?: number; notify?: boolean } = {},
): AutoBreedingResult => {
  const now = options.now ?? Date.now();
  const state = getGameState();
  const rooms = (state.colony?.rooms ?? []).filter(
    (room) =>
      room.kind === "breeding" &&
      isUpgradeActive(getRoomUpgrades(room), "autoBreeder"),
  );
  const result: AutoBreedingResult = { started: 0, pairs: [] };

  rooms.forEach((room) => {
    const roomId = room.slotId ?? room.id;
    const check = checkNestCourtship(roomId, now);

    if (!check.ready || !check.pair) {
      return;
    }

    const { male, female } = check.pair;
    const started = startNestCourtship(roomId, undefined, { now });

    if (!started.started) {
      return;
    }

    result.started += 1;
    result.pairs.push({ roomId, male, female });

    if (options.notify !== false) {
      addNotification?.({
        type: "success",
        content: `«Инициатор»: «${female.name ?? "Самка"}» и «${
          male.name ?? "Самец"
        }» начали ухаживание — самка забеременела.`,
      });
    }
  });

  return result;
};

export interface OfflineBreedingOptions {
  /** Момент последнего сейва (закрытия игры) */
  since: number;
  /** Момент входа в игру (по умолчанию `Date.now()`) */
  now?: number;
  /** Писать события догона в журнал «События колонии» */
  notify?: boolean;
  /**
   * Восстанавливать силы жаб за время отсутствия. Основной catch-up передаёт `true`,
   * а тесты и ручные вызовы могут отключить, чтобы проверять только роды.
   */
  regenEnergy?: boolean;
}

export interface OfflineBreedingResult {
  /** Сколько головастиков родилось за отсутствие */
  births: number;
  /** Сколько головастиков «Распределитель» перенёс в биоподы */
  distributed: number;
  /** Сколько головастиков осталось в репродукторе из-за нехватки мест */
  distributionFailed: number;
  /** Сколько ухаживаний запустил «Инициатор» */
  autoStarted: number;
  /** Сколько раз роды откладывались из-за лимита репродуктора */
  blockedBirths: number;
}

/**
 * Оффлайн-догон репродуктора.
 *
 * Идём по времени отсутствия, а не одним снимком: роды случаются в свой срок,
 * «Распределитель» освобождает место, «Инициатор» запускает следующую пару после
 * отдыха, а силы жаб восстанавливаются между событиями. Поэтому за долгое отсутствие
 * может пройти несколько циклов, а не один.
 *
 * Порядок внутри каждого шага — как у тика (`processBreeding`):
 * распределение → роды → автоухаживание. Кормление остаётся общим тиком голода:
 * он идёт следом и ставит новорождённым таймер роста от фактического времени родов.
 *
 * События отдаются через `addNotification` — `MainScreen` складывает их в журнал
 * «События колонии», а не в исчезающие тосты.
 */
export const processOfflineBreeding = (
  addNotification?: (notification: any) => void,
  options: OfflineBreedingOptions = { since: Date.now() },
): OfflineBreedingResult => {
  const now = options.now ?? Date.now();
  const savedAt =
    Number.isFinite(options.since) && options.since > 0 ? options.since : now;
  const since = Math.max(savedAt, now - MAX_OFFLINE_HOURS * HOUR_MS);
  let cursor = Math.min(since, now);
  let lastRegenAt = cursor;
  const result: OfflineBreedingResult = {
    births: 0,
    distributed: 0,
    distributionFailed: 0,
    autoStarted: 0,
    blockedBirths: 0,
  };

  /**
   * Силы восстанавливаются кусками между событиями, а не одним снимком на входе.
   * `processEnergyRegen` глобальный: обновляет всех жаб в биоподах, репродукторах
   * и Медотсеке, поэтому отсутствие не «замораживает» отдых вне репродуктора.
   */
  const regenTo = (at: number) => {
    if (options.regenEnergy === false || at <= lastRegenAt) {
      lastRegenAt = Math.max(lastRegenAt, at);
      return;
    }

    processEnergyRegen((at - lastRegenAt) / HOUR_MS);
    lastRegenAt = at;
  };

  /** Один шаг догона: распределить, родить, попробовать следующую пару. */
  const processAt = (timestamp: number) => {
    const moved = processNestDistributors();
    result.distributed += moved.sent;
    result.distributionFailed += moved.failed;

    // Роды: срок у каждой жабы свой. После родов «Распределитель» на следующем шаге
    // освободит комнату, а «Инициатор» попробует новую пару на этом же шаге.
    getGameState().toads.forEach((toad) => {
      if (!getPregnancyInfo(toad, timestamp)?.isDue) {
        return;
      }

      const birth = endPregnancy(toad, addNotification, {
        now: timestamp,
        notify: options.notify,
        notifyBlocked: options.notify,
      });

      if (birth.blocked) {
        result.blockedBirths += 1;
      } else {
        result.births += birth.born;
      }
    });

    const auto = processAutoBreeders(undefined, {
      now: timestamp,
      notify: false,
    });
    result.autoStarted += auto.started;
  };

  /** Ближайший срок родов после указанного момента. */
  const getNextPregnancyAt = (after: number): number | null =>
    getGameState().toads.reduce<number | null>((next, toad) => {
      const dueAt = toad.pregnancy ? getPregnancyDueAt(toad.pregnancy) : null;

      if (dueAt == null || dueAt <= after) {
        return next;
      }

      return next == null ? dueAt : Math.min(next, dueAt);
    }, null);

  /** Ближайшая попытка «Инициатора»: конец отдыха или восстановление сил. */
  const getNextAutoBreederAt = (after: number): number | null => {
    const state = getGameState();
    const rooms = (state.colony?.rooms ?? []).filter(
      (room) =>
        room.kind === "breeding" &&
        isUpgradeActive(getRoomUpgrades(room), "autoBreeder"),
    );

    return rooms.reduce<number | null>((next, room) => {
      const roomId = room.slotId ?? room.id;
      const check = checkNestCourtship(roomId, after);

      if (
        check.ready ||
        typeof check.retryAt !== "number" ||
        check.retryAt <= after
      ) {
        return next;
      }

      return next == null ? check.retryAt : Math.min(next, check.retryAt);
    }, null);
  };

  regenTo(cursor);
  processAt(cursor);

  while (cursor < now) {
    const dueAt = getNextPregnancyAt(cursor);
    const retryAt = getNextAutoBreederAt(cursor);
    const next =
      dueAt == null
        ? retryAt
        : retryAt == null
          ? dueAt
          : Math.min(dueAt, retryAt);

    if (next == null || next > now) {
      break;
    }

    // Гарантия прогресса, даже если событие пришлось ровно на текущий момент.
    cursor = Math.max(cursor + 1, next);
    regenTo(cursor);
    processAt(cursor);
  }

  regenTo(now);

  if (options.notify && addNotification) {
    if (result.autoStarted > 0) {
      addNotification({
        type: "success",
        content: `«Инициатор»: пока вас не было, пары начинали ухаживание ${result.autoStarted} раз(а).`,
      });
    }

    if (result.distributed > 0) {
      addNotification({
        type: "info",
        content: `«Распределитель»: пока вас не было, ${result.distributed} головастиков переехали в биоподы.`,
      });
    }
  }

  return result;
};
