import { useEffect, useState } from "react";

/**
 * Живое «сейчас» для таймеров интерфейса.
 *
 * Тики игры приходят редко (болезни — раз в час), а прогресс и отсчёт в модалке
 * должны двигаться на глазах. Хук перерисовывает компонент по интервалу; саму дату
 * он не хранит в сохранении и ничего не меняет — только читает часы.
 */
export const useNow = (intervalMs = 30_000): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
};
