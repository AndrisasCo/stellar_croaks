/**
 * Проверка выдачи ЭЛИТНЫХ ЗАКАЗОВ на РЕАЛЬНОМ коде проекта.
 *
 * Награда за заказ (Астро-кваксы) пишется в `GameState`, а сам заказ убирается
 * из отдельного `shop`. Между двумя записями можно нажать кнопку ещё раз или
 * перезаписать витрину из устаревшей вкладки — и получить награду повторно.
 * Скрипт проверяет:
 *   1) `claimEliteOrder` списывает заказ ровно один раз;
 *   2) повторный вызов и неизвестный id не платят;
 *   3) заказ, возвращённый устаревшей витриной, снова не оплачивается и
 *      вычищается из неё;
 *   4) после обновления витрины (новая эпоха) тот же id снова доступен;
 *   5) битый журнал сдач не ломает выдачу;
 *   6) `clearShopState` убирает и витрину, и журнал при смене аккаунта.
 *
 * Запуск: node tmp-verify-elite-orders.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-elite-"));
const outfile = join(outDir, "shop-state.cjs");

execFileSync(
  "npx",
  [
    "esbuild",
    "src/backend/shop-state.ts",
    "--bundle",
    "--format=cjs",
    "--platform=node",
    "--log-level=error",
    `--outfile=${outfile}`,
  ],
  { cwd: process.cwd(), stdio: ["ignore", "ignore", "inherit"] },
);

// Заглушка браузера: витрина и журнал сдач живут в localStorage устройства.
const store = new Map();

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const shop = require(outfile);
const SHOP_KEY = shop.SHOP_STATE_KEY;
const CLAIMS_KEY = "toad_elite_claims";
const EPOCH = 1_700_000_000_000;

const makeShop = (eliteOrders, epoch = EPOCH) => ({
  availableToads: [],
  lastRefresh: epoch - 1000,
  nextRefresh: epoch,
  lastRefreshElite: epoch,
  nextRefreshElite: epoch + 24 * 60 * 60 * 1000,
  eliteOrders,
  items: { lootbox: 7 },
});
const writeShop = (state) => store.set(SHOP_KEY, JSON.stringify(state));
const readShop = () => JSON.parse(store.get(SHOP_KEY));

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};

// 1. Заказ списывается ровно один раз, остальная витрина не меняется.
writeShop(makeShop(["order-a", "order-b"]));
check("первая сдача принята", shop.claimEliteOrder("order-a"), true);
check("заказ убран из витрины", readShop().eliteOrders.join(","), "order-b");
check("товары витрины не тронуты", readShop().items.lootbox, 7);
check("эпоха витрины не тронута", readShop().lastRefreshElite, EPOCH);

// 2. Повторная сдача того же заказа и неизвестный id не платят.
check("повторная сдача отклонена", shop.claimEliteOrder("order-a"), false);
check("неизвестный заказ отклонён", shop.claimEliteOrder("order-x"), false);
check("витрина не изменилась", readShop().eliteOrders.join(","), "order-b");

// 3. Устаревшая вкладка вернула заказ в витрину — оплаты всё равно нет,
//    а заказ вычищается, чтобы не висел в интерфейсе.
writeShop(makeShop(["order-a", "order-b"]));
check("возвращённый заказ не оплачен", shop.claimEliteOrder("order-a"), false);
check("возвращённый заказ вычищен", readShop().eliteOrders.join(","), "order-b");

// 4. После обновления витрины (новая эпоха) тот же id снова доступен.
writeShop(makeShop(["order-a"], EPOCH + 1));
check("в новой эпохе заказ снова доступен", shop.claimEliteOrder("order-a"), true);

// 5. Неизвестный id не попадает в журнал и не блокирует заказ позже.
const epoch = EPOCH + 2;
writeShop(makeShop([], epoch));
check("неизвестный id отклонён до добавления", shop.claimEliteOrder("order-c"), false);
writeShop(makeShop(["order-c"], epoch));
check("добавленный заказ не заблокирован", shop.claimEliteOrder("order-c"), true);

// 6. Битый журнал сдач не ломает выдачу.
store.set(CLAIMS_KEY, "{broken");
writeShop(makeShop(["order-a"], EPOCH + 3));
check("битый журнал: заказ выдан", shop.claimEliteOrder("order-a"), true);
check("битый журнал: заказ убран", readShop().eliteOrders.length, 0);

// 7. Смена аккаунта убирает и витрину, и журнал.
shop.clearShopState();
check("clearShopState удалил витрину", store.has(SHOP_KEY), false);
check("clearShopState удалил журнал сдач", store.has(CLAIMS_KEY), false);

// 8. После очистки тот же заказ можно сдать в новой витрине.
writeShop(makeShop(["order-a"], EPOCH + 4));
check("после очистки заказ доступен", shop.claimEliteOrder("order-a"), true);

// 9. Жаба списывается с витрины ровно один раз (защита от клонирования
//    двойным кликом до оплаты).
const toadA = { id: 101, name: "A" };
const toadB = { id: 102, name: "B" };
const withToads = makeShop([], EPOCH + 5);

withToads.availableToads = [toadA, toadB];
writeShop(withToads);
check("первая покупка жабы", shop.claimShopToad(101), true);
check(
  "купленная жаба убрана",
  readShop().availableToads.map((toad) => toad.id).join(","),
  "102"
);
check("повторная покупка отклонена", shop.claimShopToad(101), false);
check("вторая жаба осталась", readShop().availableToads.length, 1);
check("неизвестная жаба отклонена", shop.claimShopToad(999), false);

// 10. Журнал сдач уезжает в облачную витрину и поднимается на новом устройстве.
shop.clearShopState();
const cloudEpoch = EPOCH + 6;

shop.saveShopState(makeShop(["order-a"], cloudEpoch));
check("облако: заказ выдан", shop.claimEliteOrder("order-a"), true);

const cloudShop = JSON.parse(store.get(SHOP_KEY));

check(
  "журнал лёг в облачную витрину",
  cloudShop.eliteClaims?.[String(cloudEpoch)]?.includes("order-a"),
  true
);

// Локальный сейв новее облачного: витрина остаётся локальной, но сдачи из
// облака поднимаются в журнал до сравнения `lastSaved`.
store.delete(CLAIMS_KEY);
writeShop({ ...makeShop(["order-a"], cloudEpoch) });
shop.mergeCloudEliteClaims(cloudShop.eliteClaims);
check(
  "локальная витрина не платит за облачную сдачу",
  shop.claimEliteOrder("order-a"),
  false
);
check("локальная витрина вычистила заказ", readShop().eliteOrders.length, 0);

// Новое устройство: локального журнала нет, витрина пришла из облака и всё ещё
// содержит заказ (устаревшая копия). Повторной оплаты быть не должно.
store.delete(CLAIMS_KEY);
shop.saveShopState({ ...cloudShop, eliteOrders: ["order-a"] });
check(
  "новое устройство не платит повторно",
  shop.claimEliteOrder("order-a"),
  false
);
check("новое устройство вычистило заказ", readShop().eliteOrders.length, 0);

if (failures.length) {
  console.error(`\n❌ Провалено проверок: ${failures.length}`);
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("\n✅ Все проверки элитных заказов пройдены");
