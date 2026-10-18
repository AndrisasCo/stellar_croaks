import { useMemo } from "react";
import {
  getGeneticFaultConfig,
  getPersonalityLabel,
  getRarityConfig,
  Toad,
} from "../../../models/Toad";
import { getToadDisease, isToadSick } from "../../../models/disease";
import { getToadHomeId } from "../../../utils/toad-location";
import { Scene } from "../../../models/scene";
import { useModal } from "../../ModalContext";
import { useToads } from "../../ToadContext";
import { ClickButton } from "../../shared/ClickButton";
import { ToadAvatar } from "../../shared/ToadAvatar";
import { ToadGender } from "../../shared/ToadGender";
import { ToadInfo } from "../ToadInfoModal";
import { RoomConfig } from "../../HexMap/rooms-config";

/** Где жаба сейчас: поход, сектор колонии или биопод. */
type ToadPlace = {
  icon: string;
  label: string;
  hint?: string;
  className: string;
};

/**
 * Место жабы для списка колонии.
 *
 * Порядок тот же, что у правил места (`utils/toad-location.ts`): поход важнее всего —
 * затем биопод (`scene_id`), затем дом (`homeId`) для старых сейвов.
 */
const getToadPlace = (
  toad: Toad,
  roomsById: Map<string, RoomConfig>,
  scenesById: Map<number, Scene>,
): ToadPlace => {
  if (toad.status === "out") {
    return {
      icon: "🧭",
      label: "В походе",
      hint: "за Периметром",
      className: "text-amber-300",
    };
  }

  if (typeof toad.scene_id === "string") {
    const room =
      roomsById.get(toad.scene_id) ??
      [...roomsById.values()].find((item) => item.slotId === toad.scene_id);

    if (room) {
      return {
        icon: room.icon,
        label: room.name,
        hint: room.subtitle,
        className: "text-cyan-300",
      };
    }

    return {
      icon: "🏠",
      label: "Сектор колонии",
      className: "text-cyan-300",
    };
  }

  const scene =
    typeof toad.scene_id === "number" ? scenesById.get(toad.scene_id) : null;

  if (scene) {
    return {
      icon: "🏡",
      label: scene.name ?? `Биопод #${scene.id}`,
      hint: "биопод",
      className: "text-emerald-300",
    };
  }

  const homeId = getToadHomeId(toad);
  const home = homeId != null ? scenesById.get(homeId) : null;

  if (home) {
    return {
      icon: "🏡",
      label: home.name ?? `Биопод #${home.id}`,
      hint: "дом",
      className: "text-emerald-300",
    };
  }

  return {
    icon: "❔",
    label: "Без места",
    className: "text-slate-400",
  };
};

const getHungerColor = (hunger: number): string => {
  if (hunger >= 80) return "bg-green-500";
  if (hunger >= 50) return "bg-yellow-500";
  if (hunger >= 20) return "bg-orange-500";
  return "bg-red-500";
};

const getStageLabel = (stage: string): string =>
  stage === "adult" ? "Взрослая" : stage === "toadpole" ? "Головастик" : stage;

