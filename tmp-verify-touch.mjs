/**
 * Проверка стражей тач-жестов на РЕАЛЬНОМ коде проекта (без браузера).
 *
 * Модуль бандлится через esbuild и прогоняется как обычный JS, а вместо документа
 * подставляется заглушка со списком слушателей. Проверяем то, из-за чего на iPhone
 * «сворачивалась» игра:
 *   1) стражи вешаются на жесты страницы Safari (gesturestart/gesturechange/gestureend),
 *      мультитач-touchmove и dblclick — и подписаны активными (passive: false), иначе
 *      preventDefault не сработал бы;
 *   2) щипок (два пальца) и жест Safari гасятся, двойной тап не зумит страницу;
 *   3) однопальцевый touchmove не гасится — списки в модалках продолжают скроллиться,
 *      а тач-жесты карты не задеваются (touchstart/touchend не перехватываются);
 *   4) снятие стражей отписывает от всего — приложение не копит слушатели.
 *
 * Запуск: node tmp-verify-touch.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-touch-"));
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

const { installTouchGuards, SAFARI_PAGE_GESTURES } = bundle(
  "src/utils/touch-guards.ts",
  "touch-guards",
);

/** Заглушка документа: запоминает, на что и с какими опциями подписались */
const makeDoc = () => {
  const listeners = new Map();
  const log = [];

  return {
    doc: {
      addEventListener: (type, handler, options) => {
        log.push(["add", type, options]);
        listeners.set(type, { handler, options });
      },
      removeEventListener: (type, handler) => {
        log.push(["remove", type]);
        if (listeners.get(type)?.handler === handler) {
          listeners.delete(type);
        }
      },
      listeners,
      log,
    },
  };
};

/** Событие-заглушка: помнит, погасили ли его */
const makeEvent = (touches) => ({
  touches: touches?.map(() => ({})),
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
});

const fire = (doc, type, event) => {
  const listener = doc.listeners.get(type);

  if (!listener) {
    failures.push(`нет слушателя ${type}`);
    return event;
  }

  listener.handler(event);
  return event;
};

const { doc } = makeDoc();
check("Safari-жестов три", SAFARI_PAGE_GESTURES.length, 3);

const uninstall = installTouchGuards(doc);

// 1. Подписки: жесты страницы Safari + мультитач + двойной тап, все активные
SAFARI_PAGE_GESTURES.forEach((type) =>
  check(`${type} перехвачен`, doc.listeners.has(type), true),
);
check(
  "мультитач-скролл страницы перехвачен",
  doc.listeners.has("touchmove"),
  true,
);
check("двойной тап перехвачен", doc.listeners.has("dblclick"), true);
check(
  "touchmove подписан как активный (иначе preventDefault запрещён)",
  doc.listeners.get("touchmove").options.passive,
  false,
);
check(
  "gesturestart подписан как активный",
  doc.listeners.get("gesturestart").options.passive,
  false,
);

// 2. Что именно гасим
const pinch = fire(doc, "touchmove", makeEvent([0, 1]));
check("щипок двумя пальцами не зумит страницу", pinch.defaultPrevented, true);
const safariGesture = fire(doc, "gesturestart", makeEvent([]));
check("жест страницы Safari не зумит страницу", safariGesture.defaultPrevented, true);
const doubleTap = fire(doc, "dblclick", makeEvent([]));
check(
  "двойной тап не приближает страницу (его ждёт карта)",
  doubleTap.defaultPrevented,
  true,
);

// 3. Что НЕ трогаем: скролл одним пальцем и тач-жесты карты
const scroll = fire(doc, "touchmove", makeEvent([0]));
check("скролл списков одним пальцем работает", scroll.defaultPrevented, false);
check(
  "touchstart/touchend не перехватываются (карта берёт жабу сама)",
  doc.listeners.has("touchstart") || doc.listeners.has("touchend"),
  false,
);

// 4. Снятие стражей
uninstall();
check("после снятия слушателей не осталось", doc.listeners.size, 0);
check(
  "снятие шло через removeEventListener",
  doc.log.some(([action]) => action === "remove"),
  true,
);

console.log(
  failures.length === 0
    ? `\n✅ Тач-стражи: ${"все проверки пройдены"}`
    : `\n❌ Тач-стражи: провалов ${failures.length}\n${failures.join("\n")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
