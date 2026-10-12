import { useMemo, useState } from "react";
import { updateUser } from "../../backend";
import { getRoomUpgrades, upgradeColonyRoom } from "../../backend/colony";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { CURRENCY_CONFIG } from "../../utils/constants";
import {
  hasUpgrade,
  ROOM_UPGRADES,
  RoomUpgradeOption,
} from "../../utils/room-upgrades";
import { RoomUpgrades } from "../../models/colony";
import { processAutoFeeders } from "../../utils/auto-feeder";
import { useToads } from "../ToadContext";
import { ClickButton } from "../shared/ClickButton";
import Modal from "../shared/Header";
import { isToadRoom, RoomConfig } from "../HexMap/rooms-config";

/**
 * «Улучшение комнаты» — модалка ядра карты (раньше ядро открывало бургер-меню).
 *
 * Сначала комната, потом улучшение: улучшать можно только жилую комнату — ту, где живут
 * жабы (`isToadRoom`: вольер, ⚡-энергокомната, гнездо, лазарет, «Разведка»). Пустые гексы
 * и склады в списке не мешаются: улучшать в них нечего.
 *
 * Апгрейд у комнаты один — автокормушка (`utils/room-upgrades.ts`): пока на складе есть корм,
 * она кормит жаб комнаты сама, когда голод падает до `AUTO_FEED_HUNGER` (20 % — он же порог
 * выработки биомассы, поэтому жаба не простаивает), и списывает корм со склада
 * (`utils/auto-feeder.ts`). Жильцов комнаты показывает карта: у вольера это жабы его
 * `scene_id`, у энергокомнаты — те, кто в ней работает. Покупка кормит голодных жаб комнаты
 * сразу, не дожидаясь тика голода.
 */
export default function RoomUpgradeModal() {
  const { account, ownedScenes } = useToads();
  const { colony, rooms, toadsByRoom } = useColony();
  const { addNotification } = useNotifications();
  const { playOk, playBeep, playClick } = useSoundEffects();

  /** Выбранная комната: список показываем, пока комната не выбрана */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tokens = Math.floor(account?.tokens || 0);
  const livingRooms = useMemo(() => rooms.filter(isToadRoom), [rooms]);
  const selected = livingRooms.find((room) => room.id === selectedId) ?? null;

  /**
   * Апгрейды комнат для списка. Считаются от состояния колонии (`colony`), а не от глобального
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

  /** Имя вольера гекса: у «Био Пода» и построек оно своё (`Scene.name`) */
  const getSceneName = (room: RoomConfig) =>
    room.sceneId === undefined
      ? null
      : ownedScenes.find((scene) => scene.id === room.sceneId)?.name ?? null;

  const handleBuy = (option: RoomUpgradeOption) => {
    if (!selected) {
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

    // Кормушка берётся за дело сразу: голодных жаб комнаты она кормит, не дожидаясь тика голода
    const { fed } = processAutoFeeders(rooms, toadsByRoom);

    playOk();
    addNotification({
      type: "success",
      content: `${option.icon} ${option.title}: комната «${selected.title}» улучшена${
        fed > 0
          ? ` — кормушка сразу накормила жаб: ${fed}`
          : " — её жабы кормятся со склада сами"
      }.`,
    });
  };

  return (
    <Modal icon={<span className="text-2xl">🔧</span>} title="Улучшение комнаты">
      <div className="px-2 pb-2">
        <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-900/20 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-amber-200">
              {selected ? "Выбранная комната" : "Жилые комнаты колонии"}
            </span>
            <span className="text-amber-200">
              {CURRENCY_CONFIG.tokens.icon} {tokens}
            </span>
          </div>
          <p className="text-2xs leading-snug text-amber-100">
            Улучшать можно комнату, где живут жабы: вольер, ⚡-энергокомнату, гнездо с
            парой, лазарет, «Разведку». Улучшение одно — автокормушка.
          </p>
        </div>

        {!selected && (
          <div className="space-y-2">
            {livingRooms.length === 0 && (
              <p className="rounded-xl border border-gray-600/40 bg-color-second p-2 text-2xs leading-snug text-gray-400">
                Жилых комнат нет: улучшать нечего. Постройте вольер 🐸 или
                энергокомнату ⚡ — их жабы и станут жильцами комнаты.
              </p>
            )}

            {livingRooms.map((room) => {
              const upgrades = upgradesByRoom[room.id] ?? {};
              const residents = toadsByRoom[room.id]?.length ?? 0;
              const installed = ROOM_UPGRADES.filter((option) =>
                hasUpgrade(upgrades, option.upgrade)
              ).length;
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
                        {room.subtitle} · жаб в комнате: {residents}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {installed}/{ROOM_UPGRADES.length}
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
              ← Другая комната
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
                    {selected.subtitle} · жаб в комнате:{" "}
                    {toadsByRoom[selected.id]?.length ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {ROOM_UPGRADES.map((option) => {
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
          </div>
        )}
      </div>
    </Modal>
  );
}
