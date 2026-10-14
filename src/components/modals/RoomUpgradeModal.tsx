import { useMemo, useState } from "react";
import { updateUser } from "../../backend";
import { getRoomUpgrades, upgradeColonyRoom } from "../../backend/colony";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { CURRENCY_CONFIG, DEMOLISH_ROOM_COST } from "../../utils/constants";
import {
  hasUpgrade,
  ROOM_UPGRADES,
  RoomUpgradeOption,
} from "../../utils/room-upgrades";
import { RoomUpgrades } from "../../models/colony";
import { processAutoFeeders } from "../../utils/auto-feeder";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import { ClickButton } from "../shared/ClickButton";
import Modal from "../shared/Header";
import RoomDemolishModal from "./RoomDemolishModal";
import { isBuiltRoom, isToadRoom, RoomConfig } from "../HexMap/rooms-config";

/**
 * «Сектора колонии» — модалка ядра карты (раньше ядро открывало бургер-меню).
 *
 * Здесь одно место, где сектором распоряжаются: у жилого сектора можно купить улучшение,
 * а любую (кроме ядра) — снести. Сначала сектор, потом действие: список показывает всё
 * построенное, а улучшения есть только у жилых — тех, где живут жабы (`isToadRoom`: биопод,
 * ⚡-энергосектор, репродуктор, лазарет, «Разведка»). Пустые гексы в списке не мешаются.
 *
 * Апгрейд у сектора один — автокормушка (`utils/room-upgrades.ts`): пока на складе есть корм,
 * она кормит жаб сектора сама, когда голод падает до `AUTO_FEED_HUNGER` (20 % — на этом же
 * голоде жаба переходит на голодный минимум выработки, см. §3 дизайна) и списывает корм со
 * склада (`utils/auto-feeder.ts`). Жильцов сектора показывает карта: у биопода это жабы его
 * `scene_id`, у энергосектора — те, кто в ней работает. Покупка кормит голодных жаб сектора
 * сразу, не дожидаясь тика голода.
 *
 * Снос — платный и необратимый, поэтому идёт через отдельное подтверждение
 * (`RoomDemolishModal`), а правила сноса живут в `colony-build.ts` (`getRoomDemolishIssue`).
 */
