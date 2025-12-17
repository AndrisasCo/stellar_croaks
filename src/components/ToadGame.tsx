import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import ToadScene from "./ToadScene";
import { useToads } from "./ToadContext";
import { MenuIcons } from "../assets/icons";
import { BurgerMenu } from "./modals/BurgerMenuModal";
import MusicPlayer from "./shared/MusicPlayer";
import SettingsModal from "./modals/SettingsModal";
import LoadingScreen from "./shared/LoadingScreen";
import ColliderButton from "./ToadCollider/ColliderButton";
import { processBreeding, TimeManager } from "../utils/breeding-manager";
import ShopMenu from "./modals/ShopMenuModal";
import StorageModal from "./modals/StorageModal";
import { processHunger } from "../utils/state-manager";
import {
  syncGameState,
  updateGameStateDB,
  updateLeaderbord,
} from "../backend/db";
import LeaderboardModal from "./modals/LeaderboardModal";
import TutorialModal from "./modals/TutorialModal";
import { useTelegram } from "../hooks/use-tg";
import { useNotifications } from "../hooks/use-notification";
import { CURRENCY_CONFIG } from "../utils/constants";
import AchivementsModal from "./modals/AchivementsModal";
import { getGameState } from "../backend/localStorage";
import { ClickButton } from "./shared/ClickButton";
import { ToadGalleryModal } from "./modals/ToadGalleryModal";
import { addToadToCollection } from "../backend/achivements-manager";
import { TOAD_SPECIES_CONFIG } from "../models/Toad/toad-species";

// Конфиг обновлений для уведомлений
const UPDATES_LOG = [
  {
    time: 1764349635232,
    msg: "Добавлены лутбоксы! Проверьте магазин!",
  },
  {
    time: 1764247827677,
    msg: "Добавлена новая игровая механика: генетические поломки ДНК! Можете узнать больше в туториале, либо попробовать поэксперементировать!",
  },
  {
    time: 1764864100220,
    msg: "В магазин добавлены новые предметы!",
  },
  {
    time: 1764691777865,
    msg: "Добавлены ЕЩЕ достижения! 🥇",
  },
];

interface UiState {
  isSettingsOpen: boolean;
  isMenuOpen: boolean;
  isShopOpen: boolean;
  isStorageOpen: boolean;
  isLeaderboardOpen: boolean;
  isTutorialOpen: boolean;
  isAchievementsOpen: boolean;
  isGalleryOpen: boolean;
  isLoading: boolean;
}

