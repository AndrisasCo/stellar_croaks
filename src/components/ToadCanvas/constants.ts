// Константы для анимации
export const TOAD_FRAMES_COUNT = 4; // Количество кадров анимации жабы
export const TOADPOLE_FRAMES_COUNT = 4; // Количество кадров анимации головастика
export const ANIMATION_SPEED = 0.06; // Базовая скорость анимации

export function makeColorWhiter(hexColor, percent) {
  // Убедимся, что процент от 0 до 100
  percent = Math.min(100, Math.max(0, percent)) / 100;

  // Преобразуем hex в RGB
  let r = parseInt(hexColor.substring(1, 3), 16);
  let g = parseInt(hexColor.substring(3, 5), 16);
  let b = parseInt(hexColor.substring(5, 7), 16);

  // Смешиваем с белым (255, 255, 255)
  // Формула: исходный * (1 - percent) + белый * percent
  r = Math.round(r * (1 - percent) + 255 * percent);
  g = Math.round(g * (1 - percent) + 255 * percent);
  b = Math.round(b * (1 - percent) + 255 * percent);

  // Обратно в hex
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
