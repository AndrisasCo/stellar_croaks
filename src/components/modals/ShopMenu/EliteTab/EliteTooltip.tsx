import React, { useState } from "react";
import { Toad } from "../../../../models/Toad";
import { CurrencyIcon } from "../../../shared/CurrencyIcon";
import { HudPanel, SectionTitle } from "../../../shared/DataGrid";
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
    <div className="absolute inset-x-0 bottom-0 z-50 flex items-end justify-center bg-slate-950/50 p-2 backdrop-blur-sm sm:items-center">
      <HudPanel
        tone="cyan"
        className="w-full max-w-sm border-cyan-400/50 p-3 shadow-2xl shadow-cyan-950/40"
      >
        {/* Заголовок пульта выбора */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="ui-kicker">SELECT TARGET</div>
            <h3 className="mt-0.5 text-sm font-semibold text-white">
              Выбор жабы
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть выбор жабы"
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-slate-800/70 text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-white"
          >
            ×
          </button>
        </div>

        {/* Заказ: цель и награда */}
        <div className="mt-2 border border-cyan-400/20 bg-slate-950/50 p-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="min-w-0 truncate text-xs font-semibold text-cyan-200">
              {order.title}
            </h4>
            <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold text-violet-200">
              {order.reward}
              <CurrencyIcon currency="astro_quax" className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-2xs leading-snug text-slate-400">
            {order.description}
          </p>
        </div>

        {/* Список жаб: компактные строки того же HUD-языка, что и общий список */}
        <div className="mt-2">
          <SectionTitle aside={`${availableToads.length} UNITS`}>
            Подходящие жабы
          </SectionTitle>
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {availableToads.map((toad) => {
            const isSelected = selectedToadId === toad.id;

            return (
              <button
                key={toad.id}
                type="button"
                onClick={() => setSelectedToadId(toad.id)}
                aria-pressed={isSelected}
                className={`relative flex w-full items-center gap-2 border px-2 py-1.5 text-left transition-colors ${
                  isSelected
                    ? "border-cyan-400/60 bg-cyan-500/15"
                    : "border-slate-700/60 bg-slate-950/50 hover:border-cyan-400/40"
                }`}
              >
                <ToadAvatar toad={toad} size={8} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate text-xs font-medium text-white">
                      {toad.name}
                    </span>
                    <ToadGender gender={toad.sex} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-3xs uppercase tracking-[0.1em] text-slate-400">
                    <span>Q {toad.genes.rarity.toFixed(1)}</span>
                    <span className={getToadHomeId(toad) ? "" : "text-amber-300"}>
                      {getToadHomeId(toad) ? "HOME" : "NO HOME"}
                    </span>
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 ${
                    isSelected
                      ? "bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                      : "bg-slate-600"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Кнопки действий */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ui-button-secondary flex-1 py-2 text-2xs"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedToadId}
            className="ui-button-primary flex-1 py-2 text-2xs"
          >
            Отправить
          </button>
        </div>
      </HudPanel>
    </div>
  );
};
