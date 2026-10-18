import { useMemo, useState } from "react";
import Modal from "../../shared/Header";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
import { ClickButton } from "../../shared/ClickButton";
import { useToads } from "../../ToadContext";
import { completeAchivement } from "../../../backend/achivements-manager";
import { useColony } from "../../../hooks/use-colony";
import { useNotifications } from "../../../hooks/use-notification";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { getFeedCost } from "../../../utils/feeding";
import { isRoomOpen } from "../../HexMap/rooms-config";
import ToadsTab from "./ToadsTab";
import RoomsTab from "./RoomsTab";

type ColonyTab = "toads" | "rooms";

const COLONY_TABS: ModalTabItem<ColonyTab>[] = [
  { id: "toads", label: "🐸 Жабы", color: "text-emerald-400" },
  { id: "rooms", label: "🏗 Секторы", color: "text-cyan-400" },
];

/** Маленькая цифра сводки: ядро — это в первую очередь пульт колонии, а не список. */
const ColonyStat = ({
  icon,
  value,
  label,
  tone = "text-white",
}: {
  icon: string;
  value: string | number;
  label: string;
  tone?: string;
}) => (
  <div className="rounded-xl border border-white/10 bg-slate-950/40 px-2 py-1.5">
    <p className={`text-sm font-bold tabular-nums ${tone}`}>
      <span className="mr-1 text-2xs">{icon}</span>
      {value}
    </p>
    <p className="text-3xs leading-tight text-slate-400">{label}</p>
  </div>
);

/**
 * «Управление колонией» — окно ядра.
 *
 * Ядро — единственный гекс, который не принадлежит одному сектору: здесь вся колония
 * сразу. Поэтому модалка сводит то, за чем иначе пришлось бы ходить по карте:
 *  - сводку (жабы, секторы, энергосеть, походы);
 *  - массовое кормление — стоимость видна до нажатия, жабы в походе не кормятся;
 *  - вкладку «Жабы»: все жабы с характеристиками и текущим местом (`ToadsTab`);
 *  - вкладку «Секторы»: быстрый доступ к модалкам построек (`RoomsTab`).
 *
 * Модалка не привязана к гексу и открывается тапом по ядру (`HexMap/index.tsx`).
 */
const ColonyModal = () => {
  const { addNotification } = useNotifications();
  const { playCrunchShort } = useSoundEffects();
  const { allToads, account, handleFeedToads, ownedScenes } = useToads();
  const { rooms, powerGrid, toadsByRoom } = useColony();
  const [tab, setTab] = useState<ColonyTab>("toads");

  const feedableToads = useMemo(
    () => allToads.filter((toad) => toad.status !== "out"),
    [allToads],
  );
  const feedCost = getFeedCost(feedableToads);
  const food = account.storage?.food ?? 0;
  const missingFood = Math.max(0, feedCost - food);
  const needsFeed = feedableToads.some((toad) => toad.state.hunger < 100);
  const unfedCount = feedableToads.filter(
    (toad) => toad.state.hunger < 100,
  ).length;
  const expeditionCount = allToads.filter(
    (toad) => toad.status === "out",
  ).length;
  const builtRoomCount = rooms.filter(
    (room) => room.kind !== "core" && isRoomOpen(room),
  ).length;

  const canFeed = needsFeed && missingFood === 0;

  const feedColony = () => {
    if (!canFeed) {
      return;
    }

    playCrunchShort();
    completeAchivement("feed-one");
    handleFeedToads(feedableToads.map((toad) => toad.id));
    addNotification({
      type: "success",
      content: `Колония покормлена: −${feedCost} корма`,
      timeout: 3000,
    });
  };

  return (
    <Modal title="🏛 Управление колонией">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-1.5">
          <ColonyStat icon="🐸" value={allToads.length} label="жаб" />
          <ColonyStat
            icon="🏗"
            value={builtRoomCount}
            label="секторов"
            tone="text-cyan-300"
          />
          <ColonyStat
            icon="⚡"
            value={`${powerGrid.capacityUsed}/${powerGrid.capacityTotal}`}
            label="ток"
            tone="text-lime-300"
          />
          <ColonyStat
            icon="🧭"
            value={expeditionCount}
            label="в походе"
            tone="text-amber-300"
          />
        </div>

        <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-slate-900/20 to-emerald-500/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-amber-100">
                Кормление колонии
              </p>
              <p className="mt-0.5 text-3xs text-slate-400">
                {feedableToads.length === 0
                  ? "В колонии нет жаб для кормления"
                  : unfedCount > 0
                    ? `Не сыты жаб: ${unfedCount}`
                    : "Все сыты — голодных нет"}
                {expeditionCount > 0 && " · жабы в походе не кормятся"}
              </p>
            </div>

            <span className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-xs font-semibold text-amber-100">
              <img
                src="/assets/food.webp"
                alt="Корм"
                className="h-5 w-5 object-contain"
              />
              {food}
            </span>
          </div>

          <ClickButton
            type="button"
            onClick={feedColony}
            disabled={!canFeed}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-gradient-to-r from-amber-600 to-orange-600 px-3 py-2 text-sm font-bold text-white shadow-lg transition-colors hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
          >
            <img
              src="/assets/food.webp"
              alt=""
              className="h-6 w-6 object-contain"
            />
            {feedableToads.length === 0
              ? "Некого кормить"
              : needsFeed
                ? `Покормить всех · ${feedCost}`
                : "Все жабы сыты"}
          </ClickButton>

          <p className="mt-1.5 text-center text-3xs text-slate-400">
            {feedableToads.length === 0
              ? "Кормить пока некого."
              : needsFeed && missingFood > 0
                ? `Не хватает ${missingFood} корма — пополни склад в Торговой капсуле.`
                : needsFeed
                  ? `На складе ${food} · после кормления останется ${food - feedCost}`
                  : "Корм не тратится, пока все сыты."}
          </p>
        </div>

        <ModalTabs tabs={COLONY_TABS} active={tab} onChange={setTab} />

        <div className="pt-0.5">
          {tab === "toads" ? (
            <ToadsTab toads={allToads} rooms={rooms} scenes={ownedScenes} />
          ) : (
            <RoomsTab
              rooms={rooms}
              powerGrid={powerGrid}
              toadsByRoom={toadsByRoom}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ColonyModal;
