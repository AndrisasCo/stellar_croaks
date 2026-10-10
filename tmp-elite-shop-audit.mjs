/**
 * Stellar Croak — аудит элитных заказов и цен магазина.
 * Модель механик снята с исходников (ссылки на файлы в комментариях).
 * Запуск: node tmp-elite-shop-audit.mjs
 */

// ─────────────────────────── ВЕРИФИЦИРОВАННЫЕ КОНСТАНТЫ ───────────────────────────
const BASE_PRICE = 3; // backend/shop-state.ts:275 (комментарий «= 5» устарел)
const ELITE = [
  // [id, короткое требование, множитель, реальный источник]
  ["elite_1", "weight>35 & romantic", 18, "pers"],
  ["elite_2", "dreamer", 4, "pers"],
  ["elite_3", "neuter", 5, "collider"],
  ["elite_4", "speed>2", 14, "pers x2 (1/50)"],
  ["elite_5", "weight>40 & rarity>=7", 32, "pers x2 + collider"],
  ["elite_6", "neuter & rarity>=7", 8, "collider"],
  ["elite_7", "innovator|energetic & rarity>=6", 13, "pers"],
  ["elite_8", "weight12-16 & speed0.6-0.8 & fert>=3", 11, "collider/market"],
  ["elite_9", "toadpole & gen>=8 & rarity>=6", 15, "bred"],
  ["elite_10", "glutton & weight>25", 9, "pers"],
  ["elite_11", "gen>=10 & partyAnimal", 14, "pers"],
  ["elite_12", "ascetic & fertility>3", 17, "pers"],
  ["elite_13", "leader & rarity>=5", 12, "pers"],
  ["elite_14", "philosopher & speed<0.5", 8, "pers"],
  ["elite_15", "passionate & fertility>4", 19, "pers"],
  ["elite_16", "female & socialite & rarity>=6", 13, "pers"],
  ["elite_17", "dreamer & pregnant", 11, "pers"],
  ["elite_18", "gourmet & hunger<20", 15, "pers"],
  ["elite_19", "freeSpirit & age>3d", 10, "pers"],
  ["elite_20", "workaholic & gen>=7", 16, "pers"],
  ["elite_21", "charmer & gen>=9", 18, "pers"],
  ["elite_22", "hermit & rarity>=8", 22, "pers"],
  ["elite_23", "age>10d", 20, "wait"],
  ["elite_24", "genetic_fault 15-35", 7, "collider"],
  ["elite_25", "genetic_fault>=50 & rarity>=5", 16, "collider"],
  ["elite_26", "genetic_fault>=80 & (hermit|ascetic)", 25, "pers+collider"],
].map(([id, req, mult, src]) => ({ id, req, mult, reward: mult * BASE_PRICE, src }));

const PERSONALITY_COUNT = 50; // models/Toad/index.ts — 50 ключей
const P_PERSONALITY_ASSIGN = 0.9; // calculate-genetics.ts:96 (10% -> null)
const P_SPECIFIC_PERS = P_PERSONALITY_ASSIGN / PERSONALITY_COUNT; // ≈0.018

const MAX_ENERGY = 100, ENERGY_REGEN_PER_HOUR = 6; // gamification-config.ts:8,10
const BREED_ENERGY_BASE = 25, BREED_BIOMASS_BASE = 8, COOLDOWN_BASE_MS = 600000;
const BIOMASS_PER_TOAD_HOUR = 2.1, UPKEEP_PER_TOAD_HOUR = 0.6, HUNGER_PER_DAY = 40;
const BIOMASS_TO_TOKENS = 0.5; // 2🧪 = 1🔷
const HOURS_TO_GROW_UP = 2; // models/Toad/index.ts:724
const HUNGER_DECAY_PER_HOUR = HUNGER_PER_DAY / 24;
const ENERGY_PER_DAY_PER_TOAD = ENERGY_REGEN_PER_HOUR * 24; // 144

// shop-state.ts:221-223, 239-246
const REFRESH_COOLDOWN = 3 * 3600e3;
const INSTANT_REFRESH_COST = 20;
const INSTANT_REFRESH_ELITE_COST = 50;
const ELITE_FREE_REFRESH = REFRESH_COOLDOWN * 8; // 24ч
const MARKET_STOCK_PER_REFRESH = 3;
const INITIAL_ITEMS = { lootbox: 1, battery: 2, food: 5, worms: 10, sparkleFlys: 10, pigmentUnstable: 5 };

// astro-shop.ts:12-19
const ASTRO_PRICES = { resetCooldown: 1, acceleratePregnancy: 2, quarantine: 2 };
const LOOTBOX_PRICE = 50; // use-shop.ts:132