export default function ToadGame() {
  const { toads, account, allToads, currentScene } = useToads();
  const { isLoading: isLoadingTg } = useTelegram();
  const { addNotification } = useNotifications();

  // Единый стейт для UI
  const [ui, setUi] = useState<UiState>({
    isSettingsOpen: false,
    isMenuOpen: false,
    isShopOpen: false,
    isStorageOpen: false,
    isLeaderboardOpen: false,
    isTutorialOpen: false,
    isAchievementsOpen: false,
    isGalleryOpen: false,
    isLoading: true,
  });

  // Хелпер для переключения модалок
  const toggleModal = useCallback((key: keyof UiState, value: boolean) => {
    setUi((prev) => ({ ...prev, [key]: value }));
  }, []);

  const showLoadingScreen =
    ui.isLoading || !account || !allToads || isLoadingTg;

  // Инициализация игры (Game Logic)
  useLayoutEffect(() => {
    if (!allToads) {
      return;
    }

    const initGame = async () => {
      await syncGameState();

      // todo удалить
      TOAD_SPECIES_CONFIG.map((config) => {
        const foundToad = allToads.find((t) => t.type === config.type)?.type;
        foundToad && addToadToCollection(foundToad);
      });
      // end todo

      const timeManager = new TimeManager();
      const offlineHours = timeManager.getTimePassed();

      // Отложенный запуск уведомлений о размножении
      const delayNotification = (props: any) =>
        setTimeout(() => addNotification(props), 2000);

      processBreeding(offlineHours, delayNotification);

      if (offlineHours > 0.09) {
        processHunger(offlineHours);
      }

      updateLeaderbord();

      // Костыль для первого рендера
      setTimeout(() => {
        window.dispatchEvent(new Event("gameStateUpdated"));
      }, 2000);
    };

    initGame();

    // Игровой цикл
    const breedLoop = setInterval(
      () => processBreeding(0.25, addNotification),
      5 * 60 * 1000
    );
    const hungerLoop = setInterval(() => processHunger(0.1), 5 * 60 * 1000);
    const fastBreedLoop = setInterval(
      () => processBreeding(0, addNotification),
      60 * 1000
    );
    const saveLoop = setInterval(() => updateGameStateDB(), 3 * 60 * 1000);

    return () => {
      clearInterval(breedLoop);
      clearInterval(hungerLoop);
      clearInterval(fastBreedLoop);
      clearInterval(saveLoop);
    };
  }, []);

  // Инициализация UI и уведомлений
  useEffect(() => {
    // Слушатель ачивок
    const handleAchievement = (e: any) => {
      addNotification({
        type: "success",
        content: `Новое достижение! ${e.detail.name}`,
      });
    };
    window.addEventListener("AchivementCompleted", handleAchievement);

    // Логика при загрузке
    const loadingTimeout = setTimeout(() => {
      setUi((prev) => ({ ...prev, isLoading: false }));

      // Проверка обновлений
      const lastSaveTime = new Date(getGameState().lastSaved).getTime();
      UPDATES_LOG.forEach((update) => {
        if (update.time > lastSaveTime) {
          addNotification({
            type: "info",
            content: update.msg,
            timeout: 15000,
          });
        }
      });

      // Туториал для новичков
      if (!localStorage.getItem("tutorial_read")) {
        localStorage.setItem("tutorial_read", "true");
        toggleModal("isTutorialOpen", true);
      }
    }, 2000);

    return () => {
      window.removeEventListener("AchivementCompleted", handleAchievement);
      clearTimeout(loadingTimeout);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] safe-area-bottom flex mb-9 pb-4 flex-col items-center p-2 bg-gradient-to-br from-gray-900 via-purple-900/20 to-green-900/20">
      {showLoadingScreen && <LoadingScreen />}

      <div className="w-full flex flex-col max-w-md relative mx-auto">
        {/* Кнопка Меню (Бургер) */}
        <div className="mb-4 text-center absolute right-1 top-1 z-10">
          <ClickButton
            onClick={() => toggleModal("isMenuOpen", true)}
            className="bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700/80 text-gray-300 hover:text-white py-3 px-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-500/30 hover:border-purple-400/50 font-bold text-sm w-full neon-glow"
          >
            <div className="flex items-center justify-center gap-3">
              {MenuIcons.menu}
            </div>
          </ClickButton>
        </div>

        <header className="text-center mb-4 pt-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent mb-2 animate-gradient">
            Stellar Croak
          </h1>
          <p className="text-green-300/80 text-sm px-14 font-light">
            Наполним галактику кваканьем!
          </p>
        </header>

        {/* Кнопки быстрого доступа */}
        <div className="grid grid-cols-2 gap-3 mb-4 px-2">
          <ClickButton
            onClick={() => toggleModal("isShopOpen", true)}
            className="bg-purple-900/40 backdrop-blur-sm hover:bg-purple-800/60 text-purple-300 hover:text-purple-100 py-3 px-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-500/40 hover:border-purple-400/60 font-bold neon-glow-purple"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm">РЫНОК</span>
              {MenuIcons.shop}
            </div>
          </ClickButton>

          <ClickButton
            onClick={() => toggleModal("isStorageOpen", true)}
            className="bg-green-900/40 backdrop-blur-sm hover:bg-green-800/60 text-green-300 hover:text-green-100 py-3 px-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-green-500/40 hover:border-green-400/60 font-bold neon-glow-green"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm">СКЛАД</span>
              {MenuIcons.inventory}
            </div>
          </ClickButton>
        </div>

        {/* Сцена с жабами */}
        <div className="flex-1 min-h-0 pb-5">
          {!showLoadingScreen && <ToadScene />}
        </div>

        {/* --- МОДАЛЬНЫЕ ОКНА --- */}

        <ShopMenu
          isOpen={ui.isShopOpen}
          onClose={() => toggleModal("isShopOpen", false)}
        />

        <StorageModal
          isOpen={ui.isStorageOpen}
          onClose={() => toggleModal("isStorageOpen", false)}
        />

        {ui.isMenuOpen && <BurgerMenu toggleModal={toggleModal} />}

        <SettingsModal
          isOpen={ui.isSettingsOpen}
          onClose={() => toggleModal("isSettingsOpen", false)}
        />

        <TutorialModal
          isOpen={ui.isTutorialOpen}
          onClose={() => toggleModal("isTutorialOpen", false)}
        />

        {ui.isLeaderboardOpen && (
          <LeaderboardModal
            isOpen={ui.isLeaderboardOpen}
            onClose={() => toggleModal("isLeaderboardOpen", false)}
          />
        )}

        <AchivementsModal
          isOpen={ui.isAchievementsOpen}
          onClose={() => toggleModal("isAchievementsOpen", false)}
        />

        <ToadGalleryModal
          isOpen={ui.isGalleryOpen}
          onClose={() => toggleModal("isGalleryOpen", false)}
        />

        <ColliderButton />

        {/* Футер статистики */}
        <footer className="mt-auto text-center pb-4">
          <p className="text-gray-500 text-xs">
            {toads.length} / {currentScene.capacity} жаб в вольере |{" "}
            {toads.filter((t) => t.type === "hybrid").length} гибридов
          </p>
        </footer>

        {/* Фиксированный футер ресурсов */}
        <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-purple-500/20 pt-2 pb-3 z-20">
          <div className="max-w-md mx-auto px-10">
            <div className="flex justify-between items-center text-xs px-3">
              <div className="text-pink-300/80">🍎 {account.storage.food} </div>
              <div className="text-cyan-300/80">
                {CURRENCY_CONFIG.tokens.icon} {account?.tokens || 0}
              </div>
              <div className="text-green-300/80">
                {CURRENCY_CONFIG.astro_quax.icon} {account?.astro_quax || 0}
              </div>
              <div className="text-purple-300/80 flex gap-1">
                <img src="/assets/logo.png" width={16} alt="logo" />{" "}
                {allToads.length}
              </div>
            </div>
          </div>
        </footer>
      </div>

      <MusicPlayer />
    </div>
  );
}
