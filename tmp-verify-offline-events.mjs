/**
 * Проверка журнала событий отсутствия («События колонии»).
 *
 * Скрипт бандлит РЕАЛЬНЫЙ код (`src/utils/offline-events.ts`) через esbuild и проверяет:
 *   1) лимиты: журнал хранит до 50 записей, а показывает последние 20;
 *   2) непрочитанные лимитом не срезаются — ни «живые» (`readAt` ещё не стоит), ни
 *      закреплённые на момент открытия модалки (`pinnedAtOpen`: журнал сразу
 *      отмечается прочитанным, и живой `readAt` новое от старого уже не отличает);
 *   3) порядок списка: свежие события сверху;
 *   4) чтение/запись localStorage: мусор и битые записи не ломают журнал;
 *   5) прочитанность: счётчик непрочитанных и идемпотентная отметка `readAt`;
 *   6) модалка использует общий селектор и подсказывает про скрытые записи.
 *
 * Запуск: node tmp-verify-offline-events.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-offline-events-"));
const root = process.cwd();

/** Собрать модуль проекта в CJS, чтобы запустить его в node */
const bundle = (entry, name) => {
  const outfile = join(outDir, `${name}.cjs`);
  execFileSync(
    "npx",
    [
      "esbuild",
      entry,
      "--bundle",
      "--format=cjs",
      "--platform=node",
      "--log-level=error",
      `--outfile=${outfile}`,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );

  return require(outfile);
};

// Заглушка браузера: журнал читает и пишет localStorage устройства.
const store = new Map();
const localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.localStorage = localStorage;
globalThis.window = {
  localStorage,
  innerHeight: 800,
  matchMedia: () => ({ matches: true }),
};

// === Модуль проекта ===
const offlineEvents = bundle("src/utils/offline-events.ts", "offline-events");
const {
  MAX_OFFLINE_EVENTS,
  OFFLINE_EVENTS_STORAGE_KEY,
  OFFLINE_EVENTS_VISIBLE_LIMIT,
  countUnreadOfflineEvents,
  createOfflineEvent,
  formatOfflineEventTime,
  loadOfflineEvents,
  markOfflineEventsRead,
  saveOfflineEvents,
  selectVisibleOfflineEvents,
} = offlineEvents;

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};
const checkTrue = (label, value) => check(label, Boolean(value), true);

/** Событие с номером `index`: `at` растёт вместе с номером, свежие — с большим номером */
const makeEvent = (index, { read = false } = {}) => ({
  id: `e${index}`,
  at: 1_700_000_000_000 + index * 60_000,
  type: "info",
  content: `событие ${index}`,
  ...(read ? { readAt: 1_700_100_000_000 + index } : {}),
});
const makeEvents = (count, options) =>
  Array.from({ length: count }, (_, index) => makeEvent(index, options));
const eventIds = (list) => list.map((event) => event.id);

console.log("── 1. Лимиты журнала ────────────────────────────────────────");
check("в хранилище журнал держит", MAX_OFFLINE_EVENTS, 50);
check("в модалке показывает", OFFLINE_EVENTS_VISIBLE_LIMIT, 20);

console.log("\n── 2. Показ последних двадцати ──────────────────────────────");
const readOnly = makeEvents(25, { read: true });
const visibleReadOnly = selectVisibleOfflineEvents(readOnly);
check("прочитанные срезаются до лимита", visibleReadOnly.length, 20);
check("первым идёт самое свежее", visibleReadOnly[0].id, "e24");
check("двадцатым — шестое с конца", visibleReadOnly[19].id, "e5");
checkTrue(
  "старые прочитанные записи скрыты",
  !eventIds(visibleReadOnly).includes("e4"),
);


console.log("\n── 3. Непрочитанные не срезаются ────────────────────────────");
const unreadOnly = makeEvents(25);
check(
  "непрочитанные показываем все",
  selectVisibleOfflineEvents(unreadOnly).length,
  25,
);

// 4 старых непрочитанных + 18 свежих прочитанных: лимит не должен их спрятать
const mixed = [...makeEvents(4), ...makeEvents(22, { read: true }).slice(4)];
const visibleMixed = selectVisibleOfflineEvents(mixed);
check("лимит + старые непрочитанные", visibleMixed.length, 22);
checkTrue(
  "в списке все непрочитанные",
  ["e0", "e1", "e2", "e3"].every((id) => eventIds(visibleMixed).includes(id)),
);
check("порядок остался по времени", visibleMixed[0].id, "e21");
check("последним идёт старое непрочитанное", visibleMixed.at(-1).id, "e0");

