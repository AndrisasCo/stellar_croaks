import React, { useState } from "react";
import { useSettings } from "../SettingsContext";
import Modal from "../shared/Modal";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    toggleMusic,
    setMusicVolume,
    toggleSoundEffects,
    setSoundEffectsVolume,
  } = useSettings();
  const [localMusicVolume, setLocalMusicVolume] = useState(
    settings.musicVolume
  );
  const [localSFXVolume, setLocalSFXVolume] = useState(
    settings.soundEffectsVolume
  );

  const handleMusicVolumeChange = (volume: number) => {
    setLocalMusicVolume(volume);
    setMusicVolume(volume);
  };

  const handleSFXVolumeChange = (volume: number) => {
    setLocalSFXVolume(volume);
    setSoundEffectsVolume(volume);
  };

  const handleClose = () => {
    onClose();
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
    <Modal isOpen={isOpen} onClose={onClose} icon={icon} title="Настройки">
      <div className="space-y-4">
        {/* Настройки музыки */}
        <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
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
        <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
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
                settings.soundEffectsEnabled ? "text-blue-400" : "text-gray-500"
              }`}
            >
              {Math.round(localSFXVolume * 100)}%
            </span>
          </div>
        </div>

        {/* Информация о игре */}
        <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50">
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
            <h3 className="text-white font-semibold text-sm">Об игре</h3>
          </div>
          <div className="text-gray-300 text-sm space-y-2">
            <div className="flex justify-between">
              <span>Версия:</span>
              <span className="text-green-400 font-medium">pre-alpha</span>
            </div>

            <div className="pt-2 border-t border-gray-600/50 text-center">
              <span className="text-green-400 font-bold">
                Toad Genetic Lab 🐸
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка закрытия */}
      <button
        onClick={handleClose}
        className="w-full bg-gradient-to-r from-green-600 to-purple-600 hover:from-green-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl mt-6 transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/20 shadow-lg hover:shadow-xl"
      >
        Готово
      </button>
    </Modal>
  );
};

export default SettingsModal;
