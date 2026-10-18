import { ReactElement } from "react";
import { ModalComponent, ModalOptions } from "../ModalContext";
import HospitalModal from "../modals/HospitalModal";
import ExpeditionModal from "../modals/ExpeditionModal";
import DissolveModal from "../modals/Lab/DissolveModal";
import ToadCollider from "../modals/Lab/ToadColliderModal";
import NestModal from "../modals/Lab/NestModal";
import PowerRoomModal from "../modals/PowerRoomModal";
import ShopMenu from "../modals/ShopMenu";
import StorageModal from "../modals/StorageModal";
import ToadListModal from "../modals/ToadListModal";
import { RoomActionId, RoomConfig } from "./rooms-config";

/**
 * Действия секторов каталога → существующие модалки: карта только выбирает, какую показать.
 *
 * Таблица намеренно полная (`Record<RoomActionId, …>`): добавил новое действие в каталог —
 * компилятор напомнит про модалку. Действия без собственной модалки помечены `null`: их
 * открывает обработчик по виду сектора (⚡, биопод, лазарет) или они живут внутри другой
 * модалки (тултип «о биоподе», кормление в списке жаб).
 */
export type RoomModalEntry = {
  render: (room: RoomConfig) => ReactElement;
  bg?: string;
} | null;

export const ROOM_MODAL_BY_ACTION: Record<RoomActionId, RoomModalEntry> = {
  // Ядро открывает «Управление колонией» — эта модалка собирает всю колонию и не
  // привязана к одному гексу, поэтому карта открывает её отдельно (см. `HexMap/index.tsx`).
  colony: null,
  // Биопод открывается по гексу: модалке нужен биопод гекса (`RoomConfig.sceneId`).
  "toad-list": null,
  "scene-info": null,
  feed: null,
  // Репродуктор, ⚡-сектор и лазарет открываются по гексу: модалкам нужен сам сектор.
  nest: { render: (room) => <NestModal roomId={room.id} room={room} /> },
  // Коллайдер открывает и смешивание, и инкубатор: это две вкладки одной модалки
  collider: { render: (room) => <ToadCollider room={room} /> },
  dissociator: { render: (room) => <DissolveModal room={room} /> },
  shop: { render: (room) => <ShopMenu room={room} /> },
  storage: { render: (room) => <StorageModal room={room} /> },
  // «Разведка»: модалке нужен её гекс — из жаб этого сектора собирают команду.
  scout: { render: (room) => <ExpeditionModal roomId={room.id} /> },
  hospital: null,
  "power-room": null,
};

/**
 * Модалка конкретного сектора или `null`, если у него нет отдельного окна.
 *
 * Вид сектора важнее его действия: у ⚡, биопода и лазарета модалке нужен сам гекс
 * (его жабы, койки, биопод), поэтому они открываются здесь, а не через общую таблицу.
 */
export const getRoomModal = (room: RoomConfig): RoomModalEntry => {
  if (room.kind === "power") {
    return { render: (target) => <PowerRoomModal room={target} /> };
  }

  if (room.kind === "breeding") {
    return {
      render: (target) => <NestModal roomId={target.id} room={target} />,
    };
  }

  if (room.kind === "aviary") {
    const sceneId = room.sceneId;

    if (sceneId == null) {
      return null;
    }

    return {
      render: (target) => (
        <ToadListModal sceneId={sceneId} room={target} />
      ),
    };
  }

  if (room.kind === "scout") {
    return { render: (target) => <ExpeditionModal roomId={target.id} /> };
  }

  if (room.kind === "hospital") {
    return { render: (target) => <HospitalModal room={target} /> };
  }

  const actionId = room.actions[0]?.id;

  return actionId ? ROOM_MODAL_BY_ACTION[actionId] : null;
};

type OpenModal = (component: ModalComponent, options?: ModalOptions) => void;

/**
 * Открыть модалку сектора. Возвращает `false`, если отдельного окна у гекса нет —
 * вызывающий сам решает, показать подсказку или промолчать.
 */
export const openRoomModal = (
  room: RoomConfig,
  openModal: OpenModal,
): boolean => {
  const modal = getRoomModal(room);

  if (!modal) {
    return false;
  }

  openModal(
    () => modal.render(room),
    modal.bg ? { bg: modal.bg } : undefined,
  );

  return true;
};
