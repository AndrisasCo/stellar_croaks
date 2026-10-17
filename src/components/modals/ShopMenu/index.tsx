import { useState } from "react";
import { CURRENCY_CONFIG } from "../../../utils/constants";
import Modal from "../../shared/Header";
import ModalTabs, { ModalTabItem } from "../../shared/ModalTabs";
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
 * и стал их образцом. Последний таб — «Данные сектора» (`modals/RoomDataTab.tsx`), и он
 * появляется, только когда модалку открыли по гексу магазина (`room`): из бургер-меню
 * гекса нет, а данным нужен свой сектор — его описание, апгрейды и снос.
 */
export default function ShopMenu({ room }: { room?: RoomConfig }) {
  const [activeTab, setActiveTab] = useState<TabType>("buy");
  const { account } = useToads();

  const { tokens = 0, astro_quax = 0 } = account || {};

  /** Табы рынка: три торговых и, если модалку открыл гекс, «Данные сектора» */
  const tabs: ModalTabItem<TabType>[] = [
    { id: "buy", label: "Купить", color: "text-green-400" },
    { id: "sell", label: "Продать", color: "text-yellow-400" },
    { id: "elite", label: "Элитные", color: "text-purple-400" },
    ...(room ? [{ ...ROOM_DATA_TAB }] : []),
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
        return room ? <RoomDataTab room={room} /> : null;
      default:
        return null;
    }
  };

  return (
    <Modal title={room?.name}>
      <div className="pb-4 px-2 border-b border-gray-700">
        {/* Валюта */}
        <div className="flex gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">
              {CURRENCY_CONFIG.tokens.icon}
            </span>
            <span className="text-white">
              {CURRENCY_CONFIG.tokens.name}: {tokens}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-purple-400">
              {CURRENCY_CONFIG.astro_quax.icon}
            </span>
            <span className="text-white">
              {CURRENCY_CONFIG.astro_quax.name}: {astro_quax}
            </span>
          </div>
        </div>
      </div>

      {/* Табы */}
      <ModalTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Контент */}
      <div className="py-4">{renderTabContent()}</div>
    </Modal>
  );
}
