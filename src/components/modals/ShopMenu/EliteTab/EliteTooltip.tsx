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
      <div className="w-full max-w-xs rounded-xl border border-cyan-400/40 bg-color-main p-4 shadow-lg">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Выбор жабы</h3>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white transition-colors p-1"
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
          <h4 className="mb-1 text-xs font-medium text-cyan-300">
            {order.title}
          </h4>
          <p className="text-slate-200 text-xs mb-2 line-clamp-2">
            {order.description}
          </p>
          <div className="text-green-400 text-sm font-semibold">
            Награда: {order.reward}{" "}
            <CurrencyIcon currency="astro_quax" className="h-4 w-4" />
          </div>
        </div>

        {/* Список жаб */}
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          <p className="text-slate-300 text-xs">Подходящие жабы:</p>
          {availableToads.map((toad) => (
            <div
              key={toad.id}
              onClick={() => setSelectedToadId(toad.id)}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                selectedToadId === toad.id
                  ? "border-cyan-400/60 bg-cyan-500/15"
                  : "border-slate-600 bg-color-main hover:border-cyan-400/50"
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
                  <div className="grid grid-cols-2 gap-x-2 text-xs text-slate-300">
                    <span>Качество: {toad.genes.rarity.toFixed(1)}</span>
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
            className="ui-button-secondary flex-1 py-2 text-xs"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedToadId}
            className="ui-button-primary flex-1 py-2 text-xs"
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};
