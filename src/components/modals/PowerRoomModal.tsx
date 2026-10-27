import { useMemo, useState } from "react";
import { isToadSick } from "../../models/disease";
import { Toad } from "../../models/Toad";
import { useColony } from "../../hooks/use-colony";
import { useGameState } from "../../hooks/use-game-state";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { getFeedCost } from "../../utils/feeding";
import {
  EXPEDITION_TOAD_BUSY_REASON,
  isToadBusyOnExpedition,
} from "../../utils/expedition-manager";
import {
  TOAD_PICKER_REJECTED_GROUP,
  splitToadPickerCandidates,
} from "../../utils/toad-picker";
import { useToads } from "../ToadContext";
import { useModal } from "../ModalContext";
import { ClickButton } from "../shared/ClickButton";
import { DataCell, DataGrid, HudPanel } from "../shared/DataGrid";
import Modal from "../shared/Header";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import { ToadListCard } from "../shared/ToadListCard";
import { ToadSlotGrid } from "../shared/ToadSlotGrid";
import { ToadInfo } from "./ToadInfoModal";
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
 * соседей. Голодная или больная жаба ток не даёт, а сектор без работающих жаб никого
 * не питает — но внешнее питание ей и не нужно: ток ей дают сами жабы.
 *
 * Табы — общие для всех секторов (`shared/ModalTabs`): работающие жабы первым, «Данные
 * сектора» (`modals/RoomDataTab.tsx`) — последним: описание, улучшения и снос, то есть всё,
 * что раньше жило в отдельной модалке улучшения. Энергосектор открывают только с гекса,
 * поэтому табов у неё всегда два. Жабы стоят в общей сетке слотов (`shared/ToadSlotGrid`) —
 * той же, что в Медотсеке и репродукторе: квадраты с «+», выбор модалкой и крестик.
 */
/** Табы энергосектора: работающие жабы первым, «Данные сектора» — последним */
type PowerTab = "power" | RoomDataTabId;

const POWER_TABS: ModalTabItem<PowerTab>[] = [
  { id: "power", label: "⚡ Сектор" },
  { ...ROOM_DATA_TAB },
];

