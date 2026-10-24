/**
 * Сценарий первого знакомства со станцией «Титан».
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
export type NarratorTaskId =
  | "build-shop"
  | "buy-food"
  | "feed"
  | "build-nest"
  | "breed"
  | "accelerate-pregnancy"
  | "grow-tadpole"
  | "scout";

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
  "buy-food",
  "feed",
  "build-nest",
  "breed",
  "accelerate-pregnancy",
  "grow-tadpole",
  "scout",
];

export const NARRATOR_STEPS: Record<NarratorStepId, NarratorStep> = {
  intro: {
    kind: "story",
    id: "intro",
    title: `Станция «${STATION_NAME}»`,
    text: `«${STATION_NAME}» - крупнейшая космическая станция, восстановление которой отложили на неопределенный срок. Официально она погибла из-за сбоя системы жизнеобеспечения. Последняя запись журнала гласит: «Организм нестабилен. Он не должен был проснуться». Ты — дрон-хранитель, последняя автоматика, сохранившая сознание. Я — ${KVAZ_NAME}, ${KVAZ_ACRONYM}. Мои воспоминания тоже повреждены - доберемся до центра управления колонии и выясним, что случилось с экипажем. Начнём с малого.`,
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
    text: "Торговая капсула открывает рынок. Продавай излишки биомассы 🧪 за Кваксы 🔷. Во вкладке «Купить» есть корм, расходники и лутбоксы, а редкие заказы платят Астро-кваксы ⭐. Не продавай жаб, которые нужны для селекции, — их гены еще пригодятся. Сначала купи корм: на складе пусто, а голодные жабы почти не вырабатывают биомассу.",
    next: "buy-food",
    actionLabel: "Дальше",
  },
  "buy-food": {
    kind: "task",
    id: "buy-food",
    title: "Провизия",
    text: "Открой Торговую капсулу и купи «Жабий корм x10» за 60 🔷: этого хватит на первый прокорм всех жаб.",
    hint: "Карта → «Торговая капсула» → вкладка «Купить» → «Жабий корм x10».",
    icon: "🍎",
    next: "core",
  },
  core: {
    kind: "story",
    id: "core",
    title: "Ядро колонии",
    text: "В центре карты — ядро, тап по нему открывает информацию о колонии и быстрый доступ к полному списку жаб и любому построенному сектору. Сейчас ядро подскажет, как накормить колонию.",
    next: "feed",
    actionLabel: "Как кормить",
  },
  feed: {
    kind: "task",
    id: "feed",
    title: "Кормление",
    text: "Открой ядро в центре карты и нажми «Покормить всех» — перед нажатием видно, сколько корма уйдёт.",
    hint: "Ядро 🏛 в центре карты → «Покормить всех».",
    icon: "🏛",
    next: "biomass-brief",
  },
  "biomass-brief": {
    kind: "story",
    id: "biomass-brief",
    title: "Биомасса",
    text: "Сытые жабы в биоподах круглосуточно производят биомассу 🧪. Она уходит на содержание колонии, размножение и снаряжение походов. Чем сильнее и сытее жаба, тем больше выработка. Следи за счётчиком 🧪 наверху и не давай складу пустовать.",
    next: "build-nest",
    actionLabel: "Дальше",
  },
  "build-nest": {
    kind: "task",
    id: "build-nest",
    title: "Репродуктор",
    text: "Для размножения жабам необходим Репродуктор. Построй его на свободном гексе колонии.",
    hint: "Свободный гекс → «Репродуктор» → «Построить» ",
    icon: "🥚",
    next: "breed",
  },
  breed: {
    kind: "task",
    id: "breed",
    title: "Первое потомство",
    text: "Посади в Репродуктор самца и самку: открой его на карте и выбери жаб из списка. Когда пара на месте, нажми «Начать ухаживание» — в обучении самка забеременеет сразу, без ожидания.",
    hint: "Репродуктор на карте → самка в первый слот, самец во второй → «Начать ухаживание».",
    icon: "🥚",
    next: "breed-brief",
  },
  "breed-brief": {
    kind: "story",
    id: "breed-brief",
    title: "Потомство",
    text: "В обучении ждать не нужно: самка уже беременна. Открой её карточку в Репродукторе и нажми «Ускорить» — на складе для этого есть Сияющая мушка ✨. После ускорения рядом появится головастик. Характеристики потомства наследуются, поэтому можно выводить жаб с нужными признаками.",
    next: "accelerate-pregnancy",
    actionLabel: "Дальше",
  },
  "accelerate-pregnancy": {
    kind: "task",
    id: "accelerate-pregnancy",
    title: "Беременность",
    text: "Открой карточку беременной самки в Репродукторе и ускори беременность: на складе уже лежит Сияющая мушка ✨. Головастик появится рядом с матерью — его можно будет покормить и вырастить.",
    hint: "Репродуктор → карточка самки → «Беременность» → «Ускорить».",
    icon: "✨",
    next: "grow-tadpole",
  },
  "grow-tadpole": {
    kind: "task",
    id: "grow-tadpole",
    title: "Рост головастика",
    text: "Головастик родился. Открой его карточку и накорми: первое кормление запускает рост. Затем нажми «Ускорить» в блоке «Рост» — Протеиновый червь 🪱 уже лежит на складе.",
    hint: "Карточка головастика → «Накормить» → блок «Рост» → «Ускорить».",
    icon: "🐸",
    next: "scout",
  },
  scout: {
    kind: "task",
    id: "scout",
    title: "Первый поход",
    text: "Колонии нужны ресурсы и новые образцы. Построй сектор КОНТУР на свободном гексе, открой его и отправь первую команду жаб в поход за Периметр. Собери подходящую команду и нажми «Отправить».",
    hint: "Свободный гекс → «КОНТУР» → «Построить» (25 🔷) → открой КОНТУР → собери команду → «Отправить».",
    icon: "🧭",
    next: "finale",
  },
  finale: {
    kind: "story",
    id: "finale",
    title: "Последний оплот жизни",
    text: `Часть отсеков всё ещё запечатана, а следы ведут к проекту «Идеальный Организм». Чем глубже мы заходим, тем сильнее помехи - придется бросить все силы, чтобы найти источник сигнала - продвигайся глубже через КОНТУР. Корми, разводи, продавай излишки и отправляй жаб в разведку. Нам нужно вывести совершенные организмы, чтобы продолжать исследование. Колония теперь в твоих руках.`,
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
