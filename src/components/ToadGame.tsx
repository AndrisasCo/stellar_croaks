import { useEffect, useState } from "react";
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
import { updateLeaderbord } from "../backend/db";
import LeaderboardModal from "./modals/LeaderboardModal";
import TutorialModal from "./modals/TutorialModal";
import { useTelegram } from "../hooks/use-tg";
import { useNotifications } from "../hooks/use-notification";

export default function ToadGame() {
  const { toads, account, allToads } = useToads();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: isLoadingTg } = useTelegram();
  const { addNotification } = useNotifications();

  const showLoadingScreen = isLoading || !account || !allToads || isLoadingTg;

  useEffect(() => {
    if (!allToads) {
      return;
    }
    const timeManager = new TimeManager();
    const offlineHours = timeManager.getTimePassed();

    console.log("Hours offline: ", offlineHours);

    const gameLoop = setInterval(() => {
      // Быстрое размножение при активной игре
      processBreeding(0.25, addNotification);

      // медленнее голод
      processHunger(0.1);
    }, 5 * 60 * 1000); // Каждые 5 минут

    const delayNotification = (props: any) =>
      setTimeout(() => addNotification(props), 2000);
    processBreeding(offlineHours, delayNotification);

    if (offlineHours > 0.09) {
      processHunger(offlineHours);
    }

    updateLeaderbord();

    return () => {
      clearInterval(gameLoop);
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  }, []);

  const handleShopClick = () => {
    setShopMenuOpen(true);
  };

  const handleInventoryClick = () => {
    setStorageOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-2">
      {showLoadingScreen && <LoadingScreen />}
      <div className="w-full min-h-screen flex flex-col max-w-md relative mx-auto">
        {/* Кнопка открытия дополнительного меню */}
        <div className="mb-4 text-center absolute right-1 top-1">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white py-3 px-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-gray-600/50 hover:border-gray-500/50 font-bold text-sm w-full"
          >
            <div className="flex items-center justify-center gap-3">
              {MenuIcons.menu}
            </div>
          </button>
        </div>
        <header className="text-center mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent mb-1 animate-gradient">
            Stellar Croak
          </h1>
          <p className="text-green-300 text-sm px-14">
            Наполним галактику кваканьем!
          </p>
        </header>

        {/* Основные кнопки действий */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Магазин */}
          <button
            onClick={handleShopClick}
            className="bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 hover:text-purple-200 py-1 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-500/50 hover:border-purple-400/50 font-bold"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm">РЫНОК</span>
              {MenuIcons.shop}
            </div>
          </button>

          {/* Инвентарь */}
          <button
            onClick={handleInventoryClick}
            className="bg-green-900/50 hover:bg-green-800/50 text-green-300 hover:text-green-200 py-1 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-green-500/50 hover:border-green-400/50 font-bold"
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
        {!showLoadingScreen && <ToadScene />}

        {/* Модальное окно дополнительного меню */}
        {isMenuOpen && (
          <BurgerMenu
            setIsSettingsOpen={() => setIsSettingsOpen(true)}
            setIsMenuClose={() => setIsMenuOpen(false)}
            setLeaderboardOpen={() => setLeaderboardOpen(true)}
            setIsTutorialOpen={() => setIsTutorialOpen(true)}
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

        <ColliderButton />

        <footer className="mt-auto text-center">
          <p className="text-gray-500 text-xs">
            {toads.length} жаб в вольере |{" "}
            {toads.filter((t) => t.type === "hybrid").length} гибридов
          </p>
        </footer>
      </div>
      <MusicPlayer />

      {/* Уведомление */}
      <div className="fixed bottom-5 left-0 w-full flex justify-center  z-[100]">
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
// верстка, overflow
