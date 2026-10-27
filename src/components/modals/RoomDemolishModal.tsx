import { useMemo } from "react";
import { updateUser } from "../../backend";
import { getRoomUpgrades } from "../../backend/colony";
import { useColony } from "../../hooks/use-colony";
import { useNotifications } from "../../hooks/use-notification";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { CURRENCY_CONFIG, DEMOLISH_ROOM_COST } from "../../utils/constants";
import { useModal } from "../ModalContext";
import { useToads } from "../ToadContext";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon } from "../shared/CurrencyIcon";
import Modal from "../shared/Header";
import {
  getRoomCost,
  getRoomCostAfterDemolish,
  getRoomDemolishIssue,
} from "../HexMap/colony-build";
import {
  getBuiltRoomKind,
  RoomConfig,
} from "../HexMap/rooms-config";

/**
 * Подтверждение сноса сектора — модалка-развилка перед необратимым шагом.
 *
 * Снос платный (`DEMOLISH_ROOM_COST`) и всегда через подтверждение: за постройку Кваксы не
 * возвращаются, улучшения сектора сгорают (автокормушку или репатриатор не вернуть), а вернуть
 * сектор можно только новой постройкой. Взамен гекс остаётся на карте свободным слотом — земля
 * не теряется, а следующий сектор того же вида дешевеет: цена считается по числу построенных
 * (`colony-build.ts` → `getRoomCostAfterDemolish`), поэтому снос делает шаг назад.
 *
 * Модалку открывает вкладка «О секторе» любого сектора (`RoomDataTab`): там же видно, что
 * построено и где живут жабы. Правила сноса (не ядро и ни одной жабы внутри) — в
 * `getRoomDemolishIssue`: они должны сходиться с тем, что игрок видит на гексе.
 */
export default function RoomDemolishModal({ room }: { room: RoomConfig }) {
  const { closeModal } = useModal();
  const { account, ownedScenes } = useToads();
  const { colony, toadsByRoom, demolishRoom } = useColony();
  const { addNotification } = useNotifications();
  const { playSuccess, playError } = useSoundEffects();

  const tokens = Math.floor(account?.tokens || 0);
  const roomToads = toadsByRoom[room.id] ?? [];
  const issue = getRoomDemolishIssue(room, roomToads);
  const upgraded = Object.values(getRoomUpgrades(room)).some(Boolean);
  const sceneName =
    room.sceneId == null
      ? null
      : ownedScenes.find((scene) => scene.id === room.sceneId)?.name ?? null;
  /** Вид сектора из каталога построек: у гекса он шире (ядро и пустой слот сюда не попадают) */
  const kind = getBuiltRoomKind(room);

  /**
   * Цены вокруг сноса: столько секторов того же вида стоит сейчас и столько — после сноса.
   * Считается по состоянию колонии, а не по сейву: список обновляется после каждой постройки.
   */
  const price = useMemo(() => {
    // Открыть снос можно только у построенного сектора: вид сужаем до каталога построек
    if (!kind) {
      return { now: 0, after: 0, saving: 0 };
    }

    const now = getRoomCost(colony, kind);
    const after = getRoomCostAfterDemolish(colony, {
      id: room.id,
      slotId: room.slotId,
      kind,
    });

    return { now, after, saving: Math.max(0, now - after) };
  }, [colony, kind, room.id, room.slotId]);

  const affordable = tokens >= DEMOLISH_ROOM_COST;
  const blocked = issue !== null || !affordable;

  const handleDemolish = () => {
    if (issue) {
      playError();
      addNotification({ type: "warn", content: issue });
      return;
    }

    if (!affordable) {
      playError();
      addNotification({
        type: "danger",
        content: `Не хватает ${DEMOLISH_ROOM_COST - tokens} ${
          CURRENCY_CONFIG.tokens.icon
        }`,
      });
      return;
    }

    demolishRoom(room.id);
    updateUser({ tokens: tokens - DEMOLISH_ROOM_COST });
    playSuccess();
    addNotification({
      type: "success",
      content: `${room.icon} ${room.name || room.title || "Сектор"} снесена: гекс свободен${
        price.saving > 0
          ? `, следующая такой сектор дешевле на ${price.saving} ${CURRENCY_CONFIG.tokens.icon}`
          : ""
      }.`,
    });

    // Сноса больше нет — модалка закрывается, карта перерисуется сама
    closeModal();
  };

  return (
    <Modal title="Снос сектора" tone="rose">
      <div className="px-2 pb-2">
        <div className="mb-3 rounded-none border border-rose-500/40 bg-rose-900/20 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-rose-200">Шаг необратимый</span>
            <span className="text-amber-200">
              <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />{" "}
              {tokens}
            </span>
          </div>
          <p className="text-2xs leading-snug text-rose-100">
            Сектор уходит с карты навсегда: Кваксы за постройку не возвращаются, улучшения
            сгорают. Взамен гекс остаётся свободным слотом — его можно застроить заново.
          </p>
        </div>

        <div className="mb-2 rounded-none border border-slate-600/40 bg-color-second p-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{room.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 text-sm font-semibold text-amber-100">
                {room.name || room.title}
                {sceneName && (
                  <span className="text-2xs font-normal text-slate-400">
                    «{sceneName}»
                  </span>
                )}
              </div>
              <div className="text-2xs leading-snug text-slate-400">
                {room.subtitle} · жаб в секторе: {roomToads.length}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2 space-y-1 rounded-none border border-slate-600/40 bg-color-second p-2 text-2xs leading-snug text-slate-300">
          <div>
            🗺 Гекс останется на карте свободным слотом: территорию снос не отбирает, гексы
            вокруг него тоже остаются открытыми.
          </div>
          <div>
            🐸 Жабы:{" "}
            {roomToads.length > 0
              ? `${roomToads.length} — сначала переселите их в биопод.`
              : "в секторе пусто"}
          </div>
          {upgraded && (
            <div className="text-rose-300">
              🍎 Улучшения сектора сгорят: автокормушка и репатриатор уйдут вместе с ним.
            </div>
          )}
          {price.saving > 0 ? (
            <div className="text-emerald-300">
              💰 Следующий сектор того же вида («{room.title}») будет стоить{" "}
              {price.after} вместо {price.now}{" "}
              <CurrencyIcon currency="tokens" className="h-3 w-3" /> — снос
              делает шаг назад по цене.
            </div>
          ) : (
            <div>
              💰 Цена сектора того же вида после сноса не изменится (шаг роста у неё
              единичный).
            </div>
          )}
        </div>

        {issue && (
          <p className="mb-2 rounded-none border border-rose-500/40 bg-rose-900/20 p-2 text-2xs leading-snug text-rose-100">
            {issue}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm ${affordable ? "text-amber-200" : "text-rose-300"}`}
          >
            {DEMOLISH_ROOM_COST}{" "}
            <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />
          </span>
          <div className="flex items-center gap-2">
            <ClickButton
              onClick={closeModal}
              className="rounded-none bg-slate-700/60 px-3 py-1 text-xs font-bold text-slate-200 transition-all hover:bg-slate-600/60 active:scale-95"
            >
              Оставить
            </ClickButton>
            <ClickButton
              onClick={handleDemolish}
              disabled={blocked}
              className={`rounded-none px-3 py-1 text-xs font-bold transition-all ${
                blocked
                  ? "cursor-not-allowed bg-slate-700/60 text-slate-400"
                  : "bg-rose-600 text-white hover:bg-rose-500 active:scale-95"
              }`}
            >
              Уничтожить
            </ClickButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
