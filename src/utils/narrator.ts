/**
 * Сценарий первого знакомства со станцией «Квазар».
 *
 * Обучение разбито на две роли:
 *  - `story` — короткая реплика КВАЗа (лор, подсказки по механике), игрок читает и жмёт «Дальше»;
 *  - `task` — маленькое задание на карте, которое проверяется по состоянию игры.
 *
 * Тексты живут здесь, а не в компоненте: сценарий — это данные, и его можно править,
 * не трогая интерфейс. Прогресс хранится отдельно от сейва игры, чтобы перезагрузка
 * страницы не начинала разговор заново и не мешала игроку на середине шага.
 */

import { KVAZ_ACRONYM, KVAZ_NAME, STATION_NAME } from "./lore";

/** Ключ прогресса рассказчика (сбрасывается вместе с игрой в настройках). */
export const NARRATOR_STORAGE_KEY = "Stellar_Croak_Narrator_v1";

/** Событие «прогресс рассказчика сброшен» — по нему UI возвращается к вступлению. */
export const NARRATOR_RESTART_EVENT = "NarratorRestart";

/** Событие ручного кормления: рассказчик ждёт, пока накормят всю колонию. */
export const TOADS_FED_EVENT = "ToadsFed";

export type NarratorStepId = string;

/** Шаги-задания: именно их выполнение проверяется по состоянию игры. */
export type NarratorTaskId = "build-shop" | "feed" | "breed" | "scout";

export interface NarratorStoryStep {
  kind: "story";
  id: NarratorStepId;
  /** Заголовок карточки. */
  title: string;
  /** Реплика КВАЗа. */
  text: string;
  /** Шаг, который начнётся после нажатия «Дальше». */
  next: NarratorStepId;
  /** Подпись кнопки продолжения. */
  actionLabel: string;
}

export interface NarratorTaskStep {
  kind: "task";
  id: NarratorTaskId;
  title: string;
  text: string;
  /** Короткая практическая подсказка: куда нажать. */
  hint: string;
  icon: string;
  next: NarratorStepId;
}

export type NarratorStep = NarratorStoryStep | NarratorTaskStep;

/** Порядок заданий для точек прогресса в интерфейсе. */
export const NARRATOR_TASKS: NarratorTaskId[] = [
  "build-shop",
  "feed",
  "breed",
  "scout",
];

export const NARRATOR_STEPS: Record<NarratorStepId, NarratorStep> = {
  intro: {
    kind: "story",
    id: "intro",
    title: `Станция «${STATION_NAME}»`,
    text: `Крупнейшая космическая станция «${STATION_NAME}». Официально она погибла из-за сбоя системы жизнеобеспечения. Последняя запись журнала гласит: «Организм нестабилен. Он не должен был проснуться». Ты — дрон-хранитель, последняя автоматика, сохранившая сознание. Я — ${KVAZ_NAME}, ${KVAZ_ACRONYM}. Мои воспоминания тоже повреждены - доберемся до центра управления колонии и выясним, что случилось с экипажем. Начнём с малого.`,
    next: "intro2",
    actionLabel: "Дальше",
  },
  intro2: {
    kind: "story",
    id: "intro2",
    title: `Жабы?`,
    text: `Кажется сохранилось ядро исследовательской лабаратории - здесь пытались вывести Идеальный Организм. Ядро даст нам достаточно энергии для начала. Интересно, я вижу несколько выживших земноводных - они будут нам полезны. `,
    next: "build-shop",
    actionLabel: "К делу",
  },
  "build-shop": {
    kind: "task",
    id: "build-shop",
    title: "Первый сектор",
    text: "Ядро предоставляет энергию: построй Торговую капсулу. Это наш мост с внешним миром: через неё колония продаёт лишнее и покупает нужное.",
    hint: "Гекс под током ⚡ (рядом с ядром) → «Торговая капсула» → «Построить».",
    icon: "🏗",
    next: "trade-brief",
  },
  "trade-brief": {
    kind: "story",
    id: "trade-brief",
    title: "Рынок на связи",
    text: "Торговая капсула открывает Торговая Капсула. Продавай излишки биомассы 🧪 на Кваксы 🔷. Во вкладке «Купить» есть корм, расходники и лутбоксы, а редкие заказы платят Астро-кваксы ⭐. Не продавай жаб, которые нужны для селекции, — их гены дороже рынка.",
    next: "core",
    actionLabel: "Понятно",
  },
  core: {
    kind: "story",
    id: "core",
    title: "Ядро колонии",
    text: "В центре карты — ядро, тап по нему открывает информацию о колонии и быстрый доступ к полному списку жаб и любому построенному сектору.",
    next: "feed",
    actionLabel: "Открыть ядро",
  },
  feed: {
    kind: "task",
    id: "feed",
    title: "Кормление",
    text: "Голодная жаба вырабатывает втрое меньше биомассы. Открой ядро в центре карты и нажми «Покормить всех» — перед нажатием видно, сколько корма уйдёт.  На старте склад полон — этого хватит надолго.",
    hint: "Ядро 🏛 в центре карты → «Покормить всех».",
    icon: "🏛",
    next: "biomass-brief",
  },
  "biomass-brief": {
    kind: "story",
    id: "biomass-brief",
    title: "Биомасса",
    text: "Сытые жабы в биоподах круглосуточно производят биомассу 🧪. Она уходит на содержание колонии, размножение и снаряжение походов. Чем сильнее и сытее жаба, тем больше выработка. Следи за счётчиком 🧪 наверху и не давай складу пустовать.",
    next: "breed",
    actionLabel: "Дальше",
  },
  breed: {
    kind: "task",
    id: "breed",
    title: "Пара для потомства",
    text: "В колонии уже есть Репродуктор. Посади в него самца и самку: открой репродуктор на карте и выбери жаб из списка. Ухаживание запускается отдельной кнопкой, когда пара на месте.  ",
    hint: "Репродуктор на карте → самка в первый слот, самец во второй.",
    icon: "🥚",
    next: "breed-brief",
  },
  "breed-brief": {
    kind: "story",
    id: "breed-brief",
    title: "Потомство",
    text: "Характеристики потомства будут наследоваться, таким образом можно выращивать жаб с определенными характеристиками. Например, Качество жабы влияет на выработку биомассы. После начала беременности жабу можно перенести обратно в биопод. Не забудь покормить головастиков, они не вырастут без питания. ",
    next: "scout",
    actionLabel: "Дальше",
  },
  scout: {
    kind: "task",
    id: "scout",
    title: "Взгляд за периметр",
    text: "Колонии нужно много ресурсов и новые образцы. Построй сектор КОНТУР на свободном гексе: из него команды жаб уходят в походы за Периметр. Здесь важно собрать подходящую команду. ",
    hint: "Свободный гекс → «Разведка» → «Построить» (25 🔷).",
    icon: "🧭",
    next: "finale",
  },
  finale: {
    kind: "story",
    id: "finale",
    title: "Последний оплот жизни",
    text: ` Часть отсеков всё ещё запечатана, а следы ведут к проекту «Идеальный Организм». Чем глубже мы заходим, тем сильнее помехи - придется бросить все силы, чтобы найти источник сигнала - продвигайся глубже через КОНТУР. Корми, разводи, продавай излишки и отправляй жаб в разведку. Нам нужно вывести совершенные организмы, чтобы продолжать исследование. Колония теперь в твоих руках.`,
    next: "finale",
    actionLabel: "Принять",
  },
};

