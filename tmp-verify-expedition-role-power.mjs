/**
 * Проверка роли жабы в походах на реальном коде проекта.
 *
 * Фиксируем правило: сила роли влияет и на бросок события, и на итоговый успех
 * похода. Отдельно проверяем, что ранения и опасность сектора снижают шанс.
 *
 * Запуск: node tmp-verify-expedition-role-power.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-expedition-role-power-"));
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
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures.push(
      `${label}: получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`,
    );
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${JSON.stringify(actual)}`);
};
const near = (label, actual, expected) => {
  const ok = Math.abs(actual - expected) < 1e-9;
  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

const models = bundle("src/models/expedition.ts", "models-expedition");
const cfg = bundle("src/utils/expedition-config.ts", "expedition-config");

const starter = models.getSectorById(1);
const deep = models.getSectorById(8);

console.log("\n[1] Бросок события зависит от силы роли");
console.log("─".repeat(60));
near("роль 0 → базовый шанс 55%", cfg.getExpeditionEventChance(0, starter), 0.55);
near("роль 0.5 → 72.5%", cfg.getExpeditionEventChance(0.5, starter), 0.725);
near("роль 1.0 → 90%", cfg.getExpeditionEventChance(1, starter), 0.9);
near(
  "роль 2.0 → потолок 95%",
  cfg.getExpeditionEventChance(2, starter),
  0.95,
);
near(
  "раненая жаба (50% HP) с ролью 1.0 → 72%",
  cfg.getExpeditionEventChance(1, starter, 0.5),
  0.72,
);
near(
  "опасный сектор: роль 1.0 → 32.4%",
  cfg.getExpeditionEventChance(1, deep),
  0.324,
);
near(
  "опасный сектор: роль 2.0 → 67.4%",
  cfg.getExpeditionEventChance(2, deep),
  0.674,
);
near(
  "событие с базой 45% и ролью 1.0 → 80%",
  cfg.getExpeditionEventChance(1, starter, 1, 0.45),
  0.8,
);
check(
  "в опасном секторе роль важнее, чем в стартовом",
  cfg.getExpeditionEventChance(2, deep) - cfg.getExpeditionEventChance(0, deep) >
    cfg.getExpeditionEventChance(2, starter) -
      cfg.getExpeditionEventChance(0, starter),
  true,
);

const STAT_KEY = {
  scout: "speed",
  tank: "weight",
  medic: "fertility",
  hacker: "rarity",
  negotiator: "hungerRate",
};

/** Жаба с точной силой роли: характеристика = cap × power */
const toadForRole = (role, power) => ({
  genes: {
    [STAT_KEY[role]]: cfg.ROLE_CONFIG[role].statCap * power,
  },
});

const teamAt = (power, roles = models.EXPEDITION_ROLE_ORDER) =>
  roles.map((role) => ({ role, toad: toadForRole(role, power) }));

console.log("\n[2] Итоговый успех похода зависит от силы ролей");
console.log("─".repeat(60));
near(
  "вклад роли: сила 1.0 → полный юнит (+20%)",
  cfg.getRoleSuccessUnits(1),
  1,
);
near(
  "вклад роли: сила 0.5 → половина юнита",
  cfg.getRoleSuccessUnits(0.5),
  0.25,
);
near(
  "5 ролей по 20% → 10% успеха",
  cfg.getExpeditionSuccessChance(teamAt(0.2), starter),
  0.1,
);
near(
  "5 ролей по 90% → 45% успеха",
  cfg.getExpeditionSuccessChance(teamAt(0.9), starter),
  0.45,
);
near(
  "5 ролей по 100% → 100% успеха",
  cfg.getExpeditionSuccessChance(teamAt(1), starter),
  1,
);
near(
  "3 роли по 200% → 120% успеха",
  cfg.getExpeditionSuccessChance(
    teamAt(2, ["scout", "tank", "medic"]),
    starter,
  ),
  1.2,
);
near(
  "5 ролей по 200% → потолок 150%",
  cfg.getExpeditionSuccessChance(teamAt(2), starter),
  1.5,
);
near(
  "те же 3 роли по 200% на глубине 8 → 65.2%",
  cfg.getExpeditionSuccessChance(
    teamAt(2, ["scout", "tank", "medic"]),
    deep,
  ),
  1.2 * cfg.getSectorSuccessFactor(deep),
);
check(
  "сильная команда успешнее слабой",
  cfg.getExpeditionSuccessChance(teamAt(1), starter) >
    cfg.getExpeditionSuccessChance(teamAt(0.2), starter),
  true,
);
check(
  "глубина режет шанс той же команды",
  cfg.getExpeditionSuccessChance(teamAt(2), deep) <
    cfg.getExpeditionSuccessChance(teamAt(2), starter),
  true,
);

console.log(
  `\nℹ️  Стартовый сектор: роль 1.0 даёт ${Math.round(
    cfg.getExpeditionEventChance(1, starter) * 100,
  )}% на событие, роль 2.0 — ${Math.round(
    cfg.getExpeditionEventChance(2, starter) * 100,
  )}%.`,
);
console.log(
  `ℹ️  Глубина 8: роль 1.0 даёт ${Math.round(
    cfg.getExpeditionEventChance(1, deep) * 100,
  )}% на событие, роль 2.0 — ${Math.round(
    cfg.getExpeditionEventChance(2, deep) * 100,
  )}%.`,
);

if (failures.length > 0) {
  console.error(`\n❌ ПРОВАЛЫ (${failures.length}):`);
  failures.forEach((failure) => console.error(`   ${failure}`));
  process.exit(1);
}

console.log("\n✅ Все проверки силы ролей пройдены.");
