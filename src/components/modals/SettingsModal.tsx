import React, { useState } from "react";
import { useSettings } from "../SettingsContext";
import Modal from "../shared/Header";
import {
  getDefaultGameState,
  updateGameState,
} from "../../backend/localStorage";
import { updateGameStateDB } from "../../backend/db";
import { useModal } from "../ModalContext";

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
    setShowResetConfirmation(false);
    closeModal();
  };

  const handleCancelReset = () => {
    setShowResetConfirmation(false);
  };

  const icon = (
    <svg
      className="w-6 h-6 text-green-400"
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
          <div className="bg-color-main rounded-xl py-4 px-2 border border-gray-600/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-400"
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
                <span className="text-white font-semibold text-sm">
                  Фоновая музыка
                </span>
              </div>
              <button
                onClick={toggleMusic}
                className={`w-12 h-6 rounded-full transition-all duration-300 relative ${
                  settings.musicEnabled
                    ? "bg-green-500 shadow-lg shadow-green-500/30"
                    : "bg-gray-600"
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
                className="flex-1 accent-green-500 h-2 rounded-lg bg-gray-600"
                disabled={!settings.musicEnabled}
              />
              <span
                className={`text-sm w-8 font-medium ${
                  settings.musicEnabled ? "text-green-400" : "text-gray-500"
                }`}
              >
                {Math.round(localMusicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Настройки звуковых эффектов */}
          <div className="bg-color-main rounded-xl py-4 px-2 border border-gray-600/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-400"
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
                <span className="text-white font-semibold text-sm">
                  Звуковые эффекты
                </span>
              </div>
              <button
                onClick={toggleSoundEffects}
                className={`w-12 h-6 rounded-full transition-all duration-300 relative ${
                  settings.soundEffectsEnabled
                    ? "bg-blue-500 shadow-lg shadow-blue-500/30"
                    : "bg-gray-600"
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
                className="flex-1 accent-blue-500 h-2 rounded-lg bg-gray-600"
                disabled={!settings.soundEffectsEnabled}
              />
              <span
                className={`text-sm w-8 font-medium ${
                  settings.soundEffectsEnabled
                    ? "text-blue-400"
                    : "text-gray-500"
                }`}
              >
                {Math.round(localSFXVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Информация о игре */}
          <div className="bg-color-main rounded-xl py-4 px-2 border border-gray-600/50">
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-purple-400"
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
              <h3 className="text-white font-semibold px-2 text-sm">Об игре</h3>
            </div>
            <div className="text-gray-200 text-sm space-y-2">
              <div className="flex justify-between">
                <span>Версия:</span>
                <span className="text-green-400 font-medium">pre-alpha</span>
              </div>

              <div className="pt-2 border-t border-gray-600/50 text-center">
                <span className="text-green-400 font-bold flex items-center justify-between">
                  Stellar Croak{" "}
                  <img width={30} height={30} src="/assets/logo.webp" />
                </span>
              </div>
            </div>
          </div>

          {/* Кнопка сброса прогресса */}
          <div className="bg-red-500/10 rounded-xl py-4 px-2 border border-red-500/30">
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-red-400"
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
              <h3 className="text-white font-semibold px-2 text-sm">
                Опасная зона
              </h3>
            </div>
            <p className="text-gray-200 text-sm mb-3">
              Это действие нельзя отменить. Все ваши жабы, биоподы и прогресс
              будут удалены.
            </p>
            <button
              onClick={handleResetClick}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-red-400/30 shadow-lg hover:shadow-red-500/25"
            >
              Начать заново
            </button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно подтверждения сброса */}
      {showResetConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-color-main rounded-2xl border-2 border-red-500/50 p-6 max-w-sm w-full mx-auto">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-8 h-8 text-red-400"
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
              <h3 className="text-white font-bold text-lg mb-2">
                Сброс прогресса
              </h3>
              <p className="text-gray-200 text-sm">
                Вы уверены, что хотите удалить все данные? Это действие нельзя
                отменить.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelReset}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-3 rounded-xl transition-all duration-300"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmReset}
                className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-3 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
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