// lootbox.ts:243-275
const LOOTBOX_TIER = { legendary: 0.005, epic: 0.025, rare: 0.12, uncommon: 0.24, common: 0.61 };
const LOOTBOX_TEMPLATES = [
  // [n, rarity гена, personality, hungerRate, fertility, weight, speed, tier]
  ["Лесной странник", 2.5, "calm", 1.2, 0.8, 18, 0.8, "common"],
  ["Болотный житель", 3.8, "lazy(!)", 1.0, 1.0, 16, 0.95, "common"],
  ["Изумрудный прыгун", 5, "active(!)", 1.0, 1.2, 20, 1.4, "uncommon"],
  ["Золотистый охотник", 5, "hunter", 1.1, 1.1, 17, 1.0, "uncommon"],
  ["Саванна", 5, "mysterious", 0.9, 1.4, 15, 1.6, "rare"],
  ["Сапфировый призрак", 5, "mysterious", 0.9, 1.4, 19, 0.6, "rare"],
  ["Камнелап", 5, "energetic", 1.2, 1.3, 16, 0.7, "rare"],
  ["Аметистовый мудрец", 5, "wise", 0.8, 1.5, 21, 0.74, "rare"],
  ["Леший", 5, "explorer", 1.0, 1.4, 15, 1.15, "rare"],
  ["Кваккон", 5, "dominant", 0.7, 1.8, 25, 0.7, "epic"],
  ["Монохром", 5, "graceful", 0.6, 1.7, 12, 0.8, "epic"],
  ["Игнис", 5, "berserk", 1.1, 1.6, 14, 0.9, "epic"],
  ["Галактрон", 5, "imperial", 0.5, 2.2, 30, 0.75, "legendary"],
  ["Хаос-прыгун", 5, "chaotic", 1.3, 2.5, 20, 1.0, "legendary"],
  ["Белгарион", 5, "lucky", 0.9, 2.8, 22, 0.85, "legendary"],
];
// personality, которых нет в таблице personalities (models/Toad/index.ts)
const INVALID_PERSONALITIES = ["lazy", "active"];
const LOOTBOX_VALID_PERSONALITIES = [...new Set(
  LOOTBOX_TEMPLATES.map((t) => t[2]).filter((p) => !INVALID_PERSONALITIES.includes(p))
)]; // 12 валидных из 50

// ALL_TOADS (shop-state.ts:18-217): 9 шаблонов, rarity 1.0-3.0, personality: null
const MARKET_TEMPLATES = [
  { rarity: 1.0, weight: 15, speed: 1.0, fert: 1.0, sex: "male" },
  { rarity: 1.1, weight: 15, speed: 1.0, fert: 1.0, sex: "female" },
  { rarity: 1.2, weight: 16, speed: 1.0, fert: 1.1, sex: "female" },
  { rarity: 1.2, weight: 17, speed: 1.0, fert: 1.0, sex: "male" },
  { rarity: 1.05, weight: 15, speed: 1.0, fert: 1.1, sex: "male" },
  { rarity: 1.0, weight: 15, speed: 1.0, fert: 0.9, sex: "male" },
  { rarity: 2.0, weight: 15, speed: 1.0, fert: 1.0, sex: "female" },
  { rarity: 3.0, weight: 15, speed: 1.0, fert: 1.0, sex: "male" },
  { rarity: 3.0, weight: 15, speed: 1.0, fert: 1.0, sex: "male" },
];

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = (v) => (v * 100).toFixed(1) + "%";
const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const line = (c = "─") => c.repeat(96);
// ─────────────────────────── МЕХАНИКИ ───────────────────────────
const PERSONALITY_KEYS = ["sleepy","glutton","energetic","romantic","hermit","partyAnimal","picky","passionate","calm","hyperactive","shy","bold","gourmet","playboy","ascetic","socialite","workaholic","dreamer","athlete","philosopher","adventurer","homebody","charmer","minimalist","epicurean","leader","follower","innovator","traditionalist","freeSpirit","hunter","mysterious","wise","explorer","dominant","graceful","imperial","chaotic","lucky","cursed","psychic","alchemist","bard","berserk","ninja","samurai","vampire","zombie","robot","ghost"];

const getEnergyCost = (rarity) => Math.round(BREED_ENERGY_BASE * (1 + rarity / 20));
const getBreedBiomassCost = (rarity) => Math.round(BREED_BIOMASS_BASE * (1 + rarity / 20));
const pregnancyHours = (rarity) => Math.min(Math.floor(Math.random() * 5) + rarity / 2, 8);
const offspringCount = (fert, rarity) =>
  Math.min(Math.ceil(fert / rarity) + Math.floor(Math.random() + fert / 10), 5);
// calculateSellPrice (models/Toad/index.ts:740-767) + calculateBuyPrice ×2.5 (use-shop.ts:298)
const sellPrice = (t) => {
  let p = Math.max(t.rarity, 6) / 2 + 3;
  if (t.neuter) p /= 3;
  if (t.fault > 25) p *= (100 - t.fault) / 100;
  if (t.mutant) p *= 0.5; else if (t.type !== "hybrid") p *= 1.5;
  p += t.fert;
  p += 0.5;
  p -= t.hungerRate ?? 1;
  return Math.max(1, Math.round(p));
};
const buyPrice = (t) => Math.ceil(sellPrice(t) * 2.5);

