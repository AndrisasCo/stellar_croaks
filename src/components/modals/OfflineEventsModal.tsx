import { useEffect, useMemo, useState } from "react";
import { useOfflineEvents } from "../../hooks/use-offline-events";
import { formatOfflineEventTime } from "../../utils/offline-events";
import type { OfflineEventType } from "../../utils/offline-events";
import Modal from "../shared/Header";
import { CurrencyText } from "../shared/CurrencyIcon";

const EVENT_STYLES: Record<
  OfflineEventType,
  { icon: string; panel: string; iconTone: string }
> = {
  success: {
    icon: "✅",
    panel: "border-emerald-400/30 bg-emerald-950/25",
    iconTone: "bg-emerald-500/15 text-emerald-200",
  },
  warn: {
    icon: "⚠️",
    panel: "border-amber-400/30 bg-amber-950/20",
    iconTone: "bg-amber-500/15 text-amber-200",
  },
  danger: {
    icon: "🚨",
    panel: "border-rose-400/30 bg-rose-950/20",
    iconTone: "bg-rose-500/15 text-rose-200",
  },
  info: {
    icon: "ℹ️",
    panel: "border-cyan-400/25 bg-slate-950/40",
    iconTone: "bg-cyan-500/15 text-cyan-200",
  },
};

const pluralizeEvents = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "событие";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return "события";
  }

  return "событий";
};

/**
 * События, случившиеся, пока игрок был оффлайн.
 *
 * Открывается кнопкой (!) рядом с панелью колонии. Список отмечается прочитанным
 * при открытии — после возврата в игру кнопка (!) больше не акцентная, но журнал
 * остаётся доступным, чтобы перечитать события.
 */
export const OfflineEventsModal: React.FC = () => {
  const { events, unreadCount, markAllRead } = useOfflineEvents();
  const [unreadAtOpen] = useState(unreadCount);

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  const ordered = useMemo(
    () => [...events].sort((a, b) => b.at - a.at),
    [events],
  );

  return (
    <Modal
      title="События колонии"
      icon={
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-300/70 bg-amber-400/15 text-lg font-black leading-none text-amber-200">
          !
        </span>
      }
    >
      <div className="flex flex-col gap-3 px-1">
        <p className="text-2xs leading-snug text-slate-400">
          {unreadAtOpen > 0
            ? `Пока вас не было, произошло ${unreadAtOpen} ${pluralizeEvents(
                unreadAtOpen,
              )}. Открытие журнала отметило их прочитанными.`
            : "Здесь хранятся события, которые произошли во время вашего отсутствия."}
        </p>

        {ordered.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 text-center text-2xs italic text-slate-400">
            Пока вас не было, в колонии ничего не случилось.
          </div>
        ) : (
          <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
            {ordered.map((event) => {
              const style = EVENT_STYLES[event.type];

              return (
                <div
                  key={event.id}
                  className={`relative overflow-hidden rounded-xl border p-3 ${style.panel}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${style.iconTone}`}
                    >
                      {style.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-1xs leading-snug text-slate-100">
                        <CurrencyText
                          text={event.content}
                          iconClassName="h-3.5 w-3.5"
                        />
                      </p>
                      <span className="mt-1 block text-3xs text-slate-500">
                        {formatOfflineEventTime(event.at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default OfflineEventsModal;
