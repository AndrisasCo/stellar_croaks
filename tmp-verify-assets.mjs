/**
 * Проверка АССЕТОВ: картинки, на которые ссылается код, реально лежат в `public`.
 *
 * Скрипт появился после конкретной грабли: жабы на карте превратились в цветные
 * прямоугольники. Причина — `preloadTextures` грузил в одном `Promise.all` и спрайты жаб,
 * и ассеты удалённой сцены вольера (`/bg/bg.webp`, `/bg/fence.webp`); файлов уже не было,
 * загрузка падала целиком, и жабу рисовал фолбэк `Texture.WHITE` под тинтом
 * (см. `HexMap/room-toads.ts`). Поэтому проверяем:
 *   1) каждый статичный путь-картинка из `src/**` существует в `public/`;
 *   2) у каждого типа жабы есть `/sprites/<тип>.webp`, а у раскрашиваемых
 *      (hybrid/camouflage) — ещё и цветной `/bg/<тип>.webp`;
 *   3) шаблонные пути (`/sprites/${type}.webp`) известны скрипту: если в коде появится новый
 *      способ собирать путь, проверка упадёт и не пропустит битый ассет молча;
 *   4) на РЕАЛЬНОМ `preloadTextures` (модуль бандлится esbuild'ом, pixi подменяется
 *      заглушкой) один битый спрайт не уносит остальные, имя файла уходит в консоль,
 *      а тип без спрайта получает фолбэк на hybrid.
 *
 * Запуск: node tmp-verify-assets.mjs
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const outDir = mkdtempSync(join(tmpdir(), "croak-assets-"));
const root = process.cwd();

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;

  if (!ok) {
    failures.push(`${label}: получили ${actual}, ждали ${expected}`);
  }
  console.log(`${ok ? "✅" : "❌"} ${label}: ${actual}`);
};
const checkTrue = (label, value) => check(label, Boolean(value), true);

/** Все исходники проекта: путь ассета ищем и в `.ts`, и в `.tsx`. */
const sourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const IMAGE_EXT = "webp|png|svg|jpg|jpeg|gif";
/** Путь ассета статичной строкой: `"/sprites/fire.webp"` */
const STATIC_ASSET = new RegExp(`"(/(?:[^"\\n]*)\\.(?:${IMAGE_EXT}))"`, "g");
/** Путь ассета собран шаблоном: `` `/sprites/${type}.webp` `` */
const DYNAMIC_ASSET = new RegExp(`\`(/(?:[^\`\\n]*)\\.(?:${IMAGE_EXT}))\``, "g");

/** Собрать совпадения одного шаблона в строке исходника */
const matchPaths = (source, pattern) =>
  [...source.matchAll(pattern)].map((match) => match[1]);

/** Файл, в котором встретился путь — чтобы провал проверки сразу вёл к коду */
const staticPaths = new Map();
const dynamicPaths = new Set();

sourceFiles(join(root, "src")).forEach((file) => {
  const source = readFileSync(file, "utf8");
  const where = file.replace(`${root}/`, "");

  matchPaths(source, STATIC_ASSET).forEach((path) => {
    if (!staticPaths.has(path)) {
      staticPaths.set(path, where);
    }
  });
  matchPaths(source, DYNAMIC_ASSET).forEach((path) => dynamicPaths.add(path));
});

console.log("\n── 1. Статичные пути: файл есть в public ──────────────────");
staticPaths.forEach((where, path) => {
  checkTrue(`${path} (${where})`, existsSync(join(root, "public", path)));
});

/** Типы жаб: имя файла спрайта = значение `ToadTypes` */
const speciesFile = join(root, "src/models/Toad/toad-species.ts");
const speciesSource = readFileSync(speciesFile, "utf8");
const enumStart = speciesSource.indexOf("export enum ToadTypes");
const enumBody = speciesSource.slice(
  enumStart,
  speciesSource.indexOf("}", enumStart),
);
const toadTypes = [...enumBody.matchAll(/=\s*"([^"]+)"/g)].map(
  (match) => match[1],
);

console.log("\n── 2. Спрайты жаб: лист на каждый тип ─────────────────────");
checkTrue("типы жаб прочитаны из ToadTypes", toadTypes.length > 0);
toadTypes.forEach((type) => {
  checkTrue(
    `/sprites/${type}.webp`,
    existsSync(join(root, "public", "sprites", `${type}.webp`)),
  );
});

