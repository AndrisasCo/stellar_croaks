import React, { useState } from "react";
import { Toad } from "../../models/toad";
import { CURRENCY_CONFIG } from "../../utils/constants";
import Modal from "../shared/Modal";
import { useToads } from "../ToadContext";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { updateUser } from "../../backend";

// Импортируем компоненты вкладок
import BuyTab from "./ShopTabs/BuyTab";
import SellTab from "./ShopTabs/SellTab";
import EliteTab from "./ShopTabs/EliteTab";
import EnclosureTab from "./ShopTabs/EnclosureTab";

interface ShopMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "buy" | "sell" | "elite" | "enclosure";

export default function ShopMenu({ isOpen, onClose }: ShopMenuProps) {
  const [activeTab, setActiveTab] = useState<TabType>("buy");
  const { account } = useToads();
  const { playClick } = useSoundEffects();

  const { tokens = 0, astro_quax = 0 } = account || {};

  if (!isOpen) return null;

  const tabs = [
    { id: "buy" as TabType, label: "Купить", color: "text-green-400" },
    { id: "sell" as TabType, label: "Продать", color: "text-yellow-400" },
    {
      id: "elite" as TabType,
      label: "Элитные",
      color: "text-purple-400",
      // disabled: true,
    },
    { id: "enclosure" as TabType, label: "Вольеры", color: "text-blue-400" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "buy":
        return <BuyTab />;
      case "sell":
        return <SellTab />;
      case "elite":
        return <EliteTab />;
      case "enclosure":
        return <EnclosureTab />;
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Космический рынок">
      <div className="bg-gray-800 py-4 px-2 border-b border-gray-700">
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
      <div className="flex border-b border-gray-700 bg-gray-800">
        {tabs.map((tab) => (
          <button
            disabled={tab.disabled}
            key={tab.id}
            onClick={() => {
              if (tab.disabled) {
                return;
              }
              playClick();
              setActiveTab(tab.id);
            }}
            className={`flex-1 py-3 relative text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? `${tab.color} border-b-2 ${tab.color.replace(
                    "text",
                    "border"
                  )}`
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.disabled && (
              <span className="absolute right-[-3px] top-[10px] rotate-45 opacity-75  bg-purple-500 rounded-md px-1 text-white text-xs">
                Cкоро
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="py-4">{renderTabContent()}</div>
    </Modal>
  );
}
