import { useEffect, useState } from "react";
import MusicPlayer from "../shared/MusicPlayer";
import LoadingScreen from "../shared/LoadingScreen";
import HexMapScreen from "../HexMap";
import Narrator from "../Narrator";
import {
  processBreeding,
  processToadpoleGrowth,
} from "../../utils/breeding-manager";
import {
  GAME_TICK_HOURS,
  GAME_TICK_MS,
  getOfflineTime,
} from "../../utils/date";
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
import { bootGame, type BootStage } from "../../backend/boot";
import { attachCloudFlush } from "../../backend/cloud-flush";
import { useTelegram } from "../../hooks/use-tg";
import { useNotifications } from "../../hooks/use-notification";
import { useOfflineEvents } from "../../hooks/use-offline-events";
import { getGameState, saveGameState } from "../../backend/localStorage";
import type { OfflineEventType } from "../../utils/offline-events";
import { preloadImages } from "../../utils/ui";

// Конфиг обновлений для уведомлений
const UPDATES_LOG = [
  {
    time: 1791463844929,
    msg: "Большое обновление: ферма биомассы, силы жаб и отдых, ручное разведение в «Репродукторе» и кибер-болезни! Загляните в обучение — там всё описано.",
  },
  {
    time: 1764349635232,
    msg: "Добавлены лутбоксы! Проверьте Торговая Капсула!",
  },
  {
    time: 1764247827677,
    msg: "Добавлена новая игровая механика: генетические поломки ДНК! Можете узнать больше в туториале, либо попробовать поэксперементировать!",
  },
  {
    time: 1764864100220,
    msg: "В Торговая Капсула добавлены новые предметы!",
  },
  {
    time: 1764691777865,
    msg: "Добавлены ЕЩЕ достижения! 🥇",
  },
];

/** Минимальное время показа загрузки: на быстрой сети экран иначе мигает. */
const MIN_LOADING_MS = 600;

/** Пауза перед повтором синка, если старт не смог прочитать облако. */
const CLOUD_RETRY_MS = 60_000;

/** Шаги загрузочного экрана: прогресс и подпись. */
const BOOT_STEPS: Record<
  BootStage | "world" | "ready",
  { progress: number; message: string }
> = {
  platform: { progress: 10, message: "Готовим платформу" },
  auth: { progress: 40, message: "Авторизация" },
  sync: { progress: 70, message: "Загружаем прогресс" },
  world: { progress: 90, message: "Собираем колонию" },
  ready: { progress: 100, message: "Добро пожаловать" },
};

/**
 * Тик голода вместе с автокормушками.
 *
 * Автокормушка кормит жаб сектора со склада, едва их голод доходит до 20 % (`utils/auto-feeder.ts`),
 * поэтому она идёт сразу за тиком голода — и при оффлайн-догоне, и в игровом цикле. Жильцов
 * секторов считает карта, а состояние берём из сейва, а не из React: таймеры живут вне рендера.
 *
 * `newbornSince` — момент закрытия игры: по нему кормушка понимает, что головастик родился
 * в оффлайне, и ставит таймер роста на время рождения, а не на вход в игру.
 */
const runHungerTick = (hoursPassed: number, newbornSince?: number | null) => {
  processHunger(hoursPassed);

  const state = getGameState();
  const rooms = resolveColonyRooms(state.colony ?? EMPTY_COLONY, state.scenes);

  processAutoFeeders(rooms, getRoomToadLists(rooms, state.toads), {
    newbornSince,
  });
};

/**
 * Домашний экран игры.
 *
 * Раньше здесь были сцена с жабами и меню кнопками — теперь это гексагональная карта
 * колонии (HexMapScreen). Главный экран отвечает только за жизненный цикл игры:
 * загрузку, оффлайн-расчёты, игровые таймеры, музыку и онбординг.
 */
