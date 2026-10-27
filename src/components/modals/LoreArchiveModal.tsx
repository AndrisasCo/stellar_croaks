import React from "react";
import Modal from "../shared/Header";
import {
  KVAZ_ACRONYM,
  KVAZ_NAME,
  LORE_ENTRIES,
  LORE_STATUS_CONFIG,
  STATION_NAME,
} from "../../utils/lore";

/**
 * «Архив КВАЗа» — восстановленные записи о станции, эксперименте и роли
 * дрона-хранителя. Необязательный лор: игра не блокирует доступ к нему и
 * не требует прочитать записи, чтобы продолжить обучение.
 */
const LoreArchiveModal: React.FC = () => {
  const icon = (
    <svg
      className="h-6 w-6 text-cyan-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );

  return (
    <Modal icon={icon} title={`Архив ${KVAZ_NAME}а`} tone="violet">
      <div className="flex flex-col gap-3">
        <div className="ui-panel relative border-cyan-400/25 bg-cyan-400/10 px-3 py-3">
          <p className="ui-kicker flex flex-wrap items-center gap-x-1.5">
            <span aria-hidden="true" className="text-cyan-300">
              ▸
            </span>
            Станция «{STATION_NAME}»
            <span aria-hidden="true" className="text-cyan-300/50">
              /
            </span>
            восстановлено {LORE_ENTRIES.length} записей
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-cyan-50">
            Фрагменты памяти бортового интеллекта. Часть данных повреждена, часть
            противоречит официальной сводке. {KVAZ_NAME} не уверен, что все
            записи принадлежат ему.
          </p>
          <p className="mt-2 text-2xs text-cyan-200/60">
            {KVAZ_NAME} — {KVAZ_ACRONYM}.
          </p>
        </div>

        {LORE_ENTRIES.map((entry, index) => {
          const status = LORE_STATUS_CONFIG[entry.status];

          return (
            <article
              key={entry.id}
              className="ui-panel relative px-3 py-3"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-cyan-400/30 bg-cyan-400/10 font-mono text-2xs font-bold tabular-nums text-cyan-200">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="ui-kicker truncate">{entry.source}</p>
                  <h3 className="mt-0.5 text-sm font-bold leading-tight text-white">
                    {entry.title}
                  </h3>
                </div>
                <span className={`ui-badge shrink-0 ${status.className}`}>
                  {status.label}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {entry.text}
              </p>

              {entry.quote && (
                <blockquote className="mt-2 border-l-2 border-cyan-400/50 bg-slate-950/40 px-3 py-2 text-sm italic leading-snug text-cyan-100">
                  «{entry.quote}»
                </blockquote>
              )}
            </article>
          );
        })}

        <p className="ui-panel relative border-amber-400/20 bg-amber-400/10 px-3 py-2 text-2xs leading-snug text-amber-100/90">
          ⚠️ Запись об «Оранжерее-0» запечатана. Координаты сектора в архиве
          отсутствуют — возможно, их удалил не {KVAZ_NAME}.
        </p>
      </div>
    </Modal>
  );
};

export default LoreArchiveModal;
