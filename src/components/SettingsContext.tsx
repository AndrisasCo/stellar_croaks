import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

interface Settings {
  musicEnabled: boolean;
  musicVolume: number;
  soundEffectsEnabled: boolean;
  soundEffectsVolume: number;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  toggleMusic: () => void;
  setMusicVolume: (volume: number) => void;
  toggleSoundEffects: () => void;
  setSoundEffectsVolume: (volume: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

// Ключ для localStorage
const SETTINGS_STORAGE_KEY = "toadLabSettings";

// Настройки по умолчанию
const defaultSettings: Settings = {
  musicEnabled: true,
  musicVolume: 0.3,
  soundEffectsEnabled: true,
  soundEffectsVolume: 0.7,
};

// Функция для загрузки настроек из localStorage
const loadSettingsFromStorage = (): Settings => {
  try {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);

      // Проверяем, что все необходимые поля присутствуют
      return {
        musicEnabled:
          parsedSettings.musicEnabled ?? defaultSettings.musicEnabled,
        musicVolume: parsedSettings.musicVolume ?? defaultSettings.musicVolume,
        soundEffectsEnabled:
          parsedSettings.soundEffectsEnabled ??
          defaultSettings.soundEffectsEnabled,
        soundEffectsVolume:
          parsedSettings.soundEffectsVolume ??
          defaultSettings.soundEffectsVolume,
      };
    }
  } catch (error) {
    console.error("Ошибка при загрузке настроек из localStorage:", error);
  }

  // Возвращаем настройки по умолчанию в случае ошибки
  return defaultSettings;
};

// Функция для сохранения настроек в localStorage
const saveSettingsToStorage = (settings: Settings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Ошибка при сохранении настроек в localStorage:", error);
  }
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Загружаем настройки из localStorage при инициализации
  useEffect(() => {
    const savedSettings = loadSettingsFromStorage();
    setSettings(savedSettings);
  }, []);

  // Обновляем состояние и сохраняем в localStorage
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updatedSettings = { ...prev, ...newSettings };
      saveSettingsToStorage(updatedSettings);
      return updatedSettings;
    });
  };

  const toggleMusic = () => {
    setSettings((prev) => {
      const updatedSettings = { ...prev, musicEnabled: !prev.musicEnabled };
      saveSettingsToStorage(updatedSettings);
      return updatedSettings;
    });
  };

  const setMusicVolume = (volume: number) => {
    setSettings((prev) => {
      const updatedSettings = { ...prev, musicVolume: volume };
      saveSettingsToStorage(updatedSettings);
      return updatedSettings;
    });
  };

  const toggleSoundEffects = () => {
    setSettings((prev) => {
      const updatedSettings = {
        ...prev,
        soundEffectsEnabled: !prev.soundEffectsEnabled,
      };
      saveSettingsToStorage(updatedSettings);
      return updatedSettings;
    });
  };

  const setSoundEffectsVolume = (volume: number) => {
    setSettings((prev) => {
      const updatedSettings = { ...prev, soundEffectsVolume: volume };
      saveSettingsToStorage(updatedSettings);
      return updatedSettings;
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        toggleMusic,
        setMusicVolume,
        toggleSoundEffects,
        setSoundEffectsVolume,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
