/* Численная модель экономики Stellar Croak. Временный read-only разбор. */
const BIOMASS_PER_TOAD_HOUR = 2.1;
const UPKEEP_PER_TOAD_HOUR = 0.6;
const PRODUCTION_MIN_HUNGER = 30;
const BIOMASS_TO_TOKENS_RATE = 0.5;
const HUNGER_PER_DAY = 40;
const HP_REGEN_PER_HOUR = 5;
const HEAL_TOKENS_PER_HP = 0.4;

const BASE_EVENT_CHANCE = 0.55;
const ROLE_CHANCE_BONUS = 0.35;
const DANGER_CHANCE_PENALTY = 0.12;
const STEP_BIOMASS = 5;
const STEP_TOKENS = 4;
const MIN_DAMAGE = 6;
const BASE_HP = 70;
const HP_PER_WEIGHT = 2;
const HP_PER_RARITY = 3;
const PROGRESS_STEP = 0.12;
const STEPS_TOTAL = Math.ceil(1 / PROGRESS_STEP);
const ASTRO_CHANCE = 0.12;
const SAMPLE_CHANCE = 0.08;
const TANK_REDIRECT = 0.6;
const SUPPLY_PER_TOAD = 4;
const rand = Math.random;

const SECTORS = [
  { id: 1, name: "Ржавый шлюз", depth: 1, durationHours: 1.5, lootMultiplier: 1, dangerMultiplier: 1, unlockExpeditions: 0, starter: true },
  { id: 2, name: "Затопленный бункер", depth: 2, durationHours: 3, lootMultiplier: 1.4, dangerMultiplier: 1.15, unlockExpeditions: 1 },
  { id: 3, name: "Периметр-3", depth: 3, durationHours: 5, lootMultiplier: 1.8, dangerMultiplier: 1.3, unlockExpeditions: 3 },
  { id: 4, name: "Орбитальный обломок", depth: 4, durationHours: 7, lootMultiplier: 2.3, dangerMultiplier: 1.5, unlockExpeditions: 6 },
  { id: 5, name: "Гнездо дронов", depth: 5, durationHours: 9, lootMultiplier: 2.8, dangerMultiplier: 1.7, unlockExpeditions: 10 },
  { id: 6, name: "Реактор Квак-7", depth: 6, durationHours: 12, lootMultiplier: 3.4, dangerMultiplier: 2, unlockExpeditions: 15 },
  { id: 7, name: "Архив мёртвых генов", depth: 7, durationHours: 15, lootMultiplier: 4, dangerMultiplier: 2.3, unlockExpeditions: 21 },
  { id: 8, name: "Дальний Периметр", depth: 8, durationHours: 20, lootMultiplier: 5, dangerMultiplier: 2.7, unlockExpeditions: 28 },
];

const ROLE_CAP = { scout: 1.5, tank: 40, medic: 3, hacker: 12, negotiator: 1.4 };
const ROLES = ["scout", "tank", "medic", "hacker", "negotiator"];

const DEFAULT_TOADS = [
  { id: 0, name: "Дикая 1", weight: 15, speed: 1.0, rarity: 1.2, hungerRate: 1.2, fertility: 1.1 },
  { id: 1, name: "Дикая 2", weight: 17, speed: 1.0, rarity: 1.3, hungerRate: 1.0, fertility: 1.4 },
  { id: 2, name: "Дикая 3", weight: 14, speed: 1.0, rarity: 1.1, hungerRate: 0.9, fertility: 1.23 },
  { id: 3, name: "Дикая 4", weight: 15.5, speed: 1.0, rarity: 1.4, hungerRate: 1.3, fertility: 1.0 },
  { id: 4, name: "Дикая 5", weight: 16, speed: 1.2, rarity: 1.5, hungerRate: 0.8, fertility: 1.1 },
];

const lootFactor = (s) => s.lootMultiplier * (1 + (s.depth - 1) * 0.08);
const roleStat = (t, role) => role === "scout" ? t.speed : role === "tank" ? t.weight : role === "medic" ? t.fertility : role === "hacker" ? t.rarity : 1;
const rolePower = (t, role) => Math.min(1, roleStat(t, role) / ROLE_CAP[role]);
const maxHp = (t) => Math.min(400, Math.round(BASE_HP + t.weight * HP_PER_WEIGHT + t.rarity * HP_PER_RARITY));
const scaleDamage = (s, base) => Math.max(MIN_DAMAGE, Math.round(base * s.dangerMultiplier));

const permutations = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((v, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [v, ...p]));
const subsets = (arr, k) => k === 0 ? [[]] : arr.flatMap((v, i) => subsets(arr.slice(i + 1), k - 1).map((s) => [v, ...s]));
const assignRoles = (team) => {
  let best = null, bestScore = -1;
  for (const combo of subsets(ROLES, team.length)) {
    for (const perm of permutations(combo)) {
      const score = perm.reduce((sum, role, i) => sum + rolePower(team[i], role), 0);
      if (score > bestScore) { bestScore = score; best = perm; }
    }
  }
  return { perm: best, score: bestScore };
};

