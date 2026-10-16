/**
 * Проверка продажи биомассы ползунком («Космический рынок» → вкладка «Продать»).
 *
 * Биомасса больше не продаётся одной кнопкой «продать всё»: игрок ползунком выбирает,
 * сколько отдать (0 … вся имеющаяся), а кнопка «Обменять» продаёт выбранную часть.
 * Скрипт гоняет РЕАЛЬНЫЙ код (`src/utils/production-manager.ts` бандлится esbuild-ом)
 * и проверяет расчёт обмена и границы ползунка:
 *   1) курс: 2 биомассы = 1 Квакс, неполный Квакс не берётся (`getBiomassExchangeTokens`);
 *   2) обмен части: продали 10 🧪 — ушло 10 🧪, на счету +5 🔷, остальная биомасса цела;
 *   3) без аргумента продаётся вся биомасса — прежнее поведение кнопки «всё»;
 *   4) дробная биомасса: 12.5 🧪 → 6 🔷, уходит 12 🧪, 0.5 🧪 остаётся на счету;
 *   5) нечётная биомасса: 11 🧪 → 5 🔷, уходит 10 🧪, 1 🧪 остаётся (неполный Квакс);
 *   6) запрос больше, чем есть, продаёт только имеющееся — ползунок не уводит в минус;
 *   7) меньше двух единиц биомассы: обмен не проходит и состояние не меняется (0.5 🧪);
 *   8) модалка (`modals/ShopMenu/SellTab.tsx`): вместо кнопки «всё» — ползунок
 *      `type="range"` с `min="0"` и `max` = вся биомасса, продаётся выбранное количество.
 *
 * Запуск: node tmp-verify-biomass-sell.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-biomass-sell-"));
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

// Заглушки браузера: сохранение игры пишет в localStorage и шлёт событие на window
globalThis.CustomEvent ||= class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
globalThis.window ||= {
  dispatchEvent: () => true,
  addEventListener: () => {},
  Telegram: { WebApp: { initDataUnsafe: {} } },
};

/** Сейв с нужным количеством биомассы и Кваксов */
const stubState = (user = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 500,
    astro_quax: 0,
    biomass: 100,
    storage: { food: 10 },
    ...user,
  },
  scenes: [{ id: 1, name: "Биопод #1", capacity: 20, created_at: "" }],
  toads: [],
  colony: { rooms: [] },
  expeditions: [],
  expeditionStats: { completed: 0, bestDepth: 0, downed: 0 },
  lastSaved: new Date().toISOString(),
  createdAt: new Date().toISOString(),
});

let raw = JSON.stringify(stubState());
let achievementsRaw = "";

globalThis.localStorage = {
  getItem: (key) => (key === "achivements" ? achievementsRaw : raw),
  setItem: (key, value) => {
    if (key === "achivements") {
      achievementsRaw = value;
      return;
    }
    raw = value;
  },
  removeItem: (key) => {
    if (key === "achivements") {
      achievementsRaw = "";
      return;
    }
    raw = "";
  },
};

/** Платформенный слой читает localStorage через `window.localStorage` — в браузере это один объект */
globalThis.window.localStorage = globalThis.localStorage;

/** Сброс состояния игры перед проверкой */
const reset = (user) => {
  raw = JSON.stringify(stubState(user));
  achievementsRaw = JSON.stringify({
    completed: [],
    rewards: [],
    counter: {},
    toads_collection: [],
  });
};

const account = () => JSON.parse(raw).user;

