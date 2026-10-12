// src/hooks/use-telegram.js
import { useEffect, useState } from "react";
import { detectPlatformName, getPlatform, type PlatformName } from "../platform";

/**
 * Приветствие платформы к первому кадру игры.
 *
 * Раньше здесь вручную дёргались методы Telegram (`expand`, `ready`,
 * `enableClosingConfirmation`, `disableVerticalSwipes`), а состояние `isLoading`
 * сбрасывалось безусловно — то есть в вебе игра всё равно ждала появления клиента.
 * Теперь все «здравствуй» собраны в `platform.init()` (в вебе это no-op), и игра не
 * ждёт платформу, чтобы показаться: выбор реализации ленивый — см. src/platform.
 *
 * Ждать приходится только одного: скрипт `telegram-web-app.js` подключается
 * асинхронно, поэтому появление Telegram добираем коротким опросом и один раз
 * здороваемся с клиентом (иначе мини-апп остался бы неразвёрнутым и не готовым).
 */
export const useTelegram = () => {
  const [platformName, setPlatformName] = useState<PlatformName>(detectPlatformName);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPlatform().init();
    setIsLoading(false);

    const timer = window.setInterval(() => {
      if (detectPlatformName() !== "telegram") {
        return;
      }

      getPlatform().init();
      setPlatformName("telegram");
      window.clearInterval(timer);
    }, 500);

    // Больше 10 секунд ждать нет смысла: если Telegram не появился, игра идёт в вебе.
    const stopWaiting = window.setTimeout(
      () => window.clearInterval(timer),
      10_000
    );

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stopWaiting);
    };
  }, []);

  return { isLoading, platformName };
};