const simulateExpedition = (sector, team, rolePerm) => {
  const members = team.map((t, i) => ({ toad: t, role: rolePerm[i], hp: maxHp(t), maxHp: maxHp(t), down: false }));
  const loot = { biomass: 0, tokens: 0, astro: 0, sample: 0, food: 0 };
  const factor = lootFactor(sector);
  const alive = () => members.filter((m) => !m.down);
  const byRole = (r) => alive().find((m) => m.role === r) || null;
  const randomMember = () => { const a = alive(); return a.length ? a[Math.floor(rand() * a.length)] : null; };
  const check = (m, base) => {
    const hpRatio = Math.max(0, Math.min(1, m.hp / m.maxHp));
    const chance = Math.max(0.05, Math.min(0.95,
      base + rolePower(m.toad, m.role) * ROLE_CHANCE_BONUS - (sector.dangerMultiplier - 1) * DANGER_CHANCE_PENALTY)) * (0.6 + 0.4 * hpRatio);
    return rand() < chance;
  };
  const damage = (m, amount) => {
    if (!m || m.down) return 0;
    const dealt = Math.min(Math.max(0, Math.round(amount)), m.hp);
    m.hp -= dealt;
    if (m.hp <= 0) m.down = true;
    return dealt;
  };
  const heal = (m, amount) => { const before = m.hp; m.hp = Math.min(m.maxHp, m.hp + Math.max(0, Math.round(amount))); return m.hp - before; };
  const teamDamage = (amount) => {
    const a = alive(); if (!a.length) return 0;
    const tank = a.find((m) => m.role === "tank");
    let total = 0;
    if (tank) {
      const absorbed = Math.round(amount * TANK_REDIRECT);
      total += damage(tank, absorbed);
      const others = a.filter((m) => m !== tank);
      if (others.length) others.forEach((m) => { total += damage(m, Math.max(1, Math.round((amount - absorbed) / others.length))); });
    } else a.forEach((m) => { total += damage(m, Math.max(1, Math.round(amount / a.length))); });
    return total;
  };
  const stepLoot = (mult = 1) => {
    const f = factor * mult;
    return { biomass: Math.max(1, Math.round(STEP_BIOMASS * f * (0.7 + rand() * 0.6))), tokens: Math.max(1, Math.round(STEP_TOKENS * f * (0.6 + rand() * 0.5))) };
  };
  const rareLoot = () => {
    const d = { astro: 0, sample: 0 };
    if (rand() < ASTRO_CHANCE) d.astro = 1;
    if (rand() < SAMPLE_CHANCE) d.sample = 1;
    return d;
  };
  const add = (d, r) => { loot.biomass += d.biomass || 0; loot.tokens += d.tokens || 0; loot.astro += r?.astro || 0; loot.sample += r?.sample || 0; };

  const fire = {
    quiet_corridor: () => { if (rand() < 0.4) loot.biomass += Math.round(2 * factor); },
    collapsed_bridge: () => { const s = byRole("scout"); if (!s) return; if (check(s, 0.5)) add(stepLoot(1.2), rareLoot()); else damage(randomMember() || s, scaleDamage(sector, 10)); },
    turret_grid: () => { const t = byRole("tank"); if (!t) return; if (check(t, 0.5)) add(stepLoot(1), rareLoot()); else damage(t, scaleDamage(sector, 16)); },
    sealed_vault: () => { const h = byRole("hacker"); if (!h) return; if (check(h, 0.45)) { loot.tokens += Math.max(2, Math.round(STEP_TOKENS * factor)); const r = rareLoot(); loot.astro += r.astro; loot.sample += r.sample; } else damage(h, scaleDamage(sector, 8)); },
    mold_crater: () => { const n = byRole("negotiator"); if (!n) return; if (check(n, 0.5)) add(stepLoot(0.8), rareLoot()); else damage(randomMember() || n, scaleDamage(sector, 7)); },
    nano_repair_bay: () => { const m = byRole("medic"); if (!m) return; const amount = Math.round(8 + rolePower(m.toad, "medic") * 14); alive().forEach((a) => heal(a, amount)); },
    turret_ambush: () => { teamDamage(scaleDamage(sector, 12)); },
    orbital_crates: () => { loot.tokens += Math.max(2, Math.round(STEP_TOKENS * factor)); loot.food += 3 + Math.floor(rand() * 8); const r = rareLoot(); loot.astro += r.astro; loot.sample += r.sample; },
    data_terminal: () => { const h = byRole("hacker"); if (!h) return; loot.tokens += Math.max(3, Math.round(STEP_TOKENS * 1.6 * factor)); const r = rareLoot(); loot.astro += r.astro; loot.sample += r.sample; },
    biomass_reef: () => { add(stepLoot(1.4)); },
    leaky_reactor: () => { const t = byRole("tank"); if (!t) return; if (check(t, 0.55)) add(stepLoot(1.1), rareLoot()); else teamDamage(scaleDamage(sector, 18)); },
    drone_patrol: () => { const s = byRole("scout"); if (!s) return; if (!check(s, 0.55)) damage(s, scaleDamage(sector, 12)); },
    stray_signal: () => { if (rand() < 0.5) { loot.tokens += Math.max(1, Math.round(2 * factor)); const r = rareLoot(); loot.astro += r.astro; loot.sample += r.sample; } else { const v = randomMember(); if (v) damage(v, scaleDamage(sector, 9)); } },
    gene_pool: () => { const n = byRole("negotiator"); if (!n) return; if (check(n, 0.45)) { add(stepLoot(0.6), rareLoot()); if (rand() < 0.25) loot.sample += 1; } else damage(n, scaleDamage(sector, 10)); },
  };
  const ROLE_OF = { collapsed_bridge: "scout", turret_grid: "tank", sealed_vault: "hacker", mold_crater: "negotiator", nano_repair_bay: "medic", data_terminal: "hacker", leaky_reactor: "tank", drone_patrol: "scout", gene_pool: "negotiator" };
  const ALL = Object.keys(fire);

  for (let step = 0; step < STEPS_TOTAL; step++) {
    const pool = ALL.filter((id) => !ROLE_OF[id] || byRole(ROLE_OF[id]));
    fire[pool[Math.floor(rand() * pool.length)]]();
    if (!alive().length) break;
  }
  return { loot, downed: members.filter((m) => m.down).length, hpLost: members.reduce((s, m) => s + (m.maxHp - m.hp), 0), worst: Math.max(...members.map((m) => m.maxHp - m.hp)) };
};


