import { useMemo, useState } from "react";
import { useNotifications } from "../../hooks/use-notification";
import { useQuestJournal } from "../../hooks/use-quest-journal";
import { useSoundEffects } from "../../hooks/use-sound-effects";
import { QuestJournalEntry } from "../../backend/quests-manager";
import {
  QUEST_CHAINS,
  QUEST_SPHERES,
  QUEST_TYPE_META,
  QuestReward,
  QuestTrigger,
  getQuestById,
} from "../../backend/quests-manager/quests-list";
import Modal from "../shared/Header";
import ModalTabs, { ModalTabItem } from "../shared/ModalTabs";
import { ClickButton } from "../shared/ClickButton";
import { CurrencyIcon } from "../shared/CurrencyIcon";
import { SectionTitle } from "../shared/DataGrid";

type JournalTab = "active" | "chains" | "archive";

const TABS: ModalTabItem<JournalTab>[] = [
  { id: "active", label: "⚡ В работе" },
  { id: "chains", label: "🧭 Цепочки" },
  { id: "archive", label: "📜 Архив" },
];

/** Русское склонение для счётчиков в уведомлениях и подписях. */
const pluralize = (
  count: number,
  one: string,
  few: string,
  many: string,
): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
};

/** Короткая подпись триггера для закрытых заданий. */
const triggerHint = (trigger: QuestTrigger): string => {
  switch (trigger.type) {
    case "always":
      return "Доступно сразу";
    case "chain": {
      const parent = getQuestById(trigger.parentId);

      return parent
        ? `Откроется после «${parent.title}»`
        : "Откроется позже";
    }
    case "metric":
      return "Откроется по мере развития колонии";
    case "event":
      return "Откроется после события в колонии";
    case "time":
      return "Откроется со временем";
    case "all":
      return "Откроется при выполнении всех условий";
    default:
      return "Откроется позже";
  }
};

const statusMeta: Record<
  QuestJournalEntry["status"],
  { label: string; className: string }
> = {
  locked: {
    label: "Закрыто",
    className: "border-white/10 bg-slate-900/60 text-slate-500",
  },
  active: {
    label: "В работе",
    className: "border-cyan-300/30 bg-cyan-500/10 text-cyan-200",
  },
  ready: {
    label: "Награда ждёт",
    className: "border-amber-300/40 bg-amber-400/15 text-amber-200",
  },
  claimed: {
    label: "Получено",
    className: "border-emerald-300/25 bg-emerald-500/10 text-emerald-200",
  },
};