// Модалка помечает журнал прочитанным сразу, поэтому непрочитанных «закрепляем»
// по id до отметки — иначе после markAllRead лимит срезал бы их как обычные записи.
const pinned = new Set(["e0", "e1", "e2", "e3"]);
const afterRead = markOfflineEventsRead(mixed);
const visiblePinned = selectVisibleOfflineEvents(afterRead, pinned);
check("закреплённые видны после отметки", visiblePinned.length, 22);
checkTrue(
  "старые непрочитанные не потерялись",
  ["e0", "e1", "e2", "e3"].every((id) => eventIds(visiblePinned).includes(id)),
);
check(
  "без закрепления остаются только последние 20",
  selectVisibleOfflineEvents(afterRead).length,
  20,
);

console.log("\n── 4. Параметры селектора ───────────────────────────────────");
check(
  "свой лимит",
  selectVisibleOfflineEvents(readOnly, new Set(), 5).length,
  5,
);
check("пустой журнал", selectVisibleOfflineEvents([]).length, 0);
const shuffled = [makeEvent(3), makeEvent(1), makeEvent(2)];
check(
  "порядок не зависит от входа",
  eventIds(selectVisibleOfflineEvents(shuffled)).join(","),
  "e3,e2,e1",
);

console.log("\n── 5. Прочитанность ─────────────────────────────────────────");
check("непрочитанных в смеси", countUnreadOfflineEvents(mixed), 4);
check("после отметки непрочитанных нет", countUnreadOfflineEvents(afterRead), 0);
const readAt = afterRead.find((event) => event.id === "e21").readAt;
checkTrue("readAt проставлен", Number.isFinite(readAt));
check(
  "повторная отметка не меняет время",
  markOfflineEventsRead(afterRead).find((event) => event.id === "e21").readAt,
  readAt,
);
check(
  "время события сохранилось",
  afterRead.find((event) => event.id === "e3").at,
  mixed.find((event) => event.id === "e3").at,
);

console.log("\n── 6. Хранилище устройства ──────────────────────────────────");
const newestFirst = makeEvents(60, { read: true }).reverse();
saveOfflineEvents(newestFirst);
const stored = JSON.parse(store.get(OFFLINE_EVENTS_STORAGE_KEY));
check("в localStorage остаётся лимит", stored.length, MAX_OFFLINE_EVENTS);
check("хранится самое свежее", stored[0].id, "e59");
check("старое вытеснено", stored.at(-1).id, "e10");
check("повторное чтение", loadOfflineEvents().length, MAX_OFFLINE_EVENTS);

// Битые данные не должны ломать загрузку игры — проверяем молча.
const warn = console.warn;
console.warn = () => {};
store.set(OFFLINE_EVENTS_STORAGE_KEY, "{ это не json");
check("битый JSON не ломает журнал", loadOfflineEvents().length, 0);
console.warn = warn;

store.set(
  OFFLINE_EVENTS_STORAGE_KEY,
  JSON.stringify([
    makeEvent(1, { read: true }),
    { id: "bad", at: "вчера", type: "info", content: "мусор" },
    { id: "bad2", at: 1, type: "unknown", content: "неизвестный тип" },
    null,
  ]),
);
check("мусорные записи отфильтрованы", loadOfflineEvents().length, 1);

console.log("\n── 7. Создание и формат времени ─────────────────────────────");
const created = createOfflineEvent({
  type: "success",
  content: "В репродукторе родились головастики",
});
check("тип события", created.type, "success");
checkTrue("id присвоен", created.id.length > 0);
checkTrue("время записано", Number.isFinite(created.at));
check("по умолчанию info", createOfflineEvent({ content: "текст" }).type, "info");
checkTrue(
  "id уникальны",
  createOfflineEvent({ content: "a" }).id !==
    createOfflineEvent({ content: "b" }).id,
);
checkTrue(
  "сегодняшнее время без даты",
  /^\d{2}:\d{2}$/.test(formatOfflineEventTime(Date.now())),
);
check("невалидное время", formatOfflineEventTime(Number.NaN), "");
check("бесконечность", formatOfflineEventTime(Number.POSITIVE_INFINITY), "");

console.log("\n── 8. Модалка использует лимит ──────────────────────────────");
const modalSource = readFileSync(
  join(root, "src/components/modals/OfflineEventsModal.tsx"),
  "utf8",
);
checkTrue(
  "список берётся из селектора",
  modalSource.includes("selectVisibleOfflineEvents(events, pinnedAtOpen)"),
);
checkTrue(
  "непрочитанных запоминаем до markAllRead",
  modalSource.includes("events.filter((event) => !event.readAt)"),
);
checkTrue(
  "подсказка про скрытые записи",
  modalSource.includes("OFFLINE_EVENTS_VISIBLE_LIMIT"),
);

console.log("\n────────────────────────────────────────────────────────────");
if (failures.length > 0) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.error(`   • ${item}`));
  process.exit(1);
}
console.log("✅ Журнал событий отсутствия: все проверки прошли");