// === Монте-Карло по секторам ===
const N = 20000;
const roleAssign = assignRoles(DEFAULT_TOADS);
console.log("=== Роли по умолчанию (перебор 120 вариантов) ===");
roleAssign.perm.forEach((r, i) => console.log(`  ${DEFAULT_TOADS[i].name}: ${r} (сила ${rolePower(DEFAULT_TOADS[i], r).toFixed(2)})`));
console.log("  суммарная сила команды:", roleAssign.score.toFixed(3));

console.log("\n=== Поход 5 диких жаб (9 событий за путь) ===");
const rows = [];
for (const s of SECTORS) {
  let bio = 0, tok = 0, astro = 0, sample = 0, hpLost = 0, wipes = 0, food = 0, worst = 0;
  for (let i = 0; i < N; i++) {
    const res = simulateExpedition(s, DEFAULT_TOADS, roleAssign.perm);
    bio += res.loot.biomass; tok += res.loot.tokens; astro += res.loot.astro; sample += res.loot.sample; food += res.loot.food;
    hpLost += res.hpLost; worst += res.worst;
    if (res.downed === DEFAULT_TOADS.length) wipes++;
  }
  const e = { bio: bio / N, tok: tok / N, astro: astro / N, sample: sample / N, hp: hpLost / N, wipe: wipes / N, food: food / N, worst: worst / N };
  rows.push({ s, e });
  const send = SUPPLY_PER_TOAD * s.depth * DEFAULT_TOADS.length;
  const trip = s.durationHours * 1.5;
  console.log(`s${s.id} ${s.name.padEnd(22)} путь ${String(s.durationHours).padStart(4)}ч (+возврат ${(s.durationHours * 0.5).toFixed(1)}ч) снаряж ${String(send).padStart(3)}🧪 | био ${e.bio.toFixed(1).padStart(5)} ток ${e.tok.toFixed(1).padStart(4)} астро ${e.astro.toFixed(2).padStart(4)} обр ${e.sample.toFixed(2)} корм ${e.food.toFixed(1).padStart(4)} | урон ${e.hp.toFixed(0).padStart(3)} HP вайп ${(e.wipe * 100).toFixed(1)}% | нетто-био ${(e.bio - send).toFixed(1).padStart(5)} ток/ч ${(e.tok / trip).toFixed(2)}`);
}

// === Путь до сектора 8 ===
console.log("\n=== Путь до «Дальнего Периметра» (нужно 28 завершённых походов) ===");
let completed = 0, hours = 0, spent = 0, gained = 0, tokGain = 0, astroGain = 0, sampleGain = 0, heals = 0;
const tally = {};
while (completed < 28) {
  const unlocked = SECTORS.filter((s) => s.starter || s.unlockExpeditions <= completed);
  const best = unlocked[unlocked.length - 1];
  const e = rows.find((r) => r.s.id === best.id).e;
  tally[`s${best.id}`] = (tally[`s${best.id}`] || 0) + 1;
  completed += 1;
  hours += best.durationHours * 1.5;
  spent += SUPPLY_PER_TOAD * best.depth * DEFAULT_TOADS.length;
  gained += e.bio; tokGain += e.tok; astroGain += e.astro; sampleGain += e.sample;
  heals += e.hp * 0.4;
}
console.log("  маршрут (по лучшему открытому сектору):", Object.entries(tally).map(([k, v]) => `${k}×${v}`).join(", "));
console.log(`  чистое время 1 командой: ${hours.toFixed(1)} ч = ${(hours / 24).toFixed(1)} сут`);
console.log(`  снаряжение −${spent} 🧪, добыча +${gained.toFixed(0)} 🧪 (баланс ${(gained - spent).toFixed(0)}), лечение выбитых ~${heals.toFixed(0)} 🔷`);
console.log(`  токенов из походов +${tokGain.toFixed(0)} 🔷, астро +${astroGain.toFixed(1)} 💎, образцов ~${sampleGain.toFixed(1)}`);
console.log(`  итого при 3 командах (диспетчерская 1150 🔷) — те же события параллельно, ~${(hours / 3).toFixed(1)} ч`);

