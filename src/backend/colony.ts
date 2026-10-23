import {
  ColonyRoomKind,
  ColonyRoomState,
  ColonyState,
  EMPTY_COLONY,
  EMPTY_UPGRADES,
  RoomUpgrades,
} from "../models/colony";
import { DEFAULT_SCENE, INITIAL_CAPACITY, Scene } from "../models/scene";
import { Toad } from "../models/Toad";
import {
  AVIARY_ROOM_ID,
  createRoomId,
  MAX_OWNED_SCENES,
  NEST_ROOM_ID,
} from "../utils/constants";
import { getEnclosureToads } from "../utils/housing";
import { getToadHomeId } from "../utils/toad-location";
import { completeAchivement } from "./achivements-manager";
import { getGameState, updateGameState } from "./localStorage";
import { getToadById, updateToadById } from "./index";

/**
 * Постройки колонии: гексагональная карта живёт в состоянии игры,
 * поэтому все действия идут через `updateGameState` — экран карты
 * перерисуется сам по событию `gameStateUpdated`.
 */

/** Построенные секторы колонии (старые сейвы поля не знают — отдаём пустую колонию). */
export const getColonyState = (): ColonyState =>
  getGameState().colony ?? EMPTY_COLONY;

export const saveColonyState = (colony: ColonyState): ColonyState => {
  updateGameState({ colony });

  return colony;
};

/**
 * Апгрейды сектора: они лежат в `ColonyState.upgrades` по id гекса, поэтому сектор
 * передаём целиком — гексу-биоподу апгрейд может отдать ещё и его биопод.
 *
 * У сектора два id: карта зовёт его `RoomConfig.id` (id гекса), а постройка в сейве —
 * `ColonyRoomState.id` (`вид_число`). Апгрейды старых сейвов лежат по id гекса, новые
 * могут лежать по id постройки — читаем оба, чтобы покупка не пропала после переезда.
 */
export const getRoomUpgrades = (room: {
  id: string;
  slotId?: string | null;
  sceneId?: number | null;
}): RoomUpgrades => {
  const state = getGameState();
  const upgrades = state.colony?.upgrades ?? {};
  const stored =
    upgrades[room.id] ??
    (room.slotId == null ? undefined : upgrades[room.slotId]) ??
    EMPTY_UPGRADES;

  if (stored.autoFeeder || room.sceneId == null) {
    return stored;
  }

  const scene = state.scenes.find((item) => item.id === room.sceneId);

  return scene?.bonuses?.autoFeeder ? { ...stored, autoFeeder: true } : stored;
};

/** Ставит секторе апгрейд: чужие апгрейды и постройки сектора не трогает. */
export const upgradeColonyRoom = (
  roomId: string,
  upgrades: RoomUpgrades,
): RoomUpgrades => {
  const state = getGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const upgraded = {
    ...(colony.upgrades?.[roomId] ?? EMPTY_UPGRADES),
    ...upgrades,
  };

  updateGameState({
    colony: {
      ...colony,
      upgrades: { ...(colony.upgrades ?? {}), [roomId]: upgraded },
    },
  });

  return upgraded;
};

/** Новый биопод для построенной на гексе сектора «Биопод» */
const createEnclosureScene = (scenes: Scene[]): Scene => ({
  ...DEFAULT_SCENE,
  id: Date.now(),
  name: `Биопод #${scenes.length + 1}`,
  description: "Биопод, построенный на карте колонии",
  capacity: INITIAL_CAPACITY,
  created_at: new Date().toISOString(),
});

/**
 * Возводит сектор на слоте карты (повторная стройка того же слота не дублируется).
 * «Биопод» попутно открывает новый биопод: возвращаем null, если биоподов уже максимум
 * (ограничение `MAX_OWNED_SCENES` проверяет и интерфейс — здесь страховка).
 */
