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
    <Modal title="Бортовой журнал" icon={<span className="text-xl">📡</span>}>
      <div className="flex flex-col gap-3 px-1">
        <div
          className={`relative overflow-hidden rounded-2xl border p-3 ${
            survived
              ? "border-emerald-500/40 bg-emerald-950/30"
              : "border-red-500/30 bg-red-950/20"
          }`}
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-3xl ${
              survived ? "bg-emerald-400/20" : "bg-red-400/20"
            }`}
          />

          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {sector.icon} {sector.name}
              </p>
              <p className="mt-0.5 text-2xs text-slate-400">
                глубина {sector.depth} · {expedition.team.length} жаб ·
                возвращение {formatExpeditionDate(completedAt)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-lg px-2 py-1 text-2xs font-bold ${
                survived
                  ? "bg-emerald-900/60 text-emerald-200"
                  : "bg-red-900/50 text-red-200"
              }`}
            >
              {survived ? "✅ поход удался" : "⚠️ провал"}
            </span>
          </div>

          <p className="relative mt-2 text-2xs text-slate-300">
            Добыча:{" "}
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
