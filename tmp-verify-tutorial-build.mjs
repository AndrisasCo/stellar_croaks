/**
 * Проверка правила обучения «Первый сектор»: магазин нельзя ставить на обесточенный гекс
 * (на реальном коде проекта).
 *
 * В задании `build-shop` Торговая капсула должна стоять под током: иначе обучение закроется,
 * а сектор останется без электричества. Скрипт бандлит модули через esbuild и проверяет:
 *   1) на стартовой карте есть и гекс под током, и обесточенный;
 *   2) магазин на гексе под током разрешён, на обесточенном — заблокирован с причиной;
 *   3) вне задания и на другие виды секторов правило не действует;
 *   4) ⚡-сектор с кормлённой жабой питает соседний гекс — магазин там снова разрешён.
 *
 * Запуск: node tmp-verify-tutorial-build.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-tutorial-"));
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

const colonyBuild = bundle(
  "src/components/HexMap/colony-build.ts",
  "colony-build",
);
const geometry = bundle("src/components/HexMap/hex-geometry.ts", "geometry");

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
};
const checkTrue = (label, value) => check(label, Boolean(value), true);

/** Пустая колония: на карте только ядро и биопод. */
const colony = { rooms: [], demolished: [] };
const startMap = colonyBuild.resolveColonyRooms(colony);
const slots = startMap.filter((room) => colonyBuild.canBuildOnSlot(room, startMap));

const poweredSlot = slots.find((slot) =>
  colonyBuild.willBePoweredAfterBuild(slot, "shop", colony, {}),
);
const unpoweredSlot = slots.find(
  (slot) => !colonyBuild.willBePoweredAfterBuild(slot, "shop", colony, {}),
);

checkTrue("на старте есть гекс под током", poweredSlot);
checkTrue("на старте есть обесточенный гекс", unpoweredSlot);

const issueFor = (slot, kind, task, state = colony, toads = {}) =>
  colonyBuild.getTutorialBuildIssue(slot, kind, state, toads, task);

check(
  "магазин на гексе под током разрешён",
  issueFor(poweredSlot, "shop", "build-shop"),
  null,
);
const blocked = issueFor(unpoweredSlot, "shop", "build-shop");
checkTrue("магазин на обесточенном гексе заблокирован", blocked);
checkTrue("причина блокировки говорит про ток", blocked.includes("ток"));
check("вне задания магазин разрешён", issueFor(unpoweredSlot, "shop", null), null);
check(
  "другое задание не блокирует магазин",
  issueFor(unpoweredSlot, "shop", "feed"),
  null,
);
check(
  "другой сектор не блокируется",
  issueFor(unpoweredSlot, "storage", "build-shop"),
  null,
);

/** ⚡-сектор с одной сытой жабой питает соседний гекс — магазин там снова можно. */
const pair = slots
  .map((slot) => ({
    slot,
    neighbour: slots.find(
      (other) =>
        other.id !== slot.id &&
        geometry
          .hexNeighbors(slot.coord)
          .some(
            (coord) => coord.q === other.coord.q && coord.r === other.coord.r,
          ),
    ),
  }))
  .find(
    ({ slot, neighbour }) =>
      neighbour &&
      !colonyBuild.willBePoweredAfterBuild(slot, "shop", colony, {}),
  );

checkTrue("нашли пару «обесточенный гекс — соседний ⚡-гекс»", pair);

if (pair) {
  const powerColony = {
    rooms: [{ id: pair.neighbour.id, kind: "power", builtAt: "" }],
    demolished: [],
  };
  const fedToad = {
    id: 1,
    stage: "adult",
    status: "in",
    hp: 1,
    state: { hunger: 100 },
  };
  const toadsByRoom = { [pair.neighbour.id]: [fedToad] };

  checkTrue(
    "без жаб в ⚡-секторе соседний гекс обесточен",
    !colonyBuild.willBePoweredAfterBuild(pair.slot, "shop", powerColony, {}),
  );
  check(
    "магазин рядом с запитанным ⚡-сектором разрешён",
    issueFor(pair.slot, "shop", "build-shop", powerColony, toadsByRoom),
    null,
  );
}

console.log("\n" + "─".repeat(60));
if (failures.length > 0) {
  console.log(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((item) => console.log(`   • ${item}`));
  process.exit(1);
}

console.log("✅ Все проверки правила обучения прошли");
