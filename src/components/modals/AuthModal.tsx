import React, { useState } from "react";
import Modal from "../shared/Header";
import ModalTabs from "../shared/ModalTabs";
import { ClickButton } from "../shared/ClickButton";
import { useModal } from "../ModalContext";
import { useNotifications } from "../../hooks/use-notification";
import { useAuth } from "../../hooks/use-auth";
import {
  signInWithEmail,
  signOutAccount,
  signUpWithEmail,
} from "../../backend/auth";

/**
 * АККАУНТ ИГРОКА В БРАУЗЕРЕ.
 *
 * До этой модалки веб-версия довольствовалась анонимной сессией Supabase: прогресс
 * синкался, но привязать его к себе было нельзя — очистил браузер и потерял колонию.
 * Здесь самый простой вход, который понимает любой игрок: почта + пароль.
 *
 * Проверять почту на клиенте нечем, поэтому вся валидация — «непустая почта и
 * пароль не короче 6 символов» (столько же требует минимум у Supabase), а ответ
 * сервера показываем как есть: `AuthResult.message`.
 */
type AuthMode = "login" | "register";

const TABS = [
  { id: "login" as AuthMode, label: "Вход", color: "text-green-400" },
  { id: "register" as AuthMode, label: "Регистрация", color: "text-purple-400" },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-gray-600/50 bg-color-second px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors focus:border-green-400";

const AuthIcon = (
  <svg
    className="h-6 w-6 text-green-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

export const AuthModal: React.FC = () => {
  const { closeModal } = useModal();
  const { addNotification } = useNotifications();
  const account = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Постоянный аккаунт (не анонимная сессия) — форма входа уже не нужна. */
  const signedIn = Boolean(account && !account.isAnonymous);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    const cleanEmail = email.trim();

    if (!cleanEmail || password.length < 6) {
      setError("Введите почту и пароль не короче 6 символов");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const result =
      mode === "register"
        ? await signUpWithEmail(cleanEmail, password)
        : await signInWithEmail(cleanEmail, password);

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMessage(result.message);
    addNotification({ type: "success", content: result.message });

    // Сессия уже в хранилище: перезапускаем игру, чтобы она вошла под новым
    // аккаунтом и подтянула его сейв из облака (`backend/db.ts`).
    if (result.signedIn) {
      window.setTimeout(() => window.location.reload(), 600);
    }
  };

  const handleSignOut = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    const result = await signOutAccount();

    // При успехе страница уже перезагружается: игра стартует с чистой сессией.
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
    }
  };

  return (
    <Modal icon={AuthIcon} title="Аккаунт">
      {signedIn ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-gray-600/50 bg-color-main px-4 py-3">
            <div className="text-2xs text-gray-300">Вы вошли как</div>
            <div className="truncate text-sm font-semibold text-white">
              {account?.email ?? account?.username ?? "игрок"}
            </div>
            {account?.tgId && (
              <div className="mt-1 text-2xs text-gray-400">
                Telegram ID: {account.tgId}
              </div>
            )}
          </div>

          <p className="text-2xs leading-tight text-gray-300">
            Прогресс хранится в облаке: войдите с этой почтой на другом устройстве —
            и колония вернётся к вам.
          </p>

          <ClickButton
            onClick={handleSignOut}
            disabled={busy}
            className="w-full rounded-xl border-2 border-red-400/30 bg-gradient-to-r from-red-600 to-orange-600 py-3 font-bold text-white shadow-lg transition-all duration-300 hover:from-red-500 hover:to-orange-500 disabled:opacity-60"
          >
            {busy ? "Выходим..." : "Выйти"}
          </ClickButton>
        </div>
      ) : (
        <>
          <ModalTabs
            tabs={TABS}
            active={mode}
            onChange={(id) => {
              setMode(id);
              setError(null);
              setMessage(null);
            }}
          />

          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <p className="text-2xs leading-tight text-gray-300">
              {mode === "register"
                ? "Почта и пароль — и колония больше не потеряется вместе с браузером."
                : "Войдите, чтобы вернуться к своей колонии на любом устройстве."}
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-200">Почта</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                className={INPUT_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-200">Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="не короче 6 символов"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                className={INPUT_CLASS}
              />
            </label>

            {error && (
              <p className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-2xs text-rose-100">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-2xs text-emerald-100">
                {message}
              </p>
            )}

            <ClickButton
              type="submit"
              disabled={busy}
              className="w-full rounded-xl border-2 border-emerald-400/30 bg-gradient-to-r from-green-600 to-teal-600 py-3 font-bold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-teal-500 disabled:opacity-60"
            >
              {busy
                ? "Подождите..."
                : mode === "register"
                  ? "Создать аккаунт"
                  : "Войти"}
            </ClickButton>

            <ClickButton
              type="button"
              onClick={closeModal}
              className="w-full rounded-xl bg-color-second py-3 text-gray-200 transition-colors duration-300 hover:bg-slate-800/70"
            >
              Продолжить без аккаунта
            </ClickButton>
          </form>
        </>
      )}
    </Modal>
  );
};

export default AuthModal;

