import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useToads } from "../ToadContext";
import { MenuIcons } from "../../assets/icons";
import { BurgerMenu } from "../modals/BurgerMenuModal";
import MusicPlayer from "../shared/MusicPlayer";
import SettingsModal from "../modals/SettingsModal";
import LoadingScreen from "../shared/LoadingScreen";
import { processBreeding, TimeManager } from "../../utils/breeding-manager";
import { processDiseases } from "../../utils/disease-manager";
import { processCyberEvents } from "../../utils/events-manager";
import {
  processExpeditions,
  processHpRegen,
} from "../../utils/expedition-manager";
import ShopMenu from "../modals/ShopMenu";
import StorageModal from "../modals/StorageModal";
import { processHunger } from "../../utils/state-manager";
import {
  getSceneProductionRate,
  getUpkeepRate,
  processEnergyRegen,
  processProduction,
} from "../../utils/production-manager";
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
import { getGameState, saveGameState } from "../../backend/localStorage";
import { ClickButton } from "../shared/ClickButton";
import { ToadGalleryModal } from "../modals/ToadGalleryModal";
import { addToadToCollection } from "../../backend/achivements-manager";
import { TOAD_SPECIES_CONFIG } from "../../models/Toad/toad-species";
import ColliderButton from "../modals/Lab/ColliderButton";
import ToadScene from "./ToadScene";
import { useModal } from "../ModalContext";
import { preloadImages } from "../../utils/ui";
import { useGameState } from "../../hooks/use-game-state";
import ExpeditionModal from "../modals/ExpeditionModal";