// === Ферма ===
console.log("\n=== Ферма биомассы (5 диких жаб) ===");
const rate = (t, hunger) => BIOMASS_PER_TOAD_HOUR * (1 + t.rarity / 10) * (1 + t.weight / 50) * ((hunger - PRODUCTION_MIN_HUNGER) / 70);
for (const [label, hunger] of [["голод 100 (покормил всех)", 100], ["голод 85 (кормлю 2×/сутки)", 85], ["голод 60 (кормлю 1×/сутки)", 60], ["голод 40 (редко захожу)", 40], ["голод 30 (забросил)", 30]]) {
  const gross = DEFAULT_TOADS.reduce((s, t) => s + rate(t, hunger), 0);
  const net = gross - DEFAULT_TOADS.length * UPKEEP_PER_TOAD_HOUR;
  console.log(`  ${label.padEnd(28)} гросс ${gross.toFixed(2)} 🧪/ч, апкип ${(DEFAULT_TOADS.length * UPKEEP_PER_TOAD_HOUR).toFixed(1)}, нетто ${net.toFixed(2)} 🧪/ч = ${(net * BIOMASS_TO_TOKENS_RATE).toFixed(2)} 🔷/ч = ${(net * BIOMASS_TO_TOKENS_RATE * 24).toFixed(0)} 🔷/сут`);
}
console.log(`  расход корма: 1 корм = +100 голода (с 70 это 30 ед.), в сутки на жабу ~${(HUNGER_PER_DAY / 30).toFixed(2)} корма = ${(HUNGER_PER_DAY / 30).toFixed(2)} 🔷`);
console.log(`  корм из походов: orbital_crates даёт 3–10 🍎 (1 событие из 14)`);

// === Цена ухода на ферму: маленькая команда vs полная ===
console.log("\n=== Цена похода для фермы: жабы в походе НЕ производят биомассу ===");
const FARM_HUNGER = 85;
const farmPerToadHour = (t) => rate(t, FARM_HUNGER);
console.log("  (жаба в походе/комнате колонии даёт 0 🧪/ч — «Поход» и «Энергокомната» забирают её с фермы)");
console.log("  по сектору 1: сравнение по числу жаб в команде (цена прохода с учётом простоя и лечения)");
for (const size of [1, 2, 3, 4, 5]) {
  const sub = DEFAULT_TOADS.slice(0, size);
  const asg = assignRoles(sub);
  let bio = 0, tok = 0, hp = 0, worst = 0;
  for (let i = 0; i < 20000; i++) { const r = simulateExpedition(SECTORS[0], sub, asg.perm); bio += r.loot.biomass; tok += r.loot.tokens; hp += r.hpLost; worst += r.worst; }
  bio /= 20000; tok /= 20000; hp /= 20000; worst /= 20000;
  const send = SUPPLY_PER_TOAD * 1 * size;
  const trip = 2.25;
  const idle = (sub.reduce((s, t) => s + farmPerToadHour(t), 0) / size - UPKEEP_PER_TOAD_HOUR) * size * trip;
  const heal = worst * HEAL_TOKENS_PER_HP;
  const rest = worst / HP_REGEN_PER_HOUR;
  const net = tok - send * BIOMASS_TO_TOKENS_RATE - idle * BIOMASS_TO_TOKENS_RATE - heal;
  console.log(`  ${size} жаб [${asg.perm.join(",")}]: био ${bio.toFixed(1).padStart(5)} ток ${tok.toFixed(1).padStart(5)} | снаряж ${send}🧪 | простой ${idle.toFixed(1)}🧪 | лечение ${heal.toFixed(0)}🔷 | ЧИСТО ${net.toFixed(1).padStart(6)} 🔷 за ${(trip + rest).toFixed(1)} ч = ${(net / (trip + rest)).toFixed(2)} 🔷/ч`);
}
console.log("  при полной команде из 5 стартовых жаб ферма встаёт полностью → биомассу на снаряжение надо фармить ДО отправки");
const homeFarm = DEFAULT_TOADS.reduce((s, t) => s + farmPerToadHour(t), 0) - 5 * UPKEEP_PER_TOAD_HOUR;
console.log(`  ферма дома (все 5, голод 85): ${homeFarm.toFixed(1)} 🧪/ч → 20 🧪 на поход s1 копятся ${(20 / homeFarm).toFixed(1)} ч, 160 🧪 на s8 — ${(160 / homeFarm).toFixed(1)} ч`);

// === Постройки ===
console.log("\n=== Цены построек (ROOM_BLUEPRINTS, базовая цена 🔷 + рост за каждую следующую) ===");
const BLUEPRINTS = [["power ⚡", 120, 1.6], ["aviary 🐸", 400, 2], ["breeding 🥚", 500, 2], ["incubator 🧫", 300, 1.8], ["collider 🧬", 800, 1], ["scout 🧭", 350, 1.8], ["storage 📦", 250, 1.7], ["shop 🛒", 600, 1], ["hospital 🩹", 450, 1.8], ["dissociator 🧪", 700, 1]];
BLUEPRINTS.forEach(([k, c, g]) => console.log(`  ${k.padEnd(16)} ${String(c).padStart(4)} 🔷  рост ×${g} (2-я комната ${Math.round(c * g)}, 3-я ${Math.round(c * g * g)})`));
const totalBuild = BLUEPRINTS.reduce((s, [, c]) => s + c, 0);
const nest = [40, Math.round(40 * 1.8), Math.round(40 * 1.8 ** 2), Math.round(40 * 1.8 ** 3)];
const dispatch = 250 + 900;
const grand = totalBuild + nest.reduce((a, b) => a + b, 0) + dispatch;
console.log(`  итого «всё по одному»: ${totalBuild} 🔷 | гнёзда +2/+4/+6 слотов: ${nest.join(" / ")} = ${nest.reduce((a, b) => a + b, 0)} 🔷 | диспетчерские (2-я и 3-я команда): ${dispatch} 🔷`);
console.log(`  ВСЕГО ${grand} 🔷 ≈ ${(grand / 111).toFixed(0)} суток «чистой фермы» (5 жаб при голоде 85) или ≈ ${(grand * 2 / (1906 / 17)).toFixed(0)} сут, если считать и токены из походов`);
console.log(`  Прочие траты: ускорение возврата 8 🧪/ч пути, экстренный маяк 3 💎, лечение 0.4 🔷/HP, смена облика/лечение — см. HEAL_MIN_COST = 1`);

