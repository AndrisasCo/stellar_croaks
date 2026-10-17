import { useEffect, useState } from "react";
import {
  ensureAccount,
  getAccount,
  subscribeAccount,
  type Account,
} from "../backend/auth";

/**
 * Аккаунт облачной сессии для интерфейса: почта (веб-вход), Telegram или анонимная
 * сессия. Пока вход ещё идёт, значение `null`.
 *
 * Хук без состояния игры: он не читает сейв, а просто следует за сессией Supabase —
 * поэтому подходит и модалке «Аккаунт», и любому будущему индикатору в HUD.
 */
export const useAuth = (): Account | null => {
  const [account, setAccount] = useState<Account | null>(getAccount);

  useEffect(() => {
    const unsubscribe = subscribeAccount(setAccount);

    // Вход мог ещё не завершиться к моменту открытия модалки: ждём тот же
    // единственный промис входа (см. `ensureAccount`), а не создаём новый.
    ensureAccount()
      .then((current) => {
        if (current) {
          setAccount(current);
        }
      })
      .catch(() => {
        // Облако недоступно — интерфейс просто остаётся без аккаунта.
      });

    return unsubscribe;
  }, []);

  return account;
};
