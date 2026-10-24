import { useCallback, useEffect, useState } from "react";
import {
  ClaimQuestResult,
  QUEST_JOURNAL_UPDATED_EVENT,
  QuestJournalSnapshot,
  claimAllQuestRewards,
  claimQuestReward,
  getQuestJournalSnapshot,
} from "../backend/quests-manager";

/**
 * Журнал заданий для React.
 *
 * Движок пересчитывает прогресс из сейва игры, поэтому хук обновляет снимок на
 * `gameStateUpdated` (любая запись игры) и на `questJournalUpdated` (открылось
 * или выполнилось задание). Никаких таймеров: журнал меняется только вместе
 * с игрой или действием игрока.
 */
export interface QuestJournalController extends QuestJournalSnapshot {
  claim: (questId: string) => ClaimQuestResult;
  claimAll: () => ClaimQuestResult[];
  refresh: () => void;
}

export const useQuestJournal = (): QuestJournalController => {
  const [snapshot, setSnapshot] = useState<QuestJournalSnapshot>(() =>
    getQuestJournalSnapshot(),
  );

  const refresh = useCallback(() => {
    setSnapshot(getQuestJournalSnapshot());
  }, []);

  useEffect(() => {
    // Первый снимок мог быть снят до появления ранних событий журнала
    refresh();

    const handleUpdate = () => refresh();

    window.addEventListener("gameStateUpdated", handleUpdate);
    window.addEventListener(QUEST_JOURNAL_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("gameStateUpdated", handleUpdate);
      window.removeEventListener(QUEST_JOURNAL_UPDATED_EVENT, handleUpdate);
    };
  }, [refresh]);

  const claim = useCallback(
    (questId: string) => {
      const result = claimQuestReward(questId);

      refresh();

      return result;
    },
    [refresh],
  );

  const claimAll = useCallback(() => {
    const results = claimAllQuestRewards();

    refresh();

    return results;
  }, [refresh]);

  return { ...snapshot, claim, claimAll, refresh };
};
