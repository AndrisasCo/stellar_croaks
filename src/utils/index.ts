export function shuffle<T>(array: T[]): T[] {
  // Создаем копию массива, чтобы не мутировать исходный
  const shuffled: T[] = [...array];

  // Идем с конца массива к началу
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Генерируем случайный индекс от 0 до i
    const j = Math.floor(Math.random() * (i + 1));

    // Меняем местами элементы i и j
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