// Рынок: rarity = max(0, avgRarity-3) + templateRarity(±10%) (use-shop.ts:259-271)
const marketToad = (avgRarity) => {
  const tpl = MARKET_TEMPLATES[Math.floor(Math.random() * MARKET_TEMPLATES.length)];
  const shift = Math.max(0, avgRarity - 3);
  const rarity = (shift + tpl.rarity) * (1 + rnd(-0.1, 0.1));
  return {
    rarity, weight: clamp(tpl.weight * (1 + rnd(-0.1, 0.1)), 5, 30),
    speed: clamp(tpl.speed * (1 + rnd(-0.1, 0.1)), 0.2, 1.0),
    fert: clamp(tpl.fert * (1 + rnd(-0.1, 0.1)), 0.5, 3.0), personality: null,
    sex: tpl.sex, neuter: false, fault: undefined, hunger: rnd(10, 50),
    hungerRate: 1.1, ageDays: 0, pregnant: false, generation: 1, mutant: false, type: "hybrid",
  };
};
// Выведенная: personality — лотерея 0.9/50, rarity = avg+1±0.5 (calculate-genetics.ts:55-72)
const bredToad = (gen, avgRarity, ageDays = rnd(0.5, 14)) => ({
  rarity: avgRarity + 1 + rnd(-0.5, 0.5), weight: rnd(12, 28), speed: rnd(0.3, 1.45),
  fert: rnd(0.5, 3.0),
  personality: Math.random() < P_PERSONALITY_ASSIGN
    ? PERSONALITY_KEYS[Math.floor(Math.random() * PERSONALITY_COUNT)] : null,
  sex: Math.random() < 0.51 ? "male" : "female", neuter: false, fault: 0, hunger: rnd(20, 100),
  hungerRate: rnd(0.6, 1.6), ageDays, pregnant: Math.random() < 0.08, generation: gen,
  mutant: false, type: Math.random() < 0.3 ? "hybrid" : "camouflage",
});
// Коллайдер: цепочка поколений G (1-8), rarity ≈ 2.5 + G×~1.45 (+0..10 при мутации),
// fault: f = f×1.2 + 7 + rand(0,5) (calculate-genetics.ts:148-156) → 7 / 15 / 25 / 38 / 52 / 70 / 90 / 100
const colliderToad = (chainStart = 2.5) => {
  const G = 1 + Math.floor(Math.random() * 8);
  const mut = Math.random() < 0.1;
  let fault = 0, rarity = chainStart;
  for (let g = 0; g < G; g++) {
    fault = Math.min(100, fault * 1.2 + 7 + rnd(0, 5));
    rarity += 1 + 0.45 + (Math.random() < 0.1 ? rnd(0, 10) : rnd(-0.5, 0.5));
  }
  return {
    rarity, weight: clamp(rnd(14, 30), 5, 30), speed: rnd(0.2, 1.0), fert: rnd(0.5, 3.0),
    personality: Math.random() < P_PERSONALITY_ASSIGN
      ? PERSONALITY_KEYS[Math.floor(Math.random() * PERSONALITY_COUNT)] : null,
    sex: Math.random() < 0.5 ? "male" : "female", neuter: Math.random() < 0.1,
    fault, hunger: rnd(20, 100), hungerRate: rnd(0.6, 1.6), ageDays: rnd(0, 14),
    pregnant: false, generation: G, mutant: mut, type: mut ? "mutant" : "hybrid",
  };
};
const lootboxToad = () => {
  const t = LOOTBOX_TEMPLATES[Math.floor(Math.random() * LOOTBOX_TEMPLATES.length)];
  return {
    rarity: t[1], weight: t[5], speed: t[6], fert: t[4], personality: t[2],
    sex: Math.random() < 0.5 ? "male" : "female", neuter: false, fault: 0,
    hunger: rnd(30, 50), hungerRate: t[3], ageDays: rnd(0, 14), pregnant: false,
    generation: 1, mutant: false, type: "hybrid",
  };
};
// Колония: N взрослых из разных источников (доли состава — допущение модели)
const buildColony = (N, avgRarity, chainStart) => {
  const toads = [];
  for (let i = 0; i < N; i++) {
    const roll = Math.random();
    let t;
    if (roll < 0.05) t = lootboxToad();
    else if (roll < 0.2) t = colliderToad(chainStart);
    else if (roll < 0.45) t = marketToad(avgRarity);
    else t = bredToad(2 + Math.floor(Math.random() * 11), avgRarity);
    // в любой момент ~2.5% колонии — головастики (окно роста 2ч при ~18 родах/сут)
    if (Math.random() < 0.025) t.toadpole = true;
    toads.push(t);
  }
  return toads;
};

