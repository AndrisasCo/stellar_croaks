import { useMemo } from "react";
import { Toad } from "../../../models/Toad";
import { getToadHomeId } from "../../../utils/toad-location";
import { Scene } from "../../../models/scene";
import { useFilters } from "../../../hooks/use-filters";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../../utils/expedition-manager";
import { useModal } from "../../ModalContext";
import { useToads } from "../../ToadContext";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import {
  HospitalAdmission,
  useHospitalAdmission,
} from "../../../hooks/use-hospital-admission";
import { Filters } from "../../shared/Filters";
import {
  ToadListCard,
  ToadListPlace,
} from "../../shared/ToadListCard";
import { ToadInfo } from "../ToadInfoModal";
import { RoomConfig } from "../../HexMap/rooms-config";

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
): ToadListPlace => {
  if (isToadBusyOnExpedition(toad)) {
    return {
      icon: "🧭",
      label: "В походе",
      hint:
        toad.status === "out" ? "за Периметром" : "добыча ждёт разбора",
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

/** Одна жаба колонии: общий вид списка, полный набор характеристик и место. */
const ColonyToadCard = ({
  toad,
  place,
  admission,
  onOpen,
  onFeed,
  onAdmit,
}: {
  toad: Toad;
  place: ToadListPlace;
  /** Куда и можно ли отправить жабу в Медотсек: кнопка «✚» рядом с HP */
  admission: HospitalAdmission;
  onOpen: () => void;
  onFeed: () => void;
  onAdmit: () => void;
}) => {
  const canFeed = !isToadBusyOnExpedition(toad);
  const canAdmit = Boolean(admission.room);

  return (
    <ToadListCard
      toad={toad}
      place={place}
      onOpen={onOpen}
      variant="full"
      showHunger
      showHp
      showEnergy
      diseaseStyle="bar"
      hungerAction={
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onFeed();
          }}
          disabled={!canFeed}
          className="rounded-none border border-green-500/30 bg-green-500/20 px-2 py-1 text-2xs font-medium leading-none text-green-300 transition-all hover:bg-green-500/30 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-700/20 disabled:text-slate-500"
          title={canFeed ? "Покормить" : EXPEDITION_TOAD_BUSY_REASON}
        >
          🍎
        </button>
      }
      healthAction={
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAdmit();
          }}
          disabled={!canAdmit}
          className="rounded-none border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-sm font-bold leading-none text-rose-300 transition-all hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-700/20 disabled:text-slate-500"
          title={admission.issue ?? "Отправить в Медотсек"}
        >
          ✚
        </button>
      }
    />
  );
};

/**
 * Вкладка «Жабы»: вся колония одним списком, без деления на биоподы.
 *
 * Список показывает и тех, кто живёт в биоподе, и тех, кто работает в секторах,
 * и тех, кто ушёл в поход. Поэтому место у каждой жабы подписано отдельно
 * (`getToadPlace`) — иначе после переноса в сектор жаба «пропадала» бы из обоих списков.
 * Над списком стоят те же фильтры и сортировки, что в меню биопода (`shared/Filters`).
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
  const { selectToad, handleFeedToads } = useToads();
  const { playCrunchShort } = useSoundEffects();
  /** Быстрая отправка на койку из списка: правила те же, что у карты */
  const { getAdmission, admit } = useHospitalAdmission();

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

  const feedToad = (toad: Toad) => {
    playCrunchShort();
    handleFeedToads([toad.id]);
  };

  /**
   * Фильтры и сортировка — те же, что в меню биопода (`shared/Filters` и
   * `hooks/use-filters`). Список колонии шире списка одного биопода, но правила
   * сортировки не должны отличаться: игрок ищет жабу одинаково в обоих местах.
   */
  const {
    filteredAndSortedToads,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    filterBy,
    setFilterBy,
  } = useFilters(toads);

  if (toads.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        В колонии пока нет жаб.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-1">
      <Filters
        toads={toads}
        setSortDirection={setSortDirection}
        setSortBy={setSortBy}
        filterBy={filterBy}
        setFilterBy={setFilterBy}
        sortBy={sortBy}
        sortDirection={sortDirection}
        addHunger
        addHealth
      />

      {filteredAndSortedToads.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Жабы не найдены. Измените фильтры.
        </p>
      ) : (
        filteredAndSortedToads.map((toad) => (
          <ColonyToadCard
            key={toad.id}
            toad={toad}
            place={getToadPlace(toad, roomsById, scenesById)}
            admission={getAdmission(toad)}
            onOpen={() => openToad(toad)}
            onFeed={() => feedToad(toad)}
            onAdmit={() => admit(toad)}
          />
        ))
      )}
    </div>
  );
};

export default ToadsTab;