export const buildColonyRoom = (
  slotId: string,
  kind: ColonyRoomKind,
): ColonyRoomState | null => {
  const state = getGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const previous = colony.rooms.find(
    (item) => item.id === slotId || item.slotId === slotId,
  );
  const scenes = [...state.scenes];

  let sceneId = previous?.sceneId;
  let createdEnclosure = false;

  if (kind === "aviary" && !scenes.some((scene) => scene.id === sceneId)) {
    if (scenes.length >= MAX_OWNED_SCENES) {
      return null;
    }

    const scene = createEnclosureScene(scenes);
    sceneId = scene.id;
    scenes.push(scene);
    createdEnclosure = true;
  }

  /**
   * Id сектора: базовый гекс «Биопод» сохраняет свой постоянный id (`aviary_...`), а новая
   * постройка получает `вид_уникальноеЧисло`. Исторический гекс `breeding` больше не базовый,
   * но Репродуктор на нём тоже получает постоянный `NEST_ROOM_ID` — так старые сейвы и жабы,
   * помнящие это место, не теряют гнездо. Старый сейв без `slotId` ищется по id, поэтому
   * повторная застройка того же гекса не создаёт вторую постройку.
   */
  const baseId =
    slotId === "aviary" && kind === "aviary"
      ? AVIARY_ROOM_ID
      : slotId === "breeding" && kind === "breeding"
        ? NEST_ROOM_ID
        : null;
  const roomId = previous?.id ?? baseId ?? createRoomId(kind);

  const room: ColonyRoomState = {
    id: roomId,
    slotId,
    kind,
    builtAt: new Date().toISOString(),
    sceneId,
  };

  updateGameState({
    colony: {
      ...colony,
      rooms: [
        ...colony.rooms.filter(
          (item) => item.id !== roomId && (item.slotId ?? item.id) !== slotId,
        ),
        room,
      ],
      // Гекс застраивают заново — метка сноса снимается: карта снова показывает сектор
      // (`getUnlockedRooms`), а не пустой слот
      demolished: colony.demolished?.filter(
        (id) => id !== slotId && id !== roomId,
      ),
    },
    scenes,
  });

  // «Недвижимость»: достижение закрывается именно новым биоподом, а не постройкой
  // любого сектора и не повторной застройкой того же гекса.
  if (createdEnclosure) {
    completeAchivement("buy-enclosure");
  }

  return room;
};

/**
 * Сносит сектор с гекса: платная и необратимая развилка стройки.
 *
 * Что делает функция:
 *  - убирает постройку из `ColonyState.rooms` (у базового «Биопода» постройки в сейве нет —
 *    его отсутствие помнит только `demolished`; базового Репродуктора больше нет, но старые
 *    сейвы могут помнить его снос по `breeding`);
 *  - ставит метку сноса: гекс остаётся на карте **свободным слотом**, а его фронт продолжает
 *    держать открытыми гексы, которые от него выросли (`getUnlockedRooms`);
 *  - забывает апгрейды сектора: здание уходит вместе с ними (автокормушку не вернуть),
 *    постройка на этом гексе начинается с нуля.
 *
 * Плата (`DEMOLISH_ROOM_COST`) и правила сноса — дело интерфейса: он проверяет, что это не
 * ядро и что жаб внутри нет (`components/HexMap/colony-build.ts` → `getRoomDemolishIssue`).
 * Здесь только состояние — как и у постройки, деньги списывает вызывающий экран.
 */
export const demolishColonyRoom = (roomId: string): ColonyState => {
  const state = getGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const upgrades = { ...(colony.upgrades ?? {}) };
  const target = colony.rooms.find(
    (room) =>
      room.id === roomId ||
      room.slotId === roomId ||
      // Карта зовёт исторический гекс `NEST_ROOM_ID`, а постройка в сейве — `breeding`.
      (roomId === NEST_ROOM_ID && room.slotId === "breeding") ||
      (roomId === "breeding" && room.id === NEST_ROOM_ID),
  );

  /**
   * У сектора два id (id постройки и id гекса), а у базового биопода и исторического
   * Репродуктора ещё и постоянный id: сносим по любому из них, поэтому собираем все имена
   * и чистим их разом. Иначе постройка осталась бы в `rooms`, а гекс на карте так и
   * показывал бы сектор.
   *
   * В `demolished` кладём только имена, нужные карте: её `HEX_ROOM_BY_ID` знает id гекса,
   * а базовый снос узнаёт и по постоянному id. Внутренний id постройки карте не нужен,
   * а лишняя метка тянула бы за собой старый id после перестройки того же гекса.
   */
  const demolishedIds = new Set<string>([roomId]);
  const upgradeIds = new Set<string>([roomId]);

  if (target) {
    upgradeIds.add(target.id);

    if (target.slotId) {
      demolishedIds.add(target.slotId);
      upgradeIds.add(target.slotId);
    }
  }

  if (roomId === AVIARY_ROOM_ID || roomId === "aviary") {
    upgradeIds.add(AVIARY_ROOM_ID);
    upgradeIds.add("aviary");
  }

  if (roomId === NEST_ROOM_ID || roomId === "breeding") {
    upgradeIds.add(NEST_ROOM_ID);
    upgradeIds.add("breeding");
  }

  upgradeIds.forEach((id) => {
    delete upgrades[id];
  });

  const demolished: ColonyState = {
    ...colony,
    rooms: colony.rooms.filter(
      (room) =>
        !demolishedIds.has(room.id) &&
        (room.slotId == null || !demolishedIds.has(room.slotId)),
    ),
    upgrades,
    demolished: [...new Set([...(colony.demolished ?? []), ...demolishedIds])],
  };

  updateGameState({ colony: demolished });

  return demolished;
};

