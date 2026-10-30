/**
 * Проверка генной пыли ✨ — материала коллайдера и товара рынка.
 *
 * Пыль переименована из «крафтовой», но ключ сохранения остался `craftDust`,
 * чтобы запасы игроков не обнулились. Скрипт гоняет РЕАЛЬНЫЙ код
 * (`src/utils/gene-dust.ts` и `src/models/user.ts` бандлятся esbuild-ом):
 *   1) enum и метаданные: `Items.geneDust` = "craftDust", название «Генная пыль»;
 *   2) бонус коллайдера: 0…10 пылинок = +0…10% к качеству, с округлением;
 *   3) списание: уходит только имеющееся, остаток не уходит в минус;
 *   4) продажа: 1 шт = 5 Кваксов, выручка не теряется;
 *   5) UI: в коллайдере ползунок и списание после старта, в продаже — свой ползунок;
 *   6) в коде не осталось обращений к старому `Items.craftDust`.
 *
 * Запуск: node tmp-verify-gene-dust.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-gene-dust-"));
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

/** Сейв с нужным количеством пыли и Кваксов */
const stubState = (user = {}) => ({
  user: {
    id: "u1",
    tg_id: 1,
    username: "tester",
    tokens: 500,
    astro_quax: 0,
    biomass: 100,
    storage: { food: 10, craftDust: 7 },
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

/** Платформенный слой читает localStorage через `window.localStorage` */
globalThis.window.localStorage = globalThis.localStorage;

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

const model = bundle("src/models/user.ts", "user-model");
const gene = bundle("src/utils/gene-dust.ts", "gene-dust");

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

console.log("\n[1] Переименование: «Генная пыль», ключ сохранения не менялся");
console.log("─".repeat(60));
check("Items.geneDust", model.Items.geneDust, "craftDust");
check(
  "название предмета",
  model.itemsFull[model.Items.geneDust].name,
  "Генная пыль",
);
checkText(
  "описание объясняет коллайдер и цену",
  model.itemsFull[model.Items.geneDust].description,
  /коллайдер.*5 Кваксов/i,
);

console.log("\n[2] Бонус коллайдера: 0…10 пылинок = +0…10% качества");
console.log("─".repeat(60));
check("лимит за смешивание", gene.GENE_DUST_MAX_PER_MIX, 10);
check("цена продажи", gene.GENE_DUST_SELL_PRICE, 5);
check("0 пылинок → 0%", gene.getGeneDustBonusPercent(0), 0);
check("5 пылинок → +5%", gene.getGeneDustBonusPercent(5), 5);
check("10 пылинок → +10%", gene.getGeneDustBonusPercent(10), 10);
check("больше лимита режется до +10%", gene.getGeneDustBonusPercent(25), 10);
check("отрицательное значение → 0%", gene.getGeneDustBonusPercent(-4), 0);
check("дробное значение → целые пылинки", gene.getGeneDustBonusPercent(3.9), 3);
check("множитель без пыли", gene.getGeneDustRarityMultiplier(0), 1);
check("множитель 10 пылинок", gene.getGeneDustRarityMultiplier(10), 1.1);
check("качество 100 + 10%", gene.applyGeneDustToRarity(100, 10), 110);
check("качество 50 + 5%", gene.applyGeneDustToRarity(50, 5), 52.5);
check("качество 0 не портится", gene.applyGeneDustToRarity(0, 10), 0);
check("округление до сотых", gene.applyGeneDustToRarity(33.33, 1), 33.66);
check("нет пыли — качество не меняется", gene.applyGeneDustToRarity(77.7, 0), 77.7);

console.log("\n[3] Склад: отрицательные и дробные остатки не считаются");
console.log("─".repeat(60));
check("7.9 → 7 пылинок", gene.getGeneDustCount({ craftDust: 7.9 }), 7);
check("отрицательное → 0", gene.getGeneDustCount({ craftDust: -3 }), 0);
check("пустой склад → 0", gene.getGeneDustCount({}), 0);

console.log("\n[4] Продажа: 1 пылинка = 5 Кваксов");
console.log("─".repeat(60));
check("0 шт → 0 🔷", gene.getGeneDustSellTokens(0), 0);
check("1 шт → 5 🔷", gene.getGeneDustSellTokens(1), 5);
check("7 шт → 35 🔷", gene.getGeneDustSellTokens(7), 35);
check("дробное → целые", gene.getGeneDustSellTokens(2.9), 10);
check("отрицательное → 0", gene.getGeneDustSellTokens(-5), 0);

console.log("\n[5] Списание в коллайдер: только имеющееся, без минуса");
console.log("─".repeat(60));
reset({ tokens: 500, storage: { food: 10, craftDust: 7 } });
const spendPart = gene.spendGeneDust(3);
check("списание прошло", spendPart.success, true);
check("списали 3 ✨", spendPart.spent, 3);
check("осталось 4 ✨", account().storage.craftDust, 4);
const spendOver = gene.spendGeneDust(100);
check("запрос больше запаса прошёл", spendOver.success, true);
check("списали только 4 ✨", spendOver.spent, 4);
check("склад пуст, не минус", account().storage.craftDust, 0);
check("списание нуля не проходит", gene.spendGeneDust(0).success, false);

console.log("\n[6] Продажа пыли: Кваксы на счету");
console.log("─".repeat(60));
reset({ tokens: 500, storage: { food: 10, craftDust: 7 } });
const soldPart = gene.sellGeneDust(3);
check("продажа прошла", soldPart.success, true);
check("продали 3 ✨", soldPart.sold, 3);
check("выручка 15 🔷", soldPart.tokensGained, 15);
check("Кваксы на счету", account().tokens, 515);
check("осталось 4 ✨", account().storage.craftDust, 4);

reset({ tokens: 500, storage: { food: 10, craftDust: 4 } });
const soldAll = gene.sellGeneDust(9);
check("запрос больше запаса: продали 4 ✨", soldAll.sold, 4);
check("выручка 20 🔷", soldAll.tokensGained, 20);
check("Кваксы на счету", account().tokens, 520);
check("склад пуст", account().storage.craftDust, 0);
check("продажа нуля не проходит", gene.sellGeneDust(0).success, false);

console.log("\n[7] UI: ползунки в коллайдере и на вкладке «Продать»");
console.log("─".repeat(60));
const collider = readFileSync(
  join(root, "src/components/modals/Lab/ToadColliderModal.tsx"),
  "utf8",
);
const sellSource = readFileSync(
  join(root, "src/components/modals/ShopMenu/SellTab.tsx"),
  "utf8",
);

checkText("коллайдер: ползунок", collider, /type="range"/);
checkText("коллайдер: левый край 0", collider, /min="0"/);
checkText("коллайдер: шаг 1 ✨", collider, /step="1"/);
checkText("коллайдер: максимум = запас", collider, /max=\{maxDust\}/);
checkText("коллайдер: показывает бонус", collider, /\+\{dustBonus\}%/);
checkText(
  "коллайдер: пыль поднимает качество ребёнка",
  collider,
  /applyGeneDustToRarity\(child\.genes\.rarity, dustToUse\)/,
);
checkText("коллайдер: списывает пыль", collider, /spendGeneDust\(dustToUse\)/);
check(
  "коллайдер: списание после успешного старта",
  collider.indexOf("spendGeneDust(dustToUse)") >
    collider.indexOf("if (!startBreeding(child))"),
  true,
);

checkText("продажа: ползунок ✨", sellSource, /type="range"/);
checkText("продажа: максимум = запас", sellSource, /max=\{dustAvailable\}/);
checkText(
  "продажа: выручка по курсу 5 🔷",
  sellSource,
  /getGeneDustSellTokens\(sellDust\)/,
);
checkText("продажа: продаёт выбранное", sellSource, /sellGeneDust\(sellDust\)/);
checkText("продажа: курс показан", sellSource, /GENE_DUST_SELL_PRICE/);
checkText("продажа: берёт пыль со склада", sellSource, /Items\.geneDust/);

console.log("\n[8] Старого имени `Items.craftDust` в коде не осталось");
console.log("─".repeat(60));
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const oldRefs = walk(join(root, "src"))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => /Items\.craftDust/.test(readFileSync(file, "utf8")));
check("файлов со старым именем", oldRefs.length, 0);
if (oldRefs.length > 0) {
  oldRefs.forEach((file) => console.log(`   · ${file}`));
}

console.log("\n" + "═".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   · ${item}`));
  process.exitCode = 1;
} else {
  console.log("✅ Все проверки генной пыли прошли");
}