export interface NarratorState {
  status: "active" | "done";
  step: NarratorStepId;
}

export const isNarratorStepId = (value: string): value is NarratorStepId =>
  Object.prototype.hasOwnProperty.call(NARRATOR_STEPS, value);

/**
 * Читает сохранённый прогресс. Испорченную запись считаем отсутствующей:
 * лучше начать вступление заново, чем показать игроку пустой экран.
 */
export const loadNarratorState = (): NarratorState | null => {
  try {
    const raw = localStorage.getItem(NARRATOR_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<NarratorState>;
    if (parsed.status !== "active" && parsed.status !== "done") {
      return null;
    }

    if (parsed.status === "done") {
      return { status: "done", step: "finale" };
    }

    if (typeof parsed.step !== "string" || !isNarratorStepId(parsed.step)) {
      return null;
    }

    return { status: "active", step: parsed.step };
  } catch {
    return null;
  }
};

/**
 * Активное задание обучения (`null` — идёт сюжетный шаг или обучение завершено).
 *
 * Читаем сохранённый прогресс: правила карты могут спросить о задании, не подписываясь
 * на состояние рассказчика — оно меняется только внутри `useNarrator`.
 */
export const getActiveNarratorTask = (): NarratorTaskId | null => {
  const state = loadNarratorState();

  if (!state || state.status !== "active") {
    return null;
  }

  return NARRATOR_TASKS.find((task) => task === state.step) ?? null;
};

export const saveNarratorState = (state: NarratorState): void => {
  try {
    localStorage.setItem(NARRATOR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Приватный режим или переполненное хранилище: обучение продолжит работать
    // в памяти до перезагрузки — это лучше, чем уронить игру.
  }
};

/**
 * Старое обучение ставило `tutorial_read` при первом запуске. Если у игрока
 * есть эта метка, а прогресса рассказчика ещё нет, значит он уже прошёл
 * прежнее обучение и не должен снова получать вступление вместо игры.
 */
export const hasReadLegacyTutorial = (): boolean =>
  localStorage.getItem("tutorial_read") === "true";

/**
 * Сбрасывает рассказчика и сообщает об этом открытому интерфейсу.
 * Полная очистка игры в настройках вызывает его следом за `localStorage.clear()`.
 */
export const restartNarrator = (): void => {
  localStorage.removeItem(NARRATOR_STORAGE_KEY);
  window.dispatchEvent(new Event(NARRATOR_RESTART_EVENT));
};
