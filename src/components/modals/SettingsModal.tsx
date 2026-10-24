import React, { useEffect, useState } from "react";
import { useSettings } from "../SettingsContext";
import Modal from "../shared/Header";
import {
  getDefaultGameState,
  updateGameState,
} from "../../backend/localStorage";
import {
  PLAYER_NAME_MAX_LENGTH,
  savePlayerName,
  updateGameStateDB,
} from "../../backend/db";
import { useModal } from "../ModalContext";
import { useGameState } from "../../hooks/use-game-state";
import { restartNarrator } from "../../utils/narrator";
import { mutate } from "swr";

/** Поле ввода как в AuthModal: одно и то же оформление во всех формах. */
const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

const SettingsModal: React.FC = () => {
  const {
    settings,
    toggleMusic,
    setMusicVolume,
    toggleSoundEffects,
    setSoundEffectsVolume,
  } = useSettings();

  const { closeModal } = useModal();
  const [localMusicVolume, setLocalMusicVolume] = useState(
    settings.musicVolume
  );
  const [localSFXVolume, setLocalSFXVolume] = useState(
    settings.soundEffectsVolume
  );
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  // Имя живёт в аккаунте (таблица `profiles`), а не в строке лидерборда: так его
  // правка сразу видна в витрине и переезжает на другое устройство.
  const { user } = useGameState();
  const [playerName, setPlayerName] = useState(user.username ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameResult, setNameResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Имя могло приехать из облака или обновиться в другом окне — подхватываем.
  useEffect(() => {
    setPlayerName(user.username ?? "");
  }, [user.username]);

  const handleSaveName = async () => {
    if (savingName) {
      return;
    }

    setSavingName(true);
    const result = await savePlayerName(playerName);
    setSavingName(false);
    setNameResult(result);

    if (result.ok) {
      // Лидерборд кэшируется на 30 секунд — после переименования сбрасываем его,
      // чтобы новое имя было видно сразу, а не после истечения кэша.
      void mutate((key) => Array.isArray(key) && key[0] === "leaderboard");
    }
  };

  const handleMusicVolumeChange = (volume: number) => {
    setLocalMusicVolume(volume);
    setMusicVolume(volume);
  };

  const handleSFXVolumeChange = (volume: number) => {
    setLocalSFXVolume(volume);
    setSoundEffectsVolume(volume);
  };

  const handleResetClick = () => {
    setShowResetConfirmation(true);
  };

  const handleConfirmReset = () => {
    localStorage.clear();
    updateGameState(getDefaultGameState());
    updateGameStateDB();
    restartNarrator();
    setShowResetConfirmation(false);
    closeModal();
  };

  const handleCancelReset = () => {
    setShowResetConfirmation(false);
  };

  const icon = (
    <svg
      className="w-6 h-6 text-cyan-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );

  return (
    <>
      <Modal icon={icon} title="Настройки">
        <div className="flex flex-col gap-3">
          {/* Настройки музыки */}
          <div className="ui-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-cyan-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-100">
                  Фоновая музыка
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.musicEnabled}
                aria-label="Фоновая музыка"
                onClick={toggleMusic}
                className={`relative h-6 w-12 rounded-full border border-white/10 transition-all duration-300 ${
                  settings.musicEnabled
                    ? "bg-cyan-500 shadow-lg shadow-cyan-500/30"
                    : "bg-slate-600"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full transition-all duration-300 absolute top-1 shadow-md ${
                    settings.musicEnabled
                      ? "transform translate-x-7"
                      : "transform translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localMusicVolume}
                onChange={(e) =>
                  handleMusicVolumeChange(parseFloat(e.target.value))
                }
                className="h-2 flex-1 cursor-pointer rounded-lg bg-slate-700 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!settings.musicEnabled}
              />
              <span
                className={`w-10 text-right text-xs font-semibold tabular-nums ${
                  settings.musicEnabled ? "text-cyan-200" : "text-slate-500"
                }`}
              >
                {Math.round(localMusicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Настройки звуковых эффектов */}
          <div className="ui-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-cyan-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-100">
                  Звуковые эффекты
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.soundEffectsEnabled}
                aria-label="Звуковые эффекты"
                onClick={toggleSoundEffects}
                className={`relative h-6 w-12 rounded-full border border-white/10 transition-all duration-300 ${
                  settings.soundEffectsEnabled
                    ? "bg-cyan-500 shadow-lg shadow-cyan-500/30"
                    : "bg-slate-600"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full transition-all duration-300 absolute top-1 shadow-md ${
                    settings.soundEffectsEnabled
                      ? "transform translate-x-7"
                      : "transform translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localSFXVolume}
                onChange={(e) =>
                  handleSFXVolumeChange(parseFloat(e.target.value))
                }
                className="h-2 flex-1 cursor-pointer rounded-lg bg-slate-700 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!settings.soundEffectsEnabled}
              />
              <span
                className={`w-10 text-right text-xs font-semibold tabular-nums ${
                  settings.soundEffectsEnabled
                    ? "text-cyan-200"
                    : "text-slate-500"
                }`}
              >
                {Math.round(localSFXVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Профиль игрока: имя видно в лидерборде */}
          <div className="ui-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-cyan-300"
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
              <h3 className="text-sm font-semibold text-slate-100">Профиль</h3>
            </div>

            <p className="mb-3 text-sm text-slate-300">
              Это имя видят другие игроки в лидерборде.
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-200">
                Имя игрока
              </span>
              <input
                type="text"
                value={playerName}
                onChange={(event) => {
                  setPlayerName(event.target.value);
                  setNameResult(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSaveName();
                  }
                }}
                placeholder="Ваше имя"
                maxLength={PLAYER_NAME_MAX_LENGTH}
                spellCheck={false}
                className={INPUT_CLASS}
              />
            </label>

            <button
              type="button"
              onClick={() => void handleSaveName()}
              disabled={
                savingName ||
                playerName.trim().length === 0 ||
                playerName.trim() === (user.username ?? "")
              }
              className="ui-button-primary mt-3 w-full py-3"
            >
              {savingName ? "Сохраняем…" : "Сохранить имя"}
            </button>

            {nameResult && (
              <p
                className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                  nameResult.ok
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                    : "border-rose-400/40 bg-rose-500/15 text-rose-100"
                }`}
              >
                {nameResult.message}
              </p>
            )}
          </div>

          {/* Информация о игре */}
          <div className="ui-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-cyan-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-slate-100">Об игре</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between gap-3">
                <span>Версия:</span>
                <span className="font-semibold text-cyan-200">pre-alpha</span>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="brand-text font-bold">Stellar Croak</span>
                <img
                  width={30}
                  height={30}
                  src="/assets/logo.webp"
                  alt="Логотип Stellar Croak"
                />
              </div>
            </div>
          </div>

          {/* Кнопка сброса прогресса */}
          <div className="ui-panel border-rose-400/30 bg-rose-950/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-rose-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <h3 className="text-sm font-semibold text-rose-100">
                Опасная зона
              </h3>
            </div>
            <p className="mb-3 text-sm text-slate-300">
              Это действие нельзя отменить. Все ваши жабы, биоподы и прогресс
              будут удалены.
            </p>
            <button
              type="button"
              onClick={handleResetClick}
              className="ui-button-danger w-full py-3"
            >
              Начать заново
            </button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно подтверждения сброса */}
      {showResetConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="settings-reset-title"
            className="ui-panel-raised mx-auto w-full max-w-sm border-rose-400/30 p-5"
          >
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
                <svg
                  className="w-8 h-8 text-rose-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3
                id="settings-reset-title"
                className="mb-2 text-lg font-bold text-white"
              >
                Сброс прогресса
              </h3>
              <p className="text-sm text-slate-300">
                Вы уверены, что хотите удалить все данные? Это действие нельзя
                отменить.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelReset}
                className="ui-button-secondary flex-1 py-3"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="ui-button-danger flex-1 py-3"
              >
                Удалить всё
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsModal;
