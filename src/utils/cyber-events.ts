// === ЧАСТЬ 3.6. Кибер-события и ЧАСТЬ 4. Киберпанк-сеттинг ===
// Техногенные события биокупола: утечки, сбои, нано-плесень и редкие удачи.

export type CyberEventKind = "negative" | "positive";

export interface CyberEventEffect {
  /** Дельта биомассы аккаунта */
  biomass?: number;
  /** Дельта голода случайной жабы биопода */
  hunger?: number;
  /** Выдача корма */
  food?: number;
  /** Выдача Кваксов */
  tokens?: number;
  /** Заразить случайную жабу кибер-болезнью */
  infect?: boolean;
}

export interface CyberEventDef {
  id: string;
  kind: CyberEventKind;
  title: string;
  message: string;
  effect: CyberEventEffect;
}

/**
 * Шанс события за час игры.
 *
 * Раньше 0.35 давало в среднем ~8 событий в сутки — слишком много для «редкого»
 * техногенного фона. 0.06 — примерно 1.4 события в сутки; жёсткий предел
 * (`MAX_CYBER_EVENTS_PER_DAY`) не даёт выйти за два.
 */
export const CYBER_EVENT_CHANCE_PER_HOUR = 0.06;
/** Больше двух кибер-событий за любые 24 часа не бывает */
export const MAX_CYBER_EVENTS_PER_DAY = 2;

export const CYBER_EVENTS: CyberEventDef[] = [
  {
    id: "drone_scan",
    kind: "negative",
    title: "Дрон-санитар",
    message: "Дрон-санитар просканировал сектор и оштрафовал лабораторию за «органику».",
    effect: { biomass: -8 },
  },
  {
    id: "coolant_leak",
    kind: "negative",
    title: "Утечка охлаждайки",
    message: "Утечка охлаждайки: часть биомассы ушла в дренаж.",
    effect: { biomass: -15 },
  },
  {
    id: "thermostat_failure",
    kind: "negative",
    title: "Сбой термостата",
    message: "Сбой термостата: жабы измучились и проголодались.",
    effect: { hunger: -25 },
  },
  {
    id: "nano_mold",
    kind: "negative",
    title: "Нано-плесень",
    message: "Нано-плесень атаковала биокупол — одна из жаб подхватила заражение.",
    effect: { infect: true },
  },
  {
    id: "biomass_feed_cut",
    kind: "negative",
    title: "Отключение подачи биомассы",
    message: "Подача биомассы отключилась: корм частично испортился.",
    effect: { food: -10 },
  },
  {
    id: "sample_escape",
    kind: "negative",
    title: "Побег образца",
    message: "Побег образца! Жабы израсходовали биомассу на его поимку, но вернули часть корма.",
    effect: { biomass: -10, food: 6 },
  },
  {
    id: "biocupola_bloom",
    kind: "positive",
    title: "Цветение биокупола",
    message: "Плановое цветение биокупола: выработка скакнула, биомасса бьёт ключом.",
    effect: { biomass: 22, hunger: 15 },
  },
  {
    id: "drosophila_migration",
    kind: "positive",
    title: "Миграция дрозофил v2",
    message: "Миграция дрозофил v2: жабы наелись и взбодрились.",
    effect: { hunger: 30, biomass: 6 },
  },
  {
    id: "research_grant",
    kind: "positive",
    title: "Грант на исследования",
    message: "Грант на исследования: лаборатория получила Кваксы.",
    effect: { tokens: 25 },
  },
  {
    id: "glitch_in_favor",
    kind: "positive",
    title: "Сбой в пользу жаб",
    message: "Сбой в пользу жаб: автоматика выписала лишнюю партию биомассы.",
    effect: { biomass: 14, food: 8 },
  },
];

export const pickCyberEvent = (kind?: CyberEventKind): CyberEventDef => {
  const pool = kind ? CYBER_EVENTS.filter((e) => e.kind === kind) : CYBER_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
};
