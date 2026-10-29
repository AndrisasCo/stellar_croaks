/**
 * Проверка анимации стайки в секторе (на РЕАЛЬНОМ коде проекта).
 *
 * Гоняет `createRoomToads` через esbuild в node и смотрит, что жаба, вернувшаяся
 * из похода, живёт как обычная: ходит (state `walking`) и не зависает в прыжках —
 * отдельной «анимации встречи» нет. Прыжок остался только реакцией на тап (`react`).
 * Точка входа `tmp-verify-room-toads-entry.ts` нужна только для того, чтобы взять
 * `Texture` из той же копии pixi, что и у стайки: без неё `Sprite` в node не собрать.
 *
 * Запуск: node tmp-verify-room-toads.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-room-toads-"));
const root = process.cwd();

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

const flockModule = bundle("tmp-verify-room-toads-entry.ts", "room-toads");

/** Заглушка ресурсов: настоящие Texture, но без спрайтшита (картинка не нужна) */
const texturesRef = {
  current: {
    hybrid: Array.from({ length: 6 }, () => flockModule.Texture.EMPTY),
    toadpoleTextures: [flockModule.Texture.EMPTY],
  },
};

const toad = (over = {}) => ({
  id: 1,
  name: "Жаба 1",
  stage: "adult",
  generation: 1,
  sex: "female",
  type: "hybrid",
  scene_id: "slot-a",
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

/** Прогон стайки: считаем кадры по состояниям и смещение жабы */
const runFrames = (flock, frames) => {
  const seen = { idle: 0, walking: 0, jumping: 0 };
  const container = flock.getToad(1).container;
  const start = { x: container.x, y: container.y };

  for (let i = 0; i < frames; i += 1) {
    flock.update(1);
    const state = container.userData.state;
    seen[state] = (seen[state] ?? 0) + 1;
  }

  return {
    ...seen,
    moved: Math.hypot(container.x - start.x, container.y - start.y),
  };
};

const makeFlock = () => {
  const flock = flockModule.createRoomToads({ x: 0, y: 0 }, 120, texturesRef);
  flock.sync([toad()], { 1: { x: 0, y: 0 } });
  return flock;
};

console.log("\n[1] Обычная жаба сектора гуляет");
setState();
const plain = makeFlock();
const plainRun = runFrames(plain, 3000);
check("прыжков нет", plainRun.jumping, 0);
check("ходит", plainRun.walking > 0, true);
check("сдвинулась с места", plainRun.moved > 1, true);

console.log("\n[2] Вернувшаяся из похода жаба гуляет так же, без прыжков встречи");
setState({ toads: [toad()], expeditions: [expedition()] });
const returned = makeFlock();
check(
  "видна в слоте КОНТУРа",
  returned.getToad(1) !== undefined,
  true,
);
const returnedRun = runFrames(returned, 3000);
check("прыжков встречи нет", returnedRun.jumping, 0);
check("ходит как обычная", returnedRun.walking > 0, true);
check("сдвинулась с места", returnedRun.moved > 1, true);

console.log("\n[3] Прыжок остался реакцией на тап");
setState();
const tapped = makeFlock();
tapped.react(1);
check("после тапа прыгает", tapped.getToad(1).container.userData.state, "jumping");
const tapRun = runFrames(tapped, 60);
check("прыжок заканчивается", tapRun.jumping < 60, true);
check("после прыжка снова сидит", tapped.getToad(1).container.userData.state, "idle");

console.log("\n" + "─".repeat(60));
if (failures.length) {
  console.error(`❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}
console.log("✅ Вернувшаяся жаба гуляет обычной анимацией, прыжок — только по тапу");
