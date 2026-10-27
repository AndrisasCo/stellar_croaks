import { CURRENCY_CONFIG } from "../../../utils/constants";
import { useColony } from "../../../hooks/use-colony";
import { useRoomPowerTab } from "../../../hooks/use-room-power-tab";
import Modal from "../../shared/Header";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
import { DataCell, DataGrid, HudPanel, SectionTitle } from "../../shared/DataGrid";
import { CurrencyIcon } from "../../shared/CurrencyIcon";
import RoomDataTab, { ROOM_DATA_TAB, RoomDataTabId } from "../RoomDataTab";
import { RoomConfig } from "../../HexMap/rooms-config";
import { useToads } from "../../ToadContext";
import BuyTab from "./BuyTab";
import SellTab from "./SellTab";
import { EliteTab } from "./EliteTab";

type TabType = "buy" | "sell" | "elite" | RoomDataTabId;

/**
 * «Космический рынок» 🛒 — торговля колонии: покупка, продажа и элитные заказы.
 *
 * Табы модалки — общие для всех секторов карты (`shared/ModalTabs`): этот переключатель
 * и стал их образцом. Последний таб — «Данные сектора» (`modals/RoomDataTab.tsx`): из карты
 * гекс приходит пропом, а из бургер-меню его находим по единственной построенной «Торговой
 * капсуле» — иначе таб с описанием, апгрейдами и сносом был бы недоступен.
 */
export default function ShopMenu({ room }: { room?: RoomConfig }) {
  const { account } = useToads();
  const { powerGrid, rooms } = useColony();

  /**
   * Гекс рынка для таба «Данные сектора» и проверки тока: карта передаёт его пропом,
   * а бургер-меню — нет. Торговая Капсула в колонии единственный (`unique`), поэтому находим его
   * среди построенных секторов. Без такого гекса данные сектора показать не для чего.
   */
  const shopRoom = room ?? rooms.find((item) => item.kind === "shop");

  const {
    tab: activeTab,
    setTab: setActiveTab,
    issue: powerIssue,
  } = useRoomPowerTab<TabType>({
    room: shopRoom,
    powerGrid,
    defaultTab: "buy",
  });

  const { tokens = 0, astro_quax = 0 } = account || {};

  /** Табы рынка: три торговых и «Данные сектора» найденной Торговой капсулы */
  const tabs: ModalTabItem<TabType>[] = [
    {
      id: "buy",
      label: "Купить",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    {
      id: "sell",
      label: "Продать",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    {
      id: "elite",
      label: "Элитные",
      disabled: Boolean(powerIssue),
      disabledHint: powerIssue ?? undefined,
    },
    ...(shopRoom ? [{ ...ROOM_DATA_TAB }] : []),
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "buy":
        return <BuyTab />;
      case "sell":
        return <SellTab />;
      case "elite":
        return <EliteTab />;
      case "room-data":
        return shopRoom ? <RoomDataTab room={shopRoom} /> : null;
      default:
        return null;
    }
  };

  return (
    <Modal title={shopRoom?.name} tone="amber">
      {/* Табы сразу под названием — общий каркас модалок секторов */}
      <ModalTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Валюта и состояние канала: общая шапка всех торговых вкладок */}
      <div className="px-2 pb-4">
        <HudPanel tone={powerIssue ? "rose" : "amber"} className="p-2.5">
          <SectionTitle aside={powerIssue ? "OFFLINE" : "ONLINE"}>
            Торговый терминал
          </SectionTitle>

          <DataGrid columns={2} tone={powerIssue ? "rose" : "amber"}>
            <DataCell
              label={CURRENCY_CONFIG.tokens.name}
              accent="bg-cyan-300"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {tokens}
                  <CurrencyIcon currency="tokens" className="h-4 w-4" />
                </span>
              }
            />
            <DataCell
              label={CURRENCY_CONFIG.astro_quax.name}
              color="text-violet-200"
              accent="bg-violet-300"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {astro_quax}
                  <CurrencyIcon currency="astro_quax" className="h-4 w-4" />
                </span>
              }
            />
          </DataGrid>

          <div className="mt-2 flex items-center justify-between gap-2 text-3xs uppercase tracking-[0.14em] text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1 w-1 shrink-0 ${
                  powerIssue
                    ? "bg-rose-300 shadow-[0_0_6px_rgba(251,113,133,0.8)]"
                    : "bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                }`}
              />
              <span
                className={`truncate ${powerIssue ? "text-rose-300" : ""}`}
                title={powerIssue ?? undefined}
              >
                {powerIssue ??
                  `Канал защищён · ${shopRoom?.name ?? "резервный узел"}`}
              </span>
            </span>
            <span
              className={`shrink-0 ${
                powerIssue ? "text-rose-300/80" : "text-amber-300/80"
              }`}
            >
              {powerIssue ? "NO PWR" : "UPLINK"}
            </span>
          </div>
        </HudPanel>
      </div>

      {/* Контент */}
      <div className="pb-4">{renderTabContent()}</div>
    </Modal>
  );
}