const production = bundle("src/utils/production-manager.ts", "production-manager");
const cfg = bundle("src/utils/gamification-config.ts", "gamification-config");

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const checkText = (label, value, pattern) => {
  const ok = typeof value === "string" && pattern.test(value);
  if (!ok) {
    failures.push(`${label}: не найдено ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${ok ? "есть" : "нет"}`);
};

const checkNotText = (label, value, pattern) => {
  const ok = typeof value === "string" && !pattern.test(value);
  if (!ok) {
    failures.push(`${label}: осталось ${pattern}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${ok ? "нет" : "есть"}`);
};

const sellSource = readFileSync(
  join(root, "src/components/modals/ShopMenu/SellTab.tsx"),
  "utf8",
);

console.log("\n[1] Курс обмена: 2 биомассы = 1 Квакс, неполный Квакс не берётся");
console.log("─".repeat(60));
check("курс из настроек", cfg.BIOMASS_TO_TOKENS_RATE, 0.5);
check("0 🧪 → 0 🔷", production.getBiomassExchangeTokens(0), 0);
check("1 🧪 → 0 🔷 (на Квакс не хватает)", production.getBiomassExchangeTokens(1), 0);
check("2 🧪 → 1 🔷", production.getBiomassExchangeTokens(2), 1);
check("5 🧪 → 2 🔷 (неполный Квакс остаётся)", production.getBiomassExchangeTokens(5), 2);
check("12.5 🧪 → 6 🔷", production.getBiomassExchangeTokens(12.5), 6);
check("отрицательное количество → 0 🔷", production.getBiomassExchangeTokens(-10), 0);
check("за 2 🔷 уходит 4 🧪", production.getBiomassExchangeSpent(2), 4);
check("за 0 🔷 уходит 0 🧪", production.getBiomassExchangeSpent(0), 0);

console.log("\n[2] Ползунок продаёт выбранную часть биомассы");
console.log("─".repeat(60));
reset({ biomass: 100, tokens: 500 });
const part = production.exchangeBiomassForTokens(10);
check("обмен прошёл", part.success, true);
check("за 10 🧪 дали 5 🔷", part.tokensGained, 5);
check("биомассы ушло ровно 10 🧪", part.biomassSpent, 10);
check("биомасса на счету", account().biomass, 90);
check("Кваксы на счету", account().tokens, 505);

reset({ biomass: 100, tokens: 500 });
production.exchangeBiomassForTokens(30);
const part2 = production.exchangeBiomassForTokens(20);
check("вторая продажа части считается от остатка", part2.tokensGained, 10);
check("остаток биомассы после двух продаж", account().biomass, 50);
check("Кваксы после двух продаж", account().tokens, 525);

console.log("\n[3] Без аргумента продаётся вся биомасса — как кнопка «продать всё»");
console.log("─".repeat(60));
reset({ biomass: 12, tokens: 500 });
const all = production.exchangeBiomassForTokens();
check("за 12 🧪 дали 6 🔷", all.tokensGained, 6);
check("биомасса обнулилась", account().biomass, 0);
check("Кваксы на счету", account().tokens, 506);

reset({ biomass: 12.5, tokens: 500 });
const frac = production.exchangeBiomassForTokens();
check("дробная биомасса: 6 🔷", frac.tokensGained, 6);
check("ушло целых 12 🧪", frac.biomassSpent, 12);
check("0.5 🧪 осталось на счету", account().biomass, 0.5);

console.log("\n[4] Нечётная биомасса: неполный Квакс остаётся");
console.log("─".repeat(60));
reset({ biomass: 11, tokens: 500 });
const odd = production.exchangeBiomassForTokens(11);
check("за 11 🧪 дали 5 🔷", odd.tokensGained, 5);
check("ушло 10 🧪", odd.biomassSpent, 10);
check("1 🧪 осталось", account().biomass, 1);

console.log("\n[5] Запрос больше, чем есть: продаётся только имеющееся");
console.log("─".repeat(60));
reset({ biomass: 7, tokens: 500 });
const over = production.exchangeBiomassForTokens(999);
check("обмен прошёл", over.success, true);
check("за 7 🧪 дали 3 🔷", over.tokensGained, 3);
check("ушло 6 🧪", over.biomassSpent, 6);
check("биомасса не ушла в минус", account().biomass, 1);

console.log("\n[6] Меньше двух единиц биомассы: обмен не проходит, состояние цело");
console.log("─".repeat(60));
reset({ biomass: 1.5, tokens: 500 });
const small = production.exchangeBiomassForTokens(1.5);
check("обмен не прошёл", small.success, false);
check("Кваксов не дали", small.tokensGained, 0);
check("биомассы не списали", small.biomassSpent, 0);
check("биомасса на месте", account().biomass, 1.5);
check("Кваксы на месте", account().tokens, 500);

reset({ biomass: 1.5, tokens: 500 });
check("обмен нуля не проходит", production.exchangeBiomassForTokens(0).success, false);

console.log("\n[7] Ползунок «0 … вся имеющаяся биомасса» вместо кнопки «продать всё»");
console.log("─".repeat(60));
checkText("ползунок — это input type=range", sellSource, /type="range"/);
checkText("левый край ползунка — 0", sellSource, /min="0"/);
checkText("шаг ползунка — 1 🧪", sellSource, /step="1"/);
checkText(
  "правый край — вся имеющаяся биомасса",
  sellSource,
  /const maxBiomass = Math\.max\(0, Math\.floor\(biomass\)\);/,
);
checkText(
  "выбор ползунка ограничен максимумом",
  sellSource,
  /const sellBiomass = Math\.min\(biomassChoice \?\? maxBiomass, maxBiomass\);/,
);
checkText(
  "ползунок показывает, сколько Кваксов даст",
  sellSource,
  /const sellTokens = getBiomassExchangeTokens\(sellBiomass\);/,
);
checkText(
  "продаётся выбранное количество, а не всё",
  sellSource,
  /exchangeBiomassForTokens\(sellBiomass\)/,
);
checkNotText(
  "старого вызова «продать всё» без количества нет",
  sellSource,
  /exchangeBiomassForTokens\(\s*\)/,
);
checkText(
  "рядом осталась быстрая подстановка «вся биомасса»",
  sellSource,
  /вся биомасса/,
);
checkText(
  "видно, сколько останется после обмена",
  sellSource,
  /останется \{formatBiomass\(leftBiomass\)\} 🧪/,
);

console.log("\n" + "═".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   · ${item}`));
  process.exitCode = 1;
} else {
  console.log("✅ Все проверки продажи биомассы ползунком прошли");
}
