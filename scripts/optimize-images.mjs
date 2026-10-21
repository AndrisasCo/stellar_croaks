/**
 * Оптимизация арта: фоны комнат и иллюстрации секторов → webp, иконки PWA из
 * имеющейся картинки.
 *
 * Зачем скрипт, а не разовая команда: тяжёлый арт будет появляться и дальше, а
 * проверить «что именно едет в бандл» нужно повторяемо. Запуск:
 *
 *   node scripts/optimize-images.mjs
 *
 * Что делает:
 *   1. Пересобирает в webp ТОЛЬКО те PNG фонов комнат, которые реально грузятся
 *      игрой (список совпадает с src/components/HexMap/room-backgrounds.ts).
 *      Исходники ищутся сначала в public/bg/rooms (куда кладут новый арт), затем
 *      в public/bg (старое место). Готовый webp перезаписывает прежний, а PNG
 *      переезжает в design-src/bg/ — вне public/, чтобы не попадать в dist.
 *   2. Пересобирает в webp иллюстрации секторов КОНТУРа из public/bg/sectors
 *      (или старого public/bg). Они лежат отдельно от фонов комнат: у секторов
 *      своя карусель и свой список `SECTOR_ART`.
 *   3. Готовит иконки PWA (192/512 + maskable) из public/apple-touch-icon.png.
 *
 * Почему новые файлы кладутся в /bg/rooms: в public/bg уже есть incubator.webp и
 * vivarium.webp другого назначения (фоны модалок) — перезапись сломала бы их.
 */
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const BG_DIR = join(ROOT, "public/bg");
const ROOMS_DIR = join(BG_DIR, "rooms");
const SECTORS_DIR = join(BG_DIR, "sectors");
const SOURCE_DIR = join(ROOT, "design-src/bg");
const ICONS_DIR = join(ROOT, "public/icons");

/** Фоны комнат, которые действительно грузятся (см. room-backgrounds.ts). */
const ROOM_BACKGROUNDS = [
  "vivarium",
  "core",
  "nest",
  "market",
  "storage",
  "collider",
  "dissosiator",
  "power",
  "incubator",
  "scout",
  "med",
];

/** Иллюстрации секторов КОНТУРа: имена PNG в public/bg/sectors (или public/bg). */
const SECTOR_ART = [
  "contur1",
  "contur2",
  "contur3",
  "contur4",
  "contur5",
  "contur6",
  "contur7",
  "contur8",
];

/**
 * Ширина готовой иллюстрации сектора. Исходники бывают 4096 px, но в карточке
 * картинка занимает 128–160 px по высоте — 1200 px хватает с запасом на retina.
 */
const SECTOR_ART_WIDTH = 1200;

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/** Новый арт кладут в свою папку, старый — в public/bg. */
const findSource = (dir, name) => {
  const inDir = join(dir, `${name}.png`);

  if (existsSync(inDir)) {
    return inDir;
  }

  const inBg = join(BG_DIR, `${name}.png`);

  return existsSync(inBg) ? inBg : null;
};

/**
 * Собрать один webp и перевезти оригинал из public в design-src.
 * Общая часть для фонов комнат и иллюстраций секторов.
 */
const convertArt = async ({
  source,
  target,
  original,
  label,
  resizeWidth,
}) => {
  const before = (await stat(source)).size;

  let pipeline = sharp(source);

  if (resizeWidth) {
    // Сохраняем пропорции; если исходник уже меньше, не растягиваем.
    pipeline = pipeline.resize({
      width: resizeWidth,
      withoutEnlargement: true,
    });
  }

  await pipeline
    // Арт лежит под интерфейсом, поэтому важнее вес: 82 — предел, где он ещё чистый.
    .webp({ quality: 82, effort: 6 })
    .toFile(target);

  const after = (await stat(target)).size;

  // rename поверх существующего файла работает на POSIX, но не везде — чистим явно.
  await rm(original, { force: true });
  await rename(source, original);

  console.log(
    `🖼  ${label}: ${kb(before)} → ${kb(after)} ` +
      `(−${(100 - (after / before) * 100).toFixed(0)}%)`
  );

  return { before, after };
};