// ─────────────────────────── ПРЕДИКАТЫ ЗАКАЗОВ ───────────────────────────
const REQ = {
  elite_1: (t) => t.weight > 35 && t.personality === "romantic",
  elite_2: (t) => t.personality === "dreamer",
  elite_3: (t) => t.neuter,
  elite_4: (t) => t.speed > 2,
  elite_5: (t) => t.weight > 40 && t.rarity >= 7,
  elite_6: (t) => t.neuter && t.rarity >= 7,
  elite_7: (t) => (t.personality === "innovator" || t.personality === "energetic") && t.rarity >= 6,
  elite_8: (t) => t.weight >= 12 && t.weight <= 16 && t.speed >= 0.6 && t.speed <= 0.8 && t.fert >= 3,
  elite_9: (t) => t.toadpole && t.generation >= 8 && t.rarity >= 6,
  elite_10: (t) => t.personality === "glutton" && t.weight > 25,
  elite_11: (t) => t.generation >= 10 && t.personality === "partyAnimal",
  elite_12: (t) => t.personality === "ascetic" && t.fert > 3,
  elite_13: (t) => t.personality === "leader" && t.rarity >= 5,
  elite_14: (t) => t.personality === "philosopher" && t.speed < 0.5,
  elite_15: (t) => t.personality === "passionate" && t.fert > 4,
  elite_16: (t) => t.sex === "female" && t.personality === "socialite" && t.rarity >= 6,
  elite_17: (t) => t.personality === "dreamer" && t.pregnant,
  elite_18: (t) => t.personality === "gourmet" && t.hunger < 20,
  elite_19: (t) => t.personality === "freeSpirit" && t.ageDays > 3,
  elite_20: (t) => t.personality === "workaholic" && t.generation >= 7,
  elite_21: (t) => t.personality === "charmer" && t.generation >= 9,
  elite_22: (t) => t.personality === "hermit" && t.rarity >= 8,
  elite_23: (t) => t.ageDays > 10,
  elite_24: (t) => t.fault !== undefined && t.fault >= 15 && t.fault <= 35,
  elite_25: (t) => t.fault !== undefined && t.fault >= 50 && t.rarity >= 5,
  elite_26: (t) => t.fault !== undefined && t.fault >= 80
    && (t.personality === "hermit" || t.personality === "ascetic"),
};

// ─────────────────────────── A. ЖИЗНЕСПОСОБНОСТЬ ЗАКАЗОВ (МОНТЕ-КАРЛО) ───────────────────────────
const N = 30000;
const SCENARIOS = [
  { name: "день ~10, 25 жаб, avg rarity 5, 2 гнезда", toads: 25, avgRarity: 5, chain: 6, slots: 2 },
  { name: "день ~25, 60 жаб, avg rarity 10, 6 гнёзд", toads: 60, avgRarity: 10, chain: 12, slots: 6 },
];
const COLONY = SCENARIOS.map((s) => ({ ...s, sample: buildColony(s.toads, s.avgRarity, s.chain) }));

console.log(line("═"));
console.log("STELLAR CROAK — АУДИТ ЭЛИТНЫХ ЗАКАЗОВ И ЦЕН МАГАЗИНА");
console.log(line("═"));
console.log(`\n[0] База: сумма наград 26 заказов = ${ELITE.reduce((a, o) => a + o.reward, 0)}💎,`);
console.log(`    средняя награда = ${f1(ELITE.reduce((a, o) => a + o.reward, 0) / ELITE.length)}💎/заказ;`);
console.log(`    специфичная личность: 0.9/50 = ${pct(P_SPECIFIC_PERS)} на потомка → ожидание ${f1(1 / P_SPECIFIC_PERS)} детей;`);
console.log(`    валидных личностей в лутбоксах: ${LOOTBOX_VALID_PERSONALITIES.length} из ${PERSONALITY_COUNT} (${LOOTBOX_VALID_PERSONALITIES.join(", ")})`);
console.log(`    невалидные ключи в шаблонах лутбокса: ${INVALID_PERSONALITIES.join(", ")} → personalities[...] = undefined`);

console.log(`\n[A] ВЕРОЯТНОСТЬ «ЕСТЬ ПОДХОДЯЩАЯ ЖАБА» (по ${N / 50} прогонам колонии, колония генерится заново каждый прогон)`);
console.log(line("-"));
console.log("id        награда  требование                              день10    день25   источник по коду");
const IT = N / 50;
for (const o of ELITE) {
  const p = COLONY.map((c) => {
    let ok = 0;
    for (let k = 0; k < IT; k++) {
      const col = buildColony(c.toads, c.avgRarity, c.chain);
      if (col.some((t) => REQ[o.id](t))) ok++;
    }
    return ok / IT;
  });
  console.log(
    `${o.id.padEnd(9)} ${String(o.reward).padStart(5)}💎  ${o.req.padEnd(40)} ${pct(p[0]).padStart(7)}  ${pct(p[1]).padStart(7)}  ${o.src}`
  );
}