export default function PowerRoomModal({ room }: { room: RoomConfig }) {
  const { allToads, account, handleFeedToads, selectToad } = useToads();
  const { powerGrid, toadsByRoom, placeToad, releaseToad, rooms } = useColony();
  const { addNotification } = useNotifications();
  const { openModal } = useModal();
  const { playSuccess, playError, playCrunchShort, playCroakSmall } =
    useSoundEffects();
  const gameState = useGameState();
  const expeditions = gameState.expeditions ?? [];
  /** Состояние сектора: жабы у сети (по умолчанию) или данные сектора */
  const [tab, setTab] = useState<PowerTab>("power");

  const roomToads = toadsByRoom[room.id] ?? [];
  /** Жабы, свободные от похода: вернувшиеся ждут разбора добычи и в секторе не работают */
  const activeRoomToads = roomToads.filter(
    (toad) => !isToadBusyOnExpedition(toad, expeditions),
  );
  // Ток сектора считает сеть: у ⚡ с работающими жабами он есть даже без подачи извне
  const powered = isRoomPowered(room, powerGrid);
  const output = getToadPowerCapacity(activeRoomToads, expeditions);
  /** Жабы, которые стоят в секторе, но ток не дают: больные и голодные */
  const idleToads = activeRoomToads.filter(
    (toad) => !isToadPowering(toad, expeditions),
  );
  const sickToads = idleToads.filter(isToadSick);
  const hungryToads = idleToads.filter((toad) => !isToadSick(toad));
  const idleLabel =
    activeRoomToads.length === 0 && roomToads.length > 0
      ? "Жабы в походе — ток не вырабатывают до разбора добычи"
      : idleToads.length === 0
        ? "Все жабы здоровы, сыты и вырабатывают ток"
        : sickToads.length > 0
          ? `Не вырабатывают ток: ${idleToads.length} (больных: ${
              sickToads.length
            }${
              hungryToads.length > 0
                ? `, голодных: ${hungryToads.length}`
                : ""
            })`
          : `Не вырабатывают ток: ${idleToads.length} (нужна сытость выше ${POWER_MIN_HUNGER})`;
  const freeSlots = POWER_ROOM_TOAD_SLOTS - roomToads.length;
  /** Слоты энергосектора: жаба на месте или пустой квадрат с «+» — как в Медотсеке */
  const powerSlots = Array.from(
    { length: POWER_ROOM_TOAD_SLOTS },
    (_, index) => ({
      toad: roomToads[index] ?? null,
      label: `Жаба ${index + 1}`,
      icon: "⚡",
    }),
  );
  // Корм считает `getFeedCost`: один корм на жабу; жабы в походе не едят
  const feedCost = getFeedCost(activeRoomToads);
  const food = Math.floor(account?.storage?.food || 0);

  /** Как называется сектор, в котором жаба работает сейчас */
  const getRoomName = (id: string): string =>
    rooms.find((item) => item.id === id || item.slotId === id)?.name ??
    "сектор колонии";

  /**
   * Жабы для подсадки в энергосектор — строками общего списка (`shared/ToadPicker`),
   * который открывает модалка слота (`shared/ToadSlotGrid`).
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
          .map((toad) => {
            const onExpedition = isToadBusyOnExpedition(toad, expeditions);
            const issue = getToadPowerIssue(toad, expeditions);

            return {
              toad,
              // Сверху — те, кто уже даёт ток: сытые взрослые на своих местах
              rank:
                !issue && !onExpedition && isToadPowering(toad, expeditions)
                  ? 1
                  : 0,
              reason: onExpedition
                ? EXPEDITION_TOAD_BUSY_REASON
                : issue
                  ? issue
                  : typeof toad.scene_id === "string"
                    ? `Жаба уже работает в секторе «${getRoomName(toad.scene_id)}»`
                    : null,
            };
          })
      ),
    [allToads, room.id, rooms, expeditions]
  );

  /**
   * Открыть карточку жабы поверх энергосектора: модалки складываются в стек,
   * поэтому «Закрыть» вернёт к тому же списку работающих жаб.
   */
  const openToadCard = (toad: Toad) => {
    selectToad(toad.id);
    openModal(() => <ToadInfo />);
  };

  const handleFeed = () => {
    if (activeRoomToads.length === 0) {
      return;
    }

    playCrunchShort();
    handleFeedToads(activeRoomToads.map((toad) => toad.id));
  };

  const handlePlace = (toad: Toad) => {
    if (isToadBusyOnExpedition(toad, expeditions)) {
      playError();
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    const issue = getToadPowerIssue(toad, expeditions);

    if (issue) {
      playError();
      addNotification({ type: "warn", content: issue });
      return;
    }

    if (freeSlots <= 0) {
      playError();
      addNotification({
        type: "warn",
        content: `В энергосекторе уже ${POWER_ROOM_TOAD_SLOTS} жаб — мест нет.`,
      });
      return;
    }

    placeToad(toad.id, room.id);
    playCroakSmall();
  };

  /** Вернуть жабу домой — в биопод, который она помнит (`homeId`), или в свободный под током */
  const handleRelease = (toad: Toad) => {
    if (isToadBusyOnExpedition(toad, expeditions)) {
      playError();
      addNotification({ type: "warn", content: EXPEDITION_TOAD_BUSY_REASON });
      return;
    }

    const result = releaseToad(toad.id);

    // Место в биоподе не бронировалось: пока жаба работала в ⚡-секторе, его могли занять.
    // releaseToad тогда найдёт любой свободный биопод под током.
    if (!result.ok) {
      playError();
      addNotification({
        type: "warn",
        content: "Свободных мест в биоподах нет",
        timeout: 9000,
      });
      return;
    }

    playSuccess();
  };

  return (
    <Modal title={room.name} tone="amber">
      {/* Переключение вкладок: вид один на все секторы (`shared/ModalTabs`) */}
      <ModalTabs tabs={POWER_TABS} active={tab} onChange={setTab} />

      {tab === "power" && (
        <div className="px-2 pb-2">
          {/* Состояние сети: есть ли ток у самого сектора */}
          <HudPanel
            tone={powered ? "emerald" : "rose"}
            className="mb-2 p-2"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white">
                {powered ? "⚡ Сектор под током" : "🔌 Сектор обесточен"}
              </span>
              <span className="shrink-0 text-slate-300">
                Ток соседям: {powerGrid.usage[room.id] ?? 0}/
                {POWER_ROOM_TOAD_SLOTS}
              </span>
            </div>
            <p className="mt-1 text-2xs leading-snug text-slate-200">
              {powered
                ? "Каждая кормлённая жаба внутри даёт одну единицу тока соседнем секторе."
                : "Внешнее питание секторе не нужно: посадите взрослых жаб и накормите их — каждая даст одну единицу тока соседнему гексу."}
            </p>
          </HudPanel>

          {/* Ёмкость сектора: работающие жабы и запас корма */}
          <DataGrid columns={3} className="mb-3">
            <DataCell
              dense
              label="Работают"
              value={`${output}/${POWER_ROOM_TOAD_SLOTS}`}
              color="text-amber-200"
            />
            <DataCell
              dense
              label="Жабы"
              value={`${roomToads.length}/${POWER_ROOM_TOAD_SLOTS}`}
              color="text-white"
            />
            <DataCell
              dense
              label="Корм"
              value={`${food} 🍎`}
              color={food >= feedCost ? "text-lime-300" : "text-rose-300"}
            />
          </DataGrid>

          {/* Кормление жаб: сытые дают ток, голодные — нет */}
          <HudPanel className="mb-3 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs leading-snug text-slate-400">
                {idleLabel}
              </span>
              <ClickButton
                onClick={handleFeed}
                disabled={activeRoomToads.length === 0 || food < feedCost}
                className={`shrink-0 border px-3 py-1 text-xs font-bold transition-colors ${
                  activeRoomToads.length === 0 || food < feedCost
                    ? "cursor-not-allowed border-slate-700/60 text-slate-500"
                    : "border-amber-400/50 bg-amber-600/20 text-amber-100 hover:bg-amber-500/30"
                }`}
              >
                Покормить ({feedCost} 🍎)
              </ClickButton>
            </div>
          </HudPanel>

          {/* Слоты энергосектора — та же сетка, что у Медотсека и репродуктора */}
          <ToadSlotGrid
            slots={powerSlots}
            columns={6}
            // Занятый слот: болезнь и сытость — по ним видно, даёт ли жаба ток
            vitals={{ hunger: true, disease: true }}
            title={`⚡ В «${room.name}» (${roomToads.length}/${POWER_ROOM_TOAD_SLOTS})`}
            headerRight={`свободно мест: ${freeSlots}`}
            pickerFor={() => ({
              groups: [
                {
                  label: `Можно взять (${candidates.available.length})`,
                  // Порядок строк уже задан `splitToadPickerCandidates`: кто даёт ток — сверху
                  items: candidates.available.map(({ toad }) => ({
                    toad,
                    note: isToadPowering(toad, expeditions)
                      ? "даёт ток"
                      : `голодная — ток не даёт (нужна сытость выше ${POWER_MIN_HUNGER})`,
                  })),
                },
              ],
              rejected: {
                label: TOAD_PICKER_REJECTED_GROUP,
                items: candidates.rejected,
              },
              hint: `Сверху — жабы, которые уже дают ток: взрослые, живые, здоровые и сытые выше ${POWER_MIN_HUNGER}. Энергосектор — рабочий сектор всей колонии, поэтому взять можно жабу из любого биопода. Жабу из другого сектора выбор перенесёт сюда. Больных жаб сначала лечат в Медотсеке.`,
              emptyText:
                "Свободных здоровых взрослых жаб нет: остальные в походе, больны, выбиты или уже работают в секторе колонии.",
            })}
            onPick={(toad) => handlePlace(toad)}
            onOpen={(toad) => openToadCard(toad)}
            onRemove={(toad) => handleRelease(toad)}
            removeLabel="Вернуть в биопод"
            footer={
              roomToads.length === 0 ? (
                <p className="text-2xs leading-snug text-slate-400">
                  Посадите жаб — по одной на каждого соседа — и кормите их:
                  каждая сытая взрослая жаба даёт одну единицу тока.
                </p>
              ) : null
            }
          />

          {/* Под сеткой — карточки работающих жаб: сытость, статус тока и выписка */}
          {roomToads.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {roomToads.map((toad) => {
                const onExpedition = isToadBusyOnExpedition(toad, expeditions);
                const sick = isToadSick(toad);
                const powering =
                  !onExpedition && isToadPowering(toad, expeditions);

                return (
                  <ToadListCard
                    key={toad.id}
                    toad={toad}
                    onOpen={() => openToadCard(toad)}
                    variant="brief"
                    showHunger
                    showHp={false}
                    tone={
                      onExpedition ? "warn" : powering ? "success" : "warn"
                    }
                    status={{
                      icon: onExpedition
                        ? "🧭"
                        : sick
                          ? "🦠"
                          : powering
                            ? "⚡"
                            : "🔌",
                      label: onExpedition
                        ? "в походе"
                        : sick
                          ? "больна — ток не даёт"
                          : powering
                            ? "даёт ток"
                            : `не даёт ток: сытость ≤ ${POWER_MIN_HUNGER}`,
                      className: onExpedition
                        ? "text-amber-300"
                        : powering
                          ? "text-emerald-300"
                          : "text-amber-300",
                    }}
                    actions={
                      <ClickButton
                        onClick={() => handleRelease(toad)}
                        disabled={onExpedition}
                        title={
                          onExpedition
                            ? EXPEDITION_TOAD_BUSY_REASON
                            : undefined
                        }
                        className={`shrink-0 rounded-none border px-2 py-1 text-2xs transition-colors ${
                          onExpedition
                            ? "cursor-not-allowed border-slate-700/60 text-slate-500"
                            : "border-slate-600/60 text-slate-300 hover:border-rose-400 hover:text-rose-200"
                        }`}
                      >
                        В биопод
                      </ClickButton>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ВКЛАДКА «Данные сектора»: описание, улучшения и снос гекса */}
      {tab === "room-data" && <RoomDataTab room={room} />}
    </Modal>
  );
}
