import React, { useState } from "react";
import { Toad } from "../../../../models/Toad";
import { CurrencyIcon } from "../../../shared/CurrencyIcon";
import { getToadHomeId } from "../../../../utils/toad-location";
import { ToadGender } from "../../../shared/ToadGender";
import { ToadAvatar } from "../../../shared/ToadAvatar";

interface EliteOrderTooltipProps {
  order: any;
  availableToads: Toad[];
  onSelectToad: (toad: Toad) => void;
  onClose: () => void;
}

export const EliteOrderTooltip: React.FC<EliteOrderTooltipProps> = ({
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
    <div className="absolute left-0 right-0 bottom-0  flex items-center justify-center p-4 z-50">
      <div className="bg-color-main rounded-xl p-4 w-full max-w-xs border border-purple-500/40 shadow-lg">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Выбор жабы</h3>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-5 h-5"
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

        {/* Информация о заказе */}
        <div className="mb-3">
          <h4 className="text-purple-400 font-medium text-xs mb-1">
            {order.title}
          </h4>
          <p className="text-gray-200 text-xs mb-2 line-clamp-2">
            {order.description}
          </p>
          <div className="text-green-400 text-sm font-semibold">
            Награда: {order.reward}{" "}
            <CurrencyIcon currency="astro_quax" className="h-4 w-4" />
          </div>
        </div>

        {/* Список жаб */}
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          <p className="text-gray-300 text-xs">Подходящие жабы:</p>
          {availableToads.map((toad) => (
            <div
              key={toad.id}
              onClick={() => setSelectedToadId(toad.id)}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                selectedToadId === toad.id
                  ? "bg-purple-900/30 border-purple-500"
                  : "bg-color-main border-gray-600 hover:border-purple-400/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <ToadAvatar toad={toad} size={8} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-white font-medium text-xs truncate">
                      {toad.name}
                    </span>
                    <ToadGender gender={toad.sex} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 text-xs text-gray-300">
                    <span>качество: {toad.genes.rarity.toFixed(1)}</span>
                  </div>
                </div>
                {/* Дом жабы — её биопод (`homeId`): у жабы без дома (сейв старой версии,
                    а не «в секторе») показываем коробку */}
                <div>{getToadHomeId(toad) ? "" : "📦"}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-color-second hover:bg-gray-600 text-white py-2 rounded-lg transition-colors text-xs font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedToadId}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors text-xs ${
              selectedToadId
                ? "bg-purple-600 hover:bg-purple-500 text-white"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            }`}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};
