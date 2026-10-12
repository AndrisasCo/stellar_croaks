import { useEffect, useLayoutEffect, useState } from "react";
import { useToads } from "../ToadContext";
import MusicPlayer from "../shared/MusicPlayer";
import LoadingScreen from "../shared/LoadingScreen";
import TutorialModal from "../modals/TutorialModal";
import HexMapScreen from "../HexMap";
import { useModal } from "../ModalContext";
import { processBreeding, TimeManager } from "../../utils/breeding-manager";
import { processDiseases } from "../../utils/disease-manager";
import { processCyberEvents } from "../../utils/events-manager";
import { syncColonyScenes } from "../../backend/colony";
import { EMPTY_COLONY } from "../../models/colony";
import { resolveColonyRooms } from "../HexMap/colony-build";
import { getRoomToadLists } from "../HexMap/room-toad-lists";
import { processAutoFeeders } from "../../utils/auto-feeder";
import {
  processExpeditions,
  processHpRegen,
} from "../../utils/expedition-manager";
import { processHunger } from "../../utils/state-manager";
import {
  processEnergyRegen,
  processProduction,
} from "../../utils/production-manager";
import {
  syncGameState,
  updateGameStateDB,
  updateLeaderbord,
} from "../../backend/db";
import { useTelegram } from "../../hooks/use-tg";
import { useNotifications } from "../../hooks/use-notification";
import { getGameState, saveGameState } from "../../backend/localStorage";
import { preloadImages } from "../../utils/ui";

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

/**
 * Тик голода вместе с автокормушками.
 *
 * Автокормушка кормит жаб комнаты со склада, едва их голод доходит до 20 % (`utils/auto-feeder.ts`),
 * поэтому она идёт сразу за тиком голода — и при оффлайн-догоне, и в игровом цикле. Жильцов
 * комнат считает карта, а состояние берём из сейва, а не из React: таймеры живут вне рендера.
 */
const runHungerTick = (hoursPassed: number) => {
  processHunger(hoursPassed);

  const state = getGameState();
  const rooms = resolveColonyRooms(state.colony ?? EMPTY_COLONY, state.scenes);

  processAutoFeeders(rooms, getRoomToadLists(rooms, state.toads));
};

/**
 * Домашний экран игры.
 *
 * Раньше здесь были сцена с жабами и меню кнопками — теперь это гексагональная карта
 * колонии (HexMapScreen). Главный экран отвечает только за жизненный цикл игры:
 * загрузку, оффлайн-расчёты, игровые таймеры, музыку и онбординг.
 */
export default function ToadGame() {
  const { account, allToads } = useToads();
  const { isLoading: isLoadingTg } = useTelegram();
  const { addNotification } = useNotifications();
  const { openModal } = useModal();
  const [isLoading, setIsLoading] = useState(true);

  const showLoadingScreen = isLoading || !account || !allToads || isLoadingTg;

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

      // Вольеры строятся гексами: приводим карту колонии и список вольеров в согласие
      syncColonyScenes();

      const timeManager = new TimeManager();
      const offlineHours = timeManager.getTimePassed();

      // Отложенный запуск уведомлений о размножении
      const delayNotification = (props: any) =>
        setTimeout(() => addNotification(props), 2000);

      processBreeding(offlineHours, delayNotification);

      if (offlineHours > 0.09) {
        runHungerTick(offlineHours);
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

    // Голод и автокормушки (см. `runHungerTick`): раз в 5 минут, как и ферма
    const hungerLoop = setInterval(() => runHungerTick(0.1), 5 * 60 * 1000);

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
      setIsLoading(false);

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
        openModal(() => <TutorialModal />);
      }
    }, 2000);

    return () => {
      window.removeEventListener("AchivementCompleted", handleAchievement);
      clearTimeout(loadingTimeout);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#070c14]">
      {showLoadingScreen && <LoadingScreen />}
      <HexMapScreen />
      <MusicPlayer />
    </div>
  );
}