export default function RoomUpgradeModal() {
  const { account, ownedScenes } = useToads();
  const { colony, rooms, toadsByRoom } = useColony();
  const { openModal } = useModal();
  const { addNotification } = useNotifications();
  const { playOk, playBeep, playClick } = useSoundEffects();

  /** Выбранный сектор: список показываем, пока сектор не выбрана */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tokens = Math.floor(account?.tokens || 0);
  /** Сектора, которыми можно распорядиться: всё построенное, кроме ядра (ядро — сама модалка) */
  const builtRooms = useMemo(
    () => rooms.filter((room) => isBuiltRoom(room) && room.kind !== "core"),
    [rooms],
  );
  const selected = builtRooms.find((room) => room.id === selectedId) ?? null;

  /**
   * Апгрейды секторов для списка. Считаются от состояния колонии (`colony`), а не от глобального
   * сейва: покупка обновляет `ColonyState.upgrades`, и карточки перерисовываются сами.
   */
  const upgradesByRoom = useMemo(
    () =>
      rooms.reduce<Record<string, RoomUpgrades>>((acc, room) => {
        acc[room.id] = getRoomUpgrades(room);

        return acc;
      }, {}),
    [colony, rooms],
  );

  /** Имя биопода гекса: у «Био Пода» и построек оно своё (`Scene.name`) */
  const getSceneName = (room: RoomConfig) =>
    room.sceneId === undefined
      ? null
      : ownedScenes.find((scene) => scene.id === room.sceneId)?.name ?? null;

  const handleBuy = (option: RoomUpgradeOption) => {
    if (!selected) {
      return;
    }

    // Улучшений у нежилого сектора нет: список рисует их только жилым, это страховка
    if (!isToadRoom(selected)) {
      playBeep();
      return;
    }

    if (hasUpgrade(upgradesByRoom[selected.id] ?? {}, option.upgrade)) {
      playBeep();
      return;
    }

    if (tokens < option.cost) {
      playBeep();
      addNotification({
        type: "danger",
        content: `Не хватает ${option.cost - tokens} ${
          CURRENCY_CONFIG.tokens.icon
        }`,
      });
      return;
    }

    upgradeColonyRoom(selected.id, option.upgrade);
    updateUser({ tokens: tokens - option.cost });

    // Кормушка берётся за дело сразу: голодных жаб сектора она кормит, не дожидаясь тика голода
    const { fed } = processAutoFeeders(rooms, toadsByRoom);

    playOk();
    addNotification({
      type: "success",
      content: `${option.icon} ${option.title}: сектор «${selected.title}» улучшена${
        fed > 0
          ? ` — кормушка сразу накормила жаб: ${fed}`
          : " — её жабы кормятся со склада сами"
      }.`,
    });
  };

  return (
    <Modal icon={<span className="text-2xl">🔧</span>} title="Сектора колонии">
      <div className="px-2 pb-2">
        <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-900/20 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-200">
              {selected ? "Выбранный сектор" : "Построенное в колонии"}
            </span>
            <span className="text-amber-200">
              {CURRENCY_CONFIG.tokens.icon} {tokens}
            </span>
          </div>
          <p className="text-2xs leading-snug text-amber-100">
            Улучшение одно — автокормушка, и ставится оно только жилом секторе: биоподу,
            ⚡-энергосекторе, репродуктору, лазарету, «Разведке». Снести можно любой сектор кроме
            ядра — снос платный, гекс остаётся свободным, а жаб надо вынести заранее.
          </p>
        </div>

        {!selected && (
          <div className="space-y-2">
            {builtRooms.length === 0 && (
              <p className="rounded-xl border border-gray-600/40 bg-color-second p-2 text-2xs leading-snug text-gray-400">
                Построенного нет: базовое ядро не в счёт. Застройте свободный гекс 🏗 —
                у жилого сектора потом можно поставить автокормушку, а ненужную — снести.
              </p>
            )}

            {builtRooms.map((room) => {
              const upgrades = upgradesByRoom[room.id] ?? {};
              const residents = toadsByRoom[room.id]?.length ?? 0;
              const upgradable = isToadRoom(room);
              const installed = upgradable
                ? ROOM_UPGRADES.filter((option) =>
                    hasUpgrade(upgrades, option.upgrade)
                  ).length
                : 0;
              const sceneName = getSceneName(room);

              return (
                <ClickButton
                  key={room.id}
                  onClick={() => {
                    playClick();
                    setSelectedId(room.id);
                  }}
                  className="w-full rounded-xl border border-gray-600/40 bg-color-second p-2 text-left transition-all hover:border-amber-400/60 active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{room.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-amber-100">
                        {room.title}
                        {sceneName && (
                          <span className="text-2xs font-normal text-gray-400">
                            «{sceneName}»
                          </span>
                        )}
                        {installed > 0 && (
                          <span className="rounded bg-emerald-500/20 px-1 text-3xs font-normal text-emerald-200">
                            🍎 кормушка
                          </span>
                        )}
                      </div>
                      <div className="text-2xs leading-snug text-gray-400">
                        {room.subtitle} · жаб в секторе: {residents}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {upgradable ? `${installed}/${ROOM_UPGRADES.length}` : "—"}
                    </span>
                  </div>
                </ClickButton>
              );
            })}
          </div>
        )}
        {selected && (
          <div>
            <ClickButton
              onClick={() => {
                playClick();
                setSelectedId(null);
              }}
              className="mb-2 rounded-lg border border-gray-600/40 bg-color-second px-2 py-1 text-2xs text-gray-300 active:scale-95"
            >
              ← Другой сектор
            </ClickButton>

            <div className="mb-2 rounded-xl border border-gray-600/40 bg-color-second p-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selected.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-amber-100">
                    {selected.title}
                    {getSceneName(selected) && (
                      <span className="text-2xs font-normal text-gray-400">
                        «{getSceneName(selected)}»
                      </span>
                    )}
                  </div>
                  <div className="text-2xs leading-snug text-gray-400">
                    {selected.subtitle} · жаб в секторе:{" "}
                    {toadsByRoom[selected.id]?.length ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {!isToadRoom(selected) && (
                <p className="rounded-xl border border-gray-600/40 bg-color-second p-2 text-2xs leading-snug text-gray-400">
                  У этого сектора улучшений нет: автокормушку ставят только жилом секторе —
                  той, где живут жабы. Снести сектор можно внизу.
                </p>
              )}

              {isToadRoom(selected) && ROOM_UPGRADES.map((option) => {
                const installed = hasUpgrade(
                  upgradesByRoom[selected.id] ?? {},
                  option.upgrade
                );
                const affordable = tokens >= option.cost;

                return (
                  <div
                    key={option.title}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{option.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-amber-100">
                          {option.title}
                        </div>
                        <div className="text-2xs leading-snug text-amber-100/80">
                          {option.description}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`text-sm ${
                          installed || affordable
                            ? "text-amber-200"
                            : "text-rose-300"
                        }`}
                      >
                        {option.cost} {CURRENCY_CONFIG.tokens.icon}
                      </span>
                      <ClickButton
                        onClick={() => handleBuy(option)}
                        disabled={installed}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                          installed
                            ? "cursor-not-allowed bg-emerald-700/40 text-emerald-200"
                            : affordable
                              ? "bg-amber-600 text-white hover:bg-amber-500 active:scale-95"
                              : "cursor-not-allowed bg-gray-700/60 text-gray-400"
                        }`}
                      >
                        {installed ? "Установлено" : "Установить"}
                      </ClickButton>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Снос: платный и необратимый шаг, поэтому подтверждение — отдельной модалкой */}
            <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-900/20 p-2">
              <div className="flex items-start gap-2">
                <span className="text-2xl">🗑</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-rose-200">Снос сектора</div>
                  <div className="text-2xs leading-snug text-rose-100/80">
                    Сектор уйдёт с карты: гекс останется свободным слотом, улучшения сгорят,
                    а следующий сектор того же вида станет дешевле. Жаб снос не выселяет —
                    их придётся вынести заранее.
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm text-rose-200">
                  {DEMOLISH_ROOM_COST} {CURRENCY_CONFIG.tokens.icon}
                </span>
                <ClickButton
                  onClick={() => {
                    playClick();
                    openModal(() => <RoomDemolishModal room={selected} />);
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white transition-all hover:bg-rose-500 active:scale-95"
                >
                  Уничтожить
                </ClickButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
