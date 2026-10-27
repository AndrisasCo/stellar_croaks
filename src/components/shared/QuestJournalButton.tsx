import { MenuIcons } from "../../assets/icons";
import { useQuestJournal } from "../../hooks/use-quest-journal";
import { useModal } from "../ModalContext";
import { ClickButton } from "../shared/ClickButton";
import QuestJournalModal from "../modals/QuestJournalModal";

/**
 * Кнопка журнала заданий в HUD — слева от меню колонии.
 *
 * Пока есть готовые задания, кнопка янтарная и показывает число наград:
 * игрок видит, что его ждёт подарок, не открывая журнал. После получения
 * наград она возвращается к спокойному циановому виду.
 */
export const QuestJournalButton = () => {
  const { openModal } = useModal();
  const { counts } = useQuestJournal();
  const readyCount = counts.ready;
  const hasRewards = readyCount > 0;

  const title = hasRewards
    ? `Журнал заданий: ${readyCount} к получению`
    : "Журнал заданий";

  return (
    <ClickButton
      type="button"
      title={title}
      aria-label={title}
      onClick={() => openModal(() => <QuestJournalModal />)}
      className={`pointer-events-auto relative flex h-10 w-10 shrink-0 items-center justify-center rounded-none border text-cyan-200 backdrop-blur-md transition-all duration-300 active:scale-95 ${
        hasRewards
          ? "border-amber-300/80 bg-amber-400/20 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.28)]"
          : "border-cyan-300/25 bg-slate-950/65 hover:border-cyan-300/50 hover:text-cyan-100"
      }`}
    >
      {MenuIcons.journal}
      {hasRewards && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-none border border-amber-200/70 bg-amber-400 px-1 font-mono text-3xs font-black tabular-nums text-slate-950">
          {readyCount > 9 ? "9+" : readyCount}
        </span>
      )}
    </ClickButton>
  );
};

export default QuestJournalButton;