export default function ToadGame() {
  const { addNotification } = useNotifications();
  const { addOfflineEvents } = useOfflineEvents();
  const [stage, setStage] = useState<BootStage | "world" | "ready">("platform");
  const [isReady, setIsReady] = useState(false);

  // Платформа здоровается с клиентом (`ready`, `expand`); сама загрузка ждёт её
  // появления внутри boot.ts, поэтому результат хука здесь не нужен.
  useTelegram();

  /**
   * Порядок старта: платформа → вход → прогресс из облака. Пока boot не
   * закончился, вместо карты висит экран загрузки, а оффлайн-догон и игровые
   * таймеры стартуют уже на актуальном сейве.
   */
  useEffect(() => {
    let cancelled = false;
    const intervals: number[] = [];
    const timeouts: number[] = [];
    let onlineRetry: (() => void) | null = null;
    // Сохранение в облако включается только после успешного чтения прогресса:
    // иначе локальный (возможно, старый) сейв затрёт прогресс с другого устройства.
    let cloudSynced = false;

    // Досыл сейва при закрытии игры: таймер облака тикает раз в 3 минуты, и без
    // этого прогресс последних минут оставался бы только на устройстве. Пока
    // облако не прочитано (`isReady`), запись запрещена — как и у таймера.
    const detachCloudFlush = attachCloudFlush({ isReady: () => cloudSynced });

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    /** Догоняем время, пока игра была закрыта: оффлайн-расчёты по свежему сейву. */
    const catchUp = () => {
      // Биоподы строятся гексами: приводим карту колонии и список биоподов в согласие
      syncColonyScenes();

      const { hours: offlineHours, since: lastPlayTime } = getOfflineTime(
        getGameState().lastSaved,
      );

      /**
       * События оффлайн-догона не показываем обычными тостами внизу: игрок мог
       * отсутствовать часами, и они бы просто исчезли. Складываем их в журнал
       * `OfflineEventsProvider`, который открывается кнопкой (!) в HUD.
       */
      const collectOfflineEvent = (notification: {
        type?: OfflineEventType;
        content?: string;
      }) => {
        if (!notification?.content) {
          return;
        }

        addOfflineEvents([
          { type: notification.type, content: notification.content },
        ]);
      };

      // Роды без проверки роста: оффлайн-догон сначала кормит новорождённых
      // автокормушкой, и только потом растит их (`processToadpoleGrowth` ниже).
      processBreeding(collectOfflineEvent, { skipGrowth: true });

      if (offlineHours >= GAME_TICK_HOURS) {
        // `lastPlayTime` — момент закрытия игры: головастики, родившиеся позже него,
        // родились в оффлайне, и их таймер роста идёт с рождения, а не с входа в игру.
        runHungerTick(offlineHours, lastPlayTime);
        // Оффлайн-доход фермы и восстановление сил жаб (Часть 3.3)
        processProduction(offlineHours);
        processEnergyRegen(offlineHours);
        // Кибер-риски оффлайна (Часть 3.6)
        processDiseases(offlineHours);
        processCyberEvents(offlineHours, collectOfflineEvent);
      }

      // Рост после кормления: если головастик родился в оффлайне и его уже накормили,
      // он мог вырасти, пока игра была закрыта — взрослеет сразу на входе.
      processToadpoleGrowth(collectOfflineEvent);

      // Разведка (Часть 5): походы идут по реальному времени, команды возвращаются,
      // а жабы дома восстанавливают HP
      processExpeditions(collectOfflineEvent);
      processHpRegen(offlineHours);

      updateLeaderbord();

      saveGameState(getGameState(), false);
    };

    /** Игровые таймеры: включаются, когда карта уже показана. */
    const startLoops = (synced: boolean) => {
      // Ферма (Часть 3.3): выработка биомассы, апкипинг и восстановление сил жаб
      intervals.push(
        window.setInterval(() => {
          processProduction(GAME_TICK_HOURS);
          processEnergyRegen(GAME_TICK_HOURS);
        }, GAME_TICK_MS),
      );

      // Голод и автокормушки (см. `runHungerTick`): тот же тик, что у фермы
      intervals.push(
        window.setInterval(
          () => runHungerTick(GAME_TICK_HOURS),
          GAME_TICK_MS,
        ),
      );

      // Кибер-события и болезни (Часть 3.6): раз в час игрового времени
      intervals.push(
        window.setInterval(() => {
          processDiseases(1);
          processCyberEvents(1, addNotification);
        }, 60 * 60 * 1000),
      );

      // Роды и рост головастиков. Новые беременности запускаются вручную («Репродуктор»)
      intervals.push(
        window.setInterval(
          () => processBreeding(addNotification),
          60 * 1000,
        ),
      );

      // Разведка (Часть 5): события походов и регенерация HP дома — раз в 5 минут
      intervals.push(
        window.setInterval(() => {
          processExpeditions(addNotification);
          processHpRegen(0.25);
        }, 5 * 60 * 1000),
      );

      intervals.push(
        window.setInterval(() => {
          // Пока облако не прочитано, сейв наверх не отправляем: иначе локальный
          // прогресс затрёт более свежий с другого устройства.
          // При закрытии/скрытии вкладки сейв досылает `attachCloudFlush`, а этот
          // таймер страхует долгую сессию.
          if (cloudSynced) {
            updateGameStateDB();
          }
        }, 3 * 60 * 1000),
      );

      if (synced) {
        return;
      }

      // Старт не смог прочитать облако — догоняем его позже, не блокируя игру.
      const retry = async () => {
        if (cancelled || cloudSynced) {
          return;
        }

        const outcome = await syncGameState();

        if (cancelled || !outcome.synced) {
          return;
        }

        cloudSynced = true;
        console.info("[MainScreen] облако синхронизировано после старта");
      };

      onlineRetry = () => {
        void retry();
      };

      window.addEventListener("online", onlineRetry);
      intervals.push(window.setInterval(onlineRetry, CLOUD_RETRY_MS));
    };

    const start = async () => {
      const startedAt = Date.now();

      preloadImages([
        "/bg/bg-main.webp",
        "/bg/bg-col.webp",
        "/bg/bg-lab.webp",
        "/bg/bg-shop.webp",
        "/bg/main-end.webp",
        "/bg/incubator.webp",
      ]);

      const boot = await bootGame((next) => {
        if (!cancelled) {
          setStage(next);
        }
      });

      if (cancelled) {
        return;
      }

      cloudSynced = boot.synced;

      // Прогресс из облака уже в localStorage — догоняем оффлайн-время по нему.
      setStage("world");
      catchUp();

      // На быстрой сети загрузка мигала бы: даём ей показаться хотя бы немного.
      const left = MIN_LOADING_MS - (Date.now() - startedAt);
      if (left > 0) {
        await wait(left);
      }

      if (cancelled) {
        return;
      }

      setStage("ready");
      setIsReady(true);

      // Костыль для первого рендера
      timeouts.push(
        window.setTimeout(() => {
          window.dispatchEvent(new Event("gameStateUpdated"));
        }, 2000),
      );

      // Проверка обновлений: тосты показываем, когда карта уже на экране.
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

      startLoops(boot.synced);
    };

    start();

    return () => {
      cancelled = true;
      detachCloudFlush();
      intervals.forEach((id) => window.clearInterval(id));
      timeouts.forEach((id) => window.clearTimeout(id));

      if (onlineRetry) {
        window.removeEventListener("online", onlineRetry);
      }
    };
  }, []);

  // Слушатель достижений: тост показываем в любой момент игры.
  useEffect(() => {
    const handleAchievement = (event: Event) => {
      const { name } = (event as CustomEvent<{ name?: string }>).detail ?? {};

      addNotification({
        type: "success",
        content: `Новое достижение! ${name ?? ""}`,
      });
    };

    window.addEventListener("AchivementCompleted", handleAchievement);

    return () => {
      window.removeEventListener("AchivementCompleted", handleAchievement);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#070c14]">
      {!isReady && (
        <LoadingScreen
          progress={BOOT_STEPS[stage].progress}
          message={BOOT_STEPS[stage].message}
        />
      )}
      <HexMapScreen />
      {isReady && <Narrator />}
      <MusicPlayer />
    </div>
  );
}
