import { useModal } from "../ModalContext";
import { useOfflineEvents } from "../../hooks/use-offline-events";
import OfflineEventsModal from "../modals/OfflineEventsModal";
import { ClickButton } from "./ClickButton";

/**
 * Кнопка (!) в HUD рядом с панелью колонии.
 *
 * Появляется, когда журнал событий отсутствия не пуст. Акцентная (янтарная)
 * и с бейджем, пока есть непрочитанные события; после прочтения остаётся
 * спокойной, чтобы журнал можно было открыть повторно.
 */
export const OfflineEventsButton = () => {
  const { openModal } = useModal();
  const { events, unreadCount } = useOfflineEvents();

  if (events.length === 0) {
    return null;
  }

  const hasUnread = unreadCount > 0;

  return (
    <ClickButton
      type="button"
      title={
        hasUnread
          ? `События колонии: непрочитанных ${unreadCount}`
          : "События колонии"
      }
      aria-label={
        hasUnread
          ? `События колонии: непрочитанных ${unreadCount}`
          : "События колонии"
      }
      onClick={() => openModal(() => <OfflineEventsModal />)}
      className={`pointer-events-auto  relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-1 text-xl font-black leading-none backdrop-blur-md transition-all duration-300 active:scale-95 ${
        hasUnread
          ? "border-amber-300/90 border-solid border-[1px] bg-amber-400/20 text-amber-100 "
          : "border-white/15 border-solid border-[1px] bg-slate-950/65 text-slate-400 hover:border-white/30 hover:text-slate-200"
      }`}
    >
      !
      {hasUnread && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-3xs font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </ClickButton>
  );
};

export default OfflineEventsButton;
