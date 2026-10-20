import { useMemo, useState } from "react";
import { getRarityConfig, Toad } from "../../models/Toad";
import { useColony } from "../../hooks/use-colony";
import { useGameState } from "../../hooks/use-game-state";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { getFeedCost } from "../../utils/feeding";
import { getToadHomeId } from "../../utils/toad-location";
import {
  TOAD_PICKER_REJECTED_GROUP,
  splitToadPickerCandidates,
} from "../../utils/toad-picker";
import { useToads } from "../ToadContext";
import { ClickButton } from "../shared/ClickButton";
import Modal from "../shared/Header";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import { ToadPicker } from "../shared/ToadPicker";
import { isRoomPowered } from "../HexMap/colony-build";
import {
  getToadPowerCapacity,
  getToadPowerIssue,
  isToadPowering,
  POWER_MIN_HUNGER,
  POWER_ROOM_TOAD_SLOTS,
} from "../HexMap/colony-power";
import { RoomConfig } from "../HexMap/rooms-config";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "./RoomDataTab";

/**
 * Энергосектор ⚡ — источник питания колонии.
 *
 * Внутри до 6 жаб (по одной на каждую сторону гекса): кормлённая взрослая жаба
 * даёт одну единицу тока одной соседнем секторе, значит 6 жаб закрывают все 6
 * соседей. Голодная жаба ток не даёт, а сектор без работающих жаб никого не
 * питает — но внешнее питание ей и не нужно: ток ей дают сами жабы.
 *
 * Табы — общие для всех секторов (`shared/ModalTabs`): работающие жабы первым, «Данные
 * сектора» (`modals/RoomDataTab.tsx`) — последним: описание, улучшения и снос, то есть всё,
 * что раньше жило в отдельной модалке улучшения. Энергосектор открывают только с гекса,
 * поэтому табов у неё всегда два.
 */
