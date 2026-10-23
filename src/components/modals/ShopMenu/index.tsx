import { CURRENCY_CONFIG } from "../../../utils/constants";
import { useColony } from "../../../hooks/use-colony";
import { useRoomPowerTab } from "../../../hooks/use-room-power-tab";
import Modal from "../../shared/Header";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
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
    <Modal title={shopRoom?.name}>
      {/* Табы сразу под названием — общий каркас модалок секторов */}
      <ModalTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Валюта: общая для всех торговых вкладок */}
      <div className="px-2 pb-4">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CurrencyIcon currency="tokens" className="h-4 w-4" />
            <span className="text-white">
              {CURRENCY_CONFIG.tokens.name}: {tokens}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <CurrencyIcon currency="astro_quax" className="h-4 w-4" />
            <span className="text-white">
              {CURRENCY_CONFIG.astro_quax.name}: {astro_quax}
            </span>
          </div>
        </div>
      </div>

      {/* Контент */}
      <div className="pb-4">{renderTabContent()}</div>
    </Modal>
  );
}