/** Раскрашиваемые жабы (`ToadAvatar`, `ToadInfoModal/Colors`): у них картинка из `/bg` */
["hybrid", "camouflage"].forEach((type) => {
  checkTrue(
    `/bg/${type}.webp (цветная жаба)`,
    existsSync(join(root, "public", "bg", `${type}.webp`)),
  );
});

console.log("\n── 3. Шаблонные пути: известны скрипту ────────────────────");
/** Способы собрать путь ассета, которые покрыты проверками выше */
const KNOWN_DYNAMIC = [
  /^\/sprites\/\$\{[^}]+\}\.webp$/,
  /^\/bg\/\$\{[^}]+\}\.webp$/,
];

dynamicPaths.forEach((path) => {
  checkTrue(
    `шаблон ${path} покрыт проверкой`,
    KNOWN_DYNAMIC.some((pattern) => pattern.test(path)),
  );
});

/** Заглушка pixi: `preloadTextures` проверяем на реальном модуле, без WebGL */
const PIXI_STUB = [
  "export class Texture {",
  "  constructor(props = {}) {",
  "    this.frame = props.frame ?? { x: 0, y: 0, width: 1, height: 1 };",
  "    this.width = this.frame.width;",
  "    this.height = this.frame.height;",
  "  }",
  "}",
  "Texture.WHITE = new Texture();",
  "Texture.EMPTY = new Texture();",
  "",
  "export const Assets = {",
  "  async load(url) {",
  "    if ((globalThis.__failingAssets ?? new Set()).has(url)) {",
  '      throw new Error("404: " + url);',
  "    }",
  "",
  "    return { width: 300, height: 300, source: { width: 300, height: 300 } };",
  "  },",
  "};",
  "",
].join("\n");

console.log("\n── 4. Один битый спрайт не уносит остальные ───────────────");
const stubPath = join(outDir, "pixi-stub.mjs");
writeFileSync(stubPath, PIXI_STUB);

const bundlePath = join(outDir, "toad-textures.cjs");
execFileSync(
  "npx",
  [
    "esbuild",
    "src/components/ToadCanvas/utils.ts",
    "--bundle",
    "--format=cjs",
    "--platform=node",
    "--log-level=error",
    `--alias:pixi.js=${stubPath}`,
    `--outfile=${bundlePath}`,
  ],
  { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
);

// Заглушки браузера: модуль тянет модели игры, которым нужен localStorage/window
globalThis.window ||= { Telegram: { WebApp: { initDataUnsafe: {} } } };
globalThis.localStorage ||= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
globalThis.window.localStorage = globalThis.localStorage;

const toadTextures = require(bundlePath);

check(
  "путь к спрайту собирается из типа жабы",
  toadTextures.toadSpriteUrl("money"),
  "/sprites/money.webp",
);

globalThis.__failingAssets = new Set();
const allSheets = await toadTextures.preloadTextures();
check(
  "листов приехало: головастик + каждый тип",
  Object.keys(allSheets).length,
  toadTypes.length + 1,
);
check("кадров в листе взрослой жабы", allSheets.hybrid.length, 7);
checkTrue("лист головастика отдельный", Array.isArray(allSheets.toadpoleTextures));

globalThis.__failingAssets = new Set(["/sprites/fire.webp"]);

const warned = [];
const originalWarn = console.warn;
console.warn = (...args) => warned.push(args.join(" "));

const partialSheets = await toadTextures.preloadTextures();

console.warn = originalWarn;

check("битый спрайт в набор не попал", partialSheets.fire, undefined);
check(
  "остальные типы всё равно приехали",
  Object.keys(partialSheets).length,
  toadTypes.length,
);
checkTrue(
  "имя битого файла попало в консоль",
  warned.some((line) => line.includes("/sprites/fire.webp")),
);
check(
  "тип без спрайта падает на hybrid",
  toadTextures.getTextureByType({ current: partialSheets }, "fire").length,
  partialSheets.hybrid.length,
);

console.log(
  failures.length === 0
    ? "\n✅ Ассеты: все проверки пройдены"
    : `\n❌ Ассеты: провалов ${failures.length}\n${failures.join("\n")}`,
);
process.exit(failures.length === 0 ? 0 : 1);

