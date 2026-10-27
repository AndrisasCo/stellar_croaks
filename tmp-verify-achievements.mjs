/**
 * Проверка синхронизации ДОСТИЖЕНИЙ на РЕАЛЬНОМ коде проекта.
 *
 * Достижения, в отличие от квестов, лежат отдельным ключом localStorage и
 * уезжают в `game_state.achievements`. Групповая награда выдаёт жаб и лутбоксы,
 * поэтому повторная выдача — прямая потеря экономики. Скрипт проверяет:
 *   1) `claimReward` идемпотентен: второй вызов не выдаёт награду снова;
 *   2) `completeAchivement` не дублирует ачивку и событие;
 *   3) монотонное слияние: `completed`/`rewards`/`toads_collection` — union,
 *      `counter` — максимум, то есть старый сейв не стирает чужие награды;
 *   4) битые данные из облака (null, строки вместо массивов, мусор в счётчиках)
 *      не ломают загрузку и не откатывают локальный прогресс;
 *   5) `mergeCloudAchievements` сразу пишет объединение в localStorage;
 *   6) старый сейв без `rewards` не падает при первой выдаче награды;
 *   7) `clearAchievementState` убирает достижения при смене аккаунта.
 *
 * Запуск: node tmp-verify-achievements.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-achievements-"));
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

// Заглушки браузера: достижения пишут в localStorage и шлют CustomEvent.
const store = new Map();
const events = [];

globalThis.CustomEvent ||= class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent: (event) => {
    events.push(event);
    return true;
  },
};

const achievements = bundle(
  "src/backend/achivements-manager/index.ts",
  "achievements",
);

const STATE_KEY = achievements.STATE_KEY;
const emptyState = () => ({
  completed: [],
  rewards: [],
  counter: {},
  toads_collection: [],
});
const write = (state) => store.set(STATE_KEY, JSON.stringify(state));
const read = () => JSON.parse(store.get(STATE_KEY));

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};
const checkTrue = (label, value) => check(label, Boolean(value), true);

// 1. Награда группы выдаётся ровно один раз.
write(emptyState());
check("первая выдача награды", achievements.claimReward("first-steps2"), true);
check("повторная выдача отклонена", achievements.claimReward("first-steps2"), false);
check("награда записана один раз", read().rewards.length, 1);
check("id награды сохранён", read().rewards[0], "first-steps2");

// 2. Обычная ачивка и её событие не дублируются.
write(emptyState());
const eventsBefore = events.length;
achievements.completeAchivement("read-tutorial");
achievements.completeAchivement("read-tutorial");
check("ачивка записана один раз", read().completed.length, 1);
check(
  "событие отправлено один раз",
  events.filter((event) => event.type === "AchivementCompleted").length,
  eventsBefore + 1,
);


// 3. Слияние: журналы объединяются, счётчики берут максимум.
const local = {
  completed: ["feed-one"],
  rewards: [],
  counter: { earn: 100, lootbox: 2 },
  toads_collection: ["hybrid"],
};
const cloud = {
  completed: ["feed-one", "read-tutorial"],
  rewards: ["first-steps2"],
  counter: { earn: 40, expedition: 3 },
  toads_collection: ["hybrid", "tiger"],
};

const merged = achievements.mergeAchievementStates(local, cloud);
check(
  "completed объединён без дублей",
  merged.completed.join(","),
  "feed-one,read-tutorial",
);
check("rewards из облака сохранён", merged.rewards.join(","), "first-steps2");
check("счётчик не откатывается назад", merged.counter.earn, 100);
check("новый счётчик из облака принят", merged.counter.expedition, 3);
check(
  "коллекция жаб объединена",
  merged.toads_collection.join(","),
  "hybrid,tiger",
);

// 4. Обратный случай: облако старое, локальная награда не должна исчезнуть.
const kept = achievements.mergeAchievementStates(
  { ...local, rewards: ["genetic-engineer"], counter: { earn: 5 } },
  emptyState(),
);
check("локальная награда не теряется", kept.rewards.join(","), "genetic-engineer");
check("локальный счётчик не обнуляется", kept.counter.earn, 5);

// 5. Битое облако: мусор отбрасывается, локальный прогресс цел.
const broken = achievements.mergeAchievementStates(local, {
  completed: "not-an-array",
  rewards: null,
  counter: { earn: "oops", lootbox: 4 },
  toads_collection: ["hybrid", "not-a-toad"],
});
check("битый completed не ломает", broken.completed.join(","), "feed-one");
check("битый rewards не ломает", broken.rewards.length, 0);
check("строковый счётчик отброшен", broken.counter.earn, 100);
check("числовой счётчик из облака принят", broken.counter.lootbox, 4);
check(
  "незнакомый вид жабы сохраняется",
  broken.toads_collection.join(","),
  "hybrid,not-a-toad",
);

const nullCloud = achievements.mergeAchievementStates(local, null);
check("null вместо облака безопасен", nullCloud.completed.join(","), "feed-one");

// 6. `mergeCloudAchievements` не только возвращает, но и сохраняет результат.
write({
  completed: ["feed-one"],
  rewards: [],
  counter: { earn: 10 },
  toads_collection: [],
});
const saved = achievements.mergeCloudAchievements({
  completed: ["read-tutorial"],
  rewards: ["first-steps2"],
  counter: { earn: 3 },
  toads_collection: ["tiger"],
});
check(
  "mergeCloudAchievements вернул объединение",
  saved.completed.join(","),
  "feed-one,read-tutorial",
);
check("mergeCloudAchievements записал награду", read().rewards.join(","), "first-steps2");
check("mergeCloudAchievements записал счётчик", read().counter.earn, 10);
check(
  "mergeCloudAchievements записал коллекцию",
  read().toads_collection.join(","),
  "tiger",
);

// 7. Сейв старого формата без `rewards` не падает на первой награде.
store.set(STATE_KEY, JSON.stringify({ completed: [], counter: {} }));
check("старый сейв: награда выдана", achievements.claimReward("first-steps2"), true);
check("старый сейв: rewards создан", read().rewards.join(","), "first-steps2");

// 7.1. Битый JSON в localStorage не ломает чтение и загрузку игры.
store.set(STATE_KEY, "{broken");
check(
  "битый локальный JSON читается как пустой сейв",
  achievements.getAchievementState().completed.length,
  0,
);

// 8. Очистка при смене аккаунта.
achievements.clearAchievementState();
check("clearAchievementState удалил ключ", store.has(STATE_KEY), false);
checkTrue(
  "после очистки состояние пустое",
  achievements.getAchievementState().completed.length === 0 &&
    achievements.getAchievementState().rewards.length === 0,
);

if (failures.length) {
  console.error(`\n❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("\n✅ Все проверки достижений пройдены");