/** Собрать webp фона комнаты. */
const convertRoomBackground = async (name) => {
  const source = findSource(ROOMS_DIR, name);

  if (!source) {
    console.log(`⚠️  ${name}.png не найден — оставляю прежний webp`);
    return null;
  }

  return convertArt({
    source,
    target: join(ROOMS_DIR, `${name}.webp`),
    original: join(SOURCE_DIR, `${name}.png`),
    label: `bg/rooms/${name}.webp`,
  });
};

/** Собрать webp иллюстрации сектора КОНТУРа. */
const convertSectorArt = async (name) => {
  const source = findSource(SECTORS_DIR, name);

  if (!source) {
    console.log(`⚠️  ${name}.png не найден — оставляю прежний webp`);
    return null;
  }

  return convertArt({
    source,
    target: join(SECTORS_DIR, `${name}.webp`),
    original: join(SOURCE_DIR, `${name}.png`),
    label: `bg/sectors/${name}.webp`,
    resizeWidth: SECTOR_ART_WIDTH,
  });
};

/** Иконки PWA: обычные 192/512 и одна maskable (с отступом под обрезку). */
const buildIcons = async () => {
  const source = join(ROOT, "public/apple-touch-icon.png");

  if (!existsSync(source)) {
    console.log("⚠️  public/apple-touch-icon.png не найден — иконки PWA не собраны");
    return;
  }

  const sizes = [192, 512];

  for (const size of sizes) {
    await sharp(source)
      // Арт не квадратный (888×907) — центр кадрируем, а не растягиваем.
      .resize(size, size, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toFile(join(ICONS_DIR, `icon-${size}.png`));
    console.log(`📱 icons/icon-${size}.png`);
  }

  const maskable = 512;
  const inner = Math.round(maskable * 0.8); // safe zone Android: 80% кадра

  await sharp(source)
    .resize(inner, inner, { fit: "cover", position: "centre" })
    .extend({
      top: Math.round((maskable - inner) / 2),
      bottom: maskable - inner - Math.round((maskable - inner) / 2),
      left: Math.round((maskable - inner) / 2),
      right: maskable - inner - Math.round((maskable - inner) / 2),
      background: "#070c14",
    })
    .png({ compressionLevel: 9 })
    .toFile(join(ICONS_DIR, "icon-maskable-512.png"));
  console.log(`📱 icons/icon-maskable-512.png (поле #070c14)`);
};

const main = async () => {
  await mkdir(ROOMS_DIR, { recursive: true });
  await mkdir(SECTORS_DIR, { recursive: true });
  await mkdir(SOURCE_DIR, { recursive: true });
  await mkdir(ICONS_DIR, { recursive: true });

  let before = 0;
  let after = 0;

  console.log("Фоны комнат:");
  for (const name of ROOM_BACKGROUNDS) {
    const result = await convertRoomBackground(name);

    if (result) {
      before += result.before;
      after += result.after;
    }
  }

  console.log(
    `\nИтого фоны комнат: ${kb(before)} → ${kb(after)} ` +
      `(сэкономлено ${kb(before - after)})`
  );

  let sectorBefore = 0;
  let sectorAfter = 0;

  console.log("\nИллюстрации секторов:");
  for (const name of SECTOR_ART) {
    const result = await convertSectorArt(name);

    if (result) {
      sectorBefore += result.before;
      sectorAfter += result.after;
    }
  }

  console.log(
    `\nИтого иллюстрации секторов: ${kb(sectorBefore)} → ${kb(sectorAfter)} ` +
      `(сэкономлено ${kb(sectorBefore - sectorAfter)})`
  );

  console.log("\nИконки PWA:");
  await buildIcons();

  // Оригиналы иконок и арта — в репозитории, но вне public: их не тянет браузер.
  console.log(
    `\nОригиналы PNG перенесены в ${dirname(join(SOURCE_DIR, "x"))} (вне public/)`
  );
};

main().catch((error) => {
  console.error("❌ Не удалось оптимизировать арт:", error);
  process.exit(1);
});
