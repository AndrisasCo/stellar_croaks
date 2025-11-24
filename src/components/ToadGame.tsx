import { useEffect, useLayoutEffect, useState } from "react";
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
import { createToad } from "../backend";
import { DEFAULT_TOADS } from "../models/toad";
import AchivementsModal from "./modals/AchivementsModal";

export default function ToadGame() {
  const { toads, account, allToads } = useToads();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [achivementsOpen, setAchivementsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: isLoadingTg } = useTelegram();
  const { addNotification } = useNotifications();

  const showLoadingScreen = isLoading || !account || !allToads || isLoadingTg;

  useLayoutEffect(() => {
    if (!allToads) {
      return;
    }

    const initGame = async () => {
      await syncGameState();

      const timeManager = new TimeManager();
      const offlineHours = timeManager.getTimePassed();

      console.log("Hours offline: ", offlineHours);

      const delayNotification = (props: any) =>
        setTimeout(() => addNotification(props), 2000);

      processBreeding(offlineHours, delayNotification);

      if (offlineHours > 0.09) {
        processHunger(offlineHours);
      }

      // костыль! почему-то при первом рендере не ловит событие
      setTimeout(() => {
        window.dispatchEvent(new Event("gameStateUpdated"));
      }, 2000);
    };

    initGame();

    const gameLoop = setInterval(() => {
      // Быстрое размножение при активной игре
      processBreeding(0.25, addNotification);

      // медленнее голод
      processHunger(0.1);
    }, 5 * 60 * 1000); // Каждые 5 минут

    return () => {
      clearInterval(gameLoop);
    };
  }, []);

  useEffect(() => {
    window.addEventListener("AchivementCompleted", (e) => {
      addNotification({
        type: "success",
        content: `Новое достижение! ${e.detail.name}`,
      });
    });

    return () => window.removeEventListener("AchivementCompleted");
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  }, []);

  // todo поменять метод синка
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     updateGameStateDB();
  //   }, 1000 * 60 * 2); // 2m

  //   return () => clearInterval(interval);
  // }, []);

  const handleShopClick = () => {
    setShopMenuOpen(true);
  };

  const handleInventoryClick = () => {
    setStorageOpen(true);
  };

  return (
    <div className="min-h-screen flex mb-8 flex-col items-center p-2 bg-gradient-to-br from-gray-900 via-purple-900/20 to-green-900/20">
      {showLoadingScreen && <LoadingScreen />}
      <div className="w-full min-h-screen flex flex-col max-w-md relative mx-auto">
        {/* Кнопка открытия дополнительного меню */}
        <div className="mb-4 text-center absolute right-1 top-1 z-10">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700/80 text-gray-300 hover:text-white py-3 px-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-500/30 hover:border-purple-400/50 font-bold text-sm w-full neon-glow"
          >
            <div className="flex items-center justify-center gap-3">
              {MenuIcons.menu}
            </div>
          </button>
        </div>

        <header className="text-center mb-4 pt-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent mb-2 animate-gradient">
            Stellar Croak
          </h1>
          <p className="text-green-300/80 text-sm px-14 font-light">
            Наполним галактику кваканьем!
          </p>
        </header>

        {/* Основные кнопки действий */}
        <div className="grid grid-cols-2 gap-3 mb-4 px-2">
          {/* Магазин */}
          <button
            onClick={handleShopClick}
            className="bg-purple-900/40 backdrop-blur-sm hover:bg-purple-800/60 text-purple-300 hover:text-purple-100 py-3 px-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-500/40 hover:border-purple-400/60 font-bold neon-glow-purple"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm">РЫНОК</span>
              {MenuIcons.shop}
            </div>
          </button>

          {/* Инвентарь */}
          <button
            onClick={handleInventoryClick}
            className="bg-green-900/40 backdrop-blur-sm hover:bg-green-800/60 text-green-300 hover:text-green-100 py-3 px-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-green-500/40 hover:border-green-400/60 font-bold neon-glow-green"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm">СКЛАД</span>
              {MenuIcons.inventory}
            </div>
          </button>
        </div>

        <ShopMenu
          isOpen={shopMenuOpen}
          onClose={() => setShopMenuOpen(false)}
        />
        <StorageModal
          isOpen={storageOpen}
          onClose={() => setStorageOpen(false)}
        />

        {/* Основной контент */}
        <div className="flex-1 min-h-0 pb-5">
          {!showLoadingScreen && <ToadScene />}
        </div>

        {/* Модальное окно дополнительного меню */}
        {isMenuOpen && (
          <BurgerMenu
            setIsSettingsOpen={() => setIsSettingsOpen(true)}
            setIsMenuClose={() => setIsMenuOpen(false)}
            setLeaderboardOpen={() => setLeaderboardOpen(true)}
            setIsTutorialOpen={() => setIsTutorialOpen(true)}
            setIsAchivementsOpen={() => setAchivementsOpen(true)}
          />
        )}

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />

        <LeaderboardModal
          isOpen={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
        />

        <AchivementsModal
          isOpen={achivementsOpen}
          onClose={() => setAchivementsOpen(false)}
        />

        <ColliderButton />

        {/* Статистика в футере */}
        <footer className="mt-auto text-center">
          <p className="text-gray-500 text-xs">
            {toads.length} жаб в вольере |{" "}
            {toads.filter((t) => t.type === "hybrid").length} гибридов
          </p>
        </footer>
        <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-purple-500/20 py-2 z-20">
          <div className="max-w-md mx-auto px-4">
            <div className="flex justify-between items-center text-xs px-3">
              <div className="text-pink-300/80">
                {" "}
                🍎 {account.storage.food}{" "}
              </div>
              <div className="text-cyan-300/80">
                {CURRENCY_CONFIG.tokens.icon} {account?.tokens || 0}
              </div>
              <div className="text-green-300/80">
                {CURRENCY_CONFIG.astro_quax.icon} {account?.astro_quax || 0}
              </div>
            </div>
          </div>
        </footer>
      </div>
      <MusicPlayer />

      {/* Уведомление */}
      <div className="fixed bottom-16 left-0 w-full flex justify-center z-[100]">
        <div
          id="notification"
          className="z-140 text-white px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 opacity-0 scale-95 flex items-center gap-2"
        >
          Notification
        </div>
      </div>
    </div>
  );
}