const RewardLine = ({
  rewards,
  claimed,
}: {
  rewards: QuestReward;
  claimed?: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {rewards.tokens ? (
      <span className="ui-chip text-amber-200">
        <CurrencyIcon currency="tokens" className="h-3.5 w-3.5" />
        {rewards.tokens}
      </span>
    ) : null}
    {rewards.astroQuax ? (
      <span className="ui-chip text-sky-200">
        <CurrencyIcon currency="astro_quax" className="h-3.5 w-3.5" />
        {rewards.astroQuax}
      </span>
    ) : null}
    {rewards.lootboxes ? (
      <span className="ui-chip text-fuchsia-200">📦 {rewards.lootboxes}</span>
    ) : null}
    {rewards.geneDust ? (
      <span className="ui-chip text-cyan-200">✨ {rewards.geneDust}</span>
    ) : null}
    {rewards.toads?.map(({ toad, role }) => (
      <span
        key={toad.name ?? "crew-toad"}
        className="ui-chip border-emerald-300/30 text-emerald-200"
        title={role}
      >
        🐸 {toad.name ?? "Новый специалист"}
      </span>
    ))}
    {claimed ? (
      <span className="text-3xs font-semibold uppercase tracking-wide text-emerald-300/80">
        получено
      </span>
    ) : null}
  </div>
);

const QuestCard = ({
  entry,
  onClaim,
}: {
  entry: QuestJournalEntry;
  onClaim: (questId: string) => void;
}) => {
  const { quest, status, progress, target, percent, label } = entry;
  const sphere = QUEST_SPHERES[quest.sphere];
  const type = QUEST_TYPE_META[quest.type];
  const statusInfo = statusMeta[status];
  const locked = status === "locked";

  return (
    <div
      className={`ui-panel relative p-3 transition-colors ${
        status === "ready"
          ? "border-amber-300/40 bg-amber-500/[0.08]"
          : status === "claimed"
            ? "border-white/10 bg-slate-950/35 opacity-80"
            : locked
              ? "border-white/5 bg-slate-950/25 opacity-70"
              : `bg-slate-950/45 ${sphere.panelClass}`
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`ui-badge ${sphere.badgeClass}`}>
          {sphere.icon} {sphere.title}
        </span>
        <span className="ui-badge border-white/10 text-slate-400">
          {type.icon} {type.short}
        </span>
        <span className={`ui-badge ml-auto ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      </div>

      <h3 className="mt-2 flex items-center gap-1.5 text-sm font-bold text-slate-100">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 bg-current text-slate-600"
        />
        {quest.title}
      </h3>
      <p className="mt-1 text-2xs leading-snug text-slate-400">
        {quest.description}
      </p>
      {quest.lore ? (
        <p className="mt-1.5 border-l-2 border-cyan-400/30 pl-2 text-2xs italic leading-snug text-slate-500">
          {quest.lore}
        </p>
      ) : null}

      {locked ? (
        <p className="mt-2 flex items-center gap-1.5 border border-amber-300/15 bg-slate-950/40 px-2 py-1.5 text-2xs text-slate-500">
          <span aria-hidden="true">🔒</span>
          {triggerHint(quest.trigger)}
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between gap-2 text-2xs">
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold tabular-nums text-slate-200">
              {Math.min(progress, target)} / {target}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden border border-white/10 bg-slate-900/80">
            <div
              className={`h-full transition-[width] duration-500 ${sphere.barClass}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      )}

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <RewardLine rewards={quest.rewards} claimed={status === "claimed"} />
        {status === "ready" ? (
          <ClickButton
            type="button"
            onClick={() => onClaim(quest.id)}
            className="ui-button-primary shrink-0 px-3 py-1.5 text-2xs"
          >
            Забрать награду
          </ClickButton>
        ) : null}
      </div>
    </div>
  );
};

/**
 * ЖУРНАЛ ЗАДАНИЙ.
 *
 * Одна модалка на три вида: активные дела, цепочки и архив. Карточки строятся
 * из снимка движка, поэтому здесь нет ни одного порога или названия задания —
 * всё приходит из каталога (`quests-list.ts`). Новое задание появляется в UI
 * само, как только его триггер сработает.
 */
const QuestJournalModal = () => {
  const {
    entries,
    counts,
    ready,
    active,
    claimed,
    claim,
    claimAll,
    refresh,
  } = useQuestJournal();
  const [tab, setTab] = useState<JournalTab>("active");
  const { addNotification } = useNotifications();
  const { playSuccess, playError } = useSoundEffects();

  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.quest.id, entry])),
    [entries],
  );

  const archived = useMemo(
    () =>
      [...claimed].sort(
        (first, second) =>
          (second.claimedAt ?? 0) - (first.claimedAt ?? 0),
      ),
    [claimed],
  );

  const longQuestEntries = useMemo(
    () => entries.filter((entry) => entry.quest.type === "long"),
    [entries],
  );

  const completedTotal = counts.ready + counts.claimed;

  const handleClaim = (questId: string) => {
    const result = claim(questId);

    if (result.success) {
      playSuccess();
      addNotification({ type: "success", content: result.message });
    } else {
      playError();
      addNotification({ type: "warn", content: result.message });
    }

    refresh();
  };

  const handleClaimAll = () => {
    const results = claimAll();
    const claimedCount = results.filter((result) => result.success).length;

    if (claimedCount > 0) {
      playSuccess();
      addNotification({
        type: "success",
        content: `Получено ${claimedCount} ${pluralize(claimedCount, "задание", "задания", "заданий")}. Архив журнала обновлён.`,
      });
    } else {
      playError();
      addNotification({
        type: "warn",
        content: "Готовых наград пока нет.",
      });
    }

    refresh();
  };

  return (
    <Modal title="Журнал заданий" tone="amber">
      <div className="flex flex-col gap-3 px-1">
        <p className="text-2xs leading-snug text-slate-400">
          Короткие дела, средние цепочки и магистраль КОНТУРа. Мы не просто
          выводим жаб — мы собираем команду для глубоких секторов. Награду нужно
          забрать вручную: выполненное задание ждёт вас в журнале.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <div className="ui-panel px-2 py-2 text-center">
            <span className="block font-mono text-lg font-black tabular-nums text-amber-200">
              {counts.ready}
            </span>
            <span className="block text-3xs uppercase tracking-[0.12em] text-slate-500">
              к получению
            </span>
          </div>
          <div className="ui-panel px-2 py-2 text-center">
            <span className="block font-mono text-lg font-black tabular-nums text-cyan-200">
              {counts.active}
            </span>
            <span className="block text-3xs uppercase tracking-[0.12em] text-slate-500">
              в работе
            </span>
          </div>
          <div className="ui-panel px-2 py-2 text-center">
            <span className="block font-mono text-lg font-black tabular-nums text-emerald-200">
              {completedTotal}
            </span>
            <span className="block text-3xs uppercase tracking-[0.12em] text-slate-500">
              из {counts.total} закрыто
            </span>
          </div>
        </div>

        <ModalTabs tabs={TABS} active={tab} onChange={setTab} />

        {ready.length > 0 ? (
          <div className="ui-panel flex items-center justify-between gap-2 border-amber-300/30 bg-amber-500/10 px-3 py-2">
            <span className="flex items-center gap-1.5 text-2xs text-amber-100/90">
              <span aria-hidden="true" className="text-amber-300">
                ▸
              </span>
              {ready.length}{" "}
              {pluralize(ready.length, "награда", "награды", "наград")}{" "}
              {pluralize(ready.length, "готова", "готовы", "готовы")} к
              получению
            </span>
            <ClickButton
              type="button"
              onClick={handleClaimAll}
              className="ui-button-primary shrink-0 px-3 py-1.5 text-2xs"
            >
              Забрать всё
            </ClickButton>
          </div>
        ) : null}

        {tab === "active" ? (
          <div className="flex flex-col gap-4">
            {ready.length > 0 ? (
              <section className="flex flex-col gap-2">
                <SectionTitle aside={`${ready.length} шт.`}>
                  <span aria-hidden="true">🎁</span> Награды ждут
                </SectionTitle>
                <div className="grid gap-2 md:grid-cols-2">
                  {ready.map((entry) => (
                    <QuestCard
                      key={entry.quest.id}
                      entry={entry}
                      onClaim={handleClaim}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {active.length > 0 ? (
              <section className="flex flex-col gap-2">
                <SectionTitle aside={`${active.length} шт.`}>
                  <span aria-hidden="true">⚡</span> В работе
                </SectionTitle>
                <div className="grid gap-2 md:grid-cols-2">
                  {active.map((entry) => (
                    <QuestCard
                      key={entry.quest.id}
                      entry={entry}
                      onClaim={handleClaim}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {ready.length === 0 && active.length === 0 ? (
              <div className="ui-panel p-5 text-center text-2xs italic text-slate-400">
                Пока нет активных заданий. Загляните в «Цепочки» — магистраль
                КОНТУРа всегда открыта.
              </div>
            ) : null}

            {counts.locked > 0 ? (
              <p className="text-center text-3xs text-slate-500">
                Ещё {counts.locked}{" "}
                {pluralize(counts.locked, "задание", "задания", "заданий")}{" "}
                {pluralize(
                  counts.locked,
                  "откроется",
                  "откроются",
                  "откроются",
                )}{" "}
                по мере прогресса колонии.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "chains" ? (
          <div className="flex flex-col gap-3">
            {QUEST_CHAINS.map((chain) => {
              const chainEntries = chain.taskIds
                .map((id) => entryById.get(id))
                .filter((entry): entry is QuestJournalEntry => Boolean(entry));
              const finished = chainEntries.filter(
                (entry) =>
                  entry.status === "ready" || entry.status === "claimed",
              ).length;
              const sphere = QUEST_SPHERES[chain.sphere];

              return (
                <section key={chain.id} className="ui-panel p-3">
                  <SectionTitle
                    aside={`${finished} / ${chainEntries.length}`}
                  >
                    <span aria-hidden="true">{sphere.icon}</span> {chain.title}
                  </SectionTitle>
                  <p className="mt-1 text-2xs leading-snug text-slate-400">
                    {chain.description}
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {chainEntries.map((entry) => (
                      <QuestCard
                        key={entry.quest.id}
                        entry={entry}
                        onClaim={handleClaim}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            <section className="ui-panel border-sky-400/20 p-3">
              <SectionTitle
                aside={`${longQuestEntries.filter(
                  (entry) =>
                    entry.status === "ready" || entry.status === "claimed",
                ).length} / ${longQuestEntries.length}`}
              >
                <span aria-hidden="true">🗺️</span> Магистраль КОНТУРа
              </SectionTitle>
              <p className="mt-1 text-2xs leading-snug text-slate-400">
                Пять долгих заданий ведут через весь Периметр — от первого шлюза
                до центра станции и звания хозяина Периметра.
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {longQuestEntries.map((entry) => (
                  <QuestCard
                    key={entry.quest.id}
                    entry={entry}
                    onClaim={handleClaim}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "archive" ? (
          <div className="flex flex-col gap-2">
            {archived.length > 0 ? (
              archived.map((entry) => (
                <QuestCard
                  key={entry.quest.id}
                  entry={entry}
                  onClaim={handleClaim}
                />
              ))
            ) : (
              <div className="ui-panel p-5 text-center text-2xs italic text-slate-400">
                Архив пуст. Здесь появятся задания с полученной наградой.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default QuestJournalModal;

