import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Проверка энергии: максимум по качеству, отдых в биоподе/репродукторе/Медотсеке,
 * голод, аппетит, цена похода и общий тик восстановления.
 *
 * Запуск: npm run verify:energy
 */

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-energy-"));
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
  const ok = Object.is(actual, expected);
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};
const round = (value, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

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

let raw = "";
globalThis.localStorage = {
  getItem: () => raw,
  setItem: (_key, value) => {
    raw = value;
  },
  removeItem: () => {
    raw = "";
  },
};
globalThis.window.localStorage = globalThis.localStorage;

const energy = bundle("src/utils/energy.ts", "energy");
const gamification = bundle(
  "src/utils/gamification-config.ts",
  "gamification-config",
);
const expedition = bundle("src/utils/expedition-config.ts", "expedition-config");
const backend = bundle("src/backend/index.ts", "backend");

const toad = (over = {}) => ({
  id: 1,
  name: "жаба",
  stage: "adult",
  sex: "female",
  status: "ok",
  scene_id: 1,
  homeId: 1,
  energy: 0,
  state: { hunger: 100 },
  genes: {
    rarity: 1,
    hungerRate: 1,
    weight: 10,
    speed: 1,
    fertility: 1,
    personality: null,
  },
  created_at: new Date().toISOString(),
  ...over,
});

const colony = (over = {}) => ({
  rooms: [],
  upgrades: {},
  demolished: [],
  ...over,
});

const state = (toads, rooms = []) => {
  raw = JSON.stringify({
    user: {
      id: "u",
      username: "u",
      tg_id: null,
      tokens: 5000,
      astro_quax: 0,
      biomass: 0,
      storage: { food: 0 },
    },
    scenes: [
      {
        id: 1,
        name: "Био Под",
        description: null,
        gradient: 0,
        price: 0,
        texture: null,
        capacity: 20,
        created_at: new Date().toISOString(),
      },
    ],
    toads,
    colony: colony({ rooms }),
    expeditions: [],
    lastSaved: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
};
const stateNow = () => JSON.parse(raw);
const toadNow = (id) => stateNow().toads.find((item) => item.id === id);
console.log("── 1. Максимум сил зависит от качества ───────────────────");
check("обычная жаба (rarity 1)", gamification.getToadMaxEnergy(toad()), 105);
check(
  "редкая жаба (rarity 10)",
  gamification.getToadMaxEnergy(toad({ genes: { ...toad().genes, rarity: 10 } })),
  150,
);
check(
  "легендарная жаба (rarity 50)",
  gamification.getToadMaxEnergy(toad({ genes: { ...toad().genes, rarity: 50 } })),
  350,
);
check(
  "очень редкая жаба (rarity 100)",
  gamification.getToadMaxEnergy(toad({ genes: { ...toad().genes, rarity: 100 } })),
  600,
);
check(
  "старый сейв без качества получает базу",
  gamification.getToadMaxEnergy({ genes: {} }),
  100,
);
check(
  "новая жаба без energy полна по своему максимуму",
  gamification.getToadEnergy(
    toad({ energy: undefined, genes: { ...toad().genes, rarity: 10 } }),
  ),
  150,
);
check(
  "текущий запас не превышает максимум качества",
  gamification.getToadEnergy(
    toad({ energy: 300, genes: { ...toad().genes, rarity: 10 } }),
  ),
  150,
);

console.log("\n── 2. Где и как быстро идут силы ────────────────────────");
const regenAtMin = energy.ENERGY_REGEN_BASE_PER_HOUR;
const regenAtFullHunger =
  regenAtMin * energy.ENERGY_REGEN_MAX_HUNGER_MULTIPLIER;
const hungerMidpoint =
  regenAtMin *
  (1 +
    (49 / (100 - energy.ENERGY_REGEN_MIN_HUNGER)) *
      (energy.ENERGY_REGEN_MAX_HUNGER_MULTIPLIER - 1));
const hospitalRooms = [
  {
    id: "hospital_1",
    slotId: "hosp-slot",
    kind: "hospital",
    builtAt: new Date().toISOString(),
  },
];
const aviaryRooms = [
  {
    id: "aviary_1",
    slotId: "avi-slot",
    kind: "aviary",
    builtAt: new Date().toISOString(),
  },
];
const breedingRooms = [
  {
    id: "breeding_100000001",
    slotId: "breeding",
    kind: "breeding",
    builtAt: new Date().toISOString(),
  },
];
const hospitalColony = colony({ rooms: hospitalRooms });
const aviaryColony = colony({ rooms: aviaryRooms });
const breedingColony = colony({ rooms: breedingRooms });

check(
  "биопод, сытость 100, аппетит 1",
  energy.getEnergyRegenPerHour(toad(), colony()),
  regenAtFullHunger,
);
check(
  "биопод, сытость 1 — минимум ⚡/ч",
  energy.getEnergyRegenPerHour(toad({ state: { hunger: 1 } }), colony()),
  regenAtMin,
);
check(
  "сытость 0 — силы не идут",
  energy.getEnergyRegenPerHour(toad({ state: { hunger: 0 } }), colony()),
  0,
);
check(
  "сытость 50 — между минимумом и максимумом",
  round(energy.getEnergyRegenPerHour(toad({ state: { hunger: 50 } }), colony())),
  round(hungerMidpoint),
);
check(
  "аппетит 2 ускоряет вдвое",
  energy.getEnergyRegenPerHour(
    toad({ genes: { ...toad().genes, hungerRate: 2 } }),
    colony(),
  ),
  regenAtFullHunger * 2,
);
check(
  "аппетит 0.5 замедляет вдвое",
  energy.getEnergyRegenPerHour(
    toad({ genes: { ...toad().genes, hungerRate: 0.5 } }),
    colony(),
  ),
  regenAtFullHunger * 0.5,
);
check(
  "Медотсек тоже восстанавливает",
  energy.getEnergyRegenPerHour(
    toad({ scene_id: "hosp-slot" }),
    hospitalColony,
  ),
  regenAtFullHunger,
);
check(
  "репродуктор восстанавливает силы как биопод",
  energy.getEnergyRegenPerHour(
    toad({ scene_id: "breeding_100000001" }),
    breedingColony,
  ),
  regenAtFullHunger,
);
check(
  "репродуктор по id гекса тоже восстанавливает",
  energy.getEnergyRegenPerHour(toad({ scene_id: "breeding" }), breedingColony),
  regenAtFullHunger,
);
check(
  "энергосектор силы не восстанавливает",
  energy.getEnergyRegenPerHour(toad({ scene_id: "power-slot" }), colony()),
  0,
);
check(
  "жаба в походе не отдыхает",
  energy.getEnergyRegenPerHour(toad({ status: "out" }), colony()),
  0,
);
check(
  "старый биопод-сектор (строковый id) считается биоподом",
  energy.getEnergyRegenPerHour(toad({ scene_id: "avi-slot" }), aviaryColony),
  regenAtFullHunger,
);
check(
  "место восстановления: биопод",
  energy.getToadEnergyRegenPlace(toad(), colony()),
  "biopod",
);
check(
  "место восстановления: Медотсек",
  energy.getToadEnergyRegenPlace(
    toad({ scene_id: "hosp-slot" }),
    hospitalColony,
  ),
  "hospital",
);
check(
  "место восстановления: репродуктор",
  energy.getToadEnergyRegenPlace(
    toad({ scene_id: "breeding_100000001" }),
    breedingColony,
  ),
  "breeding",
);
check(
  "место восстановления: нигде",
  energy.getToadEnergyRegenPlace(toad({ scene_id: "power-slot" }), colony()),
  null,
);

console.log("\n── 3. Начисление за час и упор в максимум ───────────────");
const hoursToFull = Math.ceil(105 / regenAtFullHunger);
check(
  "0 → полный прирост за час в биоподе",
  energy.getToadEnergyAfterRegen(toad(), colony(), 1),
  regenAtFullHunger,
);
check(
  `0 → 105 за ${hoursToFull} часов (упор в максимум)`,
  energy.getToadEnergyAfterRegen(toad(), colony(), hoursToFull),
  105,
);
check(
  "сытость 0 — начисления нет",
  energy.getToadEnergyAfterRegen(toad({ state: { hunger: 0 } }), colony(), 1),
  null,
);
check(
  "не в биоподе — начисления нет",
  energy.getToadEnergyAfterRegen(
    toad({ scene_id: "power-slot" }),
    colony(),
    1,
  ),
  null,
);
const regenerated = energy.regenToadEnergy(toad(), colony(), 1);
check("regenToadEnergy пишет новый запас", regenerated.energy, regenAtFullHunger);
check(
  "regenToadEnergy не трогает жабу вне зоны отдыха",
  energy.regenToadEnergy(toad({ scene_id: "power-slot" }), colony(), 1).energy,
  0,
);

console.log("\n── 4. Поход стоит минимум 70 ⚡ ──────────────────────────");
const sector = (depth) => ({ depth });
const energyCost = (depth) =>
  expedition.EXPEDITION_ENERGY_BASE +
  expedition.EXPEDITION_ENERGY_PER_DEPTH * (Math.max(1, depth) - 1);
check("глубина 1", expedition.getExpeditionToadEnergyCost(sector(1)), 70);
check(
  "глубина 2",
  expedition.getExpeditionToadEnergyCost(sector(2)),
  energyCost(2),
);
check(
  "глубина 8",
  expedition.getExpeditionToadEnergyCost(sector(8)),
  energyCost(8),
);
check(
  "глубина 0 читается как 1",
  expedition.getExpeditionToadEnergyCost(sector(0)),
  70,
);
check("минимум зафиксирован", expedition.EXPEDITION_MIN_ENERGY_COST, 70);

console.log("\n── 5. Общий тик восстановления ──────────────────────────");
state(
  [
    toad({ id: 1, scene_id: 1 }),
    toad({ id: 2, scene_id: "power-slot" }),
    toad({ id: 3, scene_id: "hosp-slot" }),
    toad({ id: 4, scene_id: 1, state: { hunger: 0 } }),
    toad({ id: 5, scene_id: 1, status: "out" }),
    toad({
      id: 6,
      scene_id: 1,
      energy: 149,
      genes: { ...toad().genes, rarity: 10 },
    }),
    toad({ id: 7, scene_id: "breeding_100000001" }),
  ],
  [...hospitalRooms, ...breedingRooms],
);
backend.updateToadsBulkEnergy(1, true);
check("биопод: полный прирост за час", toadNow(1).energy, regenAtFullHunger);
check("энергосектор: без изменений", toadNow(2).energy, 0);
check("Медотсек: полный прирост за час", toadNow(3).energy, regenAtFullHunger);
check("голодная: без изменений", toadNow(4).energy, 0);
check("в походе: без изменений", toadNow(5).energy, 0);
check("упор в максимум качества: 149 → 150", toadNow(6).energy, 150);
check("репродуктор: полный прирост за час", toadNow(7).energy, regenAtFullHunger);

console.log(
  failures.length === 0
    ? "\n🎉 Все проверки энергии прошли"
    : `\n❌ Провалено проверок: ${failures.length}\n${failures.join("\n")}`,
);

process.exit(failures.length === 0 ? 0 : 1);

