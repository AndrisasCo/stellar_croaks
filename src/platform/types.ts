/**
 * ПЛАТФОРМЕННЫЙ СЛОЙ (типы).
 *
 * Всё, что игра просит у «платформы», описано здесь. Реализаций две:
 * `telegram.ts` (Mini App) и `web.ts` (обычный браузер/PWA). Ядро игры —
 * карта, жабы, экономика — не импортирует ни то, ни другое: только эти типы
 * (через `./index`). Поэтому добавление веб-версии/десктопа не касается логики.
 *
 * Важно: интерфейс намеренно маленький — только то, что игра реально использует.
 * `MainButton`, `CloudStorage`, `themeParams` и прочий богатый API Telegram мы не
 * объявляем: как только понадобится, добавляем метод сюда и две реализации.
 */

export type PlatformName = "telegram" | "web";

/**
 * Стили вибрации Telegram. Первые пять — «удары» (impact), три оттенка
 * (success/warning/error) — уведомления, `selection` — отклик выбора.
 * В вебе всё это просто ничего не делает.
 */
export type HapticStyle =
  | "light"
  | "medium"
  | "heavy"
  | "rigid"
  | "soft"
  | "success"
  | "warning"
  | "error"
  | "selection";

export interface PlatformIdentity {
  /** Числовой id пользователя Telegram. Вне Telegram — `null`. */
  tgId: number | null;
  /** Отображаемое имя («Имя Фамилия»). `null`, если Telegram ничего не сообщил. */
  username: string | null;
  /**
   * Подписанная строка `initData` — то, что сервер проверяет подписью бота
   * (см. `supabase/functions/telegram-auth`). Вне Telegram — `null`: подписывать
   * нечего, поэтому веб-аккаунт получает анонимную сессию Supabase.
   *
   * Из этой строки НЕЛЬЗЯ читать личность на клиенте: `tgId`/`username` выше
   * взяты из неподписанного `initDataUnsafe` и годятся только для отображения.
   * Доверенная личность появляется после проверки hash на сервере.
   */
  initData: string | null;
}

/** Хранилище текущего устройства (в обеих реализациях — localStorage браузера). */
export interface PlatformStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface PlatformTheme {
  colorScheme: "light" | "dark";
  /** Цвет фона клиента (в Telegram — тема приложения). */
  bgColor: string | null;
}

/**
 * Размеры видимой области. Полей safe-area здесь нет намеренно: в объявлениях
 * типов проекта (`src/utils/types.d.ts`) их нет, а вёрстка и так берёт отступы
 * из CSS `env(safe-area-inset-*)` (см. `index.html` и `src/index.css`).
 */
export interface PlatformViewport {
  /** Текущая высота видимой области (в Telegram меняется при тяге «шторки»). */
  height: number;
  /** Высота в последнем стабильном состоянии — для элементов у нижнего края. */
  stableHeight: number;
  /** Развёрнуто ли приложение на всю доступную высоту. */
  isExpanded: boolean;
}

export interface Platform {
  readonly name: PlatformName;

  /** Разовые приветственные вызовы платформы (Telegram: ready/expand/…). */
  init(): void;

  /** Тактильный отклик. В вебе — тихий no-op. */
  haptic(style: HapticStyle): void;

  /** Личность для отображения + подписанный `initData` для серверной проверки. */
  identity(): PlatformIdentity;

  /** Хранилище устройства. */
  readonly storage: PlatformStorage;

  theme(): PlatformTheme;

  viewport(): PlatformViewport;

  /** Открыть внешнюю ссылку средствами платформы (в Telegram — не выкидывая из клиента). */
  openLink(url: string): void;

  /** Модальное подтверждение средствами платформы. В вебе — `window.confirm`. */
  confirm(message: string): Promise<boolean>;

  /** Модальное уведомление средствами платформы. В вебе — `window.alert`. */
  alert(message: string): Promise<void>;

  /**
   * Системная кнопка «назад» (в Telegram — BackButton, в вебе — нет).
   * @returns функция снятия: убирает обработчик и прячет кнопку.
   */
  backButton(handler: () => void): () => void;
}
