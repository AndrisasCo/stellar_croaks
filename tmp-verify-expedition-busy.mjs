/**
 * Проверка единого правила «жаба занята походом» (на РЕАЛЬНОМ коде проекта).
 *
 * Скрипт бандлит модули через esbuild и гоняет те же функции, что работают в игре:
 *   1) свободная жаба: энергосектор, перенос, карта и выработка доступны;
 *   2) жаба в пути (`status: "out"`) не даёт ток, не видна в секторе и не переносится;
 *   3) вернувшаяся жаба, пока добыча не разобрана, всё ещё занята походом —
 *      тот же запрет действует без статуса `out`;
 *   4) после разбора добычи (запись похода убрана) запреты снимаются.
 *
 * Запуск: node tmp-verify-expedition-busy.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-expedition-busy-"));
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

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

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

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window.localStorage = globalThis.localStorage;

const manager = bundle("src/utils/expedition-manager.ts", "expedition-manager");
const power = bundle("src/components/HexMap/colony-power.ts", "colony-power");
const production = bundle(
  "src/utils/production-manager.ts",
  "production-manager",
);
const rooms = bundle("src/components/HexMap/rooms-config.ts", "rooms-config");
const moveRules = bundle(
  "src/components/HexMap/toad-move-rules.ts",
  "toad-move-rules",
);

const toad = (over = {}) => ({
  id: 1,
  name: "Жаба 1",
  stage: "adult",
  generation: 1,
  sex: "female",
  type: "hybrid",
  scene_id: 1,
  homeId: 1,
  created_at: new Date().toISOString(),
  parents: null,
  state: { hunger: 100, hp: 100, energy: 100 },
  pregnancy: null,
  status: "alive",
  energy: 100,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 60,
    speed: 1.5,
    rarity: 20,
    hungerRate: 1.5,
    fertility: 3,
    personality: null,
  },
  ...over,
});

const expedition = (over = {}) => ({
  id: "e1",
  sectorId: 1,
  team: [{ toadId: 1, role: "scout" }],
  startedAt: Date.now() - 3 * 60 * 60 * 1000,
  phase: "completed",
  progress: 1,
  resolvedSteps: 6,
  successChance: 1,
  loot: { biomass: 1, tokens: 1, astro_quax: 0, items: {}, samples: 0 },
  log: [],
  ...over,
});

/** Сейв, из которого читают правила без явно переданного списка походов */
const setState = (patch = {}) => {
  const state = {
    user: {
      id: "u1",
      tg_id: 1,
      username: "tester",
      tokens: 50,
      astro_quax: 10,
      biomass: 100,
      storage: { food: 100, contourPass: 0 },
    },
    scenes: [{ id: 1, name: "Био Под", capacity: 2, created_at: "" }],
    toads: [toad()],
    colony: { rooms: [] },
    expeditions: [],
    expeditionStats: {
      completed: 0,
      bestDepth: 0,
      downed: 0,
      unlockedSectors: [],
    },
    lastSaved: "",
    createdAt: "",
    ...patch,
  };

  globalThis.localStorage.setItem("Game_State6", JSON.stringify(state));
};

console.log("\n[1] Свободная жаба: обычные действия доступны");
setState();
const free = toad();
check("в походе", manager.isToadBusyOnExpedition(free), false);
check("проблема энергосектора", power.getToadPowerIssue(free), null);
check("ток даёт", power.isToadPowering(free), true);
check("мощность", power.getToadPowerCapacity([free]), 1);
check("видна в секторе", rooms.isToadVisibleInRoom(free), true);
check("перенос разрешён", moveRules.getToadMoveIssue(free), null);
check(
  "выработка считается",
  production.getSceneProductionRate([free]) > 0,
  true,
);

console.log("\n[2] Жаба в пути (status: out)");
setState({
  toads: [toad({ status: "out" })],
  expeditions: [expedition({ phase: "outbound" })],
});
const out = toad({ status: "out" });
check("в походе", manager.isToadBusyOnExpedition(out), true);
check("причина энергосектора", power.getToadPowerIssue(out), "Жаба в походе");
check("ток не даёт", power.isToadPowering(out), false);
check("мощность", power.getToadPowerCapacity([out]), 0);
check("не видна в секторе", rooms.isToadVisibleInRoom(out), false);
check(
  "причина переноса",
  moveRules.getToadMoveIssue(out),
  manager.EXPEDITION_TOAD_BUSY_REASON,
);
check("выработки нет", production.getSceneProductionRate([out]), 0);

console.log("\n[3] Жаба вернулась, но добыча не разобрана");
setState({ toads: [toad()], expeditions: [expedition()] });
const returned = toad();
check("статус уже не out", returned.status === "out", false);
check("всё ещё занята походом", manager.isToadBusyOnExpedition(returned), true);
check(
  "причина энергосектора",
  power.getToadPowerIssue(returned),
  "Жаба в походе",
);
check("ток не даёт", power.isToadPowering(returned), false);
check("мощность", power.getToadPowerCapacity([returned]), 0);
check("не видна в секторе", rooms.isToadVisibleInRoom(returned), false);
check(
  "причина переноса без флага",
  moveRules.getToadMoveIssue(returned),
  manager.EXPEDITION_TOAD_BUSY_REASON,
);
check(
  "перенос с флагом занята",
  moveRules.getToadMoveIssue(returned, { onExpedition: true }),
  manager.EXPEDITION_TOAD_BUSY_REASON,
);
check("выработки нет", production.getSceneProductionRate([returned]), 0);

console.log("\n[4] После разбора добычи поход убран из сейва");
setState({ toads: [toad()], expeditions: [] });
check("жаба снова свободна", manager.isToadBusyOnExpedition(returned), false);
check("ток даёт", power.isToadPowering(returned), true);
check("видна в секторе", rooms.isToadVisibleInRoom(returned), true);
check(
  "выработка вернулась",
  production.getSceneProductionRate([returned]) > 0,
  true,
);

if (failures.length > 0) {
  console.error(`\n❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(`   • ${failure}`));
  process.exit(1);
}

console.log("\n✅ Единое правило похода работает во всех проверенных путях");
