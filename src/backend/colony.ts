import {
  ColonyRoomKind,
  ColonyRoomState,
  ColonyState,
  EMPTY_COLONY,
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

/** Помещает жабу в комнату колонии (энергокомната, гнездо, «Разведка»). */
export const placeToadInRoom = (toadId: number, roomId: string) =>
  updateToadById(toadId, { roomId });

/** Возвращает жабу из комнаты колонии обратно в вольер (`roomId` сбрасывается). */
export const releaseToadFromRoom = (toadId: number) =>
  updateToadById(toadId, { roomId: null });
