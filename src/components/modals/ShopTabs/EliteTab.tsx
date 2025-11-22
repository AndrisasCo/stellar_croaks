import React, { useState } from "react";
import { deleteToadsByIds, updateToadById, updateUser } from "../../../backend";
import { useSoundEffects } from "../../../hooks/use-sound-effects";
import { Toad } from "../../../models/toad";
import { useToads } from "../../ToadContext";
import { CURRENCY_CONFIG, TYPE_ICONS } from "../../../utils/constants";
import { ToadGender } from "../../shared/ToadGender";

const EliteTab: React.FC = () => {
  const { allToads: activeToads, account } = useToads();
  const { playBuy } = useSoundEffects();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const { astro_quax = 0 } = account || {};

  // Элитные заказы
  const eliteOrders = [
    {
      id: "1",
      title: "Гигантская жаба",
      description: "Нужна жаба размером более 25",
      requirement: (toad: Toad) => toad.genes.weight > 25,
      reward: 50,
      currency: "elite",
    },
    {
      id: "2",
      title: "Романтичная душа",
      description: 'Жаба с характером "Романтик"',
      requirement: (toad: Toad) => toad.genes.personality === "romantic",
      reward: 40,
      currency: "elite",
    },
    {
      id: "3",
      title: "Загадочный андрогин",
      description: "Жаба с полом Neuter",
      requirement: (toad: Toad) => toad.sex === "neuter",
      reward: 60,
      currency: "elite",
    },
    {
      id: "4",
      title: "Скоростной чемпион",
      description: "Жаба со скоростью более 1.8",
      requirement: (toad: Toad) => toad.genes.speed > 1.8,
      reward: 35,
      currency: "elite",
    },
    {
      id: "5",
      title: "Эпический гигант",
      description: "Эпическая жаба размером более 30",
      requirement: (toad: Toad) =>
        toad.genes.weight > 30 && toad.genes.rarity >= 7,
      reward: 80,
      currency: "elite",
    },
  ];

  const handleAcceptEliteOrder = (order: any) => {
    setSelectedOrder(order);
  };

  const handleSubmitEliteOrder = async (toad: Toad) => {
    playBuy();
    deleteToadsByIds([toad.id]);

    updateUser({ astro_quax: astro_quax + selectedOrder.reward });
    setSelectedOrder(null);
  };

  const getAvailableOrders = () => {
    return eliteOrders.map((order) => {
      const suitableToads = activeToads.filter(order.requirement);
      return {
        ...order,
        canComplete: suitableToads.length > 0,
        suitableToads,
      };
    });
  };

  const availableOrders = getAvailableOrders();

  return (
    <div className="space-y-4  pb-4">
      <h3 className="text-white font-semibold mb-3 px-2 text-lg">
        Элитные заказы
      </h3>
      {availableOrders.map((order) => (
        <div
          key={order.id}
          className={`rounded-2xl py-4 px-2 border ${
            order.canComplete
              ? "bg-purple-900/20 border-purple-500/50"
              : "bg-gray-800/50 border-gray-600/50"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex-1">
              <h4 className="text-white font-semibold text-base mb-2">
                {order.title}
              </h4>
              <p className="text-gray-300 text-sm mb-3">{order.description}</p>

              <div className="flex flex-col gap-2 text-sm text-gray-400 mb-3">
                <div className="flex justify-between">
                  <span>Подходит жаб:</span>
                  <span>{order.suitableToads.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Награда:</span>
                  <span className="text-green-400">
                    {order.reward} {CURRENCY_CONFIG.astro_quax.icon}
                  </span>
                </div>
              </div>

              <div
                className={`text-sm ${
                  order.canComplete ? "text-green-400" : "text-gray-500"
                }`}
              >
                {order.canComplete
                  ? "✅ Есть подходящие жабы"
                  : "❌ Нет подходящих жаб"}
              </div>
            </div>

            <button
              onClick={() => handleAcceptEliteOrder(order)}
              disabled={!order.canComplete}
              className={`w-full py-3 rounded-xl text-base font-medium transition-colors ${
                order.canComplete
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              {order.canComplete ? "Принять заказ" : "Недоступно"}
            </button>
          </div>
        </div>
      ))}
      {selectedOrder && (
        <EliteOrderTooltip
          order={selectedOrder}
          availableToads={selectedOrder.suitableToads}
          onSelectToad={handleSubmitEliteOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default EliteTab;

interface EliteOrderTooltipProps {
  order: any;
  availableToads: Toad[];
  onSelectToad: (toad: Toad) => void;
  onClose: () => void;
}

const EliteOrderTooltip: React.FC<EliteOrderTooltipProps> = ({
  order,
  availableToads,
  onSelectToad,
  onClose,
}) => {
  const [selectedToadId, setSelectedToadId] = useState<number | null>(null);

  const handleSubmit = () => {
    if (selectedToadId) {
      const toad = availableToads.find((t) => t.id === selectedToadId);
      if (toad) {
        onSelectToad(toad);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-purple-500/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold px-2 text-lg">Выбор жабы</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <h4 className="text-purple-400 font-semibold text-base mb-2">
            {order.title}
          </h4>
          <p className="text-gray-300 text-sm mb-3">{order.description}</p>
          <div className="text-green-400 text-base font-semibold mb-4">
            Награда: {order.reward} {CURRENCY_CONFIG.astro_quax.icon}
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-3 mb-4">
          <p className="text-gray-400 text-sm mb-2">Подходящие жабы:</p>
          {availableToads.map((toad) => (
            <div
              key={toad.id}
              onClick={() => setSelectedToadId(toad.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedToadId === toad.id
                  ? "bg-purple-900/30 border-purple-500"
                  : "bg-gray-700/50 border-gray-600 hover:border-purple-400/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full border-2 border-white/80 flex-shrink-0"
                  style={{ backgroundColor: toad.genes.colors[0] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium text-sm truncate">
                      {toad.name}
                    </span>
                    <ToadGender gender={toad.sex} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400">
                    <span>Разм: {toad.genes.weight.toFixed(1)}</span>
                    <span>Скор: {toad.genes.speed.toFixed(1)}</span>
                    <span>Редк: {toad.genes.rarity.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors text-base"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedToadId}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors text-base ${
              selectedToadId
                ? "bg-purple-600 hover:bg-purple-500 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};
