import { useCallback, useEffect, useRef, useState } from "react";
import { completeAchivement } from "../backend/achivements-manager";
import { GameState } from "../backend/localStorage";
import {
  NARRATOR_RESTART_EVENT,
  NARRATOR_STEPS,
  NarratorState,
  NarratorStepId,
  NarratorTaskId,
  TOADS_FED_EVENT,
  hasReadLegacyTutorial,
  loadNarratorState,
  saveNarratorState,
} from "../utils/narrator";
import { useGameState } from "./use-game-state";
import { NEST_ROOM_ID } from "../utils/constants";
import { getToadRoomId } from "../utils/toad-location";

/**
 * Новый игрок начинает с лора, старый (у него уже есть `tutorial_read`) — сразу
 * с готового обучения. Прогресс рассказчика важнее старой метки: если он сохранён,
 * продолжаем ровно с того места, где игрок остановился.
 */
const createInitialState = (): NarratorState => {
  const saved = loadNarratorState();
  if (saved) {
    return saved;
  }

  if (hasReadLegacyTutorial()) {
    return { status: "done", step: "finale" };
  }

  return { status: "active", step: "intro" };
};

/** id всех репродукторов: базового и построенных на карте. */
const getBreedingRoomIds = (state: GameState): Set<string> => {
  const ids = new Set<string>();
  const demolished = new Set(state.colony?.demolished ?? []);

  if (
    !demolished.has(NEST_ROOM_ID) &&
    !demolished.has("breeding")
  ) {
    ids.add(NEST_ROOM_ID);
  }

  state.colony?.rooms.forEach((room) => {
    if (room.kind === "breeding") {
      // Жаба помнит место по id гекса, а постройка в сейве — по своему id: пара может
      // стоять в репродукторе под любым из них, поэтому в набор кладём оба.
      ids.add(room.id);
      ids.add(room.slotId ?? room.id);
    }
  });

  return ids;
};

/**
 * Выполнено ли задание рассказчика. Проверяем именно состояние игры, а не факт
 * нажатия: так шаг не потеряется, если игрок перезагрузил страницу после действия.
 */
const isTaskComplete = (task: NarratorTaskId, state: GameState): boolean => {
  switch (task) {
    case "build-shop":
      return Boolean(state.colony?.rooms.some((room) => room.kind === "shop"));
    case "scout":
      return Boolean(state.colony?.rooms.some((room) => room.kind === "scout"));
    case "breed": {
      const breedingRooms = getBreedingRoomIds(state);
      // Пара должна стоять в одном репродукторе: самец в одном, самка в другом —
      // это ещё не пара.
      const pairs = new Map<string, { male: boolean; female: boolean }>();

      state.toads.forEach((toad) => {
        const roomId = getToadRoomId(toad);

        if (
          toad.stage !== "adult" ||
          !roomId ||
          !breedingRooms.has(roomId)
        ) {
          return;
        }

        const room = pairs.get(roomId) ?? { male: false, female: false };
        if (toad.sex === "male") {
          room.male = true;
        } else if (toad.sex === "female") {
          room.female = true;
        }
        pairs.set(roomId, room);
      });

      return [...pairs.values()].some((pair) => pair.male && pair.female);
    }
    case "feed": {
      const feedable = state.toads.filter((toad) => toad.status !== "out");
      return (
        feedable.length > 0 &&
        feedable.every((toad) => toad.state.hunger >= 100)
      );
    }
  }
};

export const useNarrator = () => {
  const gameState = useGameState();
  const [narrator, setNarrator] = useState<NarratorState>(createInitialState);

  const narratorRef = useRef(narrator);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    narratorRef.current = narrator;
    saveNarratorState(narrator);
  }, [narrator]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  /** Переход к следующему шагу без завершения обучения. */
  const goToStep = useCallback((step: NarratorStepId) => {
    setNarrator({ status: "active", step });
  }, []);

  /**
   * Задание выполнено. Повторный вызов игнорируется: пока игрок строил сектор,
   * состояние могло обновиться несколько раз.
   */
  const completeTask = useCallback(
    (task: NarratorTaskId, next: NarratorStepId) => {
      setNarrator((prev) =>
        prev.status === "active" && prev.step === task
          ? { status: "active", step: next }
          : prev,
      );
    },
    [],
  );

  /** «Дальше» на карточке истории. Финал закрывает обучение. */
  const advance = useCallback(() => {
    if (narrator.status !== "active") {
      return;
    }

    if (narrator.step === "finale") {
      setNarrator({ status: "done", step: "finale" });
      completeAchivement("read-tutorial");
      return;
    }

    goToStep(NARRATOR_STEPS[narrator.step].next);
  }, [goToStep, narrator.status, narrator.step]);

  /** Пропуск без достижения: игрок всегда может вернуться в «Обучение» из меню. */
  const skip = useCallback(() => {
    setNarrator({ status: "done", step: "finale" });
  }, []);

  // Автопроверка заданий по состоянию игры: постройка, посадка пары, кормление.
  const step = NARRATOR_STEPS[narrator.step];
  useEffect(() => {
    if (narrator.status !== "active" || step.kind !== "task") {
      return;
    }

    if (isTaskComplete(step.id, gameState)) {
      completeTask(step.id, step.next);
    }
  }, [completeTask, gameState, narrator.status, step]);

  // Кормление из ядра, карточки жабы и списка жаб идёт через `handleFeedToads`.
  // Из ядра приходит вся колония сразу; одна покормленная жаба задание не закрывает.
  useEffect(() => {
    const handleToadsFed = (event: Event) => {
      const current = narratorRef.current;
      if (current.status !== "active" || current.step !== "feed") {
        return;
      }

      const detail = (event as CustomEvent<{ toadIds?: number[] }>).detail;
      const fedIds = detail?.toadIds;
      if (!Array.isArray(fedIds)) {
        return;
      }

      const feedable = gameStateRef.current.toads.filter(
        (toad) => toad.status !== "out",
      );
      if (
        feedable.length === 0 ||
        feedable.some((toad) => !fedIds.includes(toad.id))
      ) {
        return;
      }

      completeTask("feed", "biomass-brief");
    };

    window.addEventListener(TOADS_FED_EVENT, handleToadsFed);
    return () => window.removeEventListener(TOADS_FED_EVENT, handleToadsFed);
  }, [completeTask]);

  // Сброс игры в настройках возвращает вступление без перезагрузки страницы.
  useEffect(() => {
    const handleRestart = () => {
      setNarrator({ status: "active", step: "intro" });
    };

    window.addEventListener(NARRATOR_RESTART_EVENT, handleRestart);
    return () =>
      window.removeEventListener(NARRATOR_RESTART_EVENT, handleRestart);
  }, []);

  return {
    narrator,
    step,
    advance,
    skip,
  };
};