/**
 * Приводит карту и биоподы в согласие: у каждой построенной на гексе сектора «Биопод»
 * должен быть свой биопод. Нужно для сейвов, где биопод строили до того, как постройка
 * начала открывать биопод (или если сохранение пришло от старой версии игры).
 * Возвращает число созданных биоподов.
 */
export const syncColonyScenes = (): number => {
  const state = getGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const scenes = [...state.scenes];
  let created = 0;

  // Игрок мог построить дополнительный биопод до появления триггера: награда
  // «Недвижимость» не должна потеряться в старом сейве. Вызов идемпотентен.
  if (colony.rooms.some((room) => room.kind === "aviary")) {
    completeAchivement("buy-enclosure");
  }

  const rooms = colony.rooms.map((room) => {
    if (
      room.kind !== "aviary" ||
      scenes.some((scene) => scene.id === room.sceneId)
    ) {
      return room;
    }

    const scene = createEnclosureScene(scenes);
    scenes.push(scene);
    created += 1;

    return { ...room, sceneId: scene.id };
  });

  if (created === 0) {
    return 0;
  }

  updateGameState({ colony: { ...colony, rooms }, scenes });

  return created;
};

/**
 * Дом жабы: биопод, который она помнит (`homeId`), — туда её возвращает «Домой».
 * null — биопода нет (сейв старой версии или биопод снесли вместе с картой).
 */
export const getToadHomeScene = (toadId: number): Scene | null => {
  const state = getGameState();
  const toad = state.toads.find((item) => item.id === toadId);
  const homeId = toad ? getToadHomeId(toad) : null;

  return state.scenes.find((scene) => scene.id === homeId) ?? null;
};

/**
 * Переезд жабы в биопод: либо она дома, либо причина отказа (её показывают уведомлением),
 * `scene` при отказе тоже отдаём — по нему видно, куда жаба не влезла.
 */
export type ToadHomeResult =
  | { ok: true; toad: Toad; scene: Scene }
  | { ok: false; reason: "no-scene" | "no-space"; scene: Scene | null };

/**
 * Общая часть переезда в биопод: проверка места и запись места (`scene_id`) вместе с домом
 * (`homeId`). Заходим сюда только из «Домой» и «Переместить» — сектор колонии при переезде
 * освобождается, потому что физически жаба идёт в биопод.
 *
 * Место проверяем по жильцам биопода и без самой жабы: она как раз переезжает. Жаба, которая
 * сидит в секторе (репродуктор, ⚡), в биоподе не числилась ни дня — если за время её работы
 * места кончились, домой она не влезет, и игроку нужно построить биопод.
 */
const settleToadInScene = (toadId: number, sceneId: number): ToadHomeResult => {
  const toad = getToadById(toadId);
  const scene =
    getGameState().scenes.find((item) => item.id === sceneId) ?? null;

  if (!scene) {
    return { ok: false, reason: "no-scene", scene: null };
  }

  const residents = getEnclosureToads(scene.id).filter(
    (item) => item.id !== toadId,
  ).length;

  if (residents >= scene.capacity) {
    return { ok: false, reason: "no-space", scene };
  }

  const [updated] = updateToadById(toadId, {
    scene_id: scene.id,
    homeId: scene.id,
  });

  return { ok: true, toad: updated ?? toad, scene };
};

export const placeToadInRoom = (toadId: number, roomId: string): Toad[] => {
  const toad = getToadById(toadId);

  return updateToadById(toadId, {
    scene_id: roomId,
    homeId: getToadHomeId(toad),
  });
};

/**
 * Возвращает жабу из сектора колонии домой — в её биопод (`homeId`).
 *
 * Дом жаба помнит всегда, но не бронирует: пока она работала в секторе, биопод мог
 * заполниться. Тогда возвращаем `no-space` — жаба остаётся в секторе, а игроку надо
 * построить биопод (или вернуть её в другой свободный биопод, «домой» из карточки жабы).
 */
export const sendToadHome = (toadId: number): ToadHomeResult => {
  const home = getToadHomeScene(toadId);

  if (!home) {
    return { ok: false, reason: "no-scene", scene: null };
  }

  return settleToadInScene(toadId, home.id);
};

/**
 * Переселяет жабу в конкретный биопод: он становится её местом и новым домом
 * (`scene_id` и `homeId`), а сектор колонии освобождается.
 * В полный биопод жаба не влезет — вернём `no-space`.
 */
export const moveToadToAviary = (
  toadId: number,
  sceneId: number,
): ToadHomeResult => settleToadInScene(toadId, sceneId);
