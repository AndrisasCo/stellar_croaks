import React from "react";
import { CurrencyText } from "../shared/CurrencyIcon";
import { ExpeditionLogEntry } from "../../models/expedition";
import { ROLE_CONFIG } from "../../utils/expedition-config";

/** Время реплики в чате похода */
export const formatClock = (at: number): string =>
  new Date(at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Дата возвращения команды для карточки архива и заголовка журнала */
export const formatExpeditionDate = (at?: number): string => {
  if (!at || !Number.isFinite(at)) {
    return "дата неизвестна";
  }

  return new Date(at).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Бортовой журнал похода: реплики команды и служебные события.
 *
 * Используется в двух местах: в карточке активного похода (последние записи,
 * новые сверху) и в отдельной модалке `ExpeditionLogModal`, где журнал читают
 * целиком от начала к концу — как историю прошедшего задания.
 */
export const ExpeditionLogList: React.FC<{
  log: ExpeditionLogEntry[];
  /** Сколько последних записей показать; без ограничения — весь журнал */
  limit?: number;
  /** `newest` — свежие сверху (карточка), `oldest` — история с начала (модалка) */
  order?: "newest" | "oldest";
  maxHeightClass?: string;
  title?: string;
}> = ({
  log,
  limit,
  order = "newest",
  maxHeightClass = "max-h-72",
  title = "📡 Бортовой журнал",
}) => {
  const ordered = order === "oldest" ? [...log] : [...log].reverse();
  const entries = limit ? ordered.slice(0, limit) : ordered;

  return (
    <div className="ui-panel flex flex-col gap-2 border-cyan-400/30 p-3 shadow-[0_0_30px_-16px_rgba(34,211,238,0.9)]">
      <div className="flex items-center justify-between gap-2 border-b border-cyan-300/15 pb-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 animate-pulse bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]"
          />
          <span className="truncate text-2xs font-bold uppercase tracking-[0.14em] text-cyan-300">
            {title}
          </span>
        </span>
        <span className="ui-badge shrink-0 border-cyan-300/20 text-cyan-200/70">
          {log.length} зап.
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-2xs italic text-slate-400">
          Тишина в эфире: команда ещё не вышла на связь.
        </p>
      ) : (
        <div
          className={`flex ${maxHeightClass} flex-col gap-1.5 overflow-y-auto pr-1`}
        >
          {entries.map((entry) => {
            const role =
              entry.role === "system" ? null : ROLE_CONFIG[entry.role];
            const color =
              entry.kind === "good"
                ? "text-green-300"
                : entry.kind === "bad"
                  ? "text-red-300"
                  : "text-slate-300";
            const accent =
              entry.kind === "good"
                ? "border-emerald-400/60 bg-emerald-950/20"
                : entry.kind === "bad"
                  ? "border-red-400/60 bg-red-950/20"
                  : "border-slate-600/60 bg-slate-900/40";

            return (
              <p
                key={entry.id}
                className={`border-l-2 px-2 py-1.5 text-1xs leading-snug ${accent} ${color}`}
              >
                <span className="font-mono tabular-nums text-slate-500">
                  {formatClock(entry.at)}{" "}
                </span>
                <span className="font-semibold uppercase tracking-[0.04em]">
                  {role
                    ? `${role.icon} ${entry.toadName ?? role.label}`
                    : "📡 Связь"}
                  :{" "}
                </span>
                <CurrencyText text={entry.text} iconClassName="h-3 w-3" />
                {typeof entry.hpDelta === "number" && entry.hpDelta !== 0 && (
                  <span
                    className={
                      entry.hpDelta < 0 ? "text-red-400" : "text-green-400"
                    }
                  >
                    {" "}
                    ({entry.hpDelta > 0
                      ? `+${entry.hpDelta}`
                      : entry.hpDelta}{" "}
                    HP)
                  </span>
                )}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
