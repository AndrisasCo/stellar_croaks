import { Expedition } from "../../models/expedition";
import { Scene } from "../../models/scene";
import { Toad } from "../../models/Toad";
import { PowerGrid } from "./colony-power";
import { RoomConfig } from "./rooms-config";
import {
  canMoveToadToRoom,
  getToadMoveIssue,
  ToadMoveCheck,
} from "./toad-move-rules";

/**
 * Куда жабу можно отправить из карточки («🏠 Переместить»).
 *
 * Карта разрешает ставить жабу не только в биопод, но и в секторы, которые её принимают:
 * Медотсек, КОНТУР, энергосектор и репродуктор. Меню карточки должно показывать те же
 * варианты, поэтому список собирается здесь, а проверки берутся из `toad-move-rules`,
 * что и при переносе жабы по карте. У каждой строки есть результат проверки: недоступные
 * места не прячем, а показываем с причиной — иначе игрок не поймёт, почему лазарет
 * «пропал» (нет тока, нет мест, головастик и т.п.).
 */
export type ToadDestinationKind =
  | "aviary"
  | "hospital"
  | "scout"
  | "power"
  | "breeding";

export interface ToadDestinationGroupInfo {
  kind: ToadDestinationKind;
  label: string;
  icon: string;
}

/**
 * Порядок групп в меню: сначала биоподы (дом жабы), затем секторы в порядке,
 * в котором игрок обычно ищет место — лечение, разведка, энергия, размножение.
 */
export const AVIARY_DESTINATION_GROUP: ToadDestinationGroupInfo = {
  kind: "aviary",
  label: "Биоподы",
  icon: "🏠",
};

export const TOAD_DESTINATION_GROUPS: readonly ToadDestinationGroupInfo[] = [
  AVIARY_DESTINATION_GROUP,
  { kind: "hospital", label: "Медотсеки", icon: "🩹" },
  { kind: "scout", label: "КОНТУРы", icon: "🧭" },
  { kind: "power", label: "Энергосекторы", icon: "⚡" },
  { kind: "breeding", label: "Репродукторы", icon: "🥚" },
];

export interface ToadDestination {
  /** Ключ строки списка: `scene-*` для биопода, `room-*` для сектора. */
  key: string;
  kind: ToadDestinationKind;
  name: string;
  icon: string;
  /** id биопода для `moveToadToAviary` (у сектора — null). */
  sceneId: number | null;
  /** id гекса для `placeToadInRoom` (у биопода — null). */
  roomId: string | null;
  /** Подпись под именем, когда место доступно: вместимость или роль сектора. */
  hint: string;
  check: ToadMoveCheck;
}

export interface ToadDestinationGroup {
  kind: ToadDestinationKind;
  label: string;
  icon: string;
  destinations: ToadDestination[];
}

export interface ToadDestinationInput {
  toad: Toad;
  /** Биоподы колонии. */
  scenes: Scene[];
  /** Секторы карты с именами (`resolveColonyRooms`). */
  rooms: RoomConfig[];
  /** Все жабы колонии — для подсчёта свободных мест в биоподах. */
  toads: Toad[];
  /** Жабы по id гекса (`useColony().toadsByRoom`). */
  toadsByRoom: Record<string, Toad[]>;
  powerGrid: PowerGrid;
  /** Жаба занята походом, даже если статус уже снят (ждёт разбора добычи). */
  onExpedition?: boolean;
  /** Список походов, если он уже под рукой: иначе правило прочитает сейв. */
  expeditions?: Expedition[];
}

/** Жаба сейчас стоит в этом секторе карты (id может быть и id гекса, и id сектора). */
const isCurrentRoom = (toad: Toad, room: RoomConfig): boolean =>
  typeof toad.scene_id === "string" &&
  (toad.scene_id === room.id || toad.scene_id === room.slotId);

/**
 * Собирает меню «Переместить»: все биоподы, кроме текущего, и все секторы,
 * которые принимают жаб. Группы возвращаются всегда — пустые отсеивает UI.
 */
export const getToadDestinationGroups = ({
  toad,
  scenes,
  rooms,
  toads,
  toadsByRoom,
  powerGrid,
  onExpedition,
  expeditions,
}: ToadDestinationInput): ToadDestinationGroup[] => {
  const currentSceneId =
    typeof toad.scene_id === "number" ? toad.scene_id : null;
  const moveIssue = getToadMoveIssue(toad, { onExpedition, expeditions });

  const aviaryDestinations: ToadDestination[] = scenes
    .filter((scene) => scene.id !== currentSceneId)
    .map((scene) => {
      const name = scene.name || `Биопод ${scene.id}`;
      const residents = toads.filter(
        (item) => item.scene_id === scene.id && item.id !== toad.id,
      ).length;
      const hasSpace = residents < scene.capacity;
      const check: ToadMoveCheck = moveIssue
        ? { ok: false, reason: moveIssue }
        : hasSpace
          ? { ok: true }
          : {
              ok: false,
              reason: `В биоподе «${name}» нет свободных мест (${residents}/${scene.capacity}).`,
            };

      return {
        key: `scene-${scene.id}`,
        kind: "aviary" as const,
        name,
        icon: "🏠",
        sceneId: scene.id,
        roomId: null,
        hint: `${residents}/${scene.capacity} мест`,
        check,
      };
    });

  const roomGroups: ToadDestinationGroup[] = TOAD_DESTINATION_GROUPS.filter(
    (group) => group.kind !== "aviary",
  ).map((group) => ({
    kind: group.kind,
    label: group.label,
    icon: group.icon,
    destinations: rooms
      .filter((room) => room.kind === group.kind && !isCurrentRoom(toad, room))
      .map((room) => {
        const check = canMoveToadToRoom(toad, room, {
          roomToads: (toadsByRoom[room.id] ?? []).filter(
            (item) => item.id !== toad.id,
          ),
          // Биоподы проверяются выше по вместимости сцены, здесь счётчик не нужен.
          aviaryCount: 0,
          aviaryCapacity: 0,
          rooms,
          powerGrid,
          onExpedition,
          expeditions,
        });

        return {
          key: `room-${room.id}`,
          kind: group.kind,
          name: room.name,
          icon: room.icon,
          sceneId: null,
          roomId: room.id,
          hint: room.subtitle,
          check,
        };
      }),
  }));

  return [
    {
      ...AVIARY_DESTINATION_GROUP,
      destinations: aviaryDestinations,
    },
    ...roomGroups,
  ];
};