/** Одна жаба колонии: все её данные, характеристики и текущее место. */
const ColonyToadCard = ({
  toad,
  place,
  onOpen,
}: {
  toad: Toad;
  place: ToadPlace;
  onOpen: () => void;
}) => {
  const rarity = getRarityConfig(toad.genes.rarity);
  const fault = getGeneticFaultConfig(toad.state?.genetic_fault);
  const hunger = Math.max(0, Math.min(100, toad.state.hunger ?? 0));
  const disease = isToadSick(toad) ? getToadDisease(toad) : null;
  const hp = toad.hp;
  const maxHp = toad.maxHp ?? 100;

  return (
    <ClickButton
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-slate-800/60 p-2.5 text-left transition-colors hover:border-cyan-300/40 hover:bg-slate-800"
    >
      <div className="flex items-start gap-2.5">
        <ToadAvatar toad={toad} size={10} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <ToadGender gender={toad.sex} />
            <span className="truncate text-sm font-semibold text-white">
              {toad.name ?? "Безымянная"}
            </span>
            {toad.pregnancy?.isPregnant && (
              <span className="shrink-0 text-2xs text-pink-300" title="Беременна">
                🤰
              </span>
            )}
            {toad.mating && (
              <span
                className="shrink-0 text-2xs text-pink-300"
                title="Ухаживание в репродукторе"
              >
                🫧
              </span>
            )}
          </div>

          <div className="mt-1 flex min-w-0 items-center gap-1 text-2xs">
            <span className="shrink-0">{place.icon}</span>
            <span className={`truncate font-medium ${place.className}`}>
              {place.label}
            </span>
            {place.hint && (
              <span className="truncate text-slate-500">· {place.hint}</span>
            )}
          </div>
        </div>

        <span className="shrink-0 rounded-md border border-white/10 bg-slate-950/40 px-1.5 py-0.5 text-3xs text-slate-300">
          {getStageLabel(toad.stage)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-3xs text-slate-400">
        <span className={`flex items-center gap-1 ${rarity.color}`}>
          {rarity.icon} {rarity.label} · {toad.genes.rarity.toFixed(1)}
        </span>
        <span>Поколение {toad.generation}</span>
        <span className={`flex items-center gap-1 ${fault.color}`}>
          {fault.icon} Поломка {toad.state?.genetic_fault ?? 0}%
        </span>
        <span className="truncate" title="Характер">
          Характер: {getPersonalityLabel(toad.genes.personality)}
        </span>
        <span>
          Вес {toad.genes.weight.toFixed(1)} · Скорость{" "}
          {toad.genes.speed.toFixed(1)}
        </span>
        <span>Плодовитость {toad.genes.fertility.toFixed(1)}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-3xs text-slate-400">Сытость</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full ${getHungerColor(hunger)}`}
            style={{ width: `${hunger}%` }}
          />
        </div>
        <span className="w-8 text-right text-2xs tabular-nums text-slate-300">
          {Math.round(hunger)}%
        </span>
      </div>

      {(hp !== undefined || toad.energy !== undefined || disease) && (
        <div className="flex flex-wrap items-center gap-2 text-3xs">
          {hp !== undefined && (
            <span className="rounded border border-rose-400/20 bg-rose-500/10 px-1.5 py-0.5 text-rose-200">
              ❤️ {Math.round(hp)}/{maxHp}
            </span>
          )}
          {toad.energy !== undefined && (
            <span className="rounded border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-200">
              ⚡ {Math.round(toad.energy)}
            </span>
          )}
          {disease && (
            <span className="rounded border border-orange-400/20 bg-orange-500/10 px-1.5 py-0.5 text-orange-200">
              {disease.icon} {disease.name}
            </span>
          )}
        </div>
      )}
    </ClickButton>
  );
};

/**
 * Вкладка «Жабы»: вся колония одним списком, без деления на биоподы.
 *
 * Список показывает и тех, кто живёт в биоподе, и тех, кто работает в секторах,
 * и тех, кто ушёл в поход. Поэтому место у каждой жабы подписано отдельно
 * (`getToadPlace`) — иначе после переноса в сектор жаба «пропадала» бы из обоих списков.
 */
const ToadsTab = ({
  toads,
  rooms,
  scenes,
}: {
  toads: Toad[];
  rooms: RoomConfig[];
  scenes: Scene[];
}) => {
  const { openModal } = useModal();
  const { selectToad } = useToads();

  const roomsById = useMemo(
    () => new Map(rooms.map((room) => [room.id, room])),
    [rooms],
  );
  const scenesById = useMemo(
    () => new Map(scenes.map((scene) => [scene.id, scene])),
    [scenes],
  );

  const openToad = (toad: Toad) => {
    selectToad(toad.id);
    openModal(() => <ToadInfo />);
  };

  if (toads.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        В колонии пока нет жаб.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-1">
      {toads.map((toad) => (
        <ColonyToadCard
          key={toad.id}
          toad={toad}
          place={getToadPlace(toad, roomsById, scenesById)}
          onOpen={() => openToad(toad)}
        />
      ))}
    </div>
  );
};

export default ToadsTab;
