import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useToads } from "../ToadContext";
import { MenuIcons } from "../../assets/icons";
import { BurgerMenu } from "../modals/BurgerMenuModal";
import MusicPlayer from "../shared/MusicPlayer";
import SettingsModal from "../modals/SettingsModal";
import LoadingScreen from "../shared/LoadingScreen";
import { processBreeding, TimeManager } from "../../utils/breeding-manager";
import ShopMenu from "../modals/ShopMenu/ShopMenuModal";
import StorageModal from "../modals/StorageModal";
import { processHunger } from "../../utils/state-manager";
import {
  syncGameState,
  updateGameStateDB,
  updateLeaderbord,
} from "../../backend/db";
import LeaderboardModal from "../modals/LeaderboardModal";
import TutorialModal from "../modals/TutorialModal";
import { useTelegram } from "../../hooks/use-tg";
import { useNotifications } from "../../hooks/use-notification";
import { CURRENCY_CONFIG } from "../../utils/constants";
import AchivementsModal from "../modals/AchivementsModal";
import { getGameState } from "../../backend/localStorage";
import { ClickButton } from "../shared/ClickButton";
import { ToadGalleryModal } from "../modals/ToadGalleryModal";
import { addToadToCollection } from "../../backend/achivements-manager";
import { TOAD_SPECIES_CONFIG } from "../../models/Toad/toad-species";
import ColliderButton from "../modals/ToadCollider/ColliderButton";
import ToadScene from "./ToadScene";

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
    <div className="min-h-[100dvh] flex  flex-col items-center ">
      {showLoadingScreen && <LoadingScreen />}

      <div className="w-full p-2 pb-4 mb-9  safe-area-bottom  flex flex-col bg-[url('/assets/bg-main.png')] cover max-w-2xl relative mx-auto">
        {/* Кнопка Меню (Бургер) */}
        <div className="text-center absolute right-1 top-1 z-10">
          <ClickButton
            onClick={() => toggleModal("isMenuOpen", true)}
            className="bg-gray-400/10 backdrop-blur-sm p-[6px] rounded-md  duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-300/80 text-purple-300 hover:border-purple-400/50 w-full"
          >
            {MenuIcons.menu}
          </ClickButton>
        </div>

        <header className="text-center mb-8 pt-2 ">
          <h1 className="text-3xl backgroundDark ">Stellar Croak</h1>
        </header>

        {/* Кнопки быстрого доступа */}
        <div className="grid grid-cols-2 gap-3 mb-4 px-2">
          <ClickButton
            onClick={() => toggleModal("isShopOpen", true)}
            style={{
              backgroundPosition: 10,
              backgroundSize: 40,
            }}
            className="
            bg-[url('/assets/market.png')]  bg-no-repeat
            bg-gray-700/40 backdrop-blur-sm hover:bg-purple-800/60 text-purple-300 hover:text-purple-100 py-3 px-4 rounded-md transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-300/90 hover:border-purple-400/60 font-bold "
          >
            <span className="p-l-10">РЫНОК</span>
          </ClickButton>

          <ClickButton
            onClick={() => toggleModal("isStorageOpen", true)}
            style={{
              backgroundPosition: 10,
              backgroundSize: 40,
            }}
            className="
            bg-[url('/assets/storage.png')] bg-no-repeat
            bg-gray-700/40 backdrop-blur-sm hover:bg-green-800/60 text-green-300 hover:text-green-100 py-3 px-4 rounded-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-green-300/90 hover:border-green-400/60 font-bold "
          >
            <span className="p-l-10">СКЛАД</span>
          </ClickButton>
        </div>

        {/* Сцена с жабами */}
        <div className="flex-1 min-h-0 pb-5">
          <ToadScene />
        </div>

        <ColliderButton />

        {/* Футер статистики */}
        <footer className="mt-auto text-center pb-4 relative">
          <p className="text-white text-sm">
            {toads.length} / {currentScene.capacity} жаб в вольере |{" "}
            {toads.filter((t) => t.type === "hybrid").length} гибридов
          </p>
        </footer>

        {/* --- МОДАЛЬНЫЕ ОКНА --- */}

        <ShopMenu
          isOpen={ui.isShopOpen}
          onClose={() => toggleModal("isShopOpen", false)}
        />

        {ui.isStorageOpen && (
          <StorageModal
            isOpen={ui.isStorageOpen}
            onClose={() => toggleModal("isStorageOpen", false)}
          />
        )}

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

        {/* Фиксированный футер ресурсов */}
        <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-purple-500/20 pt-2 pb-3 z-20">
          <div className="max-w-2xl mx-auto px-10">
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
