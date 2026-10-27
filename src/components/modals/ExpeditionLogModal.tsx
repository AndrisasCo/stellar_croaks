import React from "react";
import Modal from "../shared/Header";
import { CurrencyText } from "../shared/CurrencyIcon";
import { Expedition, getSectorById } from "../../models/expedition";
import { getExpeditionLootSummary } from "../../utils/expedition-manager";
import { ExpeditionLogList, formatExpeditionDate } from "./ExpeditionLogList";

/**
 * Отдельное окно с полным журналом завершённого похода.
 *
 * Открывается кнопкой «Открыть логи» на карточке добычи и из архива походов:
 * так историю задания можно перечитать после разбора лута, когда карточки
 * похода уже нет на вкладке «Поход».
 */
export const ExpeditionLogModal: React.FC<{ expedition: Expedition }> = ({
  expedition,
}) => {
  const sector = getSectorById(expedition.sectorId);
  const survived = expedition.success !== false;
  const completedAt = expedition.completedAt ?? expedition.startedAt;

  return (
    <Modal title="Бортовой журнал" tone="emerald">
      <div className="flex flex-col gap-3 px-1">
        <div
          className={`ui-panel relative overflow-hidden p-3 ${
            survived
              ? "border-emerald-500/40 bg-emerald-950/30"
              : "border-red-500/30 bg-red-950/20"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-0 h-px ${
              survived
                ? "bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
                : "bg-gradient-to-r from-transparent via-red-300/70 to-transparent"
            }`}
          />

          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span
                className={`text-3xs font-semibold uppercase tracking-[0.16em] ${
                  survived ? "text-emerald-300/80" : "text-red-300/80"
                }`}
              >
                // отчёт похода
              </span>
              <p className="mt-0.5 truncate text-sm font-bold text-white">
                {sector.icon} {sector.name}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-3xs text-slate-400">
                <span>глубина {sector.depth}</span>
                <span aria-hidden="true">·</span>
                <span>{expedition.team.length} жаб</span>
                <span aria-hidden="true">·</span>
                <span>{formatExpeditionDate(completedAt)}</span>
              </p>
            </div>
            <span
              className={`ui-badge shrink-0 ${
                survived
                  ? "border-emerald-400/30 bg-emerald-900/50 text-emerald-200"
                  : "border-red-400/30 bg-red-900/40 text-red-200"
              }`}
            >
              {survived ? "✅ успех" : "⚠️ провал"}
            </span>
          </div>

          <p className="relative mt-2 flex flex-wrap items-center gap-1 border-t border-white/10 pt-2 text-2xs text-slate-300">
            <span className="text-3xs uppercase tracking-[0.12em] text-slate-500">
              добыча
            </span>
            <CurrencyText
              text={getExpeditionLootSummary(expedition)}
              iconClassName="h-3 w-3"
            />
          </p>
        </div>

        <ExpeditionLogList
          log={expedition.log}
          order="oldest"
          maxHeightClass="max-h-[55vh]"
          title="📜 Все записи похода"
        />
      </div>
    </Modal>
  );
};

export default ExpeditionLogModal;
