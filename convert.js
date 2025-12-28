import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Получаем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertImages() {
  const inputDir = "./public/assets-old"; // ваша папка с PNG
  const outputDir = "./public/assets";

  // Создаем выходную папку если её нет
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Читаем все файлы
  const files = fs.readdirSync(inputDir);
  const pngFiles = files.filter(
    (file) =>
      file.toLowerCase().endsWith(".png") ||
      file.toLowerCase().endsWith(".jpg") ||
      file.toLowerCase().endsWith(".webp")
  );

  console.log(`Найдено ${pngFiles.length} изображений`);

  // Обрабатываем каждый файл
  for (const file of pngFiles) {
    const inputPath = path.join(inputDir, file);
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const outputPath = path.join(outputDir, `${baseName}.webp`);

    try {
      // Оптимальные настройки для WebP
      await sharp(inputPath)
        .webp({
          quality: 85, // качество 85% обычно оптимально
          lossless: false, // lossy сжатие (меньше размер)
          effort: 6, // уровень оптимизации (0-6, 6 самый медленный но лучший)
          alphaQuality: 85, // качество альфа-канала если есть
          nearLossless: true, // почти без потерь для лучшего качества
          smartSubsample: true, // умная субдискретизация
        })
        // Опционально: ограничение размера (раскомментировать если нужно)
        .resize({
          width: 300,
          height: 300,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFile(outputPath);

      // Получаем размеры файлов
      const originalStats = fs.statSync(inputPath);
      const newStats = fs.statSync(outputPath);
      const reduction = (
        ((originalStats.size - newStats.size) / originalStats.size) *
        100
      ).toFixed(1);

      console.log(
        `✓ ${file} → ${baseName}.webp (${formatSize(
          originalStats.size
        )} → ${formatSize(newStats.size)}, -${reduction}%)`
      );
    } catch (error) {
      console.error(`✗ Ошибка при обработке ${file}:`, error.message);
    }
  }

  console.log("✅ Конвертация завершена!");
}

// Функция для форматирования размера
function formatSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Запускаем конвертацию
convertImages().catch(console.error);