// ─────────────────────────── B. СТОИМОСТЬ ДОБЫЧИ КАЖДОГО ЗАКАЗА ───────────────────────────
// C = ожидаемое число выведенных детей, R = запусков коллайдера, D = суток конвейера,
// cash = потраченных взрослых жаб (рыночная цена 27🔷 за штуку).
// Правила: pers → 1/(0.9/50)=55.6 детей; доп.фильтры — по распределению гена.
const COST = {
  elite_1: { C: 371, R: 0, D: 21, cash: 0, why: "romantic + weight>35 (вес растёт только при 1/50 мультипликаторе)" },
  elite_2: { C: 56, R: 0, D: 3.1, cash: 0, why: "чистая лотерея личности" },
  elite_3: { C: 0, R: 10, D: 0.3, cash: 20, why: "10% бесполых на запуск коллайдера" },
  elite_4: { C: 2500, R: 0, D: 140, cash: 0, why: "speed>2: нужно 2+ подряд ролла hyperactive(1/50) чтобы пройти 1.6→1.97→2.2; практически мёртвый контент" },
  elite_5: { C: 3100, R: 8, D: 175, cash: 16, why: "weight>40 требует ветку avg>30 + 2 подряд ролла glutton/gourmet(1/50) плюс rarity>=7" },
  elite_6: { C: 0, R: 10, D: 0.4, cash: 20, why: "то же, но цепочка коллайдера rarity>=7" },
  elite_7: { C: 28, R: 0, D: 1.6, cash: 0, why: "2/50 личности, rarity>=6 бесплатна к 2-му поколению" },
  elite_8: { C: 20, R: 0, D: 1.1, cash: 0, why: "нужна выведенная из лутбокс-шаблонов (Камнелап w16/s0.7 + Монохром w12/s0.8); рынок даёт speed>=0.9 всегда" },
  elite_9: { C: 0, R: 0, D: 0.5, cash: 0, why: "головастик не растёт, если голоден → «вечный» головастик gen8" },
  elite_10: { C: 111, R: 0, D: 6.2, cash: 0, why: "1/50 + P(weight>25)~0.5" },
  elite_11: { C: 56, R: 0, D: 3.1, cash: 0, why: "линия gen>=10 + 1/50" },
  elite_12: { C: 1852, R: 0, D: 103, cash: 0, why: "fertility>3: клампы рынка 3.0 и дрейф наследования" },
  elite_13: { C: 56, R: 0, D: 3.1, cash: 0, why: "1/50" },
  elite_14: { C: 371, R: 0, D: 21, cash: 0, why: "1/50 + speed<0.5 (рынок всегда >=0.9)" },
  elite_15: { C: 11120, R: 0, D: 618, cash: 0, why: "fertility>4 практически недостижима" },
  elite_16: { C: 111, R: 0, D: 6.2, cash: 0, why: "1/50 x 51% самок" },
  elite_17: { C: 185, R: 0, D: 10, cash: 0, why: "нужен dreamer И беременная в момент сдачи" },
  elite_18: { C: 56, R: 0, D: 3.1, cash: 0, why: "голод<20 достигается голоданием" },
  elite_19: { C: 56, R: 0, D: 6.1, cash: 0, why: "1/50 + 3 суток ожидания" },
  elite_20: { C: 56, R: 0, D: 3.1, cash: 0, why: "линия gen>=7 + 1/50" },
  elite_21: { C: 56, R: 0, D: 3.1, cash: 0, why: "линия gen>=9 + 1/50" },
  elite_22: { C: 56, R: 0, D: 3.1, cash: 0, why: "1/50 + цепочка rarity>=8 (побочный продукт)" },
  elite_23: { C: 0, R: 0, D: 10, cash: 1, why: "купить на рынке и держать 10 суток" },
  elite_24: { C: 0, R: 2.5, D: 0.3, cash: 5, why: "fault 15-35 = 2-3 поколения коллайдера" },
  elite_25: { C: 0, R: 5.5, D: 0.6, cash: 11, why: "fault>=50 = 5-6 поколений коллайдера" },
  elite_26: { C: 0, R: 55, D: 11, cash: 110, why: "fault>=80 (8 коллайдер-генов) + 1/50 личность на коллайдер-ребёнке" },
};

console.log(`\n[B] ЦЕНА ДОБЫЧИ vs НАГРАДА (целенаправленная стратегия)`);
console.log(line("-"));
console.log("id        награда  детей  коллайд.  суток  стоимость🔷  награда/сутки  вердикт");
for (const o of ELITE) {
  const c = COST[o.id];
  // стоимость = рыночная цена сожжённых жаб + биомасса на детей (10🧪 = 5🔷) + жабы для коллайдера
  const cost = c.cash * 27 + (c.C === Infinity ? Infinity : c.C * 5) + c.R * 2 * 27;
  const perDay = c.D ? o.reward / c.D : 0;
  const verdict =
    c.D === Infinity ? "НЕВОЗМОЖНО (мёртвый контент)"
      : o.src === "collider" && c.C === 0 ? "побочный продукт коллайдера (цепочка нужна для редкости)"
        : c.D > 10 ? `долго: ${f1(c.D)} сут конвейера`
          : o.reward > cost ? "выгодно" : o.reward > cost * 0.5 ? "на грани" : "УБЫТОК: добыча дороже награды";
  console.log(
    `${o.id.padEnd(9)} ${String(o.reward).padStart(5)}💎  ${String(c.C === Infinity ? "∞" : f1(c.C)).padStart(6)}  ${String(c.R).padStart(7)}  ${(c.D === Infinity ? "∞" : f1(c.D)).padStart(6)}  ${String(Math.round(cost)).padStart(9)}🔷  ${f1(perDay).padStart(9)}💎/с  ${verdict}`
  );
}
console.log("\nПояснения к самым показательным позициям:");
for (const id of ["elite_23", "elite_22", "elite_15", "elite_4", "elite_26"])
  console.log(`  ${id}: ${COST[id].why}`);
