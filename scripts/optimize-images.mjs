/**
 * Оптимизация арта: фоны комнат → webp и иконки PWA из имеющейся картинки.
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
 *   2. Готовит иконки PWA (192/512 + maskable) из public/apple-touch-icon.png.
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

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/** Новый арт кладут в public/bg/rooms, старый — в public/bg. */
const findSource = (name) => {
  const inRooms = join(ROOMS_DIR, `${name}.png`);

  if (existsSync(inRooms)) {
    return inRooms;
  }

  const inBg = join(BG_DIR, `${name}.png`);

  return existsSync(inBg) ? inBg : null;
};

/** Собрать один webp и перевезти оригинал из public в design-src. */
const convertRoomBackground = async (name) => {
  const source = findSource(name);

  if (!source) {
    console.log(`⚠️  ${name}.png не найден — оставляю прежний webp`);
    return null;
  }

  const target = join(ROOMS_DIR, `${name}.webp`);
  const before = (await stat(source)).size;

  await sharp(source)
    // Фон лежит под цветом гекса, поэтому важнее вес: 82 — предел, где арт ещё чистый.
    .webp({ quality: 82, effort: 6 })
    .toFile(target);

  const after = (await stat(target)).size;

  // rename поверх существующего файла работает на POSIX, но не везде — чистим явно.
  const original = join(SOURCE_DIR, `${name}.png`);
  await rm(original, { force: true });
  await rename(source, original);

  console.log(
    `🖼  bg/rooms/${name}.webp: ${kb(before)} → ${kb(after)} ` +
      `(−${(100 - (after / before) * 100).toFixed(0)}%)`
  );

  return { before, after };
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

  console.log("\nИконки PWA:");
  await buildIcons();

  // Оригиналы иконок и фонов — в репозитории, но вне public: их не тянет браузер.
  console.log(
    `\nОригиналы PNG перенесены в ${dirname(join(SOURCE_DIR, "x"))} (вне public/)`
  );
};

main().catch((error) => {
  console.error("❌ Не удалось оптимизировать арт:", error);
  process.exit(1);
});
