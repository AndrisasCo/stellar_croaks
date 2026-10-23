/**
 * Проверка нового сценария обучения и цены первого Репродуктора на реальном коде.
 *
 * Сценарий: Торговая капсула → покупка корма → кормление → постройка Репродуктора →
 * ухаживание → КОНТУР и первый поход. Скрипт бандлит модули через esbuild и проверяет:
 *   1) шаги рассказчика идут в нужном порядке и не обрываются;
 *   2) задания покупки корма, постройки Репродуктора, ухаживания и похода описаны;
 *   3) новый игрок начинает со 100 Кваксов и пустым складом (корм покупается);
 *   4) первый построенный Репродуктор стоит 0, дальше цена обычная (150, 225, …);
 *   5) у остальных секторов цена не изменилась.
 *
 * Запуск: node tmp-verify-tutorial-flow.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-tutorial-flow-"));
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

const narrator = bundle("src/utils/narrator.ts", "narrator");
const colonyBuild = bundle(
  "src/components/HexMap/colony-build.ts",
  "colony-build",
);
const localStorage = bundle("src/backend/localStorage.ts", "local-storage");

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const steps = narrator.NARRATOR_STEPS;

/** Пройти цепочку `next` от вступления и вернуть порядок шагов. */
const walk = () => {
  const order = [];
  const seen = new Set();
  let current = "intro";

  while (current && steps[current] && !seen.has(current)) {
    seen.add(current);
    order.push(current);
    current = steps[current].next;
  }

  return order;
};

const order = walk();
const link = (from, to) => steps[from]?.next === to;

check("обучение начинается со вступления", order[0], "intro");
check("Вступление ведёт к Торговой капсуле", link("intro2", "build-shop"), true);
check("Торговая капсула ведёт к рынку", link("build-shop", "trade-brief"), true);
check("Рынок ведёт к покупке корма", link("trade-brief", "buy-food"), true);
check("Покупка корма ведёт к ядру", link("buy-food", "core"), true);
check("Ядро ведёт к кормлению", link("core", "feed"), true);
check("Кормление ведёт к биомассе", link("feed", "biomass-brief"), true);
check("Биомасса ведёт к постройке Репродуктора", link("biomass-brief", "build-nest"), true);
check("Постройка ведёт к ухаживанию", link("build-nest", "breed"), true);
check("Ухаживание ведёт к КОНТУРу", link("breed", "breed-brief"), true);
check("Брифинг о потомстве ведёт к походу", link("breed-brief", "scout"), true);
check("Первый поход ведёт к финалу", link("scout", "finale"), true);
check("все шаги достижимы", order.length, 13);
check("покупка корма — задание", steps["buy-food"].kind, "task");
check("постройка Репродуктора — задание", steps["build-nest"].kind, "task");
check("ухаживание — задание", steps.breed.kind, "task");
check("поход — задание", steps.scout.kind, "task");
check("покупка корма в точках прогресса", narrator.NARRATOR_TASKS.includes("buy-food"), true);
check("постройка Репродуктора в точках прогресса", narrator.NARRATOR_TASKS.includes("build-nest"), true);

/** Стартовый сейв нового игрока: обучение начинается без корма, но со ста Кваксами. */
const start = localStorage.getDefaultGameState();
check("стартовые Кваксы", start.user.tokens, 100);
check("стартовый корм", start.user.storage.food, 0);
check(
  "стартовый склад пуст",
  Object.values(start.user.storage).every((amount) => amount === 0),
  true,
);

/** Колония без построек: базовые секторы в счёт не входят */
const emptyColony = { rooms: [], demolished: [] };
const builtRooms = (count, kind) =>
  Array.from({ length: count }, (_, i) => ({ id: `${kind}-${i}`, kind }));

check(
  "первый Репродуктор бесплатный",
  colonyBuild.getRoomCost(emptyColony, "breeding"),
  0,
);
check(
  "второй Репродуктор — обычная цена",
  colonyBuild.getRoomCost({ rooms: builtRooms(1, "breeding"), demolished: [] }, "breeding"),
  150,
);
check(
  "третий Репродуктор дороже по обычной кривой",
  colonyBuild.getRoomCost({ rooms: builtRooms(2, "breeding"), demolished: [] }, "breeding"),
  225,
);
check(
  "цена КОНТУРа не изменилась",
  colonyBuild.getRoomCost(emptyColony, "scout"),
  25,
);
check(
  "цена Торговой капсулы не изменилась",
  colonyBuild.getRoomCost(emptyColony, "shop"),
  0,
);

if (failures.length > 0) {
  console.error(`\n❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log("\n✅ Сценарий обучения и цена Репродуктора сходятся");