// ─────────────────────────── C. EV ЭЛИТНОЙ ВИТРИНЫ ───────────────────────────
// 3 заказа из 26 на витрине (getNewElite: shuffle + slice(0,3)), бесплатно раз в 24ч,
// мгновенное обновление 50🔷 без кулдауна (EliteTab.tsx:67-84).
const sumReward = ELITE.reduce((a, o) => a + o.reward, 0);
const pLate = {};
for (const o of ELITE) {
  let ok = 0;
  for (let k = 0; k < 600; k++) {
    if (buildColony(COLONY[1].toads, COLONY[1].avgRarity, COLONY[1].chain).some((t) => REQ[o.id](t))) ok++;
  }
  pLate[o.id] = ok / 600;
}
const evBoard = (p) => (3 / ELITE.length) * ELITE.reduce((a, o) => a + p[o.id] * o.reward, 0);
const pAll = Object.fromEntries(ELITE.map((o) => [o.id, 1]));
const pWait = Object.fromEntries(
  ELITE.map((o) => [o.id, ["elite_19", "elite_23", "elite_24"].includes(o.id) ? 1 : 0])
);
const FARM_PER_DAY = 111; // нетто фермы зрелой колонии (из tmp-balance-sim.mjs)

console.log("\nОговорки модели [A]: генератор колонии не создаёт значения вне клампов рынка,");
console.log("поэтому elite_1/elite_5 (weight>30), elite_8/elite_12/elite_15 (fertility>=3) и elite_18");
console.log("(голод<20) читаются как 0% — их аналитическая оценка дана в блоке [B];");
console.log("elite_4 (speed>2) недостижим без 2+ подряд роллов hyperactive, elite_17 требует сдачи в окне беременности.");
console.log("\n[C] EV ВИТРИНЫ ЭЛИТНЫХ ЗАКАЗОВ");
console.log(line("-"));
console.log(`  Максимум по коду (сдаются все 3): ${f1((3 * sumReward) / ELITE.length)}💎 за 50🔷 = ${f2((3 * sumReward) / ELITE.length / 50)}💎/🔷`);
console.log(`  Реальная зрелая колония (день 25): ${f1(evBoard(pLate))}💎 за витрину = ${f2(evBoard(pLate) / 50)}💎/🔷`);
console.log(`  Стратегия «купил на рынке и выдержал»: ${f1(evBoard(pWait))}💎 за витрину = ${f2(evBoard(pWait) / 50)}💎/🔷`);
console.log(`\n  Ферма даёт ~${FARM_PER_DAY}🔷/сут → ${f2(FARM_PER_DAY / 50)} обновлений витрины/сут`);
console.log(`  → реальная колония: ${f1(((FARM_PER_DAY / 50) * evBoard(pLate)))}💎/сут из 🔷`);
console.log(`  → идеальная колония: ${f1(((FARM_PER_DAY / 50) * evBoard(pAll)))}💎/сут (x${f1(evBoard(pAll) / evBoard(pLate))} к реальной)`);
console.log(`  Астро-сток по дизайну (ускорители 1-2💎) ≈ ${f2((50 + 5 * 2 + 20 + 10) / 24)}💎/сут — то есть стока практически нет.`);

// ─────────────────────────── D. ЦЕНЫ МАГАЗИНА ───────────────────────────
const biomassRate = (r, w, mult = 1) => 2.1 * (1 + r / 10) * (1 + w / 50) * mult; // 🧪/ч
const rate = biomassRate(5, 20); // средняя взрослая жаба rarity5/weight20
const foodGainPerUnit = 0.5 * rate * 21 * 0.5; // кормление 60→100: +0.5 фактора на ~21ч, 2🧪 = 1🔷
const market27 = buyPrice({ rarity: 1.2, fert: 1.1, hungerRate: 1.1, type: "hybrid" });
const market12 = buyPrice({ rarity: 12, fert: 1.5, hungerRate: 1.0, type: "camo" });