// === Лутбокс ===
console.log("\n=== Лутбокс (магазин: 50 💎) ===");
let pity = 0, sinceGuar = 0; const counts = { legendary: 0, epic: 0, rare: 0, uncommon: 0, common: 0 }; const gaps = [];
const M = 200000;
for (let i = 0; i < M; i++) {
  pity++; sinceGuar++;
  let r;
  if (pity >= 50) { pity = 0; r = "epic"; }
  else if (pity % 10 === 0) r = "rare";
  else { const p = rand() * 100; if (p < 0.5) { pity = 0; r = "legendary"; } else if (p < 3) { pity = 0; r = "epic"; } else if (p < 15) r = "rare"; else if (p < 39) r = "uncommon"; else r = "common"; }
  counts[r]++;
  if (r !== "common" && r !== "uncommon") { gaps.push(sinceGuar); sinceGuar = 0; }
}
console.log("  шансы по факту:", Object.entries(counts).map(([k, v]) => `${k} ${(v / M * 100).toFixed(1)}%`).join(", "));
console.log(`  средний интервал «хорошей» жабы (rare+): ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)} боксов = ${(gaps.reduce((a, b) => a + b, 0) / gaps.length * 50).toFixed(0)} 💎`);
console.log(`  ⚠ ВАЖНО: во ВСЕХ шаблонах lootbox.ts rarity = 5 (кроме 2 common: 2.5 и 3.8) — банд роли не влияет, влияют вес/скорость/фертильность/характер`);
console.log(`  топ-легендарка: вес 30, скорость 0.75, фертильность 2.2, голод 0.5 → HP ${70 + 60 + 15} = 145, танк-сила ${(30 / 40).toFixed(2)}`);
console.log(`  сравнение: дикая HP ${DEFAULT_TOADS.map((t) => maxHp(t)).join("/")}, танк-сила ${DEFAULT_TOADS.map((t) => (t.weight / 40).toFixed(2)).join("/")}`);
console.log(`  астро на 1 бокс: в s1 нужно ${(50 / rows[0].e.astro).toFixed(0)} походов (${(50 / rows[0].e.astro * 2.25).toFixed(0)} ч), в s8 — ${(50 / rows[7].e.astro).toFixed(0)} походов (${(50 / rows[7].e.astro * 30).toFixed(0)} ч) на одну команду`);
console.log(`  астро на весь путь до s8 (~28 походов): +${rows.slice(0, 7).reduce((s, r) => s + r.e.astro * (r.s.id === 1 ? 1 : r.s.id), 0).toFixed(0)} 💎 ≈ ${(rows.slice(0, 7).reduce((s, r) => s + r.e.astro * (r.s.id === 1 ? 1 : r.s.id), 0) / 50).toFixed(1)} лутбокса`);

// === Генетика ===
console.log("\n=== Рост редкости по поколениям (старт 1.2) ===");
const inheritTrait = (parents, multiplier) => { const avg = parents.reduce((a, b) => a + b, 0) / parents.length; if (avg > 100) return avg + (rand() * 10 - 5) + (multiplier * 10 - 10); if (avg > 30) return avg * (1 + (rand() * 0.1 - 0.05)) * (0.7 + multiplier * 0.3); return avg * (1 + (rand() * 0.2 - 0.1)) * (0.7 + multiplier * 0.3); };
const simGen = (start, collider, gens = 12, runs = 500) => {
  const acc = new Array(gens + 1).fill(0);
  for (let run = 0; run < runs; run++) {
    let a = start, b = start; acc[0] += a;
    for (let g = 0; g < gens; g++) {
      const child = collider ? ((a + b) / 2 + 1 + (rand() - 0.5)) : ((a + b) / 2 + Math.ceil(rand() * 3) / 10);
      a = child; b = child; acc[g + 1] += child;
    }
  }
  return acc.map((v) => v / runs);
};
const normal = simGen(1.2, false), coll = simGen(1.2, true);
console.log("  gen   " + Array.from({ length: 13 }, (_, i) => String(i).padStart(6)).join(""));
console.log("  Гнездо" + normal.map((v) => v.toFixed(2).padStart(6)).join(""));
console.log("  Колл. " + coll.map((v) => v.toFixed(2).padStart(6)).join(""));
console.log("  (коллайдер = mix 2–5 родителей: +1 к средней + бонус 0.45 за 3+ родителя, ±0.5; обычное гнездо = среднее +0.1…0.3)");
console.log("  HP при редкости r: 70 + вес×2 + r×3 | оператор-сила = r/12, скаут = скорость/1.5");
console.log(`  чтобы упереться в потолки ролей: скорость 1.5 (есть уже у Дикой 5 = 1.2 → нет), вес 40 (нужно +25 от старта), редкость 12 (нужно ×10), фертильность 3 (нужно ~×2.3)`);
console.log("  Гнездо 2 слота, роддом 0–2.5 ч (min(random 0..4 + rarity/2, 8)), рост головастика 2 ч — полный цикл ~4.5 ч, но ГЕНОМ не растёт агрессивно: за 12 поколений редкость ~" + normal[12].toFixed(1) + " (обычное) / " + coll[12].toFixed(1) + " (коллайдер)");