// Конфиг обновлений для уведомлений
const UPDATES_LOG = [
  {
    time: 1791463844929,
    msg: "Большое обновление: ферма биомассы, силы жаб и отдых, ручное разведение в «Гнезде» и кибер-болезни! Загляните в обучение — там всё описано.",
  },
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
  const { expeditions = [] } = useGameState();
  const { isLoading: isLoadingTg } = useTelegram();
  const { addNotification } = useNotifications();
  const { openModal, closeModal } = useModal();

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
      preloadImages([
        "/bg/bg-main.webp",
        "/bg/bg-col.webp",
        "/bg/bg-lab.webp",
        "/bg/bg-shop.webp",
        "/bg/main-end.webp",
        "/bg/incubator.webp",
      ]);

      await syncGameState();

      const timeManager = new TimeManager();
      const offlineHours = timeManager.getTimePassed();

      // Отложенный запуск уведомлений о размножении
      const delayNotification = (props: any) =>
        setTimeout(() => addNotification(props), 2000);

      processBreeding(offlineHours, delayNotification);

      if (offlineHours > 0.09) {
        processHunger(offlineHours);
        // Оффлайн-доход фермы и восстановление сил жаб (Часть 3.3)
        processProduction(offlineHours);
        processEnergyRegen(offlineHours);
        // Кибер-риски оффлайна (Часть 3.6)
        processDiseases(offlineHours);
        processCyberEvents(offlineHours, delayNotification);
      }

      // Разведка (Часть 5): походы идут по реальному времени, команды возвращаются,
      // а жабы дома восстанавливают HP
      processExpeditions(delayNotification);
      processHpRegen(offlineHours);

      updateLeaderbord();

      saveGameState(getGameState(), false);

      // Костыль для первого рендера
      setTimeout(() => {
        window.dispatchEvent(new Event("gameStateUpdated"));
      }, 2000);
    };

    initGame();

    // Игровой цикл
    // Ферма (Часть 3.3): выработка биомассы, апкипинг и восстановление сил жаб
    const farmLoop = setInterval(() => {
      processProduction(0.25);
      processEnergyRegen(0.25);
    }, 5 * 60 * 1000);

    const hungerLoop = setInterval(() => processHunger(0.1), 5 * 60 * 1000);

    // Кибер-события и болезни (Часть 3.6): раз в час игрового времени
    const cyberLoop = setInterval(() => {
      processDiseases(1);
      processCyberEvents(1, addNotification);
    }, 60 * 60 * 1000);

    // Роды и рост головастиков. Новые беременности запускаются вручную («Гнездо»)
    const birthLoop = setInterval(
      () => processBreeding(0, addNotification),
      60 * 1000
    );

    // Разведка (Часть 5): события походов и регенерация HP дома — раз в 5 минут
    const expeditionLoop = setInterval(() => {
      processExpeditions(addNotification);
      processHpRegen(0.25);
    }, 5 * 60 * 1000);

    const saveLoop = setInterval(() => updateGameStateDB(), 3 * 60 * 1000);

    return () => {
      clearInterval(farmLoop);
      clearInterval(hungerLoop);
      clearInterval(cyberLoop);
      clearInterval(birthLoop);
      clearInterval(expeditionLoop);
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

  // Ферма (Часть 3.3): сколько биомассы в час даёт текущий вольер с учётом содержания
  const sceneFarmRate =
    getSceneProductionRate(toads) - getUpkeepRate(toads);

  return (
    <div className="min-h-[100dvh] flex  flex-col items-center ">
      {showLoadingScreen && <LoadingScreen />}

      <div className="w-full p-2 pb-4 mb-9  safe-area-bottom  flex flex-col bg-[url('/bg/bg-main.webp')] cover max-w-2xl relative mx-auto">
        {/* Кнопка Меню (Бургер) */}
        <div className="text-center absolute right-1 top-1 z-10">
          <ClickButton
            onClick={() => openModal(() => <BurgerMenu />)}
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
            onClick={() =>
              openModal(() => <ShopMenu />, { bg: "/bg/bg-col.webp" })
            }
            style={{
              backgroundPosition: 10,
              backgroundSize: 40,
            }}
            className="
            bg-[url('/assets/market.webp')]  bg-no-repeat
            bg-slate-700/40 backdrop-blur-sm hover:bg-purple-800/60 text-purple-300 hover:text-purple-100 py-3 px-4 rounded-md transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-purple-300/90 hover:border-purple-400/60 font-bold "
          >
            <span className="p-l-10">РЫНОК</span>
          </ClickButton>

          <ClickButton
            onClick={() => openModal(() => <StorageModal />)}
            style={{
              backgroundPosition: 10,
              backgroundSize: 40,
            }}
            className="
            bg-[url('/assets/storage.webp')] bg-no-repeat
            bg-slate-700/40 backdrop-blur-sm hover:bg-green-800/60 text-green-300 hover:text-green-100 py-3 px-4 rounded-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-green-300/90 hover:border-green-400/60 font-bold "
          >
            <span className="p-l-10">СКЛАД</span>
          </ClickButton>
        </div>

        {/* Разведка (Часть 5): походы за Периметр */}
        <div className="mb-4 px-2">
          <ClickButton
            onClick={() => openModal(() => <ExpeditionModal />)}
            className="
              w-full bg-slate-700/40 backdrop-blur-sm hover:bg-amber-800/60 text-amber-300 hover:text-amber-100 py-3 px-4 rounded-md transition-all duration-300 transform hover:scale-[1.02] active:scale-95 border-2 border-amber-300/90 hover:border-amber-400/60 font-bold"
          >
            🧭 РАЗВЕДКА
            {expeditions.length > 0 && (
              <span className="ml-2 text-2xs font-semibold text-amber-100/90">
                в пути: {expeditions.length}
              </span>
            )}
          </ClickButton>
        </div>

        {/* Сцена с жабами */}
        <div className="flex-1 min-h-0 pb-5">
          <ToadScene />
        </div>

        {/* Футер статистики */}
        <footer className="mt-auto text-center pb-4 relative">
          <p
            className="text-white text-sm"
            title="Выработка биомассы текущим вольером в час с учётом содержания жаб"
          >
            {toads.length} / {currentScene.capacity} жаб в вольере |{" "}
            {toads.filter((t) => t.type === "hybrid").length} гибридов | 🧪{" "}
            {sceneFarmRate > 0 ? "+" : ""}
            {sceneFarmRate.toFixed(1)}/ч
          </p>
        </footer>

        {/* Фиксированный футер ресурсов */}
        <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-purple-500/20 pt-2 pb-3 z-20">
          <div className="max-w-2xl mx-auto px-10">
            <div className="flex justify-between items-center text-xs px-3">
              <div className="text-pink-300/80">🍎 {account.storage.food} </div>
              <div className="text-lime-300/80">
                🧪 {Math.floor(account?.biomass || 0)}
              </div>
              <div className="text-cyan-300/80">
                {CURRENCY_CONFIG.tokens.icon} {account?.tokens || 0}
              </div>
              <div className="text-green-300/80">
                {CURRENCY_CONFIG.astro_quax.icon} {account?.astro_quax || 0}
              </div>
              <div className="text-purple-300/80 flex gap-1">
                <img src="/assets/logo.webp" width={16} alt="logo" />{" "}
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
