import { useMemo } from "react";
import { Scene } from "../../../models/scene";
import { Toad } from "../../../models/Toad";
import { useModal } from "../../ModalContext";
import { useNotifications } from "../../../hooks/use-notification";
import { useToads } from "../../ToadContext";
import { ClickButton } from "../../shared/ClickButton";
import {
  isRoomOpen,
  RoomConfig,
} from "../../HexMap/rooms-config";
import { openRoomModal } from "../../HexMap/open-room-modal";
import { PowerGrid, POWER_ROOM_TOAD_SLOTS } from "../../HexMap/colony-power";

/** Что написать про жаб в секторе: у каждого сектора свой смысл и своя вместимость. */
const getOccupantsLabel = (
  room: RoomConfig,
  count: number,
  scene: Scene | undefined,
): string => {
  if (room.kind === "power") {
    return `🐸 ${count}/${POWER_ROOM_TOAD_SLOTS} жаб-энергетиков`;
  }

  if (room.kind === "aviary") {
    return `🐸 ${count}/${scene?.capacity ?? 0} жаб`;
  }

  if (room.kind === "breeding") {
    return `🐸 ${count}/2 в репродукторе`;
  }

  if (room.kind === "hospital") {
    return `🩹 ${count} на койках`;
  }

  if (room.kind === "scout") {
    return `🐸 ${count} в секторе`;
  }

  return room.subtitle;
};

/** Короткий статус энергосети: у ⚡ — сколько соседей она питает, у остальных — есть ли ток. */
const getPowerLabel = (
  room: RoomConfig,
  powerGrid: PowerGrid,
): { text: string; className: string } => {
  const powered = powerGrid.powered[room.id] ?? false;

  if (room.kind === "power") {
    const usage = powerGrid.usage[room.id] ?? 0;

    if (!powered) {
      return { text: "⚠️ Нет жаб-энергетиков", className: "text-rose-300" };
    }

    return {
      text: `⚡ Питает соседей: ${usage}`,
      className: "text-lime-300",
    };
  }

  return powered
    ? { text: "⚡ Есть ток", className: "text-lime-300" }
    : { text: "⚠️ Без тока", className: "text-rose-300" };
};

/** Один сектор: иконка, имя, жабы, питание и переход в его модалку. */
const RoomRow = ({
  room,
  powerGrid,
  toads,
  scene,
  onOpen,
}: {
  room: RoomConfig;
  powerGrid: PowerGrid;
  toads: Toad[];
  scene: Scene | undefined;
  onOpen: () => void;
}) => {
  const power = getPowerLabel(room, powerGrid);

  return (
    <ClickButton
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-800/60 p-2.5 text-left transition-colors hover:border-cyan-300/40 hover:bg-slate-800"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 text-xl">
        {room.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {room.name}
          </span>
          <span className={`shrink-0 text-2xs ${power.className}`}>
            {power.text}
          </span>
        </div>
        <p className="mt-0.5 truncate text-2xs text-slate-400">
          {room.subtitle}
        </p>
        <p className="mt-1 truncate text-2xs text-slate-300">
          {getOccupantsLabel(room, toads.length, scene)}
          {scene?.name && room.kind === "aviary" && (
            <span className="text-slate-500"> · {scene.name}</span>
          )}
        </p>
      </div>

      <span className="shrink-0 text-lg text-slate-500">›</span>
    </ClickButton>
  );
};

/**
 * Вкладка «Секторы»: быстрый доступ ко всем построенным секторам колонии.
 *
 * Это не карта и не застройка: здесь только то, что уже стоит, — тап открывает ту же
 * модалку сектора, что и тап по его гексу (`openRoomModal`). Ядро в список не входит:
 * его сводка и кормление уже наверху модалки.
 */
const RoomsTab = ({
  rooms,
  powerGrid,
  toadsByRoom,
}: {
  rooms: RoomConfig[];
  powerGrid: PowerGrid;
  toadsByRoom: Record<string, Toad[]>;
}) => {
  const { openModal } = useModal();
  const { addNotification } = useNotifications();
  const { ownedScenes } = useToads();

  const builtRooms = useMemo(
    () => rooms.filter((room) => room.kind !== "core" && isRoomOpen(room)),
    [rooms],
  );

  const scenesById = useMemo(
    () => new Map(ownedScenes.map((scene) => [scene.id, scene])),
    [ownedScenes],
  );

  const openRoom = (room: RoomConfig) => {
    if (openRoomModal(room, openModal)) {
      return;
    }

    addNotification({
      type: "info",
      content: "У этого сектора пока нет отдельного окна.",
      timeout: 3000,
    });
  };

  if (builtRooms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        В колонии пока нет построенных секторов.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-1">
      {builtRooms.map((room) => (
        <RoomRow
          key={room.id}
          room={room}
          powerGrid={powerGrid}
          toads={toadsByRoom[room.id] ?? []}
          scene={room.sceneId != null ? scenesById.get(room.sceneId) : undefined}
          onOpen={() => openRoom(room)}
        />
      ))}
    </div>
  );
};

export default RoomsTab;
