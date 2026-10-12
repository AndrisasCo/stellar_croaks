import {
  ColonyRoomKind,
  ColonyRoomState,
  ColonyState,
  EMPTY_COLONY,
  EMPTY_UPGRADES,
  RoomUpgrades,
} from "../models/colony";
import { DEFAULT_SCENE, INITIAL_CAPACITY, Scene } from "../models/scene";
import { MAX_OWNED_SCENES } from "../utils/constants";
import { getGameState, updateGameState } from "./localStorage";
import { updateToadById } from "./index";

/**
 * Постройки колонии: гексагональная карта живёт в состоянии игры,
 * поэтому все действия идут через `updateGameState` — экран карты
 * перерисуется сам по событию `gameStateUpdated`.
 *
 * Вольеры больше не покупаются в магазине: каждый построенный на гексе «Вольер»
 * открывает новый вольер (`Scene`) с `INITIAL_CAPACITY` мест, поэтому стройка
 * обновляет сразу и колонию, и список вольеров.
 */

/** Построенные комнаты колонии (старые сейвы поля не знают — отдаём пустую колонию). */
export const getColonyState = (): ColonyState =>
  getGameState().colony ?? EMPTY_COLONY;

export const saveColonyState = (colony: ColonyState): ColonyState => {
  updateGameState({ colony });

  return colony;
};

/**
 * Апгрейды комнаты: они лежат в `ColonyState.upgrades` по id гекса, поэтому комнату
 * передаём целиком — гексу-вольеру апгрейд может отдать ещё и его вольер.
 *
 * Легаси: раньше автокормушку покупали «вольеру», и она жила в `Scene.bonuses.autoFeeder`.
 * Покупка теперь всегда пишет в `ColonyState.upgrades`, а старый бонус вольера читается
 * здесь как апгрейд его гекса — апгрейд, купленный до переезда, продолжает работать.
 * Связь «гекс ↔ вольер» знает карта (`RoomConfig.sceneId`), поэтому `sceneId` приходит
 * параметром, а не ищется здесь.
 */
export const getRoomUpgrades = (room: {
  id: string;
  sceneId?: number;
}): RoomUpgrades => {
  const state = getGameState();
  const stored = state.colony?.upgrades?.[room.id] ?? EMPTY_UPGRADES;

  if (stored.autoFeeder || room.sceneId === undefined) {
    return stored;
  }

  const scene = state.scenes.find((item) => item.id === room.sceneId);

  return scene?.bonuses?.autoFeeder ? { ...stored, autoFeeder: true } : stored;
};

/** Ставит комнате апгрейд: чужие апгрейды и постройки комнаты не трогает. */
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

/** Новый вольер для построенной на гексе комнаты «Вольер» */
const createEnclosureScene = (scenes: Scene[]): Scene => ({
  ...DEFAULT_SCENE,
  id: Date.now(),
  name: `Вольер #${scenes.length + 1}`,
  description: "Вольер, построенный на карте колонии",
  capacity: INITIAL_CAPACITY,
  created_at: new Date().toISOString(),
});

/**
 * Возводит комнату на слоте карты (повторная стройка того же слота не дублируется).
 * «Вольер» попутно открывает новый вольер: возвращаем null, если вольеров уже максимум
 * (ограничение `MAX_OWNED_SCENES` проверяет и интерфейс — здесь страховка).
 */
export const buildColonyRoom = (
  slotId: string,
  kind: ColonyRoomKind,
): ColonyRoomState | null => {
  const state = getGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const previous = colony.rooms.find((item) => item.id === slotId);
  const scenes = [...state.scenes];

  let sceneId = previous?.sceneId;

  if (kind === "aviary" && !scenes.some((scene) => scene.id === sceneId)) {
    if (scenes.length >= MAX_OWNED_SCENES) {
      return null;
    }

    const scene = createEnclosureScene(scenes);
    sceneId = scene.id;
    scenes.push(scene);
  }

  const room: ColonyRoomState = {
    id: slotId,
    kind,
    builtAt: new Date().toISOString(),
    sceneId,
  };

  updateGameState({
    colony: {
      rooms: [...colony.rooms.filter((item) => item.id !== slotId), room],
    },
    scenes,
  });

  return room;
};

/**
 * Приводит карту и вольеры в согласие: у каждой построенной на гексе комнаты «Вольер»
 * должен быть свой вольер. Нужно для сейвов, где вольер строили до того, как постройка
 * начала открывать вольер (или если сохранение пришло от старой версии игры).
 * Возвращает число созданных вольеров.
 */
export const syncColonyScenes = (): number => {
  const state = getGameState();
  const colony = state.colony ?? EMPTY_COLONY;
  const scenes = [...state.scenes];
  let created = 0;

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

  updateGameState({ colony: { rooms }, scenes });

  return created;
};

/**
 * Помещает жабу в комнату колонии (энергокомната, гнездо, «Разведка»).
 *
 * `scene_id` при этом не трогаем: это дом жабы (её вольер), по нему гекс вольера
 * находит своих жильцов, когда жаба вернётся из комнаты или из похода.
 */
export const placeToadInRoom = (toadId: number, roomId: string) =>
  updateToadById(toadId, { roomId });

/**
 * Возвращает жабу из комнаты колонии обратно в вольер (`roomId` сбрасывается).
 * Место определит сам вольер жабы — её `scene_id`.
 */
export const releaseToadFromRoom = (toadId: number) =>
  updateToadById(toadId, { roomId: null });

/**
 * Переселяет жабу в конкретный вольер: `scene_id` становится её новым домом,
 * `roomId` сбрасывается — физически жаба идёт в вольер, а не остаётся в комнате.
 * Так гекс вольера, на который жабу перенесли, показывает её у себя.
 */
export const moveToadToAviary = (toadId: number, sceneId: number) =>
  updateToadById(toadId, { roomId: null, scene_id: sceneId });