// === Полная стоимость похода: снаряжение + простой фермы + лечение ===
console.log("\n=== Полная стоимость похода (полная команда 5 жаб, голод 85 = 12.21 🧪/ч) ===");
const farmTeam = DEFAULT_TOADS.reduce((s, t) => s + farmPerToadHour(t), 0);
const NET_FARM_PER_TOAD = farmTeam / DEFAULT_TOADS.length - UPKEEP_PER_TOAD_HOUR;
console.log(`  (простой фермы считаем как ПОТЕРЮ НЕТТО: ${NET_FARM_PER_TOAD.toFixed(2)} 🧪/ч на жабу = гросс ${(farmTeam / 5).toFixed(2)} минус сохранённый апкип ${UPKEEP_PER_TOAD_HOUR})`);
console.log("сектор | гросс 🔷 | снаряж 🧪→🔷 | простой фермы 🧪→🔷 | лечение 🔷 | ЧИСТО 🔷 | ч прохода | ч отлежаться | итого ч | 🔷/ч");
for (const { s, e } of rows) {
  const trip = s.durationHours * 1.5;
  const send = SUPPLY_PER_TOAD * s.depth * 5;
  const idle = NET_FARM_PER_TOAD * 5 * trip;
  const heal = e.worst * HEAL_TOKENS_PER_HP;
  const rest = e.worst / HP_REGEN_PER_HOUR;
  const net = e.tok - send * BIOMASS_TO_TOKENS_RATE - idle * BIOMASS_TO_TOKENS_RATE - heal;
  const totalH = trip + rest;
  console.log(`  s${s.id} | ${e.tok.toFixed(1).padStart(6)} | ${(send * BIOMASS_TO_TOKENS_RATE).toFixed(0).padStart(11)} | ${(idle * BIOMASS_TO_TOKENS_RATE).toFixed(0).padStart(16)} | ${heal.toFixed(0).padStart(7)} | ${net.toFixed(1).padStart(8)} | ${trip.toFixed(1).padStart(7)} | ${rest.toFixed(1).padStart(12)} | ${totalH.toFixed(1).padStart(7)} | ${(net / totalH).toFixed(2).padStart(5)}`);
}
console.log("  вывод: гросс-добыча похода не покрывает простой фермы — походы «окупаются» только звёздами, образцами и открытием секторов");
console.log(`  падение голода в походе: −${(40 / 24).toFixed(1)} × (проход+возврат) → s1 −3.8, s7 −37.5, s8 −50 голода; корм в походе не тратится (апкип только дома)`);
console.log(`  альтернатива: ферма без походов = ${homeFarm.toFixed(1)} 🧪/ч = ${(homeFarm * BIOMASS_TO_TOKENS_RATE).toFixed(2)} 🔷/ч = ${(homeFarm * BIOMASS_TO_TOKENS_RATE * 24).toFixed(0)} 🔷/сут (это «пол» экономики, с которым соревнуются все остальные активности)`);

