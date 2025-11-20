// src/hooks/use-telegram.js
import { useEffect, useState } from "react";

export const useTelegram = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initTelegram = () => {
      console.log("🟡 Инициализация Telegram Web App...");
      console.log("window.Telegram:", window.Telegram);
      console.log("window.Telegram?.WebApp:", window.Telegram?.WebApp);

      if (window.Telegram?.WebApp) {
        const telegramApp = window.Telegram.WebApp;
        console.log("✅ Telegram Web App найден!");

        // Инициализация
        telegramApp.expand();
        telegramApp.enableClosingConfirmation();
        telegramApp.ready();
        telegramApp.disableVerticalSwipes();

        console.log("👤 Пользователь:", telegramApp.initDataUnsafe?.user);
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
        console.log(`✅ Telegram Web App обнаружен на ${attempts} попытке`);
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