console.log(`\n[D] ЦЕНЫ МАГАЗИНА: ЧТО ПЛАТИМ И ЧТО ПОЛУЧАЕМ`);
console.log(line("-"));
console.log(`  Ориентиры: спаривание = 2x${getEnergyCost(5)}⚡ + 2x${getBreedBiomassCost(5)}🧪; энергия ${ENERGY_REGEN_PER_HOUR}⚡/ч = ${ENERGY_PER_DAY_PER_TOAD}⚡/сут на жабу;`);
console.log(`  жаба с рынка rarity1.2 = ${market27}🔷, rarity12 (колония avg15) = ${market12}🔷; выработка средней жабы ${f2(rate)}🧪/ч.`);
console.log("");
const rows = [
  ["Корм x10", "10🔷", "∞", `+100 голода на 1 жабу → +${f1(foodGainPerUnit)}🔷 биомассы с 1 корма`, `${f0(foodGainPerUnit)}x выгода`],
  ["Корм x100", "90🔷", "5/3ч", "то же, скидка 10%", `${f0(foodGainPerUnit * 0.9)}x выгода`],
  ["Батарейки x3", "5💎", "2/3ч", "−30 мин инкубации = 10💎/ч", "дорого (сброс кулдауна 1💎 за 15-22 мин)"],
  ["Прот. черви", "10💎", "1/3ч", "пропуск роста 2ч (HOURS_TO_GROW_UP)", "плохо: 5💎/ч, ценность только для спидранна"],
  ["Сияющие мушки", "20💎", "1/3ч", "мгновенные роды (0-8ч беременности)", "мертво: acceleratePregnancy 2💎 x2 = то же дешевле"],
  ["Нестаб. пигмент", "15💎", "5/3ч", "случайный цвет", "косметика-гэмбл, в 3x дороже выбранного"],
  ["Пигмент RGB", "5💎", "∞", "выбранный цвет", "косметика, но бесконечный сток"],
  ["Лутбокс", "50💎", "1/3ч", "1 жаба: rarity гена ВСЕГДА 5, gen1, fault0", "переоценён: рынок даёт то же за 27🔷"],
];
console.log("товар            цена   сток   эффект                                          вердикт");
for (const [n, p, s, e, v] of rows)
  console.log(`${n.padEnd(16)} ${p.padEnd(6)} ${s.padEnd(6)} ${e.padEnd(46)} ${v}`);

console.log(`\n  Лутбокс: тиры (legendary 0.5% / epic 2.5% / rare 12% / uncommon 24% / common 61%, гарантия rare каждые 10, epic на 50-м)`);
console.log(`  меняют ТОЛЬКО шаблон (тип/характер/множители генов), но не rarity гена → «джекпот» не ощущается.`);
console.log(`  pityCounter — модульная let-переменная (lootbox.ts:242) → сбрасывается при перезагрузке страницы; console.log({pityCounter}) остался в проде.`);
console.log(`  ${INVALID_PERSONALITIES.length} из ${LOOTBOX_TEMPLATES.length} шаблонов («Болотный житель», «Изумрудный прыгун») используют несуществующие личности ${INVALID_PERSONALITIES.join("/")} → personalities[...] = undefined;`);
console.log(`  лутбокс закрывает ${LOOTBOX_VALID_PERSONALITIES.length}/${PERSONALITY_COUNT} личностей, а 16 из 17 «личностных» заказов требуют остальные — лутбокс их не решает.`);

console.log(`\n  Рынок жаб: цена = ceil(sellPrice x 2.5); rarity = max(0, avgКолонии-3) + шаблон(1.0-3.0) ±10%;`);
console.log(`  все 9 шаблонов имеют personality: null, speed 1.0±10% (кламп 0.2-1.0), weight 15-17 (кламп 5-30), фиксированный пол.`);
console.log(`  ⇒ рынок НИКОГДА не даёт личность, бесполость, speed<0.9, weight>18.7, genetic_fault (undefined) — он закрывает только elite_23.`);
console.log(`  ⇒ 24% обновлений рынка без самок: пол берётся из шаблона (3 из 9 самки) → 20/84 комбинаций полностью мужские.`);
console.log(`  Мгновенное обновление рынка 20🔷 БЕЗ проверки кулдауна (use-shop.ts:278) → неограниченная закупка жаб + восстановление стоков.`);

console.log(`\n  Постройки: вольер 100🔷 x n (+20 мест) = 5🔷/место при ценности жабы ${market27}-${market12}🔷 — дёшево;`);
console.log(`  гнездо 40/72/130/233🔷 (+1 слот, 2→6): +3-5 родов/сут ≈ ${f1(3 * 1.6 * market27)}🔷/сут ценности → окупается <1 суток = недооценено на порядок;`);
console.log(`  офис диспетчера 250+900=1150🔷 — на фоне нерентабельных походов (см. tmp-balance-sim.mjs) переоценённый товар.`);