// === Элитные заказы ===
console.log("\n=== Элитные заказы — фактический печатный станок астро ===");
const ELITE_MULT = [18, 4, 5, 14, 32, 8, 13, 11, 15, 9, 14, 17, 12, 8, 19, 13, 11, 15, 10, 16, 18, 22, 20, 7, 16, 25];
const BASE_PRICE = 3;
const avgMult = ELITE_MULT.reduce((a, b) => a + b, 0) / ELITE_MULT.length;
console.log(`  всего заказов в пуле: ${ELITE_MULT.length}, на витрине 3`);
console.log(`  БЕСПЛАТНОЕ обновление: nextRefreshElite = now + REFRESH_COOLDOWN×8 = 24 ч (handleRefreshShop)`);
console.log(`  награда = BASE_PRICE(3) × множитель [${Math.min(...ELITE_MULT)}…${Math.max(...ELITE_MULT)}] = ${BASE_PRICE * Math.min(...ELITE_MULT)}…${BASE_PRICE * Math.max(...ELITE_MULT)} 💎, средняя ${(BASE_PRICE * avgMult).toFixed(0)} 💎 (комментарии обещают «токенов»)`);
console.log(`  потолок на бесплатном обновлении: 3 заказа/сутки × ${(BASE_PRICE * avgMult).toFixed(0)} ≈ ${(3 * BASE_PRICE * avgMult).toFixed(0)} 💎/сут = ${(3 * BASE_PRICE * avgMult / 50).toFixed(1)} лутбокса/сутки`);
console.log(`  ⚠ НО мгновенное обновление стоит ${50} 🔷 и НЕ имеет временного гейта → 50 🔷 → 3 новых заказа ≈ ${(3 * BASE_PRICE * avgMult).toFixed(0)} 💎 = ${(3 * BASE_PRICE * avgMult / 50).toFixed(1)} лутбокса, то есть ${(3 * BASE_PRICE * avgMult / 50).toFixed(2)} 💎 за 1 🔷 — тот же курс, что и при сдаче жабы (${(BASE_PRICE * avgMult / 18).toFixed(2)}), поэтому «прокрутка витрины» не помогает, помогает только поток жаб`);
console.log(`  ⚠ астро-стоки ограничены: лутбокс 50 💎 × 1 шт на обновление витрины (3 ч) = макс 8/сут = 400 💎; пигменты 5–15 💎 бесконечно; астро-шоп 1–2 💎 за отдых/карантин/инкубацию`);
console.log(`  ⚠ дисбаланс: приход ~${(3 * BASE_PRICE * avgMult).toFixed(0)}–${(24 * BASE_PRICE * avgMult).toFixed(0)} 💎/сут из элитников против стока ≤${400} 💎/сут (лутбоксы) → астро-инфляция, если игрок диссоциирует/приносит достаточно жаб`);
console.log(`  цена входа: рыночная жаба ≈ ${Math.ceil(7 * 2.5)} 🔷 (продажа 7 🔷 × 2.5) → 1 элитка ≈ ${(BASE_PRICE * avgMult).toFixed(0)} 💎 за ~18 🔷`);
console.log(`  ⚠ жаба при этом УДАЛЯЕТСЯ (deleteToadsByIds) — 18 🔷 → ~${(BASE_PRICE * avgMult).toFixed(0)} 💎, курс 1 🔷 ≈ ${(BASE_PRICE * avgMult / 18).toFixed(1)} 💎 (сильнее любого источника астро в походах: там ~0.4 💎 за рейд)`);
console.log("  ⚠ баги: (1) награда пишется в astro_quax, а мгновенное обновление списывает tokens, при этом текст говорит «Недостаточно астрокваксов»; (2) в shop-state.ts награды подписаны «токенов»; (3) initializeShop ставит nextRefreshElite = now, то есть при первом входе бесплатное обновление доступно сразу");

// === Ачивки: главный источник лутбоксов (а значит и стартовых легендарок) ===
console.log("\n=== Ачивки как источник астро/жаб (сравнить с 13 💎 из 28 походов!) ===");
const LOOTBOX_PRICE = 50;
const GROUPS = [
  { id: "first-steps2", boxes: 0, toads: 1, note: "туториал: жаб+а → 1 именная жаба (turtle)" },
  { id: "market-domination2", boxes: 5, toads: 1, note: "нужно 12 покупок жаб + заработать 1000 🔷" },
  { id: "genetic-engineer", boxes: 0, toads: 2, note: "редкость 10, вес 30, идеальный геном → mutantNeonBlue + forest" },
  { id: "biocampus-farm", boxes: 3, toads: 1, note: "10 диссоциаций, биомасса 100 → crystall" },
  { id: "lootbox-champion", boxes: 11, toads: 1, note: "открыть 100 лутбоксов → diamond" },
  { id: "perimeter-scouts", boxes: 3, toads: 1, note: "50 походов + сектор 6 → forest r6 (вес 26!)" },
];
let totBox = 0;
for (const g of GROUPS) { totBox += g.boxes; console.log(`  ${g.id.padEnd(20)} ${String(g.boxes).padStart(2)} лутбоксов, ${g.toads} жаба — ${g.note}`); }
console.log(`  ИТОГО: ${totBox} лутбоксов = ${totBox * LOOTBOX_PRICE} 💎 + ${GROUPS.reduce((s, g) => s + g.toads, 0)} именных жаб («Проводник Периметра»: r6, вес 26, скорость 1.45 — сильнее любой дикой!)`);
console.log(`  сравнение: ${totBox} ачивочных боксов = ${totBox * LOOTBOX_PRICE} 💎 vs ~13 💎 из всех 28 походов до s8 → астро в игре дают АЧИВКИ и элитники, а не походы`);
console.log("  следствие: «Разведчики Периметра» (3 бокса + вес-26 жаба) за 50 походов — лучший приз в игре, а 50 походов по цене выше = это ~50 × 25–90 🔷 абстрактных потерь = 1.2–4.5 суток фермы");

