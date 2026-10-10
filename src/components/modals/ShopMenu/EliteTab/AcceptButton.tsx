import React, { useState } from "react";

import { EliteOrderTooltip } from "./EliteTooltip";
import { ClickButton } from "../../../shared/ClickButton";
import { Toad } from "../../../../models/Toad";

/** Заказ витрины в том виде, в каком его собирает EliteTab (награда — Астро-кваксы) */
export interface EliteOrderView {
  id: string;
  title: string;
  description: string;
  reward: number;
  difficulty: string;
  canComplete: boolean;
  suitableToads: Toad[];
}

interface AcceptButtonProps {
  order: EliteOrderView;
  /** Принять заказ конкретной жабой из списка подходящих */
  handleSubmitEliteOrder: (orderId: string) => (toad: Toad) => void;
}

export const AcceptButton: React.FC<AcceptButtonProps> = ({
  order,
  handleSubmitEliteOrder,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<EliteOrderView | null>(
    null
  );

  return (
    <div className="relative">
      <ClickButton
        onClick={() => setSelectedOrder(order)}
        disabled={!order.canComplete}
        className={`w-full py-3 rounded-xl text-base font-medium transition-colors ${
          order.canComplete
            ? "bg-purple-600 hover:bg-purple-500 text-white"
            : "bg-gray-600 text-gray-300 cursor-not-allowed"
        }`}
      >
        {order.canComplete ? "Принять заказ" : "Недоступно"}
      </ClickButton>
      {selectedOrder && (
        <EliteOrderTooltip
          order={selectedOrder}
          availableToads={selectedOrder.suitableToads}
          onSelectToad={handleSubmitEliteOrder(selectedOrder.id)}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};
