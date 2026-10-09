import { useMemo } from "react";
import { useModal } from "../ModalContext";
import { updateUser } from "../../backend";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { CURRENCY_CONFIG } from "../../utils/constants";
import { useToads } from "../ToadContext";
import { ClickButton } from "../shared/ClickButton";
import Modal from "../shared/Header";
import {
  BUILD_OPTIONS,
  BuildOption,
  canBuildOnSlot,
  canBuildRoomKind,
  getBuiltRoomsCount,
  getRoomNeighbours,
  willBePoweredAfterBuild,
} from "../HexMap/colony-build";
import { isBuiltRoom, RoomConfig } from "../HexMap/rooms-config";

/**
 * Меню застройки свободного гекса (тап по пустому слоту карты).
 *
 * Вид комнаты к гексу не привязан: любую комнату каталога можно поставить на любой
 * свободный гекс колонии. Коллайдер, магазин и диссоциатор строятся в единственном
 * экземпляре, остальные — сколько угодно раз, каждая следующая дороже. Новая комната
 * сразу обесточена: ток ей даст соседнее ядро или ⚡-комната с кормлёнными жабами.
 */
export default function BuildRoomModal({ slot }: { slot: RoomConfig }) {
  const { closeModal } = useModal();
  const { account } = useToads();
  const { colony, rooms, toadsByRoom, buildRoom } = useColony();
  const { addNotification } = useNotifications();
  const { playOk, playBeep } = useSoundEffects();

  const tokens = Math.floor(account?.tokens || 0);
  const buildable = canBuildOnSlot(slot, rooms);

  /** Соседние построенные комнаты — по ним же видно, появится ли ток. */
  const neighbourTitles = useMemo(
    () =>
      getRoomNeighbours(slot, rooms)
        .filter(isBuiltRoom)
        .map((room) => room.title || "комната"),
    [rooms, slot],
  );

  /** Карточки каталога: цена, сколько таких уже стоит и прогноз по току. */
  const options = useMemo(
    () =>
      BUILD_OPTIONS.map((option) => ({
        option,
        cost: option.getCost(colony),
        powered: willBePoweredAfterBuild(slot, option.kind, colony, toadsByRoom),
        built: getBuiltRoomsCount(colony, option.kind),
        allowed: canBuildRoomKind(colony, option.kind),
      })),
    [colony, slot, toadsByRoom],
  );

  const handleBuild = (option: BuildOption, cost: number) => {
    if (!buildable) {
      playBeep();
      addNotification({
        type: "warn",
        content: "Этот гекс уже занят: выбирайте свободный.",
      });
      return;
    }

    if (!canBuildRoomKind(colony, option.kind)) {
      playBeep();
      addNotification({
        type: "warn",
        content: `${option.title} строится в колонии только одна.`,
      });
      return;
    }

    if (tokens < cost) {
      playBeep();
      addNotification({
        type: "danger",
        content: `Не хватает ${cost - tokens} ${CURRENCY_CONFIG.tokens.icon}`,
      });
      return;
    }

    // Прогноз считаем до постройки — состояние колонии ещё старое
    const powered = willBePoweredAfterBuild(
      slot,
      option.kind,
      colony,
      toadsByRoom,
    );

    buildRoom(slot.id, option.kind);
    updateUser({ tokens: tokens - cost });
    playOk();

    addNotification({
      type: "success",
      content: powered
        ? `${option.title} построена и подключена к сети ⚡`
        : `${option.title} построена, но обесточена: нужен источник питания по соседству.`,
    });

    // Комнату построили — меню закрываем, карта перерисуется сама
    closeModal();
  };

  return (
    <Modal
      icon={<span className="text-2xl">🏗</span>}
      title="Застройка территории"
    >
      <div className="px-2 pb-2">
        <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-900/20 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-200">📐 Свободный гекс</span>
            <span className="text-amber-200">
              {CURRENCY_CONFIG.tokens.icon} {tokens}
            </span>
          </div>
          <p className="text-2xs leading-snug text-amber-100">
            На любом свободном гексе — любая комната. Чтобы комната заработала, по
            соседству нужен источник питания: ядро или энергокомната ⚡.
          </p>
          {neighbourTitles.length > 0 && (
            <p className="mt-1 text-2xs text-emerald-300">
              Соседи: {neighbourTitles.join(", ")}
            </p>
          )}
          {!buildable && (
            <p className="mt-1 text-2xs text-rose-300">
              Этот гекс уже занят — застроить его нельзя.
            </p>
          )}
        </div>

        <div className="space-y-2">
          {options.map(({ option, cost, powered, built, allowed }) => {
            const affordable = tokens >= cost;
            const blocked = !buildable || !allowed || !affordable;

            return (
              <div
                key={option.kind}
                className="rounded-xl border border-gray-600/40 bg-color-second p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{option.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-semibold text-amber-100">
                      {option.title}
                      {option.unique && (
                        <span className="rounded bg-amber-500/20 px-1 text-3xs font-normal text-amber-200">
                          единственная
                        </span>
                      )}
                    </div>
                    <div className="text-2xs leading-snug text-gray-400">
                      {option.description}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-sm ${
                      affordable ? "text-amber-200" : "text-rose-300"
                    }`}
                  >
                    {cost} {CURRENCY_CONFIG.tokens.icon}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-2xs text-gray-400">
                    {powered
                      ? "После постройки: под током ⚡"
                      : "После постройки: обесточена 🔌"}
                  </span>
                  <span className="text-2xs text-gray-500">
                    {built > 0 ? `в колонии: ${built}` : "в колонии нет"}
                  </span>
                  <ClickButton
                    onClick={() => handleBuild(option, cost)}
                    disabled={blocked}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                      blocked
                        ? "cursor-not-allowed bg-gray-700/60 text-gray-400"
                        : "bg-amber-600 text-white hover:bg-amber-500 active:scale-95"
                    }`}
                  >
                    {allowed ? "Построить" : "Уже есть"}
                  </ClickButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