console.log(`\n[E] ИТОГОВЫЕ ВЫВОДЫ ПО ЗАКАЗАМ И ЦЕНАМ`);
console.log(line("-"));
console.log(`  P0-1 Личность = лотерея 1/50 на потомка: 17 из 26 заказов требуют личность, которая НЕ наследуется`);
console.log(`       и НЕ продаётся (нет ни в 9 шаблонах рынка, ни среди ${LOOTBOX_VALID_PERSONALITIES.length}/50 личностей лутбокса).`);
console.log(`       Целенаправленная добыча = 3-100+ суток конвейера на один заказ.`);
console.log(`  P0-2 Инверсия сложности и награды: elite_23 (просто держать жабу 10 суток) = 60💎 против`);
console.log(`       elite_22 (1/50 + цепочка коллайдера) = 110💎, elite_15 (fertility>4) = 95💎 за ~618 суток.`);
console.log(`  P0-3 Мёртвый контент: elite_4 (speed>2) требует 2+ подряд 1/50-роллов hyperactive,`);
console.log(`       elite_5/elite_12/elite_15/elite_1 — 100+ суток конвейера. Витрина берёт 3 случайных из 26`);
console.log(`       → ~20% показов невыполнимы, а гены веса/скорости/фертильности вообще не имеют экономического выхода.`);
console.log(`  P0-4 Награды зажаты в 20-160💎 при цене добычи 280-1800🔷: заказ = 0.4-3.2 лутбокса,`);
console.log(`       а личностный тоад стоит 280-900🔷 → ROI 0.03-0.2. Реальная отдача витрины 0.76💎/🔷 (38💎 за витрину):`);
console.log(`       ~45% EV — это elite_23 (ожидание) и побочные продукты коллайдера (elite_3/6/24/25), остальное — случайные совпадения по инвентарю.`);
console.log(`  P1-1 Рынок (rarity от колонии, 20🔷 за реролл) — источник корма для коллайдера, но закрывает ровно 1 заказ из 26`);
console.log(`       (elite_23) → прогрессия заказов не связана ни с рынком, ни с генетикой.`);
console.log(`  P1-2 Потолок фонтана от витрины ~85💎/сут (2.22 витрины по 111🔷/сут фермы) — это 1.7 лутбокса/сут,`);
console.log(`       то есть самостоятельного инфляционного риска нет; риск в другом — 80% витрины простаивает.`);
console.log(`  P1-3 Корм недооценён в ~${f0(foodGainPerUnit)}x по отдаче: 1🔷 корма возвращает ${f1(foodGainPerUnit)}🔷 биомассы → голод и апкип 0.6🧪/ч не работают как ограничение.`);
console.log(`  P1-4 Магазинные ускорители дороже астро-аналогов в 3-20x (мушки 20💎 против acceleratePregnancy 2💎) → предметы не покупают.`);
console.log(`  P2-1 Лутбокс: rarity гена всегда 5, тиры косметические, pity сбрасывается при reload, console.log в проде,`);
console.log(`       2 шаблона с несуществующими личностями.`);
console.log(`  P2-2 Гнездо 40🔷 и вольер 5🔷/место недооценены на порядок — это не сток 🔷, а главный ускоритель конвейера заказов.`);
console.log(`  P2-3 Баг валюты: кнопка элитки вычитает tokens, а текст кричит «Недостаточно астрокваксов» (EliteTab.tsx:68-76).`);
console.log(`  P2-4 initializeShop (shop-state.ts:248-260) ставит nextRefreshElite = now → бесплатное обновление витрины при первом входе.`);

console.log(`\n[F] ПРЕДЛОЖЕНИЯ ПО РЕБАЛАНСУ (конкретные числа)`);
console.log(line("-"));
console.log(`  Заказы: elite_23 60→25💎 (чистое ожидание), elite_19 30→20💎, elite_24 21→15💎, elite_25 48→40💎;`);
console.log(`          elite_22 66→180💎, elite_20/21 48/54→140💎, elite_13 36→90💎, elite_16 39→120💎;`);
console.log(`          elite_1 54→400💎, elite_5 96→600💎, elite_12 51→600💎, elite_15 57→800💎, elite_4 42→600💎`);
console.log(`          (или снизить пороги: weight>32, speed>1.8, fertility>3.5, чтобы они были достижимы за 10-20 суток);`);
console.log(`          elite_8 (конструктор из лутбокс-шаблонов) 33→120💎, elite_9 (вечный головастик) 45→25💎.`);
console.log(`  Главный фикс: сделать личность НАСЛЕДУЕМОЙ (45% от случаяного родителя / 45% случайная / 10% null)`);
console.log(`                либо продавать на рынке 1 «личностного» тоада за 60-90🔷 — тогда заказы станут целью, а не лотереей.`);
console.log(`  Магазин: корм 10🔷/10 → 60🔷/10 и 540🔷/100 (ROI 23x → 3.8x); черви 10→4💎; мушки 20→4💎; батарейки x3 5→3💎;`);
console.log(`           нестабильный пигмент 15→8💎; лутбокс оставить 50💎, но ПРИВЯЗАТЬ тир к гену редкости (3/5/8/11/15);`);
console.log(`           гнездо 40/72/130/233 → 150/450/1200/3000🔷; вольер 100🔷 → 300🔷;`);
console.log(`           мгновенное обновление рынка 20→50🔷 + кулдаун 30 мин; витрины 50→150🔷 + кулдаун 1 ч.`);
console.log(`  Код: pityCounter в localStorage/аккаунт, убрать console.log({pityCounter}); починить личности lazy/active в lootbox.ts;`);
console.log(`       в EliteTab вычитать и писать одну валюту; initializeShop → nextRefreshElite = now + 24ч.`);
console.log(line("═"));

function f0(v) { return Math.round(v); }

