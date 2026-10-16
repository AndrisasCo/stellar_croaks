/**
 * Проверка «почему у новорождённой жабы здоровье не 100%».
 *
 * Гипотеза: `getToadMaxHp` считает максимум как «сохранённый maxHp + бонусы генов»,
 * а `processHpRegen` (раз в 5 минут, `MainScreen`) пишет посчитанный maxHp в сейв.
 * Тогда на следующем тике бонусы генов начисляются ПОВТОРНО и максимум растёт,
 * а hp стоит на месте — полоска здоровья проседает сама по себе.
 *
 * Скрипт гоняет РЕАЛЬНЫЕ функции игры: `processHpRegen` и геттеры HP.
 * Запуск: node tmp-verify-hp-drift.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-hp-drift-"));
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

/** Новорождённый головастик: как его создаёт `generateChildToad` + `createToads` — без hp/maxHp */
const newborn = () => ({
  id: 1,
  name: "Жаб-1-777",
  stage: "toadpole",
  generation: 1,
  sex: "female",
  type: "hybrid",
  scene_id: 1,
  homeId: 1,
  roomId: "nest-1",
  created_at: new Date().toISOString(),
  energy: 100,
  status: "ok",
  state: { hunger: 0 },
  pregnancy: null,
  mating: null,
  genes: {
    colors: ["#000000"],
    pattern: "smooth",
    weight: 15,
    speed: 1,
    rarity: 5,
    hungerRate: 1,
    fertility: 1,
    personality: null,
  },
});

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

const { processHpRegen } = bundle("src/utils/expedition-manager.ts", "expedition");
const { getToadHp, getToadMaxHp, getToadHpRatio } = bundle(
  "src/utils/expedition-config.ts",
  "config",
);

const reset = () => {
  raw = JSON.stringify({
    user: { id: "u1", tg_id: 1, tokens: 0, astro_quax: 0, biomass: 0, storage: { food: 0 } },
    scenes: [{ id: 1, name: "Биопод #1", capacity: 20, created_at: "" }],
    colony: { rooms: [] },
    expeditions: [],
    toads: [newborn()],
    lastSaved: "",
    createdAt: "",
  });
};

const pct = (toad) => `${Math.round(getToadHpRatio(toad) * 100)}%`;

console.log("Сразу после рождения (в сейве нет hp/maxHp):", pct(newborn()), "— полный запас\n");

console.log("Дальше идут тики игры: processHpRegen(0.25) каждые 5 минут реального времени.");
reset();
console.log("тик |  hp/maxHp   | здоровье");
for (let tick = 1; tick <= 6; tick += 1) {
  processHpRegen(0.25);
  const toad = JSON.parse(raw).toads[0];
  console.log(
    `  ${String(tick).padStart(2)} | ${String(Math.round(getToadHp(toad))).padStart(3)}/${String(
      getToadMaxHp(toad),
    ).padStart(3)}    | ${pct(toad)}`,
  );
}

console.log("\nСвежая страница после 12 часов оффлайна (processHpRegen(12)):");
reset();
processHpRegen(12);
const offline = JSON.parse(raw).toads[0];
console.log(
  `  hp/maxHp = ${Math.round(getToadHp(offline))}/${getToadMaxHp(offline)} → здоровье ${pct(offline)}`,
);

console.log("\nПотолок HP_SOFT_CAP: 400 — рост максимума упирается в него и там остаётся.");
reset();
for (let tick = 0; tick < 200; tick += 1) processHpRegen(0.25);
const capped = JSON.parse(raw).toads[0];
console.log(
  `  200 тиков (~16 ч игры): hp/maxHp = ${Math.round(getToadHp(capped))}/${getToadMaxHp(
    capped,
  )} → здоровье ${pct(capped)}`,
);
