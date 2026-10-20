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
  { id: "login" as AuthMode, label: "Вход" },
  { id: "register" as AuthMode, label: "Регистрация" },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

const AuthIcon = (
  <svg
    className="h-6 w-6 text-cyan-300"
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
          <div className="ui-panel p-4">
            <div className="text-xs text-slate-300">Вы вошли как</div>
            <div className="truncate text-sm font-semibold text-white">
              {account?.email ?? account?.username ?? "игрок"}
            </div>
            {account?.tgId && (
              <div className="mt-1 text-xs text-slate-400">
                Telegram ID: {account.tgId}
              </div>
            )}
          </div>

          <p className="text-xs leading-relaxed text-slate-300">
            Прогресс хранится в облаке: войдите с этой почтой на другом устройстве —
            и колония вернётся к вам.
          </p>

          <ClickButton
            onClick={handleSignOut}
            disabled={busy}
            className="ui-button-danger w-full py-3"
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-slate-300">
              {mode === "register"
                ? "Почта и пароль — и колония больше не потеряется вместе с браузером."
                : "Войдите, чтобы вернуться к своей колонии на любом устройстве."}
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-200">Почта</span>
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
              <span className="text-xs font-semibold text-slate-200">Пароль</span>
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
              <p className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">
                {message}
              </p>
            )}

            <ClickButton
              type="submit"
              disabled={busy}
              className="ui-button-primary w-full py-3"
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
              className="ui-button-secondary w-full py-3"
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

