import { useMemo, useState } from "react";
import { getRarityConfig, Toad } from "../../models/Toad";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { getAutoHunger } from "../../utils/get-auto-hunger";
import { useToads } from "../ToadContext";
import { ClickButton } from "../shared/ClickButton";
import Modal from "../shared/Header";
import { isRoomPowered } from "../HexMap/colony-build";
import {
  getToadPowerCapacity,
  getToadPowerIssue,
  isToadPowering,
  POWER_MIN_HUNGER,
  POWER_ROOM_TOAD_SLOTS,
} from "../HexMap/colony-power";
import { RoomConfig } from "../HexMap/rooms-config";

/**
 * Энергокомната ⚡ — источник питания колонии.
 *
 * Внутри до 6 жаб (по одной на каждую сторону гекса): кормлённая взрослая жаба
 * даёт одну единицу тока одной соседней комнате, значит 6 жаб закрывают все 6
 * соседей. Голодная жаба ток не даёт, а обесточенная комната не работает вовсе.
 */
const HungerBar = ({ value }: { value: number }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700/60">
    <div
      className={`h-full ${
        value > POWER_MIN_HUNGER
          ? "bg-gradient-to-r from-lime-400 to-emerald-500"
          : "bg-gradient-to-r from-rose-500 to-orange-500"
      }`}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

export default function PowerRoomModal({ room }: { room: RoomConfig }) {
  const { toads, account, currentScene, handleFeedToads } = useToads();
  const { powerGrid, toadsByRoom, placeToad, releaseToad } = useColony();
  const { addNotification } = useNotifications();
  const { playOk, playBeep, playCrunchShort, playCroakSmall } =
    useSoundEffects();

  const [showPicker, setShowPicker] = useState(false);

  const roomToads = toadsByRoom[room.id] ?? [];
  const powered =
    isRoomPowered(room, powerGrid) ||
    (room.kind === "power" && toadsByRoom[room.id].length);
  const output = getToadPowerCapacity(roomToads);
  const hungryToads = roomToads.filter((toad) => !isToadPowering(toad));
  const freeSlots = POWER_ROOM_TOAD_SLOTS - roomToads.length;
  const feedCost = currentScene?.bonuses?.autoFeeder
    ? getAutoHunger(roomToads)
    : roomToads.length;
  const food = Math.floor(account?.storage?.food || 0);

  /** Кого можно подсадить: свободные здоровые взрослые жабы текущего вольера. */
  const candidates = useMemo(
    () =>
      toads.filter(
        (toad) =>
          !toad.roomId &&
          toad.stage === "adult" &&
          toad.status !== "out" &&
          (toad.hp ?? 1) > 0,
      ),
    [toads],
  );

  const handleFeed = () => {
    if (roomToads.length === 0) {
      return;
    }

    playCrunchShort();
    handleFeedToads(roomToads.map((toad) => toad.id));
  };

  const handlePlace = (toad: Toad) => {
    const issue = getToadPowerIssue(toad);

    if (issue) {
      playBeep();
      addNotification({ type: "warn", content: issue });
      return;
    }

    if (!powered) {
      playBeep();
      addNotification({
        type: "warn",
        content:
          "Комната обесточена: сначала подведите ток от ядра или соседней ⚡-комнаты.",
      });
      return;
    }

    if (freeSlots <= 0) {
      playBeep();
      addNotification({
        type: "warn",
        content: `В энергокомнате уже ${POWER_ROOM_TOAD_SLOTS} жаб — мест нет.`,
      });
      return;
    }

    placeToad(toad.id, room.id);
    playCroakSmall();
    addNotification({
      type: "success",
      content: `${toad.name ?? "Жаба"} теперь работает в энергокомнате ⚡`,
    });
  };

  const handleRelease = (toad: Toad) => {
    releaseToad(toad.id);
    playOk();
    addNotification({
      type: "info",
      content: `${toad.name ?? "Жаба"} вернулась в вольер.`,
    });
  };

  return (
    <Modal icon={<span className="text-2xl">⚡</span>} title="Энергокомната">
      <div className="px-2 pb-2">
        {/* Состояние сети: есть ли ток у самой комнаты */}
        <div
          className={`mb-2 rounded-xl border p-2 ${
            powered
              ? "border-emerald-500/40 bg-emerald-900/20"
              : "border-rose-500/40 bg-rose-900/20"
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">
              {powered ? "⚡ Комната под током" : "🔌 Комната обесточена"}
            </span>
            <span className="text-gray-300">
              Ток соседям: {powerGrid.usage[room.id] ?? 0}/
              {POWER_ROOM_TOAD_SLOTS}
            </span>
          </div>
          <p className="mt-1 text-2xs leading-snug text-gray-200">
            {powered
              ? "Каждая кормлённая жаба внутри даёт одну единицу тока соседней комнате."
              : "Рядом нет источника питания. Постройте энергокомнату по соседству или подключитесь к ядру 🏛."}
          </p>
        </div>

        {/* Ёмкость комнаты и кормление жаб */}
        <div className="mb-3 rounded-xl border border-gray-600/40 bg-color-main p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-amber-200">
              ⚡ Работающих жаб: {output} из {POWER_ROOM_TOAD_SLOTS}
            </span>
            <span className="text-gray-300">
              🐸 {roomToads.length}/{POWER_ROOM_TOAD_SLOTS}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-2xs leading-snug text-gray-400">
              {hungryToads.length > 0
                ? `Не вырабатывают ток: ${hungryToads.length} (нужна сытость выше ${POWER_MIN_HUNGER})`
                : "Все жабы сыты и вырабатывают ток"}
            </span>
            <ClickButton
              onClick={handleFeed}
              disabled={roomToads.length === 0 || food < feedCost}
              className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                roomToads.length === 0 || food < feedCost
                  ? "cursor-not-allowed bg-gray-700/60 text-gray-400"
                  : "bg-amber-600 text-white hover:bg-amber-500 active:scale-95"
              }`}
            >
              Покормить ({feedCost} 🍎)
            </ClickButton>
          </div>
        </div>

        {/* Жабы, которые сидят в комнате */}
        {roomToads.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mb-2 text-4xl">⚡</div>
            <p className="text-sm text-gray-300">
              В комнате пока никто не работает
            </p>
            <p className="mt-1 text-2xs text-gray-400">
              Посадите жаб — по одной на каждого соседа — и кормите их.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {roomToads.map((toad) => {
              const powering = isToadPowering(toad);
              const rarity = getRarityConfig(toad.genes.rarity);

              return (
                <div
                  key={toad.id}
                  className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                    powering
                      ? "border-emerald-500/40 bg-emerald-900/10"
                      : "border-amber-500/40 bg-amber-900/10"
                  }`}
                >
                  <span className="text-lg leading-none">
                    {powering ? "⚡" : "🔌"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-xs font-semibold ${rarity.color}`}
                      >
                        {toad.name}
                      </span>
                      <span className="shrink-0 text-2xs text-gray-400">
                        🍽 {Math.round(toad.state.hunger)}
                      </span>
                    </div>
                    <HungerBar value={toad.state.hunger} />
                  </div>
                  <ClickButton
                    onClick={() => handleRelease(toad)}
                    className="shrink-0 rounded-lg border border-gray-600/60 px-2 py-1 text-2xs text-gray-300 transition-colors hover:border-rose-400 hover:text-rose-200"
                  >
                    В вольер
                  </ClickButton>
                </div>
              );
            })}
          </div>
        )}

        {/* Подсадка жаб: свободные взрослые жабы текущего вольера */}
        <ClickButton
          onClick={() => setShowPicker((prev) => !prev)}
          disabled={freeSlots <= 0}
          className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-bold transition-all ${
            freeSlots <= 0
              ? "cursor-not-allowed bg-gray-700/60 text-gray-400"
              : "bg-emerald-700 text-white hover:bg-emerald-600 active:scale-[0.98]"
          }`}
        >
          {freeSlots > 0
            ? `Поместить жабу (свободно мест: ${freeSlots})`
            : `Все ${POWER_ROOM_TOAD_SLOTS} мест заняты`}
        </ClickButton>

        {showPicker && freeSlots > 0 && (
          <div className="mt-2 space-y-1.5">
            {candidates.length === 0 ? (
              <p className="py-2 text-center text-2xs text-gray-400">
                В вольере нет свободных взрослых жаб.
              </p>
            ) : (
              candidates.map((toad) => {
                const rarity = getRarityConfig(toad.genes.rarity);

                return (
                  <button
                    key={toad.id}
                    type="button"
                    onClick={() => handlePlace(toad)}
                    className="flex w-full items-center gap-2 rounded-xl border border-gray-600/40 bg-color-second px-2 py-1.5 text-left transition-colors hover:border-emerald-400/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-xs font-semibold ${rarity.color}`}
                      >
                        {toad.name}
                      </div>
                      <div className="text-2xs text-gray-400">
                        {rarity.label} · сытость {Math.round(toad.state.hunger)}
                      </div>
                    </div>
                    <span className="shrink-0 text-2xs text-emerald-300">
                      Посадить
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