const HungerBar = ({ value }: { value: number }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
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

/** Табы энергосектора: работающие жабы первым, «Данные сектора» — последним */
type PowerTab = "power" | RoomDataTabId;

const POWER_TABS: ModalTabItem<PowerTab>[] = [
  { id: "power", label: "⚡ Сектор" },
  { ...ROOM_DATA_TAB },
];

export default function PowerRoomModal({ room }: { room: RoomConfig }) {
  const { allToads, account, handleFeedToads } = useToads();
  const { powerGrid, toadsByRoom, placeToad, releaseToad, rooms } = useColony();
  const { addNotification } = useNotifications();
  const { playOk, playBeep, playCrunchShort, playCroakSmall } =
    useSoundEffects();
  const gameState = useGameState();
  /** Состояние сектора: жабы у сети (по умолчанию) или данные сектора */
  const [tab, setTab] = useState<PowerTab>("power");

  const roomToads = toadsByRoom[room.id] ?? [];
  // Ток сектора считает сеть: у ⚡ с работающими жабами он есть даже без подачи извне
  const powered = isRoomPowered(room, powerGrid);
  const output = getToadPowerCapacity(roomToads);
  const hungryToads = roomToads.filter((toad) => !isToadPowering(toad));
  const freeSlots = POWER_ROOM_TOAD_SLOTS - roomToads.length;
  // Корм считает `getFeedCost`: один корм на жабу
  const feedCost = getFeedCost(roomToads);
  const food = Math.floor(account?.storage?.food || 0);

  /** Как называется сектор, в котором жаба работает сейчас */
  const getRoomName = (id: string): string =>
    rooms.find((item) => item.id === id || item.slotId === id)?.name ??
    "сектор колонии";

  /**
   * Жабы для подсадки в энергосектор — строками общего списка (`shared/ToadPicker`).
   *
   * Взять можно свободных здоровых взрослых жаб колонии: энергосектор — рабочий сектор всей
   * колонии, поэтому в неё берут жаб из любого биопода. Остальные из списка не исчезают:
   * у каждой видна причина отказа (`getToadPowerIssue` или «уже работает в секторе»), чтобы
   * игрок не искал ответ, почему его жабы нет в списке.
   */
  const candidates = useMemo(
    () =>
      splitToadPickerCandidates(
        allToads
          // Жабы самого энергосектора и так стоят списком выше
          .filter((toad) => toad.scene_id !== room.id)
          .map((toad) => ({
            toad,
            // Сверху — те, кто уже даёт ток: сытые взрослые на своих местах
            rank: isToadPowering(toad) ? 1 : 0,
            reason:
              typeof toad.scene_id === "string"
                ? `Жаба уже работает в секторе «${getRoomName(toad.scene_id)}»`
                : getToadPowerIssue(toad),
          }))
      ),
    [allToads, room.id, rooms]
  );

  /** Где жаба живёт сейчас — строкой списка: сектор колонии или её биопод */
  const locationOf = (toad: Toad): string => {
    if (typeof toad.scene_id === "string") {
      return getRoomName(toad.scene_id);
    }

    const scene = (gameState.scenes ?? []).find(
      (item) => item.id === getToadHomeId(toad)
    );

    return scene?.name ?? "Биопод";
  };

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

    if (freeSlots <= 0) {
      playBeep();
      addNotification({
        type: "warn",
        content: `В энергосекторе уже ${POWER_ROOM_TOAD_SLOTS} жаб — мест нет.`,
      });
      return;
    }

    placeToad(toad.id, room.id);
    playCroakSmall();
    addNotification({
      type: "success",
      content: `${toad.name ?? "Жаба"} теперь работает в энергосекторе ⚡`,
    });
  };

  /** Вернуть жабу домой — в биопод, который она помнит (`homeId`) */
  const handleRelease = (toad: Toad) => {
    const result = releaseToad(toad.id);

    // Место в биоподе не бронировалось: пока жаба работала в ⚡-секторе, его могли занять
    if (!result.ok) {
      playBeep();
      addNotification({
        type: "warn",
        content:
          result.reason === "no-space"
            ? `${toad.name ?? "Жаба"} остаётся в секторе: в биоподе «${result.scene?.name}» нет места — постройте биопод или переселите её в другой («🏠 Переместить» в карточке жабы).`
            : `${toad.name ?? "Жаба"} остаётся в секторе: биопод, в котором она жила, не найден — переселите её в другой («🏠 Переместить» в карточке жабы).`,
        timeout: 9000,
      });
      return;
    }

    playOk();
    addNotification({
      type: "info",
      content: `${toad.name ?? "Жаба"} вернулась в биопод.`,
    });
  };

  return (
    <Modal icon={<span className="text-2xl">⚡</span>} title="Энергосектор">
      {/* Переключение вкладок: вид один на все секторы (`shared/ModalTabs`) */}
      <ModalTabs tabs={POWER_TABS} active={tab} onChange={setTab} />

      {tab === "power" && (
        <div className="px-2 pb-2">
          {/* Состояние сети: есть ли ток у самого сектора */}
          <div
            className={`mb-2 rounded-xl border p-2 ${
              powered
                ? "border-emerald-500/40 bg-emerald-900/20"
                : "border-rose-500/40 bg-rose-900/20"
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">
                {powered ? "⚡ Сектор под током" : "🔌 Сектор обесточен"}
              </span>
              <span className="text-slate-300">
                Ток соседям: {powerGrid.usage[room.id] ?? 0}/
                {POWER_ROOM_TOAD_SLOTS}
              </span>
            </div>
            <p className="mt-1 text-2xs leading-snug text-slate-200">
              {powered
                ? "Каждая кормлённая жаба внутри даёт одну единицу тока соседнем секторе."
                : "Внешнее питание секторе не нужно: посадите взрослых жаб и накормите их — каждая даст одну единицу тока соседнему гексу."}
            </p>
          </div>

          {/* Ёмкость сектора и кормление жаб */}
          <div className="mb-3 rounded-xl border border-slate-600/40 bg-color-main p-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200">
                ⚡ Работающих жаб: {output} из {POWER_ROOM_TOAD_SLOTS}
              </span>
              <span className="text-slate-300">
                🐸 {roomToads.length}/{POWER_ROOM_TOAD_SLOTS}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xs leading-snug text-slate-400">
                {hungryToads.length > 0
                  ? `Не вырабатывают ток: ${hungryToads.length} (нужна сытость выше ${POWER_MIN_HUNGER})`
                  : "Все жабы сыты и вырабатывают ток"}
              </span>
              <ClickButton
                onClick={handleFeed}
                disabled={roomToads.length === 0 || food < feedCost}
                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  roomToads.length === 0 || food < feedCost
                    ? "cursor-not-allowed bg-slate-700/60 text-slate-400"
                    : "bg-amber-600 text-white hover:bg-amber-500 active:scale-95"
                }`}
              >
                Покормить ({feedCost} 🍎)
              </ClickButton>
            </div>
          </div>

          {/* Жабы, которые сидят в секторе */}
          {roomToads.length === 0 ? (
            <div className="py-6 text-center">
              <div className="mb-2 text-4xl">⚡</div>
              <p className="text-sm text-slate-300">
                В секторе пока никто не работает
              </p>
              <p className="mt-1 text-2xs text-slate-400">
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
                        <span className="shrink-0 text-2xs text-slate-400">
                          🍽 {Math.round(toad.state.hunger)}
                        </span>
                      </div>
                      <HungerBar value={toad.state.hunger} />
                    </div>
                    <ClickButton
                      onClick={() => handleRelease(toad)}
                      className="shrink-0 rounded-lg border border-slate-600/60 px-2 py-1 text-2xs text-slate-300 transition-colors hover:border-rose-400 hover:text-rose-200"
                    >
                      В биопод
                    </ClickButton>
                  </div>
                );
              })}
            </div>
          )}

          {/* Подсадка жаб: общий выпадающий список — свободные взрослые жабы всей колонии */}
          <div className="mt-3">
            <ToadPicker
              icon="⚡"
              caption="Энергосектор"
              label="Энергосектор"
              placeholder={
                freeSlots > 0
                  ? `＋ Поместить жабу (свободно мест: ${freeSlots})`
                  : `Все ${POWER_ROOM_TOAD_SLOTS} мест заняты`
              }
              disabled={freeSlots <= 0}
              groups={[
                {
                  label: `Можно взять (${candidates.available.length})`,
                  // Порядок строк уже задан `splitToadPickerCandidates`: кто даёт ток — сверху
                  items: candidates.available.map(({ toad }) => ({
                    toad,
                    note: isToadPowering(toad)
                      ? "даёт ток"
                      : `голодная — ток не даёт (нужна сытость выше ${POWER_MIN_HUNGER})`,
                  })),
                },
              ]}
              rejected={{
                label: TOAD_PICKER_REJECTED_GROUP,
                items: candidates.rejected,
              }}
              hint={`Сверху — жабы, которые уже дают ток: взрослые, живые и сытые выше ${POWER_MIN_HUNGER}. Энергосектор — рабочий сектор всей колонии, поэтому взять можно жабу из любого биопода. Жабу из другого сектора выбор перенесёт сюда.`}
              emptyText="Свободных взрослых жаб нет: остальные в походе, выбиты или уже работают в секторе колонии."
              locationOf={locationOf}
              onPick={handlePlace}
            />
          </div>
        </div>
      )}

      {/* ВКЛАДКА «Данные сектора»: описание, улучшения и снос гекса */}
      {tab === "room-data" && <RoomDataTab room={room} />}
    </Modal>
  );
}