// === Итог: рекомендации ===
console.log("\n=== ИТОГОВЫЙ ТАЙМЛАЙН ДО «ДАЛЬНЕГО ПЕРИМЕТРА» (s8) ===");
console.log("  требуемый прогресс: s2:1, s3:3, s4:6, s5:10, s6:15, s7:21, s8:28 завершённых походов (треугольник T7)");
console.log("  минимум походов = 28 (по 1 на каждый «ключевой» сектор + добивка s1 на старте)");
console.log("  время: 28 проходов × (проход+возврат+лечение). Если ходить только s1 и s2 — ~2.1 ч на рейд → ~60 ч только «в поле», плюс 17–45 ч на фарм биомассы на снаряжение каждого дальнего рейда");
console.log("  оценка календарём: 3–5 дней активной игры для подготовленного игрока (астро/логистика), 1.5–2 недели для «всё по 2 раза» без оптимизации");
console.log("\n=== ГДЕ БАЛАНС ЛОМАЕТСЯ (приоритеты правок) ===");
console.log("  P0 походы убыточны: −1.4…−3.1 🔷/ч против фермы +4.6 🔷/ч → нет мотивации ходить, кроме прогресс-гейта. Фикс: (а) не забирать жабу с фермы (или −50% выработки), (б) loot ×2–3, (в) простой фермы НЕ должен считаться как потеря.");
console.log("  P0 добыча НЕ зависит от размера команды и риска: 1 жаба на s1 берёт 16.4 🧪/16.8 🔷 за 7.9 ч, 5 жаб — 15.6 🧪/18.6 🔷 за 4.7 ч → соло-спам выгоднее. Фикс: loot ∝ числу пройденных событий/ролям, которые реально сработали.");
console.log("  P1 элитники: жаба за 18 🔷 → 12…96 💎 (43 в среднем), при этом астро — главная валюта лутбокса (50 💎) и стоки ограничены 400 💎/сут → астро-инфляция и «печатный станок». Фикс: награда ∝ редкость×вес×фертильность сдаваемой жабы (сейчас множитель-таблица абстрактная), и/или жёсткий лимит заказов в сутки.");
console.log("  P1 баг: EliteTab пишет награду в astro_quax, а списывает tokens за мгновенное обновление, текст «Недостаточно астрокваксов» — рассинхрон валют.");
console.log("  P2 лутбокс: все 26 шаблонов rarity=5 → «редкость сама по себе не падает из бокса», игрок не чувствует джекпот-редкости. Фикс: rarity = 5/6/8/10/12 по tier шаблона.");
console.log("  P2 голод в походе: s7 отнимает 37.5 голода и НЕ кормится в пути → после дальнего рейда команда приходит на грани PRODUCTION_MIN_HUNGER (30) и ферма встаёт. Фикс: кормить в пути или ввести «рационы».");
console.log("  P3 апкип 0.6 🧪/ч на жабу при выработке 2.44 → 25% налога; при 12+ жабах содержание съедает почти весь прирост, гнездо/склад становятся ловушкой.");

// === Цены жаб: покупка/продажа/диссоциация ===
console.log("\n=== Курсы жаб (точные формулы calculateSellPrice / рынок ×2.5 / диссоциатор) ===");
// calculateSellPrice: max(r,6)/2+3, /3 если не взрослая, /3 если neuter, *(100-fault)/100 при fault>25,
// *0.5 мутант, *1.5 если НЕ мутант и НЕ гибрид, +fertility +hunger/100 -hungerRate
const sell = (r, { fertility = 1.2, hungerRate = 1.0, hunger = 80, adult = true, type = "wild", neuter = false, fault = 0 } = {}) => {
  let p = Math.max(r, 6) / 2 + 3;
  if (!adult) p /= 3;
  if (neuter) p /= 3;
  if (fault > 25) p *= (100 - fault) / 100;
  if (type === "mutant") p *= 0.5;
  if (type !== "mutant" && type !== "hybrid") p *= 1.5;
  p += fertility + hunger / 100 - hungerRate;
  return Math.max(1, Math.round(p));
};
// DISSOLVE_BASE_BIOMASS=2, DISSOLVE_RARITY_RATE=1.5, *(1+weight/50)*weightMultiplier(характер)
const dissolve = (r, weight = 16, weightMul = 1) => Math.round((2 + r * 1.5) * (1 + weight / 50) * weightMul * 10) / 10;
console.log("  тип            |  редк. | вес | продажа | рынок | разбор 🧪 | разбор 🔷 | разбор/рынок");
const rows2 = [
  { n: "дикая обычная", r: 1.2, w: 15 },
  { n: "дикая хорошая", r: 3, w: 20 },
  { n: "лутбокс common", r: 2.5, w: 12 },
  { n: "лутбокс epic", r: 5, w: 24 },
  { n: "лутбокс legend", r: 5, w: 30 },
  { n: "лучшая bred", r: 12, w: 35 },
];
for (const x of rows2) {
  const s = sell(x.r, { hunger: 80 }), m = Math.ceil(s * 2.5), d = dissolve(x.r, x.w, 1.1);
  console.log(`  ${x.n.padEnd(14)} | ${String(x.r).padStart(6)} | ${String(x.w).padStart(3)} | ${String(s).padStart(7)} | ${String(m).padStart(5)} | ${d.toFixed(1).padStart(9)} | ${(d * BIOMASS_TO_TOKENS_RATE).toFixed(1).padStart(9)} | ${((d * BIOMASS_TO_TOKENS_RATE) / m).toFixed(2).padStart(12)}`);
}
console.log("  вывод: разбор даёт в 4–5 раз меньше рыночной цены → диссоциатор это утилизация, а не доход; перепродажа не арбитражируется");
console.log("  НО: рыночная жаба (18–30 🔷) → 1 элитный заказ (43 💎 в среднем) ≈ 0.9 лутбокса (50 💎) — единственный реально масштабируемый «фарм» астро");
console.log("  ⚠ жабы из рынка/образцов приходят с голодом 10–50 (randomizeToadCharacteristics: varyNumber(hunger, 10, 50)) → до кормёжки их выработка 0.29…0.57 от максимума");
console.log("  ⚠ скорость в рынке клампится 0.2–1.0, вес 5–30, редкость ±10% → роль «скаут» (нужно 1.5) из рынка недостижима, только лутбокс/коллайдер; «танк» (вес 40) тоже за пределами рынка");



