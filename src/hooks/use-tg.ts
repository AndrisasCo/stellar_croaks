// src/hooks/use-telegram.js
import { useEffect, useState } from "react";

export const useTelegram = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initTelegram = () => {
      if (window.Telegram?.WebApp) {
        const telegramApp = window.Telegram.WebApp;

        // Инициализация
        telegramApp.expand();
        telegramApp.enableClosingConfirmation();
        telegramApp.ready();
        telegramApp.disableVerticalSwipes();
      } else {
        console.log("❌ Telegram Web App не найден");
      }
      setIsLoading(false);
    };

    // Пробуем инициализировать сразу
    initTelegram();

    // Если не нашли, проверяем периодически
    let attempts = 0;
    const maxAttempts = 10;

    const checkTelegram = setInterval(() => {
      attempts++;
      if (window.Telegram?.WebApp) {
        initTelegram();
        clearInterval(checkTelegram);
      } else if (attempts >= maxAttempts) {
        console.log(
          `❌ Telegram Web App не найден после ${maxAttempts} попыток`
        );
        setIsLoading(false);
        clearInterval(checkTelegram);
      }
    }, 500);

    return () => clearInterval(checkTelegram);
  }, []);

  return { isLoading };
};
